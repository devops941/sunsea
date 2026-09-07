import React, { useState, useEffect, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { FaSave, FaCheck } from "react-icons/fa";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CustomButton from "../../../components/ui/Button/Button";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createProductionWastage, updateProductionWastage } from "../../../features/production-wastage/productionWastageSlice";
import { fetchProductionOrders } from "../../../features/production-orders/productionOrderSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchProducts } from "../../../features/product/productSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { fetchRawMaterials } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchActiveUOMs } from "../../../features/uoms/uomSlice";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { z } from "zod";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { categoryService } from "../../../services/categoryService";

const wastageSchema = z.object({
  wastageDate: z.string().min(1, "Wastage date is required"),
  productionOrderId: z.string().min(1, "Production Order reference is required"),
  wastageType: z.string().min(1, "Wastage Type is required"),
  machineId: z.string().min(1, "Machine reference is required"),
  shiftId: z.string().min(1, "Shift reference is required"),
  productId: z.string().min(1, "Product reference is required"),
  rawMaterialId: z.string().optional(),
  quantity: z.string()
    .min(1, "Wastage quantity is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Wastage quantity must be greater than 0",
    }),
  uom: z.string().min(1, "UOM is required"),
  estimatedValue: z.string().optional(),
  reason: z.string().optional(),
  correctiveAction: z.string().optional(),
  remarks: z.string().optional(),
});

const WASTAGE_TYPES = [
  { label: "Startup Waste", value: "STARTUP" },
  { label: "Machine Setup Waste", value: "MACHINE_SETUP" },
  { label: "Quality Rejection", value: "QUALITY_REJECTION" },
  { label: "Raw Material Waste", value: "RAW_MATERIAL_WASTE" },
  { label: "Scrap Material", value: "SCRAP" },
  { label: "Rework Waste", value: "REWORK" },
  { label: "Machine Breakdown Stoppage", value: "MACHINE_BREAKDOWN" },
  { label: "Power Failure Stoppage", value: "POWER_FAILURE" },
  { label: "Mould Change Waste", value: "MOULD_CHANGE" },
  { label: "Color Change Waste", value: "COLOR_CHANGE" },
  { label: "Other Waste", value: "OTHER" },
];

const WastageForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const isEdit = Boolean(id);

  // Redux state
  const { data: productionOrders } = useAppSelector((state) => state.productionOrders);
  const { data: machines } = useAppSelector((state) => state.machines);
  const { products } = useAppSelector((state: any) => state.products || { products: [] });
  const { data: shifts } = useAppSelector((state) => state.shifts);
  const { data: rawMaterials } = useAppSelector((state) => state.rawMaterials);
  const { activeData: activeUOMs = [] } = useAppSelector((state: any) => state.uoms || {});

  // Form local state
  const [formData, setFormData] = useState({
    wastageDate: new Date().toISOString().split("T")[0],
    productionOrderId: "",
    hourlyProductionId: null as number | null,
    machineId: "",
    shiftId: "",
    productId: "",
    rawMaterialId: "",
    targetWastageProductId: "",
    wastageType: "SCRAP",
    quantity: "",
    uom: "KG",
    estimatedValue: "",
    reason: "",
    correctiveAction: "",
    remarks: "",
    isRecyclable: false,
    sentForRework: false,
    categoryId: "" as string | number,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string | number }[]>([]);

  const formRef = useRef<HTMLFormElement>(null);
  const isDirtyRef = useRef(false);
  const saveConfirmOpenRef = useRef(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const handleSubmitRef = useRef<() => void>(() => {});
  const [isDirty, setIsDirty] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  handleSubmitRef.current = () => { formRef.current?.requestSubmit(); };

  const handleFormKeyDown = useFormKeyboardNav(formRef);

  useFormShortcuts({ onSave: () => handleSubmitRef.current() });

  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-select-portal], [aria-expanded='true'][data-nav]")) return;
      e.preventDefault(); e.stopPropagation();
      if (saveConfirmOpenRef.current) { setSaveConfirmOpen(false); return; }
      if (isDirtyRef.current) { lastFocusedRef.current = document.activeElement as HTMLElement; setSaveConfirmOpen(true); }
      else { navigate("/production-wastages"); }
    };
    window.addEventListener("keydown", handleEscape, { capture: true });
    return () => window.removeEventListener("keydown", handleEscape, { capture: true });
  }, [navigate]);

  useEffect(() => {
    dispatch(fetchProductionOrders());
    dispatch(fetchMachines());
    dispatch(fetchProducts(undefined));
    dispatch(fetchShifts());
    dispatch(fetchRawMaterials(undefined));
    dispatch(fetchActiveUOMs());
    categoryService.fetchAll({ type: "WASTAGE", isActive: true }).then((res) => {
      const list = res?.categories ?? res ?? [];
      setCategoryOptions([
        { label: "Select Category", value: "" },
        ...list.map((c: any) => ({ label: c.name, value: c.id })),
      ]);
    }).catch(() => {});
  }, [dispatch]);

  // Load existing log details if in edit mode
  useEffect(() => {
    if (isEdit && location.state) {
      const state = location.state;
      setFormData({
        wastageDate: new Date(state.wastageDate).toISOString().split("T")[0],
        productionOrderId: state.productionOrderId || "",
        hourlyProductionId: state.hourlyProductionId ? Number(state.hourlyProductionId) : null,
        machineId: state.machineId || "",
        shiftId: state.shiftId || "",
        productId: String(state.productId || ""),
        rawMaterialId: state.rawMaterialId || "",
        targetWastageProductId: state.targetWastageProductId || "",
        wastageType: state.wastageType || "SCRAP",
        quantity: String(state.quantity || ""),
        uom: state.uom || "PCS",
        estimatedValue: state.estimatedValue ? String(state.estimatedValue) : "",
        reason: state.reason || "",
        correctiveAction: state.correctiveAction || "",
        remarks: state.remarks || "",
        isRecyclable: Boolean(state.isRecyclable),
        sentForRework: Boolean(state.sentForRework),
        categoryId: state.categoryId ?? "",
      });
    }
  }, [isEdit, location.state]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // Auto-populate shift, machine, and product when production order is selected
  useEffect(() => {
    if (formData.productionOrderId && !isEdit) {
      const selectedPO: any = productionOrders.find(
        (po: any) => po.productionOrderId === formData.productionOrderId
      );
      if (selectedPO) {
        setFormData((prev) => ({
          ...prev,
          productId: String(selectedPO.productItemId),
          uom: "KG",
          machineId: selectedPO.machineMachineId || selectedPO.machineId || prev.machineId,
          shiftId: selectedPO.shiftId ? String(selectedPO.shiftId) : prev.shiftId,
        }));
      }
    }
  }, [formData.productionOrderId, productionOrders, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    const result = wastageSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const payload = {
      ...formData,
      productId: Number(formData.productId),
      quantity: Number(formData.quantity),
      estimatedValue: formData.estimatedValue ? Number(formData.estimatedValue) : null,
      rawMaterialId: formData.rawMaterialId || null,
      reason: formData.reason || null,
      correctiveAction: formData.correctiveAction || null,
      remarks: formData.remarks || null,
      categoryId: formData.categoryId ? Number(formData.categoryId) : null,
      status: "APPROVED",
    };

    setLoading(true);
    try {
      if (isEdit) {
        await dispatch(
          updateProductionWastage({ id: id!, data: payload })
        ).unwrap();
        toast.success("Production wastage log updated successfully");
      } else {
        await dispatch(createProductionWastage(payload)).unwrap();
        toast.success("Production wastage log logged successfully");
      }
      navigate("/production-wastages");
    } catch (err: any) {
      toast.error(err || "Failed to save wastage record");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="min-h-screen bg-white p-4 md:p-6">
      <div className=" mx-auto">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {isEdit ? "Edit Wastage Audit Log" : "Log Production Wastage"}
            </h2>
            <div className="text-sm text-slate-500 mt-1">
              {isEdit ? "Update details for the selected wastage record" : "Record new production wastage"}
            </div>
          </div>
          <div className="mt-4 md:mt-0 flex gap-2">
            <div>
                        <BackButton text="Back to List" to="/production-wastages" />
                    </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white overflow-hidden">
          <form ref={formRef} onSubmit={handleSubmit} onInput={() => setIsDirty(true)} onKeyDown={handleFormKeyDown} noValidate>
            
            {/* Section 1: Wastage Details */}
            <div className=" border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4">1. Wastage Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <TextInput
                    label="Wastage Logging Date"
                    name="wastageDate"
                    type="date"
                    value={formData.wastageDate}
                    onChange={handleChange}
                    required
                  />
                  {errors.wastageDate && <span className="text-red-500 text-xs mt-1 block">{errors.wastageDate}</span>}
                </div>
                <div>
                  <SelectInput
                    label="Production Order Reference"
                    name="productionOrderId"
                    value={formData.productionOrderId}
                    options={[
                      { label: "Select Production Order", value: "" },
                      ...productionOrders.map((po) => ({
                        label: `${po.productionOrderId} - ${po.productItem?.productName || "Product"}`,
                        value: po.productionOrderId ? String(po.productionOrderId) : "",
                      })),
                    ]}
                    onChange={handleChange}
                    required
                    disabled={isEdit}
                  />
                  {errors.productionOrderId && <span className="text-red-500 text-xs mt-1 block">{errors.productionOrderId}</span>}
                </div>
                <div>
                  <SelectInput
                    label="Wastage Type Classification"
                    name="wastageType"
                    value={formData.wastageType}
                    options={WASTAGE_TYPES}
                    onChange={handleChange}
                    required
                  />
                  {errors.wastageType && <span className="text-red-500 text-xs mt-1 block">{errors.wastageType}</span>}
                </div>
                <div>
                  <SelectInput
                    label="Wastage Category"
                    name="categoryId"
                    value={formData.categoryId}
                    options={categoryOptions}
                    onChange={handleChange}
                    searchable
                  />
                </div>
                <div>
                  <SelectInput
                    label="Machine Location"
                    name="machineId"
                    value={formData.machineId}
                    options={[
                      { label: "Select Machine", value: "" },
                      ...machines.map((m) => ({
                        label: m.machineName,
                        value: m.machineId,
                      })),
                    ]}
                    onChange={handleChange}
                    required
                  />
                  {errors.machineId && <span className="text-red-500 text-xs mt-1 block">{errors.machineId}</span>}
                </div>
                <div>
                  <SelectInput
                    label="Shift Classification"
                    name="shiftId"
                    value={formData.shiftId}
                    options={[
                      { label: "Select Shift", value: "" },
                      ...shifts.map((s) => ({
                        label: s.shiftName,
                        value: s.shiftCode,
                      })),
                    ]}
                    onChange={handleChange}
                    required
                  />
                  {errors.shiftId && <span className="text-red-500 text-xs mt-1 block">{errors.shiftId}</span>}
                </div>
                <div>
                  <SelectInput
                    label="Product Item"
                    name="productId"
                    value={formData.productId}
                    options={[
                      { label: "Select Product", value: "" },
                      ...products.map((p: any) => ({
                        label: p.productName,
                        value: String(p.id),
                      })),
                    ]}
                    onChange={handleChange}
                    required
                    disabled={isEdit}
                  />
                  {errors.productId && <span className="text-red-500 text-xs mt-1 block">{errors.productId}</span>}
                </div>
                <div>
                  <SelectInput
                    label="Raw Material Component (Optional)"
                    name="rawMaterialId"
                    value={formData.rawMaterialId}
                    options={[
                      { label: "Select Raw Material if wasted", value: "" },
                      ...rawMaterials.filter(rm => rm.itemType !== "WASTAGE").map((rm) => ({
                        label: rm.materialName,
                        value: rm.rawMaterialId,
                      })),
                    ]}
                    onChange={handleChange}
                  />
                  {errors.rawMaterialId && <span className="text-red-500 text-xs mt-1 block">{errors.rawMaterialId}</span>}
                </div>
                <div>
                  <SelectInput
                    label="Target Wastage Product (Optional)"
                    name="targetWastageProductId"
                    value={formData.targetWastageProductId}
                    options={[
                      { label: "Select Wastage Product to credit", value: "" },
                      ...rawMaterials.filter(rm => rm.itemType === "WASTAGE").map((rm) => ({
                        label: rm.materialName,
                        value: rm.rawMaterialId,
                      })),
                    ]}
                    onChange={handleChange}
                  />
                  {errors.targetWastageProductId && <span className="text-red-500 text-xs mt-1 block">{errors.targetWastageProductId}</span>}
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <TextInput
                      label="Wastage Quantity"
                      name="quantity"
                      type="number"
                      step="0.001"
                      value={formData.quantity}
                      onChange={handleChange}
                      placeholder="e.g. 50"
                      required
                    />
                    {errors.quantity && <span className="text-red-500 text-xs mt-1 block">{errors.quantity}</span>}
                  </div>
                  <div className="w-1/3">
                    <SelectInput
                      label="UOM"
                      name="uom"
                      value={formData.uom}
                      options={[
                        { label: "Select UOM", value: "" },
                        ...activeUOMs.map((uom: any) => ({
                          label: uom.uomCode,
                          value: uom.uomCode,
                        })),
                      ]}
                      onChange={handleChange}
                      required
                    />
                    {errors.uom && <span className="text-red-500 text-xs mt-1 block">{errors.uom}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Explanation & Auditing Notes */}
            <div className="p-6 border-b border-slate-100 bg-white/50">
              <h3 className="text-lg font-bold text-slate-800 mb-4">2. Explanation & Auditing Notes</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason for Wastage</label>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                    rows={3}
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    placeholder="Provide specific details about the breakdown, raw material defect, setup scrap, etc."
                  />
                  {errors.reason && <span className="text-red-500 text-xs mt-1 block">{errors.reason}</span>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Corrective Action Taken</label>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                    rows={3}
                    name="correctiveAction"
                    value={formData.correctiveAction}
                    onChange={handleChange}
                    placeholder="Enter immediate corrective action taken to prevent recurrence..."
                  />
                  {errors.correctiveAction && <span className="text-red-500 text-xs mt-1 block">{errors.correctiveAction}</span>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remarks / General Audit Notes</label>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                    rows={3}
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    placeholder="General auditing notes..."
                  />
                  {errors.remarks && <span className="text-red-500 text-xs mt-1 block">{errors.remarks}</span>}
                </div>
              </div>
            </div>

            {/* Section 3: Action & Rework Audits */}
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">3. Action & Rework Audits</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isRecyclable"
                    checked={formData.isRecyclable}
                    onChange={handleCheckboxChange}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-700">This scrap is recyclable</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="sentForRework"
                    checked={formData.sentForRework}
                    onChange={handleCheckboxChange}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-700">This scrap has been sent for rework</span>
                </label>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-slate-200 flex justify-end gap-3 rounded-b-2xl">
              <CustomButton
                type="button"
                text="Cancel"
                variant="secondary"
                onClick={() => navigate("/production-wastages")}
                disabled={loading}
              />
              <CustomButton
                type="submit"
                text={loading ? "Saving..." : isEdit ? "Update Log" : "Submit Log"}
                icon={FaSave}
                disabled={loading}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
    <CommonConfirmModal
      show={saveConfirmOpen}
      onHide={() => { setSaveConfirmOpen(false); setTimeout(() => lastFocusedRef.current?.focus(), 50); }}
      onConfirm={() => { setSaveConfirmOpen(false); setTimeout(() => handleSubmitRef.current(), 150); }}
      title="Unsaved Changes"
      message="You have unsaved changes. Do you want to save before leaving?"
      confirmText="Save"
      cancelText="Discard"
      confirmVariant="primary"
      confirmIcon={FaCheck}
      onCancel={() => { setSaveConfirmOpen(false); setIsDirty(false); navigate("/production-wastages"); }}
    />
    </>
  );
};

export default WastageForm;
