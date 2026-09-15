import React, { useState, useEffect, useMemo, useCallback } from "react";

import CommonModal from "../../../components/ui/Modal/CommonModal";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaPlus, FaPlay, FaStop, FaCalendarAlt, FaIndustry,
  FaCheckCircle, FaInfoCircle, FaChartBar, FaBoxOpen,
  FaEye, FaPencilAlt, FaExclamationTriangle, FaSpinner,
} from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { fetchDailyPlans, updateDailyPlan, dailyPlanCreated, dailyPlanUpdated, dailyPlanDeleted } from "../../../features/daily-plans/dailyPlanSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";
import CustomButton from "../../../components/ui/Button/Button";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import { dailyPlanService } from "../../../services/dailyPlanService";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import TextArea from "../../../components/form/TextArea/TextArea";
import { ProductionOrderViewModal } from "../../production-orders/components/ProductionOrderViewModal";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { MaterialIssueModal } from "../../production-orders/components/MaterialIssueModal";
import { usePermission } from "../../../hooks/usePermission";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import DailyPlanViewModal from "../components/DailyPlanViewModal";
import DailyRawMaterialIssueModal from "../components/DailyRawMaterialIssueModal";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";


// ── Status config ────────────────────────────────────────────
const STATUS_FLOW: Record<string, { label: string; next: string | null }> = {
  DRAFT:           { label: "Draft",                    next: "PLANNED" },
  PLANNED:         { label: "Planned",                  next: "IN_PROGRESS" },
  IN_PROGRESS:     { label: "In Progress",              next: "COMPLETED" },
  COMPLETED:       { label: "Completed",                next: null },
  CANCELLED:       { label: "Cancelled",                next: null },
  STOPPED:         { label: "Stopped",                  next: null },
  SHORT_CLOSED:    { label: "Completed with Shortage",  next: null },
  POST_PRODUCTION: { label: "Post-Production",          next: null },
};

// ── Board helpers ────────────────────────────────────────────
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
type DayName = typeof DAY_NAMES[number];
const SHIFT_SLOTS = ["DAY", "NIGHT"] as const;
type ShiftSlot = (typeof SHIFT_SLOTS)[number];

const normalizeDateStr = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  if (typeof dateStr === "string" && dateStr.includes("T")) {
    return dateStr.split("T")[0];
  }
  return String(dateStr);
};

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const snapToMonday = (dateStr: string): string => {
  const normalized = normalizeDateStr(dateStr);
  const d = new Date(normalized + "T00:00:00");
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return fmtDate(d);
};
const getTodayMonday = () => {
  const d = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return fmtDate(d);
};
const addDays = (base: string, n: number) => {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + n);
  return fmtDate(d);
};
const shortDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

const STATUS_BOARD_COLOR: Record<string, string> = {
  DRAFT:           "border-l-amber-400 bg-amber-500/10",
  PLANNED:         "border-l-sky-400 bg-sky-500/10",
  IN_PROGRESS:     "border-l-indigo-400 bg-indigo-500/10",
  COMPLETED:       "border-l-emerald-400 bg-emerald-500/10",
  STOPPED:         "border-l-rose-400 bg-rose-500/10",
  SHORT_CLOSED:    "border-l-rose-400 bg-rose-500/10",
  CANCELLED:       "border-l-red-400 bg-red-500/10",
  POST_PRODUCTION: "border-l-purple-400 bg-purple-500/10",
};
const STATUS_BOARD_DOT: Record<string, string> = {
  DRAFT: "bg-amber-400", PLANNED: "bg-sky-400", IN_PROGRESS: "bg-indigo-400",
  COMPLETED: "bg-emerald-400",
  STOPPED: "bg-rose-400", SHORT_CLOSED: "bg-rose-400", CANCELLED: "bg-red-400",
  POST_PRODUCTION: "bg-purple-400",
};

// RM-issued badge color (violet — kept distinct from all status dot colors above)
const RM_ISSUED_DOT = "bg-violet-400";

// ── Helpers for produced qty ─────────────────────────────────
const calcProduced = (plan: any) => {
  if (!Array.isArray(plan?.hourlyProductions) || plan.hourlyProductions.length === 0) return 0;
  return plan.hourlyProductions.reduce((s: number, h: any) => {
    if (h.totalQtyProduced !== undefined) {
      return s + Math.max(0, Number(h.totalQtyProduced || 0) - Number(h.totalRejectQty || 0));
    }
    return s + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0));
  }, 0);
};

const countLoggedEntries = (plan: any) => {
  if (!Array.isArray(plan?.hourlyProductions) || plan.hourlyProductions.length === 0) return 0;
  let count = 0;
  plan.hourlyProductions.forEach((hp: any) => {
    if (Array.isArray(hp.hourlyEntries)) {
      count += hp.hourlyEntries.filter((e: any) => Number(e.hourIndex) > 0 && (Number(e.qtyProduced || 0) > 0 || Number(e.downtime || 0) > 0 || Boolean(e.downtimeReason))).length;
    } else if (Number(hp.hourIndex) > 0) {
      count += 1;
    }
  });
  return count;
};

