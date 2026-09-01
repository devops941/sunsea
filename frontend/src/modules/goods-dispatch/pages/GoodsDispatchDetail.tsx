import React, { useEffect } from "react";
import { useParams } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchGoodsDispatchById } from "../../../features/goods-dispatch/goodsDispatchSlice";

import BackButton from "../../../components/ui/BackButton/BackButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { formatDate, formatDateTime } from "../../../utils/dateUtils";

const InfoField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-ink-subtle font-extrabold mb-1">{label}</p>
    <div className="text-sm font-semibold text-ink">{value || "\u2014"}</div>
  </div>
);

const formatUOM = (code: string | null | undefined) => {
  if (!code) return "PCS";
  const upper = code.toUpperCase();
  return upper === "EA" || upper === "EACH" ? "PCS" : upper;
};

const GoodsDispatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { currentDispatch: dispatchData, loading } = useAppSelector((state) => state.goodsDispatch);

  useEffect(() => {
    if (id) dispatch(fetchGoodsDispatchById(id));
  }, [dispatch, id]);

  if (loading && !dispatchData) {
    return <div className="p-8 text-center text-ink-subtle font-semibold">Loading dispatch details...</div>;
  }

  if (!dispatchData) {
    return <div className="p-8 text-center text-red-400 font-semibold">Goods Dispatch not found.</div>;
  }

  return (
    <div className="w-full bg-card rounded-2xl shadow-sm border border-line" style={{ maxWidth: 1200 }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-line">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-extrabold text-ink tracking-tight">{dispatchData.dispatchNumber}</h2>
          <StatusBadge status={dispatchData.status} />
          <span className="text-sm text-ink-subtle font-medium">
            {formatDate(dispatchData.dispatchDate)}
          </span>
        </div>
        <BackButton text="Back" to="/production/goods-dispatch" />
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — Dispatched Items + Vehicle Info */}
        <div className="lg:col-span-2 space-y-5">

          {/* Dispatched Items */}
          <div className="rounded-xl border border-line-soft overflow-hidden">
            <div className="px-4 py-3 bg-card-2 border-b border-line-soft">
              <h3 className="font-bold text-ink text-sm">Dispatched Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-card-2/60 border-b border-line-soft">
                  <tr>
                    {["PO No", "Product", "Dispatch Qty", "Received Qty"].map((h, i) => (
                      <th
                        key={h}
                        className={`text-[10px] uppercase tracking-wider text-ink-subtle font-extrabold px-4 py-2.5 ${i >= 2 ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {dispatchData.items?.map((item) => (
                    <tr key={item.id} className="hover:bg-card-2/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-ink text-sm">
                        {item.productionOrder?.productionOrderId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink text-sm">{item.product?.productName}</div>
                        <div className="text-xs text-ink-subtle font-mono mt-0.5">{item.product?.productCode}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-ink text-sm">
                        {Number(item.dispatchQty)} {formatUOM(item.uom)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-primary text-sm">
                            {item.receivedQty !== null && item.receivedQty !== undefined
                              ? `${Number(item.receivedQty)} ${formatUOM(item.uom)}`
                              : "\u2014"}
                          </span>
                          {item.receivedQty !== null && item.receivedQty !== undefined &&
                            Number(item.receivedQty) < Number(item.dispatchQty) && (
                              <span className="inline-flex items-center bg-red-500/15 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold border border-red-500/30">
                                {Number(item.dispatchQty) - Number(item.receivedQty)} {formatUOM(item.uom)} Missing
                              </span>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="rounded-xl border border-line-soft overflow-hidden">
            <div className="px-4 py-3 bg-card-2 border-b border-line-soft">
              <h3 className="font-bold text-ink text-sm">Vehicle Information</h3>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
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

        {/* Right — Status History */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-line-soft overflow-hidden">
            <div className="px-4 py-3 bg-card-2 border-b border-line-soft">
              <h3 className="font-bold text-ink text-sm">Status History</h3>
            </div>
            <div className="p-4 space-y-5">
              <div className="relative pl-5 border-l-2 border-line-soft">
                <div className="absolute w-2.5 h-2.5 bg-ink-subtle rounded-full -left-[7px] top-1" />
                <p className="text-sm font-bold text-ink">Dispatch Created</p>
                <p className="text-xs text-ink-subtle mt-0.5">{formatDateTime(dispatchData.createdAt)}</p>
              </div>

              {dispatchData.gateApprovedAt && (
                <div className={`relative pl-5 border-l-2 ${dispatchData.status === "GATE_REJECTED" ? "border-red-500/30" : "border-line-soft"}`}>
                  <div className={`absolute w-2.5 h-2.5 rounded-full -left-[7px] top-1 ${dispatchData.status === "GATE_REJECTED" ? "bg-red-500" : "bg-primary"}`} />
                  <p className="text-sm font-bold text-ink">
                    {dispatchData.status === "GATE_REJECTED" ? "Gate Rejected" : "Gate Approved"}
                  </p>
                  <p className="text-xs text-ink-subtle mt-0.5">{formatDateTime(dispatchData.gateApprovedAt)}</p>
                  {dispatchData.gateRemarks && (
                    <p className="text-xs text-ink-subtle mt-1 italic">"{dispatchData.gateRemarks}"</p>
                  )}
                </div>
              )}

              {dispatchData.storeReceivedAt && (
                <div className="relative pl-5">
                  <div className={`absolute w-2.5 h-2.5 rounded-full -left-[7px] top-1 ${dispatchData.status === "STORE_REJECTED" ? "bg-red-500" : "bg-emerald-500"}`} />
                  <p className="text-sm font-bold text-ink">
                    {dispatchData.status === "STORE_REJECTED" ? "Store Rejected" : "Warehouse Received"}
                  </p>
                  <p className="text-xs text-ink-subtle mt-0.5">{formatDateTime(dispatchData.storeReceivedAt)}</p>
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
  );
};

export default GoodsDispatchDetail;
