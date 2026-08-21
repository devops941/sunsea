import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaCheck, FaTimes } from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import {
  fetchGoodsDispatchById,
  storeReceiveDispatch,
} from "../../../features/goods-dispatch/goodsDispatchSlice";

import BackButton from "../../../components/ui/BackButton/BackButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import TextInput from "../../../components/form/TextInput/TextInput";
import { formatDate, formatDateTime } from "../../../utils/dateUtils";

const InfoField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-extrabold mb-1">{label}</p>
    <div className="text-sm font-bold text-ink">{value || "\u2014"}</div>
  </div>
);

const formatUOM = (code: string | null | undefined) => {
  if (!code) return "PCS";
  const upper = code.toUpperCase();
  return upper === "EA" || upper === "EACH" ? "PCS" : upper;
};

const GoodsDispatchStoreApproval: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentDispatch: dispatchData, loading } = useAppSelector((state) => state.goodsDispatch);

  const [remarks, setRemarks] = useState("");
  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, string>>({});

  useEffect(() => {
    if (id) {
      dispatch(fetchGoodsDispatchById(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (dispatchData?.items && dispatchData.status === "PENDING_STORE_RECEIPT") {
      const initial: Record<number, string> = {};
      dispatchData.items.forEach((item: any) => {
        initial[item.id] = String(item.receivedQty || item.dispatchQty);
      });
      setReceivedQuantities(initial);
    }
  }, [dispatchData]);

  useEffect(() => {
    if (dispatchData && dispatchData.status !== "PENDING_STORE_RECEIPT") {
      toast.info(`This dispatch is already ${dispatchData.status.replace(/_/g, " ").toLowerCase()}. Redirecting...`);
      navigate(`/production/goods-dispatch/view/${id}`, { replace: true });
    }
  }, [dispatchData, id, navigate]);

  if (loading && !dispatchData) {
    return <div className="p-8 text-center text-ink-subtle font-semibold">Loading dispatch details...</div>;
  }

  if (!dispatchData) {
    return <div className="p-8 text-center text-red-400 font-semibold">Goods Dispatch not found.</div>;
  }

  const handleApprove = async () => {
    try {
      const receivedItems = dispatchData.items?.map((item: any) => ({
        itemId: Number(item.id),
        receivedQty: Number(receivedQuantities[item.id] || item.dispatchQty)
      }));

      await dispatch(storeReceiveDispatch({
        id: dispatchData.id,
        data: { action: "APPROVE", remarks, receivedItems }
      })).unwrap();
      toast.success("Store receipt approved successfully. Stock updated.");
      navigate(`/production/goods-dispatch/view/${id}`, { replace: true });
    } catch (err: any) {
      toast.error(err);
    }
  };

  const handleReject = async () => {
    if (!remarks.trim()) {
      toast.error("Remarks are required for rejection");
      return;
    }
    try {
      await dispatch(storeReceiveDispatch({
        id: dispatchData.id,
        data: { action: "REJECT", remarks }
      })).unwrap();
      toast.success("Store receipt rejected");
      navigate(`/production/goods-dispatch/view/${id}`, { replace: true });
    } catch (err: any) {
      toast.error(err);
    }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <div className="w-full mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-ink tracking-tight flex items-center gap-3">
              Store Receipt - {dispatchData.dispatchNumber}
              <StatusBadge status={dispatchData.status} />
            </h2>
            <p className="text-ink-subtle text-sm font-semibold mt-0.5">
              Dispatch Date: {formatDate(dispatchData.dispatchDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <BackButton text="Back" to="/production/goods-dispatch" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="rounded-2xl border border-line-soft shadow-xs bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-card-2 border-b border-line-soft">
                <h3 className="font-extrabold text-ink text-base">Dispatched Items</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-card-2 border-b border-line-soft">
                    <tr>
                      {["PO No", "Product", "Dispatch Qty", "Received Qty"].map((h, i) => (
                        <th key={h} className={`text-[11px] uppercase tracking-wider text-ink-subtle font-extrabold px-4 py-3 ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft bg-card">
                    {dispatchData.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-card-2/60 transition-colors">
                        <td className="px-4 py-3 text-sm text-ink font-bold">
                          {item.productionOrder?.productionOrderId}
                        </td>
                        <td className="px-4 py-3 text-sm text-ink">
                          <div className="font-bold text-ink">{item.product?.productName}</div>
                          <div className="text-xs text-ink-subtle font-mono mt-0.5">{item.product?.productCode}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-ink">
                          {Number(item.dispatchQty)} {formatUOM(item.uom)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24">
                              <TextInput
                                name={`receivedQty-${item.id}`}
                                type="number"
                                min={0}
                                max={Number(item.dispatchQty)}
                                bottom={true}
                                value={receivedQuantities[item.id] ?? ""}
                                onChange={(e: any) => {
                                  let val = Number(e.target.value);
                                  if (val > Number(item.dispatchQty)) {
                                    val = Number(item.dispatchQty);
                                  }
                                  setReceivedQuantities(prev => ({ ...prev, [item.id]: String(val) }));
                                }}
                              />
                            </div>
                            <span className="text-xs text-ink-subtle font-semibold">{formatUOM(item.uom)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-line-soft shadow-xs bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-card-2 border-b border-line-soft">
                <h3 className="font-extrabold text-ink text-base">Vehicle Information</h3>
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

          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-line-soft shadow-xs bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-card-2 border-b border-line-soft">
                <h3 className="font-extrabold text-ink text-base">Store Receipt Action</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                  <p className="text-xs text-primary font-medium leading-relaxed">
                    Approving this will automatically update the Finished Goods Stock in <span className="font-bold">{dispatchData.store?.storeName || "the destination store"}</span>.
                  </p>
                </div>
                <textarea
                  className="w-full px-3.5 py-2.5 border border-line-soft rounded-xl text-sm text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none placeholder:text-ink-subtle bg-card-2"
                  placeholder="Enter receipt or rejection remarks here..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FaCheck className="w-4 h-4" /> Receive Stock
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={loading}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FaTimes className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-line-soft shadow-xs bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-card-2 border-b border-line-soft">
                <h3 className="font-extrabold text-ink text-base">Status History</h3>
              </div>
              <div className="p-5 space-y-6">
                <div className="relative pl-6 border-l-2 border-line-soft">
                  <div className="absolute w-3 h-3 bg-ink-subtle rounded-full -left-[7px] top-1"></div>
                  <p className="text-sm font-bold text-ink">Dispatch Created</p>
                  <p className="text-xs text-ink-subtle font-semibold mt-0.5">{formatDateTime(dispatchData.createdAt)}</p>
                </div>
                {dispatchData.gateApprovedAt && (
                  <div className={`relative pl-6 border-l-2 ${dispatchData.status === 'GATE_REJECTED' ? 'border-red-500/30' : 'border-line-soft'}`}>
                    <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${dispatchData.status === 'GATE_REJECTED' ? 'bg-red-500' : 'bg-primary'}`}></div>
                    <p className="text-sm font-bold text-ink">
                      {dispatchData.status === 'GATE_REJECTED' ? 'Gate Rejected' : 'Gate Approved'}
                    </p>
                    <p className="text-xs text-ink-subtle font-semibold mt-0.5">{formatDateTime(dispatchData.gateApprovedAt)}</p>
                    {dispatchData.gateRemarks && (
                      <p className="text-xs text-ink-subtle mt-1 italic">"{dispatchData.gateRemarks}"</p>
                    )}
                  </div>
                )}
                {dispatchData.storeReceivedAt && (
                  <div className="relative pl-6 border-transparent">
                    <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${dispatchData.status === 'STORE_REJECTED' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                    <p className="text-sm font-bold text-ink">
                      {dispatchData.status === 'STORE_REJECTED' ? 'Store Rejected' : 'Warehouse Received'}
                    </p>
                    <p className="text-xs text-ink-subtle font-semibold mt-0.5">{formatDateTime(dispatchData.storeReceivedAt)}</p>
                    {dispatchData.storeRemarks && (
                      <p className="text-xs text-ink-subtle mt-1 italic">"{dispatchData.storeRemarks}"</p>
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

export default GoodsDispatchStoreApproval;
