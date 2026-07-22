import React, { useState, useEffect, useMemo, useCallback } from "react";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaPlus, FaPlay, FaStop, FaClipboardList, FaCalendarAlt, FaIndustry,
  FaCheckCircle, FaEdit, FaInfoCircle,
  FaArrowRight, FaShare, FaThumbsUp
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
import { oeeService } from "../../../services/oeeService";

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
  IN_PROGRESS: { label: "In Progress", next: "COMPLETED", color: "success" },
  COMPLETED: { label: "Completed", next: null, color: "success" },
  CANCELLED: { label: "Cancelled", next: null, color: "danger" },
  STOPPED: { label: "Stopped", next: null, color: "danger" },
};

const NEXT_ACTION_LABELS: Record<string, string> = {
  DRAFT: "Mark as Planned",
  PLANNED: "Start Production",
  IN_PROGRESS: "Mark Completed",
};

const NEXT_ACTION_ICONS: Record<string, any> = {
  DRAFT: FaCalendarAlt,
  PLANNED: FaPlay,
  IN_PROGRESS: FaCheckCircle,
};

// ---------- Component ----------
const DailyProductionPlanningPage: React.FC = () => {
  const navigate = useNavigate();
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
  }, [loadDailyPlans]);

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
  const handleStatusAdvance = (plan: any, producedQty: number = 0, dynamicTitle?: string, dynamicMessage?: string) => {
    let nextStatus = STATUS_FLOW[plan.status]?.next;
    console.log(plan, "plan");
    console.log(nextStatus, "nextStatus");
    if (!nextStatus) return;

    if (nextStatus === "COMPLETED" && producedQty === 0) {
      toast.warning("Cannot mark as completed without logging any production!");
      return;
    }

    // Override the nextStatus if we are just advancing the step
    if (dynamicTitle === "Advance to Next Step") {
      nextStatus = "NEXT_STEP";
    }

    setStatusChangePlan(plan);
    setStatusChangingTo(nextStatus);
    setStatusModalTitle(dynamicTitle || NEXT_ACTION_LABELS[plan.status] || "Confirm Status Change");
    setStatusModalMessage(dynamicMessage || `Change status of plan ${plan.dailyPlanId} from "${STATUS_FLOW[plan.status]?.label}" to "${STATUS_FLOW[nextStatus]?.label || nextStatus}"?`);
    setShowStatusModal(true);
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

      const updatedRemarks = stopPlan.remarks
        ? `${stopPlan.remarks} | Stopped: ${stopReason.trim()}`
        : `Stopped: ${stopReason.trim()}`;

      await dispatch(updateDailyPlan({
        id: stopPlan.dailyPlanId,
        data: {
          status: "STOPPED",
          remarks: updatedRemarks,
          plannedHours: loggedHoursCount > 0 ? loggedHoursCount : stopPlan.plannedHours
        }
      })).unwrap();

      toast.success("Production stopped successfully!");
      setShowStopModal(false);
      setStopPlan(null);
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
        remarks: `Carried forward from Daily Plan ${plan.dailyPlanId}`,
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
            {plan.productionOrderId}
            {plan.productionOrder?.currentProductionStep && (
              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-100 uppercase tracking-wider">
                {plan.productionOrder.currentProductionStep}
              </span>
            )}
          </div>
          <div className="text-slate-500 text-xs mt-1 line-clamp-1" title={plan.productionOrder?.productItem?.productName || ""}>
            {plan.productionOrder?.productItem?.productName || "—"}
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
            ) : pendingQty > 0 ? (
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
        return (
          <div className="flex items-center gap-2">
            <StatusBadge status={plan.status === "COMPLETED" && producedQty < plannedQty ? "SHORT_CLOSED" : plan.status} />
            {(plan.status === "STOPPED" || plan.status === "CANCELLED") && plan.remarks && (
              <div className="group relative flex items-center justify-center cursor-pointer">
                <FaInfoCircle className="text-rose-500 text-[15px] opacity-85 hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center shadow-lg">
                  <span className="font-bold text-amber-400 block mb-1 text-left">Reason:</span>
                  <div className="text-left">
                    {plan.remarks.includes("Stopped:") || plan.remarks.includes("Cancelled:")
                      ? plan.remarks.split("|").pop()?.replace("Stopped:", "")?.replace("Cancelled:", "").trim()
                      : plan.remarks}
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                </div>
              </div>
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
        const canAdvance = !!nextStatus && plan.status !== "COMPLETED" && plan.status !== "CANCELLED";
        const canLog = plan.status === "IN_PROGRESS";

        // A plan can only be carried forward ONCE — check via the API-returned carryForwardTo array
        const alreadyCarriedForward = Array.isArray(plan.carryForwardTo) && plan.carryForwardTo.length > 0;
        const canCarryForward = (plan.status === "COMPLETED" || plan.status === "STOPPED") && pendingQty > 0 && !alreadyCarriedForward;

        let dynamicActionTitle = NEXT_ACTION_LABELS[plan.status] || `Move to ${nextStatus}`;
        let dynamicActionIcon = NEXT_ACTION_ICONS[plan.status] || FaArrowRight;
        let dynamicModalTitle = "";
        let dynamicModalMessage = "";

        if (plan.status === "IN_PROGRESS") {
          const customSteps = plan.productionOrder?.productItem?.productionSteps || [];
          if (customSteps.length > 0) {
            const totalStepsCount = 1 + customSteps.length;
            const currentIndex = plan.productionOrder?.currentStepIndex || 0;
            const currentStepName = currentIndex === 0 ? "Production" : (customSteps[currentIndex - 1]?.stepKey || "Current Step");
            const isLastStep = currentIndex >= totalStepsCount - 1;

            if (!isLastStep) {
              const nextStepName = customSteps[currentIndex].stepKey;
              dynamicActionTitle = `Next Step (${nextStepName})`;
              dynamicActionIcon = FaArrowRight;
              dynamicModalTitle = "Advance to Next Step";
              dynamicModalMessage = `Complete ${currentStepName} and move to ${nextStepName}?`;
            } else {
              dynamicActionTitle = "Complete Production";
              dynamicActionIcon = FaCheckCircle;
              dynamicModalTitle = "Complete Production";
              dynamicModalMessage = `Complete ${currentStepName} and move to Post Production?`;
            }
          }
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
                variant="success"
                title={dynamicActionTitle}
                icon={dynamicActionIcon}
                onClick={() => handleStatusAdvance(plan, producedQty, dynamicModalTitle, dynamicModalMessage)}
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
        <CommonModal
          show={showViewModal}
          onHide={() => { setShowViewModal(false); setViewPlan(null); }}
          title={`Daily Plan — ${viewPlan?.dailyPlanId}`}
          footer={
            viewPlan && (
              <div className="flex gap-2">
                {(viewPlan.status === "APPROVED" || viewPlan.status === "IN_PROGRESS") && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
                    onClick={() => { setShowViewModal(false); handleLogHourly(viewPlan); }}
                  >
                    <FaClipboardList /> Log Hourly Entry
                  </button>
                )}
                <button
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm"
                  onClick={() => setShowViewModal(false)}
                >
                  Close
                </button>
              </div>
            )
          }
        >
          {viewPlan && (
            <>
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

              <h6 className="font-bold text-xs text-primary uppercase tracking-wider mb-3">
                Hourly Production Entries
              </h6>
              {loadingViewLogs ? (
                <div className="text-center py-6">
                  <div className="inline-block w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-2 text-slate-500 text-sm">Loading...</p>
                </div>
              ) : viewHourlyLogs.length > 0 ? (
                <div className="rounded-lg border border-slate-200 overflow-x-auto">
                  <table className="w-full text-sm text-center border-collapse">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-2 py-2 font-semibold">Hour</th>
                        <th className="px-2 py-2 font-semibold">Produced</th>
                        <th className="px-2 py-2 font-semibold">Reject</th>
                        <th className="px-2 py-2 font-semibold">Scrap</th>
                        <th className="px-2 py-2 font-semibold">Downtime</th>
                        <th className="px-2 py-2 font-semibold text-emerald-700">Avail%</th>
                        <th className="px-2 py-2 font-semibold text-purple-700">Qual%</th>
                        <th className="px-2 py-2 font-bold text-blue-700">OEE%</th>
                        <th className="px-2 py-2 font-semibold">Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {viewHourlyLogs.map((h: any) => (
                        <tr key={h.hourlyProductionId} className="hover:bg-slate-50">
                          <td className="px-2 py-2 font-bold font-mono">H{h.hourIndex}</td>
                          <td className="px-2 py-2 font-bold text-emerald-600">{h.qtyProduced}</td>
                          <td className="px-2 py-2 text-rose-600">{h.rejectQty || 0}</td>
                          <td className="px-2 py-2 text-amber-500">{h.scrapQty || 0}</td>
                          <td className="px-2 py-2 text-slate-500">{h.downtime > 0 ? `${h.downtime} min` : "—"}</td>
                          <td className="px-2 py-2 font-semibold text-emerald-700">
                            {h.availabilityPct !== undefined ? `${h.availabilityPct}%` : '—'}
                          </td>
                          <td className="px-2 py-2 font-semibold text-purple-700">
                            {h.qualityPct !== undefined ? `${h.qualityPct}%` : '—'}
                          </td>
                          <td className="px-2 py-2 font-extrabold text-blue-700">
                            {h.hourlyOEE !== undefined ? `${h.hourlyOEE}%` : '—'}
                          </td>
                          <td className="px-2 py-2 text-slate-500 text-xs">{h.operatorId || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-white font-bold border-t border-slate-200">
                      <tr>
                        <td className="px-2 py-2">Total</td>
                        <td className="px-2 py-2 text-emerald-600">{viewHourlyLogs.reduce((s, h) => s + Number(h.qtyProduced || 0), 0)}</td>
                        <td className="px-2 py-2 text-rose-600">{viewHourlyLogs.reduce((s, h) => s + Number(h.rejectQty || 0), 0)}</td>
                        <td className="px-2 py-2 text-amber-500">{viewHourlyLogs.reduce((s, h) => s + Number(h.scrapQty || 0), 0)}</td>
                        <td className="px-2 py-2 text-slate-500">{(() => { const t = viewHourlyLogs.reduce((s, h) => s + Number(h.downtime || 0), 0); return t > 0 ? `${t} min` : "—"; })()}</td>
                        <td colSpan={3} className="px-2 py-2 text-center text-slate-400 font-normal text-xs">Avg from OEE Summary below</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center text-slate-500 p-6 border border-slate-200 rounded-lg bg-white">
                  No hourly entries recorded yet for this plan.
                </div>
              )}

              {/* ─── OEE & Production Summary ─────────────────────────────── */}
              {viewPlanOeeSummary && (
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
              )}
            </>
          )}
        </CommonModal>

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
          <div className="text-slate-700 text-sm">
            <p className="mb-2">You are about to stop the production plan <strong className="text-slate-900">{stopPlan?.dailyPlanId}</strong> prematurely.</p>
            <p className="text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-200 mb-4">
              The number of logged hourly productions is <strong>{
                Array.isArray(stopPlan?.hourlyProductions)
                  ? stopPlan.hourlyProductions.filter((h: any) => Number(h.hourIndex) > 0).length
                  : 0
              }</strong>.
              The planned hours for this plan will be adjusted to match the logged hours to release the remaining shift capacity.
            </p>
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
          </div>
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
      </div>
    </div>
  );
};

export default DailyProductionPlanningPage;
