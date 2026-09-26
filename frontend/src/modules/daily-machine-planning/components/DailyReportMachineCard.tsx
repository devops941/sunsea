// daily report card 
import React, { useMemo } from "react";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { getPlanStatusInfo } from "../../../utils/planningUtils";

export interface HourlyEntryItem {
  hourIndex: number;
  timeSlot?: string;
  startHour24?: number;
  endHour24?: number;
  operatorName?: string;
  operationName?: string;
  qtyProduced?: number | "";
  rejectQty?: number | "";
  goodQty?: number | "";
  wastageWeight?: number | "";
  wastageUom?: string;
  downtime?: number | "";
  downtimeReason?: string;
  reasonDescription?: string;
  remarks?: string;
  perfectWeight?: string | number;
}

export interface ReportRow {
  id: string;
  dailyPlanId?: string;
  hourlyProductionId?: string;
  machineId: string;
  machineName: string;
  machineCode?: string;
  shiftId: string;
  shiftName: string;
  shiftTime?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  productionOrderId: string;
  productionOrderNumber: string;
  productName: string;
  productCode?: string;
  uom?: string;
  operatorName: string;
  shotCounter: number;
  plannedCapacity: number;
  actualProduction: number;
  rejectedPcs: number;
  perfectPcs: number;
  rejectedWeight: string;
  perfectWeight: string;
  downtimeMinutes: number;
  remarks: string;
  efficiency: string;
  status: string;
  statusColor?: { bg: string; text: string };
  planStatus: string;
  hourlyEntries: HourlyEntryItem[];
  wastages?: any[];
}

