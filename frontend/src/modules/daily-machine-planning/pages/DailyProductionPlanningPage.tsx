import React, { useState, useEffect, useMemo, useCallback } from "react";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaPlus, FaPlay, FaStop, FaClipboardList, FaCalendarAlt, FaIndustry,
  FaCheckCircle, FaEdit, FaInfoCircle,
  FaArrowRight, FaShare, FaTimes
} from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { fetchDailyPlans, updateDailyPlan, deleteDailyPlan } from "../../../features/daily-plans/dailyPlanSlice";
import apiClient from "../../../api/apiClient";
import config from "../../../api/config";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CustomButton from "../../../components/ui/Button/Button";
import IconButton from "../../../components/ui/IconButton/IconButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CustomProgressBar from "../../../components/common/CustomProgressBar";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import type { ProductionOrder } from "../../../services/productionOrderService";
import { ProductionOrderViewModal } from "../../production-orders/components/ProductionOrderViewModal";
import { oeeService } from "../../../services/oeeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { MaterialIssueModal } from "../../production-orders/components/MaterialIssueModal";

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

  const { data: machines } = useAppSelector((state) => state.machines);

  const { data: dailyPlans, loading } = useAppSelector((state: any) => state.dailyPlans);

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
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewPlan, setViewPlan] = useState<any>(null);
  const [viewHourlyLogs, setViewHourlyLogs] = useState<any[]>([]);
  const [loadingViewLogs, setLoadingViewLogs] = useState(false);
  const [viewPlanOeeSummary, setViewPlanOeeSummary] = useState<any>(null);

  // New state for viewing Production Order details
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
        dataList.forEach((rm: any) => {
          map.set(rm.rawMaterialId?.toString(), rm);
        });
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
  const filteredPlans = useMemo(() => {
    return Array.isArray(dailyPlans) ? dailyPlans : [];
  }, [dailyPlans]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterDate, filterStatus, filterMachine]);

  const paginatedPlans = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPlans.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPlans, currentPage]);

  const totalPages = Math.ceil(filteredPlans.length / itemsPerPage);

  // Stats
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
  // Navigate to Create page
  const openCreateForm = () => {
    navigate("/daily-production-plans/create");
  };

  const openEditForm = (plan: any) => {
    navigate(`/daily-production-plans/edit/${plan.dailyPlanId}`);
  };


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

    // Intercept when starting production (PLANNED -> IN_PROGRESS) if materials have not been issued
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
      await dispatch(updateDailyPlan({
        id: materialIssuePlan.dailyPlanId,
        data: { status: "IN_PROGRESS" }
      })).unwrap();
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
      await dispatch(updateDailyPlan({
        id: statusChangePlan.dailyPlanId,
        data: { status: statusChangingTo }
      })).unwrap();

      const isDynamicAdvance = statusModalTitle.includes("Advance") || statusModalTitle.includes("Next Step");
      const nextStepPart = statusModalMessage.split('move to ')[1]?.replace('?', '');

      if (isDynamicAdvance && nextStepPart) {
        toast.success(`Production advanced to ${nextStepPart}`);
      } else {
        toast.success(`Status updated to ${STATUS_FLOW[statusChangingTo]?.label || statusChangingTo}`);
      }

      setShowStatusModal(false);
      setStatusChangePlan(null);
      loadDailyPlans();
    } catch (err: any) {
      toast.error(err || "Failed to update status");
    }
  };

  // const handleCancelPlan = async (plan: any) => {
  //   try {
  //     await dispatch(updateDailyPlan({
  //       id: plan.dailyPlanId,
  //       data: { status: "CANCELLED" }
  //     })).unwrap();
  //     toast.success("Daily Plan cancelled.");
  //     loadDailyPlans();
  //   } catch (err: any) {
  //     toast.error(err || "Failed to cancel plan");
  //   }
  // };

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

      const targetStatus = stopOption === "completed_stop" ? "COMPLETED" : "STOPPED";
      const updatedRemarks = stopPlan.remarks
        ? `${stopPlan.remarks} | Stopped: ${stopReason.trim()}`
        : `Stopped: ${stopReason.trim()}`;

      await dispatch(updateDailyPlan({
        id: stopPlan.dailyPlanId,
        data: {
          status: targetStatus,
          remarks: updatedRemarks,
          plannedHours: loggedHoursCount > 0 ? loggedHoursCount : stopPlan.plannedHours
        }
      })).unwrap();

      toast.success(targetStatus === "COMPLETED" ? "Production completed and closed successfully!" : "Production stopped successfully!");
      
      const plannedQty = Number(stopPlan.plannedQty || 0);
      const producedQty = Array.isArray(stopPlan.hourlyProductions)
        ? stopPlan.hourlyProductions.reduce((sum: number, h: any) => sum + Number(h.qtyProduced || 0), 0)
        : 0;
      const pendingQty = plannedQty > producedQty ? plannedQty - producedQty : 0;

      setShowStopModal(false);
      const currentPlan = stopPlan;
      setStopPlan(null);

      if (stopOption === "carry_forward" && pendingQty > 0) {
        handleCarryForward(currentPlan, pendingQty);
      } else {
        loadDailyPlans();
      }
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
  // View Hourly Logs
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewPlan || !showViewModal) {
      setViewHourlyLogs([]);
      setViewPlanOeeSummary(null);
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

    // Fetch OEE summary for the production order
    oeeService.getProductionOrderOee(viewPlan.productionOrderId)
      .then((data: any) => setViewPlanOeeSummary(data))
      .catch(() => setViewPlanOeeSummary(null));
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
  // Render
  // ──────────────────────────────────────────────────────────────

  const columns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "50px",
      render: (_row: any, idx: number) => <span className="text-slate-500">{(currentPage - 1) * itemsPerPage + idx + 1}</span>
    },
    {
      header: "PRODUCTION ORDER",
      width: "220px",
      render: (plan: any) => (
        <div>
          <div className="font-semibold text-slate-800 flex items-center gap-2">
            <button 
              className="text-primary hover:text-blue-700 hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
              onClick={() => {
                setSelectedPOForView(plan.productionOrder);
                setShowPOViewModal(true);
              }}
              title="Click to view full Production Order details"
            >
              {plan.productionOrderId}
            </button>
          </div>
          <div className="text-slate-500 text-xs mt-1.5 flex flex-col gap-1.5 items-start">
            <span className="line-clamp-1" title={plan.productionOrder?.productItem?.productName || ""}>
              {plan.productionOrder?.productItem?.productName || "—"}
            </span>
          </div>
        </div>
      )
    },
    {
      header: "MACHINE / SHIFT",
      render: (plan: any) => (
        <div>
          <div className="font-semibold text-slate-700 flex items-center">
            <FaIndustry className="mr-2 text-slate-400" />
            {plan.machine?.machineName || plan.machineId || "—"}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-medium">
              {plan.shift?.shiftName || plan.shiftId || "—"}
            </span>
            {(plan.shift?.startTime && plan.shift?.endTime) && (
              <span className="text-slate-500 text-[10px]">
                {plan.shift.startTime.slice(0, 5)} - {plan.shift.endTime.slice(0, 5)}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      header: "PLANNED QTY",
      render: (plan: any) => {
        const plannedQty = Number(plan.plannedQty || 0);
        return (
          <div className="font-medium text-slate-700">
            <div>{plannedQty.toLocaleString()} pcs</div>
            {plan.plannedHours && (
              <div className="text-slate-500 text-xs mt-0.5">{plan.plannedHours} hrs</div>
            )}
            {plan.carryForwardFromPlanId && (
              <div className="mt-1 flex items-center gap-1">
                <span className="bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap">
                  ↩ From {plan.carryForwardFromPlanId}
                </span>
              </div>
            )}
            {Array.isArray(plan.carryForwardTo) && plan.carryForwardTo.length > 0 && (
              <div className="mt-1 flex items-center gap-1">
                <span className="bg-sky-100 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap">
                  ↪ To {plan.carryForwardTo[0].dailyPlanId}
                </span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: "PROGRESS",
      width: "180px",
      render: (plan: any) => {
        const plannedQty = Number(plan.plannedQty || 0);
        const producedQty = Array.isArray(plan.hourlyProductions)
          ? plan.hourlyProductions.reduce((sum: number, h: any) => sum + Number(h.qtyProduced || 0), 0)
          : 0;
        const progressPercent = Math.min(100, plannedQty > 0 ? Math.round((producedQty / plannedQty) * 100) : 0);
        return (
          <div>
            <div className="mb-2">
              <CustomProgressBar progressPercent={progressPercent} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">{producedQty} / {plannedQty} pcs</span>
            </div>
          </div>
        );
      }
    },
    {
      header: "PENDING / EXTRA",
      width: "140px",
      render: (plan: any) => {
        const plannedQty = Number(plan.plannedQty || 0);
        const producedQty = Array.isArray(plan.hourlyProductions)
          ? plan.hourlyProductions.reduce((sum: number, h: any) => sum + Number(h.qtyProduced || 0), 0)
          : 0;
        const pendingQty = plannedQty > producedQty ? plannedQty - producedQty : 0;

        return (
          <div className="flex">
            {producedQty > plannedQty ? (
              <StatusBadge
                status="COMPLETED"
                customText={`+${producedQty - plannedQty} Extra`}
                customColor={{ bg: '#d1fae5', text: '#065f46' }}
              />
            ) : (pendingQty > 0 && plan.status !== "COMPLETED" && plan.status !== "CANCELLED") ? (
              <StatusBadge
                status="PENDING"
                customText={`${pendingQty} Pending`}
                customColor={{ bg: '#fee2e2', text: '#b91c1c' }}
              />
            ) : (
              <span className="text-slate-400 text-[11px] font-medium">—</span>
            )}
          </div>
        );
      }
    },
    {
      header: "PRIORITY",
      render: (plan: any) => (
        <StatusBadge status={plan.priority || "MEDIUM"} />
      )
    },
    {
      header: "STATUS",
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
          <div className="flex flex-col items-start gap-1.5">
            <div className="flex items-center gap-2">
              <StatusBadge 
                status={plan.status === "COMPLETED" && producedQty < plannedQty ? "SHORT_CLOSED" : plan.status} 
              />
              {(plan.status === "STOPPED" || plan.status === "CANCELLED" || (plan.status === "COMPLETED" && producedQty < plannedQty)) && plan.remarks && (
                <div className="group relative flex items-center justify-center cursor-pointer">
                  <FaInfoCircle className="text-rose-500 text-[15px] opacity-85 hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center shadow-lg">
                    <span className="font-bold text-amber-400 block mb-1 text-left">Reason:</span>
                    <div className="text-left">
                      {plan.remarks.includes("Stopped:") || plan.remarks.includes("Cancelled:")
                        ? plan.remarks.split("|").pop()?.replace("Stopped:", "")?.replace("Cancelled:", "").trim()
                        : plan.remarks}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {activeStepName && (
              <span className="bg-indigo-50/80 text-indigo-600 px-1.5 py-0.5 rounded-[4px] text-[9px] font-semibold border border-indigo-100 uppercase tracking-wider inline-block">
                {activeStepName}
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: "ACTIONS",
      width: "180px",

      render: (plan: any) => {
        const plannedQty = Number(plan.plannedQty || 0);
        const producedQty = Array.isArray(plan.hourlyProductions)
          ? plan.hourlyProductions.reduce((sum: number, h: any) => sum + Number(h.qtyProduced || 0), 0)
          : 0;
        const pendingQty = plannedQty > producedQty ? plannedQty - producedQty : 0;
        const nextStatus = STATUS_FLOW[plan.status]?.next;
        let canAdvance = !!nextStatus && plan.status !== "COMPLETED" && plan.status !== "CANCELLED";
        if (plan.status === "IN_PROGRESS") {
          canAdvance = canAdvance && (producedQty >= plannedQty);
        }
        const canLog = plan.status === "IN_PROGRESS";

        // A plan can only be carried forward ONCE — check via the API-returned carryForwardTo array
        const alreadyCarriedForward = Array.isArray(plan.carryForwardTo) && plan.carryForwardTo.length > 0;
        const canCarryForward = (plan.status === "STOPPED" || plan.status === "POST_PRODUCTION") && pendingQty > 0 && !alreadyCarriedForward;

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
        
        if (plan.status === "STOPPED" && producedQty > 0) {
           targetNextStatus = "POST_PRODUCTION";
           dynamicActionTitle = "Move to Post Production";
           dynamicActionIcon = FaArrowRight;
           dynamicActionVariant = "info";
           dynamicModalTitle = "Move to Post Production";
           dynamicModalMessage = `Move to Post Production phase for the produced ${producedQty} pcs?`;
           canAdvance = true;
        }

        return (
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            <ViewButton onClick={() => { setViewPlan(plan); setShowViewModal(true); }} />
            {canLog && (
              <IconButton
                variant="primary"
                title="Log Hourly Production"
                icon={FaClipboardList}
                onClick={() => handleLogHourly(plan)}
              />
            )}
            {canAdvance && (
              <IconButton
                variant={dynamicActionVariant}
                title={dynamicActionTitle}
                icon={dynamicActionIcon}
                onClick={() => handleStatusAdvance(plan, producedQty, targetNextStatus as any, dynamicModalTitle as any, dynamicModalMessage as any)}
              />
            )}
            {plan.status === "IN_PROGRESS" && (
              <IconButton
                variant="danger"
                title="Stop Production"
                icon={FaStop}
                onClick={() => handleStopProductionClick(plan)}
              />
            )}
            {(plan.status === "DRAFT" || plan.status === "PLANNED") && (
              <IconButton
                variant="info"
                title="Edit Plan"
                icon={FaEdit}
                onClick={() => openEditForm(plan)}
              />
            )}
            {canCarryForward && (
              <IconButton
                variant="warning"
                title={`Carry Forward ${pendingQty} pcs`}
                icon={FaShare}
                onClick={() => handleCarryForward(plan, pendingQty)}
              />
            )}
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

  return (
    <div className="p-4 md:p-6 min-h-screen bg-white">
      <div className="w-full">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Daily Production Planning</h2>
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
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  Date
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={draftFilterDate}
                  onChange={(e) => setDraftFilterDate(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  Machine
                </label>
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
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  Status
                </label>
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

            <CustomButton
              text="New Production Order"
              icon={FaPlus}
              onClick={() => navigate("/production-orders/create")}
            />
            <CustomButton
              text="New Daily Plan"
              icon={FaPlus}
              onClick={openCreateForm}
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Plans", value: stats.total, icon: FaCalendarAlt, colorClass: "text-indigo-600", iconColor: "text-indigo-500", bgClass: "bg-indigo-50/80" },
            { label: "Planned", value: stats.planned, icon: FaCheckCircle, colorClass: "text-amber-600", iconColor: "text-amber-500", bgClass: "bg-amber-50/80" },
            { label: "In Progress", value: stats.running, icon: FaPlay, colorClass: "text-sky-600", iconColor: "text-sky-500", bgClass: "bg-sky-50/80" },
            { label: "Completed", value: stats.completed, icon: FaStop, colorClass: "text-emerald-600", iconColor: "text-emerald-500", bgClass: "bg-emerald-50/80" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-2xl shadow-sm border border-slate-100/50 p-4 flex items-center justify-between transition-transform hover:-translate-y-1 cursor-default ${stat.bgClass}`}>
              <div className={`${stat.iconColor}`}>
                <stat.icon size={30} />
              </div>
              <div className="text-right">
                <h6 className={`text-sm font-semibold mb-1 ${stat.colorClass}`}>{stat.label}</h6>
                <h4 className={`text-3xl font-bold m-0 ${stat.colorClass}`}>{stat.value}</h4>
              </div>
            </div>
          ))}
        </div>

        {/* Daily Plans Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
          <div className="p-0">
            <DataTable
              columns={columns}
              data={paginatedPlans}
              rowKey={(row) => row.dailyPlanId}
              loading={loading}
              pagination={{
                currentPage,
                totalPages,
                onPageChange: setCurrentPage
              }}
              emptyMessage={
                <div className="text-center py-12">
                  <FaCalendarAlt className="text-slate-300 mx-auto mb-3" size={32} />
                  <h5 className="text-slate-500 mb-1 font-semibold">No daily plans found</h5>
                  <p className="text-slate-400 text-sm mb-0">
                    Click "New Daily Plan" to schedule a production run for today.
                  </p>
                </div>
              }
            />
          </div>
        </div>



        {/* ─────── View Modal ─────── */}
        {showViewModal && viewPlan && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Daily Plan — {viewPlan.dailyPlanId}</h3>
                  <p className="text-sm text-slate-500 mt-1">Detailed view of production plan</p>
                </div>
                <button onClick={() => { setShowViewModal(false); setViewPlan(null); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <FaTimes size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <h6 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-3">Plan Details</h6>
                  <div className="flex flex-col gap-2 text-sm text-slate-700">
                    <span><strong className="text-slate-900">Production Order:</strong> {viewPlan.productionOrderId}</span>
                    <span><strong className="text-slate-900">Product:</strong> {viewPlan.productionOrder?.productItem?.productName || "—"}</span>
                    <span><strong className="text-slate-900">Date:</strong> {viewPlan.productionDate?.split("T")[0]}</span>
                    <span><strong className="text-slate-900">Machine:</strong> {viewPlan.machine?.machineName || viewPlan.machineId}</span>
                    <span><strong className="text-slate-900">Shift:</strong> {viewPlan.shift?.shiftName || viewPlan.shiftId}</span>
                  </div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <h6 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-3">Quantities</h6>
                  <div className="flex flex-col gap-2 text-sm text-slate-700">
                    <span><strong className="text-slate-900">Planned Qty:</strong> {viewPlan.plannedQty} pcs</span>
                    <span><strong className="text-slate-900">Planned Hours:</strong> {viewPlan.plannedHours || "—"} hrs</span>
                    <span className="flex items-center gap-2"><strong className="text-slate-900">Priority:</strong> <StatusBadge status={viewPlan.priority || "MEDIUM"} /></span>
                    <span className="flex items-center gap-2"><strong className="text-slate-900">Status:</strong> <StatusBadge status={viewPlan.status} /></span>
                    {viewPlan.remarks && <span><strong className="text-slate-900">Remarks:</strong> {viewPlan.remarks}</span>}
                  </div>
                </div>
              </div>
              
              {viewPlan.productionOrder?.productItem?.productionSteps && viewPlan.productionOrder.productItem.productionSteps.length > 0 && (
                <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <h6 className="font-bold text-xs text-slate-600 uppercase tracking-wider m-0">Post Production Steps</h6>
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
                        } else if (viewPlan.status === "STOPPED" || viewPlan.status === "CANCELLED") {
                            isCompleted = stepNum < currentStep;
                        }

                        const badgeColors = isCompleted 
                           ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                           : isActive 
                             ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                             : "bg-slate-50 text-slate-500 border-slate-200";
                             
                        const dotColors = isCompleted
                           ? "bg-emerald-500 text-white"
                           : isActive
                             ? "bg-indigo-600 text-white"
                             : "bg-slate-300 text-slate-600";

                        return (
                          <React.Fragment key={step.id || idx}>
                              <span className={`px-3 py-1.5 font-semibold text-xs rounded border flex items-center gap-1.5 ${badgeColors}`}>
                                  <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] ${dotColors}`}>
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

              <h6 className="font-bold text-sm text-primary uppercase tracking-wider mb-4">
                Hourly Production Entries
              </h6>
              {loadingViewLogs ? (
                <div className="text-center py-6 border border-slate-200 rounded-xl bg-slate-50">
                  <div className="inline-block w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-2 text-slate-500 text-sm font-medium">Loading entries...</p>
                </div>
              ) : viewHourlyLogs.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <DataTable
                    columns={[
                      { header: "Hour", render: (h: any) => <span className="font-bold font-mono text-slate-700">H{h.hourIndex}</span> },
                      { header: "Produced", render: (h: any) => <span className="font-bold text-emerald-600">{h.qtyProduced}</span> },
                      { header: "Reject", render: (h: any) => <span className="text-rose-600">{h.rejectQty || 0}</span> },
                      { header: "Scrap", render: (h: any) => <span className="text-amber-500">{h.scrapQty || 0}</span> },
                      { header: "Downtime", render: (h: any) => <span className="text-slate-500">{h.downtime > 0 ? `${h.downtime} min` : "—"}</span> },
                      { header: "Avail%", render: (h: any) => <span className="font-semibold text-emerald-700">{h.availabilityPct !== undefined ? `${h.availabilityPct}%` : '—'}</span> },
                      { header: "Qual%", render: (h: any) => <span className="font-semibold text-purple-700">{h.qualityPct !== undefined ? `${h.qualityPct}%` : '—'}</span> },
                      { header: "OEE%", render: (h: any) => <span className="font-extrabold text-blue-700">{h.hourlyOEE !== undefined ? `${h.hourlyOEE}%` : '—'}</span> },
                      { header: "Operator", render: (h: any) => <span className="text-slate-600 font-medium text-xs truncate max-w-[120px] inline-block" title={h.operatorName || h.operatorId}>{h.operatorName || h.operatorId || "—"}</span> }
                    ]}
                    data={viewHourlyLogs}
                    rowKey={(h: any) => h.hourlyProductionId}
                    minHeightClassName="min-h-0"
                  />
                  <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-sm font-bold">
                        <span className="text-slate-700">Total:</span>
                        <div className="flex flex-wrap gap-4">
                            <span className="text-emerald-600">Produced: {viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.qtyProduced || 0), 0)}</span>
                            <span className="text-rose-600">Reject: {viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.rejectQty || 0), 0)}</span>
                            <span className="text-amber-500">Scrap: {viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.scrapQty || 0), 0)}</span>
                            <span className="text-slate-600">Downtime: {(() => { const t = viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.downtime || 0), 0); return t > 0 ? `${t} min` : "—"; })()}</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-200 border-dashed">
                        <div className="flex gap-6 font-bold">
                            <span className="text-slate-700">Total Produced: <span className="text-emerald-600 ml-1">{viewPlanOeeSummary?.producedQty || viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.qtyProduced || 0), 0)} pcs</span></span>
                            <span className="text-slate-700">Pending: <span className="text-amber-600 ml-1">{viewPlanOeeSummary?.remainingQty ?? (Number(viewPlan.plannedQty) - viewHourlyLogs.reduce((s: any, h: any) => s + Number(h.qtyProduced || 0), 0))} pcs</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium text-xs uppercase tracking-wider">Carried Forward To:</span>
                            {viewPlan.carryForwardTo && viewPlan.carryForwardTo.length > 0 ? (
                                <span className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shadow-sm flex items-center gap-1">
                                    <FaShare className="text-[10px]" />
                                    {viewPlan.carryForwardTo[0].dailyPlanId} 
                                    <span className="text-indigo-400 font-normal ml-1">
                                        ({viewPlan.carryForwardTo[0].productionDate?.split('T')[0]})
                                    </span>
                                </span>
                            ) : (
                                <span className="text-slate-400 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">NULL</span>
                            )}
                        </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500 p-8 border border-slate-200 rounded-xl bg-slate-50">
                  <FaClipboardList className="mx-auto text-slate-300 text-3xl mb-3" />
                  <span className="font-medium">No hourly entries recorded yet for this plan.</span>
                </div>
              )}

              {/* ─── OEE & Production Summary ─────────────────────────────── */}
              {/* {viewPlanOeeSummary && (
                <div className="mt-6 rounded-xl p-4 bg-linear-to-br from-slate-800 to-blue-900 text-white shadow-lg">
                  <div className="font-bold mb-4 text-[13px] tracking-wider uppercase opacity-90">
                    📊 Production OEE Summary
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center mb-4">
                    <div>
                      <div className="text-2xl font-extrabold">{viewPlanOeeSummary.oeePercent}%</div>
                      <div className="text-[9px] opacity-75 uppercase tracking-wider mt-1">Overall OEE</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-emerald-300">{viewPlanOeeSummary.availability}%</div>
                      <div className="text-[9px] opacity-75 uppercase tracking-wider mt-1">Availability</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-amber-200">{viewPlanOeeSummary.performance}%</div>
                      <div className="text-[9px] opacity-75 uppercase tracking-wider mt-1">Performance</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-300">{viewPlanOeeSummary.quality}%</div>
                      <div className="text-[9px] opacity-75 uppercase tracking-wider mt-1">Quality</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{viewPlanOeeSummary.runtimeMinutes} <span className="text-[11px] font-normal">min</span></div>
                      <div className="text-[9px] opacity-75 uppercase tracking-wider mt-1">Runtime</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-rose-300">{viewPlanOeeSummary.downtimeMinutes} <span className="text-[11px] font-normal">min</span></div>
                      <div className="text-[9px] opacity-75 uppercase tracking-wider mt-1">Downtime</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center pt-4 border-t border-white/20">
                    {[
                      { label: 'Planned', value: viewPlanOeeSummary.targetQty, color: 'text-blue-300' },
                      { label: 'Produced', value: viewPlanOeeSummary.producedQty, color: 'text-emerald-300' },
                      { label: 'Good Qty', value: viewPlanOeeSummary.goodQty, color: 'text-emerald-200' },
                      { label: 'Reject', value: viewPlanOeeSummary.rejectQty, color: 'text-rose-300' },
                      { label: 'Scrap', value: viewPlanOeeSummary.scrapQty, color: 'text-amber-200' },
                      { label: 'Remaining', value: viewPlanOeeSummary.remainingQty, color: 'text-slate-300' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div className={`text-sm font-bold ${color}`}>{Number(value)}</div>
                        <div className="text-[9px] opacity-75 uppercase tracking-wider mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )} */}
              </div>
              
              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                {(viewPlan.status === "APPROVED" || viewPlan.status === "IN_PROGRESS") && (
                  <button
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm shadow-sm"
                    onClick={() => { setShowViewModal(false); handleLogHourly(viewPlan); }}
                  >
                    <FaClipboardList /> Log Hourly Entry
                  </button>
                )}
                <button
                  className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm"
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
          footer={
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm"
                onClick={() => { setShowStopModal(false); setStopPlan(null); }}
                disabled={isStopping}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium text-sm disabled:opacity-50"
                onClick={confirmStopProduction}
                disabled={isStopping || !stopReason.trim()}
              >
                {isStopping ? "Stopping..." : "Stop Production"}
              </button>
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
                    }</strong>.
                    The planned hours for this plan will be adjusted to match the logged hours to release the remaining shift capacity.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-800 text-sm">Reason for Stopping <span className="text-rose-500">*</span></label>
                  <textarea
                    className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    rows={3}
                    placeholder="e.g. Urgent production order PO-XXX required on this machine"
                    value={stopReason}
                    onChange={(e) => setStopReason(e.target.value)}
                    required
                  />
                </div>

                {pendingQty > 0 && (
                  <div className="flex flex-col gap-2">
                    <label className="font-bold text-slate-800 text-sm">Stop Action Type</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        className={`cursor-pointer border rounded-xl p-3 flex flex-col transition-all ${
                          stopOption === "completed_stop"
                            ? "border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                        onClick={() => setStopOption("completed_stop")}
                      >
                        <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                          <input
                            type="radio"
                            name="stopOption"
                            checked={stopOption === "completed_stop"}
                            onChange={() => setStopOption("completed_stop")}
                            className="text-rose-600 focus:ring-rose-500"
                          />
                          Completed Stop
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 pl-5">
                          Stop production without carrying forward any quantity.
                        </span>
                      </div>

                      <div
                        className={`cursor-pointer border rounded-xl p-3 flex flex-col transition-all ${
                          stopOption === "carry_forward"
                            ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                        onClick={() => setStopOption("carry_forward")}
                      >
                        <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                          <input
                            type="radio"
                            name="stopOption"
                            checked={stopOption === "carry_forward"}
                            onChange={() => setStopOption("carry_forward")}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          Stop & Carry Forward
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 pl-5">
                          Carry forward the remaining <strong>{pendingQty} pcs</strong> to a new daily plan.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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

        {/* ─────── Material Issue Modal for Daily Production Start ─────── */}
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
    </div>
  );
};

export default DailyProductionPlanningPage;
