import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";
import { FaSave, FaEraser, FaInfoCircle, FaCheck } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import {
  createStockAdjustment,
  fetchStockAdjustmentById,
  updateStockAdjustment,
  clearCurrent,
  fetchProductionOrdersForIssue,
  fetchNextAdjustmentNumber,
} from "../../../features/stock-adjustments/stockAdjustmentSlice";
import { fetchRawMaterials } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchRawMaterialStocks } from "../../../features/raw-materials/rawMaterialStockSlice";
import { fetchProducts } from "../../../features/product/productSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { fetchFinishedGoodsStocks } from "../../../features/finished-goods-stock/finishedGoodsStockSlice";
import { convertUomQty, getUomOptions } from "../../../utils/uomConversion";

import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import BusyItemsTable, { type BusyColumn } from "../../../components/form/OrderItemsTable/BusyItemsTable";
import AutocompleteInput, { type AutocompleteOption } from "../../../components/form/AutocompleteInput/AutocompleteInput";

// ──────────────────────────────────────────
// Constants
// ──────────────────────────────────────────
const REASON_OPTIONS = [
  { value: "Inventory Correction", label: "Inventory Correction" },
  { value: "Damaged Goods", label: "Damaged Goods" },
  { value: "Lost / Stolen", label: "Lost / Stolen" },
  { value: "Customer Return", label: "Customer Return" },
  { value: "Found / Recovered", label: "Found / Recovered" },
  { value: "Other", label: "Other" },
];

const getReasonAndNotes = (remarks: string) => {
  if (!remarks) return { reason: "Inventory Correction", notes: "" };
  const parts = remarks.split(" - ");
  const first = parts[0];
  const matched = REASON_OPTIONS.find(
    (opt) => opt.value === first || opt.label === first || opt.value.toUpperCase() === first.toUpperCase()
  );
  if (matched) {
    return { reason: matched.value, notes: parts.slice(1).join(" - ") };
  }
  return { reason: "Other", notes: remarks };
};

const emptyAdjustmentRow = {
  uniqueKey: "",
  itemType: "FINISHED_GOODS",
  rawMaterialId: null as string | null,
  productItemId: null as string | null,
  storeId: "",
  currentQty: 0,
  adjustedQty: 0,
  difference: 0,
  adjustInputValue: "",
  reason: "Inventory Correction",
  name: "",
  itemCode: "",
  categoryName: "",
  uom: "pcs",
  selectedUom: "pcs",
};

// ──────────────────────────────────────────
// Validation
// ──────────────────────────────────────────
const adjustmentItemSchema = z.object({
  itemType: z.enum(["RAW_MATERIAL", "FINISHED_GOODS", "WASTAGE"]),
  rawMaterialId: z.string().nullable().optional(),
  productItemId: z.string().nullable().optional(),
  storeId: z.string().min(1, "Store is required"),
  currentQty: z.number({ message: "Current qty must be a number" }),
  adjustedQty: z.number({ message: "Adjusted qty must be a number" }).min(0, "Cannot be negative"),
  difference: z.number(),
  reason: z.string().min(1, "Reason is required"),
  remarks: z.string().optional().nullable(),
}).refine(item => {
  if (item.itemType === "RAW_MATERIAL" || item.itemType === "WASTAGE") return !!item.rawMaterialId;
  if (item.itemType === "FINISHED_GOODS") return !!item.productItemId;
  return true;
}, { message: "Selection is required", path: ["itemSelection"] });

const pmiItemSchema = z.object({
  rawMaterialId: z.string().min(1),
  storeId: z.string().min(1, "Store is required"),
  issueQty: z.number().min(0.001, "Issue qty must be greater than 0"),
  currentQty: z.number(),
  adjustedQty: z.number(),
  difference: z.number(),
  remarks: z.string().optional().nullable(),
});

const stockAdjustmentFormSchema = z.object({
  adjustmentNumber: z.string().min(1, "Adjustment Number is required"),
  adjustmentDate: z.string().min(1, "Date is required"),
  adjustmentType: z.string().min(1, "Adjustment Type is required"),
  reason: z.string().min(1, "Adjusted By is required").max(255),
  items: z.array(adjustmentItemSchema).min(1, "At least one item is required"),
});

const pmiFormSchema = z.object({
  adjustmentNumber: z.string().min(1, "Adjustment Number is required"),
  adjustmentDate: z.string().min(1, "Date is required"),
  productionOrderId: z.string().min(1, "Production Order is required"),
  reason: z.string().min(1, "Reason is required").max(255),
  items: z.array(pmiItemSchema).min(1, "At least one material is required"),
});

