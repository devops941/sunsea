import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaSave, FaArrowLeft, FaPlus } from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import {
  createGoodsDispatch,
  fetchEligibleOrders,
} from "../../../features/goods-dispatch/goodsDispatchSlice";
import { fetchStores } from "../../../features/stores/storeSlice";

import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DataTable from "../../../components/ui/table/DataTable";
import type { DataTableColumn } from "../../../components/ui/table/DataTable";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import IndiaPhoneInput, { validatePhoneNumber } from "../../../components/ui/PhoneInput/PhoneInput";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import TimePickerInput from "../../../components/form/TimePickerInput/TimePickerInput";

import { usePermission } from "../../../hooks/usePermission";

const formatUOM = (code: string | null | undefined) => {
  if (!code) return "pcs";
  const lower = code.toLowerCase().trim();
  return lower === "ea" || lower === "each" ? "pcs" : code;
};

const GoodsDispatchCreate: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { can } = usePermission();

  const { eligibleOrders, loading } = useAppSelector((state) => state.goodsDispatch);
  const { data: stores = [] } = useAppSelector((state) => state.stores);

  const [searchPo] = useState<string>("");
  const [selectedPOs, setSelectedPOs] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    dispatchDate: new Date().toISOString().split("T")[0],
    vehicleNumber: "",
    driverName: "",
    driverMobile: "",
    transportName: "",
    loadingTime: "",
    remarks: "",
    destinationStoreId: "",
  });

  const [formErrors, setFormErrors] = useState({
    vehicleNumber: "",
    driverName: "",
    driverMobile: "",
    destinationStoreId: "",
  });

  useEffect(() => {
    dispatch(fetchEligibleOrders({}));
    dispatch(fetchStores({ storeCategory: "FINISHED_GOODS", limit: 100 }));
  }, [dispatch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

    setSelectedPOs((prev) => [...prev, { ...po, dispatchQty: po.pendingDispatchQty, remarks: "" }]);
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

  const handleRemarksChange = (productionOrderId: string, val: string) => {
    setSelectedPOs((prev) =>
      prev.map((p) => (p.productionOrderId === productionOrderId ? { ...p, remarks: val } : p))
    );
  };

  const validateForm = () => {
    const errors = {
      vehicleNumber: "",
      driverName: "",
      driverMobile: "",
      destinationStoreId: "",
    };
    let isValid = true;

    if (!formData.vehicleNumber.trim()) {
      errors.vehicleNumber = "Vehicle number is required";
      isValid = false;
    }
    if (!formData.driverName.trim()) {
      errors.driverName = "Driver name is required";
      isValid = false;
    }
    if (formData.driverMobile) {
      const mobileErr = validatePhoneNumber(formData.driverMobile, false);
      if (mobileErr) {
        errors.driverMobile = mobileErr;
        isValid = false;
      }
    }
    if (!formData.destinationStoreId) {
      errors.destinationStoreId = "Destination store is required";
      isValid = false;
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
      const payload = {
        ...formData,
        items: selectedPOs.map((po) => ({
          productionOrderId: po.productionOrderId,
          productItemId: po.productItem.id,
          dispatchQty: Number(po.dispatchQty),
          uom: po.uom,
          remarks: po.remarks,
        })),
      };

      await dispatch(createGoodsDispatch(payload)).unwrap();
      toast.success("Goods Dispatch created successfully");
      navigate("/production/goods-dispatch");
    } catch (error: any) {
      toast.error(error || "Failed to create goods dispatch");
    }
  };

  const combinedColumns: DataTableColumn<any>[] = [
    {
      header: "PO Number",
      width: "110px",
      accessor: "productionOrderId",
      render: (item: any) => <span className="font-bold text-ink text-sm">{item.productionOrderId}</span>,
    },
    {
      header: "Product",
      width: "minmax(130px, 1fr)",
      accessor: "productItem",
      render: (item: any) => (
        <div>
          <div className="font-medium text-ink text-sm">{item.productItem?.productName}</div>
          {item.productItem?.productCode && (
            <div className="text-xs text-ink-subtle font-mono">{item.productItem?.productCode}</div>
          )}
        </div>
      ),
    },
    {
      header: "Pending",
      width: "100px",
      accessor: "pendingDispatchQty",
      render: (item: any) => <span className="font-bold text-[#5D87FF] text-sm">{item.pendingDispatchQty} {formatUOM(item.uom)}</span>,
    },
    {
      header: "Dispatch Qty",
      width: "160px",
      render: (item: any) => {
        const selected = selectedPOs.find((p) => p.productionOrderId === item.productionOrderId);
        if (!selected) return <span className="text-ink-subtle text-xs">—</span>;
        return (
          <div className="flex items-center gap-1.5">
            <input
              type="number" min="0.1" step="any" max={item.pendingDispatchQty}
              value={selected.dispatchQty}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleQtyChange(item.productionOrderId, e.target.value, item.pendingDispatchQty)}
              className="w-20 px-2 py-1 border border-line-soft rounded-md text-sm font-medium bg-card-2 text-ink focus:ring-1 focus:ring-primary outline-none"
            />
            <span className="text-xs text-ink-subtle">{formatUOM(item.uom)}</span>
          </div>
        );
      },
    },
    {
      header: "Remarks",
      width: "140px",
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

  const filteredEligibleOrders = eligibleOrders.filter((o) => {
    return (
      o.productionOrderId?.toLowerCase().includes(searchPo.toLowerCase()) ||
      o.productItem?.productName?.toLowerCase().includes(searchPo.toLowerCase())
    );
  });

  const totalDispatchQty = selectedPOs.reduce(
    (sum, po) => sum + (Number(po.dispatchQty) || 0),
    0
  );

  return (
    <div>
      <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div>
            <h2 className="text-base font-bold text-ink">Create Goods Dispatch</h2>
            <p className="text-xs text-ink-subtle mt-0.5">Select completed production orders to dispatch to the warehouse</p>
          </div>
        </div>

        {/* Step 1 & 2 Combined */}
        <div className="px-5 py-3 border-b border-line">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">Select Production Orders</p>
            {selectedPOs.length > 0 && (
              <div className="flex items-center gap-3 text-xs font-semibold text-ink-muted">
                <span>{selectedPOs.length} Selected</span>
                <span>Total: {totalDispatchQty} Units</span>
              </div>
            )}
          </div>
          <DataTable
            columns={combinedColumns}
            data={filteredEligibleOrders}
            loading={loading}
            rowKey={(item) => item.productionOrderId}
            emptyMessage="No eligible production orders available for dispatch."
            minHeightClassName=""
            rowClassName={(item: any) =>
              selectedPOs.some((p) => p.productionOrderId === item.productionOrderId)
                ? "bg-emerald-500/5 border-l-2 border-emerald-500"
                : ""
            }
          />
        </div>

        {/* Vehicle & Transport Details */}
        <div className="px-5 py-5 border-b border-line">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <DatePickerCalendar label="Dispatch Date" name="dispatchDate" value={formData.dispatchDate} onChange={(e) => handleInputChange(e as any)} required horizontal />
            <SelectInput label="Destination Store" name="destinationStoreId" value={formData.destinationStoreId} onChange={handleInputChange} required error={formErrors.destinationStoreId}
              options={[{ value: "", label: "Select Store" }, ...stores.map((s) => ({ value: s.storeId, label: s.storeName }))]} horizontal />
            <TextInput label="Vehicle Number" name="vehicleNumber" value={formData.vehicleNumber} onChange={handleInputChange} placeholder="e.g. TN-XX-XXXX" required error={formErrors.vehicleNumber} horizontal />
            <TextInput label="Driver Name" name="driverName" value={formData.driverName} onChange={handleInputChange} placeholder="Driver Name" required error={formErrors.driverName} horizontal />
            <IndiaPhoneInput label="Driver Mobile" name="driverMobile" value={formData.driverMobile} onChange={(e: any) => handleInputChange(e)} required={false} error={formErrors.driverMobile} horizontal />
            <TextInput label="Transport Name" name="transportName" value={formData.transportName} onChange={handleInputChange} placeholder="e.g. VRL Logistics" horizontal />
            <TimePickerInput label="Loading Time" name="loadingTime" value={formData.loadingTime} onChange={(val) => setFormData((prev) => ({ ...prev, loadingTime: val }))} horizontal />
            <div className="md:col-span-2">
              <TextInput label="Remarks" name="remarks" value={formData.remarks} onChange={handleInputChange} placeholder="Enter dispatch remarks..." horizontal as="textarea" rows={2} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 px-5 py-3">
          <CustomButton text="Cancel" icon={FaArrowLeft} onClick={() => navigate("/production/goods-dispatch")} disabled={loading} variant="secondary" />
          {can("goods-dispatch.create") && (
            <CustomButton text={loading ? "Creating..." : "Create Dispatch"} icon={FaSave} onClick={handleSubmit} disabled={loading} />
          )}
        </div>
      </div>
    </div>
  );
};

export default GoodsDispatchCreate;



