import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaCheck, FaTimes } from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import {
  fetchGoodsDispatchById,
  gateApproveDispatch,
  storeReceiveDispatch,
} from "../../../features/goods-dispatch/goodsDispatchSlice";

import BackButton from "../../../components/ui/BackButton/BackButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import TextInput from "../../../components/form/TextInput/TextInput";
import CustomButton from "../../../components/ui/Button/Button";
import DataTable from "../../../components/ui/table/DataTable";
import type { DataTableColumn } from "../../../components/ui/table/DataTable";
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
  const upper = (code || "").toUpperCase();
  return upper === "EA" || upper === "EACH" ? "PCS" : upper || "PCS";
};

const GoodsDispatchView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { can } = usePermission();

  // Only show approval actions when on the edit or approval route
  const isApprovalMode = location.pathname.includes("/approval/") || location.pathname.includes("/edit/") || location.search.includes("mode=approval");

  const { currentDispatch: dispatchData, loading } = useAppSelector((state) => state.goodsDispatch);

  const [remarks, setRemarks] = useState("");
  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, string>>({});

  useEffect(() => {
    if (id) dispatch(fetchGoodsDispatchById(id));
  }, [dispatch, id]);

  useEffect(() => {
    if (dispatchData?.items && dispatchData.status === "PENDING_STORE_RECEIPT") {
      const initial: Record<number, string> = {};
      dispatchData.items
        .filter((item: any) => !item.bypassGate)
        .forEach((item: any) => {
          initial[item.id] = String(item.receivedQty || item.dispatchQty);
        });
      setReceivedQuantities(initial);
    }
  }, [dispatchData]);

  if (loading && !dispatchData) {
    return <div className="p-8 text-center text-ink-subtle font-semibold">Loading dispatch details...</div>;
  }

  if (!dispatchData) {
    return <div className="p-8 text-center text-red-400 font-semibold">Goods Dispatch not found.</div>;
  }

  const isGate = dispatchData.status === "PENDING_GATE_APPROVAL";
  const isStore = dispatchData.status === "PENDING_STORE_RECEIPT";
  const canAct = isApprovalMode && (isGate || isStore) && can("goods-dispatch.edit");

  // In Approval/Edit mode, exclude direct/bypass items so they don't appear in approval/receive actions.
  // In View mode, show all items (including direct dispatch).
  const itemsToDisplay = isApprovalMode
    ? dispatchData.items?.filter((i: any) => !i.bypassGate) || []
    : dispatchData.items || [];

  const handleApprove = async () => {
    try {
      if (isGate) {
        await dispatch(gateApproveDispatch({ id: dispatchData.id, data: { action: "APPROVE", remarks } })).unwrap();
        toast.success("Gate approved successfully");
      } else {
        const receivedItems = dispatchData.items
          ?.filter((item: any) => !item.bypassGate)
          .map((item: any) => ({
            itemId: Number(item.id),
            receivedQty: Number(receivedQuantities[item.id] ?? item.dispatchQty),
          }));
        await dispatch(storeReceiveDispatch({ id: dispatchData.id, data: { action: "APPROVE", remarks, receivedItems } })).unwrap();
        toast.success("Stock received successfully. Stock updated.");
      }
      dispatch(fetchGoodsDispatchById(dispatchData.id));
      setRemarks("");
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
      if (isGate) {
        await dispatch(gateApproveDispatch({ id: dispatchData.id, data: { action: "REJECT", remarks } })).unwrap();
        toast.success("Gate rejected");
      } else {
        await dispatch(storeReceiveDispatch({ id: dispatchData.id, data: { action: "REJECT", remarks } })).unwrap();
        toast.success("Store receipt rejected");
      }
      dispatch(fetchGoodsDispatchById(dispatchData.id));
      setRemarks("");
    } catch (err: any) {
      toast.error(err);
    }
  };

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

  const itemColumns: DataTableColumn<any>[] = [
    {
      header: "PO No",
      width: "150px",
      render: (item: any) => (
        <div className="font-bold text-ink">
          <div>{item.productionOrder?.productionOrderId}</div>
          {item.bypassGate && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              ✓ Direct
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Product",
      width: "minmax(180px, 1fr)",
      render: (item: any) => (
        <div>
          <div className="font-bold text-ink">{item.product?.productName}</div>
          <div className="text-xs text-ink-subtle font-mono mt-0.5">{item.product?.productCode}</div>
        </div>
      ),
    },
    {
      header: "Dispatch Qty",
      width: "140px",
      align: "right",
      render: (item: any) => (
        <span className="font-bold text-ink">
          {Number(item.dispatchQty)} {formatUOM(item.uom)}
        </span>
      ),
    },
    {
      header: "Received Qty",
      width: "190px",
      align: "right",
      render: (item: any) => {
        if (isStore && canAct) {
          return (
            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
                    setReceivedQuantities((prev) => ({ ...prev, [item.id]: String(val) }));
                  }}
                />
              </div>
              <span className="text-xs text-ink-subtle font-semibold">{formatUOM(item.uom)}</span>
            </div>
          );
        }
        if (item.bypassGate) {
          return (
            <div className="flex flex-col items-end gap-1">
              <span className="font-bold text-emerald-400">
                {Number(item.dispatchQty)} {formatUOM(item.uom)}
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/30">
                ✓ Stock Added Directly
              </span>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-end gap-1">
            <span className="font-bold text-primary">
              {item.receivedQty != null ? `${Number(item.receivedQty)} ${formatUOM(item.uom)}` : "—"}
            </span>
            {item.receivedQty != null && Number(item.receivedQty) < Number(item.dispatchQty) && (
              <span className="inline-flex items-center bg-red-500/15 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold border border-red-500/30">
                {Number(item.dispatchQty) - Number(item.receivedQty)} {formatUOM(item.uom)} Missing
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full bg-card rounded-2xl border border-line shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
        <div>
          <h2 className="text-base font-bold text-ink flex items-center gap-2.5">
            {dispatchData.dispatchNumber}
            <StatusBadge status={dispatchData.status} />
          </h2>
          <p className="text-ink-subtle text-xs mt-0.5">
            Dispatch Date: {formatDate(dispatchData.dispatchDate)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BackButton text="Back to List" to="/production/goods-dispatch" />
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Dispatched Items */}
            <div className="rounded-xl border border-line-soft shadow-xs bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 bg-card-2 border-b border-line-soft">
                <h3 className="font-extrabold text-ink text-sm">Dispatched Items</h3>
              </div>
              <DataTable
                columns={itemColumns}
                data={itemsToDisplay}
                rowKey={(item) => item.id.toString()}
                emptyMessage="No dispatched items found"
                minHeightClassName="min-h-0"
                maxHeightClassName="max-h-[300px] overflow-auto"
                density="compact"
              />
            </div>

            {/* Vehicle Information */}
            <div className="rounded-xl border border-line-soft shadow-xs bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 bg-card-2 border-b border-line-soft">
                <h3 className="font-extrabold text-ink text-sm">Vehicle Information</h3>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
                <InfoField label="Vehicle Number" value={dispatchData.vehicleNumber} />
                <InfoField label="Driver Name" value={dispatchData.driverName} />
                <InfoField label="Driver Mobile" value={dispatchData.driverMobile} />
                <InfoField label="DC Number" value={dispatchData.dcNumber} />
                <InfoField label="Loading Time" value={dispatchData.loadingTime} />
                <InfoField label="Remarks" value={dispatchData.remarks} />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 space-y-4">
            {/* Action Panel — only when actionable and user has permission */}
            {canAct && (
              <div className="rounded-xl border border-line-soft shadow-xs bg-card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-card-2 border-b border-line-soft">
                  <h3 className="font-extrabold text-ink text-sm">
                    {isGate ? "Gate Approval" : "Store Receipt"}
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  {isStore && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-primary font-medium">
                        Approving will automatically update Finished Goods Stock in{" "}
                        <span className="font-bold">{dispatchData.store?.storeName || "the destination store"}</span>.
                      </p>
                    </div>
                  )}
                  <TextInput
                    name="remarks"
                    placeholder={isGate ? "Enter approval or rejection remarks..." : "Enter receipt or rejection remarks..."}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    as="textarea"
                    rows={2}
                  />
                  <div className="flex items-center gap-3 pt-1">
                    <CustomButton
                      text={isGate ? "Approve" : "Receive Stock"}
                      icon={FaCheck}
                      onClick={handleApprove}
                      disabled={loading}
                      variant="primary"
                      width="100%"
                    />
                    <CustomButton
                      text="Reject"
                      icon={FaTimes}
                      onClick={handleReject}
                      disabled={loading}
                      variant="danger"
                      width="100%"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Status History */}
            <div className="rounded-xl border border-line-soft shadow-xs bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 bg-card-2 border-b border-line-soft">
                <h3 className="font-extrabold text-ink text-sm">Status History</h3>
              </div>
              <div className="p-4">
                <div className="flex flex-col gap-0">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-extrabold shadow-sm shrink-0
                            ${step.done ? step.color : "bg-card-2 border-2 border-line-soft"}`}
                        >
                          {step.done ? (
                            step.rejected ? <FaTimes className="w-2.5 h-2.5" /> : <FaCheck className="w-2.5 h-2.5" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-line-soft" />
                          )}
                        </div>
                        {idx < steps.length - 1 && (
                          <div
                            className={`w-0.5 flex-1 min-h-[20px] mt-1 ${
                              steps[idx + 1].done
                                ? steps[idx + 1].rejected ? "bg-red-500/40" : "bg-primary/40"
                                : "bg-line-soft"
                            }`}
                          />
                        )}
                      </div>
                      <div className={`pb-2.5 ${idx === steps.length - 1 ? "pb-0" : ""}`}>
                        <p className={`text-[12px] font-extrabold leading-tight ${step.rejected ? "text-red-400" : step.done ? "text-ink" : "text-ink-subtle"}`}>
                          {step.label}
                        </p>
                        {step.date && (
                          <p className="text-[10px] text-ink-subtle font-semibold mt-0.5 leading-tight">
                            {formatDateTime(step.date)}
                          </p>
                        )}
                        {step.remarks && (
                          <p className="text-[10px] text-ink-subtle mt-0.5 italic leading-tight">"{step.remarks}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoodsDispatchView;
