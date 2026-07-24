import React, { useState, useEffect } from "react";
import { FaSave, FaPlus, FaTimes, FaInfoCircle } from "react-icons/fa";
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

// ──────────────────────────────────────────
// Validation
// ──────────────────────────────────────────
const adjustmentItemSchema = z.object({
  itemType: z.enum(["RAW_MATERIAL", "FINISHED_GOODS"]),
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
  reason: z.string().min(1, "Reason is required").max(255),
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
    status: "DRAFT",
    productionOrderId: "",
    items: [],
  });
  const [pmiItems, setPmiItems] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // ── Edit mode: populate form ────────────
  useEffect(() => {
    if (isEditMode && id) {
      dispatch(fetchStockAdjustmentById(id));
    }
  }, [isEditMode, id, dispatch]);

  useEffect(() => {
    if (isEditMode && currentAdjustment) {
      const adjType = currentAdjustment.adjustmentType || "STOCK_INCREASE";
      setFormData({
        adjustmentNumber: currentAdjustment.adjustmentNumber,
        adjustmentDate: new Date(currentAdjustment.adjustmentDate).toISOString().split("T")[0],
        adjustmentType: adjType,
        reason: currentAdjustment.reason || "",
        status: currentAdjustment.status,
        productionOrderId: currentAdjustment.productionOrderId || "",
        items: currentAdjustment.items?.map((i: any) => ({
          ...i,
          productItemId: i.productItemId ? i.productItemId.toString() : "",
          rawMaterialId: i.rawMaterialId || "",
        })) || [],
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
  }, [currentAdjustment, isEditMode]);

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

    if (
      (item.itemType === "RAW_MATERIAL" || item.itemType === "WASTAGE") &&
      (field === "rawMaterialId" || field === "itemType")
    ) {
      const selectedId = field === "rawMaterialId" ? value : item.rawMaterialId;
      const rm = rawMaterials.find((r) => r.rawMaterialId === selectedId);
      item.currentQty = rm ? Number(rm.onHandQty || 0) : 0;
      item.adjustedQty = item.currentQty;
      item.difference = 0;
    }

    if (
      item.itemType === "FINISHED_GOODS" &&
      (field === "productItemId" || field === "storeId" || field === "itemType")
    ) {
      const pId = field === "productItemId" ? value : item.productItemId;
      const sId = field === "storeId" ? value : item.storeId;
      if (pId && sId) {
        const fg = fgStocks.find(
          (f: any) =>
            f.storeId === sId && f.productItemId?.toString() === pId.toString()
        );
        item.currentQty = fg ? Number(fg.onHandQty || 0) : 0;
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
        status: "DRAFT",
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
    const validation = stockAdjustmentFormSchema.safeParse(formData);
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
        await dispatch(updateStockAdjustment({ id, data: formData })).unwrap();
        toast.success("Stock Adjustment updated successfully");
      } else {
        await dispatch(createStockAdjustment(formData)).unwrap();
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
          </div>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="px-6 py-3 space-y-4" noValidate>
          {/* Section 1: Adjustment Information */}
          <div>
            <h6 className="text-base font-semibold text-gray-800 mb-3">1. Adjustment Information</h6>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <TextInput
                label="Adjustment Number"
                name="adjustmentNumber"
                required
                value={formData.adjustmentNumber}
                onChange={(e) =>
                  setFormData({ ...formData, adjustmentNumber: e.target.value })
                }
                disabled={true}
                error={errors.adjustmentNumber}
              />
              <TextInput
                label="Adjustment Date"
                required
                name="adjustmentDate"
                type="date"
                value={formData.adjustmentDate}
                onChange={(e) =>
                  setFormData({ ...formData, adjustmentDate: e.target.value })
                }
                error={errors.adjustmentDate}
              />
              <SelectInput
                label="Adjustment Type"
                name="adjustmentType"
                required
                value={formData.adjustmentType}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    adjustmentType: e.target.value,
                    productionOrderId: "",
                    items: [],
                  });
                  setSelectedPO(null);
                  setPmiItems([]);
                }}
                disabled={isEditMode}
                error={errors.adjustmentType}
                options={ADJUSTMENT_TYPES}
              />
              <TextInput
                label="Reason / Description"
                name="reason"
                required
                placeholder="Reason for this adjustment"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                error={errors.reason}
              />
              {!isPMI && (
                <SelectInput
                  label="Production Order (Optional)"
                  name="productionOrderId"
                  value={formData.productionOrderId}
                  onChange={(e) =>
                    setFormData({ ...formData, productionOrderId: e.target.value })
                  }
                  options={[
                    { label: "-- Select Production Order (Optional) --", value: "" },
                    ...productionOrdersForIssue.map((po: any) => ({
                      label: `${po.productionOrderId} — ${po.productItem?.productName || ""}`,
                      value: po.productionOrderId,
                    })),
                  ]}
                />
              )}
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
            <div className="pt-2 border-t border-gray-100 mt-4">
              <div className="flex justify-between items-center mb-3">
                <h6 className="text-base font-semibold text-gray-800 m-0">2. Adjustment Items</h6>
                <CustomButton
                  text="Add Item"
                  icon={FaPlus}
                  onClick={addItem}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white [&_.mb-\[18px\]]:!mb-0 [&_.select-input-group]:!mb-0 overflow-visible">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[150px]">ITEM TYPE</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[200px]">ITEM SELECTION</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[200px]">STORE</th>
                      <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 w-24">CURRENT QTY</th>
                      <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 w-32">ADJUSTED QTY</th>
                      <th className="px-3 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 w-24">DIFF</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[150px]">REMARKS</th>
                      <th className="px-3 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 w-16">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formData.items.length > 0 ? (
                      formData.items.map((item: any, index: number) => {
                        const itemSelectionError =
                          errors[`items.${index}.rawMaterialId`] ||
                          errors[`items.${index}.productItemId`] ||
                          errors[`items.${index}.itemSelection`];
                        const storeError = errors[`items.${index}.storeId`];
                        const adjustedQtyError = errors[`items.${index}.adjustedQty`];

                        return (
                          <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 align-top">
                              <SelectInput
                                label=""
                                hideLabel
                                noMargin
                                name={`itemType-${index}`}
                                value={item.itemType}
                                options={[
                                  { label: "Raw Material", value: "RAW_MATERIAL" },
                                  { label: "Finished Goods", value: "FINISHED_GOODS" },
                                  { label: "Wastage Product", value: "WASTAGE" },
                                ]}
                                onChange={(e) =>
                                  handleItemChange(index, "itemType", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-4 py-3 align-top">
                              {item.itemType === "RAW_MATERIAL" || item.itemType === "WASTAGE" ? (
                                <SelectInput
                                  label=""
                                  hideLabel
                                  noMargin
                                  name={`rawMaterialId-${index}`}
                                  value={item.rawMaterialId || ""}
                                  error={itemSelectionError}
                                  required
                                  options={[
                                    { label: "Select Material", value: "" },
                                    ...rawMaterials.filter((rm: any) => item.itemType === "WASTAGE" ? rm.itemType === "WASTAGE" : rm.itemType !== "WASTAGE").map((rm) => ({
                                      label: `${rm.materialName} (${rm.rawMaterialId})`,
                                      value: rm.rawMaterialId,
                                    })),
                                  ]}
                                  onChange={(e) =>
                                    handleItemChange(index, "rawMaterialId", e.target.value)
                                  }
                                />
                              ) : (
                                <SelectInput
                                  label=""
                                  hideLabel
                                  noMargin
                                  name={`productItemId-${index}`}
                                  value={item.productItemId || ""}
                                  error={itemSelectionError}
                                  required
                                  options={[
                                    { label: "Select Product", value: "" },
                                    ...products.map((p) => ({
                                      label: `${p.productName} (${p.productCode})`,
                                      value: p.id.toString(),
                                    })),
                                  ]}
                                  onChange={(e) =>
                                    handleItemChange(index, "productItemId", e.target.value)
                                  }
                                />
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <SelectInput
                                label=""
                                hideLabel
                                noMargin
                                name={`storeId-${index}`}
                                value={item.storeId || ""}
                                error={storeError}
                                required
                                options={[
                                  { label: "Select Store", value: "" },
                                  ...stores.map((s) => ({
                                    label: s.storeName,
                                    value: s.storeId,
                                  })),
                                ]}
                                onChange={(e) =>
                                  handleItemChange(index, "storeId", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-4 py-3 align-top text-right pt-4">
                              {String(item.currentQty)}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <TextInput
                                label=""
                                name={`adjustedQty-${index}`}
                                type="number"
                                value={String(item.adjustedQty)}
                                error={adjustedQtyError}
                                required
                                onChange={(e: any) =>
                                  handleItemChange(index, "adjustedQty", e.target.value)
                                }
                              />
                            </td>
                            <td className={`px-4 py-3 align-top text-center pt-4 font-bold ${item.difference > 0
                              ? "text-green-600"
                              : item.difference < 0
                                ? "text-red-600"
                                : "text-slate-400"
                              }`}>
                              {item.difference > 0 ? `+${item.difference}` : item.difference}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <TextInput
                                label=""
                                name={`remarks-${index}`}
                                placeholder="Remarks"
                                value={item.remarks || ""}
                                onChange={(e: any) =>
                                  handleItemChange(index, "remarks", e.target.value)
                                }
                              />
                            </td>
                            <td className="px-4 py-3 align-top text-center pt-4">
                              <DeleteButton onClick={() => removeItem(index)} />
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-500">
                          No adjustment items added. Click "Add Item" to begin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
            <CustomButton
              text="Cancel"
              icon={FaTimes}
              onClick={() => navigate("/inventory/stock-adjustments")}
            />
            <CustomButton
              text={isPMI ? "Save Material Issue" : "Save Adjustment"}
              icon={FaSave}
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjustmentForm;
