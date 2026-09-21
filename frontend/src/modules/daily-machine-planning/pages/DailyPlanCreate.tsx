import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { usePermission } from "../../../hooks/usePermission";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaSave, FaCalendarAlt, FaCheckCircle,
  FaGripVertical, FaTimes, FaExclamationTriangle,
  FaSpinner, FaHistory, FaPencilAlt, FaBan, FaStopCircle,
} from "react-icons/fa";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { productionOrderService } from "../../../services/productionOrderService";
import { productCapacityHistoryService } from "../../../services/productCapacityHistoryService";
import { dailyPlanService } from "../../../services/dailyPlanService";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
type DayName = typeof DAY_NAMES[number];

const SHIFT_SLOTS = [
  { code: "DAY",   label: "Day"   },
  { code: "NIGHT", label: "Night" },
] as const;
type ShiftSlot = "DAY" | "NIGHT";

// Full cell sequence: Mon/Day → Mon/Night → Tue/Day → … → Sat/Night
const CELL_ORDER = DAY_NAMES.flatMap((day) =>
  SHIFT_SLOTS.map(({ code }) => ({ day, shift: code as ShiftSlot }))
);

// Colors for product cards (cycles if more than 16 products)
const CARD_COLORS = [
  "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500",
  "bg-fuchsia-500", "bg-sky-500", "bg-teal-500", "bg-emerald-500",
  "bg-lime-500", "bg-green-500", "bg-orange-500", "bg-amber-500",
  "bg-rose-500", "bg-pink-500", "bg-red-500", "bg-cyan-500",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoardOrder {
  id:               string;  // productionOrderId
  productName:      string;
  productCode:      string;
  productItemId:    string;
  machineId:        string;
  machineName:      string;
  targetQty:        number;
  producedQty:      number;
  plannedElsewhere: number;
  hadPriorPlan:     boolean;
  isOverdue:        boolean;
  isStopped?:       boolean;
  capacityPerShift: number;
  hasHistoricalCapacity: boolean;
  hasCustomCapacity?: boolean;
  uom:              string;
  color:            string;
  status?:          string;
  remarks:          string;
}

interface CellAssignment {
  orderId:     string;
  productName: string;
  qty:         number;
  targetQty:   number;
  color:       string;
  seqNo?:      number;
  status?:     string;
  isStopped?:  boolean;
  stopReason?: string | null;
}

type CellKey = `${string}__${DayName}__${ShiftSlot}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeDateStr = (s: any): string => {
  if (!s) return "";
  if (s instanceof Date) return fmt(s);
  const trimmed = String(s).trim().split("T")[0];
  // If DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[-/]/);
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return trimmed;
};

const snapToMonday = (dateStr: string): string => {
  const normalized = normalizeDateStr(dateStr);
  const d = new Date(normalized + "T00:00:00");
  if (isNaN(d.getTime())) return getTodayMonday();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return fmt(d);
};
const getTodayMonday = (): string => {
  const d = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return fmt(mon);
};
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (base: string, n: number) => {
  const normalized = normalizeDateStr(base);
  const d = new Date(normalized + "T00:00:00");
  d.setDate(d.getDate() + n);
  return fmt(d);
};
const shortDate = (s: string) => {
  const normalized = normalizeDateStr(s);
  return new Date(normalized + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const getShiftSlot = (plan: any): ShiftSlot => {
  const sCode = (plan.shiftId || plan.shift?.shiftCode || plan.shiftCode || "").toUpperCase().trim();
  const sName = (plan.shift?.shiftName || plan.shiftName || "").toLowerCase();

  if (
    sCode === "NIGHT" ||
    sCode.includes("NIGHT") ||
    sCode.includes("EVENING") ||
    sName.includes("night") ||
    sName.includes("evening") ||
    sCode.includes("S2") ||
    sCode.includes("SHT002") ||
    sName.includes("shift 2") ||
    sName.includes("shift-2")
  ) {
    return "NIGHT";
  }
  return "DAY";
};

const cellKey = (m: string, d: DayName, s: ShiftSlot): CellKey => `${m}__${d}__${s}`;

// ─── StatusBadge ──────────────────────────────────────────────────────────────

type PlanStatus = "draft" | "in-progress" | "ready";

const StatusBadge: React.FC<{ status: PlanStatus }> = ({ status }) => {
  const cfg: Record<PlanStatus, { label: string; cls: string }> = {
    "draft":       { label: "DRAFT",       cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/25"           },
    "in-progress": { label: "IN PROGRESS", cls: "bg-primary/10 text-primary border-primary/25"              },
    "ready":       { label: "READY",       cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"  },
  };
  const { label, cls } = cfg[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border ${cls}`}>
      {label}
    </span>
  );
};

// ─── OrderCard ────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order:             BoardOrder;
  remaining:         number;
  allocatedQty:      number;
  isCarriedForward:  boolean;
  isDragging:        boolean;
  isHovered:         boolean;
  onDragStart:       (id: string) => void;
  onMouseEnter:      () => void;
  onMouseLeave:      () => void;
  onClearGroup:      () => void;
  onEditCapacity?:   (order: BoardOrder) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({
  order, remaining, allocatedQty, isCarriedForward, isDragging, isHovered,
  onDragStart, onMouseEnter, onMouseLeave, onClearGroup, onEditCapacity,
}) => {
  const isStopped      = Boolean(
    order.isStopped || 
    ["STOPPED", "COMPLETED_WITH_SHORTFALL", "SHORT_CLOSED", "CANCELLED"].includes((order.status || "").toUpperCase()) ||
    /Permanently Stopped|Short Closed|Stopped:/i.test(order.remarks || "")
  );
  const isComplete     = remaining <= 0 || isStopped;
  const hasAllocations = allocatedQty > 0;
  const remainingPct   = order.targetQty > 0 ? Math.max(0, remaining / order.targetQty) : 0;
  const prodPct        = order.targetQty > 0 ? Math.min(100, Math.round((order.producedQty / order.targetQty) * 100)) : 0;

  return (
    <div
      draggable={!isStopped}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDragStart={(e) => {
        if (isStopped) {
          e.preventDefault();
          toast.warning(`"${order.productName}" is stopped / short-closed and cannot be assigned.`, { autoClose: 3000 });
          return;
        }
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("orderId", order.id);
        e.dataTransfer.setData("text/plain", order.id);
        onDragStart(order.id);
      }}
      onDragEnd={() => onDragStart("")}
      className={`
        group relative flex items-center justify-between gap-2 p-2 rounded-lg border transition-all duration-150 select-none
        ${isStopped ? "cursor-not-allowed opacity-75 bg-card-2/30 border-line" : "cursor-grab active:cursor-grabbing border-line bg-card hover:border-primary/40 hover:bg-card-2/60 shadow-xs"}
        ${isDragging ? "opacity-35 scale-[0.97]" : ""}
        ${isHovered && !isStopped ? "ring-1 ring-primary/50 border-primary shadow-xs" : ""}
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span
            className="text-[11px] font-bold truncate leading-snug text-ink"
            title={order.productName}
          >
            {order.productName}
          </span>
          {isStopped && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0"
              title="Production stopped / Short closed"
            >
              <FaStopCircle size={7} /> Stopped
            </span>
          )}
        </div>
        {!isComplete && isCarriedForward && (
          <div
            className="flex items-center gap-1 text-[8.5px] font-bold text-amber-500 dark:text-amber-400/90 mt-0.5"
            title={`Produced ${order.producedQty.toLocaleString()} + planned ${order.plannedElsewhere.toLocaleString()} of ${order.targetQty.toLocaleString()} in other weeks — pending amount carried forward`}
          >
            <FaHistory size={7} />
            <span>Carried forward · Pending {remaining.toLocaleString()}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-[9.5px] text-ink-muted mt-0.5">
          <span>Target: <strong className="text-ink font-semibold">{order.targetQty.toLocaleString()}</strong></span>
          {isStopped ? (
            order.producedQty > 0 ? (
              <span>Prod: <strong className="text-ink font-semibold">{order.producedQty.toLocaleString()}</strong></span>
            ) : (
              <span className="text-ink-muted text-[9px] font-medium">Closed</span>
            )
          ) : isComplete ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
              <FaCheckCircle size={8} /> Done
            </span>
          ) : (
            <span>Rem: <strong className="text-primary font-bold">{remaining.toLocaleString()}</strong></span>
          )}
        </div>
        {/* Mini progress bar */}
        <div className="mt-1 h-[2px] w-full bg-line-soft rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isStopped ? "bg-slate-400 dark:bg-slate-600" : isComplete ? "bg-emerald-500" : "bg-primary/60"}`}
            style={{ width: `${isStopped ? prodPct : Math.round((1 - remainingPct) * 100)}%` }}
          />
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {order.capacityPerShift > 0 ? (
            <div className="text-[8.5px] text-ink-muted flex items-center gap-1 flex-wrap">
              <span>Cap: <strong className="text-ink">{order.capacityPerShift.toLocaleString()}</strong>/shift</span>
              {order.hasCustomCapacity && !order.hasHistoricalCapacity && (
                <span className="text-[7.5px] font-semibold px-1 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">Custom</span>
              )}
              {onEditCapacity && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEditCapacity(order); }}
                  className="text-ink-muted hover:text-primary p-0.5 rounded cursor-pointer"
                  title="Change planned quantity per shift"
                >
                  <FaPencilAlt size={7.5} />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEditCapacity?.(order); }}
              className="text-[8.5px] font-bold text-ink-muted hover:text-ink bg-card-2 hover:bg-card px-1.5 py-0.5 rounded border border-line-soft flex items-center gap-1 cursor-pointer transition-colors"
              title="Set planned quantity per shift"
            >
              <span>Cap not set — Click to set</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {hasAllocations && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClearGroup(); }}
            title="Remove all shifts"
            className="p-1 rounded text-ink-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          >
            <FaTimes size={9} />
          </button>
        )}
        <FaGripVertical className="text-ink-muted/30 group-hover:text-ink-muted transition-colors" size={9} />
      </div>
    </div>
  );
};

