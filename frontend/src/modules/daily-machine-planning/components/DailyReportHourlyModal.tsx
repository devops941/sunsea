import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaExternalLinkAlt, FaUsers, FaCogs } from "react-icons/fa";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import CustomButton from "../../../components/ui/Button/Button";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import type { ReportRow, HourlyEntryItem } from "./DailyReportMachineCard";
import { formatHourRange } from "./DailyReportMachineCard";

interface DailyReportHourlyModalProps {
  row: ReportRow | null;
  selectedDate: string;
  onClose: () => void;
}

const DailyReportHourlyModal: React.FC<DailyReportHourlyModalProps> = ({
  row,
  selectedDate,
  onClose,
}) => {
  const navigate = useNavigate();

  const hasOperationCol = useMemo(() => {
    return Boolean(row?.hourlyEntries?.some((e) => Boolean(e.operationName && e.operationName !== "—")));
  }, [row]);

  const columns: DataTableColumn<HourlyEntryItem>[] = useMemo(
    () => [
      {
        header: "TIME SLOT (HOURS)",
        render: (entry) => (
          <span className="font-mono text-xs font-semibold text-ink whitespace-nowrap">
            {entry.timeSlot || formatHourRange(entry.hourIndex, row?.shiftStartTime, row?.shiftName)}
          </span>
        ),
      },
      {
        header: "OPERATOR",
        render: (entry) => (
          <span className="font-medium text-ink text-xs">
            {entry.operatorName || row?.operatorName || "—"}
          </span>
        ),
      },
      ...(hasOperationCol
        ? [
            {
              header: "OPERATION",
              render: (entry: HourlyEntryItem) => (
                <span className="font-medium text-ink text-xs">
                  {entry.operationName || "—"}
                </span>
              ),
            },
          ]
        : []),
      {
        header: "SHOT COUNT",
        align: "right",
        render: (entry) => (
          <span className="font-mono font-medium text-ink text-xs">
            {entry.qtyProduced !== "" && entry.qtyProduced !== undefined
              ? Number(entry.qtyProduced).toLocaleString()
              : 0}
          </span>
        ),
      },
      {
        header: "REJECTED",
        align: "right",
        render: (entry) => (
          <span
            className={`font-mono text-xs ${
              Number(entry.rejectQty || 0) > 0
                ? "text-rose-600 dark:text-rose-400 font-bold"
                : "text-ink-subtle"
            }`}
          >
            {Number(entry.rejectQty || 0)}
          </span>
        ),
      },
      {
        header: "PERFECT PCS",
        align: "right",
        render: (entry) => {
          const val =
            entry.goodQty !== "" && entry.goodQty !== undefined
              ? Number(entry.goodQty)
              : Number(entry.qtyProduced || 0) - Number(entry.rejectQty || 0);
          return (
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
              {val.toLocaleString()}
            </span>
          );
        },
      },
      {
        header: "DOWNTIME",
        align: "center",
        render: (entry) =>
          Number(entry.downtime || 0) > 0 ? (
            <span className="text-amber-600 dark:text-amber-400 font-bold font-mono text-xs">
              {entry.downtime} min
            </span>
          ) : (
            <span className="text-ink-subtle font-mono text-xs">—</span>
          ),
      },
      {
        header: "DOWNTIME REASON / REMARKS",
        render: (entry) =>
          entry.downtimeReason || entry.remarks ? (
            <span className="text-xs text-ink-subtle">
              {entry.downtimeReason && (
                <span className="text-amber-600 dark:text-amber-400 font-medium mr-1">
                  [{entry.downtimeReason}]
                </span>
              )}
              {entry.remarks}
            </span>
          ) : (
            <span className="text-ink-subtle text-xs">—</span>
          ),
      },
    ],
    [row, hasOperationCol]
  );

  const totalShots = (row?.hourlyEntries || []).reduce((s, e) => s + Number(e.qtyProduced || 0), 0);
  const totalReject = (row?.hourlyEntries || []).reduce((s, e) => s + Number(e.rejectQty || 0), 0);
  const totalPerfect = (row?.hourlyEntries || []).reduce(
    (s, e) =>
      s +
      (e.goodQty !== undefined
        ? Number(e.goodQty)
        : Math.max(0, Number(e.qtyProduced || 0) - Number(e.rejectQty || 0))),
    0
  );
  const totalDowntime = (row?.hourlyEntries || []).reduce((s, e) => s + Number(e.downtime || 0), 0);

  // Operator-wise production aggregation
  const operatorBreakdown = useMemo(() => {
    if (!row?.hourlyEntries?.length) return [];
    const map = new Map<string, {
      name: string;
      hoursCount: number;
      hoursList: number[];
      shots: number;
      reject: number;
      perfect: number;
      downtime: number;
    }>();

    row.hourlyEntries.forEach((e) => {
      const opName = (e.operatorName || row.operatorName || "—").trim();
      if (!opName || opName === "—") return;
      if (!map.has(opName)) {
        map.set(opName, {
          name: opName,
          hoursCount: 0,
          hoursList: [],
          shots: 0,
          reject: 0,
          perfect: 0,
          downtime: 0,
        });
      }
      const item = map.get(opName)!;
      item.hoursCount += 1;
      item.hoursList.push(e.hourIndex);
      item.shots += Number(e.qtyProduced || 0);
      item.reject += Number(e.rejectQty || 0);
      const perf =
        e.goodQty !== "" && e.goodQty !== undefined
          ? Number(e.goodQty)
          : Math.max(0, Number(e.qtyProduced || 0) - Number(e.rejectQty || 0));
      item.perfect += perf;
      item.downtime += Number(e.downtime || 0);
    });

    return Array.from(map.values());
  }, [row]);

  // Operation-wise production aggregation (if operation names exist)
  const operationBreakdown = useMemo(() => {
    if (!row?.hourlyEntries?.length) return [];
    const hasAnyOp = row.hourlyEntries.some((e: any) => Boolean(e.operationName && e.operationName !== "—"));
    if (!hasAnyOp) return [];

    const map = new Map<string, {
      name: string;
      hoursCount: number;
      shots: number;
      reject: number;
      perfect: number;
    }>();

    row.hourlyEntries.forEach((e: any) => {
      const opName = String(e.operationName || "").trim();
      if (!opName || opName === "—") return;
      if (!map.has(opName)) {
        map.set(opName, { name: opName, hoursCount: 0, shots: 0, reject: 0, perfect: 0 });
      }
      const item = map.get(opName)!;
      item.hoursCount += 1;
      item.shots += Number(e.qtyProduced || 0);
      item.reject += Number(e.rejectQty || 0);
      const perf =
        e.goodQty !== "" && e.goodQty !== undefined
          ? Number(e.goodQty)
          : Math.max(0, Number(e.qtyProduced || 0) - Number(e.rejectQty || 0));
      item.perfect += perf;
    });

    return Array.from(map.values());
  }, [row]);

  // Columns for Operator-wise Breakdown Table
  const operatorColumns: DataTableColumn<{
    name: string;
    hoursCount: number;
    hoursList: number[];
    shots: number;
    reject: number;
    perfect: number;
    downtime: number;
  }>[] = useMemo(
    () => [
      {
        header: "OPERATOR",
        render: (op, idx) => (
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-black text-[10px] flex items-center justify-center shrink-0">
              {idx !== undefined ? idx + 1 : 1}
            </span>
            <div>
              <span className="text-[10px] text-ink-subtle uppercase font-bold block leading-tight">
                Operator {idx !== undefined ? idx + 1 : 1}
              </span>
              <span className="font-bold text-ink text-xs block leading-tight">
                {op.name}
              </span>
            </div>
          </div>
        ),
      },
      {
        header: "ACTIVE HOURS",
        render: (op) => (
          <div>
            <span className="font-semibold text-xs text-ink">
              {op.hoursCount} {op.hoursCount > 1 ? "Hours" : "Hour"}
            </span>
            <span className="text-[10px] text-ink-subtle font-mono block">
              ({op.hoursList.map((h) => `H${h}`).join(", ")})
            </span>
          </div>
        ),
      },
      {
        header: "PRODUCTION SHARE",
        render: (op) => {
          const pct = totalShots > 0 ? ((op.shots / totalShots) * 100).toFixed(1) : "0";
          return (
            <div className="min-w-[120px]">
              <div className="flex items-center justify-between text-[11px] font-mono font-semibold mb-1">
                <span className="text-primary">{pct}%</span>
                <span className="text-ink-subtle">{op.shots.toLocaleString()} pcs</span>
              </div>
              <div className="w-full bg-line-soft rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, Number(pct)))}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        header: "TOTAL SHOTS",
        align: "right",
        render: (op) => (
          <span className="font-mono font-bold text-xs text-ink">
            {op.shots.toLocaleString()}
          </span>
        ),
      },
      {
        header: "REJECTED",
        align: "right",
        render: (op) => (
          <span
            className={`font-mono text-xs ${
              op.reject > 0
                ? "text-rose-600 dark:text-rose-400 font-bold"
                : "text-ink-subtle"
            }`}
          >
            {op.reject.toLocaleString()}
          </span>
        ),
      },
      {
        header: "PERFECT PCS",
        align: "right",
        render: (op) => (
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
            {op.perfect.toLocaleString()}
          </span>
        ),
      },
      {
        header: "DOWNTIME",
        align: "center",
        render: (op) =>
          op.downtime > 0 ? (
            <span className="text-amber-600 dark:text-amber-400 font-bold font-mono text-xs">
              {op.downtime} min
            </span>
          ) : (
            <span className="text-ink-subtle font-mono text-xs">—</span>
          ),
      },
    ],
    [totalShots]
  );

  // Columns for Operation-wise Breakdown Table
  const operationColumns: DataTableColumn<{
    name: string;
    hoursCount: number;
    shots: number;
    reject: number;
    perfect: number;
  }>[] = useMemo(
    () => [
      {
        header: "OPERATION",
        render: (op, idx) => (
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-sky-500/15 text-sky-500 font-black text-[10px] flex items-center justify-center shrink-0">
              {idx !== undefined ? idx + 1 : 1}
            </span>
            <div>
              <span className="text-[10px] text-ink-subtle uppercase font-bold block leading-tight">
                Operation {idx !== undefined ? idx + 1 : 1}
              </span>
              <span className="font-bold text-ink text-xs block leading-tight">
                {op.name}
              </span>
            </div>
          </div>
        ),
      },
      {
        header: "ACTIVE HOURS",
        render: (op) => (
          <span className="font-medium text-xs text-ink">
            {op.hoursCount} {op.hoursCount > 1 ? "Hours" : "Hour"}
          </span>
        ),
      },
      {
        header: "TOTAL SHOTS",
        align: "right",
        render: (op) => (
          <span className="font-mono font-bold text-xs text-ink">
            {op.shots.toLocaleString()}
          </span>
        ),
      },
      {
        header: "REJECTED",
        align: "right",
        render: (op) => (
          <span
            className={`font-mono text-xs ${
              op.reject > 0
                ? "text-rose-600 dark:text-rose-400 font-bold"
                : "text-ink-subtle"
            }`}
          >
            {op.reject.toLocaleString()}
          </span>
        ),
      },
      {
        header: "PERFECT PCS",
        align: "right",
        render: (op) => (
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
            {op.perfect.toLocaleString()}
          </span>
        ),
      },
    ],
    []
  );

  if (!row) return null;

  return (
    <CommonModal
      show={!!row}
      onHide={onClose}
      title={
        <div>
          <h3 className="text-sm font-bold text-ink uppercase">
            MACHINE - {row.machineName} · Hourly Production Breakdown
          </h3>
          <p className="text-[11px] text-ink-subtle font-normal mt-0.5">
            {selectedDate} · Shift: {row.shiftName} ({row.shiftTime}) · PO: {row.productionOrderNumber}
          </p>
        </div>
      }
      maxWidth="wide"
      footer={
        <div className="flex justify-between items-center w-full flex-wrap gap-2">
          <div className="text-xs text-ink-subtle">
            Operator(s): <span className="font-semibold text-ink">{row.operatorName}</span>
          </div>
          <div className="flex items-center gap-2">
            {row.dailyPlanId && (
              <CustomButton
                variant="secondary"
                text="Open Hourly Entry Page"
                icon={FaExternalLinkAlt}
                onClick={() => {
                  navigate(`/daily-production-plans/hourly/${row.dailyPlanId}`);
                }}
              />
            )}
            <CustomButton variant="primary" text="Close" onClick={onClose} />
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {/* ── Operator-wise Breakdown (Rendered using reusable DataTable) ── */}
        {operatorBreakdown.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                Operator-wise Breakdown ({operatorBreakdown.length} Operator{operatorBreakdown.length > 1 ? "s" : ""})
              </h4>
              <span className="text-[10px] text-ink-subtle">
                Total Production Count &amp; Quality per Operator
              </span>
            </div>

            <div className="border border-line rounded-xl overflow-hidden bg-card shadow-xs">
              <DataTable
                columns={operatorColumns}
                data={operatorBreakdown}
                rowKey={(op) => op.name}
                minHeightClassName="min-h-0"
                density="compact"
                className="border-none"
              />
            </div>
          </div>
        )}

        {/* ── Operation-wise Breakdown (Rendered using reusable DataTable if operations exist) ── */}
        {operationBreakdown.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <FaCogs className="text-sky-500 text-xs" />
                Operation-wise Breakdown ({operationBreakdown.length} Operation{operationBreakdown.length > 1 ? "s" : ""})
              </h4>
              <span className="text-[10px] text-ink-subtle">
                Total Production Count per Operation Step
              </span>
            </div>

            <div className="border border-line rounded-xl overflow-hidden bg-card shadow-xs">
              <DataTable
                columns={operationColumns}
                data={operationBreakdown}
                rowKey={(op) => op.name}
                minHeightClassName="min-h-0"
                density="compact"
                className="border-none"
              />
            </div>
          </div>
        )}

        {/* ── Hourly Table Section ── */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
              Hourly Entry Records
            </h4>
            <span className="text-xs text-ink-subtle font-mono">
              Shift Timing: {row.shiftTime}
            </span>
          </div>

          <div className="border border-line rounded-xl overflow-hidden bg-card shadow-xs">
            <DataTable<HourlyEntryItem>
              columns={columns}
              data={row.hourlyEntries}
              rowKey={(entry) => entry.hourIndex}
              minHeightClassName="min-h-0"
              density="compact"
              className="border-none"
            />

            {/* Hourly Total Summary Footer */}
            <div className="px-5 py-2.5 bg-card-2 border-t-2 border-line flex flex-wrap justify-between items-center text-xs font-medium text-ink gap-2">
              <div className="text-ink-subtle uppercase font-bold text-[11px]">
                Total Summary:
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span>
                  Shots:{" "}
                  <strong className="font-mono text-ink font-bold">
                    {totalShots.toLocaleString()}
                  </strong>
                </span>
                <span>
                  Reject:{" "}
                  <strong className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                    {totalReject.toLocaleString()}
                  </strong>
                </span>
                <span>
                  Perfect:{" "}
                  <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {totalPerfect.toLocaleString()}
                  </strong>
                </span>
                <span>
                  Downtime:{" "}
                  <strong className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                    {totalDowntime} min
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CommonModal>
  );
};

export default DailyReportHourlyModal;
