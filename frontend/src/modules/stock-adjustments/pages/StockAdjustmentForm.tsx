import React, { useState, useEffect } from "react";
import { FaSave, FaPlus, FaMinus, FaTimes, FaInfoCircle, FaEraser } from "react-icons/fa";
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
} from "../../../features/stock-adjustments/stockAdjustmentSlice";
import { fetchRawMaterials } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchProducts } from "../../../features/product/productSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { fetchFinishedGoodsStocks } from "../../../features/finished-goods-stock/finishedGoodsStockSlice";

import CustomButton from "../../../components/ui/Button/Button";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import BackButton from "../../../components/ui/BackButton/BackButton";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import { formatDate } from "../../../utils/dateUtils";

// ──────────────────────────────────────────
// Constants
// ──────────────────────────────────────────
const ADJUSTMENT_TYPES = [
  { value: "PRODUCTION_MATERIAL_RETURN", label: "Production Material Return" },
  { value: "STOCK_INCREASE", label: "Stock Increase" },
  { value: "STOCK_DECREASE", label: "Stock Decrease" },
  { value: "DAMAGE", label: "Damage" },
  { value: "SCRAP", label: "Scrap" },
  { value: "OPENING_STOCK", label: "Opening Stock" },
  { value: "MANUAL_CORRECTION", label: "Manual Correction" },
  { value: "OTHER", label: "Other" },
];

const REASON_OPTIONS = [
  { value: "Damaged Goods", label: "Damaged Goods" },
  { value: "Lost / Stolen", label: "Lost / Stolen" },
  { value: "Customer Return", label: "Customer Return" },
  { value: "Found / Recovered", label: "Found / Recovered" },
  { value: "Inventory Correction", label: "Inventory Correction" },
  { value: "Other", label: "Other" },
];

