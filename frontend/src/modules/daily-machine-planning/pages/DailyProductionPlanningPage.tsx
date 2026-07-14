import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Row, Col, Card, Spinner, Modal, Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaPlus, FaPlay, FaStop, FaClipboardList, FaCalendarAlt, FaIndustry,
  FaCheckCircle, FaEdit, FaInfoCircle,
  FaArrowRight, FaBan, FaShare, FaThumbsUp
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
import { oeeService } from "../../../services/oeeService";

// ---------- helpers ----------
const formatLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const STATUS_FLOW: Record<string, { label: string; next: string | null; color: string }> = {
  DRAFT:       { label: "Draft",       next: "PLANNED",    color: "secondary" },
  PLANNED:     { label: "Planned",     next: "APPROVED",   color: "info" },
  APPROVED:    { label: "Approved",    next: "IN_PROGRESS",color: "primary" },
  IN_PROGRESS: { label: "In Progress", next: "COMPLETED",  color: "success" },
  COMPLETED:   { label: "Completed",   next: null,          color: "dark" },
  CANCELLED:   { label: "Cancelled",   next: null,          color: "danger" },
  STOPPED:     { label: "Stopped",     next: null,          color: "danger" },
};

const NEXT_ACTION_LABELS: Record<string, string> = {
  DRAFT:       "Mark as Planned",
  PLANNED:     "Approve Plan",
  APPROVED:    "Start Production",
  IN_PROGRESS: "Mark Completed",
};

