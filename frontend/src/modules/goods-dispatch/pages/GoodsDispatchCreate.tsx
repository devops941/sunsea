import React, { useState, useEffect, useRef, useMemo } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FaSave, FaArrowLeft, FaPlus } from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import {
  createGoodsDispatch,
  updateGoodsDispatch,
  fetchEligibleOrders,
} from "../../../features/goods-dispatch/goodsDispatchSlice";
import { goodsDispatchService } from "../../../services/goodsDispatchService";
import { fetchStores } from "../../../features/stores/storeSlice";

import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DataTable from "../../../components/ui/table/DataTable";
import type { DataTableColumn } from "../../../components/ui/table/DataTable";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import IndiaPhoneInput, { validatePhoneNumber } from "../../../components/ui/PhoneInput/PhoneInput";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import TimePickerInput from "../../../components/form/TimePickerInput/TimePickerInput";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";

import { usePermission } from "../../../hooks/usePermission";

const formatUOM = (code: string | null | undefined) => {
  if (!code) return "pcs";
  const lower = code.toLowerCase().trim();
  return lower === "ea" || lower === "each" || lower === "pieces" || lower === "piece" ? "pcs" : code;
};

const DISPATCH_ELIGIBLE_STATUSES = ["IN_PROGRESS", "IN_PRODUCTION", "READY_FOR_DISPATCH", "COMPLETED", "PARTIAL_COMPLETED", "COMPLETED_WITH_SHORTFALL", "CLOSED"];

