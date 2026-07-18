import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaSave, FaArrowLeft, FaCheck, FaTrash, FaPlus } from "react-icons/fa";

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
import { formatDate } from "../../../utils/dateUtils";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import IndiaPhoneInput, { validatePhoneNumber } from "../../../components/ui/PhoneInput/PhoneInput";
import TimePickerInput from "../../../components/form/TimePickerInput/TimePickerInput";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import IconButton from "../../../components/ui/IconButton/IconButton";

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
    if (selectedPOs.some((p) => p.productionOrderId === po.productionOrderId)) {
      toast.warning("This production order is already added");
      return;
    }
    setSelectedPOs((prev) => [...prev, { ...po, dispatchQty: po.pendingDispatchQty, remarks: "" }]);
  };

  const handleRemovePO = (productionOrderId: string) => {
    setSelectedPOs((prev) => prev.filter((p) => p.productionOrderId !== productionOrderId));
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
    { header: "PO No", accessor: "productionOrderId" },
    { header: "Product", accessor: "productItem", render: (item: any) => item.productItem?.productName },
    { header: "Batch", accessor: "batchNo" },
    { header: "Produced Qty", accessor: "producedQty", render: (item: any) => `${item.producedQty} ${item.uom}` },
    {
      header: "Pending Qty", accessor: "pendingDispatchQty", render: (item: any) => (
        <span className="font-bold text-blue-600">{item.pendingDispatchQty} {item.uom}</span>
      )
    },
    {
      header: "Action",
      accessor: "id",
      render: (item: any) => (
        <IconButton
          icon={FaPlus}
          onClick={() => handleSelectPO(item)}
          disabled={selectedPOs.some((p) => p.productionOrderId === item.productionOrderId)}
          variant="primary"
          title="Add to Dispatch"
        />
      ),
    },
  ];

  const filteredEligibleOrders = eligibleOrders.filter((o) => {
    if (selectedPOs.some((p) => p.productionOrderId === o.productionOrderId)) return false;
    return (
      o.productionOrderId.toLowerCase().includes(searchPo.toLowerCase()) ||
      o.productItem?.productName.toLowerCase().includes(searchPo.toLowerCase()) ||
      (o.batchNo && o.batchNo.toLowerCase().includes(searchPo.toLowerCase()))
    );
  });

  return (
    <div className="w-full mx-auto p-4 md:p-6 min-h-screen ">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Page Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Create Goods Dispatch
            </h2>
            <div className="text-sm text-gray-500 mt-1">
              Select completed production orders to dispatch to the warehouse
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BackButton text="Back to List" to="/production/goods-dispatch" />
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form & Selected Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-4">
                1. Vehicle & Transport Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DatePickerCalendar
                  label="Dispatch Date *"
                  name="dispatchDate"
                  value={formData.dispatchDate}
                  onChange={(e) => handleInputChange(e as any)}
                  required
                />
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
                  required
                  error={formErrors.driverName}
                />
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
                />
                <TimePickerInput
                  label="Loading Time"
                  name="loadingTime"
                  value={formData.loadingTime}
                  onChange={(val) => setFormData((prev) => ({ ...prev, loadingTime: val }))}
                />
                <div className="md:col-span-2">
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-800">2. Items to Dispatch</h3>
                <span className="bg-[#5D87FF]/10 text-[#5D87FF] px-3 py-1 rounded-full text-sm font-medium">
                  {selectedPOs.length} Items Selected
                </span>
              </div>

              {selectedPOs.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-gray-500">No production orders selected.</p>
                  <p className="text-sm text-gray-400 mt-1">Select orders from the panel on the right.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/5">PO No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/3">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/6 whitespace-nowrap">Pending</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/5 whitespace-nowrap">Dispatch Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedPOs.map((po) => (
                        <tr key={po.productionOrderId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{po.productionOrderId}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{po.productItem?.productName}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{po.pendingDispatchQty} {po.uom}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <input
                                type="number"
                                min="0.1"
                                step="any"
                                max={po.pendingDispatchQty}
                                value={po.dispatchQty}
                                onChange={(e) => handleQtyChange(po.productionOrderId, e.target.value, po.pendingDispatchQty)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-primary-500 focus:border-primary-500"
                              />
                              <span className="ml-2 text-xs text-gray-500">{po.uom}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <DeleteButton
                              onClick={() => handleRemovePO(po.productionOrderId)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - PO Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full">
            <div className="p-6 h-full flex flex-col">
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-4">
                Eligible Production Orders
              </h3>
              <div className="mb-4">
                <TextInput
                  label=""
                  name="searchPo"
                  value={searchPo}
                  onChange={(e) => setSearchPo(e.target.value)}
                  placeholder="Search PO, Product, Batch..."
                />
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 flex-1">
                <DataTable
                  columns={eligibleColumns}
                  data={filteredEligibleOrders}
                  loading={loading}
                  rowKey={(item) => item.productionOrderId}
                  emptyMessage="No eligible production orders found."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      
      {/* Form Actions */}
      <div className="flex justify-end items-center gap-3 p-6 border-t border-gray-100 bg-white rounded-b-lg">
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
