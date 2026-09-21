import { formatDate } from "../../../utils/dateUtils";
import { getPlanStatusInfo } from "../../../utils/planningUtils";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  FaIndustry,
  FaArrowRight, FaShare, FaClipboardList
} from "react-icons/fa";

import apiClient from "../../../api/apiClient";
import config from "../../../api/config";
import { oeeService } from "../../../services/oeeService";
import { dailyPlanService } from "../../../services/dailyPlanService";
import { useSocketSync } from "../../../hooks/useSocketSync";

import CommonModal from "../../../components/ui/Modal/CommonModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";

interface DailyPlanViewModalProps {
  show: boolean;
  onHide: () => void;
  plan: any;
}

const fmtDate = (d: string | undefined | null) => {
  if (!d) return "—";
  const dt = new Date(d.includes("T") ? d : `${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const DailyPlanViewModal: React.FC<DailyPlanViewModalProps> = ({ show, onHide, plan: initialPlan }) => {
  const [viewPlan, setViewPlan] = useState<any>(initialPlan);

  const [loadingViewLogs, setLoadingViewLogs] = useState(false);
  const [viewHourlyLogs, setViewHourlyLogs] = useState<any[]>([]);
  const [viewPlanOeeSummary, setViewPlanOeeSummary] = useState<any>(null);
  const [loadingPOHistory, setLoadingPOHistory] = useState(false);
  const [poHistoryPlans, setPOHistoryPlans] = useState<any[]>([]);

  // Reset and fetch when plan changes or modal opens
  useEffect(() => {
    if (show && initialPlan) {
      setViewPlan(initialPlan);
      setViewHourlyLogs([]);
      setViewPlanOeeSummary(null);
      setPOHistoryPlans([]);
    }
  }, [show, initialPlan?.dailyPlanId]);

  const fetchAllData = useCallback(async () => {
    if (!show) return;
    if (!viewPlan?.productionOrderId && !viewPlan?.dailyPlanId) return;
    let currentPlan = viewPlan;

    if (!currentPlan.productionOrderId && currentPlan.dailyPlanId) {
      try {
        const res = await dailyPlanService.getById(currentPlan.dailyPlanId);
        if (res) {
          currentPlan = res;
          setViewPlan(currentPlan);
        }
      } catch (e) {
        console.error("Failed to fetch plan details", e);
        return;
      }
    }

    setLoadingViewLogs(true);
    apiClient.get(config.hourlyProduction.base, {
      params: {
        machineId: currentPlan.machineId,
        shiftId: currentPlan.shiftId,
        productionDate: currentPlan.productionDate?.split("T")[0],
        productionOrderId: currentPlan.productionOrderId,
      }
    }).then(res => {
      if (res.data?.success) {
        const rawList = res.data.data || [];
        const entries: any[] = [];
        rawList.forEach((hp: any) => {
          if (Array.isArray(hp.hourlyEntries) && hp.hourlyEntries.length > 0) {
            hp.hourlyEntries.forEach((e: any) => {
              entries.push({
                ...e,
                hourlyProductionId: `${hp.hourlyProductionId || hp.id}-${e.hourIndex}`,
              });
            });
          } else if (Number(hp.hourIndex) > 0) {
            entries.push(hp);
          }
        });
        entries.sort((a: any, b: any) => Number(a.hourIndex || 0) - Number(b.hourIndex || 0));
        setViewHourlyLogs(entries);
      } else {
        setViewHourlyLogs([]);
      }
    }).catch(() => setViewHourlyLogs([])
    ).finally(() => setLoadingViewLogs(false));

    oeeService.getProductionOrderOee(currentPlan.productionOrderId)
      .then((data: any) => setViewPlanOeeSummary(data))
      .catch(() => setViewPlanOeeSummary(null));

    if (currentPlan.productionOrderId) {
      setLoadingPOHistory(true);
      dailyPlanService.getAll({ productionOrderId: currentPlan.productionOrderId })
        .then((res: any) => {
          let plans: any[] = [];
          if (Array.isArray(res)) plans = res;
          else if (Array.isArray(res?.data)) plans = res.data;
          else if (Array.isArray(res?.data?.dailyPlans)) plans = res.data.dailyPlans;
          else if (Array.isArray(res?.dailyPlans)) plans = res.dailyPlans;
          plans.sort((a: any, b: any) => new Date(b.productionDate || 0).getTime() - new Date(a.productionDate || 0).getTime());
          setPOHistoryPlans(plans);
        })
        .catch(() => setPOHistoryPlans([]))
        .finally(() => setLoadingPOHistory(false));
    }

  }, [show, viewPlan?.dailyPlanId, viewPlan?.productionOrderId]);

  useEffect(() => {
    if (show) fetchAllData();
  }, [fetchAllData, show]);

  useSocketSync("dailyPlan", undefined, () => { if (show) fetchAllData(); });
  useSocketSync("hourlyProduction", undefined, () => { if (show) fetchAllData(); });

  const poHistoryColumns: DataTableColumn<any>[] = useMemo(() => [
    {
      header: "Plan ID",
      render: (plan: any) => {
        const isCurrent = plan.dailyPlanId === viewPlan?.dailyPlanId;
        return (
          <span className={`font-mono text-xs font-semibold ${isCurrent ? "text-indigo-400" : "text-ink-muted"}`}>
            {plan.dailyPlanId}
            {isCurrent && (
              <span className="ml-1.5 text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">
                Current
              </span>
            )}
          </span>
        );
      }
    },
    {
      header: "Date",
      render: (plan: any) => (
        <span className="text-xs text-ink-muted">
          {plan.productionDate
            ? formatDate(plan.productionDate)
            : "—"}
        </span>
      )
    },
    {
      header: "Machine",
      render: (plan: any) => (
        <span className="text-xs text-ink-muted">
          {plan.machine?.machineName || plan.machineId || "—"}
        </span>
      )
    },
    {
      header: "Shift",
      render: (plan: any) => (
        <span className="text-[10px] bg-card-2 text-ink-muted border border-line px-2 py-0.5 rounded font-medium">
          {plan.shift?.shiftName || plan.shiftId || "—"}
        </span>
      )
    },
    {
      header: "Planned",
      align: "center",
      render: (plan: any) => (
        <span className="text-xs font-semibold text-ink-muted">
          {Number(plan.plannedQty || 0).toLocaleString()}
        </span>
      )
    },
    {
      header: "Produced",
      align: "center",
      render: (plan: any) => {
        const producedQty = Array.isArray(plan.hourlyProductions)
          ? plan.hourlyProductions.reduce((s: number, h: any) => s + Math.max(0, Number(h.totalQtyProduced ?? h.qtyProduced ?? 0) - Number(h.totalRejectQty ?? h.rejectQty ?? 0)), 0)
          : 0;
        return (
          <span className={`text-xs font-bold ${producedQty >= Number(plan.plannedQty || 0) ? "text-emerald-400" : producedQty > 0 ? "text-amber-400" : "text-ink-subtle"}`}>
            {producedQty.toLocaleString()}
          </span>
        );
      }
    },
    {
      header: "Status",
      align: "center",
      render: (plan: any) => <StatusBadge status={plan.status} />
    }
  ], [viewPlan?.dailyPlanId]);

  if (!show) return null;

  const modalTitle = (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
        <FaIndustry className="text-white" size={14} />
      </div>
      <div>
        <div className="text-base font-bold text-ink leading-tight">Daily Planaaaa — {viewPlan?.dailyPlanId}</div>
        <div className="text-xs text-ink-subtle mt-0.5">
          {fmtDate(viewPlan?.productionDate)} · {viewPlan?.machine?.machineName || viewPlan?.machineId} · {viewPlan?.shift?.shiftName || viewPlan?.shiftId}
        </div>
      </div>
    </div>
  );

  return (
    <CommonModal
      show={show}
      onHide={onHide}
      title={modalTitle}
      maxWidth="6xl"
    >
      <div className="overflow-y-auto p-5 space-y-5">

        {/* ── Plan Details Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-line p-4 bg-card-2/40">
            <h6 className="text-xs font-bold text-ink-subtle uppercase tracking-wider mb-3">Plan Details</h6>
            <dl className="space-y-2.5 text-sm">
              {[
                { label: "Production Order", value: viewPlan?.productionOrderId },
                { label: "Product", value: viewPlan?.productionOrder?.productItem?.productName || "—" },
                { label: "Date", value: fmtDate(viewPlan?.productionDate) },
                { label: "Machine", value: viewPlan?.machine?.machineName || viewPlan?.machineId },
                { label: "Shift", value: viewPlan?.shift?.shiftName || viewPlan?.shiftId },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <dt className="text-ink-subtle font-medium w-36 flex-shrink-0">{label}:</dt>
                  <dd className="text-ink font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-xl border border-line p-4 bg-card-2/40">
            <h6 className="text-xs font-bold text-ink-subtle uppercase tracking-wider mb-3">Quantities & Status</h6>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2">
                <dt className="text-ink-subtle font-medium w-36 flex-shrink-0">Planned Qty:</dt>
                <dd className="text-ink font-semibold">{viewPlan?.plannedQty} pcs</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-ink-subtle font-medium w-36 flex-shrink-0">Status:</dt>
                <dd><StatusBadge status={viewPlan?.status} /></dd>
              </div>
              {viewPlan?.remarks && (
                <div className="flex items-start gap-2 mt-1">
                  <dt className="text-ink-subtle font-medium w-36 flex-shrink-0">Narration:</dt>
                  <dd className="text-ink-muted text-sm leading-relaxed">{viewPlan.remarks}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* ── Production Steps ── */}
        {viewPlan?.productionOrder?.productItem?.productionSteps?.length > 0 && (
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-card-2 border-b border-line">
              <h6 className="text-xs font-bold text-ink-subtle uppercase tracking-wider m-0">Production Steps</h6>
            </div>
            <div className="p-4 flex flex-wrap gap-2.5 items-center">
              {viewPlan.productionOrder.productItem.productionSteps.map((step: any, idx: number) => {
                const stepNum = idx + 1;
                const currentStep = viewPlan.currentStepIndex || 1;
                let isCompleted = false;
                let isActive = false;

                if (viewPlan.status === "COMPLETED" || viewPlan.status === "READY_FOR_DISPATCH") {
                  isCompleted = true;
                } else if (["STOPPED", "CANCELLED", "SHORT_CLOSED"].includes(viewPlan.status)) {
                  isCompleted = stepNum < currentStep;
                }

                const badgeColors = isCompleted
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : isActive
                  ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                  : "bg-card-2 text-ink-subtle border-line";

                const dotColors = isCompleted
                  ? "bg-emerald-500 text-white"
                  : isActive
                  ? "bg-indigo-500 text-white"
                  : "bg-line text-ink-subtle";

                return (
                  <React.Fragment key={step.id || idx}>
                    <span className={`px-3 py-1.5 font-semibold text-sm rounded-lg border flex items-center gap-2 ${badgeColors}`}>
                      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${dotColors}`}>
                        {step.stepOrder || stepNum}
                      </span>
                      {step.stepKey}
                    </span>
                    {idx < viewPlan.productionOrder.productItem.productionSteps.length - 1 && (
                      <FaArrowRight className="text-ink-subtle text-xs" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Hourly Production Logs ── */}
        <div>
          <h6 className="text-sm font-bold text-ink-muted uppercase tracking-wider mb-3">Hourly Production Entrieaaaaas</h6>
          {loadingViewLogs ? (
            <div className="flex items-center justify-center gap-2 py-8 border border-line rounded-xl bg-card-2 text-ink-subtle text-sm">
              <div className="w-5 h-5 border-2 border-indigo-400/40 border-t-transparent rounded-full animate-spin" />
              Loading entries...
            </div>
          ) : viewHourlyLogs.length > 0 ? (
            <div className="border border-line rounded-xl overflow-hidden">
              <DataTable
                columns={[
                  { header: "Hour", align: "center", render: (h: any) => <span className="font-bold font-mono text-ink-muted text-sm">H{h.hourIndex}</span> },
                  { header: "Produced", align: "center", render: (h: any) => <span className="font-bold text-emerald-400 text-base">{h.qtyProduced}</span> },
                  { header: "Reject", align: "center", render: (h: any) => <span className="text-rose-400 text-sm">{h.rejectQty || 0}</span> },
                  {
                    header: "Downtime",
                    align: "center",
                    render: (h: any) => {
                      const dt = Number(h.downtime || 0);
                      if (dt <= 0) return <span className="text-ink-subtle text-sm">—</span>;
                      const reason = h.downtimeReason || h.reason || h.remarks || "No reason specified";
                      return (
                        <span
                          className="text-amber-400 font-semibold text-sm cursor-help underline decoration-dotted decoration-amber-400/60 underline-offset-2"
                          title={`Downtime Reason: ${reason}`}
                        >
                          {dt} min
                        </span>
                      );
                    }
                  },
                  { header: "Operator", render: (h: any) => <span className="text-ink-muted font-medium text-sm truncate max-w-[120px] inline-block" title={h.operatorName || h.operatorId}>{h.operatorName || h.operatorId || "—"}</span> }
                ]}
                data={viewHourlyLogs}
                rowKey={(h: any) => h.hourlyProductionId}
                minHeightClassName="min-h-0"
              />
              {/* Totals Footer */}
              <div className="bg-card-2 px-4 py-3 border-t border-line space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 font-bold">
                  <span className="text-ink-subtle text-xs uppercase tracking-wider">Totals:</span>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-emerald-400">✓ Produced: {viewHourlyLogs.reduce((s: any, h: any) => s + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0)), 0)}</span>
                    <span className="text-rose-400">✕ Reject: {viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.rejectQty || 0), 0)}</span>
                    <span className="text-ink-subtle">↓ Downtime: {(() => { const t = viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.downtime || 0), 0); return t > 0 ? `${t} min` : "—"; })()}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm pt-2 border-t border-line border-dashed">
                  {(() => {
                    const producedPcs = viewHourlyLogs.reduce((s: any, h: any) => s + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0)), 0);
                    const plannedPcs = Number(viewPlan?.plannedQty || 0);
                    const pendingPcs = Math.max(0, plannedPcs - producedPcs);
                    return (
                      <div className="flex gap-5 font-bold">
                        <span className="text-ink-muted">Total Produced: <span className="text-emerald-400 ml-1">{producedPcs} pcs</span></span>
                        <span className="text-ink-muted">Pending: <span className="text-amber-400 ml-1">{pendingPcs} pcs</span></span>
                      </div>
                    );
                  })()}
                </div>
                {viewPlan?.carryForwardTo && viewPlan.carryForwardTo.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-ink-subtle uppercase tracking-wider text-xs">Carried Forward To:</span>
                    <span className="text-indigo-400 font-bold bg-indigo-500/15 px-3 py-1 rounded border border-indigo-500/30 flex items-center gap-1.5 text-sm">
                      <FaShare className="text-xs" />
                      {viewPlan.carryForwardTo[0].dailyPlanId}
                      <span className="text-indigo-400/60 font-normal ml-1">({viewPlan.carryForwardTo[0].productionDate?.split("T")[0]})</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 border border-line rounded-xl bg-card-2 text-center">
              <FaClipboardList className="text-ink-subtle mb-3" size={32} />
              <span className="text-ink-subtle font-medium text-sm">No hourly entries recorded yet for this plan.</span>
            </div>
          )}
        </div>

        {/* ── Daily Target vs Actual Comparison ── */}
        {viewHourlyLogs.length > 0 && (
          <div>
            <h6 className="text-sm font-bold text-ink-muted uppercase tracking-wider mb-3">Target vs Actual Comparison</h6>
            <div className="border border-line rounded-xl overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-card-2 border-b border-line">
                    {["Machine", "Product", "Capacity", "Produced", "Pending", "Efficiency", "Status"].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-bold text-ink-subtle uppercase tracking-wider ${["Capacity", "Produced", "Pending", "Efficiency", "Status"].includes(h) ? "text-center" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(() => {
                    const capacity = Math.round(Number(viewPlan?.plannedQty || 0));
                    const totalProduced = viewHourlyLogs.length > 0
                      ? Math.round(viewHourlyLogs.reduce((s: number, h: any) => s + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0)), 0))
                      : 0;
                    const pending = Math.max(0, capacity - totalProduced);
                    const effNum = capacity > 0 ? Math.round((totalProduced / capacity) * 100) : 0;
                    const efficiency = `${effNum}%`;

                    const { statusText, customColor } = getPlanStatusInfo(capacity, totalProduced);

                    return (
                      <tr>
                        <td className="px-4 py-3 text-ink-muted font-medium">{viewPlan?.machine?.machineName || viewPlan?.machineId || "—"}</td>
                        <td className="px-4 py-3 text-ink-muted">{viewPlan?.productionOrder?.productItem?.productName || "—"}</td>
                        <td className="px-4 py-3 text-center text-ink font-bold">{capacity}</td>
                        <td className="px-4 py-3 text-center text-emerald-400 font-bold">{totalProduced}</td>
                        <td className="px-4 py-3 text-center text-amber-400 font-bold">{pending}</td>
                        <td className="px-4 py-3 text-center text-indigo-400 font-bold">{efficiency}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status="CUSTOM" customText={statusText} customColor={customColor} />
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </CommonModal>
  );
};

export default DailyPlanViewModal;