const GoodsDispatchCreate: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const dispatch = useAppDispatch();
  const { can } = usePermission();

  const { eligibleOrders, loading } = useAppSelector((state) => state.goodsDispatch);
  const { data: stores = [] } = useAppSelector((state) => state.stores);

  const [selectedPOs, setSelectedPOs] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    dispatchDate: new Date().toISOString().split("T")[0],
    vehicleNumber: "",
    driverName: "",
    driverMobile: "",
    dcNumber: "",
    loadingTime: "",
    remarks: "",
    destinationStoreId: "",
  });

  const [formErrors, setFormErrors] = useState({
    dcNumber: "",
    driverMobile: "",
    destinationStoreId: "",
  });

  const [isDirty, setIsDirty] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  const isDirtyRef = useRef(false);
  const saveConfirmOpenRef = useRef(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

  // Ref to remember blocker's proceed()/reset() from the current block-attempt
  // so the existing discard modal can drive them from its buttons.
  const proceedRef = useRef<(() => void) | null>(null);
  const resetRef = useRef<(() => void) | null>(null);
  useDirtyNavGuard(isDirty, (proceed, reset) => {
    proceedRef.current = proceed;
    resetRef.current = reset;
    setSaveConfirmOpen(true);
  });

  useFormShortcuts({ onSave: () => { if (!loading) handleSubmit(); } });

  const handleFormKeyDown = useFormKeyboardNav(formRef);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (saveConfirmOpenRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      if (isDirtyRef.current) {
        lastFocusedRef.current = document.activeElement as HTMLElement;
        setSaveConfirmOpen(true);
      } else {
        navigate("/production/goods-dispatch");
      }
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [navigate]);

  useEffect(() => {
    dispatch(fetchEligibleOrders({}));
    dispatch(fetchStores({ storeCategory: "FINISHED_GOODS", limit: 100 }));
  }, [dispatch]);

  useEffect(() => {
    if (isEditMode && id) {
      goodsDispatchService
        .fetchById(id)
        .then((dispatchData) => {
          if (dispatchData) {
            setFormData({
              dispatchDate: dispatchData.dispatchDate
                ? dispatchData.dispatchDate.split("T")[0]
                : new Date().toISOString().split("T")[0],
              vehicleNumber: dispatchData.vehicleNumber || "",
              driverName: dispatchData.driverName || "",
              driverMobile: dispatchData.driverMobile || "",
              dcNumber: dispatchData.dcNumber || "",
              loadingTime: dispatchData.loadingTime || "",
              remarks: dispatchData.remarks || "",
              destinationStoreId: dispatchData.destinationStoreId || "",
            });
            if (dispatchData.items && dispatchData.items.length > 0) {
              setSelectedPOs(
                dispatchData.items.map((item: any) => ({
                  productionOrderId: item.productionOrderId,
                  dispatchQty: item.dispatchQty,
                  uom: item.uom,
                  remarks: item.remarks || "",
                  productItem: item.product || item.productionOrder?.productItem || { id: item.productItemId, productName: "Product" },
                  pendingDispatchQty: item.dispatchQty,
                }))
              );
            }
          }
        })
        .catch(() => {
          toast.error("Failed to load dispatch data for editing");
        });
    }
  }, [id, isEditMode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof typeof formErrors]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
    setIsDirty(true);
  };

  const handleSelectPO = (po: any) => {
    const poStoreId = po.destinationStoreId;

    if (selectedPOs.some((p) => p.productionOrderId === po.productionOrderId)) {
      toast.warning("This production order is already added");
      return;
    }

    if (poStoreId) {
      if (selectedPOs.length === 0 || !formData.destinationStoreId) {
        const matchedStore = stores.find((s: any) => s.storeId === poStoreId);
        const storeLabel = matchedStore ? matchedStore.storeName : poStoreId;
        
        setFormData((prev) => ({ ...prev, destinationStoreId: poStoreId }));
        setFormErrors((prev) => ({ ...prev, destinationStoreId: "" }));
        toast.info(`Destination store auto-set to "${storeLabel}".`);
      } else if (poStoreId !== formData.destinationStoreId) {
        toast.error(`Production Order ${po.productionOrderId} belongs to store "${poStoreId}", which doesn't match current destination store.`);
        return;
      }
    }

    setSelectedPOs((prev) => [...prev, { ...po, dispatchQty: Math.floor(Number(po.pendingDispatchQty)), remarks: "", bypassGate: false }]);
    setIsDirty(true);
  };

  const handleRemovePO = (productionOrderId: string) => {
    setSelectedPOs((prev) => {
      const nextPOs = prev.filter((p) => p.productionOrderId !== productionOrderId);
      if (nextPOs.length === 0) {
        setFormData(f => ({ ...f, destinationStoreId: "" }));
      }
      return nextPOs;
    });
  };

  const handleQtyChange = (productionOrderId: string, val: string, maxQty: number) => {
    const num = Number(val);
    if (num > maxQty) {
      toast.warning(`Dispatch quantity cannot exceed pending quantity of ${maxQty}`);
      return;
    }
    setSelectedPOs((prev) =>
      prev.map((p) => (p.productionOrderId === productionOrderId ? { ...p, dispatchQty: val } : p))
    );
  };

  const handleBypassChange = (productionOrderId: string, checked: boolean) => {
    setSelectedPOs((prev) =>
      prev.map((p) => (p.productionOrderId === productionOrderId ? { ...p, bypassGate: checked } : p))
    );
  };

  const handleRemarksChange = (productionOrderId: string, val: string) => {
    setSelectedPOs((prev) =>
      prev.map((p) => (p.productionOrderId === productionOrderId ? { ...p, remarks: val } : p))
    );
  };

  const validateForm = () => {
    const errors = {
      dcNumber: "",
      driverMobile: "",
      destinationStoreId: "",
    };
    let isValid = true;

    if (!formData.dcNumber.trim()) {
      errors.dcNumber = "DC Number is required";
      isValid = false;
    }
    if (!formData.destinationStoreId) {
      errors.destinationStoreId = "Destination store is required";
      isValid = false;
    }
    if (formData.driverMobile) {
      const mobileErr = validatePhoneNumber(formData.driverMobile, false);
      if (mobileErr) {
        errors.driverMobile = mobileErr;
        isValid = false;
      }
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fix form errors before submitting");
      return;
    }
    if (selectedPOs.length === 0) {
      toast.error("At least one production order must be added to dispatch");
      return;
    }
    const invalidItem = selectedPOs.some((po) => !po.dispatchQty || Number(po.dispatchQty) <= 0);
    if (invalidItem) {
      toast.error("All selected items must have a dispatch quantity greater than 0");
      return;
    }

    const storeMismatch = selectedPOs.find(
      (po) => po.destinationStoreId && po.destinationStoreId !== formData.destinationStoreId
    );
    if (storeMismatch) {
      toast.error(`Production Order ${storeMismatch.productionOrderId} is assigned to store "${storeMismatch.destinationStoreId}", which doesn't match the selected destination store.`);
      return;
    }

    try {
      if (isEditMode && id) {
        await dispatch(
          updateGoodsDispatch({
            id,
            data: {
              dispatchDate: formData.dispatchDate,
              vehicleNumber: formData.vehicleNumber,
              driverName: formData.driverName,
              driverMobile: formData.driverMobile || undefined,
              dcNumber: formData.dcNumber,
              loadingTime: formData.loadingTime || undefined,
              remarks: formData.remarks || undefined,
              destinationStoreId: formData.destinationStoreId || undefined,
            },
          })
        ).unwrap();
        toast.success("Goods Dispatch updated successfully");
        setIsDirty(false);
        navigate("/production/goods-dispatch");
        return;
      }

      const payload = {
        ...formData,
        items: selectedPOs.map((po) => ({
          productionOrderId: po.productionOrderId,
          productItemId: po.productItem.id,
          dispatchQty: Number(po.dispatchQty),
          uom: po.uom,
          bypassGate: po.bypassGate ?? false,
          remarks: po.remarks,
        })),
      };

      await dispatch(createGoodsDispatch(payload)).unwrap();
      toast.success("Goods Dispatch created successfully");
      setFormData({
        dispatchDate: new Date().toISOString().split("T")[0],
        vehicleNumber: "",
        driverName: "",
        driverMobile: "",
        dcNumber: "",
        loadingTime: "",
        remarks: "",
        destinationStoreId: "",
      });
      setSelectedPOs([]);
      setFormErrors({ dcNumber: "", driverMobile: "", destinationStoreId: "" });
      setIsDirty(false);
      dispatch(fetchEligibleOrders({}));
      setTimeout(() => {
        const firstInput = formRef.current?.querySelector<HTMLElement>('input:not([disabled]), [tabindex="0"]');
        firstInput?.focus();
      }, 50);
    } catch (error: any) {
      const errorMsg = typeof error === "string" ? error : error?.message || "Failed to save goods dispatch";
      if (errorMsg.toLowerCase().includes("dc number")) {
        setFormErrors((prev) => ({ ...prev, dcNumber: errorMsg }));
      }
      toast.error(errorMsg);
    }
  };

  const combinedColumns: DataTableColumn<any>[] = [
    {
      header: "Direct",
      width: "70px",
      align: "center",
      headerNode: (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[10px] font-bold uppercase tracking-widest">Add to</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">Stock</span>
        </div>
      ),
      render: (item: any) => {
        const selected = selectedPOs.find((p) => p.productionOrderId === item.productionOrderId);
        if (!selected) return <span className="text-ink-subtle text-xs">—</span>;
        return (
          <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected.bypassGate ?? false}
              onChange={(e) => handleBypassChange(item.productionOrderId, e.target.checked)}
              className="w-4 h-4 accent-primary cursor-pointer"
              title="Check to skip gate entry and add directly to inventory"
            />
          </div>
        );
      },
    },
    {
      header: "PO Number",
      width: "150px",
      accessor: "productionOrderId",
      render: (item: any) => <span className="font-bold text-ink text-sm">{item.productionOrderId}</span>,
    },
    {
      header: "Product",
      width: "minmax(160px, 1fr)",
      accessor: "productItem",
      render: (item: any) => (
        <span className="font-medium text-ink text-sm">{item.productItem?.productName}</span>
      ),
    },
    {
      header: "Available Qty",
      width: "130px",
      accessor: "pendingDispatchQty",
      render: (item: any) => {
        const qty = Math.floor(Number(item.pendingDispatchQty || 0));
        return <span className="font-semibold text-ink text-sm">{qty.toLocaleString("en-IN")} {formatUOM(item.uom)}</span>;
      },
    },
    {
      header: "Dispatch Qty",
      width: "130px",
      render: (item: any) => {
        const selected = selectedPOs.find((p) => p.productionOrderId === item.productionOrderId);
        if (!selected) return <span className="text-ink-subtle text-xs">—</span>;
        return (
          <input
            type="number" min="0.1" step="any" max={item.pendingDispatchQty}
            value={selected.dispatchQty}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => handleQtyChange(item.productionOrderId, e.target.value, item.pendingDispatchQty)}
            className="w-full px-2 py-1 border border-line-soft rounded-md text-sm font-medium bg-card-2 text-ink focus:ring-1 focus:ring-primary outline-none"
          />
        );
      },
    },
    {
      header: "Remarks",
      width: "170px",
      render: (item: any) => {
        const selected = selectedPOs.find((p) => p.productionOrderId === item.productionOrderId);
        if (!selected) return <span className="text-ink-subtle text-xs">—</span>;
        return (
          <input
            type="text" placeholder="Optional"
            value={selected.remarks || ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => handleRemarksChange(item.productionOrderId, e.target.value)}
            className="w-full px-2 py-1 text-xs border border-line-soft rounded-md bg-card-2 text-ink placeholder:text-ink-subtle focus:ring-1 focus:ring-primary outline-none"
          />
        );
      },
    },
    {
      header: "Action",
      width: "90px",
      accessor: "id",
      render: (item: any) => {
        const isSelected = selectedPOs.some((p) => p.productionOrderId === item.productionOrderId);
        return isSelected ? (
          <DeleteButton onClick={() => handleRemovePO(item.productionOrderId)} />
        ) : (
          <CustomButton text="Add" icon={FaPlus} onClick={() => handleSelectPO(item)} className="!py-1 !px-3 text-xs" />
        );
      },
    },
  ];

  const filteredEligibleOrders = useMemo(
    () => eligibleOrders.filter((o) => DISPATCH_ELIGIBLE_STATUSES.includes(o.status)),
    [eligibleOrders]
  );

  return (
    <>
    <div ref={formRef} onKeyDown={handleFormKeyDown} onInput={() => setIsDirty(true)}
      className="w-full bg-card rounded-2xl border border-line shadow-sm overflow-hidden flex flex-col"
      style={{ height: "calc(100vh - 120px)", minHeight: "580px" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
        <div>
          <h2 className="text-base font-bold text-ink">{isEditMode ? "Edit Goods Dispatch" : "Create Goods Dispatch"}</h2>
          <p className="text-xs text-ink-subtle mt-0.5">{isEditMode ? "Update vehicle and dispatch details" : "Select production orders and fill in vehicle details"}</p>
        </div>
        <BackButton to="/production/goods-dispatch" text="Back to List" />
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto flex flex-col">

        {/* SECTION 1 — Production Orders */}
        <div className="border-b border-line shrink-0">
          <div className="flex items-center justify-between px-6 py-2.5 bg-card-2/50 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-ink-subtle uppercase tracking-widest">Production Orders</span>
            </div>
            {filteredEligibleOrders.length > 0 && (
              <span className="text-[10px] font-bold text-primary bg-primary/8 border border-primary/20 px-2.5 py-0.5 rounded-full">
                {filteredEligibleOrders.length} available
              </span>
            )}
          </div>
          <DataTable
            columns={combinedColumns}
            data={filteredEligibleOrders}
            loading={loading}
            rowKey={(item) => item.productionOrderId}
            emptyMessage="No eligible production orders available for dispatch."
            minHeightClassName=""
            density="default"
            rowClassName={() => "hover:bg-card-2/40 transition-colors"}
          />
        </div>

        {/* SECTION 2 — Vehicle & Dispatch Details */}
        <div className="shrink-0">
          <div className="flex items-center gap-2 px-6 py-2.5 bg-card-2/50 border-b border-line">
            <span className="text-[11px] font-extrabold text-ink-subtle uppercase tracking-widest">Vehicle & Dispatch Details</span>
          </div>
          <div className="px-6 py-5">
            {/* Row 1 */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-5">
              <div>
                <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">
                  Dispatch Date <span className="text-red-400">*</span>
                </label>
                <DatePickerCalendar name="dispatchDate" value={formData.dispatchDate} onChange={(e) => handleInputChange(e as any)} required />
              </div>
               <div>
                <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">
                  DC Number <span className="text-red-400">*</span>
                </label>
                <TextInput name="dcNumber" value={formData.dcNumber} onChange={handleInputChange} placeholder="e.g. DC-2026-001" error={formErrors.dcNumber} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">
                  Destination Store <span className="text-red-400">*</span>
                </label>
                <SelectInput
                  name="destinationStoreId" value={formData.destinationStoreId}
                  onChange={handleInputChange} error={formErrors.destinationStoreId}
                  hideLabel
                  options={[{ value: "", label: "Select Store" }, ...stores.map((s) => ({ value: s.storeId, label: s.storeName }))]}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">
                  Vehicle Number
                </label>
                <TextInput name="vehicleNumber" value={formData.vehicleNumber} onChange={handleInputChange} placeholder="e.g. TN-XX-XXXX (Optional)" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">
                  Driver Name
                </label>
                <TextInput name="driverName" value={formData.driverName} onChange={handleInputChange} placeholder="Enter driver name (Optional)" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">Driver Mobile</label>
                <IndiaPhoneInput name="driverMobile" value={formData.driverMobile} onChange={(e: any) => handleInputChange(e)} required={false} error={formErrors.driverMobile} />
              </div>
             
              <div>
                <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">Loading Time</label>
                <TimePickerInput name="loadingTime" value={formData.loadingTime} onChange={(val) => setFormData((prev) => ({ ...prev, loadingTime: val }))} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">Remarks</label>
                <TextInput name="remarks" value={formData.remarks} onChange={handleInputChange} placeholder="Any remarks..." as="textarea" rows={2} />
              </div>
            </div>
          
          </div>
        </div>

      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end items-center px-6 py-5 border-t border-line shrink-0">
        <div className="flex items-center gap-3">
          <CustomButton text="Cancel" icon={FaArrowLeft} onClick={() => navigate("/production/goods-dispatch")} disabled={loading} variant="secondary" />
          {(isEditMode ? can("goods-dispatch.edit") : can("goods-dispatch.create")) && (
            <CustomButton
              text={loading ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update Dispatch" : "Create Dispatch")}
              icon={FaSave}
              onClick={handleSubmit}
              disabled={loading || selectedPOs.length === 0}
            />
          )}
        </div>
      </div>
    </div>
    <CommonConfirmModal
      show={saveConfirmOpen}
      onHide={() => {
        setSaveConfirmOpen(false);
        if (resetRef.current) { const r = resetRef.current; proceedRef.current = null; resetRef.current = null; r(); }
        setTimeout(() => lastFocusedRef.current?.focus(), 50);
      }}
      onConfirm={() => {
        setSaveConfirmOpen(false);
        if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
        navigate(-1);
      }}
      title="Discard Changes?"
      message="You have unsaved changes. Are you sure you want to leave without saving?"
      confirmText="Discard"
      confirmVariant="danger"
      onCancel={() => {
        setSaveConfirmOpen(false);
        if (resetRef.current) { const r = resetRef.current; proceedRef.current = null; resetRef.current = null; r(); }
        setTimeout(() => lastFocusedRef.current?.focus(), 50);
      }}
    />
    </>
  );
};

export default GoodsDispatchCreate;



