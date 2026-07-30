import React, { useState, useEffect, useMemo, useCallback } from "react";
import { dailyPlanService } from "../../../services/dailyPlanService";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaPlus, FaPlay, FaStop, FaClipboardList, FaCalendarAlt, FaIndustry,
  FaCheckCircle, FaEdit, FaInfoCircle,
  FaArrowRight, FaShare, FaTimes, FaChartBar, FaBoxOpen, FaTruck
} from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { fetchDailyPlans, updateDailyPlan, deleteDailyPlan } from "../../../features/daily-plans/dailyPlanSlice";
import { productCapacityHistoryService } from "../../../services/productCapacityHistoryService";
import apiClient from "../../../api/apiClient";
import config from "../../../api/config";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CustomButton from "../../../components/ui/Button/Button";
import IconButton from "../../../components/ui/IconButton/IconButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import TextArea from "../../../components/form/TextArea/TextArea";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import { ProductionOrderViewModal } from "../../production-orders/components/ProductionOrderViewModal";
import { DailyProductionReportModal } from "../components/DailyProductionReportModal";
import { oeeService } from "../../../services/oeeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { MaterialIssueModal } from "../../production-orders/components/MaterialIssueModal";
import { weeklyProgramService } from "../../../services/weeklyProgramService";

// ---------- helpers ----------
const formatLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const STATUS_FLOW: Record<string, { label: string; next: string | null; color: string }> = {
  DRAFT: { label: "Draft", next: "PLANNED", color: "secondary" },
  PLANNED: { label: "Planned", next: "IN_PROGRESS", color: "info" },
  IN_PROGRESS: { label: "In Progress", next: "POST_PRODUCTION", color: "success" },
  POST_PRODUCTION: { label: "Post Production", next: "COMPLETED", color: "primary" },
  COMPLETED: { label: "Completed", next: null, color: "success" },
  CANCELLED: { label: "Cancelled", next: null, color: "danger" },
  STOPPED: { label: "Stopped", next: null, color: "danger" },
};

const NEXT_ACTION_LABELS: Record<string, string> = {
  DRAFT: "Mark as Planned",
  PLANNED: "Start Production",
  IN_PROGRESS: "Move to Post Production",
  POST_PRODUCTION: "Mark Completed",
};

const NEXT_ACTION_ICONS: Record<string, any> = {
  DRAFT: FaCalendarAlt,
  PLANNED: FaPlay,
  IN_PROGRESS: FaArrowRight,
  POST_PRODUCTION: FaCheckCircle,
};

