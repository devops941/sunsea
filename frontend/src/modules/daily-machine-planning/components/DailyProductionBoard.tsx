import React from "react";
import { FaIndustry } from "react-icons/fa";

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export type DayName = (typeof DAY_NAMES)[number];

export const SHIFT_SLOTS = ["DAY", "NIGHT"] as const;
export type ShiftSlot = (typeof SHIFT_SLOTS)[number];

export const shortDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export const RM_ISSUED_DOT = "bg-violet-500 ring-1 ring-violet-400/50";

export const STATUS_BOARD_DOT: Record<string, string> = {
  DRAFT: "bg-amber-500",
  PLANNED: "bg-sky-500",
  IN_PROGRESS: "bg-indigo-500 ring-1 ring-indigo-400/40",
  COMPLETED: "bg-emerald-500 ring-1 ring-emerald-400/50",
  STOPPED: "bg-rose-500 ring-1 ring-rose-400/50",
  SHORT_CLOSED: "bg-rose-500 ring-1 ring-rose-400/50",
  CANCELLED: "bg-red-500",
  POST_PRODUCTION: "bg-purple-500 ring-1 ring-purple-400/50",
};

export const calcProduced = (plan: any): number => {
  if (!Array.isArray(plan?.hourlyProductions) || plan.hourlyProductions.length === 0) return 0;
  return plan.hourlyProductions.reduce((s: number, h: any) => {
    if (h.totalQtyProduced !== undefined) {
      return s + Math.max(0, Number(h.totalQtyProduced || 0) - Number(h.totalRejectQty || 0));
    }
    return s + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0));
  }, 0);
};

export const countLoggedEntries = (plan: any): number => {
  if (!Array.isArray(plan?.hourlyProductions) || plan.hourlyProductions.length === 0) return 0;
  let count = 0;
  plan.hourlyProductions.forEach((hp: any) => {
    if (Array.isArray(hp.hourlyEntries)) {
      count += hp.hourlyEntries.filter(
        (e: any) =>
          Number(e.hourIndex) > 0 &&
          (Number(e.qtyProduced || 0) > 0 || Number(e.downtime || 0) > 0 || Boolean(e.downtimeReason))
      ).length;
    } else if (Number(hp.hourIndex) > 0) {
      count += 1;
    }
  });
  return count;
};

export const hasDraftHourly = (plan: any): boolean => {
  const statusStr = String(plan?.status || "").toUpperCase();
  if (["COMPLETED", "STOPPED", "CANCELLED", "SHORT_CLOSED", "POST_PRODUCTION"].includes(statusStr)) {
    return false;
  }
  if (!Array.isArray(plan?.hourlyProductions) || plan.hourlyProductions.length === 0) return false;
  if (countLoggedEntries(plan) > 0 && statusStr === "DRAFT") return true;
  return plan.hourlyProductions.some((hp: any) => {
    if (hp.status === "DRAFT") return true;
    if (Array.isArray(hp.hourlyEntries) && hp.hourlyEntries.length > 0 && statusStr === "DRAFT") return true;
    return false;
  });
};

interface DailyPlanCardProps {
  plan: any;
  dayDate: string;
  rmIssuedDates: Set<string>;
  onClick: (plan: any) => void;
  onContextMenu: (e: React.MouseEvent, plan: any) => void;
}

