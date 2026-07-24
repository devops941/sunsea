import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaSave, FaArrowLeft, FaCheck, FaPlus } from "react-icons/fa";

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
import TimePickerInput from "../../../components/form/TimePickerInput/TimePickerInput";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";

const GoodsDispatchCreate: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { eligibleOrders, loading } = useAppSelector((state) => state.goodsDispatch);
  const { data: stores = [] } = useAppSelector((state) => state.stores);

  const [searchPo, setSearchPo] = useState("");
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
    dispatch(fetchStores({ limit: 100 }));
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

  const eligibleColumns: DataTableColumn<any>[] = [
    {
      header: "PO Number",
      accessor: "productionOrderId",
      render: (item: any) => (
        <span className="font-bold text-gray-900">{item.productionOrderId}</span>
      ),
    },
    {
      header: "Product",
      accessor: "productItem",
      render: (item: any) => (
        <div>
          <div className="font-medium text-gray-800">{item.productItem?.productName}</div>
          {item.productItem?.productCode && (
            <div className="text-xs text-gray-400 font-mono">{item.productItem?.productCode}</div>
          )}
        </div>
      ),
    },

    {
      header: "Produced Qty",
      accessor: "producedQty",
      render: (item: any) => (
        <span className="text-gray-700">
          {item.producedQty} {item.uom?.toLowerCase() === 'each' ? 'pcs' : item.uom}
        </span>
      ),
    },
    {
      header: "Target Store",
      accessor: "destinationStoreId",
      render: (item: any) => {
        const storeObj = stores.find((s: any) => s.storeId === item.destinationStoreId);
        return (
          <span className="text-slate-700 font-medium">
            {storeObj ? storeObj.storeName : (item.destinationStoreId || "Unassigned")}
          </span>
        );
      },
    },
    {
      header: "Pending Dispatch",
      accessor: "pendingDispatchQty",
      render: (item: any) => (
        <span className="font-bold text-[#5D87FF]">
          {item.pendingDispatchQty} {item.uom?.toLowerCase() === 'each' ? 'pcs' : item.uom}
        </span>
      ),
    },
    {
      header: "Action",
      accessor: "id",
      render: (item: any) => {
        const isSelected = selectedPOs.some((p) => p.productionOrderId === item.productionOrderId);
        return isSelected ? (
          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-semibold border border-green-200">
            <FaCheck className="w-3 h-3" /> Added
          </span>
        ) : (
          <CustomButton
            text="Add"
            icon={FaPlus}
            onClick={() => handleSelectPO(item)}
            className="!py-1 !px-3 text-xs"
          />
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
    <div className="w-full mx-auto p-4 md:p-6 min-h-screen space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Page Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Create Goods Dispatch
            </h2>
            <div className="text-sm text-gray-500 mt-1">
              Select completed production orders to dispatch to the warehouse
            </div>
          </div>
          
        </div>

        <div className=" space-y-6">
          {/* Top Section: Eligible Production Orders Table */}
            <div className="p-4 md:p-6">
              <DataTable
                columns={eligibleColumns}
                data={filteredEligibleOrders}
                loading={loading}
                rowKey={(item) => item.productionOrderId}
                emptyMessage="No eligible production orders available for dispatch."
              />
            </div>

          {/* Bottom Section: Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Half: Selected Items to Dispatch */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-800">
                    2. Items to Dispatch
                  </h3>
                  <span className="bg-[#5D87FF]/10 text-[#5D87FF] px-3 py-1 rounded-full text-xs font-semibold">
                    {selectedPOs.length} Selected
                  </span>
                </div>

                <div className="p-4 md:p-6">
                  {selectedPOs.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      <p className="text-gray-500 font-medium">No production orders selected.</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Select orders from the table above using the "Add" button.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-4 text-left">PO No</th>
                            <th className="px-4 py-4 text-left">Product</th>
                            <th className="px-4 py-4 text-center whitespace-nowrap">Pending</th>
                            <th className="px-4 py-4 text-left whitespace-nowrap">Dispatch Qty *</th>
                            <th className="px-4 py-4 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100 text-sm">
                          {selectedPOs.map((po) => (
                            <tr key={po.productionOrderId} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-4 font-semibold text-slate-900 align-top">{po.productionOrderId}</td>
                              <td className="px-4 py-4 text-slate-600 align-top">{po.productItem?.productName}</td>
                              <td className="px-4 py-4 text-center text-slate-600 font-medium align-top">
                                {po.pendingDispatchQty} {po.uom?.toLowerCase() === 'each' ? 'pcs' : po.uom}
                              </td>
                              <td className="px-4 py-3 align-top">
                                <div className="flex flex-col gap-2.5">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="0.1"
                                      step="any"
                                      max={po.pendingDispatchQty}
                                      value={po.dispatchQty}
                                      onChange={(e) =>
                                        handleQtyChange(
                                          po.productionOrderId,
                                          e.target.value,
                                          po.pendingDispatchQty
                                        )
                                      }
                                      className="w-24 px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-[#5D87FF] focus:border-[#5D87FF] outline-none transition-all shadow-sm"
                                    />
                                    <span className="text-sm font-medium text-slate-500">{po.uom?.toLowerCase() === 'each' ? 'pcs' : po.uom}</span>
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="Remarks (optional)"
                                    value={po.remarks || ""}
                                    onChange={(e) =>
                                      handleRemarksChange(po.productionOrderId, e.target.value)
                                    }
                                    className="w-[180px] px-3 py-1.5 text-xs border border-slate-300 rounded-md text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-[#5D87FF] focus:border-[#5D87FF] outline-none transition-all shadow-sm"
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center align-top">
                                <div className="flex justify-center">
                                  <DeleteButton
                                    onClick={() => handleRemovePO(po.productionOrderId)}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {selectedPOs.length > 0 && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm font-semibold text-gray-700">
                  <span>Total Selected: {selectedPOs.length} Items</span>
                  <span>Total Dispatch Qty: {totalDispatchQty} Units</span>
                </div>
              )}
            </div>

            {/* Right Half: Vehicle & Transport Details */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800">
                  3. Vehicle & Transport Details
                </h3>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DatePickerCalendar
                    label="Dispatch Date *"
                    name="dispatchDate"
                    value={formData.dispatchDate}
                    onChange={(e) => handleInputChange(e as any)}
                    required
                  />

                  <SelectInput
                    label="Destination Store *"
                    name="destinationStoreId"
                    value={formData.destinationStoreId}
                    onChange={handleInputChange}
                    required={true}
                    error={formErrors.destinationStoreId}
                    options={[
                      { value: "", label: "Select Store" },
                      ...stores.map((s) => ({ value: s.storeId, label: s.storeName })),
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextInput
                    label="Vehicle Number *"
                    name="vehicleNumber"
                    value={formData.vehicleNumber}
                    onChange={handleInputChange}
                    placeholder="e.g. TN-XX-XXXX"
                    required
                    error={formErrors.vehicleNumber}
                  />
                  <TextInput
                    label="Driver Name *"
                    name="driverName"
                    value={formData.driverName}
                    onChange={handleInputChange}
                    placeholder="Driver Name"
                    required
                    error={formErrors.driverName}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <IndiaPhoneInput
                    label="Driver Mobile"
                    name="driverMobile"
                    value={formData.driverMobile}
                    onChange={(e: any) => handleInputChange(e)}
                    required={false}
                    error={formErrors.driverMobile}
                  />
                  <TextInput
                    label="Transport Name"
                    name="transportName"
                    value={formData.transportName}
                    onChange={handleInputChange}
                    placeholder="e.g. VRL Logistics"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TimePickerInput
                    label="Loading Time"
                    name="loadingTime"
                    value={formData.loadingTime}
                    onChange={(val) => setFormData((prev) => ({ ...prev, loadingTime: val }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleInputChange}
                    placeholder="Enter dispatch remarks..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end items-center gap-3 p-6 border-t border-gray-100 bg-white rounded-b-2xl">
          <CustomButton
            text="Cancel"
            icon={FaArrowLeft}
            onClick={() => navigate("/production/goods-dispatch")}
            disabled={loading}
            variant="secondary"
          />
          <CustomButton
            text={loading ? "Creating..." : "Create Dispatch"}
            icon={FaSave}
            onClick={handleSubmit}
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );
};

export default GoodsDispatchCreate;