// ---------- Component ----------
const DailyProductionPlanningPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();

  const { data: machines } = useAppSelector((state: any) => state.machines);
  const { data: dailyPlans, loading } = useAppSelector((state: any) => state.dailyPlans);
  const { data: shifts } = useAppSelector((state: any) => state.shifts);

  // filters
  const [filterDate, setFilterDate] = useState(formatLocalDateString(new Date()));
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMachine, setFilterMachine] = useState("");

  // Draft filters for popover
  const [draftFilterDate, setDraftFilterDate] = useState(formatLocalDateString(new Date()));
  const [draftFilterStatus, setDraftFilterStatus] = useState("");
  const [draftFilterMachine, setDraftFilterMachine] = useState("");

  const hasActiveFilters = !!(filterDate || filterStatus || filterMachine);
  const activeFilterCount = [filterDate, filterStatus, filterMachine].filter(Boolean).length;

  const handleApplyFilters = () => {
    setFilterDate(draftFilterDate);
    setFilterStatus(draftFilterStatus);
    setFilterMachine(draftFilterMachine);
  };

  const handleClearFilters = () => {
    setDraftFilterDate("");
    setDraftFilterStatus("");
    setDraftFilterMachine("");
    setFilterDate("");
    setFilterStatus("");
    setFilterMachine("");
  };

  const handleOpenFilter = () => {
    setDraftFilterDate(filterDate);
    setDraftFilterStatus(filterStatus);
    setDraftFilterMachine(filterMachine);
  };

  // View Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportPlan, setReportPlan] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewPlan, setViewPlan] = useState<any>(null);
  const [viewHourlyLogs, setViewHourlyLogs] = useState<any[]>([]);
  const [loadingViewLogs, setLoadingViewLogs] = useState(false);
  const [viewPlanOeeSummary, setViewPlanOeeSummary] = useState<any>(null);
  const [machineProductCapacity, setMachineProductCapacity] = useState<number | null>(null);
  const [weeklyProgram, setWeeklyProgram] = useState<any>(null);
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [poHistoryPlans, setPOHistoryPlans] = useState<any[]>([]);
  const [loadingPOHistory, setLoadingPOHistory] = useState(false);

  // Production Order View Modal
  const [showPOViewModal, setShowPOViewModal] = useState(false);
  const [selectedPOForView, setSelectedPOForView] = useState<any>(null);

  // Delete Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);

  // Status Change Confirm Modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusChangePlan, setStatusChangePlan] = useState<any>(null);
  const [statusChangingTo, setStatusChangingTo] = useState("");
  const [statusModalTitle, setStatusModalTitle] = useState("");
  const [statusModalMessage, setStatusModalMessage] = useState("");

  // Stop Production Modal State
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopPlan, setStopPlan] = useState<any>(null);
  const [stopReason, setStopReason] = useState("");
  const [isStopping, setIsStopping] = useState(false);
  const [stopOption, setStopOption] = useState<"carry_forward" | "completed_stop">("completed_stop");

  // Material Issue Modal State
  const [showMaterialIssueModal, setShowMaterialIssueModal] = useState(false);
  const [materialIssuePlan, setMaterialIssuePlan] = useState<any>(null);
  const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    rawMaterialService.fetchAll()
      .then((res) => {
        const map = new Map();
        const list = Array.isArray(res) ? res : (res as any).data || [];
        const dataList = Array.isArray(list) ? list : ((list as any).data || []);
        dataList.forEach((rm: any) => { map.set(rm.rawMaterialId?.toString(), rm); });
        setRawMaterialsMap(map);
      })
      .catch((err) => console.error("Failed to load raw materials map", err));
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Load data on mount
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchMachines());
    dispatch(fetchShifts());
  }, [dispatch]);

  const loadDailyPlans = useCallback(() => {
    const params: any = {};
    if (filterDate) params.productionDate = filterDate;
    if (filterStatus) params.status = filterStatus;
    if (filterMachine) params.machineId = filterMachine;
    dispatch(fetchDailyPlans(Object.keys(params).length ? params : undefined));
  }, [dispatch, filterDate, filterStatus, filterMachine]);

  useEffect(() => {
    loadDailyPlans();
  }, [loadDailyPlans, location.key]);

  // ──────────────────────────────────────────────────────────────
  // Filtered data
  // ──────────────────────────────────────────────────────────────
  // SHORT_CLOSED = COMPLETED status but produced qty < planned qty (force stop)
  const isShortClosed = (plan: any): boolean => {
    if (plan.status !== "COMPLETED") return false;
    const produced = Array.isArray(plan.hourlyProductions)
      ? plan.hourlyProductions.reduce((s: number, h: any) => s + Number(h.qtyProduced || 0), 0)
      : 0;
    return produced < Number(plan.plannedQty || 0);
  };

  const allPlans = useMemo(() => Array.isArray(dailyPlans) ? dailyPlans : [], [dailyPlans]);

  // Active plans: show all plans, including short-closed/stopped ones
  const filteredPlans = useMemo(() =>
    allPlans
  , [allPlans]);

  // Short-closed plans: COMPLETED but produced < planned
  const closedPlans = useMemo(() =>
    allPlans.filter((p: any) => isShortClosed(p))
  , [allPlans]);

  const [showClosedPlans, setShowClosedPlans] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { setCurrentPage(1); }, [filterDate, filterStatus, filterMachine]);

  const paginatedPlans = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPlans.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPlans, currentPage]);

  const totalPages = Math.ceil(filteredPlans.length / itemsPerPage);

  // Stats (active plans only)
  const stats = useMemo(() => {
    const total = filteredPlans.length;
    const planned = filteredPlans.filter((p: any) => p.status === "PLANNED" || p.status === "APPROVED").length;
    const running = filteredPlans.filter((p: any) => p.status === "IN_PROGRESS").length;
    const completed = filteredPlans.filter((p: any) => p.status === "COMPLETED").length;
    const totalPlanned = filteredPlans.reduce((s: number, p: any) => s + Number(p.plannedQty || 0), 0);
    return { total, planned, running, completed, totalPlanned };
  }, [filteredPlans]);

  // ──────────────────────────────────────────────────────────────
  // Form Handlers
  // ──────────────────────────────────────────────────────────────
  const openCreateForm = () => navigate("/daily-production-plans/create");

  const openEditForm = (plan: any) => navigate(`/daily-production-plans/edit/${plan.dailyPlanId}`);

  // ──────────────────────────────────────────────────────────────
  // Delete Handler
  // ──────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deletePlanId) return;
    try {
      await dispatch(deleteDailyPlan(deletePlanId)).unwrap();
      toast.success("Daily Production Plan deleted.");
      setShowDeleteModal(false);
      setDeletePlanId(null);
      loadDailyPlans();
    } catch (err: any) {
      toast.error(err || "Failed to delete plan");
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Status Change Handler
  // ──────────────────────────────────────────────────────────────
  const handleStatusAdvance = (plan: any, producedQty: number = 0, overrideNextStatus?: string, dynamicTitle?: string, dynamicMessage?: string) => {
    const nextStatus = overrideNextStatus || STATUS_FLOW[plan.status]?.next;
    if (!nextStatus) return;

    if (nextStatus === "COMPLETED" && producedQty === 0) {
      toast.warning("Cannot mark as completed without logging any production!");
      return;
    }

    const bypassIssueStatuses = ["MATERIAL_ISSUED", "IN_PROGRESS", "COMPLETED", "POST_PRODUCTION"];
    if (nextStatus === "IN_PROGRESS" && !bypassIssueStatuses.includes(plan.productionOrder?.status)) {
      setMaterialIssuePlan(plan);
      setShowMaterialIssueModal(true);
      return;
    }

    setStatusChangePlan(plan);
    setStatusChangingTo(nextStatus);
    setStatusModalTitle(dynamicTitle || NEXT_ACTION_LABELS[plan.status] || "Confirm Status Change");
    setStatusModalMessage(dynamicMessage || `Change status of plan ${plan.dailyPlanId} from "${STATUS_FLOW[plan.status]?.label}" to "${STATUS_FLOW[nextStatus]?.label || nextStatus}"?`);
    setShowStatusModal(true);
  };

  const handleMaterialIssueSuccess = async () => {
    if (!materialIssuePlan) return;
    try {
      await dispatch(updateDailyPlan({ id: materialIssuePlan.dailyPlanId, data: { status: "IN_PROGRESS" } })).unwrap();
      toast.success("Materials issued and production started!");
      loadDailyPlans();
    } catch (err: any) {
      toast.error(err || "Failed to start production after material issue");
    } finally {
      setMaterialIssuePlan(null);
      setShowMaterialIssueModal(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusChangePlan || !statusChangingTo) return;
    try {
      await dispatch(updateDailyPlan({ id: statusChangePlan.dailyPlanId, data: { status: statusChangingTo } })).unwrap();
      toast.success(`Status updated to ${STATUS_FLOW[statusChangingTo]?.label || statusChangingTo}`);
      setShowStatusModal(false);
      setStatusChangePlan(null);
      loadDailyPlans();
    } catch (err: any) {
      toast.error(err || "Failed to update status");
    }
  };

  const handleStopProductionClick = (plan: any) => {
    setStopPlan(plan);
    setStopReason("");
    setStopOption("completed_stop");
    setShowStopModal(true);
  };

  const confirmStopProduction = async () => {
    if (!stopPlan || !stopReason.trim()) {
      toast.error("Please enter a reason for stopping production.");
      return;
    }
    setIsStopping(true);
    try {
      const loggedHoursCount = Array.isArray(stopPlan.hourlyProductions)
        ? stopPlan.hourlyProductions.filter((h: any) => Number(h.hourIndex) > 0).length
        : 0;
      const prefix = stopOption === "completed_stop" ? "Permanently Stopped" : "Short Closed";
      const updatedRemarks = stopPlan.remarks
        ? `${stopPlan.remarks} | ${prefix}: ${stopReason.trim()}`
        : `${prefix}: ${stopReason.trim()}`;
        
      const payload: any = {
        // Permanent stop → move to POST_PRODUCTION so produced qty can be dispatched
        // Stop Daily Plan Only → mark as STOPPED so remaining qty can be assigned later
        status: stopOption === "completed_stop" ? "POST_PRODUCTION" : "STOPPED",
        remarks: updatedRemarks,
        plannedHours: loggedHoursCount > 0 ? loggedHoursCount : stopPlan.plannedHours
      };
      if (stopOption === "completed_stop") {
        payload.shortClosePO = true;
      }

      await dispatch(updateDailyPlan({
        id: stopPlan.dailyPlanId,
        data: payload
      })).unwrap();

      toast.success(stopOption === "completed_stop" ? "Production permanently stopped. Proceeding to post-production." : "Daily plan stopped. You can carry forward the remaining quantity.");

      const plannedQty = Number(stopPlan.plannedQty || 0);
      const producedQty = Array.isArray(stopPlan.hourlyProductions)
        ? stopPlan.hourlyProductions.reduce((sum: number, h: any) => sum + Number(h.qtyProduced || 0), 0)
        : 0;
      const pendingQty = plannedQty > producedQty ? plannedQty - producedQty : 0;

      setShowStopModal(false);
      setStopPlan(null);

      // Reload plans, the user can manually assign the remaining quantity from the weekly targets page later
      loadDailyPlans();
    } catch (err: any) {
      toast.error(err || "Failed to stop production");
    } finally {
      setIsStopping(false);
    }
  };

  const handleCarryForward = (plan: any, pendingQty: number) => {
    navigate("/daily-production-plans/create", {
      state: {
        weeklyProgramId: plan.weeklyProgramId,
        machineId: plan.machineId,
        plannedQty: pendingQty,
        remarks: `Carried forward from Daily Plan ${plan.dailyPlanId}. Target: ${plan.plannedQty}, Produced: ${Number(plan.plannedQty) - pendingQty}, Pending: ${pendingQty}`,
        carryForwardFromPlanId: plan.dailyPlanId,
        carryForwardFromInfo: {
          shiftId: plan.shiftId,
          shiftName: plan.shift?.shiftName,
          productionDate: plan.productionDate,
        },
      }
    });
  };

  // ──────────────────────────────────────────────────────────────
  // View Hourly Logs + Weekly program data
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewPlan || !showViewModal) {
      setViewHourlyLogs([]);
      setViewPlanOeeSummary(null);
      setMachineProductCapacity(null);
      setWeeklyProgram(null);
      setPOHistoryPlans([]);
      return;
    }
    setLoadingViewLogs(true);
    apiClient.get(config.hourlyProduction.base, {
      params: {
        machineId: viewPlan.machineId,
        shiftId: viewPlan.shiftId,
        productionDate: viewPlan.productionDate?.split("T")[0],
        productionOrderId: viewPlan.productionOrderId,
      }
    }).then(res => {
      if (res.data?.success) setViewHourlyLogs((res.data.data || []).filter((h: any) => Number(h.hourIndex) > 0));
      else setViewHourlyLogs([]);
    }).catch(() => setViewHourlyLogs([])
    ).finally(() => setLoadingViewLogs(false));

    oeeService.getProductionOrderOee(viewPlan.productionOrderId)
      .then((data: any) => setViewPlanOeeSummary(data))
      .catch(() => setViewPlanOeeSummary(null));

    // Fetch weekly program data if available
    if (viewPlan.weeklyProgramId) {
      setLoadingWeekly(true);
      weeklyProgramService.getById(viewPlan.weeklyProgramId)
        .then((res: any) => {
          const data = res?.data || res;
          setWeeklyProgram(data);
        })
        .catch(() => setWeeklyProgram(null))
        .finally(() => setLoadingWeekly(false));
    }

    // Fetch all daily plans for the same Production Order (history)
    if (viewPlan.productionOrderId) {
      setLoadingPOHistory(true);
      dailyPlanService.getAll({ productionOrderId: viewPlan.productionOrderId })
        .then((res: any) => {
          let plans: any[] = [];
          if (Array.isArray(res)) plans = res;
          else if (Array.isArray(res?.data)) plans = res.data;
          else if (Array.isArray(res?.data?.dailyPlans)) plans = res.data.dailyPlans;
          else if (Array.isArray(res?.dailyPlans)) plans = res.dailyPlans;
          // Sort by date desc
          plans.sort((a: any, b: any) => new Date(b.productionDate || 0).getTime() - new Date(a.productionDate || 0).getTime());
          setPOHistoryPlans(plans);
        })
        .catch(() => setPOHistoryPlans([]))
        .finally(() => setLoadingPOHistory(false));
    }

    if (viewPlan.machineId && viewPlan.productionOrder?.productItem?.id) {
      productCapacityHistoryService.fetchByProductAndMachine(Number(viewPlan.productionOrder.productItem.id), viewPlan.machineId)
        .then((rec: any) => {
          if (rec && rec.newCapacity != null) {
            setMachineProductCapacity(Number(rec.newCapacity));
          } else {
            setMachineProductCapacity(null);
          }
        })
        .catch(() => setMachineProductCapacity(null));
    } else {
      setMachineProductCapacity(null);
    }
  }, [viewPlan, showViewModal]);

  // ──────────────────────────────────────────────────────────────
  // Navigate to Log Hourly Production for this plan
  // ──────────────────────────────────────────────────────────────
  const handleLogHourly = (plan: any) => {
    const nextHourIndex = (plan.hourlyProductions && plan.hourlyProductions.length > 0)
      ? Math.max(...plan.hourlyProductions.map((h: any) => Number(h.hourIndex))) + 1
      : 1;

    navigate("/hourly-work-reports/create", {
      state: {
        dailyPlanId: plan.dailyPlanId,
        machineId: plan.machineId,
        productionDate: plan.productionDate?.split("T")[0],
        shiftId: plan.shiftId,
        shiftName: plan.shift?.shiftName || plan.shiftId,
        productionOrderId: plan.productionOrderId,
        productName: plan.productionOrder?.productItem?.productName || "",
        productCode: plan.productionOrder?.productItem?.productCode || "",
        plannedQty: Number(plan.plannedQty),
        uom: plan.productionOrder?.productItem?.uom?.uomCode || "pcs",
        weeklyProgramId: plan.weeklyProgramId,
        productId: plan.productionOrder?.productItemId ? Number(plan.productionOrder.productItemId) : null,
        startTime: plan.shift?.startTime,
        endTime: plan.shift?.endTime,
        hourIndex: nextHourIndex,
      }
    });
  };

  // ──────────────────────────────────────────────────────────────
  // Table Columns
  // ──────────────────────────────────────────────────────────────
  const columns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "52px",
      align: "center",
      render: (_row: any, idx: number) => (
        <span className="text-xs font-medium text-slate-400">{(currentPage - 1) * itemsPerPage + idx + 1}</span>
      )
    },
    {
      header: "Production Order",
      render: (plan: any) => (
        <div className="flex flex-col gap-0.5 py-1">
          <button
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer bg-transparent border-none p-0 text-left leading-tight"
            onClick={() => { setSelectedPOForView(plan.productionOrder); setShowPOViewModal(true); }}
            title="View Production Order details"
          >
            {plan.productionOrderId}
          </button>
          <span className="text-xs text-slate-500 leading-tight line-clamp-1" title={plan.productionOrder?.productItem?.productName}>
            {plan.productionOrder?.productItem?.productName || "—"}
          </span>
          {plan.carryForwardFromPlanId && (
            <span className="inline-flex items-center gap-1 mt-0.5 bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-bold w-fit">
              ↩ From {plan.carryForwardFromPlanId}
            </span>
          )}
          {Array.isArray(plan.carryForwardTo) && plan.carryForwardTo.length > 0 && (
            <span className="inline-flex items-center gap-1 mt-0.5 bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded text-[9px] font-bold w-fit">
              ↪ To {plan.carryForwardTo[0].dailyPlanId}
            </span>
          )}
        </div>
      )
    },
    {
      header: "Machine / Shift",
      render: (plan: any) => (
        <div className="flex flex-col gap-1 py-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <FaIndustry className="text-slate-400 flex-shrink-0" size={12} />
            <span className="leading-tight">{plan.machine?.machineName || plan.machineId || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold">
              {plan.shift?.shiftName || plan.shiftId || "—"}
            </span>
            {plan.shift?.startTime && plan.shift?.endTime && (
              <span className="text-slate-400 text-[10px]">
                {plan.shift.startTime.slice(0, 5)} – {plan.shift.endTime.slice(0, 5)}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      header: "Planned Qty",
      align: "center",
      render: (plan: any) => {
        const plannedQty = Number(plan.plannedQty || 0);
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm font-bold text-slate-800">{plannedQty.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-medium">pcs</span>
            {plan.plannedHours && (
              <span className="text-[10px] text-slate-400">{plan.plannedHours} hrs</span>
            )}
          </div>
        );
      }
    },
    {
      header: "Progress",
      align: "center",
      render: (plan: any) => {
        const plannedQty = Number(plan.plannedQty || 0);
        const producedQty = Array.isArray(plan.hourlyProductions)
          ? plan.hourlyProductions.reduce((sum: number, h: any) => sum + Number(h.qtyProduced || 0), 0)
          : 0;
        const progressPercent = plannedQty > 0 ? Math.min(100, Math.round((producedQty / plannedQty) * 100)) : 0;
        const barColor = progressPercent >= 100 ? "bg-emerald-500" : progressPercent >= 50 ? "bg-indigo-500" : "bg-amber-400";

        return (
          <div className="flex flex-col items-center gap-1 w-full min-w-[80px]">
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-slate-800">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-[10px] text-slate-400">{producedQty} / {plannedQty} pcs</span>
          </div>
        );
      }
    },
    {
      header: "Pending / Extra",
      align: "center",
      render: (plan: any) => {
        const plannedQty = Number(plan.plannedQty || 0);
        const producedQty = Array.isArray(plan.hourlyProductions)
          ? plan.hourlyProductions.reduce((sum: number, h: any) => sum + Number(h.qtyProduced || 0), 0)
          : 0;
        const pendingQty = plannedQty > producedQty ? plannedQty - producedQty : 0;

        return (
          <div className="flex justify-center">
            {producedQty > plannedQty ? (
              <StatusBadge status="COMPLETED" customText={`+${producedQty - plannedQty} Extra`} customColor={{ bg: '#d1fae5', text: '#065f46' }} />
            ) : (pendingQty > 0 && plan.status !== "CANCELLED") ? (
              <StatusBadge status="PENDING" customText={`${pendingQty} Pending`} customColor={{ bg: '#fee2e2', text: '#b91c1c' }} />
            ) : (
              <span className="text-slate-300 text-xs">—</span>
            )}
          </div>
        );
      }
    },
    {
      header: "Status",
      align: "center",
      render: (plan: any) => {
        const plannedQty = Number(plan.plannedQty || 0);
        const producedQty = Array.isArray(plan.hourlyProductions)
          ? plan.hourlyProductions.reduce((sum: number, h: any) => sum + Number(h.qtyProduced || 0), 0)
          : 0;
        const customSteps = plan.productionOrder?.productItem?.productionSteps || [];
        let activeStepName = null;

        if (plan.status === "POST_PRODUCTION") {
          const currentStepKey = plan.currentProductionStep || customSteps[0]?.stepKey;
          if (currentStepKey && customSteps.length > 0) {
            const stepIndex = customSteps.findIndex((s: any) => s.stepKey === currentStepKey) + 1;
            const displayIndex = stepIndex > 0 ? stepIndex : 1;
            activeStepName = `Step: ${currentStepKey} (${displayIndex}/${customSteps.length})`;
          } else {
            activeStepName = currentStepKey ? `Step: ${currentStepKey}` : "Post Production";
          }
        }

        return (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <StatusBadge 
                status={
                  plan.productionOrder?.status === "COMPLETED_WITH_SHORTFALL" || (plan.remarks?.includes("Permanently Stopped:") && producedQty < plannedQty && ["POST_PRODUCTION", "COMPLETED"].includes(plan.status))
                    ? "COMPLETED_WITH_SHORTFALL"
                    : plan.status === "STOPPED" || plan.status === "SHORT_CLOSED" || (plan.remarks?.includes("Short Closed:") && producedQty < plannedQty && ["POST_PRODUCTION", "COMPLETED"].includes(plan.status))
                    ? "SHORT_CLOSED"
                    : plan.status === "COMPLETED" && producedQty < plannedQty
                    ? "SHORT_CLOSED"
                    : plan.status
                }
                customText={
                  plan.productionOrder?.status === "COMPLETED_WITH_SHORTFALL" || (plan.remarks?.includes("Permanently Stopped:") && producedQty < plannedQty && ["POST_PRODUCTION", "COMPLETED"].includes(plan.status))
                    ? "Permanently Stopped" 
                    : plan.status === "STOPPED" || plan.status === "SHORT_CLOSED" || (plan.remarks?.includes("Short Closed:") && producedQty < plannedQty && ["POST_PRODUCTION", "COMPLETED"].includes(plan.status))
                    ? "Short Closed"
                    : undefined
                }
              />
              {(plan.status === "STOPPED" || plan.status === "SHORT_CLOSED" || plan.status === "CANCELLED" || (plan.status === "COMPLETED" && producedQty < plannedQty)) && plan.remarks && (
                <div className="group relative flex items-center cursor-pointer">
                  <FaInfoCircle className="text-rose-400 text-[13px] hover:text-rose-600 transition-colors" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 shadow-xl text-left">
                    <span className="font-bold text-amber-400 block mb-1">Reason:</span>
                    <div>
                      {plan.remarks.includes("Permanently Stopped:") || plan.remarks.includes("Short Closed:") || plan.remarks.includes("Stopped:") || plan.remarks.includes("Cancelled:")
                        ? plan.remarks.split("|").pop()?.replace("Permanently Stopped:", "")?.replace("Short Closed:", "")?.replace("Stopped:", "")?.replace("Cancelled:", "").trim()
                        : plan.remarks}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {activeStepName && plan.productionOrder?.status !== "COMPLETED_WITH_SHORTFALL" && (
              <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[9px] font-bold border border-indigo-100 uppercase tracking-wide">
                {activeStepName}
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: "Actions",
      align: "right",
      render: (plan: any) => {
        const plannedQty = Number(plan.plannedQty || 0);
        const producedQty = Array.isArray(plan.hourlyProductions)
          ? plan.hourlyProductions.reduce((sum: number, h: any) => sum + Number(h.qtyProduced || 0), 0)
          : 0;
        const pendingQty = plannedQty > producedQty ? plannedQty - producedQty : 0;
        const nextStatus = STATUS_FLOW[plan.status]?.next;
        let canAdvance = !!nextStatus && plan.status !== "COMPLETED" && plan.status !== "CANCELLED";
        if (plan.status === "IN_PROGRESS") canAdvance = canAdvance && (producedQty >= plannedQty);
        const canLog = plan.status === "IN_PROGRESS";
        const alreadyCarriedForward = Array.isArray(plan.carryForwardTo) && plan.carryForwardTo.length > 0;
        // Carry forward for STOPPED and SHORT_CLOSED plans
        const _canCarryForward = (plan.status === "STOPPED" || plan.status === "SHORT_CLOSED") && pendingQty > 0 && !alreadyCarriedForward;

        let targetNextStatus = STATUS_FLOW[plan.status]?.next;
        let dynamicActionTitle = NEXT_ACTION_LABELS[plan.status] || `Move to ${nextStatus}`;
        let dynamicActionIcon = NEXT_ACTION_ICONS[plan.status] || FaArrowRight;
        let dynamicActionVariant: "info" | "primary" | "success" | "warning" | "danger" = "info";
        let dynamicModalTitle = "";
        let dynamicModalMessage = "";

        if (plan.status === "POST_PRODUCTION") {
          const customSteps = plan.productionOrder?.productItem?.productionSteps || [];
          if (customSteps.length > 0) {
            canAdvance = true;
            const totalStepsCount = customSteps.length;
            const currentIndex = plan.currentStepIndex || 1;
            const currentStepName = currentIndex > 0 && currentIndex <= totalStepsCount ? customSteps[currentIndex - 1]?.stepKey : "Post Production";
            const isLastStep = currentIndex >= totalStepsCount;

            if (!isLastStep) {
              const nextStepName = customSteps[currentIndex].stepKey;
              targetNextStatus = "NEXT_STEP";
              dynamicActionTitle = `Complete ${currentStepName} & Next (${nextStepName})`;
              dynamicActionIcon = FaArrowRight;
              dynamicActionVariant = "info";
              dynamicModalTitle = `Advance Step (${nextStepName})`;
              dynamicModalMessage = `Complete step "${currentStepName}" and advance to "${nextStepName}"?`;
            } else {
              targetNextStatus = "COMPLETED";
              dynamicActionTitle = `Complete Final Step (${currentStepName}) & Finish Production`;
              dynamicActionIcon = FaCheckCircle;
              dynamicActionVariant = "success";
              dynamicModalTitle = "Complete Production";
              dynamicModalMessage = `Complete final post-production step "${currentStepName}" and mark production order as ready for dispatch?`;
            }
          } else {
            targetNextStatus = "COMPLETED";
            dynamicActionTitle = "Complete Production";
            dynamicActionIcon = FaCheckCircle;
            dynamicActionVariant = "success";
            dynamicModalTitle = "Complete Production";
            dynamicModalMessage = `Mark production order as ready for dispatch?`;
            canAdvance = true;
          }
        }

        if (plan.status === "IN_PROGRESS" && producedQty >= plannedQty) {
          targetNextStatus = "POST_PRODUCTION";
          dynamicActionTitle = "Move to Post Production";
          dynamicActionIcon = FaArrowRight;
          dynamicActionVariant = "info";
          dynamicModalTitle = "Move to Post Production";
          dynamicModalMessage = `Complete manufacturing and move to Post Production phase?`;
          canAdvance = true;
        }

        if ((plan.status === "STOPPED" || plan.status === "SHORT_CLOSED") && producedQty > 0) {
          targetNextStatus = "POST_PRODUCTION";
          dynamicActionTitle = "Move to Post Production";
          dynamicActionIcon = FaArrowRight;
          dynamicActionVariant = "info";
          dynamicModalTitle = "Move to Post Production";
          dynamicModalMessage = `Move to Post Production phase for the produced ${producedQty} pcs?`;
          canAdvance = true;
        }

        // SHORT_CLOSED: force-stopped plan — can still do post production for the produced qty if not already completed
        const isPermanentlyStopped = plan.productionOrder?.status === "COMPLETED_WITH_SHORTFALL" || plan.status === "COMPLETED" || plan.status === "COMPLETED_WITH_SHORTFALL";
        if (isPermanentlyStopped && plan.currentProductionStep !== "Completed" && producedQty > 0) {
          const customSteps = plan.productionOrder?.productItem?.productionSteps || [];
          if (customSteps.length > 0) {
            // Already in post-production steps technically, we should show the step buttons
            canAdvance = true;
            const totalStepsCount = customSteps.length;
            const currentIndex = plan.currentStepIndex || 1;
            const currentStepName = currentIndex > 0 && currentIndex <= totalStepsCount ? customSteps[currentIndex - 1]?.stepKey : "Post Production";
            const isLastStep = currentIndex >= totalStepsCount;

            if (!isLastStep) {
              const nextStepName = customSteps[currentIndex].stepKey;
              targetNextStatus = "NEXT_STEP";
              dynamicActionTitle = `Complete ${currentStepName} & Next (${nextStepName})`;
              dynamicActionIcon = FaArrowRight;
              dynamicActionVariant = "info";
              dynamicModalTitle = `Advance Step (${nextStepName})`;
              dynamicModalMessage = `Complete step "${currentStepName}" and advance to "${nextStepName}"?`;
            } else {
              targetNextStatus = "COMPLETED";
              dynamicActionTitle = `Complete Final Step (${currentStepName}) & Finish Production`;
              dynamicActionIcon = FaCheckCircle;
              dynamicActionVariant = "success";
              dynamicModalTitle = "Complete Production";
              dynamicModalMessage = `Complete final post-production step "${currentStepName}" and mark production order as ready for dispatch?`;
            }
          } else {
            targetNextStatus = "POST_PRODUCTION";
            dynamicActionTitle = "Move to Post Production";
            dynamicActionIcon = FaArrowRight;
            dynamicActionVariant = "info";
            dynamicModalTitle = "Move to Post Production";
            dynamicModalMessage = `This plan was force-stopped with ${producedQty} pcs produced. Move to Post Production for dispatch?`;
            canAdvance = true;
          }
        }

        return (
          <div className="flex items-center justify-end gap-1 pr-2" onClick={e => e.stopPropagation()}>
            <ViewButton onClick={() => { setViewPlan(plan); setShowViewModal(true); }} />
            {canLog && (
              <IconButton variant="primary" title="Log Hourly Production" icon={FaClipboardList} onClick={() => handleLogHourly(plan)} />
            )}
            {canAdvance && (
              <IconButton
                variant={dynamicActionVariant}
                title={dynamicActionTitle}
                icon={dynamicActionIcon}
                onClick={() => handleStatusAdvance(plan, producedQty, targetNextStatus as any, dynamicModalTitle as any, dynamicModalMessage as any)}
              />
            )}
            {!["COMPLETED", "CANCELLED", "STOPPED", "SHORT_CLOSED"].includes(plan.status) && 
            plan.productionOrder?.status !== "COMPLETED_WITH_SHORTFALL" && 
            plan.productionOrder?.status !== "CLOSED" && (
              <IconButton variant="danger" title="Stop Production" icon={FaStop} onClick={() => handleStopProductionClick(plan)} />
            )}
            {(plan.status === "DRAFT" || plan.status === "PLANNED") && (
              <IconButton variant="info" title="Edit Plan" icon={FaEdit} onClick={() => openEditForm(plan)} />
            )}
            {/* {canCarryForward && (
              <IconButton variant="warning" title={`Carry Forward ${pendingQty} pcs`} icon={FaShare} onClick={() => handleCarryForward(plan, pendingQty)} />
            )} */}
            {(plan.status === "DRAFT" || plan.status === "CANCELLED") && (
              <DeleteButton onClick={() => { setDeletePlanId(plan.dailyPlanId); setShowDeleteModal(true); }} />
            )}
          </div>
        );
      }
    }
  ];

  const allowedMachines = useMemo(() =>
    (machines || []).filter((m: any) => m.machineId !== "MAC-001")
    , [machines]);

  // ──────────────────────────────────────────────────────────────
  // Weekly Program Progress helpers (used in view modal)
  // ──────────────────────────────────────────────────────────────
  const weeklyTargetQty = weeklyProgram ? Number(weeklyProgram.plannedQty || 0) : 0;
  const weeklyProducedQty = viewPlan?.productionOrder
    ? (() => {
        // Sum produced across all daily plans linked to same production order
        const totalProduced = Array.isArray(viewPlan.hourlyProductions)
          ? viewPlan.hourlyProductions.reduce((s: number, h: any) => s + Number(h.qtyProduced || 0), 0)
          : 0;
        return totalProduced;
      })()
    : 0;
  const weeklyOrderTargetQty = viewPlan?.productionOrder ? Number(viewPlan.productionOrder.targetQty || 0) : 0;
  const weeklyOrderProducedQty = viewPlanOeeSummary?.producedQty ?? weeklyProducedQty;
  const weeklyOrderPct = weeklyOrderTargetQty > 0 ? Math.min(100, Math.round((weeklyOrderProducedQty / weeklyOrderTargetQty) * 100)) : 0;
  const weeklyProgramPct = weeklyTargetQty > 0 ? Math.min(100, Math.round((weeklyOrderProducedQty / weeklyTargetQty) * 100)) : 0;

  return (
    <div className="p-4 md:p-6 min-h-screen bg-white">
      <div className="w-full">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Daily Production Planning</h2>
            <p className="text-sm text-slate-500 mt-0.5">Manage and track daily machine production runs</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <FilterPopover
              activeFilterCount={activeFilterCount}
              hasActiveFilters={hasActiveFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              onOpen={handleOpenFilter}
            >
              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={draftFilterDate}
                  onChange={(e) => setDraftFilterDate(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Machine</label>
                <select
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  value={draftFilterMachine}
                  onChange={(e) => setDraftFilterMachine(e.target.value)}
                >
                  <option value="">All Machines</option>
                  {allowedMachines.map((m: any) => (
                    <option key={m.machineId} value={m.machineId}>{m.machineName}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Status</label>
                <select
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  value={draftFilterStatus}
                  onChange={(e) => setDraftFilterStatus(e.target.value)}
                >
                  <option value="">All Status</option>
                  {Object.keys(STATUS_FLOW).map(s => (
                    <option key={s} value={s}>{STATUS_FLOW[s].label}</option>
                  ))}
                </select>
              </div>
            </FilterPopover>

            <CustomButton text="New Production Order" icon={FaPlus} onClick={() => navigate("/production-orders/create")} />
            <CustomButton text="Daily Report" icon={FaChartBar} onClick={() => { setReportPlan(null); setShowReportModal(true); }} />
            <CustomButton text="New Daily Plan" icon={FaPlus} onClick={openCreateForm} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Plans", value: stats.total, icon: FaCalendarAlt, colorClass: "text-indigo-600", iconBg: "bg-indigo-100", iconColor: "text-indigo-500" },
            { label: "Planned", value: stats.planned, icon: FaCheckCircle, colorClass: "text-amber-600", iconBg: "bg-amber-100", iconColor: "text-amber-500" },
            { label: "In Progress", value: stats.running, icon: FaPlay, colorClass: "text-sky-600", iconBg: "bg-sky-100", iconColor: "text-sky-500" },
            { label: "Completed", value: stats.completed, icon: FaStop, colorClass: "text-emerald-600", iconBg: "bg-emerald-100", iconColor: "text-emerald-500" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 hover:-translate-y-0.5 transition-transform cursor-default">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.iconBg}`}>
                <stat.icon size={20} className={stat.iconColor} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-0.5">{stat.label}</p>
                <p className={`text-2xl font-bold m-0 leading-tight ${stat.colorClass}`}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Daily Plans Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <DataTable
            columns={columns}
            data={paginatedPlans}
            rowKey={(row) => row.dailyPlanId}
            loading={loading}
            density="compact"
            pagination={{
              currentPage,
              totalPages,
              onPageChange: setCurrentPage
            }}
            emptyMessage={
              <div className="text-center py-16">
                <FaCalendarAlt className="text-slate-200 mx-auto mb-3" size={40} />
                <h5 className="text-slate-500 mb-1 font-semibold text-base">No daily plans found</h5>
                <p className="text-slate-400 text-sm">Click "New Daily Plan" to schedule a production run.</p>
              </div>
            }
          />
        </div>

  
        {/* ─────── View Modal ─────── */}
        {showViewModal && viewPlan && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start flex-shrink-0">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FaIndustry className="text-white" size={16} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 leading-tight">Daily Plan — {viewPlan.dailyPlanId}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{viewPlan.productionDate?.split("T")[0]} · {viewPlan.machine?.machineName || viewPlan.machineId} · {viewPlan.shift?.shiftName || viewPlan.shiftId}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setShowViewModal(false); setViewPlan(null); }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <FaTimes size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* ── Weekly Production Target Progress ── */}
                {viewPlan.weeklyProgramId && (
                  <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FaChartBar className="text-indigo-500" size={14} />
                      <h6 className="text-xs font-bold text-indigo-700 uppercase tracking-wider m-0">Weekly Target Progress</h6>
                      <span className="ml-auto text-[10px] text-indigo-400 font-mono bg-white/60 px-2 py-0.5 rounded border border-indigo-100">
                        {viewPlan.weeklyProgramId}
                      </span>
                    </div>

                    {loadingWeekly ? (
                      <div className="flex items-center gap-2 text-sm text-indigo-400">
                        <div className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                        Loading weekly data...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Production Order Target */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-600">Production Order Target</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">{weeklyOrderProducedQty.toLocaleString()} / {weeklyOrderTargetQty.toLocaleString()} pcs</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${weeklyOrderPct >= 100 ? "bg-emerald-100 text-emerald-700" : weeklyOrderPct >= 50 ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                                {weeklyOrderPct}%
                              </span>
                            </div>
                          </div>
                          <div className="h-2 bg-white/60 rounded-full overflow-hidden border border-indigo-100">
                            <div
                              className={`h-full rounded-full transition-all ${weeklyOrderPct >= 100 ? "bg-emerald-500" : weeklyOrderPct >= 50 ? "bg-indigo-500" : "bg-amber-400"}`}
                              style={{ width: `${weeklyOrderPct}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-slate-400">Produced: <strong className="text-emerald-600">{weeklyOrderProducedQty.toLocaleString()}</strong></span>
                            <span className="text-[10px] text-slate-400">Remaining: <strong className="text-amber-600">{Math.max(0, weeklyOrderTargetQty - weeklyOrderProducedQty).toLocaleString()}</strong></span>
                          </div>
                        </div>

                        {/* Weekly Program Target (if available) */}
                        {weeklyTargetQty > 0 && (
                          <div className="pt-2 border-t border-indigo-100/60">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-slate-600">Weekly Program Target</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">{weeklyOrderProducedQty.toLocaleString()} / {weeklyTargetQty.toLocaleString()} pcs</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${weeklyProgramPct >= 100 ? "bg-emerald-100 text-emerald-700" : weeklyProgramPct >= 50 ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"}`}>
                                  {weeklyProgramPct}%
                                </span>
                              </div>
                            </div>
                            <div className="h-2 bg-white/60 rounded-full overflow-hidden border border-indigo-100">
                              <div
                                className={`h-full rounded-full transition-all ${weeklyProgramPct >= 100 ? "bg-emerald-500" : weeklyProgramPct >= 50 ? "bg-blue-500" : "bg-rose-400"}`}
                                style={{ width: `${weeklyProgramPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Completion status chips */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {weeklyOrderPct >= 100 ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                              <FaCheckCircle size={9} /> Weekly Target Complete!
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
                              <FaBoxOpen size={9} /> {Math.max(0, weeklyOrderTargetQty - weeklyOrderProducedQty).toLocaleString()} pcs remaining to complete
                            </span>
                          )}
                          {viewPlan.productionOrder?.status === "COMPLETED" && (
                            <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-indigo-200">
                              <FaTruck size={9} /> Ready for Dispatch
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Plan Details Grid ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
                    <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Plan Details</h6>
                    <dl className="space-y-2 text-sm">
                      {[
                        { label: "Production Order", value: viewPlan.productionOrderId },
                        { label: "Product", value: viewPlan.productionOrder?.productItem?.productName || "—" },
                        { label: "Date", value: viewPlan.productionDate?.split("T")[0] },
                        { label: "Machine", value: viewPlan.machine?.machineName || viewPlan.machineId },
                        { label: "Shift", value: viewPlan.shift?.shiftName || viewPlan.shiftId },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-start gap-2">
                          <dt className="text-slate-500 font-medium w-36 flex-shrink-0">{label}:</dt>
                          <dd className="text-slate-800 font-semibold">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
                    <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Quantities & Status</h6>
                    <dl className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <dt className="text-slate-500 font-medium w-36 flex-shrink-0">Planned Qty:</dt>
                        <dd className="text-slate-800 font-semibold">{viewPlan.plannedQty} pcs</dd>
                      </div>
                      <div className="flex items-start gap-2">
                        <dt className="text-slate-500 font-medium w-36 flex-shrink-0">Planned Hours:</dt>
                        <dd className="text-slate-800 font-semibold">{viewPlan.plannedHours || "—"} hrs</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <dt className="text-slate-500 font-medium w-36 flex-shrink-0">Priority:</dt>
                        <dd><StatusBadge status={viewPlan.priority || "MEDIUM"} /></dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <dt className="text-slate-500 font-medium w-36 flex-shrink-0">Status:</dt>
                        <dd><StatusBadge status={viewPlan.status} /></dd>
                      </div>
                      {viewPlan.remarks && (
                        <div className="flex items-start gap-2">
                          <dt className="text-slate-500 font-medium w-36 flex-shrink-0">Remarks:</dt>
                          <dd className="text-slate-700 text-xs leading-relaxed">{viewPlan.remarks}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>

                {/* ── Post Production Steps ── */}
                {viewPlan.productionOrder?.productItem?.productionSteps?.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                      <h6 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider m-0">Post Production Steps</h6>
                    </div>
                    <div className="p-4 flex flex-wrap gap-2 items-center">
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
                          : "bg-slate-50 text-slate-400 border-slate-200";

                        const dotColors = isCompleted
                          ? "bg-emerald-500 text-white"
                          : isActive
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-300 text-slate-500";

                        return (
                          <React.Fragment key={step.id || idx}>
                            <span className={`px-3 py-1.5 font-semibold text-xs rounded-lg border flex items-center gap-1.5 ${badgeColors}`}>
                              <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold ${dotColors}`}>
                                {step.stepOrder || stepNum}
                              </span>
                              {step.stepKey}
                            </span>
                            {idx < viewPlan.productionOrder.productItem.productionSteps.length - 1 && (
                              <FaArrowRight className="text-slate-300 text-[10px]" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Hourly Production Logs ── */}
                <div>
                  <h6 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Hourly Production Entries</h6>
                  {loadingViewLogs ? (
                    <div className="flex items-center justify-center gap-2 py-8 border border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-sm">
                      <div className="w-5 h-5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                      Loading entries...
                    </div>
                  ) : viewHourlyLogs.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <DataTable
                        columns={[
                          { header: "Hour", align: "center", render: (h: any) => <span className="font-bold font-mono text-slate-700 text-xs">H{h.hourIndex}</span> },
                          { header: "Produced", align: "center", render: (h: any) => <span className="font-bold text-emerald-600 text-sm">{h.qtyProduced}</span> },
                          { header: "Reject", align: "center", render: (h: any) => <span className="text-rose-500 text-sm">{h.rejectQty || 0}</span> },
                          { header: "Scrap", align: "center", render: (h: any) => <span className="text-amber-500 text-sm">{h.scrapQty || 0}</span> },
                          { header: "Downtime", align: "center", render: (h: any) => <span className="text-slate-500 text-xs">{h.downtime > 0 ? `${h.downtime} min` : "—"}</span> },
                          { header: "Avail%", align: "center", render: (h: any) => <span className="font-semibold text-emerald-700 text-xs">{h.availabilityPct !== undefined ? `${h.availabilityPct}%` : '—'}</span> },
                          { header: "Qual%", align: "center", render: (h: any) => <span className="font-semibold text-purple-700 text-xs">{h.qualityPct !== undefined ? `${h.qualityPct}%` : '—'}</span> },
                          { header: "OEE%", align: "center", render: (h: any) => <span className="font-extrabold text-indigo-700 text-xs">{h.hourlyOEE !== undefined ? `${h.hourlyOEE}%` : '—'}</span> },
                          { header: "Operator", render: (h: any) => <span className="text-slate-600 font-medium text-xs truncate max-w-[120px] inline-block" title={h.operatorName || h.operatorId}>{h.operatorName || h.operatorId || "—"}</span> }
                        ]}
                        data={viewHourlyLogs}
                        rowKey={(h: any) => h.hourlyProductionId}
                        minHeightClassName="min-h-0"
                      />
                      {/* Totals Footer */}
                      <div className="bg-slate-50 p-4 border-t border-slate-200 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold">
                          <span className="text-slate-500 text-xs uppercase tracking-wider">Totals:</span>
                          <div className="flex flex-wrap gap-4 text-xs">
                            <span className="text-emerald-600">✓ Produced: {viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.qtyProduced || 0), 0)}</span>
                            <span className="text-rose-500">✕ Reject: {viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.rejectQty || 0), 0)}</span>
                            <span className="text-amber-500">⚠ Scrap: {viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.scrapQty || 0), 0)}</span>
                            <span className="text-slate-500">↓ Downtime: {(() => { const t = viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.downtime || 0), 0); return t > 0 ? `${t} min` : "—"; })()}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2 border-t border-slate-200 border-dashed">
                          <div className="flex gap-4 font-bold">
                            <span className="text-slate-700">Total Produced: <span className="text-emerald-600 ml-1">{viewPlanOeeSummary?.producedQty ?? viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.qtyProduced || 0), 0)} pcs</span></span>
                            <span className="text-slate-700">Pending: <span className="text-amber-500 ml-1">{viewPlanOeeSummary?.remainingQty ?? (Number(viewPlan.plannedQty) - viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.qtyProduced || 0), 0))} pcs</span></span>
                          </div>
                          {viewPlan.carryForwardTo && viewPlan.carryForwardTo.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 uppercase tracking-wider text-[10px]">Carried Forward To:</span>
                              <span className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1 text-xs">
                                <FaShare className="text-[9px]" />
                                {viewPlan.carryForwardTo[0].dailyPlanId}
                                <span className="text-indigo-400 font-normal ml-1">({viewPlan.carryForwardTo[0].productionDate?.split('T')[0]})</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 border border-slate-200 rounded-xl bg-slate-50 text-center">
                      <FaClipboardList className="text-slate-200 mb-2" size={32} />
                      <span className="text-slate-400 font-medium text-sm">No hourly entries recorded yet for this plan.</span>
                    </div>
                  )}
                </div>

                {/* ── Daily Target vs Actual Comparison ── */}
                {viewHourlyLogs.length > 0 && (
                  <div>
                    <h6 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Target vs Actual Comparison</h6>
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Machine</th>
                            <th className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Product</th>
                            <th className="px-4 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Capacity</th>
                            <th className="px-4 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Produced</th>
                            <th className="px-4 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending</th>
                            <th className="px-4 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Efficiency</th>
                            <th className="px-4 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(() => {
                            const capacity = machineProductCapacity || weeklyOrderTargetQty || 0;
                            const totalProduced = weeklyOrderProducedQty;
                            const pending = Math.max(0, capacity - totalProduced);
                            const efficiency = capacity > 0 ? ((totalProduced / capacity) * 100).toFixed(0) : "0";
                            const shortfall = capacity - totalProduced;
                            
                            let statusText = "";
                            let customColor = { bg: "", text: "" };

                            if (shortfall <= 0) {
                               statusText = "Highest";
                               customColor = { bg: '#d1fae5', text: '#065f46' };
                            } else if (shortfall <= 15) {
                               statusText = "Medium";
                               customColor = { bg: '#fef3c7', text: '#b45309' };
                            } else {
                               statusText = " Low";
                               customColor = { bg: '#fee2e2', text: '#b91c1c' };
                            }
                            
                            return (
                              <tr>
                                <td className="px-4 py-3 text-slate-700 font-medium text-sm">
                                  {viewPlan.machine?.machineName || viewPlan.machineId || "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-700 text-sm">
                                  {viewPlan.productionOrder?.productItem?.productName || "—"}
                                </td>
                                <td className="px-4 py-3 text-center text-slate-600 font-bold">{capacity}</td>
                                <td className="px-4 py-3 text-center text-slate-600 font-bold">{totalProduced}</td>
                                <td className="px-4 py-3 text-center text-amber-600 font-bold">{pending}</td>
                                <td className="px-4 py-3 text-center text-indigo-600 font-bold">{efficiency}%</td>
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

                {/* ── Production Order History ── */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FaClipboardList className="text-slate-300" size={13} />
                      <h6 className="text-[11px] font-bold text-white uppercase tracking-wider m-0">Production Order History</h6>
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-900/40 px-2 py-0.5 rounded border border-slate-600">
                        {viewPlan.productionOrderId}
                      </span>
                    </div>
                    {!loadingPOHistory && (
                      <span className="text-[10px] text-slate-400 bg-slate-900/30 px-2 py-0.5 rounded">
                        {poHistoryPlans.length} plan{poHistoryPlans.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {loadingPOHistory ? (
                    <div className="flex items-center justify-center gap-2 py-6 bg-slate-50 text-slate-400 text-sm">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                      Loading history...
                    </div>
                  ) : poHistoryPlans.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan ID</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Machine</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shift</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Planned</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Produced</th>
                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {poHistoryPlans.map((plan: any) => {
                            const producedQty = Array.isArray(plan.hourlyProductions)
                              ? plan.hourlyProductions.reduce((s: number, h: any) => s + Number(h.qtyProduced || 0), 0)
                              : 0;
                            const isCurrent = plan.dailyPlanId === viewPlan.dailyPlanId;
                            return (
                              <tr
                                key={plan.dailyPlanId}
                                className={`hover:bg-slate-50 transition-colors ${isCurrent ? "bg-indigo-50/60 border-l-2 border-l-indigo-500" : ""}`}
                              >
                                <td className="px-4 py-2.5">
                                  <span className={`font-mono text-xs font-semibold ${isCurrent ? "text-indigo-700" : "text-slate-700"}`}>
                                    {plan.dailyPlanId}
                                    {isCurrent && <span className="ml-1.5 text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase">Current</span>}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-600">
                                  {plan.productionDate ? new Date(plan.productionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-600">
                                  {plan.machine?.machineName || plan.machineId || "—"}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-medium">
                                    {plan.shift?.shiftName || plan.shiftId || "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-center text-xs font-semibold text-slate-700">
                                  {Number(plan.plannedQty || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className={`text-xs font-bold ${producedQty >= Number(plan.plannedQty || 0) ? "text-emerald-600" : producedQty > 0 ? "text-amber-600" : "text-slate-400"}`}>
                                    {producedQty.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <StatusBadge status={plan.status} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t border-slate-200">
                            <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-600">Total</td>
                            <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-800">
                              {poHistoryPlans.reduce((s: number, p: any) => s + Number(p.plannedQty || 0), 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-center text-xs font-bold text-emerald-700">
                              {poHistoryPlans.reduce((s: number, p: any) => {
                                const produced = Array.isArray(p.hourlyProductions)
                                  ? p.hourlyProductions.reduce((ss: number, h: any) => ss + Number(h.qtyProduced || 0), 0) : 0;
                                return s + produced;
                              }, 0).toLocaleString()}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 bg-slate-50 text-center">
                      <FaCalendarAlt className="text-slate-200 mb-2" size={24} />
                      <span className="text-slate-400 font-medium text-xs">No other daily plans found for this production order.</span>
                    </div>
                  )}
                </div>
              </div>


              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
                {(viewPlan.status === "APPROVED" || viewPlan.status === "IN_PROGRESS") && (
                  <button
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm shadow-sm"
                    onClick={() => { setShowViewModal(false); handleLogHourly(viewPlan); }}
                  >
                    <FaClipboardList size={13} /> Log Hourly Entry
                  </button>
                )}
                <button
                  className="px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm"
                  onClick={() => { setShowViewModal(false); setViewPlan(null); }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────── Stop Production Modal ─────── */}
        <CommonModal
          show={showStopModal}
          onHide={() => { setShowStopModal(false); setStopPlan(null); }}
          title={<span className="text-rose-600">Stop Production Plan</span>}
          maxWidth="3xl"
          footer={
            <div className="flex gap-2">
              <CustomButton
                text="Cancel"
                onClick={() => { setShowStopModal(false); setStopPlan(null); }}
                disabled={isStopping}
              />
              <CustomButton
                text={isStopping ? "Stopping..." : "Stop Production"}
                variant="danger"
                onClick={confirmStopProduction}
                disabled={isStopping || !stopReason.trim()}
              />
            </div>
          }
        >
          {(() => {
            const plannedQty = Number(stopPlan?.plannedQty || 0);
            const producedQty = Array.isArray(stopPlan?.hourlyProductions)
              ? stopPlan.hourlyProductions.reduce((sum: number, h: any) => sum + Number(h.qtyProduced || 0), 0)
              : 0;
            const pendingQty = plannedQty > producedQty ? plannedQty - producedQty : 0;

            return (
              <div className="text-slate-700 text-sm flex flex-col gap-4">
                <div>
                  <p className="mb-2">You are about to stop the production plan <strong className="text-slate-900">{stopPlan?.dailyPlanId}</strong> prematurely.</p>
                  <p className="text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-200">
                    The number of logged hourly productions is <strong>{
                      Array.isArray(stopPlan?.hourlyProductions)
                        ? stopPlan.hourlyProductions.filter((h: any) => Number(h.hourIndex) > 0).length
                        : 0
                    }</strong>. The planned hours for this plan will be adjusted to match the logged hours.
                  </p>
                </div>
                
                {(() => {
                  const relatedPlans = allPlans
                    .filter((p: any) => p.productionOrderId === stopPlan?.productionOrderId && p.dailyPlanId !== stopPlan?.dailyPlanId)
                    .sort((a: any, b: any) => new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime());
                  
                  if (relatedPlans.length === 0) return null;

                  const historyColumns: DataTableColumn<any>[] = [
                    { header: "Date", render: (row) => row.productionDate?.split("T")[0] || "—" },
                    { header: "Plan ID", render: (row) => <span className="font-mono text-slate-600">{row.dailyPlanId}</span> },
                    { header: "Planned", accessor: "plannedQty", align: "right" },
                    { 
                      header: "Produced", 
                      render: (row) => (
                        <span className="text-blue-600 font-medium">
                          {Array.isArray(row.hourlyProductions) ? row.hourlyProductions.reduce((s: number, h: any) => s + Number(h.qtyProduced || 0), 0) : 0}
                        </span>
                      ),
                      align: "right"
                    },
                    { 
                      header: "Status", 
                      align: "center",
                      render: (row) => <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200 rounded text-slate-700">{row.status.replace(/_/g, " ")}</span>
                    }
                  ];
                  
                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <h6 className="font-bold text-slate-800 text-xs uppercase mb-2">Production Order History</h6>
                      <div className="max-h-32 overflow-y-auto rounded border border-slate-200">
                        <DataTable
                          columns={historyColumns}
                          data={relatedPlans}
                          rowKey={(row) => row.dailyPlanId}
                          density="compact"
                        />
                      </div>
                    </div>
                  );
                })()}

                <TextArea
                  label="Reason for Stopping"
                  name="stopReason"
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  placeholder="e.g. Urgent production order PO-XXX required on this machine"
                  rows={3}
                  required
                />
                <div className="flex flex-col gap-2 mt-2">
                  <label className="font-bold text-slate-800 text-sm">Stop Action Type <span className="text-rose-500">*</span></label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        value: "completed_stop",
                        title: "Permanent Stop (Close PO)",
                        desc: "Stop this daily plan AND lock the Weekly Target. No new plans can be created. Post-production for produced pieces will still continue.",
                        activeClass: "border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20",
                        radioClass: "text-rose-600 focus:ring-rose-500"
                      },
                      {
                        value: "carry_forward",
                        title: "Stop This Daily Plan Only",
                        desc: pendingQty > 0 
                          ? `Stop this machine plan. Weekly Target remains open to carry forward the remaining ${pendingQty} pcs to a new plan later.`
                          : `Stop this machine plan. Weekly Target remains open for future planning.`,
                        activeClass: "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20",
                        radioClass: "text-amber-600 focus:ring-amber-500"
                      }
                    ].map(opt => (
                      <div
                          key={opt.value}
                          className={`cursor-pointer border rounded-xl p-3 flex flex-col transition-all ${stopOption === opt.value ? opt.activeClass : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                          onClick={() => setStopOption(opt.value as any)}
                        >
                          <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                            <input type="radio" name="stopOption" checked={stopOption === opt.value} onChange={() => setStopOption(opt.value as any)} className={opt.radioClass} />
                            {opt.title}
                          </div>
                          <span className="text-[11px] text-slate-500 mt-1 pl-5">{opt.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
              </div>
            );
          })()}
        </CommonModal>

        {/* ─────── Status Advance Confirm Modal ─────── */}
        <CommonConfirmModal
          show={showStatusModal}
          onHide={() => { setShowStatusModal(false); setStatusChangePlan(null); }}
          onConfirm={confirmStatusChange}
          title={statusModalTitle}
          message={statusModalMessage}
          confirmText="Confirm"
          confirmVariant="success"
        />

        {/* ─────── Delete Confirm Modal ─────── */}
        <CommonConfirmModal
          show={showDeleteModal}
          onHide={() => { setShowDeleteModal(false); setDeletePlanId(null); }}
          onConfirm={handleDeleteConfirm}
          title="Delete Daily Plan"
          message="Are you sure you want to permanently delete this daily production plan?"
          confirmText="Delete"
          confirmVariant="danger"
        />

        {/* ─────── Material Issue Modal ─────── */}
        {showMaterialIssueModal && materialIssuePlan && (
          <MaterialIssueModal
            show={showMaterialIssueModal}
            onHide={() => { setShowMaterialIssueModal(false); setMaterialIssuePlan(null); }}
            productionOrderId={materialIssuePlan.productionOrderId}
            rawMaterials={materialIssuePlan.productionOrder?.draftRawMaterials || materialIssuePlan.productionOrder?.rawMaterials || []}
            rawMaterialsMap={rawMaterialsMap}
            defaultStoreId={materialIssuePlan.productionOrder?.sourceStoreId}
            dailyPlanQty={Number(materialIssuePlan.plannedQty || 0)}
            totalTargetQty={Number(materialIssuePlan.productionOrder?.targetQty || 0)}
            onSuccess={handleMaterialIssueSuccess}
          />
        )}

        {/* ─────── Production Order View Modal ─────── */}
        <ProductionOrderViewModal
          show={showPOViewModal}
          onHide={() => { setShowPOViewModal(false); setSelectedPOForView(null); }}
          order={selectedPOForView}
        />
      </div>
      {/* Report Modal */}
      {showReportModal && (
        <DailyProductionReportModal
          show={showReportModal}
          onHide={() => { setShowReportModal(false); setReportPlan(null); }}
          dailyPlans={reportPlan ? [reportPlan] : dailyPlans}
          hourlyProductions={[]}
          machines={machines}
          shifts={shifts}
          products={[]}
        />
      )}
    </div>
  );
};

export default DailyProductionPlanningPage;