const NEXT_ACTION_ICONS: Record<string, any> = {
  DRAFT:       FaCalendarAlt,
  PLANNED:     FaThumbsUp,
  APPROVED:    FaPlay,
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

  // Stop Production Modal State
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopPlan, setStopPlan] = useState<any>(null);
  const [stopReason, setStopReason] = useState("");
  const [isStopping, setIsStopping] = useState(false);

  // Expandable Row State
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleExpandRow = (planId: string) => {
    setExpandedRow(prev => prev === planId ? null : planId);
  };


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

  // Stats
  const stats = useMemo(() => {
    const total = filteredPlans.length;
    const approved = filteredPlans.filter((p: any) => p.status === "APPROVED").length;
    const running = filteredPlans.filter((p: any) => p.status === "IN_PROGRESS").length;
    const completed = filteredPlans.filter((p: any) => p.status === "COMPLETED").length;
    const totalPlanned = filteredPlans.reduce((s: number, p: any) => s + Number(p.plannedQty || 0), 0);
    return { total, approved, running, completed, totalPlanned };
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
  const handleStatusAdvance = (plan: any, producedQty: number = 0) => {
    const nextStatus = STATUS_FLOW[plan.status]?.next;
    if (!nextStatus) return;

    if (nextStatus === "COMPLETED" && producedQty === 0) {
      toast.warning("Cannot mark as completed without logging any production!");
      return;
    }

    setStatusChangePlan(plan);
    setStatusChangingTo(nextStatus);
    setShowStatusModal(true);
  };

  const confirmStatusChange = async () => {
    if (!statusChangePlan || !statusChangingTo) return;
    try {
      await dispatch(updateDailyPlan({
        id: statusChangePlan.dailyPlanId,
        data: { status: statusChangingTo }
      })).unwrap();
      toast.success(`Status updated to ${STATUS_FLOW[statusChangingTo]?.label || statusChangingTo}`);
      setShowStatusModal(false);
      setStatusChangePlan(null);
      loadDailyPlans();
    } catch (err: any) {
      toast.error(err || "Failed to update status");
    }
  };

  const handleCancelPlan = async (plan: any) => {
    try {
      await dispatch(updateDailyPlan({
        id: plan.dailyPlanId,
        data: { status: "CANCELLED" }
      })).unwrap();
      toast.success("Daily Plan cancelled.");
      loadDailyPlans();
    } catch (err: any) {
      toast.error(err || "Failed to cancel plan");
    }
  };

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
        remarks: `Carried forward from Daily Plan ${plan.dailyPlanId}`
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
  const allowedMachines = useMemo(() =>
    (machines || []).filter((m: any) => m.machineId !== "MAC-001")
  , [machines]);

  return (
    <div className="inner-container">
      <Container fluid>
        {/* Page Header */}
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={5} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Daily Production Planning</h2>
                <div className="page-breadcrumb">Home / Production / Daily Plans</div>
              </div>
            </Col>
            <Col lg={7} md={12}>
              <div className="page-header-actions d-flex align-items-center justify-content-lg-end gap-2 flex-wrap">
                {/* Date Filter */}
                <div style={{ width: "160px" }}>
                  <input
                    type="date"
                    className="form-control"
                    style={{ height: "42px", borderRadius: "8px", fontSize: "13px" }}
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </div>

                {/* Machine Filter */}
                <div style={{ width: "160px" }}>
                  <select
                    className="form-select"
                    value={filterMachine}
                    onChange={(e) => setFilterMachine(e.target.value)}
                    style={{ height: "42px", borderRadius: "8px", fontSize: "13px" }}
                  >
                    <option value="">All Machines</option>
                    {allowedMachines.map((m: any) => (
                      <option key={m.machineId} value={m.machineId}>{m.machineName}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div style={{ width: "140px" }}>
                  <select
                    className="form-select"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ height: "42px", borderRadius: "8px", fontSize: "13px" }}
                  >
                    <option value="">All Status</option>
                    {Object.keys(STATUS_FLOW).map(s => (
                      <option key={s} value={s}>{STATUS_FLOW[s].label}</option>
                    ))}
                  </select>
                </div>

                <CustomButton
                  text="New Production Order"
                  icon={FaPlus}
                  onClick={() => navigate("/production-orders/create")}
                  style={{ marginRight: "8px" }}
                />
                <CustomButton
                  text="New Daily Plan"
                  icon={FaPlus}
                  onClick={openCreateForm}
                />
              </div>
            </Col>
          </Row>
        </div>

        {/* Stats Cards */}
        <Row className="g-3 mb-4">
          {[
            { label: "Total Plans", value: stats.total, icon: FaCalendarAlt, color: "primary", bgClass: "bg-light" },
            { label: "Approved", value: stats.approved, icon: FaCheckCircle, color: "info", bgClass: "bg-info bg-opacity-10" },
            { label: "In Progress", value: stats.running, icon: FaPlay, color: "success", bgClass: "bg-success bg-opacity-10" },
            { label: "Completed", value: stats.completed, icon: FaStop, color: "secondary", bgClass: "bg-secondary bg-opacity-10" },
          ].map((stat) => (
            <Col xl={3} sm={6} key={stat.label}>
              <Card className="border-0 shadow-sm rounded-3">
                <Card.Body className="d-flex align-items-center p-3">
                  <div className={`p-3 rounded-circle ${stat.bgClass} text-${stat.color} me-3`}>
                    <stat.icon size={20} />
                  </div>
                  <div>
                    <h6 className="text-muted small text-uppercase mb-1 fw-bold">{stat.label}</h6>
                    <h4 className="mb-0 fw-bold text-dark">{stat.value}</h4>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Daily Plans Table */}
        <Card className="border-0 shadow-sm rounded-3 mb-4">
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3 text-muted">Loading daily plans...</p>
              </div>
            ) : filteredPlans.length > 0 ? (
              <div className="table-responsive">
                <table className="master-data-table mb-0" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "50px" }}>#</th>
                      <th>PLAN ID</th>
                      <th>PRODUCTION ORDER</th>
                      <th>DATE</th>
                      <th>MACHINE / SHIFT</th>
                      <th>PLANNED QTY</th>
                      <th style={{ width: "180px" }}>PROGRESS</th>
                      <th>PRIORITY</th>
                      <th>STATUS</th>
                      <th style={{ width: "180px", textAlign: "right" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlans.map((plan: any, idx: number) => {
                      const plannedQty = Number(plan.plannedQty || 0);
                      const producedQty = Array.isArray(plan.hourlyProductions)
                        ? plan.hourlyProductions.reduce((sum: number, h: any) => sum + Number(h.qtyProduced || 0), 0)
                        : 0;
                      const progressPercent = Math.min(100, plannedQty > 0 ? Math.round((producedQty / plannedQty) * 100) : 0);
                      const nextStatus = STATUS_FLOW[plan.status]?.next;
                      const canAdvance = !!nextStatus && plan.status !== "COMPLETED" && plan.status !== "CANCELLED";
                      const canLog = plan.status === "IN_PROGRESS";
                      
                      const pendingQty = plannedQty > producedQty ? plannedQty - producedQty : 0;
                      const forwardedToPlan = filteredPlans.find((p: any) => p.remarks?.includes(`Carried forward from Daily Plan ${plan.dailyPlanId}`));
                      const forwardedFromMatch = plan.remarks?.match(/Carried forward from Daily Plan ([\w-]+)/i);
                      const forwardedFromPlanId = forwardedFromMatch ? forwardedFromMatch[1] : null;

                      const canCarryForward = plan.status === "COMPLETED" && pendingQty > 0 && !forwardedToPlan;

                      return (
                        <React.Fragment key={plan.dailyPlanId}>
                          <tr className={`master-data-row ${expandedRow === plan.dailyPlanId ? "bg-light" : ""}`} style={{ cursor: "pointer" }} onClick={() => toggleExpandRow(plan.dailyPlanId)}>
                            <td className="master-data-cell text-muted">{idx + 1}</td>
                          <td className="master-data-cell fw-bold" style={{ fontFamily: "monospace" }}>
                            <div>{plan.dailyPlanId}</div>
                            {forwardedToPlan && (
                              <div className="mt-1 d-flex align-items-center gap-1" style={{ fontSize: "11px", color: "#8b5cf6", fontWeight: 600 }}>
                                <span>↪</span> Fwd to {forwardedToPlan.dailyPlanId}
                              </div>
                            )}
                            {forwardedFromPlanId && (
                              <div className="mt-1 d-flex align-items-center gap-1" style={{ fontSize: "11px", color: "#3b82f6", fontWeight: 600 }}>
                                <span style={{ fontSize: "14px", lineHeight: "1" }}>↳</span> Fwd from {forwardedFromPlanId}
                              </div>
                            )}
                          </td>
                          <td className="master-data-cell">
                            <div className="fw-semibold">{plan.productionOrderId}</div>
                            <div className="text-muted small">
                              {plan.productionOrder?.productItem?.productName || "—"}
                            </div>
                          </td>
                          <td className="master-data-cell">
                            <div className="fw-medium">{plan.productionDate?.split("T")[0] || "—"}</div>
                          </td>
                          <td className="master-data-cell">
                            <div className="fw-semibold">
                              <FaIndustry className="me-1 text-secondary" />
                              {plan.machine?.machineName || plan.machineId || "—"}
                            </div>
                            <div className="d-flex align-items-center gap-2 mt-1">
                              <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25" style={{ fontSize: "10px" }}>
                                {plan.shift?.shiftName || plan.shiftId || "—"}
                              </span>
                              {(plan.shift?.startTime && plan.shift?.endTime) && (
                                <span className="text-muted" style={{ fontSize: "10px" }}>
                                  {plan.shift.startTime.slice(0,5)} - {plan.shift.endTime.slice(0,5)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="master-data-cell fw-medium">
                            <div>{plannedQty.toLocaleString()} pcs</div>
                            {plan.plannedHours && (
                              <div className="text-muted small">{plan.plannedHours} hrs</div>
                            )}
                          </td>
                          <td className="master-data-cell">
                            <div className="mb-1">
                              <CustomProgressBar progressPercent={progressPercent} />
                            </div>
                            <div className="d-flex align-items-center justify-content-between small">
                              <span className="text-muted">{producedQty} / {plannedQty} pcs</span>
                              {producedQty > plannedQty ? (
                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 py-1 px-2" style={{ fontSize: "9px" }}>
                                  +{producedQty - plannedQty} Over
                                </span>
                              ) : pendingQty > 0 ? (
                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 py-1 px-2" style={{ fontSize: "9px" }}>
                                  {pendingQty} Pending
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="master-data-cell">
                            <StatusBadge status={plan.priority || "MEDIUM"} />
                          </td>
                          <td className="master-data-cell">
                            <div className="d-flex align-items-center gap-2">
                              <StatusBadge status={plan.status === "COMPLETED" && producedQty < plannedQty ? "SHORT_CLOSED" : plan.status} />
                              {(plan.status === "STOPPED" || plan.status === "CANCELLED") && plan.remarks && (
                                <OverlayTrigger
                                  placement="top"
                                  overlay={
                                    <Tooltip id={`tooltip-${plan.dailyPlanId}`}>
                                      <div className="text-start" style={{ fontSize: "12px" }}>
                                        <span className="fw-bold text-warning">Reason:</span><br/>
                                        {plan.remarks.includes("Stopped:") || plan.remarks.includes("Cancelled:") 
                                          ? plan.remarks.split("|").pop()?.replace("Stopped:", "")?.replace("Cancelled:", "").trim()
                                          : plan.remarks}
                                      </div>
                                    </Tooltip>
                                  }
                                >
                                  <span style={{ cursor: "pointer" }}>
                                    <FaInfoCircle className="text-danger" style={{ fontSize: "15px", opacity: 0.85 }} />
                                  </span>
                                </OverlayTrigger>
                              )}
                            </div>
                          </td>
                          <td className="master-data-cell text-end">
                            <div className="table-action-group justify-content-end" onClick={e => e.stopPropagation()}>
                              {/* View */}
                              <ViewButton onClick={() => { setViewPlan(plan); setShowViewModal(true); }} />

                              {/* Log Hourly (only if APPROVED or IN_PROGRESS) */}
                              {canLog && (
                                <IconButton
                                  variant="primary"
                                  title="Log Hourly Production"
                                  icon={FaClipboardList}
                                  onClick={() => handleLogHourly(plan)}
                                />
                              )}

                              {/* Advance Status */}
                              {canAdvance && (
                                <IconButton
                                  variant="success"
                                  title={NEXT_ACTION_LABELS[plan.status] || `Move to ${nextStatus}`}
                                  icon={NEXT_ACTION_ICONS[plan.status] || FaArrowRight}
                                  onClick={() => handleStatusAdvance(plan, producedQty)}
                                />
                              )}

                              {/* Stop Production (only if IN_PROGRESS) */}
                              {plan.status === "IN_PROGRESS" && (
                                <IconButton
                                  variant="danger"
                                  title="Stop Production"
                                  icon={FaStop}
                                  onClick={() => handleStopProductionClick(plan)}
                                />
                              )}

                              {/* Edit (only DRAFT or PLANNED) */}
                              {(plan.status === "DRAFT" || plan.status === "PLANNED") && (
                                <IconButton
                                  variant="info"
                                  title="Edit Plan"
                                  icon={FaEdit}
                                  onClick={() => openEditForm(plan)}
                                />
                              )}

                              {/* Cancel (only if not started: DRAFT, PLANNED) */}
                              {["DRAFT", "PLANNED"].includes(plan.status) && (
                                <IconButton
                                  variant="warning"
                                  title="Cancel Plan"
                                  icon={FaBan}
                                  onClick={() => handleCancelPlan(plan)}
                                />
                              )}

                              {/* Carry Forward */}
                              {canCarryForward && (
                                <IconButton
                                  variant="warning"
                                  title={`Carry Forward ${pendingQty} pcs`}
                                  icon={FaShare}
                                  onClick={() => handleCarryForward(plan, pendingQty)}
                                />
                              )}

                              {/* Delete (only DRAFT or CANCELLED) */}
                              {(plan.status === "DRAFT" || plan.status === "CANCELLED") && (
                                <DeleteButton onClick={() => { setDeletePlanId(plan.dailyPlanId); setShowDeleteModal(true); }} />
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedRow === plan.dailyPlanId && (
                          <tr className="bg-light">
                            <td colSpan={10} className="p-0 border-0">
                              <div className="px-4 py-3 border-bottom shadow-inner" style={{ background: "#f8f9fa", boxShadow: "inset 0 3px 6px rgba(0,0,0,0.02)" }}>
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                  <h6 className="fw-bold text-uppercase mb-0" style={{ color: "var(--color-primary)", fontSize: "11px", letterSpacing: "0.5px" }}>
                                    Hourly Production Breakdown
                                  </h6>
                                  {canLog && (
                                    <Button size="sm" variant="outline-primary" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={() => handleLogHourly(plan)}>
                                      + Log Hour
                                    </Button>
                                  )}
                                </div>
                                {(!plan.hourlyProductions || plan.hourlyProductions.length === 0) ? (
                                  <div className="text-center text-muted p-3 border rounded-3 bg-white" style={{ fontSize: "12px" }}>
                                    No hourly entries recorded yet for this plan.
                                  </div>
                                ) : (
                                  <div className="rounded-3 border overflow-hidden bg-white">
                                    <table className="table table-sm table-hover text-center align-middle mb-0" style={{ fontSize: "12px" }}>
                                      <thead className="bg-light text-muted">
                                        <tr>
                                          <th className="fw-semibold">Hour</th>
                                          <th className="fw-semibold">Produced</th>
                                          <th className="fw-semibold">Reject</th>
                                          <th className="fw-semibold">Scrap</th>
                                          <th className="fw-semibold">Downtime</th>
                                          <th className="fw-semibold">Operator</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {plan.hourlyProductions.sort((a: any, b: any) => Number(a.hourIndex) - Number(b.hourIndex)).map((h: any) => (
                                          <tr key={h.hourlyProductionId}>
                                            <td className="fw-bold font-monospace text-secondary">H{h.hourIndex}</td>
                                            <td className="fw-bold text-success">{h.qtyProduced}</td>
                                            <td className={h.rejectQty > 0 ? "text-danger fw-medium" : "text-muted"}>{h.rejectQty || 0}</td>
                                            <td className={h.scrapQty > 0 ? "text-warning fw-medium" : "text-muted"}>{h.scrapQty || 0}</td>
                                            <td className={h.downtime > 0 ? "text-danger fw-medium" : "text-muted"}>{h.downtime > 0 ? `${h.downtime} min` : "—"}</td>
                                            <td className="text-muted">{h.operator?.name || h.operatorId || "—"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="bg-light fw-bold text-dark">
                                        <tr>
                                          <td>Total</td>
                                          <td className="text-success">{producedQty}</td>
                                          <td className="text-danger">{plan.hourlyProductions.reduce((s:number, h:any) => s + Number(h.rejectQty || 0), 0)}</td>
                                          <td className="text-warning">{plan.hourlyProductions.reduce((s:number, h:any) => s + Number(h.scrapQty || 0), 0)}</td>
                                          <td className="text-danger">{(() => { const t = plan.hourlyProductions.reduce((s:number, h:any) => s + Number(h.downtime || 0), 0); return t > 0 ? `${t} min` : "—"; })()}</td>
                                          <td></td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-5">
                <FaCalendarAlt size={32} className="text-muted mb-3" />
                <h5 className="text-muted mb-1">No daily plans found</h5>
                <p className="text-muted small mb-0">
                  Click "New Daily Plan" to schedule a production run for today.
                </p>
              </div>
            )}
          </Card.Body>
        </Card>



        {/* ─────── View Modal ─────── */}
        <Modal show={showViewModal} onHide={() => { setShowViewModal(false); setViewPlan(null); }} centered size="lg">
          <Modal.Header closeButton style={{ background: "var(--color-primary, #003428)", color: "#fff" }}>
            <Modal.Title className="fs-5 fw-bold">
              Daily Plan — {viewPlan?.dailyPlanId}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {viewPlan && (
              <>
                <Row className="g-3 mb-4">
                  <Col md={6}>
                    <div className="p-3 bg-light rounded-3 border">
                      <h6 className="fw-bold text-uppercase text-muted mb-2" style={{ fontSize: "11px" }}>Plan Details</h6>
                      <div className="d-flex flex-column gap-1">
                        <span><strong>Production Order:</strong> {viewPlan.productionOrderId}</span>
                        <span><strong>Product:</strong> {viewPlan.productionOrder?.productItem?.productName || "—"}</span>
                        <span><strong>Date:</strong> {viewPlan.productionDate?.split("T")[0]}</span>
                        <span><strong>Machine:</strong> {viewPlan.machine?.machineName || viewPlan.machineId}</span>
                        <span><strong>Shift:</strong> {viewPlan.shift?.shiftName || viewPlan.shiftId}</span>
                      </div>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="p-3 bg-light rounded-3 border">
                      <h6 className="fw-bold text-uppercase text-muted mb-2" style={{ fontSize: "11px" }}>Quantities</h6>
                      <div className="d-flex flex-column gap-1">
                        <span><strong>Planned Qty:</strong> {viewPlan.plannedQty} pcs</span>
                        <span><strong>Planned Hours:</strong> {viewPlan.plannedHours || "—"} hrs</span>
                        <span><strong>Priority:</strong> <StatusBadge status={viewPlan.priority || "MEDIUM"} /></span>
                        <span><strong>Status:</strong> <StatusBadge status={viewPlan.status} /></span>
                        {viewPlan.remarks && <span><strong>Remarks:</strong> {viewPlan.remarks}</span>}
                      </div>
                    </div>
                  </Col>
                </Row>

                <h6 className="fw-bold text-uppercase mb-3" style={{ color: "var(--color-primary)", fontSize: "12px", letterSpacing: "0.5px" }}>
                  Hourly Production Entries
                </h6>
                {loadingViewLogs ? (
                  <div className="text-center py-3"><Spinner size="sm" /> Loading...</div>
                ) : viewHourlyLogs.length > 0 ? (
                  <div className="rounded-3 border overflow-hidden">
                    <table className="master-data-table text-center align-middle mb-0" style={{ width: "100%" }}>
                      <thead className="bg-light">
                        <tr>
                          <th>Hour</th>
                          <th>Produced</th>
                          <th>Reject</th>
                          <th>Scrap</th>
                          <th>Downtime</th>
                          <th style={{ color: '#15803d' }}>Avail%</th>
                          <th style={{ color: '#7c3aed' }}>Qual%</th>
                          <th style={{ color: '#1d4ed8', fontWeight: '800' }}>OEE%</th>
                          <th>Operator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewHourlyLogs.map((h: any) => (
                          <tr key={h.hourlyProductionId} className="master-data-row border-bottom">
                            <td className="master-data-cell fw-bold font-monospace">H{h.hourIndex}</td>
                            <td className="master-data-cell fw-bold text-success">{h.qtyProduced}</td>
                            <td className="master-data-cell text-danger">{h.rejectQty || 0}</td>
                            <td className="master-data-cell text-warning">{h.scrapQty || 0}</td>
                            <td className="master-data-cell text-muted">{h.downtime > 0 ? `${h.downtime} min` : "—"}</td>
                            <td className="master-data-cell" style={{ color: '#15803d', fontWeight: '600' }}>
                              {h.availabilityPct !== undefined ? `${h.availabilityPct}%` : '—'}
                            </td>
                            <td className="master-data-cell" style={{ color: '#7c3aed', fontWeight: '600' }}>
                              {h.qualityPct !== undefined ? `${h.qualityPct}%` : '—'}
                            </td>
                            <td className="master-data-cell" style={{ color: '#1d4ed8', fontWeight: '800' }}>
                              {h.hourlyOEE !== undefined ? `${h.hourlyOEE}%` : '—'}
                            </td>
                            <td className="master-data-cell text-muted small">{h.operatorId || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-light fw-bold">
                        <tr>
                          <td>Total</td>
                          <td className="text-success">{viewHourlyLogs.reduce((s, h) => s + Number(h.qtyProduced || 0), 0)}</td>
                          <td className="text-danger">{viewHourlyLogs.reduce((s, h) => s + Number(h.rejectQty || 0), 0)}</td>
                          <td className="text-warning">{viewHourlyLogs.reduce((s, h) => s + Number(h.scrapQty || 0), 0)}</td>
                          <td className="text-muted">{(() => { const t = viewHourlyLogs.reduce((s, h) => s + Number(h.downtime || 0), 0); return t > 0 ? `${t} min` : "—"; })()}</td>
                          <td colSpan={3} className="text-center text-muted small">Avg from OEE Summary below</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-muted p-4 border rounded-3 bg-light">
                    No hourly entries recorded yet for this plan.
                  </div>
                )}

                {/* ─── OEE & Production Summary ─────────────────────────────── */}
                {viewPlanOeeSummary && (
                  <div className="mt-4 rounded-3 p-3" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)", color: "#fff" }}>
                    <div className="fw-bold mb-3" style={{ fontSize: '13px', letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.9 }}>
                      📊 Production OEE Summary
                    </div>
                    <div className="row g-2 text-center mb-3">
                      <div className="col-4 col-md-2">
                        <div style={{ fontSize: '20px', fontWeight: '800' }}>{viewPlanOeeSummary.oeePercent}%</div>
                        <div style={{ fontSize: '9px', opacity: 0.75, textTransform: 'uppercase' }}>Overall OEE</div>
                      </div>
                      <div className="col-4 col-md-2">
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#86efac' }}>{viewPlanOeeSummary.availability}%</div>
                        <div style={{ fontSize: '9px', opacity: 0.75, textTransform: 'uppercase' }}>Availability</div>
                      </div>
                      <div className="col-4 col-md-2">
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#fde68a' }}>{viewPlanOeeSummary.performance}%</div>
                        <div style={{ fontSize: '9px', opacity: 0.75, textTransform: 'uppercase' }}>Performance</div>
                      </div>
                      <div className="col-4 col-md-2">
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#c4b5fd' }}>{viewPlanOeeSummary.quality}%</div>
                        <div style={{ fontSize: '9px', opacity: 0.75, textTransform: 'uppercase' }}>Quality</div>
                      </div>
                      <div className="col-4 col-md-2">
                        <div style={{ fontSize: '16px', fontWeight: '700' }}>{viewPlanOeeSummary.runtimeMinutes} <span style={{ fontSize: '11px' }}>min</span></div>
                        <div style={{ fontSize: '9px', opacity: 0.75, textTransform: 'uppercase' }}>Runtime</div>
                      </div>
                      <div className="col-4 col-md-2">
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#fca5a5' }}>{viewPlanOeeSummary.downtimeMinutes} <span style={{ fontSize: '11px' }}>min</span></div>
                        <div style={{ fontSize: '9px', opacity: 0.75, textTransform: 'uppercase' }}>Downtime</div>
                      </div>
                    </div>
                    <div className="row g-2 text-center">
                      {[
                        { label: 'Planned', value: viewPlanOeeSummary.targetQty, color: '#93c5fd' },
                        { label: 'Produced', value: viewPlanOeeSummary.producedQty, color: '#86efac' },
                        { label: 'Good Qty', value: viewPlanOeeSummary.goodQty, color: '#6ee7b7' },
                        { label: 'Reject', value: viewPlanOeeSummary.rejectQty, color: '#fca5a5' },
                        { label: 'Scrap', value: viewPlanOeeSummary.scrapQty, color: '#fde68a' },
                        { label: 'Remaining', value: viewPlanOeeSummary.remainingQty, color: '#e2e8f0' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="col-4 col-md-2">
                          <div style={{ fontSize: '14px', fontWeight: '700', color }}>{Number(value)}</div>
                          <div style={{ fontSize: '9px', opacity: 0.75, textTransform: 'uppercase' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            {viewPlan && (viewPlan.status === "APPROVED" || viewPlan.status === "IN_PROGRESS") && (
              <Button
                variant="success"
                className="rounded-3"
                onClick={() => { setShowViewModal(false); handleLogHourly(viewPlan); }}
              >
                <FaClipboardList className="me-2" /> Log Hourly Entry
              </Button>
            )}
            <Button variant="secondary" className="rounded-3" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* ─────── Stop Production Modal ─────── */}
        <Modal show={showStopModal} onHide={() => { setShowStopModal(false); setStopPlan(null); }} centered>
          <Modal.Header closeButton className="bg-danger text-white">
            <Modal.Title className="fs-5 fw-bold">Stop Production Plan</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>You are about to stop the production plan <strong>{stopPlan?.dailyPlanId}</strong> prematurely.</p>
            <p className="small text-muted">
              The number of logged hourly productions is <strong>{
                Array.isArray(stopPlan?.hourlyProductions)
                  ? stopPlan.hourlyProductions.filter((h: any) => Number(h.hourIndex) > 0).length
                  : 0
              }</strong>. 
              The planned hours for this plan will be adjusted to match the logged hours to release the remaining shift capacity.
            </p>
            <div className="form-group mt-3">
              <label className="form-label fw-bold">Reason for Stopping *</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Urgent production order PO-XXX required on this machine"
                value={stopReason}
                onChange={(e) => setStopReason(e.target.value)}
                required
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowStopModal(false); setStopPlan(null); }} disabled={isStopping}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmStopProduction} disabled={isStopping || !stopReason.trim()}>
              {isStopping ? "Stopping..." : "Stop Production"}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* ─────── Status Advance Confirm Modal ─────── */}
        <CommonConfirmModal
          show={showStatusModal}
          onHide={() => { setShowStatusModal(false); setStatusChangePlan(null); }}
          onConfirm={confirmStatusChange}
          title={NEXT_ACTION_LABELS[statusChangePlan?.status] || "Confirm Status Change"}
          message={`Change status of plan ${statusChangePlan?.dailyPlanId} from "${STATUS_FLOW[statusChangePlan?.status]?.label}" to "${STATUS_FLOW[statusChangingTo]?.label}"?`}
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
      </Container>
    </div>
  );
};

export default DailyProductionPlanningPage;
