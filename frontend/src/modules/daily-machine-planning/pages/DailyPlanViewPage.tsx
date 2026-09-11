import { formatDate } from "../../../utils/dateUtils";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { FaArrowLeft, FaIndustry, FaChartBar, FaCheckCircle, FaBoxOpen, FaTruck, FaArrowRight, FaShare, FaClipboardList, FaCalendarAlt } from "react-icons/fa";
import { useNavigate, useLocation, useParams } from "react-router-dom";

import apiClient from "../../../api/apiClient";
import config from "../../../api/config";
import { oeeService } from "../../../services/oeeService";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import { dailyPlanService } from "../../../services/dailyPlanService";
import { productCapacityHistoryService } from "../../../services/productCapacityHistoryService";
import { useSocketSync } from "../../../hooks/useSocketSync";

import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";

const DailyPlanViewPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Fetch passed plan from location state or fallback to ID
  const [viewPlan, setViewPlan] = useState<any>(location.state?.plan || { dailyPlanId: id });

  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [weeklyProgram, setWeeklyProgram] = useState<any>(null);
  const [loadingViewLogs, setLoadingViewLogs] = useState(false);
  const [viewHourlyLogs, setViewHourlyLogs] = useState<any[]>([]);
  const [viewPlanOeeSummary, setViewPlanOeeSummary] = useState<any>(null);
  const [loadingPOHistory, setLoadingPOHistory] = useState(false);
  const [poHistoryPlans, setPOHistoryPlans] = useState<any[]>([]);
  const [machineProductCapacity, setMachineProductCapacity] = useState<number | null>(null);

  const fetchAllData = useCallback(async () => {
    if (!viewPlan?.productionOrderId && !viewPlan?.dailyPlanId) return;
    let currentPlan = viewPlan;

    // If we only have ID (from direct link), fetch the full plan first
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
      if (res.data?.success) setViewHourlyLogs((res.data.data || []).filter((h: any) => Number(h.hourIndex) > 0));
      else setViewHourlyLogs([]);
    }).catch(() => setViewHourlyLogs([])
    ).finally(() => setLoadingViewLogs(false));

    oeeService.getProductionOrderOee(currentPlan.productionOrderId)
      .then((data: any) => setViewPlanOeeSummary(data))
      .catch(() => setViewPlanOeeSummary(null));

    if (currentPlan.weeklyProgramId) {
      setLoadingWeekly(true);
      weeklyProgramService.getById(currentPlan.weeklyProgramId)
        .then((res: any) => {
          const data = res?.data || res;
          setWeeklyProgram(data);
        })
        .catch(() => setWeeklyProgram(null))
        .finally(() => setLoadingWeekly(false));
    }

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

    if (currentPlan.machineId && currentPlan.productionOrder?.productItem?.id) {
      productCapacityHistoryService.fetchByProductAndMachine(Number(currentPlan.productionOrder.productItem.id), currentPlan.machineId)
        .then((rec: any) => {
          if (rec && rec.newCapacity != null) setMachineProductCapacity(Number(rec.newCapacity));
          else setMachineProductCapacity(null);
        })
        .catch(() => setMachineProductCapacity(null));
    } else {
      setMachineProductCapacity(null);
    }
  }, [viewPlan?.dailyPlanId, viewPlan?.productionOrderId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useSocketSync("dailyPlan", undefined, fetchAllData);
  useSocketSync("hourlyProduction", undefined, fetchAllData);

  const handleLogHourly = (plan: any) => {
    navigate("/hourly-work-reports/create", {
      state: {
        dailyPlanId: plan.dailyPlanId,
        productionOrderId: plan.productionOrderId,
        machineId: plan.machineId,
        shiftId: plan.shiftId,
        productionDate: plan.productionDate,
        weeklyProgramId: plan.weeklyProgramId
      }
    });
  };

  const handleBack = () => {
    navigate(-1);
  };

  const weeklyTargetQty = weeklyProgram ? Number(weeklyProgram.targetQty || 0) : 0;
  const weeklyProducedQty = viewPlan?.productionOrder
    ? (() => {
        const totalProduced = Array.isArray(viewPlan.hourlyProductions)
          ? viewPlan.hourlyProductions.reduce((s: number, h: any) => s + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0) - Number(h.scrapQty || 0)), 0)
          : 0;
        return totalProduced;
      })()
    : 0;
  const weeklyOrderTargetQty = viewPlan?.productionOrder ? Number(viewPlan.productionOrder.targetQty || 0) : 0;
  // Net PO produced = sum of (qtyProduced - rejectQty - scrapQty) across ALL plans for this PO
  const netPoProduced = poHistoryPlans.length > 0
    ? poHistoryPlans.reduce((total: number, p: any) =>
        total + (Array.isArray(p.hourlyProductions)
          ? p.hourlyProductions.reduce((s: number, h: any) =>
              s + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0) - Number(h.scrapQty || 0)), 0)
          : 0), 0)
    : null;
  // Use goodQty (net: producedQty − rejectQty − scrapQty) from OEE summary when available
  const weeklyOrderProducedQty = viewPlanOeeSummary?.goodQty ?? weeklyProducedQty;
  const weeklyOrderPct = weeklyOrderTargetQty > 0 ? Math.min(100, Math.round((weeklyOrderProducedQty / weeklyOrderTargetQty) * 100)) : 0;
  const weeklyProgramPct = weeklyTargetQty > 0 ? Math.min(100, Math.round((weeklyOrderProducedQty / weeklyTargetQty) * 100)) : 0;

  const poHistoryColumns: DataTableColumn<any>[] = useMemo(() => [
    {
      header: "Plan ID",
      render: (plan: any) => {
        const isCurrent = plan.dailyPlanId === viewPlan?.dailyPlanId;
        return (
          <span className={`font-mono text-xs font-semibold ${isCurrent ? "text-indigo-700" : "text-ink-muted"}`}>
            {plan.dailyPlanId}
            {isCurrent && <span className="ml-1.5 text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase">Current</span>}
          </span>
        );
      }
    },
    {
      header: "Date",
      render: (plan: any) => (
        <span className="text-xs text-ink-muted">
          {plan.productionDate ? formatDate(plan.productionDate) : "—"}
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
          ? plan.hourlyProductions.reduce((s: number, h: any) => s + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0) - Number(h.scrapQty || 0)), 0)
          : 0;
        return (
          <span className={`text-xs font-bold ${producedQty >= Number(plan.plannedQty || 0) ? "text-emerald-600" : producedQty > 0 ? "text-amber-600" : "text-ink-subtle"}`}>
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

  if (!viewPlan || !viewPlan.productionOrderId) {
    return (
      <div className="p-6 h-full flex items-center justify-center text-ink-subtle">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <FaIndustry className="text-white" size={16} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-ink leading-tight">Daily Plan — {viewPlan.dailyPlanId}</h3>
            <p className="text-xs text-ink-subtle mt-0.5">{viewPlan.productionDate?.split("T")[0]} · {viewPlan.machine?.machineName || viewPlan.machineId} · {viewPlan.shift?.shiftName || viewPlan.shiftId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* {(viewPlan.status === "PLANNED" || viewPlan.status === "IN_PROGRESS") && (
            <CustomButton
              text="Log Hourly Entry"
              icon={FaClipboardList}
              className="!bg-emerald-600 hover:!bg-emerald-700 !text-white shadow-sm"
              onClick={() => handleLogHourly(viewPlan)}
            />
          )} */}
          <BackButton />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-card rounded-2xl shadow-xs border border-line-soft p-6 space-y-6">

        {/* ── Weekly Production Target Progress ── */}
        {viewPlan.weeklyProgramId && (
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FaChartBar className="text-indigo-500" size={16} />
              <h6 className="text-sm font-bold text-indigo-700 uppercase tracking-wider m-0">Weekly Target Progress</h6>
              <span className="ml-auto text-xs text-indigo-400 font-mono bg-card/60 px-3 py-1 rounded-md border border-indigo-100">
                {viewPlan.weeklyProgramId}
              </span>
            </div>

            {loadingWeekly ? (
              <div className="flex items-center gap-2 text-sm text-indigo-400">
                <div className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                Loading weekly data...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Production Order Target */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-ink-muted">Production Order Target</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-ink-subtle">{weeklyOrderProducedQty.toLocaleString()} / {weeklyOrderTargetQty.toLocaleString()} pcs</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${weeklyOrderPct >= 100 ? "bg-emerald-100 text-emerald-700" : weeklyOrderPct >= 50 ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                        {weeklyOrderPct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-card/60 rounded-full overflow-hidden border border-indigo-100">
                    <div
                      className={`h-full rounded-full transition-all ${weeklyOrderPct >= 100 ? "bg-emerald-500" : weeklyOrderPct >= 50 ? "bg-indigo-500" : "bg-amber-400"}`}
                      style={{ width: `${weeklyOrderPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-ink-subtle">Produced: <strong className="text-emerald-600">{weeklyOrderProducedQty.toLocaleString()}</strong></span>
                    <span className="text-xs text-ink-subtle">Remaining: <strong className="text-amber-600">{Math.max(0, weeklyOrderTargetQty - weeklyOrderProducedQty).toLocaleString()}</strong></span>
                  </div>
                </div>

                {/* Weekly Program Target (if available) */}
                {weeklyTargetQty > 0 && (
                  <div className="pt-3 border-t border-indigo-100/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-ink-muted">Weekly Program Target</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-ink-subtle">{weeklyOrderProducedQty.toLocaleString()} / {weeklyTargetQty.toLocaleString()} pcs</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${weeklyProgramPct >= 100 ? "bg-emerald-100 text-emerald-700" : weeklyProgramPct >= 50 ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"}`}>
                          {weeklyProgramPct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-card/60 rounded-full overflow-hidden border border-indigo-100">
                      <div
                        className={`h-full rounded-full transition-all ${weeklyProgramPct >= 100 ? "bg-emerald-500" : weeklyProgramPct >= 50 ? "bg-blue-500" : "bg-rose-400"}`}
                        style={{ width: `${weeklyProgramPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Completion status chips */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {weeklyOrderPct >= 100 ? (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200">
                      <FaCheckCircle size={10} /> Weekly Target Complete!
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200">
                      <FaBoxOpen size={10} /> {Math.max(0, weeklyOrderTargetQty - weeklyOrderProducedQty).toLocaleString()} pcs remaining to complete
                    </span>
                  )}
                  {viewPlan.productionOrder?.status === "COMPLETED" && (
                    <span className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full border border-indigo-200">
                      <FaTruck size={10} /> Ready for Dispatch
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Plan Details Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-xl border border-line p-5 bg-card-2/40">
            <h6 className="text-xs font-bold text-ink-subtle uppercase tracking-wider mb-4">Plan Details</h6>
            <dl className="space-y-3 text-sm">
              {[
                { label: "Production Order", value: viewPlan.productionOrderId },
                { label: "Product", value: viewPlan.productionOrder?.productItem?.productName || "—" },
                { label: "Date", value: viewPlan.productionDate?.split("T")[0] },
                { label: "Machine", value: viewPlan.machine?.machineName || viewPlan.machineId },
                { label: "Shift", value: viewPlan.shift?.shiftName || viewPlan.shiftId },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <dt className="text-ink-subtle font-medium w-40 flex-shrink-0">{label}:</dt>
                  <dd className="text-ink font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-xl border border-line p-5 bg-card-2/40">
            <h6 className="text-xs font-bold text-ink-subtle uppercase tracking-wider mb-4">Quantities & Status</h6>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <dt className="text-ink-subtle font-medium w-40 flex-shrink-0">Planned Qty:</dt>
                <dd className="text-ink font-semibold">{viewPlan.plannedQty} pcs</dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="text-ink-subtle font-medium w-40 flex-shrink-0">Planned Hours:</dt>
                <dd className="text-ink font-semibold">{viewPlan.plannedHours || "—"} hrs</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-ink-subtle font-medium w-40 flex-shrink-0">Priority:</dt>
                <dd><StatusBadge status={viewPlan.priority || "MEDIUM"} /></dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-ink-subtle font-medium w-40 flex-shrink-0">Status:</dt>
                <dd><StatusBadge status={viewPlan.status} /></dd>
              </div>
              {viewPlan.remarks && (
                <div className="flex items-start gap-2 mt-2">
                  <dt className="text-ink-subtle font-medium w-40 flex-shrink-0">Remarks:</dt>
                  <dd className="text-ink-muted text-sm leading-relaxed">{viewPlan.remarks}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* ── Post Production Steps ── */}
        {viewPlan.productionOrder?.productItem?.productionSteps?.length > 0 && (
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-card-2 border-b border-line">
              <h6 className="text-xs font-bold text-ink-subtle uppercase tracking-wider m-0">Post Production Steps</h6>
            </div>
            <div className="p-5 flex flex-wrap gap-3 items-center">
              {viewPlan.productionOrder.productItem.productionSteps.map((step: any, idx: number) => {
                const stepNum = idx + 1;
                const currentStep = viewPlan.currentStepIndex || 1;
                let isCompleted = false;
                let isActive = false;

                if (viewPlan.status === "COMPLETED" || viewPlan.status === "READY_FOR_DISPATCH") {
                  isCompleted = true;
                } else if (viewPlan.status === "POST_PRODUCTION") {
                  isCompleted = stepNum < currentStep;
                  isActive = stepNum === currentStep;
                } else if (viewPlan.status === "STOPPED" || viewPlan.status === "CANCELLED" || viewPlan.status === "SHORT_CLOSED") {
                  isCompleted = stepNum < currentStep;
                }

                const badgeColors = isCompleted
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isActive
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-card-2 text-ink-subtle border-line";

                const dotColors = isCompleted
                  ? "bg-emerald-500 text-white"
                  : isActive
                  ? "bg-indigo-600 text-white"
                  : "bg-ink-subtle text-ink-subtle";

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
          <h6 className="text-sm font-bold text-ink-muted uppercase tracking-wider mb-4">Hourly Production Entries</h6>
          {loadingViewLogs ? (
            <div className="flex items-center justify-center gap-2 py-10 border border-line rounded-xl bg-card-2 text-ink-subtle text-sm">
              <div className="w-5 h-5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
              Loading entries...
            </div>
          ) : viewHourlyLogs.length > 0 ? (
            <div className="border border-line rounded-xl overflow-hidden">
              <DataTable
                columns={[
                  { header: "Hour", align: "center", render: (h: any) => <span className="font-bold font-mono text-ink-muted text-sm">H{h.hourIndex}</span> },
                  { header: "Produced", align: "center", render: (h: any) => <span className="font-bold text-emerald-600 text-base">{h.qtyProduced}</span> },
                  { header: "Reject", align: "center", render: (h: any) => <span className="text-rose-500 text-sm">{h.rejectQty || 0}</span> },
                  { header: "Scrap", align: "center", render: (h: any) => <span className="text-amber-500 text-sm">{h.scrapQty || 0}</span> },
                  { header: "Downtime", align: "center", render: (h: any) => <span className="text-ink-subtle text-sm">{h.downtime > 0 ? `${h.downtime} min` : "—"}</span> },
                  { header: "Avail%", align: "center", render: (h: any) => <span className="font-semibold text-emerald-700 text-sm">{h.availabilityPct !== undefined ? `${h.availabilityPct}%` : '—'}</span> },
                  { header: "Qual%", align: "center", render: (h: any) => <span className="font-semibold text-purple-700 text-sm">{h.qualityPct !== undefined ? `${h.qualityPct}%` : '—'}</span> },
                  { header: "OEE%", align: "center", render: (h: any) => <span className="font-extrabold text-indigo-700 text-sm">{h.hourlyOEE !== undefined ? `${h.hourlyOEE}%` : '—'}</span> },
                  { header: "Operator", render: (h: any) => <span className="text-ink-muted font-medium text-sm truncate max-w-[150px] inline-block" title={h.operatorName || h.operatorId}>{h.operatorName || h.operatorId || "—"}</span> }
                ]}
                data={viewHourlyLogs}
                rowKey={(h: any) => h.hourlyProductionId}
                minHeightClassName="min-h-0"
              />
              {/* Totals Footer */}
              <div className="bg-card-2 p-5 border-t border-line space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 text-sm font-bold">
                  <span className="text-ink-subtle text-xs uppercase tracking-wider">Totals:</span>
                  <div className="flex flex-wrap gap-5 text-sm">
                    <span className="text-emerald-600">✓ Produced: {viewHourlyLogs.reduce((s: any, h: any) => s + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0) - Number(h.scrapQty || 0)), 0)}</span>
                    <span className="text-rose-500">✕ Reject: {viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.rejectQty || 0), 0)}</span>
                    <span className="text-amber-500">⚠ Scrap: {viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.scrapQty || 0), 0)}</span>
                    <span className="text-ink-subtle">↓ Downtime: {(() => { const t = viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.downtime || 0), 0); return t > 0 ? `${t} min` : "—"; })()}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 text-sm pt-3 border-t border-line border-dashed">
                  <div className="flex gap-6 font-bold">
                    <span className="text-ink-muted">Total Produced: <span className="text-emerald-600 ml-2">{weeklyOrderProducedQty} pcs</span></span>
                    <span className="text-ink-muted">Pending: <span className="text-amber-500 ml-2">{Math.max(0, weeklyOrderTargetQty - weeklyOrderProducedQty)} pcs</span></span>
                  </div>
                  {viewPlan.carryForwardTo && viewPlan.carryForwardTo.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-ink-subtle uppercase tracking-wider text-xs">Carried Forward To:</span>
                      <span className="text-indigo-700 font-bold bg-indigo-50 px-3 py-1 rounded border border-indigo-100 flex items-center gap-1.5 text-sm">
                        <FaShare className="text-xs" />
                        {viewPlan.carryForwardTo[0].dailyPlanId}
                        <span className="text-indigo-400 font-normal ml-1">({viewPlan.carryForwardTo[0].productionDate?.split('T')[0]})</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 border border-line rounded-xl bg-card-2 text-center">
              <FaClipboardList className="text-ink-subtle mb-3" size={40} />
              <span className="text-ink-subtle font-medium text-base">No hourly entries recorded yet for this plan.</span>
            </div>
          )}
        </div>

        {/* ── Daily Target vs Actual Comparison ── */}
        {viewHourlyLogs.length > 0 && (
          <div>
            <h6 className="text-sm font-bold text-ink-muted uppercase tracking-wider mb-4">Target vs Actual Comparison</h6>
            <div className="border border-line rounded-xl overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-card-2 border-b border-line">
                    <th className="px-5 py-3 text-left text-xs font-bold text-ink-subtle uppercase tracking-wider">Machine</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-ink-subtle uppercase tracking-wider">Product</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-ink-subtle uppercase tracking-wider">Capacity</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-ink-subtle uppercase tracking-wider">Produced</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-ink-subtle uppercase tracking-wider">Pending</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-ink-subtle uppercase tracking-wider">Efficiency</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-ink-subtle uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(() => {
                    const capacity = Number(viewPlan.plannedQty || 0);
                    const totalProduced = Array.isArray(viewPlan.hourlyProductions)
                      ? viewPlan.hourlyProductions.reduce((s: number, h: any) => s + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0) - Number(h.scrapQty || 0)), 0)
                      : 0;
                    const pending = Math.max(0, capacity - totalProduced);
                    const efficiency = capacity > 0 ? ((totalProduced / capacity) * 100).toFixed(0) : "0";
                    const shortfallPct = capacity > 0 ? ((capacity - totalProduced) / capacity) * 100 : 0;
                    
                    let statusText = "";
                    let customColor = { bg: "", text: "" };

                    if (shortfallPct <= 0) {
                       statusText = "Highest";
                       customColor = { bg: '#d1fae5', text: '#065f46' };
                    } else if (shortfallPct <= 15) {
                       statusText = "Medium";
                       customColor = { bg: '#fef3c7', text: '#b45309' };
                    } else {
                       statusText = "Low";
                       customColor = { bg: '#fee2e2', text: '#b91c1c' };
                    }
                    
                    return (
                      <tr>
                        <td className="px-5 py-4 text-ink-muted font-medium">
                          {viewPlan.machine?.machineName || viewPlan.machineId || "—"}
                        </td>
                        <td className="px-5 py-4 text-ink-muted">
                          {viewPlan.productionOrder?.productItem?.productName || "—"}
                        </td>
                        <td className="px-5 py-4 text-center text-ink-muted font-bold text-base">{capacity}</td>
                        <td className="px-5 py-4 text-center text-emerald-600 font-bold text-base">{totalProduced}</td>
                        <td className="px-5 py-4 text-center text-amber-600 font-bold text-base">{pending}</td>
                        <td className="px-5 py-4 text-center text-indigo-600 font-bold text-base">{efficiency}%</td>
                        <td className="px-5 py-4 text-center">
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

        {/* ── Production Order History ── */}
        <div className="border border-line-soft rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 bg-card-2 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaClipboardList className="text-ink-subtle" size={16} />
              <h3 className="font-bold text-ink m-0">Production Order History</h3>
              <span className="text-xs text-ink-subtle font-mono bg-line/50 px-2 py-0.5 rounded border border-line">
                {viewPlan.productionOrderId}
              </span>
            </div>
            {!loadingPOHistory && (
              <span className="text-xs text-ink-subtle bg-line/50 px-3 py-1 rounded font-medium">
                {poHistoryPlans.length} plan{poHistoryPlans.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loadingPOHistory ? (
            <div className="flex items-center justify-center gap-2 py-8 bg-card-2 text-ink-subtle text-sm">
              <div className="w-5 h-5 border-2 border-line border-t-transparent rounded-full animate-spin" />
              Loading history...
            </div>
          ) : poHistoryPlans.length > 0 ? (
            <div className="flex flex-col">
              <DataTable
                columns={poHistoryColumns}
                data={poHistoryPlans}
                rowKey={(row) => row.dailyPlanId}
                emptyMessage="No records found."
                minHeightClassName="min-h-0"
                density="compact"
                rowClassName={(row) => row.dailyPlanId === viewPlan.dailyPlanId ? "bg-indigo-50/60 border-l-2 border-l-indigo-500" : ""}
              />
              <div className="flex items-center justify-between bg-card-2 border-t border-line px-5 py-4">
                <div className="text-sm font-bold text-ink-muted">Total</div>
                <div className="flex gap-10 md:gap-20 items-center pr-20">
                  <div className="text-center text-sm font-bold text-ink">
                    Planned: {poHistoryPlans.reduce((s: number, p: any) => s + Number(p.plannedQty || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-center text-sm font-bold text-emerald-700">
                    Produced: {weeklyOrderProducedQty.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 bg-card-2 text-center">
              <FaCalendarAlt className="text-ink-subtle mb-3" size={32} />
              <span className="text-ink-subtle font-medium text-sm">No other daily plans found for this production order.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DailyPlanViewPage;
