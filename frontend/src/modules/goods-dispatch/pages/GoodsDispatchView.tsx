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
import TextInput from "../../../components/form/TextInput/TextInput";
import { formatDate, formatDateTime } from "../../../utils/dateUtils";
import { usePermission } from "../../../hooks/usePermission";

const InfoField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-extrabold mb-1">{label}</p>
    <div className="text-sm font-bold text-ink">{value || "—"}</div>
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
  const { can } = usePermission();
  const canEdit = can("production_orders.edit");

  const [remarks, setRemarks] = useState("");
  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, string>>({});

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
    if (id) {
      dispatch(fetchGoodsDispatchById(id));
    }
  }, [dispatch, id]);

  if (loading && !dispatchData) {
    return <div className="p-8 text-center text-ink-subtle font-semibold">Loading dispatch details...</div>;
  }

  if (!dispatchData) {
    return <div className="p-8 text-center text-red-400 font-semibold">Goods Dispatch not found.</div>;
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
      const receivedItems = action === "APPROVE" 
        ? dispatchData.items?.map((item: any) => ({
            itemId: Number(item.id),
            receivedQty: Number(receivedQuantities[item.id] || item.dispatchQty)
          }))
        : undefined;

      await dispatch(storeReceiveDispatch({ 
        id: dispatchData.id, 
        data: { action, remarks, receivedItems } 
      })).unwrap();
      toast.success(`Store receipt ${action.toLowerCase()} processed`);
      setRemarks("");
    } catch (err: any) {
      toast.error(err);
    }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-ink tracking-tight flex items-center gap-3">
              {dispatchData.dispatchNumber}
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
            {/* Items List */}
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
                          {dispatchData.status === "PENDING_STORE_RECEIPT" && canEdit ? (
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
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <div>{item.receivedQty !== null && item.receivedQty !== undefined ? `${Number(item.receivedQty)} ${formatUOM(item.uom)}` : "—"}</div>
                              {item.receivedQty !== null && item.receivedQty !== undefined && Number(item.receivedQty) < Number(item.dispatchQty) && (
                                <span className="inline-flex items-center bg-red-500/15 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold border border-red-500/30">
                                  {Number(item.dispatchQty) - Number(item.receivedQty)} {formatUOM(item.uom)} Missing
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vehicle Info */}
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

          {/* Right Column - Workflow / Approvals */}
          <div className="lg:col-span-1 space-y-6">
            {/* Gate Approval Actions */}
            {dispatchData.status === "PENDING_GATE_APPROVAL" && canEdit && (
              <div className="rounded-2xl border border-line-soft shadow-xs bg-card overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 bg-card-2 border-b border-line-soft">
                  <h3 className="font-extrabold text-ink text-base">Gate Approval</h3>
                </div>
                <div className="p-5 space-y-4">
                  <textarea
                    className="w-full px-3.5 py-2.5 border border-line-soft rounded-xl text-sm text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none placeholder:text-ink-subtle bg-card-2"
                    placeholder="Enter approval or rejection remarks here..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleGateApproval("APPROVE")}
                      disabled={loading}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <FaCheck className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => handleGateApproval("REJECT")}
                      disabled={loading}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <FaTimes className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Store Receipt Actions */}
            {dispatchData.status === "PENDING_STORE_RECEIPT" && canEdit && (
              <div className="rounded-2xl border border-line-soft shadow-xs bg-card overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 bg-card-2 border-b border-line-soft">
                  <h3 className="font-extrabold text-ink text-base">Store Receipt</h3>
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
                      onClick={() => handleStoreReceipt("APPROVE")}
                      disabled={loading}
                      className="flex-1 bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <FaCheck className="w-4 h-4" /> Receive Stock
                    </button>
                    <button
                      onClick={() => handleStoreReceipt("REJECT")}
                      disabled={loading}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <FaTimes className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline / History */}
            <div className="rounded-2xl border border-line-soft shadow-xs bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-card-2 border-b border-line-soft">
                <h3 className="font-extrabold text-ink text-base">Status History</h3>
              </div>
              <div className="p-5">
                {(() => {
                  const steps = [
                    {
                      label: "Dispatch Created",
                      date: dispatchData.createdAt,
                      done: true,
                      rejected: false,
                      remarks: null,
                      color: "bg-primary",
                    },
                    {
                      label: dispatchData.status === "GATE_REJECTED" ? "Gate Rejected" : "Gate Approved",
                      date: dispatchData.gateApprovedAt,
                      done: !!dispatchData.gateApprovedAt,
                      rejected: dispatchData.status === "GATE_REJECTED",
                      remarks: dispatchData.gateRemarks,
                      color: dispatchData.status === "GATE_REJECTED" ? "bg-red-500" : "bg-primary",
                    },
                    {
                      label: dispatchData.status === "STORE_REJECTED" ? "Store Rejected" : "Warehouse Received",
                      date: dispatchData.storeReceivedAt,
                      done: !!dispatchData.storeReceivedAt,
                      rejected: dispatchData.status === "STORE_REJECTED",
                      remarks: dispatchData.storeRemarks,
                      color: dispatchData.status === "STORE_REJECTED" ? "bg-red-500" : "bg-emerald-500",
                    },
                  ];

                  return (
                    <div className="flex flex-col gap-0">
                      {steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          {/* Left: circle + vertical connector */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-extrabold shadow-sm shrink-0
                                ${step.done ? step.color : "bg-card-2 border-2 border-line-soft"}`}
                            >
                              {step.done ? (
                                step.rejected ? (
                                  <FaTimes className="w-3 h-3" />
                                ) : (
                                  <FaCheck className="w-3 h-3" />
                                )
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-line-soft" />
                              )}
                            </div>
                            {/* Vertical connector line */}
                            {idx < steps.length - 1 && (
                              <div
                                className={`w-0.5 flex-1 min-h-[28px] mt-1 ${
                                  steps[idx + 1].done
                                    ? steps[idx + 1].rejected
                                      ? "bg-red-500/40"
                                      : "bg-primary/40"
                                    : "bg-line-soft"
                                }`}
                              />
                            )}
                          </div>

                          {/* Right: label + date + remarks */}
                          <div className={`pb-4 ${idx === steps.length - 1 ? "pb-0" : ""}`}>
                            <p className={`text-[12px] font-extrabold leading-tight ${step.rejected ? "text-red-400" : step.done ? "text-ink" : "text-ink-subtle"}`}>
                              {step.label}
                            </p>
                            {step.date && (
                              <p className="text-[11px] text-ink-subtle font-semibold mt-0.5 leading-tight">
                                {formatDateTime(step.date)}
                              </p>
                            )}
                            {step.remarks && (
                              <p className="text-[11px] text-ink-subtle mt-1 italic leading-tight">"{step.remarks}"</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoodsDispatchView;