export const DailyPlanCard: React.FC<DailyPlanCardProps> = ({
  plan,
  dayDate,
  rmIssuedDates,
  onClick,
  onContextMenu,
}) => {
  const produced = calcProduced(plan);
  const planned = Number(plan.plannedQty || 0);
  const pct = planned > 0 ? Math.min(100, Math.round((produced / planned) * 100)) : 0;
  const loggedCount = countLoggedEntries(plan);
  const isCompleted = plan.status === "COMPLETED";
  const isStopped = plan.status === "STOPPED" || plan.status === "SHORT_CLOSED" || plan.status === "CANCELLED";
  const isPostProd = plan.status === "POST_PRODUCTION";
  const isDraft = !isCompleted && !isStopped && !isPostProd && (plan.status === "DRAFT" || hasDraftHourly(plan));
  const isInProgress = !isCompleted && !isStopped && !isPostProd && !isDraft && (plan.status === "IN_PROGRESS" || pct > 0);

  // Status-aware colors for high contrast in both Light and Dark themes
  const cardStyles = isCompleted
    ? {
        card: "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 shadow-xs hover:border-emerald-500",
        po: "text-emerald-800 dark:text-emerald-300",
        title: "text-emerald-950 dark:text-emerald-100",
        pcs: "text-emerald-800/80 dark:text-emerald-300/80",
        pct: "text-emerald-700 dark:text-emerald-400",
        track: "bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/30",
        bar: "bg-emerald-500",
      }
    : isStopped
    ? {
        card: "bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/40 shadow-xs hover:border-rose-500",
        po: "text-rose-800 dark:text-rose-300",
        title: "text-rose-950 dark:text-rose-100",
        pcs: "text-rose-800/80 dark:text-rose-300/80",
        pct: "text-rose-700 dark:text-rose-400",
        track: "bg-rose-100 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/30",
        bar: "bg-rose-500",
      }
    : isPostProd
    ? {
        card: "bg-purple-50/90 dark:bg-purple-950/40 border-purple-300 dark:border-purple-500/40 shadow-xs hover:border-purple-500",
        po: "text-purple-800 dark:text-purple-300",
        title: "text-purple-950 dark:text-purple-100",
        pcs: "text-purple-800/80 dark:text-purple-300/80",
        pct: "text-purple-700 dark:text-purple-300",
        track: "bg-purple-100 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/30",
        bar: "bg-purple-500",
      }
    : isDraft
    ? {
        card: "bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/40 shadow-xs hover:border-amber-500",
        po: "text-amber-800 dark:text-amber-300",
        title: "text-amber-950 dark:text-amber-100",
        pcs: "text-amber-800/80 dark:text-amber-300/80",
        pct: "text-amber-700 dark:text-amber-400",
        track: "bg-amber-100 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/30",
        bar: "bg-amber-500",
      }
    : isInProgress
    ? {
        card: "bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-500/40 shadow-xs hover:border-indigo-500",
        po: "text-indigo-800 dark:text-indigo-300",
        title: "text-indigo-950 dark:text-indigo-100",
        pcs: "text-indigo-800/80 dark:text-indigo-300/80",
        pct: "text-indigo-700 dark:text-indigo-400",
        track: "bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/30",
        bar: "bg-indigo-500",
      }
    : {
        card: "bg-white dark:bg-card border-slate-200 dark:border-line shadow-xs hover:border-primary/50 hover:bg-slate-50/60 dark:hover:bg-card-2/80",
        po: "text-slate-500 dark:text-ink-subtle",
        title: "text-slate-900 dark:text-ink",
        pcs: "text-slate-600 dark:text-ink-subtle",
        pct: "text-slate-800 dark:text-ink",
        track: "bg-slate-100 dark:bg-card-2 border border-slate-200/70 dark:border-line-soft",
        bar: "bg-sky-500",
      };

  const dot = isCompleted
    ? "bg-emerald-500 ring-1 ring-emerald-400/50"
    : isStopped
    ? "bg-rose-500 ring-1 ring-rose-400/50"
    : isPostProd
    ? "bg-purple-500 ring-1 ring-purple-400/50"
    : isDraft
    ? "bg-amber-500"
    : isInProgress
    ? "bg-indigo-500 ring-1 ring-indigo-400/40"
    : rmIssuedDates.has(dayDate)
    ? RM_ISSUED_DOT
    : STATUS_BOARD_DOT[plan.status] ?? "bg-slate-400";

  return (
    <div
      onClick={() => onClick(plan)}
      onContextMenu={(e) => onContextMenu(e, plan)}
      className={`plan-card rounded-lg px-2.5 py-2 cursor-pointer transition-all duration-150 border select-none ${cardStyles.card}`}
    >
      <div className="flex items-center justify-between mb-1 gap-1">
        <span className={`text-[9px] font-mono font-bold truncate flex-1 ${cardStyles.po}`}>
          {plan.productionOrderId}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isDraft && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 shadow-xs"
              title={`Draft Saved (${loggedCount} hours recorded)`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Draft{loggedCount > 0 ? ` (${loggedCount}h)` : ""}
            </span>
          )}

          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`}
            title={
              isCompleted
                ? "Production Completed (100%)"
                : isStopped
                ? "Production Stopped"
                : isPostProd
                ? "Post Production"
                : isDraft
                ? "Draft Saved"
                : rmIssuedDates.has(dayDate)
                ? "RM Issued"
                : `Status: ${plan.status}`
            }
          />
        </div>
      </div>

      <div className={`text-[11px] font-bold leading-tight line-clamp-1 mb-1.5 ${cardStyles.title}`}>
        {plan.productionOrder?.productItem?.productName || "—"}
      </div>

      <div className="flex items-center justify-between gap-1 mb-1">
        <span className={`text-[9.5px] ${cardStyles.pcs}`}>
          {planned.toLocaleString("en-IN")} pcs
        </span>
        <span className={`text-[10px] font-extrabold ${cardStyles.pct}`}>
          {pct}%
        </span>
      </div>

      <div className={`w-full h-1.5 rounded-full overflow-hidden ${cardStyles.track}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${cardStyles.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export interface DailyProductionBoardProps {
  allowedMachines: any[];
  filteredDays: readonly DayName[];
  dayDates: Record<DayName, string>;
  boardMap: Record<string, Record<DayName, Record<ShiftSlot, any[]>>>;
  rmIssuedDates: Set<string>;
  onCardClick: (plan: any) => void;
  onContextMenu: (e: React.MouseEvent, plan: any) => void;
}

export const DailyProductionBoard: React.FC<DailyProductionBoardProps> = ({
  allowedMachines,
  filteredDays,
  dayDates,
  boardMap,
  rmIssuedDates,
  onCardClick,
  onContextMenu,
}) => {
  return (
    <div className="flex-1 overflow-auto px-6 pb-6 pt-2">
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-line-soft bg-white dark:bg-card shadow-xs">
        <table
          className="border-collapse text-xs w-full"
          style={{
            minWidth: filteredDays.length === 1 ? "420px" : `${Math.max(900, filteredDays.length * 240)}px`,
          }}
        >
          <thead className="sticky top-0 z-20">
            {/* Top Date Header */}
            <tr className="bg-slate-100/90 dark:bg-card-2 border-b border-slate-200 dark:border-line">
              <th className="px-3 py-3 text-center text-[10.5px] font-extrabold text-slate-700 dark:text-ink-subtle uppercase tracking-wider w-32 border-r border-slate-200 dark:border-line sticky left-0 bg-slate-100/95 dark:bg-card-2 z-30">
                Machine
              </th>
              {filteredDays.map((day) => (
                <th
                  key={day}
                  colSpan={2}
                  className="px-3 py-2.5 text-center border-r border-slate-200 dark:border-line"
                >
                  <div className="text-slate-900 dark:text-ink font-extrabold text-xs uppercase tracking-wider">
                    {day.slice(0, 3)}
                  </div>
                  <div className="text-slate-500 dark:text-ink-subtle font-semibold text-[10.5px]">
                    {shortDate(dayDates[day])}
                  </div>
                </th>
              ))}
            </tr>

            {/* Shift Subheaders (Day / Night) */}
            <tr className="bg-slate-50 dark:bg-card-2/80 border-b border-slate-200 dark:border-line">
              <th className="sticky left-0 bg-slate-50 dark:bg-card-2/80 z-30 border-r border-slate-200 dark:border-line" />
              {filteredDays.flatMap((day) =>
                SHIFT_SLOTS.map((slot) => {
                  const isDay = slot === "DAY";
                  return (
                    <th
                      key={`${day}-${slot}`}
                      className={`px-2 py-1.5 text-center text-[9.5px] font-bold uppercase tracking-wider ${
                        isDay
                          ? "bg-amber-50/50 dark:bg-amber-950/15 text-amber-800 dark:text-amber-300 border-r border-dashed border-slate-200 dark:border-line-soft/40"
                          : "bg-indigo-50/50 dark:bg-indigo-950/15 text-indigo-800 dark:text-indigo-300 border-r border-slate-200 dark:border-line"
                      }`}
                    >
                      {isDay ? "☀ Day" : "☾ Night"}
                    </th>
                  );
                })
              )}
            </tr>
          </thead>

          <tbody>
            {allowedMachines.length === 0 ? (
              <tr>
                <td colSpan={1 + filteredDays.length * 2} className="py-16 text-center text-slate-400 dark:text-ink-subtle text-sm">
                  <FaIndustry className="mx-auto mb-2 opacity-30" size={32} /> No machines found
                </td>
              </tr>
            ) : (
              allowedMachines.map((machine: any, mIdx: number) => {
                const machinePlans = boardMap[machine.machineId];
                const rowBg = mIdx % 2 === 0 ? "bg-white dark:bg-card" : "bg-slate-50/40 dark:bg-card-2/20";
                return (
                  <tr
                    key={machine.machineId}
                    className={`${rowBg} border-b border-slate-200/80 dark:border-line-soft/40 hover:bg-primary/5 transition-colors group`}
                  >
                    {/* Machine Name Sticky Column */}
                    <td
                      className={`px-3 py-3 border-r border-slate-200 dark:border-line sticky left-0 ${rowBg} z-10 align-middle text-center group-hover:bg-slate-50 dark:group-hover:bg-primary/10 transition-colors`}
                    >
                      <div className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/60 shadow-xs w-full">
                        <span className="font-extrabold text-slate-800 dark:text-ink text-xs capitalize tracking-wide">
                          {machine.machineName}
                        </span>
                      </div>
                    </td>

                    {/* Day & Night Shift Cells */}
                    {filteredDays.flatMap((day) =>
                      SHIFT_SLOTS.map((slot) => {
                        const cellPlans: any[] = machinePlans?.[day]?.[slot] ?? [];
                        const isNight = slot === "NIGHT";
                        return (
                          <td
                            key={`${day}-${slot}`}
                            className={`px-1.5 py-2 align-top ${
                              isNight
                                ? "border-r border-slate-200 dark:border-line"
                                : "border-r border-dashed border-slate-200/80 dark:border-line-soft/40"
                            }`}
                            style={{ verticalAlign: "top", minWidth: filteredDays.length === 1 ? "160px" : "115px" }}
                          >
                            {cellPlans.length === 0 ? (
                              <div className="board-empty-cell h-16 rounded-lg border border-dashed border-slate-200 dark:border-line-soft/40 bg-slate-50/30 dark:bg-card-2/10 flex items-center justify-center">
                                <span className="text-[10px] text-slate-300 dark:text-ink-subtle/25 font-semibold">—</span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {cellPlans.map((plan: any) => (
                                  <DailyPlanCard
                                    key={plan.dailyPlanId}
                                    plan={plan}
                                    dayDate={dayDates[day]}
                                    rmIssuedDates={rmIssuedDates}
                                    onClick={onCardClick}
                                    onContextMenu={onContextMenu}
                                  />
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DailyProductionBoard;
