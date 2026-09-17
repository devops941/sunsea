import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaExternalLinkAlt } from "react-icons/fa";
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

  const columns: DataTableColumn<HourlyEntryItem>[] = useMemo(
    () => [
      {
        header: "HOUR",
        align: "center",
        width: "60px",
        render: (entry) => (
          <span className="font-mono text-xs font-bold text-ink-subtle">
            H{entry.hourIndex}
          </span>
        ),
      },
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
    [row]
  );

  if (!row) return null;

  const totalShots = row.hourlyEntries.reduce((s, e) => s + Number(e.qtyProduced || 0), 0);
  const totalReject = row.hourlyEntries.reduce((s, e) => s + Number(e.rejectQty || 0), 0);
  const totalPerfect = row.hourlyEntries.reduce(
    (s, e) =>
      s +
      (e.goodQty !== undefined
        ? Number(e.goodQty)
        : Math.max(0, Number(e.qtyProduced || 0) - Number(e.rejectQty || 0))),
    0
  );
  const totalDowntime = row.hourlyEntries.reduce((s, e) => s + Number(e.downtime || 0), 0);

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
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
              Hourly Entry Records (Hour 1 to Hour 12)
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
            <div className="px-5 py-2.5 bg-card-2 border-t-2 border-line flex flex-wrap justify-between items-center text-xs font-medium text-ink">
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