// ─── DropCell ────────────────────────────────────────────────────────────────

interface DropCellProps {
  assignment:             CellAssignment | null;
  isOver:                 boolean;
  isGroupHovered:         boolean;
  draggingOrderId?:       string;
  isMachineMatch?:        boolean;
  isLocked?:              boolean;  // true when RM has been issued for this date
  onDragEnter?:           (e: React.DragEvent) => void;
  onDragOver:             (e: React.DragEvent) => void;
  onDrop:                 (e: React.DragEvent) => void;
  onDragLeave?:           (e: React.DragEvent) => void;
  onClear:                () => void;
  onMouseEnter:           () => void;
  onMouseLeave:           () => void;
  onDragStartAssignment?: (orderId: string) => void;
  onDragEndAssignment?:   () => void;
}

const DropCell: React.FC<DropCellProps> = ({
  assignment, isOver, isGroupHovered, draggingOrderId, isMachineMatch = true,
  isLocked = false,
  onDragEnter, onDragOver, onDrop, onDragLeave, onClear,
  onMouseEnter, onMouseLeave, onDragStartAssignment, onDragEndAssignment,
}) => {
  const isDraggingAny = Boolean(draggingOrderId);
  // Locked cells can never be a swap/drop target
  const isSwapTarget  = !isLocked && isOver && Boolean(assignment) && isDraggingAny && assignment?.orderId !== draggingOrderId && isMachineMatch;
  const isSelfMove    = !isLocked && isOver && Boolean(assignment) && isDraggingAny && assignment?.orderId === draggingOrderId;
  const isEmptyDrop   = !isLocked && isOver && !assignment && isDraggingAny && isMachineMatch;
  const isInvalidDrop = isOver && isDraggingAny && (!isMachineMatch || isLocked);

  let cellCls = "";
  if      (assignment?.isStopped) cellCls = "border border-rose-500/30 dark:border-rose-500/40 bg-rose-500/5 dark:bg-rose-500/10 cursor-default";
  else if (isLocked && assignment) cellCls = "border border-dotted border-line-soft/80 bg-card-2/25 cursor-default opacity-85";
  else if (isInvalidDrop) cellCls = "border-red-500/50 bg-red-500/8 cursor-not-allowed";
  else if (isSwapTarget)  cellCls = "border-amber-400 bg-amber-500/15 ring-1 ring-amber-400/60 scale-[1.02] z-10 shadow-md";
  else if (isSelfMove)    cellCls = "border-primary/60 bg-primary/12 ring-1 ring-primary/30";
  else if (isEmptyDrop)   cellCls = "border-primary bg-primary/15 ring-2 ring-primary/40 scale-[1.01] z-10 shadow-sm";
  else if (isGroupHovered && !isLocked) cellCls = "ring-1 ring-primary/50 border-primary/60 bg-primary/8";

  if (!assignment) {
    return (
      <div
        title={isLocked ? "Production started, cannot be changed" : undefined}
        onDragEnter={isLocked ? undefined : onDragEnter}
        onDragOver={isLocked ? undefined : onDragOver}
        onDragLeave={isLocked ? undefined : onDragLeave}
        onDrop={isLocked ? undefined : onDrop}
        className={`
          relative h-[62px] rounded-lg border transition-all duration-150 flex items-center justify-center select-none
          ${isLocked ? "border-dotted border-line-soft/40 bg-card-2/15 cursor-default" : `border-dashed ${cellCls || "border-line-soft/40 hover:border-line-soft hover:bg-card-2/30"}`}
        `}
      >
        {isLocked ? (
          <span className="text-[8.5px] font-semibold tracking-wider uppercase text-ink-muted/50">
            Locked
          </span>
        ) : isOver && isMachineMatch ? (
          <span className="text-[10px] font-bold text-primary animate-pulse">+ Drop here</span>
        ) : isOver && !isMachineMatch ? (
          <span className="text-[9px] font-medium text-red-400">Wrong machine</span>
        ) : (
          <span className="text-[10px] text-ink-muted/30 font-medium select-none">—</span>
        )}
      </div>
    );
  }

  return (
    <div
      title={assignment.isStopped ? (assignment.stopReason ? `Stopped: ${assignment.stopReason}` : "Production Stopped") : isLocked ? "Production started, cannot be changed" : undefined}
      draggable={!isLocked && !assignment.isStopped}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDragEnter={isLocked || assignment.isStopped ? undefined : onDragEnter}
      onDragOver={isLocked || assignment.isStopped ? undefined : onDragOver}
      onDragLeave={isLocked || assignment.isStopped ? undefined : onDragLeave}
      onDrop={isLocked || assignment.isStopped ? undefined : onDrop}
      onDragStart={isLocked || assignment.isStopped ? undefined : (e) => {
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("orderId", assignment.orderId);
        e.dataTransfer.setData("text/plain", assignment.orderId);
        onDragStartAssignment?.(assignment.orderId);
      }}
      onDragEnd={isLocked || assignment.isStopped ? undefined : onDragEndAssignment}
      className={`
        group/cell relative h-[62px] rounded-lg px-2 py-1 flex flex-col justify-between transition-all duration-150 select-none
        overflow-hidden shadow-2xs
        ${assignment.isStopped
          ? (cellCls || "border border-rose-500/30 dark:border-rose-500/40 bg-rose-500/5 dark:bg-rose-500/10 cursor-default")
          : isLocked
          ? (cellCls || "border border-dotted border-line-soft/80 bg-card-2/25 cursor-default opacity-85")
          : (`border cursor-grab active:cursor-grabbing ${cellCls || "border-line bg-card hover:border-primary/50 hover:bg-card-2/80"}`)
        }
      `}
    >

      {/* Header: PO Reference + lock/sequence tag */}
      <div className="flex items-center justify-between gap-1 min-w-0">
        <span className="text-[8.5px] font-mono font-bold text-ink-muted/80 truncate leading-tight flex-1" title={assignment.orderId}>
          {assignment.orderId}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {assignment.isStopped ? (
            <span
              title={assignment.stopReason ? `Stopped: ${assignment.stopReason}` : "Production Stopped"}
              className="text-[7.5px] font-bold tracking-wider uppercase text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 px-1.5 py-0.5 rounded flex items-center gap-0.5"
            >
              <FaStopCircle size={7} /> Stop
            </span>
          ) : isLocked ? (
            <span
              title="Production started, cannot be changed"
              className="text-[7.5px] font-semibold tracking-wider uppercase text-ink-muted/60 bg-card-2/40 border border-dotted border-line-soft/60 px-1.5 py-0.5 rounded"
            >
              Locked
            </span>
          ) : null}
          {assignment.seqNo && (
            <span className="text-[8px] font-mono font-extrabold text-ink-muted/70 bg-card-2 px-1 rounded">
              #{assignment.seqNo}
            </span>
          )}
        </div>
      </div>

      {/* Body: Product Name */}
      <div className="text-[10px] font-bold text-ink truncate leading-tight" title={assignment.productName}>
        {assignment.productName}
      </div>

      {/* Footer: assigned qty + remove button (hidden when locked or stopped) */}
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[9.5px] font-extrabold ${assignment.isStopped ? "text-ink font-bold" : isLocked ? "text-primary/75" : "text-primary"}`}>
          {assignment.qty.toLocaleString()} <span className="text-[8px] font-normal text-ink-muted">pcs</span>
        </span>
        {!isLocked && !assignment.isStopped && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            title="Remove assignment"
            className="w-4 h-4 rounded flex items-center justify-center text-ink-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/cell:opacity-100 transition-all cursor-pointer"
          >
            <FaTimes size={8} />
          </button>
        )}
      </div>

      {/* Swap indicator overlay */}
      {isSwapTarget && (
        <div className="absolute inset-0 bg-amber-500/20 rounded-lg flex items-center justify-center pointer-events-none">
          <span className="text-[9.5px] font-black text-amber-300 bg-black/60 px-1.5 py-0.5 rounded shadow">
            ⇄ SWAP
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const DailyPlanCreate: React.FC = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch   = useAppDispatch();
  const { can } = usePermission();

  // ── Redux state ──────────────────────────────────────────────────────────
  const rawMachines = useAppSelector((state: any) => state.machines?.data);

  const machines: Array<{ machineId: string; machineName: string }> = useMemo(() => {
    const list = Array.isArray(rawMachines) ? rawMachines : (rawMachines?.machines ?? []);
    return list.filter((m: any) => m.isActive !== false);
  }, [rawMachines]);

  const urlWeek = (location.state as any)?.weekStart || searchParams.get("week");
  const passedIsEdit = Boolean((location.state as any)?.isEdit);
  const [weekStart] = useState<string>(urlWeek ? snapToMonday(urlWeek) : getTodayMonday());
  const [selectedDay,    setSelectedDay]    = useState<DayName | "ALL">("ALL");
  const [boardMap,       setBoardMap]       = useState<Record<CellKey, CellAssignment>>({});
  const [draggingId,     setDraggingId]     = useState<string>("");
  const [hoverKey,       setHoverKey]       = useState<CellKey | "">("");
  const [hoveredOrderId, setHoveredOrderId] = useState<string>("");
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>("ALL");
  const [isEditMode,     setIsEditMode]     = useState<boolean>(passedIsEdit);
  const [rmIssuedDates,  setRmIssuedDates]  = useState<Set<string>>(new Set());
  const [lockedCellKeys, setLockedCellKeys] = useState<Set<CellKey>>(new Set());

  // ── Data loading state ───────────────────────────────────────────────────
  const [productionOrders, setProductionOrders] = useState<BoardOrder[]>([]);
  const [loadingOrders,    setLoadingOrders]    = useState(false);
  const [isSubmitting,     setIsSubmitting]     = useState(false);

  // ── Shift Capacity Modal State ──────────────────────────────────────────
  const [capacityModalOrder, setCapacityModalOrder] = useState<BoardOrder | null>(null);
  const [pendingDropTarget,  setPendingDropTarget]  = useState<{ machineId: string; day: DayName; shift: ShiftSlot } | null>(null);
  const [shiftCapacityInput, setShiftCapacityInput] = useState<string>("");

  const weekEnd = addDays(weekStart, 5);

  // ── Load machines on mount ──────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchMachines());
  }, [dispatch]);

  // ── Load production orders + existing daily plans for selected week ──────
  const loadOrders = useCallback(async () => {
    if (!machines.length) return;
    setLoadingOrders(true);
    setHoveredOrderId("");
    try {
      // Fetch programs for all machines, existing daily plans, and RM issued dates in parallel
      const [results, dailyPlansRes, issuedDatesArr] = await Promise.all([
        Promise.all(
          machines.map((m) =>
            productionOrderService.getMachinePrograms(m.machineId, weekStart).catch((err) => {
              console.error(`Failed to load programs for machine ${m.machineId}:`, err);
              return [] as any[];
            })
          )
        ),
        // Fetch plans for each day of this week in parallel (backend filters by productionDate)
        Promise.all(
          DAY_NAMES.map((_, i) => {
            const d = addDays(weekStart, i);
            return dailyPlanService.getAll({ productionDate: d }).catch(() => null);
          })
        ).then((dayResults) => {
          // Merge all per-day results into one array
          return dayResults.flatMap((res) => {
            if (Array.isArray(res)) return res;
            if (Array.isArray(res?.data)) return res.data;
            if (Array.isArray(res?.data?.dailyPlans)) return res.data.dailyPlans;
            if (Array.isArray(res?.dailyPlans)) return res.dailyPlans;
            return [];
          });
        }),
        dailyPlanService.getRmIssuedDates(weekStart).catch(() => []),
      ]);

      // ── Extract daily plans and week plans for this week ─────
      const passedPlans = (location.state as any)?.existingPlans;
      const extractPlans = (res: any): any[] => {
        if (Array.isArray(res)) return res;                           // direct array
        if (Array.isArray(res?.data)) return res.data;               // { data: [...] }
        if (Array.isArray(res?.data?.dailyPlans)) return res.data.dailyPlans; // { data: { dailyPlans: [...] } }
        if (Array.isArray(res?.dailyPlans)) return res.dailyPlans;   // { dailyPlans: [...] }
        if (Array.isArray(passedPlans)) return passedPlans;
        return [];
      };
      const allDailyPlans: any[] = extractPlans(dailyPlansRes);

      const curWeekDates = DAY_NAMES.map((_, i) => addDays(weekStart, i));
      const existingWeekPlans = allDailyPlans.filter((p: any) => {
        const pDate = normalizeDateStr(p.productionDate);
        return p.status !== "CANCELLED" && curWeekDates.includes(pDate);
      });

      // Flatten and attach machine name (exclude DRAFT status orders)
      const flat = results.flatMap((items, idx) =>
        items
          .filter((item) => item.status?.toUpperCase() !== "DRAFT")
          .map((item) => ({ ...item, machineId: item.machineId ?? machines[idx].machineId, _machineIdx: idx }))
      );

      // Fetch capacity for each order (product+machine) in parallel
      const capacities = await Promise.all(
        flat.map((item) =>
          productCapacityHistoryService
            .fetchByProductAndMachine(Number(item.productItemId), item.machineId ?? "")
            .catch(() => null)
        )
      );

      // Distinct color generator
      const productColors: Record<string, string> = {};
      let colorIndex = 0;
      const getColorForProduct = (key: string) => {
        if (!productColors[key]) {
          productColors[key] = CARD_COLORS[colorIndex % CARD_COLORS.length];
          colorIndex++;
        }
        return productColors[key];
      };

      // Helper to detect stopped order
      const detectOrderStopped = (orderId: string, poStatus?: string, poRemarks?: string) => {
        const statusUpper = (poStatus || "").toUpperCase();
        if (["COMPLETED_WITH_SHORTFALL", "STOPPED", "CANCELLED", "SHORT_CLOSED"].includes(statusUpper)) {
          return true;
        }
        if (/Permanently Stopped|Short Closed|Stopped:/i.test(poRemarks || "")) {
          return true;
        }
        return existingWeekPlans.some((p: any) => {
          if (p.productionOrderId !== orderId) return false;
          const pStatus = (p.status || "").toUpperCase();
          const pRemarks = p.remarks || "";
          return (
            ["STOPPED", "COMPLETED_WITH_SHORTFALL", "SHORT_CLOSED"].includes(pStatus) ||
            /Permanently Stopped|Short Closed|Stopped:/i.test(pRemarks) ||
            /Permanently Stopped|Short Closed|Stopped:/i.test(p.productionOrder?.remarks || "")
          );
        });
      };

      const orders: BoardOrder[] = flat.map((item, i) => {
        const machineName =
          machines.find((m) => m.machineId === (item.machineId ?? ""))?.machineName ??
          item.machineId ?? "Unknown";
        const cap = capacities[i];
        const hasHistoricalCapacity = Boolean(cap && (Number(cap.newCapacity || 0) > 0 || Number(cap.capacity || 0) > 0));
        const capacityPerShift = hasHistoricalCapacity
          ? Number(cap.newCapacity ?? cap.capacity)
          : 0;

        const isStopped = detectOrderStopped(item.productionOrderId, item.status, item.remarks);

        return {
          id:               item.productionOrderId,
          productName:      item.productName,
          productCode:      item.productCode,
          productItemId:    item.productItemId,
          machineId:        item.machineId ?? "",
          machineName,
          targetQty:        item.noOfPcs,
          producedQty:      item.producedQty ?? 0,
          plannedElsewhere: item.plannedElsewhere ?? 0,
          hadPriorPlan:     item.hadPriorPlan ?? false,
          isOverdue:        item.isOverdue ?? false,
          isStopped,
          capacityPerShift,
          hasHistoricalCapacity,
          hasCustomCapacity: false,
          uom:              item.uom,
          color:            getColorForProduct(item.productName || item.productionOrderId),
          status:           isStopped ? "COMPLETED_WITH_SHORTFALL" : item.status,
          remarks:          item.remarks,
        };
      });

      // ── Pre-populate boardMap from existing daily plans for this week ─────

      // Build set of production orders already assigned a plan this week (any day)
      const poIdsInDailyPlans = new Set<string>();
      allDailyPlans.forEach((p: any) => {
        if (p.status !== "CANCELLED" && p.productionOrderId) {
          poIdsInDailyPlans.add(p.productionOrderId);
        }
      });

      const weekPlanPoIds = new Set<string>(existingWeekPlans.map((p: any) => p.productionOrderId).filter(Boolean));

      // Ensure all production orders from existing week plans are included in orders
      const existingOrderIds = new Set(orders.map((o) => o.id));
      existingWeekPlans.forEach((plan: any) => {
        const orderId = plan.productionOrderId;
        if (orderId && !existingOrderIds.has(orderId)) {
          existingOrderIds.add(orderId);
          const po = plan.productionOrder;
          const pName = po?.productItem?.productName || "Product";
          const pCode = po?.productItem?.productCode || "";
          const pItemId = po?.productItemId ? String(po.productItemId) : "";
          const targetQty = Number(po?.targetQty || plan.plannedQty || 1000);
          const producedQty = Number(po?.producedQty || 0);
          const machineObj = machines.find((m) => m.machineId === plan.machineId);
          const machineName = machineObj?.machineName || plan.machine?.machineName || plan.machineId || "Machine";

          const existingPlanCap = Number(plan.plannedQty || 0);
          const isStopped = detectOrderStopped(orderId, po?.status || plan.status, po?.remarks || plan.remarks);
          orders.push({
            id:               orderId,
            productName:      pName,
            productCode:      pCode,
            productItemId:    pItemId,
            machineId:        plan.machineId || "",
            machineName,
            targetQty,
            producedQty,
            plannedElsewhere: 0,
            hadPriorPlan:     false,
            isOverdue:        false,
            isStopped,
            capacityPerShift: existingPlanCap,
            hasHistoricalCapacity: false,
            hasCustomCapacity: existingPlanCap > 0,
            uom:              po?.uom || "pcs",
            color:            getColorForProduct(pName || orderId),
            status:           isStopped ? "COMPLETED_WITH_SHORTFALL" : (po?.status || plan.status),
            remarks:          po?.remarks || plan.remarks || "",
          });
        }
      });

      // Populate capacityPerShift from existing plan if not already set from history
      existingWeekPlans.forEach((plan: any) => {
        const order = orders.find((o) => o.id === plan.productionOrderId);
        if (order) {
          if (!order.isStopped && detectOrderStopped(order.id, order.status, order.remarks)) {
            order.isStopped = true;
            order.status = "COMPLETED_WITH_SHORTFALL";
          }
          if (order.capacityPerShift <= 0 && Number(plan.plannedQty || 0) > 0) {
            order.capacityPerShift = Number(plan.plannedQty);
            order.hasCustomCapacity = true;
          }
        }
      });

      // Filter available orders:
      // Keep an order plannable in ANY week — including weeks after the one it
      // was first scheduled for — as long as its true remaining quantity
      // (targetQty - producedQty - plannedElsewhere) hasn't hit zero.
      // Only genuinely finished/closed statuses hide it permanently; being
      // DAILY_PLANNED/IN_PRODUCTION just means work has started, not that the
      // target was fully produced, so it must keep resurfacing (carry-forward).
      const validOrders = orders.filter((o) => {
        if (weekPlanPoIds.has(o.id)) {
          return true; // Keep orders currently planned on this week's board
        }
        const isFullyDone = Math.max(0, o.targetQty - o.producedQty - o.plannedElsewhere) <= 0;
        const isTerminalStatus = ["COMPLETED", "READY_FOR_DISPATCH", "CLOSED", "COMPLETED_WITH_SHORTFALL", "STOPPED", "SHORT_CLOSED", "CANCELLED", "DISPATCHED"].includes(
          (o.status || "").toUpperCase()
        );
        const isAlreadyAssigned = isFullyDone || isTerminalStatus || poIdsInDailyPlans.has(o.id);
        return !isAlreadyAssigned;
      });

      setProductionOrders(validOrders);
      setRmIssuedDates(new Set((issuedDatesArr || []).map((d: string) => normalizeDateStr(d))));

      if (existingWeekPlans.length > 0) {
        setIsEditMode(true);
        const orderSeqMap: Record<string, number> = {};
        const initialBoardMap: Record<CellKey, CellAssignment> = {};
        const initialLockedCellKeys = new Set<CellKey>();
        const issuedDatesSet = new Set((issuedDatesArr || []).map((d: string) => normalizeDateStr(d)));

        // Sort plans chronologically by date and shift
        const sortedPlans = [...existingWeekPlans].sort((a, b) => {
          const dateDiff = new Date(normalizeDateStr(a.productionDate)).getTime() - new Date(normalizeDateStr(b.productionDate)).getTime();
          if (dateDiff !== 0) return dateDiff;
          const slotA = getShiftSlot(a);
          const slotB = getShiftSlot(b);
          return (slotA === "DAY" ? 0 : 1) - (slotB === "DAY" ? 0 : 1);
        });

        const orderCumMap: Record<string, number> = {};
        sortedPlans.forEach((plan: any) => {
          const planDate = normalizeDateStr(plan.productionDate);
          if (!planDate) return;
          const dayIdx = curWeekDates.indexOf(planDate);
          if (dayIdx < 0) return;
          const dayName = DAY_NAMES[dayIdx];
          const slot: ShiftSlot = getShiftSlot(plan);
          const machineId = plan.machineId || plan.machine?.machineId;
          const orderId = plan.productionOrderId;
          const order = orders.find((o) => o.id === orderId);
          const pName = plan.productionOrder?.productItem?.productName || order?.productName || "Product";

          const k = cellKey(machineId, dayName, slot);
          orderSeqMap[orderId] = (orderSeqMap[orderId] || 0) + 1;

          // Check if this specific plan was stopped
          const planStatus = String(plan.status || "").toUpperCase();
          const planRemarks = String(plan.remarks || "");
          let planStopReason: string | null = null;
          if (/Permanently Stopped|Short Closed|Stopped:/i.test(planRemarks)) {
            const parts = planRemarks.split("|");
            const reasonPart = parts[parts.length - 1] || "";
            planStopReason = reasonPart
              .replace(/Permanently Stopped:/i, "")
              .replace(/Short Closed:/i, "")
              .replace(/Stopped:/i, "")
              .replace(/Cancelled:/i, "")
              .trim();
          }

          const isPlanDirectStop =
            ["STOPPED", "COMPLETED_WITH_SHORTFALL", "SHORT_CLOSED"].includes(planStatus) ||
            Boolean(planStopReason);

          // If order is stopped, determine if this plan is the stopped shift
          const isOrderStopped = Boolean(order?.isStopped);
          const allPlansForOrder = sortedPlans.filter((p: any) => p.productionOrderId === orderId);
          const lastPlanForOrder = allPlansForOrder[allPlansForOrder.length - 1];
          const isLastOfStoppedOrder = isOrderStopped && lastPlanForOrder?.dailyPlanId === plan.dailyPlanId;

          const cellIsStopped = isPlanDirectStop || isLastOfStoppedOrder;
          if (cellIsStopped && !planStopReason && order?.remarks) {
            const parts = order.remarks.split("|");
            const reasonPart = parts[parts.length - 1] || "";
            planStopReason = reasonPart
              .replace(/Permanently Stopped:/i, "")
              .replace(/Short Closed:/i, "")
              .replace(/Stopped:/i, "")
              .replace(/Cancelled:/i, "")
              .trim() || "Stopped";
          }

          // Lock this specific cell if stopped, RM issued, or production started
          if (cellIsStopped || issuedDatesSet.has(planDate) || plan.isLocked || plan.status === "IN_PROGRESS" || plan.status === "COMPLETED") {
            initialLockedCellKeys.add(k);
          }

          const targetQty = Number(plan.productionOrder?.targetQty || order?.targetQty || 0);
          const rawQty = Number(plan.plannedQty || 0);
          const currentCum = orderCumMap[orderId] || 0;

          let cellQty = rawQty;
          if (targetQty > 0) {
            cellQty = Math.min(rawQty, Math.max(0, targetQty - currentCum));
          }
          orderCumMap[orderId] = currentCum + cellQty;

          initialBoardMap[k] = {
            orderId,
            productName: pName,
            qty: cellQty,
            targetQty,
            color: order?.color || getColorForProduct(pName || orderId),
            seqNo: orderSeqMap[orderId],
            status: plan.status,
            isStopped: cellIsStopped,
            stopReason: planStopReason || (cellIsStopped ? "Stopped" : null),
          };
        });

        setBoardMap(initialBoardMap);
        setLockedCellKeys(initialLockedCellKeys);
      } else {
        setIsEditMode(false);
        setBoardMap({});
        setLockedCellKeys(new Set());
      }
    } catch (err) {
      console.error("Failed to load machine programs:", err);
      toast.error("Failed to load production orders for this week");
    } finally {
      setLoadingOrders(false);
    }
  }, [machines, weekStart, location.state]);

  useEffect(() => {
    if (machines.length) loadOrders();
  }, [loadOrders, machines.length]);

  // ── Derived: per-order allocation totals ─────────────────────────────────
  const orderStats = useMemo(() => {
    const stats: Record<string, { allocatedQty: number; seqCount: number }> = {};
    productionOrders.forEach((o) => { stats[o.id] = { allocatedQty: 0, seqCount: 0 }; });
    Object.values(boardMap).forEach((cell) => {
      if (stats[cell.orderId]) {
        stats[cell.orderId].allocatedQty += cell.qty;
        stats[cell.orderId].seqCount     += 1;
      }
    });
    return stats;
  }, [boardMap, productionOrders]);

  // Outstanding quantity regardless of week — target minus everything actually
  // produced (any week, real hourly logs) minus whatever's still committed to
  // OTHER weeks' active plans. This is the cap auto-fill (drag/drop, swap) must
  // never exceed — using raw order.targetQty there would re-plan quantity
  // that's already produced or already scheduled elsewhere.
  const trueRemainingFor = useCallback((order: BoardOrder) => {
    if (
      order.isStopped || 
      ["COMPLETED_WITH_SHORTFALL", "STOPPED", "CANCELLED", "SHORT_CLOSED"].includes((order.status || "").toUpperCase()) ||
      /Permanently Stopped|Short Closed|Stopped:/i.test(order.remarks || "")
    ) {
      return 0;
    }
    return Math.max(0, order.targetQty - order.producedQty - order.plannedElsewhere);
  }, []);

  // Same, minus whatever's freshly placed on THIS week's board — this is the
  // live "Rem" figure shown on each Program List card.
  const remainingFor = useCallback((order: BoardOrder) => {
    if (
      order.isStopped || 
      ["COMPLETED_WITH_SHORTFALL", "STOPPED", "CANCELLED", "SHORT_CLOSED"].includes((order.status || "").toUpperCase()) ||
      /Permanently Stopped|Short Closed|Stopped:/i.test(order.remarks || "")
    ) {
      return 0;
    }
    const allocatedQty = orderStats[order.id]?.allocatedQty ?? 0;
    return Math.max(0, trueRemainingFor(order) - allocatedQty);
  }, [orderStats, trueRemainingFor]);

  // "Carried forward" is a look-ahead indicator only — it must never appear
  // while planning the CURRENT (or a past) week, only when looking at a week
  // that comes after today's real date. Whatever's overdue is just "this
  // week's work" until you actually move past today into a future week.
  const isFutureWeek = weekStart > getTodayMonday();

  // Within a future week, an order counts as "carried forward" if:
  //  - it already has real progress (produced, or still committed to another
  //    week's active plan), OR
  //  - it genuinely had a plan dated before the week being viewed
  //    (hadPriorPlan — real DailyProductionPlan history), OR
  //  - its own originally-scheduled window has fully elapsed against TODAY's
  //    real date with nothing done (isOverdue).
  // Deliberately not just "order.weekStartDate < the week on screen" — that
  // false-positived on brand-new orders being viewed in their own first week.
  const isCarriedForward = useCallback((order: BoardOrder) => {
    if (!isFutureWeek) return false;
    return order.producedQty > 0 || order.plannedElsewhere > 0 || order.hadPriorPlan || order.isOverdue;
  }, [isFutureWeek]);

  // ── Day dates ────────────────────────────────────────────────────────────
  const dayDates = useMemo(() => {
    const obj = {} as Record<DayName, string>;
    DAY_NAMES.forEach((d, i) => { obj[d] = addDays(weekStart, i); });
    return obj;
  }, [weekStart]);

  // ── Day filter ───────────────────────────────────────────────────────────
  const filteredDays: readonly DayName[] = selectedDay === "ALL"
    ? DAY_NAMES
    : [selectedDay as DayName];

  // ── Machine groups for right panel ───────────────────────────────────────
  const machineGroups = useMemo(() => {
    const groups: Record<string, { machine: { machineId: string; machineName: string }; orders: BoardOrder[] }> = {};
    machines.forEach((m) => { groups[m.machineId] = { machine: m, orders: [] }; });
    productionOrders.forEach((o) => {
      if (groups[o.machineId]) {
        groups[o.machineId].orders.push(o);
      } else {
        groups[o.machineId] = {
          machine: { machineId: o.machineId, machineName: o.machineName },
          orders: [o],
        };
      }
    });
    return Object.values(groups).filter((g) => g.orders.length > 0);
  }, [machines, productionOrders]);

  const displayedMachineGroups = useMemo(() =>
    selectedMachineFilter === "ALL"
      ? machineGroups
      : machineGroups.filter((g) => g.machine.machineId === selectedMachineFilter),
    [machineGroups, selectedMachineFilter]
  );

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragEnter = (_machineId: string, key: CellKey) => (e: React.DragEvent) => {
    e.preventDefault();
    setHoverKey(key);
  };

  const handleDragOver = (machineId: string, key: CellKey) => (e: React.DragEvent) => {
    e.preventDefault();
    const draggingOrder = productionOrders.find((o) => o.id === draggingId);
    if (draggingOrder && draggingOrder.machineId !== machineId) {
      e.dataTransfer.dropEffect = "none";
    } else {
      e.dataTransfer.dropEffect = "move";
    }
    if (hoverKey !== key) setHoverKey(key);
  };

  const handleDragLeave = (key: CellKey) => (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (hoverKey === key) setHoverKey("");
  };

  const executeDrop = (order: BoardOrder, machineId: string, day: DayName, shift: ShiftSlot) => {
    const isOrderStopped = Boolean(
      order.isStopped || 
      ["STOPPED", "COMPLETED_WITH_SHORTFALL", "SHORT_CLOSED", "CANCELLED"].includes((order.status || "").toUpperCase()) ||
      /Permanently Stopped|Short Closed|Stopped:/i.test(order.remarks || "")
    );
    if (isOrderStopped) {
      toast.warning(`"${order.productName}" is stopped / short-closed and cannot be assigned.`, { autoClose: 3500 });
      setHoverKey(""); setDraggingId(""); return;
    }

    const targetKey        = cellKey(machineId, day, shift);
    const targetAssignment = boardMap[targetKey];
    const targetOrderId    = targetAssignment?.orderId;

    const isCellLocked = (k: string) => {
      return lockedCellKeys.has(k as CellKey);
    };

    // Block dropping or swapping directly onto a locked cell
    if (isCellLocked(targetKey)) {
      toast.error(
        "Production started, cannot be changed.",
        { position: "top-right", autoClose: 3500 }
      );
      setHoverKey(""); setDraggingId(""); return;
    }

    // ── SWAP ─────────────────────────────────────────────────────────────
    if (targetOrderId && targetOrderId !== order.id) {
      const targetOrder = productionOrders.find((o) => o.id === targetOrderId);
      if (!targetOrder) {
        setHoverKey("");
        setDraggingId("");
        return;
      }

      const sortByCellOrder = (a: string, b: string) => {
        const [, dA, sA] = a.split("__");
        const [, dB, sB] = b.split("__");
        return (
          CELL_ORDER.findIndex((c) => c.day === dA && c.shift === sA) -
          CELL_ORDER.findIndex((c) => c.day === dB && c.shift === sB)
        );
      };

      // Only consider UNLOCKED cells for swapping — locked shifts remain strictly in place
      const sourceUnlockedCells = Object.keys(boardMap)
        .filter((k) => {
          const [mId] = k.split("__");
          return mId === machineId && boardMap[k as CellKey]?.orderId === order.id && !isCellLocked(k);
        })
        .sort(sortByCellOrder);

      const targetUnlockedCells = Object.keys(boardMap)
        .filter((k) => {
          const [mId] = k.split("__");
          return mId === machineId && boardMap[k as CellKey]?.orderId === targetOrderId && !isCellLocked(k);
        })
        .sort(sortByCellOrder);

      // Clear ONLY the unlocked cells of both orders on this machine from nextMap
      const nextMap = { ...boardMap };
      Object.keys(nextMap).forEach((k) => {
        const [mId] = k.split("__");
        if (mId !== machineId) return;
        const oid = nextMap[k as CellKey]?.orderId;
        if ((oid === order.id || oid === targetOrderId) && !isCellLocked(k)) {
          delete nextMap[k as CellKey];
        }
      });

      // Helper function to place an order's shifts as a single continuous block
      const placeOrderShifts = (
        ord: BoardOrder,
        startCellIdx: number
      ): number => {
        let orderLockedQty = 0;
        let orderLockedCount = 0;
        Object.keys(boardMap).forEach((k) => {
          const [mId] = k.split("__");
          if (mId === machineId && boardMap[k as CellKey]?.orderId === ord.id && isCellLocked(k)) {
            orderLockedQty += boardMap[k as CellKey]?.qty || 0;
            orderLockedCount++;
          }
        });

        let rem = Math.max(0, trueRemainingFor(ord) - orderLockedQty);
        let seq = orderLockedCount + 1;
        let nextAvailableIdx = startCellIdx;

        for (let i = startCellIdx; i < CELL_ORDER.length && rem > 0; i++) {
          const { day: d, shift: s } = CELL_ORDER[i];
          const k = cellKey(machineId, d, s);
          if (nextMap[k] || isCellLocked(k)) continue;

          const qty = Math.min(rem, ord.capacityPerShift);
          nextMap[k] = {
            orderId: ord.id,
            productName: ord.productName,
            qty,
            targetQty: ord.targetQty,
            color: ord.color,
            seqNo: seq++,
          };
          rem -= qty;
          nextAvailableIdx = i + 1;
        }

        return nextAvailableIdx;
      };

      // Determine the two orders' execution order
      let firstOrd: BoardOrder;
      let secondOrd: BoardOrder;
      let startIdx: number;

      if (sourceUnlockedCells.length > 0 && targetUnlockedCells.length > 0) {
        const [, sDay, sShift] = sourceUnlockedCells[0].split("__");
        const [, tDay, tShift] = targetUnlockedCells[0].split("__");
        const sourceStartIdx = CELL_ORDER.findIndex((c) => c.day === sDay && c.shift === sShift);
        const targetStartIdx = CELL_ORDER.findIndex((c) => c.day === tDay && c.shift === tShift);

        startIdx = Math.min(sourceStartIdx, targetStartIdx);

        if (sourceStartIdx < targetStartIdx) {
          // Invert sequence so targetOrder comes first
          firstOrd = targetOrder;
          secondOrd = order;
        } else {
          // Invert sequence so order comes first
          firstOrd = order;
          secondOrd = targetOrder;
        }
      } else {
        const [, tDay, tShift] = (targetUnlockedCells[0] || targetKey).split("__");
        startIdx = CELL_ORDER.findIndex((c) => c.day === tDay && c.shift === tShift);
        if (startIdx === -1) startIdx = 0;
        firstOrd = order;
        secondOrd = targetOrder;
      }

      // 1. Place the first order as a complete contiguous group
      const nextStartIdx = placeOrderShifts(firstOrd, startIdx);

      // 2. Place the second order as a complete contiguous group immediately after
      placeOrderShifts(secondOrd, nextStartIdx);

      setBoardMap(nextMap);
      setHoverKey("");
      setDraggingId("");
      toast.info(`Swapped: "${order.productName}" ⇄ "${targetOrder.productName}"`, { autoClose: 2000 });
      return;
    }

    // ── Normal drop / re-position ─────────────────────────────────────────
    const nextMap = { ...boardMap };
    // Preserve locked cells; only remove unlocked cells of this order
    Object.keys(nextMap).forEach((k) => {
      if (nextMap[k as CellKey]?.orderId !== order.id) return;
      if (!lockedCellKeys.has(k as CellKey)) delete nextMap[k as CellKey];
    });

    // Subtract already-locked qty so we only fill the remaining unissued portion
    let lockedQty = 0;
    let lockedSeqCount = 0;
    Object.keys(nextMap).forEach((k) => {
      if (nextMap[k as CellKey]?.orderId !== order.id) return;
      lockedQty += nextMap[k as CellKey]?.qty || 0;
      lockedSeqCount++;
    });

    let remaining = Math.max(0, trueRemainingFor(order) - lockedQty);
    const startIdx = CELL_ORDER.findIndex((c) => c.day === day && c.shift === shift);
    if (startIdx === -1) { setHoverKey(""); setDraggingId(""); return; }

    const toFill: { key: CellKey; qty: number; seqNo: number }[] = [];
    let seqNo = lockedSeqCount + 1;  // continue numbering after locked shifts
    for (let i = startIdx; i < CELL_ORDER.length && remaining > 0; i++) {
      const { day: d, shift: s } = CELL_ORDER[i];
      const k = cellKey(machineId, d, s);
      if (nextMap[k] || isCellLocked(k)) continue;
      const qty = Math.min(remaining, order.capacityPerShift);
      toFill.push({ key: k, qty, seqNo: seqNo++ });
      remaining -= qty;
    }

    if (toFill.length === 0) {
      if (remaining > 0) toast.warning("No available shift slots from this cell.");
      setHoverKey(""); setDraggingId(""); return;
    }

    toFill.forEach(({ key: k, qty, seqNo: seq }) => {
      nextMap[k] = { orderId: order.id, productName: order.productName, qty, targetQty: order.targetQty, color: order.color, seqNo: seq };
    });
    setBoardMap(nextMap); setHoverKey(""); setDraggingId("");
  };

  const handleDrop = (machineId: string, day: DayName, shift: ShiftSlot) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const orderId = e.dataTransfer.getData("orderId") || e.dataTransfer.getData("text/plain") || draggingId;
    const order   = productionOrders.find((o) => o.id === orderId);
    if (!order) { setHoverKey(""); setDraggingId(""); return; }

    const isOrderStopped = Boolean(
      order.isStopped || 
      ["STOPPED", "COMPLETED_WITH_SHORTFALL", "SHORT_CLOSED", "CANCELLED"].includes((order.status || "").toUpperCase()) ||
      /Permanently Stopped|Short Closed|Stopped:/i.test(order.remarks || "")
    );
    if (isOrderStopped) {
      toast.warning(`"${order.productName}" is stopped / short-closed and cannot be assigned.`, { autoClose: 3500 });
      setHoverKey(""); setDraggingId(""); return;
    }

    if (order.machineId !== machineId) {
      const targetMachineName = machines.find((m) => m.machineId === machineId)?.machineName ?? machineId;
      toast.error(
        `"${order.productName}" belongs to ${order.machineName}. Cannot assign to ${targetMachineName}.`,
        { position: "top-right", autoClose: 3500 }
      );
      setHoverKey(""); setDraggingId(""); return;
    }

    // Check if shift planned capacity is defined
    if (order.capacityPerShift <= 0 && !order.hasCustomCapacity) {
      setPendingDropTarget({ machineId, day, shift });
      setCapacityModalOrder(order);
      setShiftCapacityInput("");
      setHoverKey("");
      setDraggingId("");
      return;
    }

    executeDrop(order, machineId, day, shift);
  };

  const handleOpenCapacityModal = (order: BoardOrder) => {
    setCapacityModalOrder(order);
    setShiftCapacityInput(order.capacityPerShift > 0 ? String(order.capacityPerShift) : "");
    setPendingDropTarget(null);
  };

  const handleConfirmCapacity = () => {
    if (!capacityModalOrder) return;
    const num = Number(shiftCapacityInput);
    if (!num || isNaN(num) || num <= 0) {
      toast.error("Please enter a valid shift planned quantity (greater than 0)");
      return;
    }

    const updatedOrder: BoardOrder = {
      ...capacityModalOrder,
      capacityPerShift: num,
      hasCustomCapacity: true,
    };

    setProductionOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );

    if (pendingDropTarget) {
      executeDrop(updatedOrder, pendingDropTarget.machineId, pendingDropTarget.day, pendingDropTarget.shift);
      setPendingDropTarget(null);
    } else {
      // Re-allocate any existing unlocked cells for this order with the new capacity
      const currentCells = Object.keys(boardMap).filter((k) => boardMap[k as CellKey]?.orderId === updatedOrder.id);
      if (currentCells.length > 0) {
        const sortedCells = currentCells.sort((a, b) => {
          const [, dA, sA] = a.split("__");
          const [, dB, sB] = b.split("__");
          return (
            CELL_ORDER.findIndex((c) => c.day === dA && c.shift === sA) -
            CELL_ORDER.findIndex((c) => c.day === dB && c.shift === sB)
          );
        });
        const firstCell = sortedCells[0];
        const [mId, d, s] = firstCell.split("__") as [string, DayName, ShiftSlot];
        executeDrop(updatedOrder, mId, d, s);
      }
    }

    toast.success(`Shift planned quantity set to ${num.toLocaleString()} pcs for ${updatedOrder.productName}`);
    setCapacityModalOrder(null);
    setShiftCapacityInput("");
  };

  const handleClearOrderGroup = (orderId: string) => {
    let hadLocked = false;
    setBoardMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k as CellKey].orderId !== orderId) return;
        if (lockedCellKeys.has(k as CellKey)) {
          hadLocked = true; // keep locked cells intact
        } else {
          delete next[k as CellKey];
        }
      });
      return next;
    });
    if (hadLocked) {
      toast.warning("Production started, cannot be changed.", { autoClose: 3000 });
    }
    if (hoveredOrderId === orderId) setHoveredOrderId("");
  };

  const handleClear = (key: CellKey) => {
    // Safety guard: locked cells should never reach here (DropCell hides the X button),
    // but we double-check to prevent bypassing the lock via keyboard or other means.
    if (lockedCellKeys.has(key)) {
      toast.warning("Production started, cannot be changed.", { autoClose: 3000 });
      return;
    }
    const targetOrderId = boardMap[key]?.orderId;
    if (targetOrderId) {
      handleClearOrderGroup(targetOrderId);
    } else {
      setBoardMap((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }
  };

  const handleReset = () => {
    setBoardMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (!lockedCellKeys.has(k as CellKey)) delete next[k as CellKey];
      });
      return next;
    });
    setHoveredOrderId("");
  };

  // ── Save / Confirm ────────────────────────────────────────────────────────

  // Static slots: "DAY" and "NIGHT"
  const getShiftId = useCallback((slotCode: ShiftSlot): string => {
    return slotCode;
  }, []);

  const buildPlanItems = useCallback(() => {
    return Object.entries(boardMap).map(([key, cell]) => {
      const parts     = key.split("__");
      const machineId = parts[0];
      const dayName   = parts[1] as DayName;
      const slotCode  = parts[2] as ShiftSlot;
      const date      = dayDates[dayName];
      return {
        productionOrderId: cell.orderId,
        machineId,
        shiftId:           getShiftId(slotCode),
        productionDate:    date,
        plannedQty:        cell.qty,
      };
    });
  }, [boardMap, dayDates, getShiftId]);

  const handleSave = async (status: "DRAFT" | "PLANNED") => {
    const items = buildPlanItems();
    if (items.length === 0 && !isEditMode) {
      toast.warning("No shifts assigned. Drag production orders onto the grid first.");
      return;
    }

    setIsSubmitting(true);
    try {
      await dailyPlanService.bulkCreate({ items, status, weekStart });
      toast.success(
        items.length === 0
          ? "Plan cleared successfully."
          : status === "PLANNED"
          ? `${items.length} shift(s) confirmed and planned!`
          : `${items.length} shift(s) saved as draft.`
      );
      navigate("/daily-machine-planning");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save plan. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useFormShortcuts({
    onSave: () => {
      if (isEditMode ? can("daily-machine-planning.edit") : can("daily-machine-planning.create")) {
        handleSave("PLANNED");
      }
    },
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalPlanned   = Object.keys(boardMap).length;
  const totalShifts    = machines.length * 12;
  const fullyDone      = productionOrders.filter((o) => remainingFor(o) <= 0).length;
  const hasUnallocated = productionOrders.some((o) => remainingFor(o) > 0);
  const carriedForwardCount = productionOrders.filter(
    (o) => remainingFor(o) > 0 && isCarriedForward(o)
  ).length;

  const planStatus: PlanStatus =
    totalPlanned === 0 ? "draft" :
    productionOrders.length > 0 && fullyDone === productionOrders.length ? "ready" :
    "in-progress";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="w-full flex flex-col overflow-hidden bg-card rounded-xl border border-line shadow-xs"
      style={{ height: "calc(100vh - 130px)", minHeight: "560px" }}
    >
      {/* ══ PAGE HEADER ════════════════════════════════════════════════════════ */}
      <div className="bg-card border-b border-line px-5 pt-3 pb-3 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[16px] font-bold text-ink leading-tight">
                  {isEditMode ? "Edit Daily Production Plan" : "Daily Production Plan"}
                </h1>
                {isEditMode && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-card-2 text-ink border border-line-soft">
                    Editing Week: {shortDate(weekStart)} – {shortDate(weekEnd)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            <BackButton onClick={() => navigate("/daily-machine-planning")} />
          </div>
        </div>
      </div>

      {/* ─── Controls Bar ─── */}
      <div className="px-4 pt-2 pb-3 border-b border-line-soft space-y-2 shrink-0">
        <div className="flex items-center gap-1 text-[12px]">
          <span className="font-semibold text-ink">{shortDate(weekStart)}</span>
          <span className="text-ink-muted px-1">–</span>
          <span className="font-semibold text-ink">{shortDate(weekEnd)}</span>
          <span className="text-[10.5px] text-ink-muted ml-1">· Mon – Sat</span>
        </div>

        {/* ── Day filter pills ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedDay("ALL")}
            className={`px-2 py-0.5 text-[9.5px] font-semibold rounded transition-all shrink-0 cursor-pointer ${
              selectedDay === "ALL"
                ? "bg-primary text-white shadow-xs"
                : "bg-card text-ink-muted hover:text-ink hover:bg-card-2 border border-line"
            }`}
          >
            All Days
          </button>
          {DAY_NAMES.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`px-2 py-0.5 text-[9.5px] font-semibold rounded transition-all shrink-0 cursor-pointer ${
                selectedDay === day
                  ? "bg-primary text-white shadow-xs"
                  : "bg-card text-ink-muted hover:text-ink hover:bg-card-2 border border-line"
              }`}
            >
              {day.slice(0, 3)} {Number(dayDates[day]?.split("-")[2] || 0)}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px]">
          {loadingOrders ? (
            <span className="text-ink-muted flex items-center gap-1.5">
              <FaSpinner className="animate-spin" size={10} /> Loading programs…
            </span>
          ) : (
            <span className="text-ink-muted">
              <strong className="text-ink">{productionOrders.length}</strong> orders · {" "}
              <strong className="text-primary">{totalPlanned}</strong>
              <span className="text-ink-muted font-normal">/{totalShifts}</span> shifts filled
            </span>
          )}

          {carriedForwardCount > 0 && (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"
              title="Production orders on this board with quantity carried forward from another week"
            >
              <FaHistory size={9} />
              {carriedForwardCount} Carried Forward
            </span>
          )}
        </div>
      </div>

      {/* ══ MAIN CONTENT ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT: Planning Grid ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-auto">
          {machines.length === 0 ? (
            <div className="flex items-center justify-center h-full text-ink-muted text-sm">
              <FaSpinner className="animate-spin mr-2" /> Loading machines…
            </div>
          ) : (
            <table
              className="border-collapse table-fixed"
              style={{ minWidth: filteredDays.length === 1 ? "400px" : "900px", width: "100%" }}
            >
              <colgroup>
                <col style={{ width: filteredDays.length === 1 ? "18%" : "9%" }} />
                {Array.from({ length: filteredDays.length * 2 }).map((_, i) => (
                  <col key={i} style={{ width: `${(filteredDays.length === 1 ? 82 : 91) / (filteredDays.length * 2)}%` }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr>
                  <th rowSpan={2} className="bg-card-2 border border-line px-2 py-2 text-left align-middle">
                    <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Machine</span>
                  </th>
                  {filteredDays.map((day) => (
                    <th key={day} colSpan={2} className="bg-card-2 border border-line px-1 py-1.5 text-center">
                      <div className="text-[11px] font-bold text-ink leading-tight">{day}</div>
                      <div className="text-[9px] text-primary font-semibold mt-0.5">{shortDate(dayDates[day])}</div>
                    </th>
                  ))}
                </tr>
                <tr>
                  {filteredDays.flatMap((day) =>
                    SHIFT_SLOTS.map(({ code, label }) => (
                      <th key={`${day}-${code}`} className="bg-card-2 border border-line px-1 py-1 text-center">
                        <span className="text-[10.5px] font-bold text-ink">{label}</span>
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {machines.map(({ machineId, machineName }, rowIdx) => {
                  const draggingOrder   = productionOrders.find((o) => o.id === draggingId);
                  const isTargetMachine = draggingOrder?.machineId === machineId;
                  const isOtherMachine  = Boolean(draggingOrder) && !isTargetMachine;

                  const filledCells = DAY_NAMES.flatMap((d) =>
                    SHIFT_SLOTS.map(({ code }) => cellKey(machineId, d, code as ShiftSlot))
                  ).filter((k) => boardMap[k]).length;
                  const utilPct = Math.round((filledCells / 12) * 100);

                  const rowBg = rowIdx % 2 === 0 ? "var(--card)" : "color-mix(in srgb, var(--card) 65%, transparent)";

                  return (
                    <tr
                      key={machineId}
                      className={[
                        "transition-colors duration-150",
                        isTargetMachine ? "outline outline-1 outline-primary/30 bg-primary/3" : "",
                        isOtherMachine  ? "opacity-30" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <td className="border border-line px-2 py-1.5 align-middle" style={{ background: rowBg }}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[12px] font-bold text-ink leading-none truncate">{machineName}</span>
                          {isTargetMachine && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />}
                        </div>
                        <div className="mt-1.5 h-[2px] w-full bg-line-soft rounded-full overflow-hidden">
                          <div className="h-full bg-primary/50 rounded-full transition-all duration-500" style={{ width: `${utilPct}%` }} />
                        </div>
                        <div className="text-[8.5px] text-ink-muted mt-0.5 tabular-nums">{filledCells}/12 shifts</div>
                      </td>
                      {filteredDays.flatMap((day) =>
                        SHIFT_SLOTS.map(({ code }) => {
                          const key        = cellKey(machineId, day, code as ShiftSlot);
                          const assignment = boardMap[key] ?? null;
                          const isGroupHov = !!(assignment && hoveredOrderId === assignment.orderId);
                          const cellDate   = dayDates[day];
                          const isLocked   = Boolean(assignment && lockedCellKeys.has(key));
                          return (
                            <td
                              key={key}
                              className="border border-line p-1 align-top overflow-hidden"
                              style={{ background: rowBg }}
                              title={isLocked ? "Production started, cannot be changed" : undefined}
                            >
                              <DropCell
                                assignment={assignment}
                                isOver={hoverKey === key}
                                isGroupHovered={isGroupHov}
                                draggingOrderId={draggingId}
                                isMachineMatch={!draggingId || isTargetMachine}
                                isLocked={isLocked}
                                onDragEnter={handleDragEnter(machineId, key)}
                                onDragOver={handleDragOver(machineId, key)}
                                onDrop={handleDrop(machineId, day, code as ShiftSlot)}
                                onDragLeave={handleDragLeave(key)}
                                onClear={() => handleClear(key)}
                                onMouseEnter={() => assignment && setHoveredOrderId(assignment.orderId)}
                                onMouseLeave={() => setHoveredOrderId("")}
                                onDragStartAssignment={setDraggingId}
                                onDragEndAssignment={() => { setDraggingId(""); setHoverKey(""); }}
                              />
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── RIGHT: Program List Panel ─────────────────────────────────────── */}
        <div className="w-[300px] shrink-0 border-l border-line bg-card flex flex-col overflow-y-auto">
          <div className="sticky top-0 z-10 bg-card-2 border-b border-line px-3 py-2.5 shrink-0 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-ink uppercase tracking-wider">Program List</div>
                <div className="text-[10px] text-ink-muted mt-0.5 tabular-nums">
                  {loadingOrders ? "Loading…" : `${fullyDone} of ${productionOrders.length} completed`}
                </div>
              </div>
              {!loadingOrders && productionOrders.length > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  fullyDone === productionOrders.length
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-primary/10 text-primary border border-primary/20"
                }`}>
                  {Math.round((fullyDone / productionOrders.length) * 100)}%
                </span>
              )}
            </div>

            {/* Machine filter pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedMachineFilter("ALL")}
                className={`px-2 py-0.5 text-[9.5px] font-semibold rounded transition-all shrink-0 cursor-pointer ${
                  selectedMachineFilter === "ALL"
                    ? "bg-primary text-white shadow-xs"
                    : "bg-card text-ink-muted hover:text-ink hover:bg-card-2 border border-line"
                }`}
              >
                All ({productionOrders.length})
              </button>
              {machineGroups.map(({ machine, orders }) => (
                <button
                  key={machine.machineId}
                  type="button"
                  onClick={() => setSelectedMachineFilter(machine.machineId)}
                  className={`px-2 py-0.5 text-[9.5px] font-semibold rounded transition-all shrink-0 cursor-pointer ${
                    selectedMachineFilter === machine.machineId
                      ? "bg-primary text-white shadow-xs"
                      : "bg-card text-ink-muted hover:text-ink hover:bg-card-2 border border-line"
                  }`}
                >
                  {machine.machineName.split(" ")[0]} ({orders.length})
                </button>
              ))}
            </div>
          </div>

          {/* Loader */}
          {loadingOrders && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink-muted text-xs">
              <FaSpinner className="animate-spin text-primary" size={20} />
              <span>Loading programs for this week…</span>
            </div>
          )}

          {/* Empty state */}
          {!loadingOrders && productionOrders.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink-muted text-xs px-4 text-center">
              <FaCalendarAlt size={24} className="opacity-30" />
              <span>No production orders found for this week.</span>
              <span className="text-[10px] opacity-60">Go to Production Orders and create orders with a machine assigned to see them here.</span>
            </div>
          )}

          {/* Machine sections */}
          {!loadingOrders && (
            <div className="p-3 flex flex-col gap-3">
              {displayedMachineGroups.map(({ machine, orders }) => {
                const machineDone = orders.filter((o) => remainingFor(o) <= 0).length;
                const allDone = machineDone === orders.length;
                return (
                  <div key={machine.machineId} className="bg-card-2/60 border border-line rounded-xl overflow-hidden shadow-xs flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-line bg-card-2">
                      <span className="text-[11.5px] font-bold text-ink">
                        {machine.machineName}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        allDone
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-primary/10 text-primary border border-primary/20"
                      }`}>
                        {allDone ? "✓ Done" : `${machineDone}/${orders.length}`}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 p-2">
                      {orders.map((order) => {
                        const stats     = orderStats[order.id] || { allocatedQty: 0, seqCount: 0 };
                        const remaining = remainingFor(order);
                        return (
                          <OrderCard
                            key={order.id}
                            order={order}
                            remaining={remaining}
                            allocatedQty={stats.allocatedQty}
                            isCarriedForward={isCarriedForward(order)}
                            isDragging={draggingId === order.id}
                            isHovered={hoveredOrderId === order.id}
                            onDragStart={setDraggingId}
                            onMouseEnter={() => setHoveredOrderId(order.id)}
                            onMouseLeave={() => setHoveredOrderId("")}
                            onClearGroup={() => handleClearOrderGroup(order.id)}
                            onEditCapacity={handleOpenCapacityModal}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Warning footer */}
          {!loadingOrders && hasUnallocated && productionOrders.length > 0 && (
            <div className="sticky bottom-0 z-10 bg-card border-t border-line px-3 py-2 mt-auto text-center">
              <p className="text-[9.5px] text-ink-subtle leading-tight">
                Drag cards to assign shifts. Unassigned orders will not be planned.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ══ BOTTOM ACTION BAR ══════════════════════════════════════════════════ */}
      <div className="bg-card border-t border-line px-5 py-2.5 flex items-center justify-end gap-3 shrink-0">
        <CustomButton
          text="Cancel"
          variant="secondary"
          onClick={() => navigate("/daily-machine-planning")}
          disabled={isSubmitting}
        />
        {!isEditMode && can("daily-machine-planning.create") && (
          <CustomButton
            text={isSubmitting ? "Saving…" : "Save Draft"}
            icon={isSubmitting ? undefined : FaSave}
            variant="secondary"
            onClick={() => handleSave("DRAFT")}
            disabled={isSubmitting || loadingOrders || Object.keys(boardMap).length === 0}
          />
        )}
        {(isEditMode ? can("daily-machine-planning.edit") : can("daily-machine-planning.create")) && (
          <CustomButton
            text={isSubmitting ? "Confirming…" : isEditMode ? "Update Plan" : "Confirm Plan"}
            icon={isSubmitting ? undefined : FaCheckCircle}
            onClick={() => handleSave("PLANNED")}
            disabled={isSubmitting || loadingOrders || (!isEditMode && Object.keys(boardMap).length === 0)}
          />
        )}
      </div>

      {/* ══ Shift Planned Quantity Configuration Modal ══════════════ */}
      <CommonModal
        show={Boolean(capacityModalOrder)}
        onHide={() => {
          setCapacityModalOrder(null);
          setPendingDropTarget(null);
          setShiftCapacityInput("");
        }}
        title="Set Shift Planned Quantity"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <CustomButton
              text="Cancel"
              variant="secondary"
              onClick={() => {
                setCapacityModalOrder(null);
                setPendingDropTarget(null);
                setShiftCapacityInput("");
              }}
            />
            <CustomButton
              text={pendingDropTarget ? "Confirm & Assign" : "Save Capacity"}
              variant="primary"
              onClick={handleConfirmCapacity}
              disabled={!shiftCapacityInput || Number(shiftCapacityInput) <= 0}
            />
          </div>
        }
      >
        {capacityModalOrder && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="bg-card-2/70 border border-line-soft rounded-xl p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-ink-subtle font-semibold">Production Order:</span>
                <span className="font-mono font-bold text-ink">{capacityModalOrder.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-subtle font-semibold">Product:</span>
                <span className="font-bold text-ink">{capacityModalOrder.productName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-subtle font-semibold">Machine:</span>
                <span className="font-bold text-ink">{capacityModalOrder.machineName}</span>
              </div>
              <div className="flex items-center justify-between border-t border-line-soft/60 pt-2">
                <span className="text-ink-subtle font-semibold">Order Target Qty:</span>
                <span className="font-bold text-primary text-sm">
                  {capacityModalOrder.targetQty.toLocaleString()} pcs
                </span>
              </div>
            </div>

            {!capacityModalOrder.hasHistoricalCapacity && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 text-xs">
                <FaExclamationTriangle size={14} className="shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  This product has no historical shift record on this machine.
                  Please specify the planned quantity per shift to allocate across the schedule.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink">
                Planned Quantity per Shift (pcs) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                autoFocus
                value={shiftCapacityInput}
                onChange={(e) => setShiftCapacityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmCapacity();
                  }
                }}
                placeholder="e.g. 1500"
                className="w-full h-10 px-3 rounded-lg border border-line bg-card text-ink text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary no-spinner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[11px] text-ink-subtle">
                This value applies only to this plan schedule. It will not write to the database as a historical record.
              </span>
            </div>
          </div>
        )}
      </CommonModal>

    </div>
  );
};

export default DailyPlanCreate;