const getReasonAndNotes = (remarks: string) => {
  if (!remarks) return { reason: "", notes: "" };
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
  const { products } = useAppSelector((state) => state.products);
  const { data: stores } = useAppSelector((state) => state.stores);
  const { data: fgStocks = [] } = useAppSelector(
    (state) => (state as any).finishedGoodsStocks || {}
  );

  const [formData, setFormData] = useState<any>({
    adjustmentNumber: "",
    adjustmentDate: new Date().toISOString().split("T")[0],
    adjustmentType: "STOCK_INCREASE",
    reason: "",
    status: "APPROVED",
    productionOrderId: "",
    items: [],
  });
  const [pmiItems, setPmiItems] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Custom manual adjustment states
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All Categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddProductsOpen, setIsAddProductsOpen] = useState(false);

  const isPMI = formData.adjustmentType === "PRODUCTION_MATERIAL_ISSUE";

  // ── Load reference data ─────────────────
  useEffect(() => {
    dispatch(fetchRawMaterials(undefined));
    dispatch(fetchProducts(undefined));
    dispatch(fetchStores(undefined));
    dispatch(fetchFinishedGoodsStocks({}));
    dispatch(fetchProductionOrdersForIssue());
    return () => { dispatch(clearCurrent()); };
  }, [dispatch]);

  // Click outside listener for the dropdown
  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      if (
        isAddProductsOpen &&
        !(e.target as Element).closest(".select-add-products-container")
      ) {
        setIsAddProductsOpen(false);
      }
    };
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, [isAddProductsOpen]);

  // ── Edit mode: populate form ────────────
  useEffect(() => {
    if (isEditMode && id) {
      dispatch(fetchStockAdjustmentById(id));
    }
  }, [isEditMode, id, dispatch]);

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
          productItemId: i.productItemId ? i.productItemId.toString() : "",
          rawMaterialId: i.rawMaterialId || "",
          name,
          itemCode,
          categoryName,
          uom,
          reason: parsed.reason,
          notes: parsed.notes,
        };
      }) || [];

      setFormData({
        adjustmentNumber: currentAdjustment.adjustmentNumber,
        adjustmentDate: new Date(currentAdjustment.adjustmentDate).toISOString().split("T")[0],
        adjustmentType: adjType,
        reason: currentAdjustment.reason || "",
        status: currentAdjustment.status,
        productionOrderId: currentAdjustment.productionOrderId || "",
        items: loadedItems,
      });

      if (adjType === "PRODUCTION_MATERIAL_ISSUE" && currentAdjustment.productionOrder) {
        setSelectedPO(currentAdjustment.productionOrder);
        // Build PMI items from existing adjustment items
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
      setFormData((prev: any) => ({
        ...prev,
        adjustmentNumber: `ADJ-${Date.now().toString().slice(-6)}`,
      }));
    }
  }, [currentAdjustment, isEditMode, rawMaterials, products]);

  // ── Handle PO selection ─────────────────
  const handlePOSelect = (poId: string) => {
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

  // ── PMI item change ─────────────────────
  const handlePMIItemChange = (index: number, field: string, value: any) => {
    const updated = [...pmiItems];
    const item = { ...updated[index], [field]: value };

    if (field === "issueQty") {
      const qty = Number(value);
      item.issueQty = qty;
      item.adjustedQty = item.currentQty - qty;
      item.difference = -qty;

      // Inline validations
      if (qty > item.availableStock) {
        toast.warn(`Issue Qty cannot exceed Available Stock (${item.availableStock})`);
      }
    }

    if (field === "storeId") {
      item.storeId = value;
    }

    if (field === "remarks") {
      item.remarks = value;
    }

    updated[index] = item;
    setPmiItems(updated);
  };

  // ── Regular item change ─────────────────
  const handleItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...formData.items];
    const item = { ...updatedItems[index], [field]: value };

    if (field === "itemType") {
      item.rawMaterialId = "";
      item.productItemId = "";
      item.currentQty = 0;
      item.adjustedQty = 0;
      item.difference = 0;
    }

    if (field === "storeId") {
      item.storeId = value;
    }

    if (
      (item.itemType === "RAW_MATERIAL" || item.itemType === "WASTAGE") &&
      (field === "rawMaterialId" || field === "storeId" || field === "itemType")
    ) {
      const selectedId = field === "rawMaterialId" ? value : item.rawMaterialId;
      const sId = field === "storeId" ? value : item.storeId;
      item.currentQty = getRawMaterialStockQty(selectedId, sId);
      if (field === "rawMaterialId" || field === "itemType") {
        item.adjustedQty = item.currentQty;
        item.difference = 0;
      } else {
        item.difference = Number(item.adjustedQty || 0) - item.currentQty;
      }
    }

    if (
      item.itemType === "FINISHED_GOODS" &&
      (field === "productItemId" || field === "storeId" || field === "itemType")
    ) {
      const pId = field === "productItemId" ? value : item.productItemId;
      const sId = field === "storeId" ? value : item.storeId;
      if (pId) {
        item.currentQty = getFinishedGoodStockQty(pId, sId);
      } else {
        item.currentQty = 0;
      }
      if (field === "productItemId" || field === "itemType") {
        item.adjustedQty = item.currentQty;
        item.difference = 0;
      } else {
        item.difference = Number(item.adjustedQty || 0) - item.currentQty;
      }
    }

    if (field === "adjustedQty") {
      item.adjustedQty = Number(value);
      item.difference = Number(value) - Number(item.currentQty);
    }

    if (field === "currentQty") {
      item.currentQty = Number(value);
      item.difference = Number(item.adjustedQty) - Number(value);
    }

    updatedItems[index] = item;
    setFormData({ ...formData, items: updatedItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          itemType: "RAW_MATERIAL",
          rawMaterialId: "",
          productItemId: "",
          storeId: "",
          currentQty: 0,
          adjustedQty: 0,
          difference: 0,
          remarks: "",
        },
      ],
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_: any, i: number) => i !== index),
    });
  };

  const handleItemDifferenceChange = (index: number, newDiff: number) => {
    const updatedItems = [...formData.items];
    const item = { ...updatedItems[index] };
    item.difference = newDiff;
    item.adjustedQty = Number(item.currentQty || 0) + newDiff;
    updatedItems[index] = item;
    setFormData({ ...formData, items: updatedItems });
  };

  const handleClearAll = () => {
    setFormData({ ...formData, items: [] });
  };

  const categories = Array.from(
    new Set([
      ...products.map((p: any) => p.category?.name || p.category?.categoryName).filter(Boolean),
      ...rawMaterials.map((rm) => rm.category?.name).filter(Boolean),
    ])
  ) as string[];

  const getBaseUoms = (uomStr: string = "kg") => {
    const u = uomStr.toLowerCase().trim();
    if (u === "kg" || u === "g" || u === "t" || u === "ton") return "kg,g,t";
    if (u === "l" || u === "ltr" || u === "ml") return "l,ml";
    if (u === "pcs" || u === "ea" || u === "dz" || u === "each") return "pcs,dz";
    if (u === "m" || u === "cm") return "m,cm";
    return uomStr;
  };

  const getPrimaryUom = (uomStr?: string) => {
    if (!uomStr) return "pcs";
    const first = uomStr.split(",")[0].trim();
    const l = first.toLowerCase();
    if (l === "ea" || l === "each" || l === "piece" || l === "pcs") return "pcs";
    return first;
  };

  const getRawMaterialStockQty = (rmId: string, targetStoreId?: string) => {
    if (!rmId) return 0;
    const rm = rawMaterials.find((r: any) => r.rawMaterialId?.toString() === rmId.toString());
    if (!rm) return 0;
    if (targetStoreId && rm.storeId) {
      if (rm.storeId.toString() !== targetStoreId.toString()) {
        return 0;
      }
    }
    return Number(rm.onHandQty || 0);
  };

  const getFinishedGoodStockQty = (productId: string, targetStoreId?: string) => {
    if (!productId) return 0;
    const pIdStr = productId.toString();

    // 1. Check in fgStocks slice
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

    // 2. Check directly in products array (as ProductList / ProductEdit does)
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
  };

  const selectableItems = [
    ...products.map((p: any) => ({
      uniqueKey: `prod-${p.id}`,
      id: p.id.toString(),
      name: p.productName,
      itemCode: p.productCode,
      type: "FINISHED_GOODS" as const,
      typeLabel: "Finished Goods",
      category: p.category?.name || p.category?.categoryName || "",
      uom: getPrimaryUom(p.uom?.code || p.uom?.uomCode || "pcs"),
      baseUoms: getBaseUoms(p.uom?.code || p.uom?.uomCode || "pcs"),
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
        uom: getPrimaryUom(rm.baseUom || "kg"),
        baseUoms: getBaseUoms(rm.baseUom || "kg"),
      })),
    ...rawMaterials
      .filter((rm) => rm.itemType === "WASTAGE")
      .map((rm) => ({
        uniqueKey: `wastage-${rm.rawMaterialId}`,
        id: rm.rawMaterialId,
        name: rm.materialName,
        itemCode: rm.rawMaterialId,
        type: "WASTAGE" as const,
        typeLabel: "Wastage Product",
        category: rm.category?.name || "",
        uom: getPrimaryUom(rm.baseUom || "kg"),
        baseUoms: getBaseUoms(rm.baseUom || "kg"),
      })),
  ];

  const isItemAlreadyAdded = (item: any) => {
    return formData.items.some((added: any) =>
      added.uniqueKey === item.uniqueKey ||
      (item.type === "FINISHED_GOODS" && added.productItemId?.toString() === item.id.toString()) ||
      (item.type !== "FINISHED_GOODS" && added.rawMaterialId?.toString() === item.id.toString())
    );
  };

  const filteredItemsForSelect = selectableItems.filter((item) => {
    if (selectedCategoryFilter !== "All Categories") {
      if (item.category !== selectedCategoryFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = item.name?.toLowerCase().includes(q);
      const codeMatch = item.itemCode?.toLowerCase().includes(q);
      if (!nameMatch && !codeMatch) return false;
    }
    return true;
  });

  const handleAddItemFromSelect = (item: any) => {
    if (isItemAlreadyAdded(item)) {
      toast.info("This item is already added to the adjustment table.");
      return;
    }
    const defaultStoreId = stores.length > 0 ? stores[0].storeId : "";
    let itemStoreId = defaultStoreId;
    let currentQty = 0;

    if (item.type === "FINISHED_GOODS") {
      currentQty = getFinishedGoodStockQty(item.id, itemStoreId);
    } else {
      const rm = rawMaterials.find((r: any) => r.rawMaterialId?.toString() === item.id?.toString());
      if (rm && rm.storeId) {
        itemStoreId = rm.storeId;
      }
      currentQty = getRawMaterialStockQty(item.id, itemStoreId);
    }

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          itemType: item.type,
          rawMaterialId: item.type === "FINISHED_GOODS" ? null : item.id,
          productItemId: item.type === "FINISHED_GOODS" ? item.id.toString() : null,
          storeId: itemStoreId,
          currentQty: currentQty,
          adjustedQty: currentQty,
          difference: 0,
          remarks: "",
          reason: "",
          notes: "",
          // Local labels & uoms for rendering
          uniqueKey: item.uniqueKey,
          name: item.name,
          itemCode: item.itemCode,
          categoryName: item.category,
          uom: getPrimaryUom(item.uom),
          baseUoms: item.baseUoms || getBaseUoms(item.uom),
        },
      ],
    });
  };

  // ── Submit ──────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (isPMI) {
      // Validate PMI form
      const pmiValidation = pmiFormSchema.safeParse({
        adjustmentNumber: formData.adjustmentNumber,
        adjustmentDate: formData.adjustmentDate,
        productionOrderId: formData.productionOrderId,
        reason: formData.reason,
        items: pmiItems,
      });

      if (!pmiValidation.success) {
        const newErrors: Record<string, string> = {};
        pmiValidation.error.issues.forEach((err) => {
          newErrors[err.path.join(".")] = err.message;
        });
        setErrors(newErrors);
        toast.error(pmiValidation.error.issues[0].message);
        return;
      }

      // Additional PMI validations
      for (const item of pmiItems) {
        if (item.issueQty <= 0) {
          toast.error("Issue Quantity must be greater than zero.");
          return;
        }
        if (item.issueQty > item.availableStock) {
          toast.error(`Issue Qty for ${item.materialName} exceeds available stock (${item.availableStock}).`);
          return;
        }
      }

      // Build payload items from PMI rows
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
        } else {
          await dispatch(createStockAdjustment(payload)).unwrap();
          toast.success("Material Issue saved successfully");
        }
        navigate("/inventory/stock-adjustments");
      } catch (err: any) {
        toast.error(err || "An error occurred");
      }
      return;
    }

    // Regular adjustment validation
    const compiledItems = formData.items.map((item: any) => ({
      itemType: item.itemType === "WASTAGE" ? "RAW_MATERIAL" : item.itemType,
      rawMaterialId: item.rawMaterialId,
      productItemId: item.productItemId,
      storeId: item.storeId || (stores.length > 0 ? stores[0].storeId : ""),
      currentQty: Number(item.currentQty),
      adjustedQty: Number(item.adjustedQty),
      difference: Number(item.difference),
      remarks: [
        REASON_OPTIONS.find((o) => o.value === item.reason)?.label || item.reason,
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
      const newErrors: Record<string, string> = {};
      validation.error.issues.forEach((err: any) => {
        newErrors[err.path.join(".")] = err.message;
      });
      setErrors(newErrors);
      toast.error(validation.error.issues[0].message);
      return;
    }

    try {
      if (isEditMode && id) {
        await dispatch(updateStockAdjustment({ id, data: finalPayload })).unwrap();
        toast.success("Stock Adjustment updated successfully");
      } else {
        await dispatch(createStockAdjustment(finalPayload)).unwrap();
        toast.success("Stock Adjustment created successfully");
      }
      navigate("/inventory/stock-adjustments");
    } catch (err: any) {
      toast.error(err || "An error occurred");
    }
  };



  // ── Render ──────────────────────────────
  return (
    <div className="w-full mx-auto">
      <div className="bg-white  border border-gray-200">
        {/* Page Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-800">
              {isEditMode ? "Edit Stock Adjustment" : "New Stock Adjustment"}
            </h2>
            <BackButton text="Back" to="/inventory/stock-adjustments" />
          </div>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="px-6 py-3 space-y-4" noValidate>
          {/* Section 1: Adjustment Information */}
          <div className="mb-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900">Adjustment Details</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Add items to adjust inventory levels. Each item can have a separate reason.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TextInput
                label="Date"
                required
                name="adjustmentDate"
                type="date"
                value={formData.adjustmentDate}
                onChange={(e) =>
                  setFormData({ ...formData, adjustmentDate: e.target.value })
                }
                error={errors.adjustmentDate}
              />
              <TextInput
                label="Adjusted By"
                name="reason"
                required
                placeholder="Your name"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                error={errors.reason}
              />
            </div>
          </div>

          {/* Section 2: Production Order Selection (PMI Only) */}
          {isPMI && (
            <div className="pt-2">
              <h6 className="text-base font-semibold text-gray-800 mb-3">2. Production Order Selection</h6>
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
                    <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg flex flex-col justify-center min-h-[66px]">
                      <span className="text-xs text-slate-500 mb-1">Product</span>
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {selectedPO.productItem?.productName || "—"}
                      </span>
                    </div>
                    <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg flex flex-col justify-center min-h-[66px]">
                      <span className="text-xs text-slate-500 mb-1">Planned Qty</span>
                      <span className="text-sm font-semibold text-slate-800">
                        {Number(selectedPO.targetQty).toLocaleString()} {selectedPO.uom}
                      </span>
                    </div>
                    <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg flex flex-col justify-center min-h-[66px]">
                      <span className="text-xs text-slate-500 mb-1">Machine</span>
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {selectedPO.Machine?.machineName || selectedPO.machineMachineId || "—"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {!formData.productionOrderId && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg flex items-center gap-2 text-sm">
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
            <div className="pt-2 border-t border-gray-100 mt-4">
              <h6 className="text-base font-semibold text-gray-800 mb-3">3. Raw Materials to Issue</h6>
              <div className="rounded-xl border border-slate-200 bg-white [&_.mb-\[18px\]]:!mb-0 [&_.select-input-group]:!mb-0 overflow-visible">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">RM CODE</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">MATERIAL NAME</th>
                      <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">REQUIRED QTY</th>
                      <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">RESERVED QTY</th>
                      <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">ALREADY ISSUED</th>
                      <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">REMAINING</th>
                      <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">AVAILABLE STOCK</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">UOM</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[200px]">STORE*</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[150px]">ISSUE QTY*</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[180px]">REMARKS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pmiItems.map((item, index) => {
                      const isOver = item.issueQty > item.availableStock;
                      return (
                        <tr key={index} className={`hover:bg-slate-50/50 transition-colors ${isOver ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3 font-mono text-xs">{item.rawMaterialId}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{item.materialName}</td>
                          <td className="px-4 py-3 text-right">{Number(item.requiredQty).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">{Number(item.reservedQty).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right">{Number(item.alreadyIssuedQty).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-yellow-600 font-semibold">{Number(item.remainingQty).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-semibold">{Number(item.availableStock).toFixed(2)}</td>
                          <td className="px-4 py-3 text-slate-500">{item.uom}</td>
                          <td className="px-4 py-3 align-top">
                            <SelectInput
                              label=""
                              hideLabel
                              noMargin
                              name={`storeId-${index}`}
                              value={item.storeId || ""}
                              options={[
                                { label: "Select Store", value: "" },
                                ...stores.map((s) => ({
                                  label: s.storeName,
                                  value: s.storeId,
                                })),
                              ]}
                              onChange={(e) =>
                                handlePMIItemChange(index, "storeId", e.target.value)
                              }
                            />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <QuantityInput
                              label=""
                              name={`issueQty-${index}`}
                              value={item.issueQty}
                              baseUoms={item.uom}
                              step="0.001"
                              onChange={(e: any) =>
                                handlePMIItemChange(index, "issueQty", Number(e.target.value))
                              }
                            />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <TextInput
                              label=""
                              name={`remarks-${index}`}
                              placeholder="Remarks..."
                              value={item.remarks || ""}
                              onChange={(e) =>
                                handlePMIItemChange(index, "remarks", e.target.value)
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 2: Adjustment Items (Regular Adjustment Only) */}
          {!isPMI && (
            <div className="pt-2 mt-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
                <h3 className="text-base font-bold text-slate-800 m-0">Items to Adjust</h3>
                <div className="flex items-center gap-2.5">
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => {
                      setSelectedCategoryFilter(e.target.value);
                      if (!isAddProductsOpen) setIsAddProductsOpen(true);
                    }}
                    className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:border-primary shadow-sm hover:border-slate-300 transition-all cursor-pointer"
                  >
                    <option value="All Categories">All Categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <div className="relative select-add-products-container">
                    <CustomButton
                      text={`${formData.items.length} Selected`}
                      icon={FaPlus}
                      size="sm"
                      onClick={() => setIsAddProductsOpen(!isAddProductsOpen)}
                      className="!bg-white !text-slate-800 hover:!bg-slate-50 !border !border-slate-200 shadow-sm"
                    />

                    {isAddProductsOpen && (
                      <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            placeholder="Search products or materials..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary focus:bg-white transition-all"
                            autoFocus
                          />
                          <select
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-primary"
                          >
                            <option value="All Categories">All</option>
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                          {filteredItemsForSelect.length > 0 ? (
                            filteredItemsForSelect.map((item: any) => {
                              const added = isItemAlreadyAdded(item);
                              return (
                                <div
                                  key={item.uniqueKey}
                                  onClick={() => {
                                    if (!added) {
                                      handleAddItemFromSelect(item);
                                      setIsAddProductsOpen(false);
                                    }
                                  }}
                                  className={`p-2.5 border border-transparent rounded-xl transition-all flex items-center justify-between group ${
                                    added
                                      ? "opacity-50 cursor-not-allowed bg-slate-50"
                                      : "hover:bg-primary/5 hover:border-primary/20 cursor-pointer"
                                  }`}
                                >
                                  <div>
                                    <div className={`text-sm font-semibold text-slate-800 ${!added && "group-hover:text-primary"} transition-colors`}>
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                                      {item.itemCode} • {item.category || "General"}
                                    </div>
                                  </div>
                                  {added ? (
                                    <span className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 rounded-lg uppercase tracking-wider flex items-center gap-1">
                                      ✓ Added
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 text-[10px] font-bold bg-slate-100 group-hover:bg-primary/10 text-slate-600 group-hover:text-primary rounded-lg transition-colors uppercase tracking-wider">
                                      {item.typeLabel}
                                    </span>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="py-6 text-center text-sm text-slate-400">
                              No items match your filter/search.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 overflow-visible bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider min-w-[160px]">
                        Store
                      </th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-600 uppercase tracking-wider w-28">
                        Current
                      </th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-600 uppercase tracking-wider min-w-[240px]">
                        Adjust
                      </th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-600 uppercase tracking-wider w-28">
                        New Total
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider min-w-[160px]">
                        Reason
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider min-w-[200px]">
                        Notes
                      </th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-600 uppercase tracking-wider w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formData.items.length > 0 ? (
                      formData.items.map((item: any, index: number) => {
                        const diff = Number(item.difference || 0);
                        const current = Number(item.currentQty || 0);
                        const newTotal = current + diff;
                        const uom = getPrimaryUom(item.uom || "pcs");

                        return (
                          <tr key={index} className="hover:bg-slate-50/60 transition-colors group">
                            {/* Product */}
                            <td className="px-5 py-4 align-middle">
                              <div className="font-bold text-slate-800 text-sm">
                                {item.name || "Unnamed Item"}
                              </div>
                              <div className="text-xs text-slate-400 font-mono mt-0.5 uppercase tracking-wide">
                                {item.itemCode || ""} • {item.categoryName || item.itemType || "ITEM"}
                              </div>
                            </td>

                            {/* Store */}
                            <td className="px-4 py-4 align-middle">
                              <div className="[&_.mb-4]:!mb-0 [&_.mb-\[18px\]]:!mb-0">
                                <SelectInput
                                  label=""
                                  hideLabel={true}
                                  noMargin={true}
                                  name={`storeId-${index}`}
                                  value={item.storeId || (stores.length > 0 ? stores[0].storeId : "")}
                                  options={[
                                    { label: "Select Store", value: "" },
                                    ...stores.map((s: any) => ({
                                      label: s.storeName || s.name || s.storeId,
                                      value: s.storeId,
                                    })),
                                  ]}
                                  onChange={(e: any) => handleItemChange(index, "storeId", e.target.value)}
                                />
                              </div>
                            </td>

                            {/* Current */}
                            <td className="px-4 py-4 align-middle text-center">
                              <span className="font-bold text-slate-800 text-base">
                                {current}
                                {uom}
                              </span>
                            </td>

                            {/* Adjust */}
                            <td className="px-4 py-4 align-middle text-center">
                              <div className="flex items-center justify-center gap-1.5 min-w-[220px]">
                                <CustomButton
                                  text=""
                                  icon={FaMinus}
                                  size="sm"
                                  onClick={() => handleItemDifferenceChange(index, diff - 1)}
                                  className="!bg-white !text-slate-700 hover:!bg-slate-100 !border !border-slate-200 !px-3 !h-10"
                                />
                                <div className="flex-1 min-w-[140px] [&_.mb-4]:!mb-0">
                                  <QuantityInput
                                    hideLabel={true}
                                    name={`difference-${index}`}
                                    value={diff === 0 ? "" : diff}
                                    baseUoms={item.baseUoms || item.uom || "kg,g"}
                                    onChange={(e: any) =>
                                      handleItemDifferenceChange(
                                        index,
                                        e.target.value === "" ? 0 : Number(e.target.value)
                                      )
                                    }
                                    disabled={false}
                                  />
                                </div>
                                <CustomButton
                                  text=""
                                  icon={FaPlus}
                                  size="sm"
                                  onClick={() => handleItemDifferenceChange(index, diff + 1)}
                                  className="!bg-white !text-slate-700 hover:!bg-slate-100 !border !border-slate-200 !px-3 !h-10"
                                />
                              </div>
                            </td>

                            {/* New Total */}
                            <td className="px-4 py-4 align-middle text-center">
                              <div className="font-bold text-slate-900 text-base">
                                {newTotal}
                                {uom}
                              </div>
                              <div
                                className={`text-xs font-bold mt-0.5 ${
                                  diff > 0
                                    ? "text-green-600"
                                    : diff < 0
                                    ? "text-red-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {diff > 0 ? `+${diff}${uom}` : `${diff}${uom}`}
                              </div>
                            </td>

                            {/* Reason */}
                            <td className="px-4 py-4 align-middle">
                              <div className="[&_.mb-4]:!mb-0 [&_.mb-\[18px\]]:!mb-0">
                                <SelectInput
                                  label=""
                                  hideLabel={true}
                                  noMargin={true}
                                  name={`reason-${index}`}
                                  value={item.reason || ""}
                                  options={[
                                    { label: "Select reason", value: "" },
                                    ...REASON_OPTIONS,
                                  ]}
                                  onChange={(e: any) => handleItemChange(index, "reason", e.target.value)}
                                />
                              </div>
                            </td>

                            {/* Notes */}
                            <td className="px-4 py-4 align-middle">
                              <div className="[&_.mb-4]:!mb-0 [&_.mb-\[18px\]]:!mb-0">
                                <TextInput
                                  label=""
                                  name={`notes-${index}`}
                                  placeholder="Optional notes..."
                                  value={item.notes || ""}
                                  onChange={(e: any) => handleItemChange(index, "notes", e.target.value)}
                                />
                              </div>
                            </td>

                            {/* Delete Action */}
                            <td className="px-4 py-4 align-middle text-center">
                              <DeleteButton onClick={() => removeItem(index)} />
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span>No items added for adjustment yet.</span>
                            <button
                              type="button"
                              onClick={() => setIsAddProductsOpen(true)}
                              className="text-primary font-semibold hover:underline"
                            >
                              Click + to select products or raw materials
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100">
            <div>
              {!isPMI && formData.items.length > 0 && (
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
                onClick={() => navigate("/inventory/stock-adjustments")}
                type="button"
              />
              <CustomButton
                text={isPMI ? "Save Material Issue" : `Confirm Adjustment (${formData.items.length})`}
                icon={FaSave}
                type="submit"
                onClick={handleSubmit}
                disabled={loading}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjustmentForm;
