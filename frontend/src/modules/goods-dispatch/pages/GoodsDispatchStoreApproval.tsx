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
    <div>
      <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              Store Receipt — {dispatchData.dispatchNumber}
              <StatusBadge status={dispatchData.status} />
            </h2>
            <p className="text-xs text-ink-subtle mt-0.5">Dispatch Date: {formatDate(dispatchData.dispatchDate)}</p>
          </div>
          <BackButton text="Back" to="/production/goods-dispatch" />
        </div>

        {/* Dispatched Items */}
        <div className="border-b border-line">
          <div className="px-5 py-3 bg-card-2 border-b border-line">
            <h3 className="text-sm font-bold text-ink">Dispatched Items</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-card-2/50 border-b border-line">
              <tr>
                <th className="text-[11px] uppercase tracking-wider text-ink-subtle font-bold px-5 py-2.5 text-left">PO No</th>
                <th className="text-[11px] uppercase tracking-wider text-ink-subtle font-bold px-5 py-2.5 text-left">Product</th>
                <th className="text-[11px] uppercase tracking-wider text-ink-subtle font-bold px-5 py-2.5 text-right">Dispatch Qty</th>
                <th className="text-[11px] uppercase tracking-wider text-ink-subtle font-bold px-5 py-2.5 text-right">Received Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {dispatchData.items?.map((item) => (
                <tr key={item.id} className="hover:bg-card-2/40 transition-colors">
                  <td className="px-5 py-3 font-bold text-ink">{item.productionOrder?.productionOrderId}</td>
                  <td className="px-5 py-3">
                    <div className="font-semibold text-ink">{item.product?.productName}</div>
                    <div className="text-xs text-ink-subtle font-mono">{item.product?.productCode}</div>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-ink">{Number(item.dispatchQty)} {formatUOM(item.uom)}</td>
                  <td className="px-5 py-3 text-right">
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
                            if (val > Number(item.dispatchQty)) val = Number(item.dispatchQty);
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

        {/* Vehicle Information */}
        <div className="border-b border-line">
          <div className="px-5 py-3 bg-card-2 border-b border-line">
            <h3 className="text-sm font-bold text-ink">Vehicle Information</h3>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <InfoField label="Vehicle Number" value={dispatchData.vehicleNumber} />
            <InfoField label="Driver Name" value={dispatchData.driverName} />
            <InfoField label="Driver Mobile" value={dispatchData.driverMobile} />
            <InfoField label="Transport Name" value={dispatchData.transportName} />
            <InfoField label="Loading Time" value={dispatchData.loadingTime} />
            <div className="col-span-2 sm:col-span-3">
              <InfoField label="Remarks" value={dispatchData.remarks} />
            </div>
          </div>
        </div>

        {/* Store Receipt Action */}
        <div className="border-b border-line">
          <div className="px-5 py-3 bg-card-2 border-b border-line">
            <h3 className="text-sm font-bold text-ink">Store Receipt Action</h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <p className="text-xs text-primary font-medium">
                Approving will automatically update Finished Goods Stock in <span className="font-bold">{dispatchData.store?.storeName || "the destination store"}</span>.
              </p>
            </div>
            <textarea
              className="w-full px-3 py-2.5 border border-line-soft rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none placeholder:text-ink-subtle bg-card-2"
              placeholder="Enter receipt or rejection remarks here..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
            />
            <div className="flex gap-3">
              <button onClick={handleApprove} disabled={loading}
                className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
                <FaCheck className="w-3.5 h-3.5" /> Receive Stock
              </button>
              <button onClick={handleReject} disabled={loading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
                <FaTimes className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </div>
        </div>

        {/* Status History */}
        <div className="px-5 py-4 space-y-4">
          <h3 className="text-sm font-bold text-ink">Status History</h3>
          <div className="space-y-3 pl-2">
            <div className="relative pl-5 border-l-2 border-line">
              <div className="absolute w-2.5 h-2.5 bg-ink-subtle rounded-full -left-[7px] top-1"></div>
              <p className="text-sm font-bold text-ink">Dispatch Created</p>
              <p className="text-xs text-ink-subtle mt-0.5">{formatDateTime(dispatchData.createdAt)}</p>
            </div>
            {dispatchData.gateApprovedAt && (
              <div className={`relative pl-5 border-l-2 ${dispatchData.status === 'GATE_REJECTED' ? 'border-red-400/40' : 'border-primary/40'}`}>
                <div className={`absolute w-2.5 h-2.5 rounded-full -left-[7px] top-1 ${dispatchData.status === 'GATE_REJECTED' ? 'bg-red-500' : 'bg-primary'}`}></div>
                <p className="text-sm font-bold text-ink">{dispatchData.status === 'GATE_REJECTED' ? 'Gate Rejected' : 'Gate Approved'}</p>
                <p className="text-xs text-ink-subtle mt-0.5">{formatDateTime(dispatchData.gateApprovedAt)}</p>
                {dispatchData.gateRemarks && <p className="text-xs text-ink-subtle mt-0.5 italic">"{dispatchData.gateRemarks}"</p>}
              </div>
            )}
            {dispatchData.storeReceivedAt && (
              <div className="relative pl-5 border-l-2 border-emerald-400/40">
                <div className={`absolute w-2.5 h-2.5 rounded-full -left-[7px] top-1 ${dispatchData.status === 'STORE_REJECTED' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                <p className="text-sm font-bold text-ink">{dispatchData.status === 'STORE_REJECTED' ? 'Store Rejected' : 'Warehouse Received'}</p>
                <p className="text-xs text-ink-subtle mt-0.5">{formatDateTime(dispatchData.storeReceivedAt)}</p>
                {dispatchData.storeRemarks && <p className="text-xs text-ink-subtle mt-0.5 italic">"{dispatchData.storeRemarks}"</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoodsDispatchStoreApproval;
