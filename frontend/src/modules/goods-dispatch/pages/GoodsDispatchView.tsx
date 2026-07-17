import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaCheck, FaTimes, FaTruck } from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import {
  fetchGoodsDispatchById,
  gateApproveDispatch,
  storeReceiveDispatch,
} from "../../../features/goods-dispatch/goodsDispatchSlice";

import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { formatDate, formatDateTime } from "../../../utils/dateUtils";
import { hasPermission } from "../../../utils/permission";

const InfoField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">{label}</p>
    <div className="text-sm font-semibold text-slate-700">{value || "—"}</div>
  </div>
);

const formatUOM = (code: string | null | undefined) => {
  if (!code) return "PCS";
  const upper = code.toUpperCase();
  return upper === "EA" || upper === "EACH" ? "PCS" : upper;
};

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





  return (
    <div className="p-4 md:p-6 min-h-screen ">
      <div className="w-full  mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              {dispatchData.dispatchNumber}
              <StatusBadge status={dispatchData.status} />
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Dispatch Date: {formatDate(dispatchData.dispatchDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <BackButton text="Back" to="/production/goods-dispatch" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Items List */}
            <div className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-700 text-base">Dispatched Items</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["PO No", "Product", "Batch", "Dispatch Qty", "Received Qty"].map((h, i) => (
                        <th key={h} className={`text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-4 py-3 ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {dispatchData.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-700 font-medium">
                          {item.productionOrder?.productionOrderId}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          <div className="font-semibold text-slate-700">{item.product?.productName}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{item.product?.productCode}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.productionOrder?.batchNo || "—"}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-700">
                          {Number(item.dispatchQty)} {formatUOM(item.uom)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                          {item.receivedQty ? `${Number(item.receivedQty)} ${formatUOM(item.uom)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
               
                <h3 className="font-bold text-slate-700 text-base">Vehicle Information</h3>
              </div>
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-5">
                <InfoField label="Vehicle Number" value={dispatchData.vehicleNumber} />
                <InfoField label="Driver Name" value={dispatchData.driverName} />
                <InfoField label="Driver Mobile" value={dispatchData.driverMobile} />
                <InfoField label="Transport Name" value={dispatchData.transportName} />
                <InfoField label="Loading Time" value={dispatchData.loadingTime} />
                <div className="col-span-2 md:col-span-3">
                  <InfoField label="Remarks" value={dispatchData.remarks} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Workflow / Approvals */}
          <div className="lg:col-span-1 space-y-6">
            {/* Gate Approval Actions */}
            {dispatchData.status === "PENDING_GATE_APPROVAL" && canEdit && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
                <h3 className="text-lg font-bold text-amber-800 mb-4">Gate Approval</h3>
                <textarea
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl mb-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none placeholder:text-slate-300 bg-white"
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
              <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
                <h3 className="text-lg font-bold text-blue-800 mb-4">Store Receipt</h3>
                <p className="text-sm text-blue-700 mb-4">
                  Approving this will automatically update the Finished Goods Stock in {dispatchData.store?.storeName || "the destination store"}.
                </p>
                <textarea
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl mb-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none placeholder:text-slate-300 bg-white"
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
            <div className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-700 text-base">Status History</h3>
              </div>
              <div className="p-5 space-y-6">
                <div className="relative pl-6 border-l-2 border-slate-200">
                  <div className="absolute w-3 h-3 bg-slate-300 rounded-full -left-[7px] top-1"></div>
                  <p className="text-sm font-semibold text-slate-700">Dispatch Created</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(dispatchData.createdAt)}</p>
                </div>
                
                {dispatchData.gateApprovedAt && (
                  <div className={`relative pl-6 border-l-2 ${dispatchData.status === 'GATE_REJECTED' ? 'border-red-200' : 'border-slate-200'}`}>
                    <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${dispatchData.status === 'GATE_REJECTED' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                    <p className="text-sm font-semibold text-slate-700">
                      {dispatchData.status === 'GATE_REJECTED' ? 'Gate Rejected' : 'Gate Approved'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(dispatchData.gateApprovedAt)}</p>
                    {dispatchData.gateRemarks && (
                      <p className="text-xs text-slate-500 mt-1 italic">"{dispatchData.gateRemarks}"</p>
                    )}
                  </div>
                )}

                {dispatchData.storeReceivedAt && (
                  <div className="relative pl-6 border-transparent">
                    <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${dispatchData.status === 'STORE_REJECTED' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                    <p className="text-sm font-semibold text-slate-700">
                      {dispatchData.status === 'STORE_REJECTED' ? 'Store Rejected' : 'Warehouse Received'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(dispatchData.storeReceivedAt)}</p>
                    {dispatchData.storeRemarks && (
                      <p className="text-xs text-slate-500 mt-1 italic">"{dispatchData.storeRemarks}"</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoodsDispatchView;