// ──────────────────────────────────────────
// Component
// ──────────────────────────────────────────
const StockAdjustmentForm: React.FC = () => {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentAdjustment, loading, productionOrdersForIssue } = useAppSelector(
    (state) => state.stockAdjustments
  );
  const { data: rawMaterials } = useAppSelector((state) => state.rawMaterials);
  const { data: rmStocks = [] } = useAppSelector((state) => state.rawMaterialStocks);
  const { products } = useAppSelector((state) => state.products);
  const { data: stores } = useAppSelector((state) => state.stores);
  const { data: fgStocks = [] } = useAppSelector(
    (state) => (state as any).finishedGoodsStocks || {}
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>({
    adjustmentNumber: "",
    adjustmentDate: new Date().toISOString().split("T")[0],
    adjustmentType: "STOCK_INCREASE",
    reason: "",
    status: "APPROVED",
    productionOrderId: "",
    items: [{ ...emptyAdjustmentRow }],
  });
  const [pmiItems, setPmiItems] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [isDirty, setIsDirty] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  // Ref to remember blocker's proceed()/reset() from the current block-attempt
  // so the existing discard modal can drive them from its buttons.
  const proceedRef = useRef<(() => void) | null>(null);
  const resetRef = useRef<(() => void) | null>(null);
  useDirtyNavGuard(isDirty, (proceed, reset) => {
    proceedRef.current = proceed;
    resetRef.current = reset;
    setSaveConfirmOpen(true);
  });

  const formRef = useRef<HTMLFormElement>(null);
  const handleSubmitRef = useRef<() => void>(() => {});
  const isDirtyRef = useRef(false);
  const saveConfirmOpenRef = useRef(false);
  // Set when user chose "Save" from the unsaved-changes modal, so the create success path exits instead of clearing.
  const exitAfterSaveRef = useRef(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const handleFormKeyDown = useFormKeyboardNav(formRef);

  useFormShortcuts({ onSave: () => handleSubmitRef.current() });

  const isPMI = formData.adjustmentType === "PRODUCTION_MATERIAL_ISSUE";

  // ── Load reference data ─────────────────
  useEffect(() => {
    dispatch(fetchRawMaterials(undefined));
    dispatch(fetchRawMaterialStocks({ limit: 1000 }));
    dispatch(fetchProducts(undefined));
    dispatch(fetchStores(undefined));
    dispatch(fetchFinishedGoodsStocks({ limit: 1000 }));
    dispatch(fetchProductionOrdersForIssue());
    return () => { dispatch(clearCurrent()); };
  }, [dispatch]);

  // ── Edit mode: populate form ────────────
  useEffect(() => {
    if (isEditMode && id) {
      dispatch(fetchStockAdjustmentById(id));
    }
  }, [isEditMode, id, dispatch]);

  const getPrimaryUom = (uomStr?: string) => {
    if (!uomStr) return "pcs";
    const first = uomStr.split(",")[0].trim();
    const l = first.toLowerCase();
    if (l === "ea" || l === "each" || l === "piece" || l === "pcs") return "pcs";
    return first;
  };

  const getRawMaterialStockQty = useCallback((rmId: string, targetStoreId?: string) => {
    if (!rmId) return 0;
    let matches = (rmStocks as any[]).filter(
      (s: any) => s.rawMaterialId?.toString() === rmId.toString()
    );
    if (targetStoreId) {
      matches = matches.filter((s: any) => s.storeId?.toString() === targetStoreId.toString());
    }
    if (matches.length > 0) {
      return matches.reduce((sum: number, s: any) => sum + Number(s.onHandQty || 0), 0);
    }
    const rm = rawMaterials.find((r: any) => r.rawMaterialId?.toString() === rmId.toString());
    return Number(rm?.onHandQty || 0);
  }, [rmStocks, rawMaterials]);

  const getFinishedGoodStockQty = useCallback((productId: string, targetStoreId?: string) => {
    if (!productId) return 0;
    const pIdStr = productId.toString();

    let matchedFg = fgStocks.filter((f: any) => {
      const fProdId = (f.productItemId || f.productId || f.product?.id || f.id)?.toString();
      return fProdId === pIdStr;
    });

    if (targetStoreId) {
      matchedFg = matchedFg.filter((f: any) => f.storeId?.toString() === targetStoreId.toString());
    }

    if (matchedFg.length > 0) {
      return matchedFg.reduce((sum: number, f: any) => sum + Number(f.onHandQty || 0), 0);
    }

    const prod: any = products.find((p: any) => (p.id || p.productId || p.productItemId)?.toString() === pIdStr);
    if (prod) {
      if (prod.finishedGoodsStocks && Array.isArray(prod.finishedGoodsStocks)) {
        let prodStocks = prod.finishedGoodsStocks;
        if (targetStoreId) {
          prodStocks = prodStocks.filter((f: any) => f.storeId?.toString() === targetStoreId.toString());
        }
        if (prodStocks.length > 0) {
          return prodStocks.reduce((sum: number, f: any) => sum + Number(f.onHandQty || 0), 0);
        }
        if (targetStoreId && prod.finishedGoodsStocks.length > 0) {
          return 0;
        }
      }
      if (!targetStoreId) {
        if (prod.onHandQty != null) return Number(prod.onHandQty);
        if (prod.stock != null) return Number(prod.stock);
        if (prod.currentStock != null) return Number(prod.currentStock);
      }
    }

    return 0;
  }, [fgStocks, products]);

  useEffect(() => {
    if (isEditMode && currentAdjustment) {
      const adjType = currentAdjustment.adjustmentType || "STOCK_INCREASE";

      const loadedItems = currentAdjustment.items?.map((i: any) => {
        const itemType = i.itemType;
        let name = "";
        let itemCode = "";
        let categoryName = "";
        let uom = "";

        if (itemType === "FINISHED_GOODS") {
          name = i.product?.productName || "";
          itemCode = i.product?.productCode || "";
          categoryName = i.product?.category?.name || i.product?.category?.categoryName || "";
          uom = i.product?.uom?.code || i.product?.uom?.uomCode || "pcs";
        } else {
          name = i.rawMaterial?.materialName || "";
          itemCode = i.rawMaterialId || "";
          categoryName = i.rawMaterial?.category?.name || "";
          uom = i.rawMaterial?.baseUom || "kg";
        }

        const remarks = i.remarks || "";
        const parsed = getReasonAndNotes(remarks);

        return {
          ...i,
          uniqueKey: itemType === "FINISHED_GOODS" ? `prod-${i.productItemId}` : `rm-${i.rawMaterialId}`,
          productItemId: i.productItemId ? i.productItemId.toString() : "",
          rawMaterialId: i.rawMaterialId || "",
          name,
          itemCode,
          categoryName,
          uom,
          selectedUom: getPrimaryUom(uom),
          reason: parsed.reason,
          notes: parsed.notes,
          adjustInputValue: String(i.difference || ""),
        };
      }) || [];

      setFormData({
        adjustmentNumber: currentAdjustment.adjustmentNumber,
        adjustmentDate: new Date(currentAdjustment.adjustmentDate).toISOString().split("T")[0],
        adjustmentType: adjType,
        reason: currentAdjustment.reason || "",
        status: currentAdjustment.status,
        productionOrderId: currentAdjustment.productionOrderId || "",
        items: loadedItems.length > 0 ? loadedItems : [{ ...emptyAdjustmentRow }],
      });

      if (adjType === "PRODUCTION_MATERIAL_ISSUE" && currentAdjustment.productionOrder) {
        setSelectedPO(currentAdjustment.productionOrder);
        setPmiItems(
          currentAdjustment.items?.map((i: any) => ({
            rawMaterialId: i.rawMaterialId,
            materialName: i.rawMaterial?.materialName || i.rawMaterialId,
            storeId: i.storeId,
            currentQty: Number(i.currentQty),
            adjustedQty: Number(i.adjustedQty),
            issueQty: Math.abs(Number(i.difference)),
            difference: Number(i.difference),
            remarks: i.remarks || "",
            availableStock: Number(i.currentQty),
            reservedQty: Number(i.currentQty),
            requiredQty: Number(i.currentQty),
            alreadyIssuedQty: 0,
            remainingQty: Number(i.currentQty),
            uom: "KG",
          })) || []
        );
      }
    } else if (!isEditMode) {
      dispatch(fetchNextAdjustmentNumber()).then((action: any) => {
        if (action.payload) {
          setFormData((prev: any) => ({ ...prev, adjustmentNumber: action.payload }));
        }
      });
    }
  }, [currentAdjustment, isEditMode, rawMaterials, products, dispatch]);

  const handlePOSelect = (poId: string) => {
    setIsDirty(true);
    setFormData((prev: any) => ({ ...prev, productionOrderId: poId }));
    if (!poId) {
      setSelectedPO(null);
      setPmiItems([]);
      return;
    }
    const po = productionOrdersForIssue.find((p: any) => p.productionOrderId === poId);
    setSelectedPO(po || null);
    if (po) {
      const defaultStoreId = stores.length > 0 ? stores[0].storeId : "";
      setPmiItems(
        (po.draftRawMaterials || []).map((rm: any) => ({
          rawMaterialId: rm.rawMaterialId,
          materialName: rm.materialName,
          requiredQty: rm.requiredQty,
          reservedQty: rm.reservedQty,
          alreadyIssuedQty: rm.alreadyIssuedQty,
          remainingQty: rm.remainingQty,
          availableStock: rm.availableStock,
          uom: rm.uom,
          issueQty: rm.remainingQty,
          storeId: defaultStoreId,
          currentQty: rm.availableStock,
          adjustedQty: rm.availableStock - rm.remainingQty,
          difference: -rm.remainingQty,
          remarks: "",
        }))
      );
    }
  };

  const handlePMIItemChange = useCallback((index: number, field: string, value: any) => {
    setIsDirty(true);
    setPmiItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === "issueQty") {
        const qty = Number(value);
        item.issueQty = qty;
        item.adjustedQty = item.currentQty - qty;
        item.difference = -qty;

        if (qty > item.availableStock) {
          toast.warn(`Issue Qty cannot exceed Available Stock (${item.availableStock})`);
        }
      }
      if (field === "storeId") item.storeId = value;
      if (field === "remarks") item.remarks = value;

      updated[index] = item;
      return updated;
    });
  }, []);

  const handleAddItem = useCallback(() => {
    setFormData((prev: any) => ({
      ...prev,
      items: [...prev.items, { ...emptyAdjustmentRow }],
    }));
    setIsDirty(true);
  }, []);

  const removeItem = useCallback((index: number) => {
    setFormData((prev: any) => {
      const next = prev.items.filter((_: any, i: number) => i !== index);
      return {
        ...prev,
        items: next.length > 0 ? next : [{ ...emptyAdjustmentRow }],
      };
    });
    setIsDirty(true);
  }, []);

  const formatCleanNumber = (val: number): string => {
    if (Number.isInteger(val)) return String(val);
    return Number(val.toFixed(3)).toString();
  };

  const handleClearAll = () => {
    setFormData((prev: any) => ({ ...prev, items: [{ ...emptyAdjustmentRow }] }));
    setIsDirty(true);
  };

  const selectableItems = useMemo(() => [
    ...products.map((p: any) => ({
      uniqueKey: `prod-${p.id}`,
      id: p.id.toString(),
      name: p.productName,
      itemCode: p.productCode,
      type: "FINISHED_GOODS" as const,
      typeLabel: "Product",
      category: p.category?.name || p.category?.categoryName || "",
      uom: p.uom?.code || p.uom?.uomCode || p.baseUom || "pcs",
    })),
    ...rawMaterials
      .filter((rm) => rm.itemType !== "WASTAGE")
      .map((rm) => ({
        uniqueKey: `rm-${rm.rawMaterialId}`,
        id: rm.rawMaterialId,
        name: rm.materialName,
        itemCode: rm.rawMaterialId,
        type: "RAW_MATERIAL" as const,
        typeLabel: "Raw Material",
        category: rm.category?.name || "",
        uom: rm.baseUom || "kg",
      })),
    ...rawMaterials
      .filter((rm) => rm.itemType === "WASTAGE")
      .map((rm) => ({
        uniqueKey: `wastage-${rm.rawMaterialId}`,
        id: rm.rawMaterialId,
        name: rm.materialName,
        itemCode: rm.rawMaterialId,
        type: "WASTAGE" as const,
        typeLabel: "Wastage",
        category: rm.category?.name || "",
        uom: rm.baseUom || "kg",
      })),
  ], [products, rawMaterials]);

  const itemAutocompleteOptions: AutocompleteOption[] = useMemo(() => {
    return selectableItems.map((item) => ({
      value: item.uniqueKey,
      label: `${item.name} (${item.itemCode || item.id})`,
      selectedLabel: item.name,
      info: (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-ink-subtle">{item.itemCode}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
            item.type === "FINISHED_GOODS" ? "bg-blue-500/15 text-blue-400" :
            item.type === "WASTAGE" ? "bg-amber-500/15 text-amber-400" :
            "bg-emerald-500/15 text-emerald-400"
          }`}>
            {item.typeLabel}
          </span>
        </div>
      ),
    }));
  }, [selectableItems]);

  const regularAdjustmentColumns: BusyColumn<any>[] = useMemo(() => [
    {
      key: "item",
      header: "Product / Raw Material",
      width: "1.8fr",
      render: (row: any, index: number, update: (patch: any) => void) => {
        return (
          <AutocompleteInput
            inline
            name={`items.${index}.uniqueKey`}
            value={row?.uniqueKey || ""}
            options={itemAutocompleteOptions}
            placeholder="Type to search product or raw material..."
            error={errors[`items.${index}.itemSelection`]}
            onChange={(uniqueKey) => {
              const selected = selectableItems.find(s => s.uniqueKey === uniqueKey);
              if (!selected) return;

              const defaultStoreId = stores.length > 0 ? stores[0].storeId : "";
              let itemStoreId = defaultStoreId;
              let currentQty = 0;

              if (selected.type === "FINISHED_GOODS") {
                const fgMatch = (fgStocks as any[]).find(
                  (f: any) => (f.productItemId || f.productId || f.product?.id || f.id)?.toString() === selected.id?.toString()
                );
                if (fgMatch?.storeId) itemStoreId = fgMatch.storeId;
                currentQty = getFinishedGoodStockQty(selected.id, itemStoreId);
              } else {
                const stockRecord = (rmStocks as any[]).find(
                  (s: any) => s.rawMaterialId?.toString() === selected.id?.toString()
                );
                if (stockRecord?.storeId) {
                  itemStoreId = stockRecord.storeId;
                } else {
                  const rm = rawMaterials.find((r: any) => r.rawMaterialId?.toString() === selected.id?.toString());
                  if (rm && (rm as any).storeId) itemStoreId = (rm as any).storeId;
                }
                currentQty = getRawMaterialStockQty(selected.id, itemStoreId);
              }

              const baseUom = getPrimaryUom(selected.uom);

              update({
                uniqueKey: selected.uniqueKey,
                itemType: selected.type,
                rawMaterialId: selected.type === "FINISHED_GOODS" ? null : selected.id,
                productItemId: selected.type === "FINISHED_GOODS" ? selected.id.toString() : null,
                name: selected.name,
                itemCode: selected.itemCode,
                categoryName: selected.category,
                uom: selected.uom,
                selectedUom: baseUom,
                storeId: itemStoreId,
                currentQty: currentQty,
                adjustedQty: currentQty,
                difference: 0,
                adjustInputValue: "",
                reason: row.reason || "Inventory Correction",
              });
              setIsDirty(true);
              setErrors(prev => {
                if (!prev[`items.${index}.itemSelection`] && !prev.items) return prev;
                const next = { ...prev };
                delete next[`items.${index}.itemSelection`];
                delete next.items;
                return next;
              });

              setTimeout(() => {
                const adjCell = document.querySelector(`[data-r="${index}"][data-c="3"]`) as HTMLElement | null;
                const adjInput = adjCell?.querySelector("input") as HTMLInputElement | null;
                if (adjInput) { adjInput.focus(); adjInput.select(); }
              }, 50);
            }}
          />
        );
      },
    },
    {
      key: "storeId",
      header: "Store",
      width: "160px",
      render: (row: any, _index: number, update: (patch: any) => void) => {
        return (
          <select
            data-nav
            value={row.storeId || (stores.length > 0 ? stores[0].storeId : "")}
            onChange={(e) => {
              const newStoreId = e.target.value;
              let newCurrent = 0;
              if (row.itemType === "FINISHED_GOODS") {
                newCurrent = getFinishedGoodStockQty(row.productItemId || "", newStoreId);
              } else {
                newCurrent = getRawMaterialStockQty(row.rawMaterialId || "", newStoreId);
              }
              const diff = Number(row.difference || 0);
              update({
                storeId: newStoreId,
                currentQty: newCurrent,
                adjustedQty: newCurrent + diff,
              });
              setIsDirty(true);
            }}
            className="w-full bg-transparent text-[13px] text-ink outline-none border-none p-0 cursor-pointer"
          >
            {stores.map((s: any) => (
              <option key={s.storeId} value={s.storeId} className="bg-card text-ink">
                {s.storeName || s.name || s.storeId}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: "currentQty",
      header: "Current",
      width: "90px",
      align: "center" as const,
      render: (row: any) => {
        const primaryUom = getPrimaryUom(row.uom || "pcs");
        return (
          <span className="font-semibold text-ink text-[13px]">
            {row.name ? `${row.currentQty ?? 0} ${primaryUom}` : ""}
          </span>
        );
      },
    },
    {
      key: "difference",
      header: "Adjust & UOM",
      width: "150px",
      align: "center" as const,
      render: (row: any, index: number, update: (patch: any) => void) => {
        const currentInputVal = row.adjustInputValue !== undefined ? row.adjustInputValue : (row.difference === 0 ? "" : row.difference);
        const uomOptions = getUomOptions(row.uom);
        const primaryUom = getPrimaryUom(row.uom || "pcs");
        const activeUom = row.selectedUom || uomOptions[0] || primaryUom;

        return (
          <div className="flex items-center w-full h-full gap-0.5 px-0.5">
            <input
              type="text"
              inputMode="decimal"
              data-nav
              value={currentInputVal ?? ""}
              placeholder="0.00"
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "" && val !== "-" && val !== "+" && isNaN(Number(val))) return;
                const numVal = Number(val || 0);
                const current = Number(row.currentQty || 0);
                const diffInPrimary = convertUomQty(numVal, activeUom, primaryUom);
                update({
                  adjustInputValue: val,
                  difference: diffInPrimary,
                  adjustedQty: current + diffInPrimary,
                });
                setIsDirty(true);
                setErrors(prev => {
                  if (!prev[`items.${index}.adjustedQty`] && !prev.items) return prev;
                  const next = { ...prev };
                  delete next[`items.${index}.adjustedQty`];
                  delete next.items;
                  return next;
                });
              }}
              className="flex-1 min-w-0 bg-transparent text-[13px] text-ink text-center outline-none border-none p-0 font-semibold"
            />
            {uomOptions.length > 1 ? (
              <select
                data-nav
                value={activeUom}
                onChange={(e) => {
                  const newUom = e.target.value;
                  const numVal = Number(currentInputVal || 0);
                  const current = Number(row.currentQty || 0);
                  const diffInPrimary = convertUomQty(numVal, newUom, primaryUom);
                  update({
                    selectedUom: newUom,
                    difference: diffInPrimary,
                    adjustedQty: current + diffInPrimary,
                  });
                  setIsDirty(true);
                }}
                className="bg-transparent text-[11px] font-semibold text-ink-subtle border border-line-soft/40 hover:border-line-soft rounded px-1 py-0.5 outline-none cursor-pointer shrink-0"
              >
                {uomOptions.map((u: string) => (
                  <option key={u} value={u} className="bg-card text-ink">
                    {u}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] font-semibold text-ink-subtle px-1 shrink-0">{activeUom}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "newTotal",
      header: "New Total",
      width: "110px",
      align: "center" as const,
      render: (row: any) => {
        if (!row.name) return "";
        const diff = Number(row.difference || 0);
        const current = Number(row.currentQty || 0);
        const newTotal = current + diff;
        const primaryUom = getPrimaryUom(row.uom || "pcs");
        return (
          <div className="flex flex-col items-center leading-tight">
            <span className="font-bold text-ink text-[13px]">
              {formatCleanNumber(newTotal)} {primaryUom}
            </span>
            {diff !== 0 && (
              <span className={`text-[10px] font-bold ${diff > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {diff > 0 ? `+${formatCleanNumber(diff)}` : formatCleanNumber(diff)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "reason",
      header: "Reason",
      width: "170px",
      render: (row: any, _index: number, update: (patch: any) => void) => {
        return (
          <select
            data-nav
            value={row.reason || "Inventory Correction"}
            onChange={(e) => {
              update({ reason: e.target.value });
              setIsDirty(true);
            }}
            className="w-full bg-transparent text-[13px] text-ink outline-none border-none p-0 cursor-pointer"
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-card text-ink">
                {opt.label}
              </option>
            ))}
          </select>
        );
      },
    },
  ], [itemAutocompleteOptions, selectableItems, stores, getFinishedGoodStockQty, getRawMaterialStockQty, errors]);

  const pmiColumns: BusyColumn<any>[] = useMemo(() => [
    {
      key: "material",
      header: "RM Code & Material",
      width: "1.5fr",
      render: (item: any) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink text-xs">{item.materialName}</span>
          <span className="text-[10px] font-mono text-ink-subtle">{item.rawMaterialId}</span>
        </div>
      ),
    },
    {
      key: "storeId",
      header: "Store",
      width: "150px",
      render: (item: any, index: number, update: (patch: any) => void) => (
        <select
          data-nav
          value={item.storeId || ""}
          onChange={(e) => {
            update({ storeId: e.target.value });
            handlePMIItemChange(index, "storeId", e.target.value);
          }}
          className="w-full bg-transparent text-[13px] text-ink outline-none border-none p-0 cursor-pointer"
        >
          <option value="" disabled className="bg-card text-ink">Select Store</option>
          {stores.map((s: any) => (
            <option key={s.storeId} value={s.storeId} className="bg-card text-ink">
              {s.storeName}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "requiredQty",
      header: "Req Qty",
      width: "80px",
      align: "center" as const,
      render: (item: any) => <span className="text-ink-muted text-xs">{Number(item.requiredQty).toFixed(2)}</span>,
    },
    {
      key: "reservedQty",
      header: "Reserved",
      width: "80px",
      align: "center" as const,
      render: (item: any) => <span className="text-ink-muted text-xs">{Number(item.reservedQty).toFixed(2)}</span>,
    },
    {
      key: "alreadyIssuedQty",
      header: "Issued",
      width: "80px",
      align: "center" as const,
      render: (item: any) => <span className="text-ink-muted text-xs">{Number(item.alreadyIssuedQty).toFixed(2)}</span>,
    },
    {
      key: "remainingQty",
      header: "Remaining",
      width: "90px",
      align: "center" as const,
      render: (item: any) => <span className="text-amber-400 font-semibold text-xs">{Number(item.remainingQty).toFixed(2)}</span>,
    },
    {
      key: "availableStock",
      header: "Avail Stock",
      width: "90px",
      align: "center" as const,
      render: (item: any) => <span className="text-emerald-400 font-semibold text-xs">{Number(item.availableStock).toFixed(2)}</span>,
    },
    {
      key: "uom",
      header: "UOM",
      width: "60px",
      align: "center" as const,
      render: (item: any) => <span className="text-ink-subtle text-xs">{item.uom}</span>,
    },
    {
      key: "issueQty",
      header: "Issue Qty",
      width: "100px",
      align: "center" as const,
      render: (item: any, index: number, update: (patch: any) => void) => (
        <input
          type="text"
          inputMode="decimal"
          data-nav
          value={item.issueQty ?? ""}
          onChange={(e) => {
            const val = Number(e.target.value) || 0;
            update({ issueQty: val });
            handlePMIItemChange(index, "issueQty", val);
          }}
          className="w-full bg-transparent text-[13px] text-ink text-center outline-none border-none p-0 font-semibold"
        />
      ),
    },
    {
      key: "remarks",
      header: "Remarks",
      width: "140px",
      render: (item: any, index: number, update: (patch: any) => void) => (
        <input
          type="text"
          data-nav
          value={item.remarks || ""}
          placeholder="Remarks..."
          onChange={(e) => {
            update({ remarks: e.target.value });
            handlePMIItemChange(index, "remarks", e.target.value);
          }}
          className="w-full bg-transparent text-[13px] text-ink outline-none border-none p-0"
        />
      ),
    },
  ], [stores, handlePMIItemChange]);

  const handleExit = () => {
    if (isDirty) {
      lastFocusedRef.current = document.activeElement as HTMLElement;
      setSaveConfirmOpen(true);
    } else {
      navigate(-1);
    }
  };

  handleSubmitRef.current = () => handleSubmit({ preventDefault: () => {} } as React.SyntheticEvent);

  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-select-portal], [aria-expanded='true'][data-nav]")) return;
      e.preventDefault();
      e.stopPropagation();
      if (saveConfirmOpenRef.current) {
        setSaveConfirmOpen(false);
        setTimeout(() => { lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50);
      } else if (isDirtyRef.current) {
        lastFocusedRef.current = document.activeElement as HTMLElement;
        setSaveConfirmOpen(true);
      } else {
        navigate(-1);
      }
    };
    window.addEventListener("keydown", handleEscape, { capture: true });
    return () => window.removeEventListener("keydown", handleEscape, { capture: true });
  }, [navigate]);

  // ── Submit ──────────────────────────────
  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    // Capture-and-clear so a later validation error / retry doesn't inherit a stale exit intent.
    const shouldExitAfterSave = exitAfterSaveRef.current;
    exitAfterSaveRef.current = false;
    setIsSubmitting(true);
    setErrors({});

    if (isPMI) {
      const newErrors: Record<string, string> = {};

      if (!formData.adjustmentDate) {
        newErrors.adjustmentDate = "Date is required";
      }
      if (!formData.reason || !formData.reason.trim()) {
        newErrors.reason = "Reason is required";
      }
      if (!formData.productionOrderId) {
        newErrors.productionOrderId = "Production Order is required";
      }
      if (!pmiItems || pmiItems.length === 0) {
        newErrors.items = "At least one material is required";
      } else {
        pmiItems.forEach((item: any, idx: number) => {
          if (!item.storeId) {
            newErrors[`pmi.${idx}.storeId`] = "Store is required";
          }
          if (!item.issueQty || item.issueQty <= 0) {
            newErrors[`pmi.${idx}.issueQty`] = "Issue Qty must be greater than zero";
          } else if (item.issueQty > item.availableStock) {
            newErrors[`pmi.${idx}.issueQty`] = `Issue Qty exceeds available stock (${item.availableStock})`;
          }
        });
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        toast.error(Object.values(newErrors)[0]);
        setIsSubmitting(false);

        setTimeout(() => {
          if (newErrors.adjustmentDate) {
            formRef.current?.querySelector<HTMLElement>('input[name="adjustmentDate"]')?.focus();
          } else if (newErrors.reason) {
            formRef.current?.querySelector<HTMLElement>('input[name="reason"]')?.focus();
          } else if (newErrors.productionOrderId) {
            formRef.current?.querySelector<HTMLElement>('select[name="productionOrderId"]')?.focus();
          }
        }, 100);
        return;
      }

      const payloadItems = pmiItems.map((item) => ({
        itemType: "RAW_MATERIAL",
        rawMaterialId: item.rawMaterialId,
        storeId: item.storeId,
        currentQty: item.currentQty,
        adjustedQty: item.currentQty - item.issueQty,
        difference: -item.issueQty,
        remarks: item.remarks || `Issued for Production Order ${formData.productionOrderId}`,
      }));

      const payload = {
        adjustmentNumber: formData.adjustmentNumber,
        adjustmentDate: formData.adjustmentDate,
        adjustmentType: "PRODUCTION_MATERIAL_ISSUE",
        productionOrderId: formData.productionOrderId,
        reason: formData.reason,
        status: "APPROVED",
        items: payloadItems,
      };

      try {
        if (isEditMode && id) {
          await dispatch(updateStockAdjustment({ id, data: payload })).unwrap();
          toast.success("Material Issue updated successfully");
          setIsDirty(false);
          if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
          navigate(-1);
        } else {
          await dispatch(createStockAdjustment(payload)).unwrap();
          toast.success("Material Issue saved successfully");
          setIsDirty(false);
          if (shouldExitAfterSave) {
            setSaveConfirmOpen(false);
            setIsSubmitting(false);
            if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
            navigate(-1);
            return;
          }
          setFormData({
            adjustmentNumber: "",
            adjustmentDate: new Date().toISOString().split("T")[0],
            adjustmentType: "STOCK_INCREASE",
            reason: "",
            status: "APPROVED",
            productionOrderId: "",
            items: [{ ...emptyAdjustmentRow }],
          });
          setPmiItems([]);
          setSelectedPO(null);
          setErrors({});
          dispatch(fetchNextAdjustmentNumber()).then((action: any) => {
            if (action.payload) {
              setFormData((prev: any) => ({ ...prev, adjustmentNumber: action.payload }));
            }
          });
          setIsSubmitting(false);
          setTimeout(() => {
            formRef.current?.querySelector<HTMLElement>('input[name="adjustmentDate"], [data-nav]:not([disabled])')?.focus();
          }, 100);
        }
      } catch (err: any) {
        toast.error(err || "An error occurred");
        setIsSubmitting(false);
      }
      return;
    }

    // Regular adjustment validation
    const validItems = formData.items.filter((item: any) => item.uniqueKey || item.rawMaterialId || item.productItemId || item.name);
    const newErrors: Record<string, string> = {};

    if (!formData.adjustmentDate) {
      newErrors.adjustmentDate = "Date is required";
    }
    if (!formData.reason || !formData.reason.trim()) {
      newErrors.reason = "Adjusted By is required";
    }
    if (validItems.length === 0) {
      newErrors.items = "At least one item is required for adjustment.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error(Object.values(newErrors)[0]);
      setIsSubmitting(false);

      setTimeout(() => {
        if (newErrors.adjustmentDate) {
          formRef.current?.querySelector<HTMLElement>('input[name="adjustmentDate"]')?.focus();
        } else if (newErrors.reason) {
          formRef.current?.querySelector<HTMLElement>('input[name="reason"]')?.focus();
        } else if (newErrors.items) {
          formRef.current?.querySelector<HTMLElement>('[data-r="0"][data-c="0"] input, [data-nav]:not([disabled])')?.focus();
        }
      }, 100);
      return;
    }

    const compiledItems = validItems.map((item: any) => ({
      itemType: item.itemType === "WASTAGE" ? "RAW_MATERIAL" : item.itemType,
      rawMaterialId: item.rawMaterialId,
      productItemId: item.productItemId,
      storeId: item.storeId || (stores.length > 0 ? stores[0].storeId : ""),
      currentQty: Number(item.currentQty || 0),
      adjustedQty: Number(item.adjustedQty || 0),
      difference: Number(item.difference || 0),
      reason: item.reason || "Inventory Correction",
      uom: item.selectedUom || item.uom,
      remarks: [
        REASON_OPTIONS.find((o) => o.value === item.reason)?.label || item.reason || "Inventory Correction",
        item.notes,
      ]
        .filter(Boolean)
        .join(" - "),
    }));

    const finalPayload = {
      ...formData,
      status: "APPROVED",
      adjustmentType: formData.adjustmentType || "STOCK_INCREASE",
      items: compiledItems,
    };

    const validation = stockAdjustmentFormSchema.safeParse(finalPayload);
    if (!validation.success) {
      const schemaErrors: Record<string, string> = {};
      validation.error.issues.forEach((err: any) => {
        schemaErrors[err.path.join(".")] = err.message;
      });
      setErrors(schemaErrors);
      toast.error(validation.error.issues[0].message);
      setIsSubmitting(false);
      return;
    }

    try {
      if (isEditMode && id) {
        await dispatch(updateStockAdjustment({ id, data: finalPayload })).unwrap();
        toast.success("Stock Adjustment updated successfully");
        setIsDirty(false);
        if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
        navigate(-1);
      } else {
        await dispatch(createStockAdjustment(finalPayload)).unwrap();
        toast.success("Stock Adjustment created successfully");
        setIsDirty(false);
        if (shouldExitAfterSave) {
          setSaveConfirmOpen(false);
          setIsSubmitting(false);
          if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
          navigate(-1);
          return;
        }
        setFormData({
          adjustmentNumber: "",
          adjustmentDate: new Date().toISOString().split("T")[0],
          adjustmentType: "STOCK_INCREASE",
          reason: "",
          status: "APPROVED",
          productionOrderId: "",
          items: [{ ...emptyAdjustmentRow }],
        });
        setPmiItems([]);
        setSelectedPO(null);
        setErrors({});
        dispatch(fetchNextAdjustmentNumber()).then((action: any) => {
          if (action.payload) {
            setFormData((prev: any) => ({ ...prev, adjustmentNumber: action.payload }));
          }
        });
        setIsSubmitting(false);
        setTimeout(() => {
          formRef.current?.querySelector<HTMLElement>('input[name="adjustmentDate"], [data-nav]:not([disabled])')?.focus();
        }, 100);
      }
    } catch (err: any) {
      toast.error(err || "An error occurred");
      setIsSubmitting(false);
    }
  };

  const validItemsCount = formData.items.filter((item: any) => item.uniqueKey || item.rawMaterialId || item.productItemId || item.name).length;

  return (
    <div className="w-full mx-auto">
      <div className="max-w-[1300px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-visible">
        {/* Page Header */}
        <div className="px-5 py-3 border-b border-line">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink">
              {isEditMode ? "Edit Stock Adjustment" : "New Stock Adjustment"}
            </h2>
            <BackButton text="Back" onClick={handleExit} />
          </div>
        </div>

        <form ref={formRef} onSubmit={(e) => e.preventDefault()} onKeyDown={handleFormKeyDown} className="px-5 py-4 space-y-4" noValidate>
          {/* Section 1: Adjustment Information */}
          <div className="mb-4">
            <div className="mb-4 pb-1.5 border-b border-line">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Adjustment Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block mb-2 text-xs font-bold text-ink-muted uppercase tracking-wider">
                  Date <span className="text-red-500">*</span>
                </label>
                <DatePickerCalendar
                  name="adjustmentDate"
                  value={formData.adjustmentDate}
                  onChange={(e) => {
                    setIsDirty(true);
                    setFormData({ ...formData, adjustmentDate: e.target.value });
                    if (errors.adjustmentDate) setErrors(prev => ({ ...prev, adjustmentDate: "" }));
                  }}
                  required
                />
                {errors.adjustmentDate && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.adjustmentDate}</p>
                )}
              </div>
              <TextInput
                label="Adjusted By"
                name="reason"
                required
                placeholder="Your name"
                value={formData.reason}
                onChange={(e) => {
                  setIsDirty(true);
                  setFormData({ ...formData, reason: e.target.value });
                  if (errors.reason) setErrors(prev => ({ ...prev, reason: "" }));
                }}
                error={errors.reason}
              />
            </div>
          </div>

          {/* Section 2: Production Order Selection (PMI Only) */}
          {isPMI && (
            <div className="pt-2">
              <h6 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">Production Order Selection</h6>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 items-start">
                <div className="lg:col-span-2">
                  <SelectInput
                    label="Production Order"
                    name="productionOrderId"
                    required
                    value={formData.productionOrderId}
                    onChange={(e) => handlePOSelect(e.target.value)}
                    error={errors.productionOrderId}
                    disabled={isEditMode}
                    options={[
                      { label: "-- Select Production Order --", value: "" },
                      ...productionOrdersForIssue.map((po: any) => ({
                        label: `${po.productionOrderId} — ${po.productItem?.productName || ""}`,
                        value: po.productionOrderId,
                      })),
                    ]}
                  />
                </div>
                {selectedPO && (
                  <>
                    <div className="px-3 py-2 bg-card-2 border border-line rounded-lg flex flex-col justify-center min-h-[66px]">
                      <span className="text-xs text-ink-subtle mb-1">Product</span>
                      <span className="text-sm font-semibold text-ink truncate">
                        {selectedPO.productItem?.productName || "—"}
                      </span>
                    </div>
                    <div className="px-3 py-2 bg-card-2 border border-line rounded-lg flex flex-col justify-center min-h-[66px]">
                      <span className="text-xs text-ink-subtle mb-1">Planned Qty</span>
                      <span className="text-sm font-semibold text-ink">
                        {Number(selectedPO.targetQty).toLocaleString()} {selectedPO.uom}
                      </span>
                    </div>
                    <div className="px-3 py-2 bg-card-2 border border-line rounded-lg flex flex-col justify-center min-h-[66px]">
                      <span className="text-xs text-ink-subtle mb-1">Machine</span>
                      <span className="text-sm font-semibold text-ink truncate">
                        {selectedPO.Machine?.machineName || selectedPO.machineMachineId || "—"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {!formData.productionOrderId && (
                <div className="mt-3 p-3 bg-card-2 border border-line text-ink-muted rounded-lg flex items-center gap-2 text-sm">
                  <FaInfoCircle className="flex-shrink-0" />
                  <span>
                    Select a Production Order to load its reserved raw materials for issue.
                    Only orders in <strong>Approved / RM Available</strong> status are shown.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Raw Materials to Issue (PMI Only) */}
          {isPMI && selectedPO && pmiItems.length > 0 && (
            <div className="pt-2 border-t border-line mt-4">
              <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-line">
                <h6 className="text-xs font-bold text-ink uppercase tracking-wide m-0">Raw Materials to Issue <span className="text-rose-500">*</span></h6>
              </div>

              {errors.items && (
                <div className="mb-2 text-[11px] text-red-500 font-medium">{errors.items}</div>
              )}

              <BusyItemsTable
                columns={pmiColumns}
                rows={pmiItems}
                onChange={(newPmi) => {
                  setPmiItems(newPmi);
                  setIsDirty(true);
                }}
                editable={false}
                visibleRows={10}
                getFieldBeforeTable={() => formRef.current?.querySelector<HTMLElement>('select[name="productionOrderId"], input[name="reason"]')}
                getFieldAfterTable={() => formRef.current?.querySelector<HTMLElement>('button[type="submit"]')}
              />
            </div>
          )}

          {/* Section 2: Adjustment Items (Regular Adjustment Only) */}
          {!isPMI && (
            <div className="pt-2 mt-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-2 pb-1.5 border-b border-line">
                <h3 className="text-xs font-bold text-ink uppercase tracking-wide m-0">Items to Adjust <span className="text-rose-500">*</span></h3>
              </div>

              {errors.items && (
                <div className="mb-2 text-[11px] text-red-500 font-medium">{errors.items}</div>
              )}

              <BusyItemsTable
                columns={regularAdjustmentColumns}
                rows={formData.items}
                onChange={(newItems) => {
                  setFormData((prev: any) => ({ ...prev, items: newItems }));
                  setIsDirty(true);
                }}
                emptyRow={emptyAdjustmentRow}
                onAdd={handleAddItem}
                onRemove={removeItem}
                editable={true}
                visibleRows={10}
                getFieldBeforeTable={() => formRef.current?.querySelector<HTMLElement>('input[name="reason"]')}
                getFieldAfterTable={() => formRef.current?.querySelector<HTMLElement>('button[type="submit"]')}
              />
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-line">
            <div>
              {!isPMI && validItemsCount > 0 && (
                <CustomButton
                  text="Clear All"
                  icon={FaEraser}
                  variant="danger"
                  onClick={handleClearAll}
                  type="button"
                />
              )}
            </div>
            <div className="flex items-center gap-3">
              <CustomButton
                text="Cancel"
                icon={FaEraser}
                onClick={handleExit}
                type="button"
              />
              <CustomButton
                text={isSubmitting ? "Saving..." : isPMI ? "Save Material Issue" : `Confirm Adjustment (${validItemsCount})`}
                icon={FaSave}
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting || loading}
              />
            </div>
          </div>
        </form>
      </div>
      <CommonConfirmModal
        show={saveConfirmOpen}
        onHide={() => {
          setSaveConfirmOpen(false);
          if (resetRef.current) { const r = resetRef.current; proceedRef.current = null; resetRef.current = null; r(); }
          setTimeout(() => { lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50);
        }}
        onConfirm={() => {
          exitAfterSaveRef.current = true;
          setSaveConfirmOpen(false);
          setTimeout(() => {
            handleSubmitRef.current();
          }, 100);
        }}
        title="Unsaved Changes"
        message="You have unsaved changes. Do you want to save before leaving?"
        confirmText="Save"
        cancelText="Discard"
        confirmVariant="primary"
        confirmIcon={FaCheck}
        onCancel={() => {
          setSaveConfirmOpen(false);
          setIsDirty(false);
          if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
          navigate(-1);
        }}
      />
    </div>
  );
};

export default StockAdjustmentForm;