export function formatHourAmPm(hour24: number): string {
  const h = hour24 % 24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:00 ${ampm}`;
}

export function formatHourRange(hourIndex: number, shiftStartTime?: string, shiftName?: string): string {
  let startHour = 9;
  if (shiftStartTime) {
    const parts = shiftStartTime.trim().split(":");
    const parsed = parseInt(parts[0], 10);
    if (!isNaN(parsed)) startHour = parsed;
  } else if (shiftName) {
    const sLow = shiftName.toLowerCase();
    if (sLow.includes("night")) {
      startHour = 21; // 9:00 PM
    } else if (sLow.includes("evening")) {
      startHour = 17; // 5:00 PM
    } else if (sLow.includes("afternoon")) {
      startHour = 14; // 2:00 PM
    } else if (sLow.includes("morning") || sLow.includes("day")) {
      startHour = 9; // 9:00 AM
    }
  }

  const slotStartH = (startHour + (hourIndex - 1)) % 24;
  const slotEndH = (startHour + hourIndex) % 24;
  return `${formatHourAmPm(slotStartH)} – ${formatHourAmPm(slotEndH)}`;
}

interface DailyReportMachineCardProps {
  machineName: string;
  machineCode?: string;
  rows: ReportRow[];
  selectedDate: string;
  onViewRow: (row: ReportRow) => void;
}

const DailyReportMachineCard: React.FC<DailyReportMachineCardProps> = ({
  machineName,
  machineCode: _machineCode,
  rows,
  selectedDate,
  onViewRow,
}) => {
  const columns: DataTableColumn<ReportRow>[] = useMemo(
    () => [
      {
        header: "SHIFT",
        render: (row) => (
          <span className="font-semibold text-ink uppercase text-xs">
            {row.shiftName}
          </span>
        ),
      },
      {
        header: "NAME (OPERATOR)",
        render: (row) => (
          <span className="font-medium text-ink text-xs">
            {row.operatorName}
          </span>
        ),
      },
      {
        header: "TIME (IN / OUT)",
        render: (row) => (
          <span className="font-mono text-xs text-ink-subtle whitespace-nowrap">
            {row.shiftTime || "09:00 – 21:00"}
          </span>
        ),
      },
      {
        header: "PRODUCT NAME",
        render: (row) => (
          <div>
            <span className="font-semibold text-ink block text-xs">
              {row.productName}
            </span>
            <span className="text-[11px] text-ink-subtle font-mono">
              PO: {row.productionOrderNumber}
            </span>
          </div>
        ),
      },
      {
        header: "TARGET COUNT",
        align: "right",
        render: (row) => (
          <span className="font-mono text-ink-subtle text-xs">
            {row.shotCounter.toLocaleString()}
          </span>
        ),
      },
      {
        header: "REJECTED PCS.",
        align: "right",
        render: (row) => (
          <span
            className={`font-mono text-xs ${
              row.rejectedPcs > 0
                ? "text-rose-600 dark:text-rose-400 font-bold"
                : "text-ink-subtle"
            }`}
          >
            {row.rejectedPcs.toLocaleString()}
          </span>
        ),
      },
      {
        header: "PERFECT PCS.",
        align: "right",
        render: (row) => (
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
            {row.perfectPcs.toLocaleString()}
          </span>
        ),
      },
      {
        header: "REJECTED PCS. WT",
        align: "right",
        render: (row) => (
          <span className="font-mono text-ink-subtle text-xs">
            {row.rejectedWeight}
          </span>
        ),
      },
      {
        header: "EFFICIENCY",
        align: "center",
        render: (row) => {
          const cap = Number(row.plannedCapacity || row.shotCounter || 0);
          const produced = Number(row.perfectPcs !== undefined ? row.perfectPcs : row.actualProduction || 0);
          const effNum = cap > 0 ? Math.round((produced / cap) * 100) : 0;
          return (
            <span className="font-mono font-bold text-xs text-indigo-500 dark:text-indigo-400">
              {row.efficiency ? `${Math.round(Number(row.efficiency))}%` : `${effNum}%`}
            </span>
          );
        },
      },
      {
        header: "STATUS",
        align: "center",
        width: "110px",
        render: (row) => {
          const cap = Number(row.plannedCapacity || row.shotCounter || 0);
          const produced = Number(row.perfectPcs !== undefined ? row.perfectPcs : row.actualProduction || 0);
          if (cap === 0 && produced === 0) {
            return <span className="text-ink-subtle font-mono text-xs">—</span>;
          }
          const { statusText, customColor } = getPlanStatusInfo(cap, produced);
          return (
            <StatusBadge
              status="CUSTOM"
              customText={row.status && row.status !== "—" ? row.status : statusText}
              customColor={row.statusColor || customColor}
            />
          );
        },
      },
      {
        header: "REMARKS",
        render: (row) => (
          <div className="max-w-[220px] truncate text-xs text-ink-subtle" title={row.remarks}>
            {row.downtimeMinutes > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold mr-1">
                [{row.downtimeMinutes}m DT]
              </span>
            )}
            <span>{row.remarks}</span>
          </div>
        ),
      },
      {
        header: "ACTION",
        align: "center",
        width: "60px",
        render: (row) => (
          <div className="flex items-center justify-center">
            <ViewButton onClick={() => onViewRow(row)} />
          </div>
        ),
      },
    ],
    [onViewRow]
  );

  const totalPerfect = rows.reduce((sum, r) => sum + r.perfectPcs, 0);
  const totalRejected = rows.reduce((sum, r) => sum + r.rejectedPcs, 0);
  const totalTarget = rows.reduce((sum, r) => sum + r.shotCounter, 0);

  return (
    <div className="border border-line rounded-xl overflow-hidden shadow-xs bg-card">
      {/* ── Machine Section Header Bar ── */}
      <div className="px-5 py-3 bg-card-2 border-b border-line flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
            MACHINE - {machineName}
          </h3>
        </div>

        <div className="flex items-center gap-3 text-xs text-ink-subtle">
          <span>
            Date: <strong className="text-ink font-semibold">{selectedDate}</strong>
          </span>
          <span className="text-line-soft">·</span>
          <span className="font-medium text-ink-subtle">
            {rows.length} {rows.length === 1 ? "Entry" : "Entries"}
          </span>
        </div>
      </div>

      {/* ── Machine Log Sheet Table using DataTable Component ── */}
      <DataTable<ReportRow>
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        minHeightClassName="min-h-0"
        density="compact"
        onRowClick={(row) => onViewRow(row)}
        className="border-none"
      />

      {/* ── Machine Sub-total Footer ── */}
      <div className="px-5 py-2.5 bg-card-2/60 border-t border-line flex flex-wrap justify-between items-center text-xs font-medium text-ink-subtle">
        <div className="flex items-center gap-3">
          <span>
            Output:{" "}
            <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
              {totalPerfect.toLocaleString()} Perfect Pcs
            </strong>
          </span>
          <span className="text-line-soft">·</span>
          <span>
            Rejections:{" "}
            <strong className="text-rose-600 dark:text-rose-400 font-mono font-bold">
              {totalRejected.toLocaleString()} Pcs
            </strong>
          </span>
        </div>
        <div>
          <span>
            Target:{" "}
            <strong className="text-ink font-mono font-bold">
              {totalTarget.toLocaleString()} Pcs
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};

export default DailyReportMachineCard;
