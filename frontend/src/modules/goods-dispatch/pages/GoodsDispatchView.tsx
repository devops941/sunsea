import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaArrowLeft, FaCheck, FaTimes, FaTruck } from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import {
  fetchGoodsDispatchById,
  gateApproveDispatch,
  storeReceiveDispatch,
} from "../../../features/goods-dispatch/goodsDispatchSlice";

import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { formatDate, formatDateTime } from "../../../utils/dateUtils";
import { hasPermission } from "../../../utils/permission";

const GoodsDispatchView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentDispatch: dispatchData, loading } = useAppSelector((state) => state.goodsDispatch);
  const { user } = useAppSelector((state) => state.auth);

  const [remarks, setRemarks] = useState("");

  const canEdit = hasPermission("production_orders.edit");

  useEffect(() => {
    if (id) {
      dispatch(fetchGoodsDispatchById(id));
    }
  }, [dispatch, id]);

  if (loading && !dispatchData) {
    return <div className="p-8 text-center text-gray-500">Loading dispatch details...</div>;
  }

  if (!dispatchData) {
    return <div className="p-8 text-center text-red-500">Goods Dispatch not found.</div>;
  }

  const handleGateApproval = async (action: "APPROVE" | "REJECT") => {
    if (action === "REJECT" && !remarks) {
      toast.error("Remarks are required for rejection");
      return;
    }
    try {
      await dispatch(gateApproveDispatch({ id: dispatchData.id, data: { action, remarks } })).unwrap();
      toast.success(`Gate approval ${action.toLowerCase()} processed`);
      setRemarks("");
    } catch (err: any) {
      toast.error(err);
    }
  };

  const handleStoreReceipt = async (action: "APPROVE" | "REJECT") => {
    if (action === "REJECT" && !remarks) {
      toast.error("Remarks are required for rejection");
      return;
    }
    try {
      await dispatch(storeReceiveDispatch({ id: dispatchData.id, data: { action, remarks } })).unwrap();
      toast.success(`Store receipt ${action.toLowerCase()} processed`);
      setRemarks("");
    } catch (err: any) {
      toast.error(err);
    }
  };

  const getStatusVariant = (status: string) => {
    if (status === "PENDING_GATE_APPROVAL") return "warning";
    if (status === "PENDING_STORE_RECEIPT") return "info";
    if (status === "WAREHOUSE_RECEIVED") return "success";
    if (status.includes("REJECTED")) return "danger";
    return "default";
  };



  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/production/goods-dispatch")}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FaArrowLeft />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              {dispatchData.dispatchNumber}
              <StatusBadge status={dispatchData.status} variant={getStatusVariant(dispatchData.status)} />
            </h1>
            <p className="text-gray-500 mt-1">Dispatch Date: {formatDate(dispatchData.dispatchDate)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Items List */}
          <div className="border rounded shadow-sm bg-white p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-100">
              Dispatched Items
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dispatch Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Received Qty</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dispatchData.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {item.productionOrder?.productionOrderId}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {item.product?.productName} <br />
                        <span className="text-xs text-gray-400">{item.product?.productCode}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.productionOrder?.batchNo || "-"}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {Number(item.dispatchQty)} {item.uom}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-blue-600">
                        {item.receivedQty ? `${Number(item.receivedQty)} ${item.uom}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="border rounded shadow-sm bg-white p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-100 flex items-center gap-2">
              <FaTruck className="text-gray-400" /> Vehicle Information
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">Vehicle Number</p>
                <p className="font-medium text-gray-900">{dispatchData.vehicleNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Driver Name</p>
                <p className="font-medium text-gray-900">{dispatchData.driverName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Driver Mobile</p>
                <p className="font-medium text-gray-900">{dispatchData.driverMobile || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Transport Name</p>
                <p className="font-medium text-gray-900">{dispatchData.transportName || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Loading Time</p>
                <p className="font-medium text-gray-900">{dispatchData.loadingTime || "-"}</p>
              </div>
              <div className="col-span-3">
                <p className="text-sm text-gray-500">Remarks</p>
                <p className="font-medium text-gray-900">{dispatchData.remarks || "-"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Workflow / Approvals */}
        <div className="lg:col-span-1 space-y-6">
          {/* Gate Approval Actions */}
          {dispatchData.status === "PENDING_GATE_APPROVAL" && canEdit && (
            <div className="border-warning-200 bg-warning-50 border rounded shadow-sm p-4">
              <h3 className="text-lg font-bold text-warning-800 mb-4">Gate Approval</h3>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded mb-4 text-sm"
                placeholder="Approval/Rejection Remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <CustomButton
                  variant="primary"
                  className="flex-1"
                  icon={FaCheck}
                  text="Approve"
                  onClick={() => handleGateApproval("APPROVE")}
                  disabled={loading}
                />
                <CustomButton
                  variant="danger"
                  className="flex-1"
                  icon={FaTimes}
                  text="Reject"
                  onClick={() => handleGateApproval("REJECT")}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Store Receipt Actions */}
          {dispatchData.status === "PENDING_STORE_RECEIPT" && canEdit && (
            <div className="border-info-200 bg-info-50 border rounded shadow-sm p-4">
              <h3 className="text-lg font-bold text-info-800 mb-4">Store Receipt</h3>
              <p className="text-sm text-info-700 mb-4">
                Approving this will automatically update the Finished Goods Stock in {dispatchData.store?.storeName || "the destination store"}.
              </p>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded mb-4 text-sm"
                placeholder="Receipt Remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <CustomButton
                  variant="primary"
                  className="flex-1"
                  icon={FaCheck}
                  text="Receive Stock"
                  onClick={() => handleStoreReceipt("APPROVE")}
                  disabled={loading}
                />
                <CustomButton
                  variant="danger"
                  className="flex-1"
                  icon={FaTimes}
                  text="Reject"
                  onClick={() => handleStoreReceipt("REJECT")}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Timeline / History */}
          <div className="border rounded shadow-sm bg-white p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Status History</h3>
            <div className="space-y-6">
              <div className="relative pl-6 border-l-2 border-gray-200">
                <div className="absolute w-3 h-3 bg-gray-300 rounded-full -left-[7px] top-1"></div>
                <p className="text-sm font-medium text-gray-900">Dispatch Created</p>
                <p className="text-xs text-gray-500">{formatDateTime(dispatchData.createdAt)}</p>
              </div>
              
              {dispatchData.gateApprovedAt && (
                <div className={`relative pl-6 border-l-2 ${dispatchData.status === 'GATE_REJECTED' ? 'border-red-200' : 'border-gray-200'}`}>
                  <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${dispatchData.status === 'GATE_REJECTED' ? 'bg-red-400' : 'bg-blue-400'}`}></div>
                  <p className="text-sm font-medium text-gray-900">
                    {dispatchData.status === 'GATE_REJECTED' ? 'Gate Rejected' : 'Gate Approved'}
                  </p>
                  <p className="text-xs text-gray-500">{formatDateTime(dispatchData.gateApprovedAt)}</p>
                  {dispatchData.gateRemarks && (
                    <p className="text-xs text-gray-600 mt-1 italic">"{dispatchData.gateRemarks}"</p>
                  )}
                </div>
              )}

              {dispatchData.storeReceivedAt && (
                <div className="relative pl-6 border-transparent">
                  <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${dispatchData.status === 'STORE_REJECTED' ? 'bg-red-400' : 'bg-green-400'}`}></div>
                  <p className="text-sm font-medium text-gray-900">
                    {dispatchData.status === 'STORE_REJECTED' ? 'Store Rejected' : 'Warehouse Received'}
                  </p>
                  <p className="text-xs text-gray-500">{formatDateTime(dispatchData.storeReceivedAt)}</p>
                  {dispatchData.storeRemarks && (
                    <p className="text-xs text-gray-600 mt-1 italic">"{dispatchData.storeRemarks}"</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoodsDispatchView;
