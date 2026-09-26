import React, { useState, useEffect, useMemo, useCallback } from "react";

import CommonModal from "../../../components/ui/Modal/CommonModal";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaPlus, FaStop, FaCalendarAlt,
  FaCheckCircle, FaChartBar, FaBoxOpen,
  FaEye, FaExclamationTriangle, FaSpinner,
} from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchDailyPlans, updateDailyPlan, dailyPlanCreated, dailyPlanUpdated, dailyPlanDeleted } from "../../../features/daily-plans/dailyPlanSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";
import CustomButton from "../../../components/ui/Button/Button";
import { dailyPlanService } from "../../../services/dailyPlanService";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import TextArea from "../../../components/form/TextArea/TextArea";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { usePermission } from "../../../hooks/usePermission";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import DailyRawMaterialIssueModal from "../components/DailyRawMaterialIssueModal";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import DailyProductionBoard, {
  DAY_NAMES,
  type DayName,
  type ShiftSlot,
  shortDate,
  calcProduced,
  countLoggedEntries,
} from "../components/DailyProductionBoard";

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

// ── Component ────────────────────────────────────────────────
const DailyProductionPlanningPage: React.FC = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const dispatch   = useAppDispatch();
  const { can }    = usePermission();

  const { data: machines }   = useAppSelector((state: any) => state.machines);
  const { data: dailyPlans } = useAppSelector((state: any) => state.dailyPlans);

  // ── Board state ───────────────────────────────────────────
  const [boardWeek,    setBoardWeek]    = useState<string>(getTodayMonday());
  const [selectedDay,  setSelectedDay]  = useState<DayName | "ALL">("ALL");

  // ── Modals ────────────────────────────────────────────────
  const [showStatusModal,          setShowStatusModal]          = useState(false);
  const [showStopModal,            setShowStopModal]            = useState(false);
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

  // ── Global Keyboard & Click Listeners ─────────────────────────────────
  // Closes the card right-click context menu, week selection modal, or resets
  // day filter to "ALL" when the Escape key is pressed or user clicks outside.
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null);
        } else if (showWeekSelectModal) {
          setShowWeekSelectModal(false);
        } else if (selectedDay !== "ALL") {
          setSelectedDay("ALL");
        }
      }
    };
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleClickOutside, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", handleClickOutside, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu, showWeekSelectModal, selectedDay]);

  // ── Load Raw Materials Map ─────────────────────────────────────────────
  // Loads all raw materials on component mount and builds a lookup Map
  // (ID -> Material) for quick stock checking and material issuance.
  useEffect(() => {
    rawMaterialService.fetchAll().then((res) => {
      const map = new Map();
      const list = Array.isArray(res) ? res : ((res as any)?.rawMaterials ?? []);
      list.forEach((rm: any) => map.set(rm.rawMaterialId?.toString(), rm));
      setRawMaterialsMap(map);
    }).catch(console.error);
  }, []);

  // ── Auto-Check Week Availability ───────────────────────────────────────
  // Checks if plans already exist for the selected week whenever the "New Daily Plan"
  // modal is opened or the chosen date changes, allowing Create vs View/Edit flow.
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

  // ── Initial Machine Data Fetch ──────────────────────────────────────────
  // Fetches available production machines from the Redux store on mount.
  useEffect(() => {
    dispatch(fetchMachines({ limit: 1000 }));
  }, [dispatch]);

  // ── Load / Refresh Daily Plans ──────────────────────────────────────────
  // Dispatches Redux action to load or re-fetch all daily production plans.
  const loadDailyPlans = useCallback(() => {
    dispatch(fetchDailyPlans(undefined));
  }, [dispatch]);

  // Re-fetch daily plans whenever route or location key changes
  useEffect(() => { loadDailyPlans(); }, [loadDailyPlans, location.key]);

  // ── Realtime WebSocket Synchronizations ────────────────────────────────
  // Listens to socket events and automatically refreshes daily plans when
  // plans, hourly logs, weekly programs, or orders are updated.
  useSocketSync("dailyPlan", { created: dailyPlanCreated, updated: dailyPlanUpdated, deleted: dailyPlanDeleted }, loadDailyPlans);
  useSocketSync("hourlyProduction", undefined, loadDailyPlans);
  useSocketSync("weeklyProgram",    undefined, loadDailyPlans);
  useSocketSync("productionOrder",  undefined, loadDailyPlans);

  // ── Fetch RM-Issued Dates ──────────────────────────────────────────────
  // Fetches which dates in the active board week have raw materials already issued,
  // preventing operators from recording production before materials are handed out.
  const fetchRmIssuedDates = useCallback((week: string) => {
    dailyPlanService.getRmIssuedDates(week)
      .then((dates) => setRmIssuedDates(new Set(dates)))
      .catch(() => {});
  }, []);

  // Re-fetch RM issued status whenever the selected board week changes
  useEffect(() => { fetchRmIssuedDates(boardWeek); }, [boardWeek, fetchRmIssuedDates]);

  // ── Derived State & Board Calculations ─────────────────────────────────
  // Sanitizes daily plans from Redux state into a safe array
  const allPlans = useMemo(() => Array.isArray(dailyPlans) ? dailyPlans : [], [dailyPlans]);

  // All planned dates used to highlight dots in the week calendar picker
  const plannedDates = useMemo(() =>
    allPlans
      .filter((p: any) => p.status !== "CANCELLED")
      .map((p: any) => normalizeDateStr(p.productionDate))
      .filter(Boolean),
    [allPlans]
  );

  // Array of 6 date strings (Monday through Saturday) for the active board week
  const boardWeekDates = useMemo(() => DAY_NAMES.map((_, i) => addDays(boardWeek, i)), [boardWeek]);

  // Reset day filter to "ALL" whenever the user picks a new week
  useEffect(() => { setSelectedDay("ALL"); }, [boardWeek]);

  // Filters days shown on the board (either all days Monday-Saturday or a single selected day)
  const filteredDays = useMemo<readonly DayName[]>(() =>
    selectedDay === "ALL" ? DAY_NAMES : [selectedDay as DayName], [selectedDay]);

  // Mapping from DayName ("Monday", "Tuesday", etc.) to YYYY-MM-DD date string
  const dayDates = useMemo(() => {
    const m: Record<DayName, string> = {} as any;
    DAY_NAMES.forEach((d, i) => { m[d] = boardWeekDates[i]; });
    return m;
  }, [boardWeekDates]);

  // ── Core Planning Board Matrix (boardMap) ──────────────────────────────
  // Groups plans by Machine ID -> Day Name -> Shift Slot ("DAY" or "NIGHT").
  // Filters out unstarted plans if the parent Production Order is already closed or stopped.
  const boardMap = useMemo(() => {
    const map: Record<string, Record<DayName, Record<ShiftSlot, any[]>>> = {};
    allPlans.forEach((plan: any) => {
      const planDate = plan.productionDate?.split("T")[0];
      if (!planDate) return;

      // Unstarted plans for stopped/closed POs should be omitted from the board so the slot shows empty (-)
      const poStatus = plan.productionOrder?.status;
      const isClosedPO = ["COMPLETED_WITH_SHORTFALL", "CLOSED", "READY_FOR_DISPATCH", "DISPATCHED", "STOPPED", "CANCELLED"].includes(poStatus);
      const isUnstartedStatus = ["DRAFT", "PLANNED", "APPROVED"].includes(plan.status);
      const produced = calcProduced(plan);
      if (isClosedPO && isUnstartedStatus && produced === 0) return;

      const dayIdx = boardWeekDates.indexOf(planDate);
      if (dayIdx < 0) return;
      const dayName = DAY_NAMES[dayIdx];
      const shiftStr = `${plan.shiftId || ""} ${plan.shift?.shiftName || ""} ${plan.shift?.shiftCode || ""}`.toLowerCase();
      const isNight = shiftStr.includes("night") || shiftStr.includes("eve") || shiftStr.includes("second") || shiftStr.includes("2") || plan.shiftId === "NIGHT";
      const slot: ShiftSlot = isNight ? "NIGHT" : "DAY";
      const mid = plan.machineId;
      if (!map[mid]) { map[mid] = {} as any; DAY_NAMES.forEach((d) => { map[mid][d] = { DAY: [], NIGHT: [] }; }); }
      map[mid][dayName][slot].push(plan);
    });
    return map;
  }, [allPlans, boardWeekDates]);

  // ── Week-Filtered Plans ────────────────────────────────────────────────
  // Returns all active shift plans belonging to the currently selected Monday-Saturday week.
  const weekPlans = useMemo(() =>
    allPlans.filter((p: any) => {
      const planDate = p.productionDate?.split("T")[0];
      if (!boardWeekDates.includes(planDate)) return false;
      const poStatus = p.productionOrder?.status;
      const isClosedPO = ["COMPLETED_WITH_SHORTFALL", "CLOSED", "READY_FOR_DISPATCH", "DISPATCHED", "STOPPED", "CANCELLED"].includes(poStatus);
      const isUnstartedStatus = ["DRAFT", "PLANNED", "APPROVED"].includes(p.status);
      const produced = calcProduced(p);
      if (isClosedPO && isUnstartedStatus && produced === 0) return false;
      return true;
    })
  , [allPlans, boardWeekDates]);

  // ── Shift Progress Guard ───────────────────────────────────────────────
  // Checks if any shift in the week has already started, completed, or stopped,
  // preventing accidental deletion of the week plan once production is underway.
  const hasNonDraftOrPlannedShifts = useMemo(() =>
    weekPlans.some((p: any) => p.status !== "DRAFT" && p.status !== "PLANNED")
  , [weekPlans]);

  // ── Find Eligible Shift for Permanent Stop ──────────────────────────────
  // For each Production Order, finds the chronologically LAST shift that has active work
  // (logged hours, produced > 0, or IN_PROGRESS) so "Stop Production" is only offered there.
  const lastActivePlanIdByPO = useMemo(() => {
    const getShiftTime = (sId?: string) => {
      if (!sId) return "08:00";
      const s = sId.toUpperCase();
      return (s.includes("NIGHT") || s.includes("2")) ? "20:00" : "08:00";
    };

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
        const timeA = getShiftTime(a.shiftId);
        const timeB = getShiftTime(b.shiftId);
        return timeA < timeB ? -1 : timeA > timeB ? 1 : 0;
      });

      // Prefer the last shift that has real activity (entries logged, produced > 0, or currently running)
      let lastActive = [...sorted].reverse().find((p: any) => countLoggedEntries(p) > 0 || calcProduced(p) > 0 || p.status === "IN_PROGRESS");
      // If no shift has production activity logged yet, allow Stop on the first shift of the PO
      if (!lastActive && sorted.length > 0) {
        lastActive = sorted[0];
      }
      if (lastActive) result.set(poId, lastActive.dailyPlanId);
    });
    return result;
  }, [allPlans]);

  // ── Action Handlers ────────────────────────────────────────────────────

  // ── Handle Card Click (Navigate to Hourly Production Log) ───────────────
  // Verifies that raw materials have been issued for the shift date before navigating.
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

  // ── Handle Card Right-Click (Open Context Menu) ─────────────────────────
  // Captures right-click on a shift card to display View & Stop action buttons.
  const handleContextMenu = useCallback((e: React.MouseEvent, plan: any) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 240);
    setContextMenu({ x, y, plan });
  }, []);

  // ── Navigate to Weekly Plan Edit Page ──────────────────────────────────
  // Opens the multi-machine weekly matrix creation form in Edit mode.
  const handleEditWeek = useCallback(() => {
    navigate(`/daily-production-plans/create?week=${boardWeek}`, {
      state: { weekStart: boardWeek, isEdit: true, existingPlans: weekPlans }
    });
  }, [navigate, boardWeek, weekPlans]);

  // ── Keyboard Shortcuts (Page Level) ────────────────────────────────────
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
  });

  // ── Keyboard Shortcuts (Modal Form Level) ──────────────────────────────
  useFormShortcuts({
    onSave: () => {
      if (showStopModal && !isStopping) {
        confirmStopProduction();
      } else if (showStatusModal) {
        confirmStatusChange();
      }
    },
  });

  // ── Open Week Selection Modal (New Daily Plan) ─────────────────────────
  const openCreateForm = () => {
    setWeekSelectDate(todayStr());
    setWeekCheckResult(null);
    setShowWeekSelectModal(true);
  };

  // ── Confirm Bulk Delete of Current Week Plan ───────────────────────────
  // Deletes all unstarted (DRAFT/PLANNED) shifts for the active week.
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

  // ── Handle Post-Material Issuance Success ──────────────────────────────
  // Automatically moves shift status to IN_PROGRESS after raw materials are handed over.
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

  // ── Confirm Shift Status Change ────────────────────────────────────────
  // Advances shift plan to its next workflow state (e.g. DRAFT -> PLANNED -> IN_PROGRESS).
  const confirmStatusChange = async () => {
    const nextStatus = STATUS_FLOW[statusChangePlan?.status]?.next;
    if (!statusChangePlan || !nextStatus) return;
    try {
      await dispatch(updateDailyPlan({ id: statusChangePlan.dailyPlanId, data: { status: nextStatus } })).unwrap();
      toast.success(`Status updated to ${STATUS_FLOW[nextStatus]?.label || nextStatus}`);
      setShowStatusModal(false); setStatusChangePlan(null); loadDailyPlans();
    } catch (err: any) { toast.error(err || "Failed to update status"); }
  };

  // ── Confirm Permanent Stop of Production Plan ──────────────────────────
  // Permanently stops the current shift and cancels all remaining unstarted shifts for the PO.
  const confirmStopProduction = async () => {
    if (!stopPlan || !stopReason.trim()) { toast.error("Please enter a reason."); return; }
    setIsStopping(true);
    try {
      const logged = countLoggedEntries(stopPlan);
      const remarks = stopPlan.remarks ? `${stopPlan.remarks} | Permanently Stopped: ${stopReason.trim()}` : `Permanently Stopped: ${stopReason.trim()}`;
      const payload: any = {
        status: "STOPPED",
        remarks,
        plannedHours: logged > 0 ? logged : stopPlan.plannedHours,
        shortClosePO: true,
      };
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

  // ── Allowed Active Machines ────────────────────────────────────────────
  // Excludes inactive or disabled test machines (such as MAC-001) from the board view.
  const allowedMachines = useMemo(() =>
    (machines || []).filter((m: any) => m.machineId !== "MAC-001"), [machines]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)] flex-1 w-full">
      <div className="w-full bg-card rounded-2xl shadow-sm border border-line flex flex-col flex-1 overflow-hidden">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-6 py-3 border-b border-line shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-base font-bold text-ink m-0">Daily Production Planning</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {can("daily-machine-planning.view") && (
              <CustomButton text="Daily Report" icon={FaChartBar} onClick={() =>
                navigate("/daily-machine-planning/report", { state: { dailyPlans, machines } })
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
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedDay("ALL")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer select-none ${
                    selectedDay === "ALL"
                      ? "bg-primary text-white shadow-xs ring-1 ring-primary"
                      : "bg-white dark:bg-card-2 text-slate-700 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink border border-slate-200 dark:border-line-soft hover:bg-slate-50 dark:hover:bg-card-2/80"
                  }`}
                >
                  All Days
                </button>
                {DAY_NAMES.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day === selectedDay ? "ALL" : day)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap select-none ${
                      selectedDay === day
                        ? "bg-primary text-white shadow-xs ring-1 ring-primary"
                        : "bg-white dark:bg-card-2 text-slate-700 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink border border-slate-200 dark:border-line-soft hover:bg-slate-50 dark:hover:bg-card-2/80"
                    }`}
                  >
                    {day.slice(0, 3)} {new Date(boardWeekDates[i] + "T00:00:00").getDate()}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5 ml-auto flex-wrap">
                {[
                  { label: "Draft", dot: "bg-amber-500" },
                  { label: "Planned", dot: "bg-sky-500" },
                  { label: "Completed", dot: "bg-emerald-500" },
                  { label: "Stopped", dot: "bg-red-500" },
                  { label: "RM Issued", dot: "bg-violet-500" },
                ].map(({ label, dot }) => (
                  <span key={label} className="flex items-center gap-1.5 text-[9.5px] font-semibold text-slate-600 dark:text-ink-subtle">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                    {label}
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
                        let targetDate = boardWeek;
                        if (selectedDay !== "ALL" && dayDates[selectedDay]) {
                          targetDate = dayDates[selectedDay];
                        } else {
                          const firstPlanned = boardWeekDates.find((d) => plannedDates.includes(d));
                          if (firstPlanned) targetDate = firstPlanned;
                        }
                        setDailyRmIssueDate(targetDate);
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
            <DailyProductionBoard
              allowedMachines={allowedMachines}
              filteredDays={filteredDays}
              dayDates={dayDates}
              boardMap={boardMap}
              rmIssuedDates={rmIssuedDates}
              onCardClick={handleCardClick}
              onContextMenu={handleContextMenu}
            />

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
            {(() => {
              const plan = contextMenu.plan;
              const poStatus = plan?.productionOrder?.status;
              const isAlreadyStopped =
                ["STOPPED", "SHORT_CLOSED", "CANCELLED"].includes(plan?.status) ||
                ["COMPLETED_WITH_SHORTFALL", "CLOSED", "READY_FOR_DISPATCH", "DISPATCHED", "STOPPED", "CANCELLED"].includes(poStatus) ||
                Boolean(plan?.remarks?.includes("Permanently Stopped")) ||
                Boolean(plan?.remarks?.includes("Short Closed"));

              if (!can("daily-machine-planning.edit")) {
                return (
                  <div className="px-3 py-1.5 text-[11px] text-ink-subtle italic">
                    No permission to edit
                  </div>
                );
              }
              if (isAlreadyStopped) {
                return (
                  <div className="px-3 py-1.5 text-[11px] text-ink-subtle italic">
                    Plan is already stopped
                  </div>
                );
              }
              if (lastActivePlanIdByPO.get(plan.productionOrderId) !== plan.dailyPlanId) {
                return (
                  <div className="px-3 py-1.5 text-[11px] text-ink-subtle italic">
                    Stop only allowed on latest shift
                  </div>
                );
              }

              return (
                <div className="pt-1.5">
                  <CustomButton
                    text="Stop Production Plan"
                    icon={FaStop}
                    onClick={() => {
                      setContextMenu(null);
                      setStopPlan(plan);
                      setShowStopModal(true);
                    }}
                    variant="danger"
                    width="100%"
                    className="!justify-start text-xs font-semibold !h-9 !px-3"
                  />
                </div>
              );
            })()}
          </div>
        )}

        {/* ══ stop production MODALS ══════════════════════════════════════════ */}
        <CommonModal
          show={showStopModal}
          onHide={() => { setShowStopModal(false); setStopPlan(null); }}
          title="Stop Production Plan"
          maxWidth="3xl"
          footer={<div className="flex items-center justify-end gap-2.5"><CustomButton text="Cancel" variant="secondary" onClick={() => { setShowStopModal(false); setStopPlan(null); }} disabled={isStopping} /><CustomButton text={isStopping ? "Stopping..." : "Stop Production"} variant="danger" onClick={confirmStopProduction} disabled={isStopping || !stopReason.trim()} /></div>}
        >
          {(() => {
            return (
              <div className="text-sm flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-ink-muted leading-relaxed">You are about to stop plan <strong className="text-ink font-mono bg-card-2 px-2 py-0.5 rounded border border-line-soft">{stopPlan?.dailyPlanId}</strong> prematurely.</p>
                  {(() => {
                    const poTarget = Number(stopPlan?.productionOrder?.targetQty || 0);
                    const totalProducedAllPlans = allPlans
                      .filter((p: any) => p.productionOrderId === stopPlan?.productionOrderId)
                      .reduce((sum: number, p: any) => sum + calcProduced(p), 0);
                    const poProduced = Math.max(Number(stopPlan?.productionOrder?.producedQty || 0), totalProducedAllPlans);
                    const poCancelled = Math.max(0, poTarget - poProduced);
                    if (poTarget <= 0) return null;
                    return (
                      <div className="text-xs bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30 p-3 rounded-xl flex items-start gap-2.5 mt-2">
                        <FaExclamationTriangle className="text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" size={14} />
                        <span className="text-rose-700 dark:text-rose-300 leading-relaxed">
                          This Production Order will close at <strong className="text-rose-800 dark:text-rose-200 font-bold">{poProduced.toLocaleString()}</strong> of its <strong>{poTarget.toLocaleString()}</strong> pcs target.
                          {poCancelled > 0 && <> The remaining <strong className="text-rose-800 dark:text-rose-200 font-bold">{poCancelled.toLocaleString()} pcs</strong> will be cancelled — every not-yet-run shift for this order is stopped too, and this order can't be scheduled again later.</>}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                {(() => {
                  const rel = allPlans
                    .filter((p: any) => p.productionOrderId === stopPlan?.productionOrderId)
                    .sort((a: any, b: any) => {
                      const dateA = a.productionDate?.split("T")[0] || "";
                      const dateB = b.productionDate?.split("T")[0] || "";
                      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
                      const isNightA = (a.shiftId || "").toUpperCase().includes("NIGHT") || (a.shift?.shiftName || "").toUpperCase().includes("NIGHT");
                      const isNightB = (b.shiftId || "").toUpperCase().includes("NIGHT") || (b.shift?.shiftName || "").toUpperCase().includes("NIGHT");
                      return isNightA === isNightB ? 0 : isNightA ? 1 : -1;
                    });
                  if (!rel.length) return null;
                  const hCols: DataTableColumn<any>[] = [
                    { header: "Date",    render: (r) => <span className="text-ink-subtle font-medium">{r.productionDate?.split("T")[0] || "—"}</span> },
                    { header: "Shift",   render: (r) => <span className="text-ink font-semibold">{r.shift?.shiftName || r.shiftId || "—"}</span> },
                    { header: "Machine", render: (r) => <span className="text-ink font-semibold">{r.machine?.machineName || r.machineId || "—"}</span> },
                    { header: "Planned", accessor: "plannedQty", align: "right" },
                    { header: "Produced", align: "right", render: (r) => <span className="text-cyan-600 dark:text-cyan-400 font-bold">{calcProduced(r)}</span> },
                    { header: "Status",  align: "center", render: (r) => <span className="text-[10px] font-bold px-2 py-0.5 bg-card-2 border border-line-soft rounded text-ink-muted">{r.status.replace(/_/g, " ")}</span> },
                  ];
                  return (
                    <div className="bg-card-2/40 border border-line-soft rounded-xl p-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <h6 className="font-bold text-ink-subtle text-xs uppercase tracking-wider">Production Order History ({rel.length} Shifts)</h6>
                        <span className="text-[10px] text-ink-subtle font-medium">Scroll to view all shifts</span>
                      </div>
                      <div className="max-h-56 overflow-y-auto rounded-lg border border-line-soft custom-scrollbar">
                        <DataTable columns={hCols} data={rel} rowKey={(r) => r.dailyPlanId} density="compact" />
                      </div>
                    </div>
                  );
                })()}
                <TextArea label="Reason for Stopping" name="stopReason" value={stopReason} onChange={(e) => setStopReason(e.target.value)} placeholder="e.g. Urgent production order PO-XXX required on this machine" rows={3} required />
              </div>
            );
          })()}
        </CommonModal>

        <CommonConfirmModal show={showStatusModal} onHide={() => { setShowStatusModal(false); setStatusChangePlan(null); }} onConfirm={confirmStatusChange} title={`Change to ${STATUS_FLOW[STATUS_FLOW[statusChangePlan?.status]?.next ?? ""]?.label || "Next Status"}`} message={`Move this plan from "${STATUS_FLOW[statusChangePlan?.status]?.label || statusChangePlan?.status}" to "${STATUS_FLOW[STATUS_FLOW[statusChangePlan?.status]?.next ?? ""]?.label || ""}"?`} confirmText="Confirm" confirmVariant="success" />

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
              <div className="flex items-center justify-end gap-2.5 w-full">
                <CustomButton
                  text="Cancel"
                  variant="secondary"
                  onClick={() => setShowWeekSelectModal(false)}
                />
                {weekCheckLoading && (
                  <span className="text-xs text-ink-subtle flex items-center gap-1.5 px-3">
                    <FaSpinner className="animate-spin" size={11} /> Checking…
                  </span>
                )}
                {weekCheckResult && !weekCheckResult.exists && (
                  <CustomButton
                    text="Create Plan"
                    icon={FaPlus}
                    onClick={() => {
                      setShowWeekSelectModal(false);
                      navigate(`/daily-production-plans/create?week=${weekCheckResult!.weekStart}`);
                    }}
                  />
                )}
                {weekCheckResult && weekCheckResult.exists && (
                  <CustomButton
                    text="View / Edit Plan"
                    icon={FaEye}
                    onClick={() => {
                      setShowWeekSelectModal(false);
                      navigate(`/daily-production-plans/create?week=${weekCheckResult!.weekStart}`, {
                        state: { weekStart: weekCheckResult!.weekStart, isEdit: true },
                      });
                    }}
                  />
                )}
              </div>
            }
          >
            <div className="flex flex-col gap-3 py-1">

              {/* Date picker */}
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
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
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/8">
                    <FaExclamationTriangle size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400">Already Planned</div>
                      <div className="text-[11px] text-ink font-medium mt-0.5 leading-snug">
                        {weekCheckResult.planCount} shift{weekCheckResult.planCount !== 1 ? "s" : ""} exist
                        {weekCheckResult.machines.length > 0 ? ` across ${weekCheckResult.machines.length} machine${weekCheckResult.machines.length !== 1 ? "s" : ""}` : ""}.
                        {" "}Use "View / Edit Plan" to modify.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/8">
                    <FaCheckCircle size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Week Available</div>
                      <div className="text-[11px] text-ink font-medium mt-0.5 leading-snug">No plan found for this week. Ready to create.</div>
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