const hasDraftHourly = (plan: any) => {
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

// ── Component ────────────────────────────────────────────────
const DailyProductionPlanningPage: React.FC = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const dispatch   = useAppDispatch();
  const { can }    = usePermission();

  const { data: machines }   = useAppSelector((state: any) => state.machines);
  const { data: dailyPlans } = useAppSelector((state: any) => state.dailyPlans);
  const { data: shifts }     = useAppSelector((state: any) => state.shifts);

  // ── Board state ───────────────────────────────────────────
  const [boardWeek,    setBoardWeek]    = useState<string>(getTodayMonday());
  const [selectedDay,  setSelectedDay]  = useState<DayName | "ALL">("ALL");

  // ── Modals ────────────────────────────────────────────────
  const [showStatusModal,          setShowStatusModal]          = useState(false);
  const [showStopModal,            setShowStopModal]            = useState(false);
  const [showDailyPlanViewModal,   setShowDailyPlanViewModal]   = useState(false);
  const [selectedDailyPlanForView, setSelectedDailyPlanForView] = useState<any>(null);
  const [showPOViewModal,          setShowPOViewModal]          = useState(false);
  const [selectedPOForView,        setSelectedPOForView]        = useState<any>(null);
  const [showDeleteWeekModal,      setShowDeleteWeekModal]      = useState(false);
  const [isDeletingWeek,           setIsDeletingWeek]           = useState(false);
  const [statusChangePlan,         setStatusChangePlan]         = useState<any>(null);
  const [stopPlan,                 setStopPlan]                 = useState<any>(null);
  const [stopReason,               setStopReason]               = useState("");
  const [isStopping,               setIsStopping]               = useState(false);
  const [showMaterialIssueModal,   setShowMaterialIssueModal]   = useState(false);
  const [materialIssuePlan,        setMaterialIssuePlan]        = useState<any>(null);
  const [rawMaterialsMap,          setRawMaterialsMap]          = useState<Map<string, any>>(new Map());
  const [showDailyRmIssueModal,    setShowDailyRmIssueModal]    = useState(false);
  const [dailyRmIssueDate,         setDailyRmIssueDate]         = useState<string>("");
  const [rmIssuedDates,            setRmIssuedDates]            = useState<Set<string>>(new Set());
  const [contextMenu,              setContextMenu]              = useState<{ x: number; y: number; plan: any } | null>(null);

  // ── Week Selection Modal (Add New Plan) ───────────────────
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const [showWeekSelectModal,  setShowWeekSelectModal]  = useState(false);
  const [weekSelectDate,       setWeekSelectDate]       = useState<string>(todayStr);
  const [weekCheckLoading,     setWeekCheckLoading]     = useState(false);
  const [weekCheckResult,      setWeekCheckResult]      = useState<null | {
    exists: boolean; planCount: number; weekStart: string; weekEnd: string;
    machines: string[]; statuses: string[];
    samplePlans: Array<{ dailyPlanId: string; productionDate: string; machineName: string; shiftName: string; productName: string; plannedQty: number; status: string; }>;
  }>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleClickOutside, true);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", handleClickOutside, true);
    };
  }, []);

  useEffect(() => {
    rawMaterialService.fetchAll().then((res) => {
      const map = new Map();
      const list = Array.isArray(res) ? res : ((res as any)?.rawMaterials ?? []);
      list.forEach((rm: any) => map.set(rm.rawMaterialId?.toString(), rm));
      setRawMaterialsMap(map);
    }).catch(console.error);
  }, []);

  // ── Auto-check week when modal is open or date changes ───
  useEffect(() => {
    if (!showWeekSelectModal || !weekSelectDate) return;
    const ws = snapToMonday(weekSelectDate);
    let cancelled = false;
    setWeekCheckLoading(true);
    setWeekCheckResult(null);
    dailyPlanService.checkWeek(ws)
      .then((res) => { if (!cancelled) setWeekCheckResult(res); })
      .catch(() => { if (!cancelled) setWeekCheckResult(null); })
      .finally(() => { if (!cancelled) setWeekCheckLoading(false); });
    return () => { cancelled = true; };
  }, [showWeekSelectModal, weekSelectDate]);

  // ── Data loading ──────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchMachines());
    dispatch(fetchShifts());
  }, [dispatch]);

  const loadDailyPlans = useCallback(() => {
    dispatch(fetchDailyPlans(undefined));
  }, [dispatch]);

  useEffect(() => { loadDailyPlans(); }, [loadDailyPlans, location.key]);

  useSocketSync("dailyPlan", { created: dailyPlanCreated, updated: dailyPlanUpdated, deleted: dailyPlanDeleted }, loadDailyPlans);
  useSocketSync("hourlyProduction", undefined, loadDailyPlans);
  useSocketSync("weeklyProgram",    undefined, loadDailyPlans);
  useSocketSync("productionOrder",  undefined, loadDailyPlans);

  // ── Fetch RM-issued dates whenever the board week changes ────────────────
  const fetchRmIssuedDates = useCallback((week: string) => {
    dailyPlanService.getRmIssuedDates(week)
      .then((dates) => setRmIssuedDates(new Set(dates)))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchRmIssuedDates(boardWeek); }, [boardWeek, fetchRmIssuedDates]);

  // ── Derived ───────────────────────────────────────────────
  const allPlans = useMemo(() => Array.isArray(dailyPlans) ? dailyPlans : [], [dailyPlans]);

  const plannedDates = useMemo(() =>
    allPlans
      .filter((p: any) => p.status !== "CANCELLED")
      .map((p: any) => normalizeDateStr(p.productionDate))
      .filter(Boolean),
    [allPlans]
  );

  const boardWeekDates = useMemo(() => DAY_NAMES.map((_, i) => addDays(boardWeek, i)), [boardWeek]);

  useEffect(() => { setSelectedDay("ALL"); }, [boardWeek]);

  const filteredDays = useMemo<readonly DayName[]>(() =>
    selectedDay === "ALL" ? DAY_NAMES : [selectedDay as DayName], [selectedDay]);

  const dayDates = useMemo(() => {
    const m: Record<DayName, string> = {} as any;
    DAY_NAMES.forEach((d, i) => { m[d] = boardWeekDates[i]; });
    return m;
  }, [boardWeekDates]);

  const boardShiftMap = useMemo(() => {
    const sl = Array.isArray(shifts) ? [...shifts].sort((a: any, b: any) => Number(a.id || 0) - Number(b.id || 0)) : [];
    const dayShift = sl.find((s: any) => {
      const name = `${s.shiftName} ${s.shiftCode}`.toLowerCase();
      return name.includes("morning") || name.includes("day") || name.includes("shift 1") || name.includes("shift-1") || name.includes("s1") || name.includes("sht001");
    }) || sl[0];
    const nightShift = sl.find((s: any) => {
      const name = `${s.shiftName} ${s.shiftCode}`.toLowerCase();
      return name.includes("evening") || name.includes("night") || name.includes("shift 2") || name.includes("shift-2") || name.includes("s2") || name.includes("sht002");
    }) || sl[1] || sl[0];

    return { DAY: dayShift?.shiftCode ?? "SHT001", NIGHT: nightShift?.shiftCode ?? "SHT002" };
  }, [shifts]);

  const boardMap = useMemo(() => {
    const map: Record<string, Record<DayName, Record<ShiftSlot, any[]>>> = {};
    const toSlot: Record<string, ShiftSlot> = { [boardShiftMap.DAY]: "DAY", [boardShiftMap.NIGHT]: "NIGHT" };
    allPlans.forEach((plan: any) => {
      const planDate = plan.productionDate?.split("T")[0];
      if (!planDate) return;
      const dayIdx = boardWeekDates.indexOf(planDate);
      if (dayIdx < 0) return;
      const dayName = DAY_NAMES[dayIdx];
      const shiftStr = `${plan.shiftId || ""} ${plan.shift?.shiftName || ""} ${plan.shift?.shiftCode || ""}`.toLowerCase();
      const isNight = shiftStr.includes("night") || shiftStr.includes("eve") || shiftStr.includes("second") || shiftStr.includes("2") || plan.shiftId === boardShiftMap.NIGHT;
      const slot: ShiftSlot = isNight ? "NIGHT" : (toSlot[plan.shiftId] ?? "DAY");
      const mid = plan.machineId;
      if (!map[mid]) { map[mid] = {} as any; DAY_NAMES.forEach((d) => { map[mid][d] = { DAY: [], NIGHT: [] }; }); }
      map[mid][dayName][slot].push(plan);
    });
    return map;
  }, [allPlans, boardWeekDates, boardShiftMap]);

  // Stats based on selected week
  const weekPlans = useMemo(() =>
    allPlans.filter((p: any) => boardWeekDates.includes(p.productionDate?.split("T")[0]))
  , [allPlans, boardWeekDates]);

  const stats = useMemo(() => ({
    total:     weekPlans.length,
    planned:   weekPlans.filter((p: any) => p.status === "PLANNED").length,
    running:   weekPlans.filter((p: any) => p.status === "IN_PROGRESS").length,
    completed: weekPlans.filter((p: any) => p.status === "COMPLETED").length,
  }), [weekPlans]);

  const hasNonDraftOrPlannedShifts = useMemo(() =>
    weekPlans.some((p: any) => p.status !== "DRAFT" && p.status !== "PLANNED")
  , [weekPlans]);

  // For each production order, the one shift that "Stop Production Plan" should be offered
  // on — the chronologically LAST shift that already has real activity (logged hours, or
  // currently in progress), never an earlier already-finished shift or a future empty one.
  const lastActivePlanIdByPO = useMemo(() => {
    const shiftStartTime = new Map<string, string>();
    (Array.isArray(shifts) ? shifts : []).forEach((s: any) => shiftStartTime.set(s.shiftCode, s.startTime || "00:00"));

    const byPO = new Map<string, any[]>();
    allPlans.forEach((p: any) => {
      if (!p.productionOrderId) return;
      if (!byPO.has(p.productionOrderId)) byPO.set(p.productionOrderId, []);
      byPO.get(p.productionOrderId)!.push(p);
    });

    const result = new Map<string, string>();
    byPO.forEach((plans, poId) => {
      const sorted = [...plans].sort((a: any, b: any) => {
        const dateA = normalizeDateStr(a.productionDate);
        const dateB = normalizeDateStr(b.productionDate);
        if (dateA !== dateB) return dateA < dateB ? -1 : 1;
        const timeA = shiftStartTime.get(a.shiftId) || "00:00";
        const timeB = shiftStartTime.get(b.shiftId) || "00:00";
        return timeA < timeB ? -1 : timeA > timeB ? 1 : 0;
      });

      // Prefer the last shift that has real activity (entries logged, or currently running)
      let lastActive = [...sorted].reverse().find((p: any) => countLoggedEntries(p) > 0 || p.status === "IN_PROGRESS");
      // If nothing has started yet, fall back to the latest still-schedulable shift so Stop
      // stays available somewhere rather than disappearing entirely.
      if (!lastActive) {
        lastActive = [...sorted].reverse().find((p: any) => p.status === "PLANNED" || p.status === "IN_PROGRESS");
      }
      if (lastActive) result.set(poId, lastActive.dailyPlanId);
    });
    return result;
  }, [allPlans, shifts]);

  // ── Handlers ──────────────────────────────────────────────
  const handleCardClick = useCallback((plan: any) => {
    const planDate = normalizeDateStr(plan.productionDate);
    const isRmIssued = rmIssuedDates.has(planDate);

    if (!isRmIssued) {
      toast.warning(
        `Raw Material has not been issued for ${shortDate(planDate)}. Please issue Raw Materials first before recording hourly production.`,
        {
          position: "top-right",
          autoClose: 4000,
        }
      );
      return;
    }

    navigate(`/daily-production-plans/hourly/${plan.dailyPlanId}`, {
      state: {
        plan,
        dailyPlanId: plan.dailyPlanId,
        productionOrderId: plan.productionOrderId,
        machineId: plan.machineId,
        shiftId: plan.shiftId,
        productionDate: plan.productionDate ? plan.productionDate.split("T")[0] : undefined,
      }
    });
  }, [navigate, rmIssuedDates]);

  const handleContextMenu = useCallback((e: React.MouseEvent, plan: any) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 240);
    setContextMenu({ x, y, plan });
  }, []);

  const handleEditWeek = useCallback(() => {
    navigate(`/daily-production-plans/create?week=${boardWeek}`, {
      state: { weekStart: boardWeek, isEdit: true, existingPlans: weekPlans }
    });
  }, [navigate, boardWeek, weekPlans]);

  usePageShortcuts({
    onRefresh: () => loadDailyPlans(),
    onNew:     () => { if (can("daily-machine-planning.create")) openCreateForm(); },
    onDelete:  () => {
      if (weekPlans.length > 0 && !hasNonDraftOrPlannedShifts) {
        setShowDeleteWeekModal(true);
      } else if (hasNonDraftOrPlannedShifts) {
        toast.error("Cannot delete: This week contains shifts that are already in progress, completed, or stopped.");
      }
    },
    onExport:  () => document.querySelector<HTMLButtonElement>("[data-export-btn]")?.click(),
  });

  const openCreateForm = () => {
    setWeekSelectDate(todayStr());
    setWeekCheckResult(null);
    setShowWeekSelectModal(true);
  };

  const handleDeleteWeekConfirm = async () => {
    if (weekPlans.length === 0) return;
    if (hasNonDraftOrPlannedShifts) {
      toast.error("Cannot delete: This week contains shifts that are already in progress, completed, or stopped.");
      setShowDeleteWeekModal(false);
      return;
    }
    setIsDeletingWeek(true);
    try {
      const planIds = weekPlans.map((p: any) => p.dailyPlanId);
      const res = await dailyPlanService.bulkDelete({ dailyPlanIds: planIds });
      const deletedCount = res?.data?.deleted?.length ?? planIds.length;

      toast.success(`All ${deletedCount} daily plan(s) for the week deleted successfully.`);
      setShowDeleteWeekModal(false);
      loadDailyPlans();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete week plans");
    } finally {
      setIsDeletingWeek(false);
    }
  };


  const handleMaterialIssueSuccess = async () => {
    if (!materialIssuePlan) return;
    try {
      await dispatch(updateDailyPlan({ id: materialIssuePlan.dailyPlanId, data: { status: "IN_PROGRESS" } })).unwrap();
      toast.success("Materials issued and production started!");
      loadDailyPlans();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err || "Failed to start production");
    } finally { setMaterialIssuePlan(null); setShowMaterialIssueModal(false); }
  };

  const confirmStatusChange = async () => {
    const nextStatus = STATUS_FLOW[statusChangePlan?.status]?.next;
    if (!statusChangePlan || !nextStatus) return;
    try {
      await dispatch(updateDailyPlan({ id: statusChangePlan.dailyPlanId, data: { status: nextStatus } })).unwrap();
      toast.success(`Status updated to ${STATUS_FLOW[nextStatus]?.label || nextStatus}`);
      setShowStatusModal(false); setStatusChangePlan(null); loadDailyPlans();
    } catch (err: any) { toast.error(err || "Failed to update status"); }
  };

  const confirmStopProduction = async () => {
    if (!stopPlan || !stopReason.trim()) { toast.error("Please enter a reason."); return; }
    setIsStopping(true);
    try {
      const logged = countLoggedEntries(stopPlan);
      const remarks = stopPlan.remarks ? `${stopPlan.remarks} | Permanently Stopped: ${stopReason.trim()}` : `Permanently Stopped: ${stopReason.trim()}`;
      // Must go through POST_PRODUCTION (matching the working shortClosePO trigger in
      // HourlyWorkReportCreate.tsx) — sending "COMPLETED" directly skips the
      // cascade-stop-sibling-plans logic in daily-plan.service.ts entirely.
      const payload: any = { status: "STOPPED", remarks, plannedHours: logged > 0 ? logged : stopPlan.plannedHours, shortClosePO: true };
      await dispatch(updateDailyPlan({ id: stopPlan.dailyPlanId, data: payload })).unwrap();
      const poTarget = Number(stopPlan?.productionOrder?.targetQty || 0);
      const poProduced = Number(stopPlan?.productionOrder?.producedQty || 0);
      toast.success(poTarget > 0
        ? `Production permanently stopped at ${poProduced.toLocaleString()} of ${poTarget.toLocaleString()} pcs. Remaining shifts cancelled.`
        : "Production permanently stopped.");
      setShowStopModal(false); setStopPlan(null); loadDailyPlans();
    } catch (err: any) { toast.error(err || "Failed to stop production"); }
    finally { setIsStopping(false); }
  };

  const allowedMachines = useMemo(() =>
    (machines || []).filter((m: any) => m.machineId !== "MAC-001"), [machines]);

  const fetchDailyPlansForExport = useCallback(async () => {
    try {
      const res = await dailyPlanService.getAll();
      const list = Array.isArray(res) ? res : (res?.data || []);
      if (Array.isArray(list) && list.length > 0) return list;
    } catch { /* fallback */ }
    return Array.isArray(dailyPlans) ? dailyPlans : [];
  }, [dailyPlans]);

  const csvColumns = useMemo(() => [
    { header: "Plan ID",      accessor: (i: any) => i.dailyPlanId || "" },
    { header: "Date",         accessor: (i: any) => i.productionDate?.split("T")[0] || "" },
    { header: "PO Reference", accessor: (i: any) => i.productionOrderId || "" },
    { header: "Product",      accessor: (i: any) => i.productionOrder?.productItem?.productName || "" },
    { header: "Machine",      accessor: (i: any) => i.machine?.machineName || i.machineId || "" },
    { header: "Shift",        accessor: (i: any) => i.shift?.shiftName || i.shiftId || "" },
    { header: "Planned Qty",  accessor: (i: any) => i.plannedQty || 0 },
    { header: "Status",       accessor: (i: any) => STATUS_FLOW[i.status]?.label || i.status || "" },
  ], []);
  const csvFilename = `Daily_Plans_${new Date().toISOString().split("T")[0]}.csv`;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full">
      <div className="w-full bg-card rounded-2xl shadow-sm border border-line flex flex-col flex-1 overflow-hidden">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-6 py-3 border-b border-line shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-base font-bold text-ink m-0">Daily Production Planning</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {can("daily-machine-planning.view") && (
              <CustomButton text="Daily Report" icon={FaChartBar} onClick={() =>
                navigate("/daily-machine-planning/report", { state: { dailyPlans, machines, shifts } })
              } />
            )}
            {can("daily-machine-planning.create") && (
              <CustomButton text="New Daily Plan" icon={FaPlus} onClick={openCreateForm} />
            )}
          </div>
        </div>


            {/* ── Week Picker + Day Filter + Legend ───────────── */}
            <div className="flex flex-wrap items-center gap-3 px-6 py-2 border-t border-line-soft/40 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Week of</span>
                <div className="w-40">
                  <DatePickerCalendar
                    name="boardWeek"
                    value={boardWeek}
                    markedDates={plannedDates}
                    onChange={(e) => setBoardWeek(snapToMonday(e.target.value))}
                  />
                </div>
                <span className="text-xs text-ink-subtle font-semibold whitespace-nowrap">
                  {shortDate(boardWeek)} – {shortDate(addDays(boardWeek, 5))}
                </span>
              </div>

              {/* Day pills */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedDay("ALL")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    selectedDay === "ALL" ? "bg-primary text-white shadow-sm" : "bg-card-2 text-ink-muted hover:text-ink border border-line-soft"
                  }`}
                >All Days</button>
                {DAY_NAMES.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day === selectedDay ? "ALL" : day)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      selectedDay === day ? "bg-primary text-white shadow-sm" : "bg-card-2 text-ink-muted hover:text-ink border border-line-soft"
                    }`}
                  >
                    {day.slice(0, 3)} {new Date(boardWeekDates[i] + "T00:00:00").getDate()}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5 ml-auto flex-wrap">
                {[
                  { label: "Draft", dot: "bg-amber-400" }, { label: "Planned", dot: "bg-sky-400" },
                  { label: "In Progress", dot: "bg-indigo-400" },
                  { label: "Completed", dot: "bg-emerald-400" }, { label: "Stopped", dot: "bg-rose-400" },
                  { label: "RM Issued", dot: RM_ISSUED_DOT },
                ].map(({ label, dot }) => (
                  <span key={label} className="flex items-center gap-1 text-[9px] font-semibold text-ink-subtle">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />{label}
                  </span>
                ))}
                <div className="h-4 w-px bg-line-soft/80 mx-1" />
                <div className="flex items-center gap-1.5">
                  {can("daily-machine-planning.create") && (
                    <CustomButton
                      text="Issue Raw Materials"
                      icon={FaBoxOpen}
                      variant="secondary"
                      onClick={() => {
                        const d = new Date();
                        setDailyRmIssueDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
                        setShowDailyRmIssueModal(true);
                      }}
                    />
                  )}
                  {can("daily-machine-planning.edit") && (
                    <EditButton
                      onClick={handleEditWeek}
                      disabled={weekPlans.length === 0}
                      disabledMessage="No plans to edit for this week"
                    />
                  )}
                  {can("daily-machine-planning.delete") && (
                    <DeleteButton
                      onClick={() => {
                        if (hasNonDraftOrPlannedShifts) {
                          toast.error("Cannot delete: This week contains shifts that are already in progress, completed, or stopped.");
                          return;
                        }
                        setShowDeleteWeekModal(true);
                      }}
                      disabled={weekPlans.length === 0 || hasNonDraftOrPlannedShifts}
                      disabledMessage={
                        weekPlans.length === 0
                          ? "No plans to delete for this week"
                          : "Cannot delete: This week contains shifts that are in progress, completed, or stopped"
                      }
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ══ BOARD VIEW ═══════════════════════════════════════ */}
            <div className="flex-1 overflow-auto px-6 pb-6 pt-2">
              <div className="overflow-x-auto rounded-xl border border-line-soft h-full">
                <table
                  className="border-collapse text-xs h-full"
                  style={{ width: "100%", minWidth: filteredDays.length === 1 ? "420px" : `${Math.max(900, filteredDays.length * 240)}px` }}
                >
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-card-2 border-b border-line-soft">
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-ink-subtle uppercase tracking-wider w-36 border-r border-line-soft sticky left-0 bg-card-2 z-30">
                        Machine
                      </th>
                      {filteredDays.map((day) => (
                        <th key={day} colSpan={2} className="px-3 py-2.5 text-center text-[10px] font-bold text-ink-subtle uppercase tracking-wider border-r border-line-soft">
                          <div className="text-ink font-extrabold text-[11px]">{day.slice(0, 3).toUpperCase()}</div>
                          <div className="text-ink-subtle font-semibold">{shortDate(dayDates[day])}</div>
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-card-2/80 border-b border-line-soft">
                      <th className="sticky left-0 bg-card-2/80 z-30 border-r border-line-soft" />
                      {filteredDays.flatMap((day) =>
                        SHIFT_SLOTS.map((slot) => (
                          <th key={`${day}-${slot}`} className={`px-2 py-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-ink-subtle/80 ${slot === "NIGHT" ? "border-r border-line-soft" : "border-r border-dashed border-line-soft/40"}`}>
                            {slot === "DAY" ? "☀ Day" : "☾ Night"}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {allowedMachines.length === 0 ? (
                      <tr><td colSpan={1 + filteredDays.length * 2} className="py-16 text-center text-ink-subtle text-sm">
                        <FaIndustry className="mx-auto mb-2 opacity-20" size={32} /> No machines found
                      </td></tr>
                    ) : allowedMachines.map((machine: any, mIdx: number) => {
                      const machinePlans = boardMap[machine.machineId];
                      const rowBg = mIdx % 2 === 0 ? "bg-card" : "bg-card-2/20";
                      return (
                        <tr key={machine.machineId} className={`${rowBg} border-b border-line-soft/40 hover:bg-primary/5 transition-colors group`}>
                          <td className={`px-3 py-3 border-r border-line-soft sticky left-0 ${rowBg} z-10 group-hover:bg-primary/5`}>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <FaIndustry className="text-primary" size={11} />
                              </div>
                              <div>
                                <div className="font-bold text-ink text-[11px] leading-tight">{machine.machineName}</div>
                                <div className="text-[9px] text-ink-subtle font-medium">{machine.machineId}</div>
                              </div>
                            </div>
                          </td>
                          {filteredDays.flatMap((day) =>
                            SHIFT_SLOTS.map((slot) => {
                              const cellPlans: any[] = machinePlans?.[day]?.[slot] ?? [];
                              const isNight = slot === "NIGHT";
                              return (
                                <td
                                  key={`${day}-${slot}`}
                                  className={`px-1.5 py-1.5 align-top ${isNight ? "border-r border-line-soft" : "border-r border-dashed border-line-soft/40"}`}
                                  style={{ verticalAlign: "top", minWidth: filteredDays.length === 1 ? "160px" : "110px" }}
                                >
                                  {cellPlans.length === 0 ? (
                                    <div className="board-empty-cell h-14 rounded-lg border border-dashed border-line-soft/30 flex items-center justify-center">
                                      <span className="text-[9px] text-ink-subtle/25 font-semibold">—</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      {cellPlans.map((plan: any) => {
                                        const produced       = calcProduced(plan);
                                        const planned        = Number(plan.plannedQty || 0);
                                        const pct            = planned > 0 ? Math.min(100, Math.round((produced / planned) * 100)) : 0;
                                        const loggedCount    = countLoggedEntries(plan);
                                        const isCompleted    = plan.status === "COMPLETED";
                                        const isStopped      = plan.status === "STOPPED" || plan.status === "SHORT_CLOSED" || plan.status === "CANCELLED";
                                        const isPostProd     = plan.status === "POST_PRODUCTION";
                                        const isDraft        = !isCompleted && !isStopped && !isPostProd && (plan.status === "DRAFT" || hasDraftHourly(plan));
                                        const isInProgress   = !isCompleted && !isStopped && !isPostProd && !isDraft && (plan.status === "IN_PROGRESS" || pct > 0);

                                        const colorCard = isCompleted
                                          ? "bg-emerald-500/15 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.10)]"
                                          : isStopped
                                          ? "bg-rose-500/15 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.10)]"
                                          : isPostProd
                                          ? "bg-purple-500/15 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.10)]"
                                          : isDraft
                                          ? "bg-amber-500/10 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.05)]"
                                          : isInProgress
                                          ? "bg-indigo-500/10 border border-indigo-500/25"
                                          : "bg-card border border-line-soft";

                                        const dot = isCompleted
                                          ? "bg-emerald-400 ring-2 ring-emerald-400/40"
                                          : isStopped
                                          ? "bg-rose-400 ring-2 ring-rose-400/40"
                                          : isPostProd
                                          ? "bg-purple-400 ring-2 ring-purple-400/40"
                                          : isDraft
                                          ? "bg-amber-400"
                                          : isInProgress
                                          ? "bg-indigo-400 ring-2 ring-indigo-400/30"
                                          : (rmIssuedDates.has(dayDates[day]) ? RM_ISSUED_DOT : (STATUS_BOARD_DOT[plan.status] ?? "bg-zinc-400"));

                                        return (
                                          <div
                                            key={plan.dailyPlanId}
                                            onClick={() => handleCardClick(plan)}
                                            onContextMenu={(e) => handleContextMenu(e, plan)}
                                            className={`plan-card rounded-lg px-2 py-2 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all ${colorCard}`}
                                          >
                                            <div className="flex items-center justify-between mb-1 gap-1">
                                              <span className={`text-[8.5px] font-mono font-bold truncate flex-1 ${isCompleted ? "text-emerald-300/90" : isStopped ? "text-rose-300/90" : isPostProd ? "text-purple-300/90" : isDraft ? "text-amber-300/80" : "text-ink-subtle"}`}>{plan.productionOrderId}</span>
                                              <div className="flex items-center gap-1 shrink-0">
                                                {isDraft && (
                                                  <span
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                                                    title={`Draft Saved (${loggedCount} hours recorded)`}
                                                  >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                    Draft{loggedCount > 0 ? ` (${loggedCount}h)` : ""}
                                                  </span>
                                                )}

                                                <span
                                                  className={`w-1.5 h-1.5 rounded-full ${dot}`}
                                                  title={isCompleted ? "Production Completed (100%)" : isStopped ? "Production Stopped" : isPostProd ? "Post Production" : isDraft ? "Draft Saved" : rmIssuedDates.has(dayDates[day]) ? "RM Issued" : `Status: ${plan.status}`}
                                                />
                                              </div>
                                            </div>
                                            <div className={`text-[10px] font-bold leading-tight line-clamp-1 mb-1.5 ${isCompleted ? "text-emerald-200" : isStopped ? "text-rose-200" : isPostProd ? "text-purple-200" : "text-ink"}`}>{plan.productionOrder?.productItem?.productName || "—"}</div>
                                            <div className="flex items-center justify-between gap-1 mb-1">
                                              <span className={`text-[9px] font-semibold ${isCompleted ? "text-emerald-300/80" : isStopped ? "text-rose-300/80" : isPostProd ? "text-purple-300/80" : "text-ink-subtle"}`}>{planned} pcs</span>
                                              <span className={`text-[9px] font-extrabold ${isCompleted ? "text-emerald-400" : isStopped ? "text-rose-400" : isPostProd ? "text-purple-300" : isDraft ? "text-amber-300" : pct >= 50 ? "text-indigo-300" : "text-ink"}`}>{pct}%</span>
                                            </div>
                                            <div className="w-full h-1 bg-black/10 rounded-full overflow-hidden">
                                              <div className={`h-full rounded-full ${isCompleted ? "bg-emerald-500" : isStopped ? "bg-rose-500" : isPostProd ? "bg-purple-500" : isDraft ? "bg-amber-400" : pct >= 50 ? "bg-indigo-400" : "bg-sky-400"}`} style={{ width: `${pct}%` }} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              );
                            })
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

        {/* ══ CONTEXT MENU (Right Click on Card) ══════════════ */}
        {contextMenu && (
          <div
            className="fixed z-50 bg-card/95 border border-line shadow-2xl rounded-xl p-1.5 min-w-[230px] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 divide-y divide-line-soft/40"
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-ink-subtle">{contextMenu.plan.productionOrderId}</div>
              <div className="text-xs font-bold text-ink truncate">{contextMenu.plan.productionOrder?.productItem?.productName || "Plan Details"}</div>
              <div className="text-[10px] text-ink-subtle mt-0.5">
                {contextMenu.plan.plannedQty} pcs • {contextMenu.plan.shift?.shiftName || contextMenu.plan.shiftId}
              </div>
            </div>

            <div className="py-1 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  const p = contextMenu.plan;
                  setContextMenu(null);
                  setSelectedDailyPlanForView(p);
                  setShowDailyPlanViewModal(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-ink hover:bg-sky-500/15 hover:text-sky-400 rounded-lg transition-colors cursor-pointer text-left"
              >
                <FaEye className="text-sky-400 shrink-0" size={13} />
                <span>View Hourly Entries & Details</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const p = contextMenu.plan;
                  setContextMenu(null);
                  handleCardClick(p);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-ink hover:bg-emerald-500/15 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer text-left"
              >
                <FaPencilAlt className="text-emerald-400 shrink-0" size={12} />
                <span>Enter / Edit Hourly Log</span>
              </button>
            </div>

            {/* {can("daily-machine-planning.delete") && (contextMenu.plan.status === "PLANNED" || contextMenu.plan.status === "IN_PROGRESS" || contextMenu.plan.status === "COMPLETED") && lastActivePlanIdByPO.get(contextMenu.plan.productionOrderId) === contextMenu.plan.dailyPlanId && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const p = contextMenu.plan;
                    setContextMenu(null);
                    setStopPlan(p);
                    setShowStopModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <FaStop className="text-rose-400 shrink-0" size={12} />
                  <span>Stop Production Plan</span>
                </button>
              </div>
            )} */}
          </div>
        )}

        {/* ══ MODALS ══════════════════════════════════════════ */}
        <CommonModal
          show={showStopModal}
          onHide={() => { setShowStopModal(false); setStopPlan(null); }}
          title={<div className="flex items-center gap-2.5"><span className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500"><FaStop size={12} /></span><span className="text-base font-bold text-ink">Stop Production Plan</span></div>}
          maxWidth="3xl"
          footer={<div className="flex items-center justify-end gap-2.5"><CustomButton text="Cancel" variant="secondary" onClick={() => { setShowStopModal(false); setStopPlan(null); }} disabled={isStopping} /><CustomButton text={isStopping ? "Stopping..." : "Stop Production"} variant="danger" onClick={confirmStopProduction} disabled={isStopping || !stopReason.trim()} /></div>}
        >
          {(() => {
            return (
              <div className="text-sm flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-ink-muted leading-relaxed">You are about to stop plan <strong className="text-ink font-mono bg-card-2 px-2 py-0.5 rounded border border-line-soft">{stopPlan?.dailyPlanId}</strong> prematurely.</p>
                  <div className="text-xs text-ink-subtle bg-card-2/60 p-3 rounded-xl border border-line-soft flex items-start gap-2.5">
                    <FaInfoCircle className="text-amber-400 shrink-0 mt-0.5" size={14} />
                    <span>Logged entries: <strong className="text-amber-400">{countLoggedEntries(stopPlan)}</strong>. Planned hours will be adjusted.</span>
                  </div>
                  {(() => {
                    const poTarget = Number(stopPlan?.productionOrder?.targetQty || 0);
                    const poProduced = Number(stopPlan?.productionOrder?.producedQty || 0);
                    const poCancelled = Math.max(0, poTarget - poProduced);
                    if (poTarget <= 0) return null;
                    return (
                      <div className="text-xs bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex items-start gap-2.5 mt-2">
                        <FaExclamationTriangle className="text-rose-400 shrink-0 mt-0.5" size={14} />
                        <span className="text-rose-300">
                          This Production Order will close at <strong className="text-rose-400">{poProduced.toLocaleString()}</strong> of its <strong>{poTarget.toLocaleString()}</strong> pcs target.
                          {poCancelled > 0 && <> The remaining <strong className="text-rose-400">{poCancelled.toLocaleString()} pcs</strong> will be cancelled — every not-yet-run shift for this order is stopped too, and this order can't be scheduled again later.</>}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                {(() => {
                  const rel = allPlans.filter((p: any) => p.productionOrderId === stopPlan?.productionOrderId && p.dailyPlanId !== stopPlan?.dailyPlanId).sort((a: any, b: any) => new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime());
                  if (!rel.length) return null;
                  const hCols: DataTableColumn<any>[] = [
                    { header: "Date",    render: (r) => <span className="text-ink-subtle">{r.productionDate?.split("T")[0] || "—"}</span> },
                    { header: "Plan ID", render: (r) => <span className="font-mono text-ink-muted">{r.dailyPlanId}</span> },
                    { header: "Planned", accessor: "plannedQty", align: "right" },
                    { header: "Produced", align: "right", render: (r) => <span className="text-cyan-400">{calcProduced(r)}</span> },
                    { header: "Status",  align: "center", render: (r) => <span className="text-[10px] font-bold px-2 py-0.5 bg-card-2 border border-line-soft rounded text-ink-muted">{r.status.replace(/_/g, " ")}</span> },
                  ];
                  return <div className="bg-card-2/40 border border-line-soft rounded-xl p-3.5"><h6 className="font-bold text-ink-subtle text-xs uppercase tracking-wider mb-2.5">Production Order History</h6><div className="max-h-36 overflow-y-auto rounded-lg border border-line-soft"><DataTable columns={hCols} data={rel} rowKey={(r) => r.dailyPlanId} density="compact" /></div></div>;
                })()}
                <TextArea label="Reason for Stopping" name="stopReason" value={stopReason} onChange={(e) => setStopReason(e.target.value)} placeholder="e.g. Urgent production order PO-XXX required on this machine" rows={3} required />
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-extrabold uppercase tracking-[0.5px] text-ink">Stop Action</label>
                  <div className="border rounded-xl p-3.5 flex flex-col border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/30">
                    <div className="flex items-center gap-2.5 font-semibold text-sm">
                      <FaStop className="text-rose-400 shrink-0" size={12} />
                      <span className="text-rose-400">Permanent Stop (Close PO)</span>
                    </div>
                    <span className="text-xs text-ink-subtle mt-2 pl-6 leading-relaxed">
                      Stops this plan, cancels every remaining not-yet-run shift for this Production Order, and closes it out at whatever quantity was actually produced.
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </CommonModal>

        <CommonConfirmModal show={showStatusModal} onHide={() => { setShowStatusModal(false); setStatusChangePlan(null); }} onConfirm={confirmStatusChange} title={`Change to ${STATUS_FLOW[STATUS_FLOW[statusChangePlan?.status]?.next ?? ""]?.label || "Next Status"}`} message={`Move this plan from "${STATUS_FLOW[statusChangePlan?.status]?.label || statusChangePlan?.status}" to "${STATUS_FLOW[STATUS_FLOW[statusChangePlan?.status]?.next ?? ""]?.label || ""}"?`} confirmText="Confirm" confirmVariant="success" />
        {showMaterialIssueModal && materialIssuePlan && (
          <MaterialIssueModal show={showMaterialIssueModal} onHide={() => { setShowMaterialIssueModal(false); setMaterialIssuePlan(null); }} productionOrderId={materialIssuePlan.productionOrderId} rawMaterials={materialIssuePlan.productionOrder?.draftRawMaterials || materialIssuePlan.productionOrder?.rawMaterials || []} rawMaterialsMap={rawMaterialsMap} defaultStoreId={materialIssuePlan.productionOrder?.sourceStoreId} dailyPlanQty={Number(materialIssuePlan.plannedQty || 0)} totalTargetQty={Number(materialIssuePlan.productionOrder?.targetQty || 0)} onSuccess={handleMaterialIssueSuccess} />
        )}
        <ProductionOrderViewModal show={showPOViewModal} onHide={() => { setShowPOViewModal(false); setSelectedPOForView(null); }} order={selectedPOForView} />
        <DailyPlanViewModal show={showDailyPlanViewModal} onHide={() => { setShowDailyPlanViewModal(false); setSelectedDailyPlanForView(null); }} plan={selectedDailyPlanForView} />
        <DailyRawMaterialIssueModal
          show={showDailyRmIssueModal}
          onHide={() => setShowDailyRmIssueModal(false)}
          defaultDate={dailyRmIssueDate}
          onSuccess={() => { loadDailyPlans(); fetchRmIssuedDates(boardWeek); }}
        />

        {/* ── Week Selection Modal (Add New Plan) ─────────── */}
        {showWeekSelectModal && (() => {
          const ws = snapToMonday(weekSelectDate);
          const we = addDays(ws, 5);
          return (
          <CommonModal
            show={showWeekSelectModal}
            onHide={() => setShowWeekSelectModal(false)}
            title="New Daily Plan"
            maxWidth="sm"
            footer={
              <div className="flex items-center justify-end gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setShowWeekSelectModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-line text-ink-subtle hover:text-ink hover:bg-card-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                {weekCheckLoading && (
                  <span className="text-xs text-ink-subtle flex items-center gap-1.5 px-3">
                    <FaSpinner className="animate-spin" size={11} /> Checking…
                  </span>
                )}
                {weekCheckResult && !weekCheckResult.exists && (
                  <button
                    type="button"
                    onClick={() => { setShowWeekSelectModal(false); navigate(`/daily-production-plans/create?week=${weekCheckResult!.weekStart}`); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/90 transition-all cursor-pointer"
                  >
                    <FaPlus size={10} /> Create Plan
                  </button>
                )}
                {weekCheckResult && weekCheckResult.exists && (
                  <button
                    type="button"
                    onClick={() => { setShowWeekSelectModal(false); navigate(`/daily-production-plans/create?week=${weekCheckResult!.weekStart}`, { state: { weekStart: weekCheckResult!.weekStart, isEdit: true } }); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-sky-500 text-white hover:bg-sky-400 transition-all cursor-pointer"
                  >
                    <FaEye size={10} /> View / Edit Plan
                  </button>
                )}
              </div>
            }
          >
            <div className="flex flex-col gap-3 py-1">

              {/* Date picker */}
              <div>
                <label className="block text-xs font-semibold text-ink-subtle mb-1.5">
                  Select any date within the planning week
                </label>
                <DatePickerCalendar
                  name="weekSelectDate"
                  value={weekSelectDate}
                  onChange={(e) => setWeekSelectDate(e.target.value)}
                  placeholder="Select date..."
                />
              </div>

              {/* Computed week range */}
              <div className="flex items-center gap-2 px-3 py-2 bg-card-2 border border-line-soft rounded-lg">
                <FaCalendarAlt size={11} className="text-primary shrink-0" />
                <span className="text-xs font-semibold text-ink">
                  Planning Week:&nbsp;
                  <span className="text-primary">{shortDate(ws)} – {shortDate(we)}</span>
                </span>
                <span className="text-[10px] text-ink-subtle ml-auto">Mon – Sat</span>
              </div>

              {/* Status badge */}
              {!weekCheckLoading && weekCheckResult && (
                weekCheckResult.exists ? (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8">
                    <FaExclamationTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-amber-400">Already Planned</div>
                      <div className="text-[11px] text-ink-subtle mt-0.5">
                        {weekCheckResult.planCount} shift{weekCheckResult.planCount !== 1 ? "s" : ""} exist
                        {weekCheckResult.machines.length > 0 ? ` across ${weekCheckResult.machines.length} machine${weekCheckResult.machines.length !== 1 ? "s" : ""}` : ""}.
                        {" "}Use "View / Edit Plan" to modify.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/8">
                    <FaCheckCircle size={13} className="text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-emerald-400">Week Available</div>
                      <div className="text-[11px] text-ink-subtle mt-0.5">No plan found for this week. Ready to create.</div>
                    </div>
                  </div>
                )
              )}
            </div>
          </CommonModal>
          );
        })()}

        {/* ── Delete Week Plan Modal ───────────────────────── */}
        <CommonConfirmModal
          show={showDeleteWeekModal}
          onHide={() => { if (!isDeletingWeek) setShowDeleteWeekModal(false); }}
          onConfirm={handleDeleteWeekConfirm}
          title="Delete Week's Daily Plans"
          message={`Are you sure you want to delete all daily production plans for the week of ${shortDate(boardWeek)} – ${shortDate(addDays(boardWeek, 5))} (${weekPlans.length} shifts)?`}
          warningText={
            hasNonDraftOrPlannedShifts
              ? "Cannot delete: One or more shifts are already in progress, completed, or stopped."
              : "Only Draft or Planned shifts will be deleted. This action cannot be undone."
          }
          confirmText="Delete Week Plan"
          confirmVariant="danger"
          isLoading={isDeletingWeek}
          confirmDisabled={isDeletingWeek || weekPlans.length === 0 || hasNonDraftOrPlannedShifts}
        />
      </div>
    </div>
  );
};

export default DailyProductionPlanningPage;

