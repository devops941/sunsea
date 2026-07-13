import React, { useState, useEffect, useCallback, useMemo } from "react";
import { z } from "zod";
import { Container, Row, Col, Card, Spinner, Alert } from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaSave, FaArrowLeft, FaInfoCircle, FaExclamationTriangle,
  FaIndustry, FaCalendarAlt, FaClock, FaBoxes, FaCheckCircle
} from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { createDailyPlan, updateDailyPlan } from "../../../features/daily-plans/dailyPlanSlice";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import { dailyPlanService } from "../../../services/dailyPlanService";
import { oeeService } from "../../../services/oeeService";

import TextInput from "../../../components/form/TextInput/TextInput";

import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

// ─── Helpers ──────────────────────────────────────────────────────────────
const formatLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** Compute shift duration in hours from "HH:MM" start and end strings */
const computeShiftHours = (startTime: string, endTime: string): number => {
  if (!startTime || !endTime) return 8;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60; // overnight shift
  return Math.round(((endMins - startMins) / 60) * 10) / 10; // e.g. 8.5
};

// ─── Component ────────────────────────────────────────────────────────────
const DailyPlanCreate: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { id: editId } = useParams<{ id?: string }>();
  const isEdit = !!editId;

  // Redux
  const { data: machines } = useAppSelector((state) => state.machines);
  const { data: shifts } = useAppSelector((state: any) => state.shifts || { data: [] });

  // ── Form fields ──────────────────────────────────────────────────────────
  const [weeklyProgramId, setWeeklyProgramId] = useState("");
  const [productionDate, setProductionDate] = useState(formatLocalDateString(new Date()));
  const [machineId, setMachineId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [plannedQty, setPlannedQty] = useState("");
  const [plannedHours, setPlannedHours] = useState("8");
  const [priority, setPriority] = useState("MEDIUM");
  const [status, setStatus] = useState("DRAFT");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Auto-fill data ───────────────────────────────────────────────────────
  const [weeklyPrograms, setWeeklyPrograms] = useState<any[]>([]);
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [selectedWeeklyProg, setSelectedWeeklyProg] = useState<any>(null);
  const [remainingQty, setRemainingQty] = useState<number | null>(null);
  const [loadingRemaining, setLoadingRemaining] = useState(false);

  // States to keep track of existing plans for this Date & Machine to disable fully utilized shifts
  const [plansForDateAndMachine, setPlansForDateAndMachine] = useState<any[]>([]);

  // ── Machine OEE Summary ──────────────────────────────────────────────────
  const [machineOeeSummary, setMachineOeeSummary] = useState<any>(null);
  const [loadingOee, setLoadingOee] = useState(false);

  useEffect(() => {
    if (!productionDate || !machineId) {
      setPlansForDateAndMachine([]);
      return;
    }
    dailyPlanService.getAll({ productionDate, machineId }).then((res) => {
      setPlansForDateAndMachine(res.data || []);
    }).catch(() => {});

    // Fetch OEE summary for selected machine
    setLoadingOee(true);
    oeeService.getMachineOeeSummary(machineId, productionDate)
      .then((data: any) => setMachineOeeSummary(data))
      .catch(() => setMachineOeeSummary(null))
      .finally(() => setLoadingOee(false));
  }, [productionDate, machineId]);

  const remainingShiftsHours = useMemo(() => {
    const hoursMap: Record<string, number> = {};
    if (!productionDate || !machineId || !shifts || shifts.length === 0) return hoursMap;

    shifts.forEach((s: any) => {
      const shiftHrs = computeShiftHours(s.startTime, s.endTime);
      const existingPlans = plansForDateAndMachine.filter(
        (p: any) => p.shiftId === s.shiftCode && p.status !== "CANCELLED" && p.dailyPlanId !== editId
      );
      const plannedHrsSum = existingPlans.reduce((sum: number, p: any) => {
        const loggedHours = Array.isArray(p.hourlyProductions) ? p.hourlyProductions.length : 0;
        if (p.status === "COMPLETED" || p.status === "STOPPED") {
          return sum + loggedHours;
        } else {
          return sum + Math.max(Number(p.plannedHours || 0), loggedHours);
        }
      }, 0);
      
      hoursMap[s.shiftCode] = Math.max(0, shiftHrs - plannedHrsSum);
    });

    return hoursMap;
  }, [productionDate, machineId, shifts, plansForDateAndMachine, editId]);

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchMachines());
    dispatch(fetchShifts());
  }, [dispatch]);

  const loadWeeklyPrograms = useCallback(async () => {
    setLoadingWeekly(true);
    try {
      const d = new Date(productionDate || new Date());
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const year = monday.getFullYear();
      const month = String(monday.getMonth() + 1).padStart(2, '0');
      const dateStr = String(monday.getDate()).padStart(2, '0');
      const selectedWeekPrefix = `${year}-${month}-${dateStr}`;

      const res = await weeklyProgramService.getAll({});
      const list: any[] = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      const stateWpId = (location.state as any)?.weeklyProgramId;
      
      setWeeklyPrograms(list.filter((p: any) => {
        if (p.status === "COMPLETED" || p.status === "CANCELLED") {
          return p.weeklyProgramId === stateWpId;
        }
        const isSelectedWeek = p.weekStartDate && p.weekStartDate.startsWith(selectedWeekPrefix);
        const isPending = ["PLANNED", "APPROVED", "IN_PROGRESS"].includes(p.status);
        return isSelectedWeek || isPending || p.weeklyProgramId === stateWpId;
      }).map((p: any) => {
        const isSelectedWeek = p.weekStartDate && p.weekStartDate.startsWith(selectedWeekPrefix);
        const isPending = ["PLANNED", "APPROVED", "IN_PROGRESS"].includes(p.status);
        if (!isSelectedWeek && isPending) {
           return { ...p, _isBacklog: true };
        }
        return p;
      }));
    } catch {
      toast.error("Failed to load weekly programs");
    } finally {
      setLoadingWeekly(false);
    }
  }, [location.state, productionDate]);

  useEffect(() => { loadWeeklyPrograms(); }, [loadWeeklyPrograms]);

  // If editing, load existing plan
  useEffect(() => {
    if (!isEdit || !editId) return;
    dailyPlanService.getById(editId).then((res) => {
      const plan = res.data;
      if (!plan) return;
      setWeeklyProgramId(plan.weeklyProgramId || "");
      setProductionDate(plan.productionDate?.split("T")[0] || formatLocalDateString(new Date()));
      setMachineId(plan.machineId || "");
      setShiftId(plan.shiftId || "");
      setPlannedQty(String(plan.plannedQty || ""));
      setPlannedHours(String(plan.plannedHours || "8"));
      setPriority(plan.priority || "MEDIUM");
      setStatus(plan.status || "DRAFT");
      setRemarks(plan.remarks || "");
    }).catch(() => toast.error("Failed to load plan for editing"));
  }, [isEdit, editId]);

  // ── Auto-fill: Weekly Program selected ───────────────────────────────────
  useEffect(() => {
    if (!weeklyProgramId) {
      setSelectedWeeklyProg(null);
      setRemainingQty(null);
      return;
    }
    const wp = weeklyPrograms.find((p: any) => p.weeklyProgramId === weeklyProgramId);
    if (!wp) return;
    setSelectedWeeklyProg(wp);

    // Auto-fill priority from Production Order
    const poPriority = wp.productionOrder?.priority || wp.priority;
    if (poPriority) {
      const p = poPriority.toUpperCase();
      if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(p)) setPriority(p);
    }

    // Auto-fill planned qty = remaining on this weekly program
    setLoadingRemaining(true);
    dailyPlanService.getAll({ weeklyProgramId }).then((res) => {
      const existingPlans: any[] = res.data || [];
      const alreadyPlanned = existingPlans
        .filter((p: any) => p.status !== "CANCELLED" && p.dailyPlanId !== editId)
        .reduce((sum: number, p: any) => {
          const produced = Array.isArray(p.hourlyProductions)
            ? p.hourlyProductions.reduce((s: number, h: any) => s + Number(h.qtyProduced || 0), 0)
            : 0;
          if (p.status === "COMPLETED" || p.status === "STOPPED") {
            return sum + produced;
          }
          return sum + Math.max(Number(p.plannedQty || 0), produced);
        }, 0);
      const poTarget = Number(wp.productionOrder?.targetQty || 0);
      
      const baseCapacity = Number(wp.plannedQty || 0) > 0 ? Number(wp.plannedQty) : poTarget;
      const remainingRaw = Math.max(0, baseCapacity - alreadyPlanned);
      const remaining = Math.round(remainingRaw * 1000) / 1000;
      setRemainingQty(remaining);
      if (!isEdit) {
        if (location.state && (location.state as any).plannedQty) {
          const stateQty = Number((location.state as any).plannedQty);
          setPlannedQty(String(Math.round(stateQty * 1000) / 1000));
        } else {
          setPlannedQty(String(remaining > 0 ? remaining : ""));
        }
      }
    }).catch(() => setRemainingQty(null))
      .finally(() => setLoadingRemaining(false));
  }, [weeklyProgramId, weeklyPrograms, editId, isEdit, location.state]);

  // Handle location.state pre-fill
  useEffect(() => {
    if (location.state && !isEdit) {
      const s = location.state as any;
      if (s.weeklyProgramId) setWeeklyProgramId(s.weeklyProgramId);
      if (s.machineId) setMachineId(s.machineId);
      if (s.remarks) setRemarks(s.remarks);
    }
  }, [location.state, isEdit]);

  // ── Auto-fill: Shift selected → compute hours ────────────────────────────
  useEffect(() => {
    if (!shiftId) return;
    const selectedShift = shifts.find((s: any) => s.shiftCode === shiftId);
    if (selectedShift?.startTime && selectedShift?.endTime) {
      const shiftHrs = computeShiftHours(selectedShift.startTime, selectedShift.endTime);
      if (productionDate && machineId) {
        setLoadingRemaining(true);
        dailyPlanService.getAll({ productionDate, machineId, shiftId })
          .then((res) => {
            const existingPlans: any[] = res.data || [];
            const plannedHrsSum = existingPlans
              .filter((p: any) => p.status !== "CANCELLED" && p.dailyPlanId !== editId)
              .reduce((sum: number, p: any) => {
                const loggedHours = Array.isArray(p.hourlyProductions) ? p.hourlyProductions.length : 0;
                if (p.status === "COMPLETED" || p.status === "STOPPED") {
                  return sum + loggedHours;
                } else {
                  return sum + Math.max(Number(p.plannedHours || 0), loggedHours);
                }
              }, 0);
            const remainingHrs = Math.max(0, shiftHrs - plannedHrsSum);
            setPlannedHours(String(remainingHrs));
          })
          .catch(() => {
            setPlannedHours(String(shiftHrs));
          })
          .finally(() => {
            setLoadingRemaining(false);
          });
      } else {
        setPlannedHours(String(shiftHrs));
      }
    }
  }, [shiftId, shifts, productionDate, machineId, editId]);

  // ── Derived values ───────────────────────────────────────────────────────
  const allowedMachines = useMemo(() =>
    (machines || []).filter((m: any) => m.machineId !== "MAC-001")
  , [machines]);

  const selectedShiftInfo = useMemo(() =>
    shifts.find((s: any) => s.shiftCode === shiftId)
  , [shiftId, shifts]);

  const overCapacity = remainingQty !== null && Number(plannedQty) > remainingQty;

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const schema = z.object({
      weeklyProgramId: z.string().min(1, "Weekly Program is required"),
      productionDate: z.string().min(1, "Production Date is required"),
      machineId: z.string().min(1, "Machine is required"),
      shiftId: z.string().min(1, "Shift is required"),
      plannedQty: z.coerce.number().positive("Planned Quantity must be greater than 0"),
      plannedHours: z.coerce.number().nonnegative("Planned Hours must be a positive number").optional(),
    });

    const result = schema.safeParse({
      weeklyProgramId,
      productionDate,
      machineId,
      shiftId,
      plannedQty,
      plannedHours
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        const path = issue.path[0] as string;
        if (!errors[path]) errors[path] = issue.message;
      });
      setFormErrors(errors);
      toast.error("Please fix the validation errors.");
      return;
    }

    if (!isEdit && overCapacity) {
      setFormErrors({ plannedQty: `Cannot exceed weekly remaining capacity (${remainingQty} pcs)` });
      toast.error("Planned Quantity exceeds remaining capacity.");
      return;
    }

    setFormErrors({});

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        weeklyProgramId,
        productionDate,
        machineId,
        shiftId,
        plannedQty: Number(plannedQty),
        plannedHours: Number(plannedHours) || null,
        priority,
        status,
        remarks: remarks.trim() || null,
        productionOrderId: selectedWeeklyProg?.productionOrderId,
      };

      if (isEdit && editId) {
        await dispatch(updateDailyPlan({ id: editId, data: payload })).unwrap();
        toast.success("Daily Production Plan updated successfully!");
      } else {
        await dispatch(createDailyPlan(payload)).unwrap();
        toast.success("Daily Production Plan created successfully!");
      }
      navigate("/daily-machine-planning");
    } catch (err: any) {
      let errMsg = "Failed to save daily plan";
      if (err?.data?.message) {
        errMsg = err.data.message;
      } else if (err?.message) {
        errMsg = err.message;
      } else if (typeof err === "string") {
        errMsg = err;
      }
      setSubmitError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="inner-container">
      <Container fluid>
        {/* Page Header */}
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title mb-1">
                  {isEdit ? "Edit Daily Production Plan" : "New Daily Production Plan"}
                </h2>
                <div className="page-breadcrumb text-muted small">
                  Home / Production / Daily Planning / {isEdit ? "Edit" : "Create"}
                </div>
              </div>
            </Col>
            <Col lg={6} md={12}>
              <div className="page-header-actions justify-content-lg-end">
                <CustomButton
                  text="Back to Daily Planning"
                  icon={FaArrowLeft}
                  onClick={() => navigate("/daily-machine-planning")}
                  className="shadow-sm btn-secondary"
                />
              </div>
            </Col>
          </Row>
        </div>

        {submitError && (
          <Alert variant="danger" className="mb-4 shadow-sm border-0 rounded-3 d-flex align-items-center gap-3">
            <FaExclamationTriangle size={24} />
            <div>
              <h6 className="mb-1 fw-bold">Failed to Save Plan</h6>
              <p className="mb-0 small">{submitError}</p>
            </div>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Row className="g-4">
            {/* ─── LEFT: Weekly Program & Auto-fill Info ─── */}
            <Col xl={8} lg={7}>

              {/* Section 1: Weekly Program */}
              <Card className="border-0 shadow-sm rounded-3 mb-4">
                <Card.Header className="bg-white border-bottom py-3 px-4">
                  <h6 className="mb-0 fw-bold d-flex align-items-center gap-2" style={{ color: "var(--color-primary)" }}>
                    <FaCalendarAlt /> Step 1 — Select Weekly Program
                  </h6>
                </Card.Header>
                <Card.Body className="p-4">
                  <Row className="g-3">
                    <Col md={12}>
                      <label className="form-label fw-bold small text-muted text-uppercase mb-1">
                        Weekly Program <span className="text-danger">*</span>
                      </label>
                      {loadingWeekly ? (
                        <div className="d-flex align-items-center gap-2 py-2 text-muted small">
                          <Spinner size="sm" /> Loading weekly programs...
                        </div>
                      ) : (
                        <>
                          <select
                            className="form-select"
                            style={{ height: "44px", borderRadius: "8px", backgroundColor: (isEdit || (location.state as any)?.weeklyProgramId) ? "#e9ecef" : undefined }}
                            required
                            disabled={isEdit || !!(location.state as any)?.weeklyProgramId}
                            value={weeklyProgramId}
                            onChange={(e) => setWeeklyProgramId(e.target.value)}
                          >
                            <option value="">— Select Weekly Program —</option>
                            {weeklyPrograms.map((wp: any) => (
                              <option key={wp.weeklyProgramId} value={wp.weeklyProgramId}>
                                {wp.weeklyProgramId} — {wp.productionOrderId} — {wp.productionOrder?.productItem?.productName} (Planned: {wp.plannedQty} pcs) {wp._isBacklog ? "⚠️ [PENDING FROM PREVIOUS WEEK]" : ""}
                              </option>
                            ))}
                          </select>
                          {formErrors.weeklyProgramId && <div className="text-danger small mt-1">{formErrors.weeklyProgramId}</div>}
                        </>
                      )}
                    </Col>

                    {/* Auto-filled info banner */}
                    {selectedWeeklyProg && (
                      <Col md={12}>
                        <div className="rounded-3 p-3" style={{ background: "#f0fdf4", border: "1px solid #86efac" }}>
                          <Row className="g-2">
                            <Col sm={6} md={3}>
                              <div className="text-muted small text-uppercase fw-bold mb-1">Production Order</div>
                              <div className="fw-bold">{selectedWeeklyProg.productionOrderId}</div>
                            </Col>
                            <Col sm={6} md={3}>
                              <div className="text-muted small text-uppercase fw-bold mb-1">Product</div>
                              <div className="fw-semibold text-dark small">
                                {selectedWeeklyProg.productionOrder?.productItem?.productName || "—"}
                              </div>
                            </Col>
                            <Col sm={6} md={3}>
                              <div className="text-muted small text-uppercase fw-bold mb-1">Weekly Target</div>
                              <div className="fw-bold">{selectedWeeklyProg.plannedQty} pcs</div>
                            </Col>
                            <Col sm={6} md={3}>
                              <div className="text-muted small text-uppercase fw-bold mb-1">Remaining Capacity</div>
                              {loadingRemaining ? (
                                <Spinner size="sm" />
                              ) : (
                                <div className={`fw-bold ${remainingQty === 0 ? "text-danger" : "text-success"}`}>
                                  {remainingQty !== null ? `${remainingQty} pcs` : "—"}
                                </div>
                              )}
                            </Col>
                            <Col sm={6} md={3}>
                              <div className="text-muted small text-uppercase fw-bold mb-1">Week</div>
                              <div className="small fw-medium">
                                {selectedWeeklyProg.weekStartDate?.split("T")[0]} → {selectedWeeklyProg.weekEndDate?.split("T")[0]}
                              </div>
                            </Col>
                            <Col sm={6} md={3}>
                              <div className="text-muted small text-uppercase fw-bold mb-1">PO Status</div>
                              <StatusBadge status={selectedWeeklyProg.productionOrder?.status || selectedWeeklyProg.status} />
                            </Col>
                            <Col sm={6} md={3}>
                              <div className="text-muted small text-uppercase fw-bold mb-1">PO Target Qty</div>
                              <div className="fw-bold">{selectedWeeklyProg.productionOrder?.targetQty || "—"} pcs</div>
                            </Col>
                            <Col sm={6} md={3}>
                              <div className="text-muted small text-uppercase fw-bold mb-1">Produced So Far</div>
                              <div className="fw-bold">{selectedWeeklyProg.productionOrder?.producedQty || 0} pcs</div>
                            </Col>
                          </Row>
                        </div>
                      </Col>
                    )}
                  </Row>
                </Card.Body>
              </Card>

              {/* Section 2: Schedule */}
              <Card className="border-0 shadow-sm rounded-3 mb-4">
                <Card.Header className="bg-white border-bottom py-3 px-4">
                  <h6 className="mb-0 fw-bold d-flex align-items-center gap-2" style={{ color: "var(--color-primary)" }}>
                    <FaIndustry /> Step 2 — Schedule Details
                  </h6>
                </Card.Header>
                <Card.Body className="p-4">
                  <Row className="g-3">
                    {/* Production Date */}
                    <Col md={6}>
                      <TextInput
                        label="Production Date *"
                        name="productionDate"
                        type="date"
                        required
                        value={productionDate}
                        error={formErrors.productionDate}
                        onChange={(e) => setProductionDate(e.target.value)}
                      />
                    </Col>

                    {/* Machine */}
                    <Col md={6}>
                      <label className="form-label fw-bold small text-muted text-uppercase mb-1">
                        Machine <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        style={{ height: "44px", borderRadius: "8px" }}
                        required
                        value={machineId}
                        onChange={(e) => setMachineId(e.target.value)}
                      >
                        <option value="">— Select Machine —</option>
                        {allowedMachines.map((m: any) => (
                          <option key={m.machineId} value={m.machineId}>
                            {m.machineName} ({m.machineId})
                          </option>
                        ))}
                      </select>
                      {formErrors.machineId && <div className="text-danger small mt-1">{formErrors.machineId}</div>}
                    </Col>

                    {/* ─── Machine OEE Panel ─────────────────────────────────── */}
                    {machineId && (
                      <Col md={12}>
                        {loadingOee ? (
                          <div className="d-flex align-items-center gap-2 py-2 text-muted small">
                            <span className="spinner-border spinner-border-sm" />
                            Loading machine OEE...
                          </div>
                        ) : machineOeeSummary ? (
                          <div className="rounded-3 p-3" style={{ background: "#f8faff", border: "1px solid #bfdbfe" }}>
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <span className="fw-bold small" style={{ color: "#1e40af" }}>
                                <FaIndustry className="me-1" />
                                {machineOeeSummary.machineName} — Today's OEE
                              </span>
                              <span className="badge" style={{
                                background: machineOeeSummary.machineStatus === 'RUNNING' ? '#dcfce7' : machineOeeSummary.machineStatus === 'BREAKDOWN' ? '#fee2e2' : '#f3f4f6',
                                color: machineOeeSummary.machineStatus === 'RUNNING' ? '#166534' : machineOeeSummary.machineStatus === 'BREAKDOWN' ? '#991b1b' : '#374151',
                                fontSize: '10px', fontWeight: '700', padding: '4px 8px', borderRadius: '12px'
                              }}>
                                {machineOeeSummary.machineStatus === 'RUNNING' ? '● ' : '○ '}{machineOeeSummary.machineStatus || 'IDLE'}
                              </span>
                            </div>
                            <div className="row g-2">
                              {machineOeeSummary.oeeToday ? (
                                <>
                                  <div className="col-3 text-center">
                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#1d4ed8' }}>
                                      {machineOeeSummary.oeeToday.oeePercent}%
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '10px' }}>OEE</div>
                                  </div>
                                  <div className="col-3 text-center">
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#15803d' }}>
                                      {machineOeeSummary.oeeToday.availability}%
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '10px' }}>Availability</div>
                                  </div>
                                  <div className="col-3 text-center">
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#b45309' }}>
                                      {machineOeeSummary.oeeToday.performance}%
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '10px' }}>Performance</div>
                                  </div>
                                  <div className="col-3 text-center">
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#7c3aed' }}>
                                      {machineOeeSummary.oeeToday.quality}%
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '10px' }}>Quality</div>
                                  </div>
                                </>
                              ) : (
                                <div className="col-12 text-center text-muted small">No production logged today — OEE will appear after first hourly entry</div>
                              )}
                            </div>
                            <div className="d-flex gap-3 mt-2" style={{ fontSize: '11px', color: '#6b7280' }}>
                              <span>📋 Today: {machineOeeSummary.todayPlannedHours}h planned</span>
                              <span>⏱ Downtime: {machineOeeSummary.downtimeToday} min</span>
                              <span>🔄 Active orders: {machineOeeSummary.runningOrdersCount}</span>
                            </div>
                          </div>
                        ) : null}
                      </Col>
                    )}

                    {/* Shift */}
                    <Col md={6}>
                      <label className="form-label fw-bold small text-muted text-uppercase mb-1">
                        Shift <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        style={{ height: "44px", borderRadius: "8px" }}
                        required
                        value={shiftId}
                        onChange={(e) => setShiftId(e.target.value)}
                      >
                        <option value="">— Select Shift —</option>
                        {shifts.map((s: any) => {
                          const remainingHrs = remainingShiftsHours[s.shiftCode] ?? computeShiftHours(s.startTime, s.endTime);
                          const isFullyScheduled = remainingHrs === 0;
                          return (
                            <option key={s.shiftCode} value={s.shiftCode} disabled={isFullyScheduled}>
                              {s.shiftName} ({s.startTime} – {s.endTime}){isFullyScheduled ? " — Fully Scheduled" : ` — ${remainingHrs} hrs remaining`}
                            </option>
                          );
                        })}
                      </select>
                      {formErrors.shiftId && <div className="text-danger small mt-1">{formErrors.shiftId}</div>}

                      {/* Shift hours info */}
                      {selectedShiftInfo && (
                        <div className="mt-1 d-flex align-items-center gap-2 text-muted small">
                          <FaClock size={12} />
                          {selectedShiftInfo.startTime} → {selectedShiftInfo.endTime} &nbsp;|&nbsp;
                          <strong className="text-dark">
                            {computeShiftHours(selectedShiftInfo.startTime, selectedShiftInfo.endTime)} hrs auto-filled
                          </strong>
                        </div>
                      )}
                    </Col>

                    {/* Status (only for edit) */}
                    {isEdit && (
                      <Col md={6}>
                        <label className="form-label fw-bold small text-muted text-uppercase mb-1">Status</label>
                        <select
                          className="form-select"
                          style={{ height: "44px", borderRadius: "8px" }}
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="PLANNED">Planned</option>
                          <option value="APPROVED">Approved</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </Col>
                    )}
                  </Row>
                </Card.Body>
              </Card>

              {/* Section 3: Quantity & Hours */}
              <Card className="border-0 shadow-sm rounded-3 mb-4">
                <Card.Header className="bg-white border-bottom py-3 px-4">
                  <h6 className="mb-0 fw-bold d-flex align-items-center gap-2" style={{ color: "var(--color-primary)" }}>
                    <FaBoxes /> Step 3 — Quantity & Time
                  </h6>
                </Card.Header>
                <Card.Body className="p-4">
                  <Row className="g-3">
                    {/* Planned Qty */}
                    <Col md={4}>
                      <TextInput
                        label="Planned Quantity (pcs) *"
                        name="plannedQty"
                        type="number"
                        required
                        value={plannedQty}
                        error={formErrors.plannedQty}
                        placeholder={remainingQty !== null ? `Max: ${remainingQty}` : "e.g. 500"}
                        onChange={(e) => setPlannedQty(e.target.value)}
                      />
                      {overCapacity && (
                        <div className="text-danger small mt-1">
                          <FaExclamationTriangle className="me-1" />
                          Exceeds weekly remaining capacity ({remainingQty} pcs)
                        </div>
                      )}
                      {remainingQty !== null && !overCapacity && Number(plannedQty) > 0 && (
                        <div className="text-muted small mt-1">
                          Remaining after this plan: {remainingQty - Number(plannedQty)} pcs
                        </div>
                      )}
                    </Col>

                    {/* Planned Hours — auto-filled from shift */}
                    <Col md={4}>
                      <TextInput
                        label="Planned Hours"
                        name="plannedHours"
                        type="number"
                        value={plannedHours}
                        error={formErrors.plannedHours}
                        placeholder="Auto-filled from shift"
                        onChange={(e) => setPlannedHours(e.target.value)}
                      />
                      <div className="text-muted small mt-1">
                        <FaClock size={11} className="me-1" />
                        Auto-filled based on selected shift
                      </div>
                    </Col>

                    {/* Priority — auto-filled from PO */}
                    <Col md={4}>
                      <label className="form-label fw-bold small text-muted text-uppercase mb-1">
                        Priority
                        {selectedWeeklyProg?.productionOrder?.priority && (
                          <span className="ms-2 text-success fw-normal" style={{ fontSize: "10px" }}>
                            <FaCheckCircle className="me-1" />auto from PO
                          </span>
                        )}
                      </label>
                      <select
                        className="form-select"
                        style={{ height: "44px", borderRadius: "8px" }}
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="URGENT">URGENT</option>
                      </select>
                    </Col>

                    {/* Remarks */}
                    <Col md={12}>
                      <label className="form-label fw-bold small text-muted text-uppercase mb-1">Remarks</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        style={{ borderRadius: "8px" }}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Optional notes for this daily production plan..."
                      />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>

            {/* ─── RIGHT: Summary Card ─── */}
            <Col xl={4} lg={5}>
              <Card className="border-0 shadow-sm rounded-3 sticky-top" style={{ top: "80px" }}>
                <Card.Header className="py-3 px-4" style={{ background: "var(--color-primary, #003428)", color: "#fff", borderRadius: "12px 12px 0 0" }}>
                  <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                    <FaInfoCircle /> Plan Summary
                  </h6>
                </Card.Header>
                <Card.Body className="p-4">
                  <div className="d-flex flex-column gap-3">

                    {/* Weekly Program */}
                    <div className="summary-row d-flex justify-content-between border-bottom pb-2">
                      <span className="text-muted small fw-bold text-uppercase">Weekly Program</span>
                      <span className="fw-semibold text-end" style={{ maxWidth: "60%", fontSize: "13px" }}>
                        {weeklyProgramId || <span className="text-muted">Not selected</span>}
                      </span>
                    </div>

                    {/* Production Order */}
                    {selectedWeeklyProg && (
                      <div className="summary-row d-flex justify-content-between border-bottom pb-2">
                        <span className="text-muted small fw-bold text-uppercase">Production Order</span>
                        <div className="text-end">
                          <div className="fw-semibold" style={{ fontSize: "13px" }}>{selectedWeeklyProg.productionOrderId}</div>
                          <div className="text-muted" style={{ fontSize: "11px" }}>
                            {selectedWeeklyProg.productionOrder?.productItem?.productName}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Date */}
                    <div className="summary-row d-flex justify-content-between border-bottom pb-2">
                      <span className="text-muted small fw-bold text-uppercase">Date</span>
                      <span className="fw-semibold" style={{ fontSize: "13px" }}>
                        {productionDate || <span className="text-muted">Not set</span>}
                      </span>
                    </div>

                    {/* Machine */}
                    <div className="summary-row d-flex justify-content-between border-bottom pb-2">
                      <span className="text-muted small fw-bold text-uppercase">Machine</span>
                      <span className="fw-semibold" style={{ fontSize: "13px" }}>
                        {machineId ? allowedMachines.find((m: any) => m.machineId === machineId)?.machineName || machineId : <span className="text-muted">Not selected</span>}
                      </span>
                    </div>

                    {/* Shift */}
                    <div className="summary-row d-flex justify-content-between border-bottom pb-2">
                      <span className="text-muted small fw-bold text-uppercase">Shift</span>
                      <div className="text-end">
                        <div className="fw-semibold" style={{ fontSize: "13px" }}>
                          {shiftId ? shifts.find((s: any) => s.shiftCode === shiftId)?.shiftName || shiftId : <span className="text-muted">Not selected</span>}
                        </div>
                        {selectedShiftInfo && (
                          <div className="text-muted" style={{ fontSize: "11px" }}>
                            {selectedShiftInfo.startTime} – {selectedShiftInfo.endTime}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Planned Qty */}
                    <div className="summary-row d-flex justify-content-between border-bottom pb-2">
                      <span className="text-muted small fw-bold text-uppercase">Planned Qty</span>
                      <span className={`fw-bold ${overCapacity ? "text-danger" : "text-dark"}`} style={{ fontSize: "16px" }}>
                        {plannedQty ? `${Number(plannedQty).toLocaleString()} pcs` : <span className="text-muted fw-normal">—</span>}
                      </span>
                    </div>

                    {/* Planned Hours */}
                    <div className="summary-row d-flex justify-content-between border-bottom pb-2">
                      <span className="text-muted small fw-bold text-uppercase">Planned Hours</span>
                      <span className="fw-semibold" style={{ fontSize: "13px" }}>
                        {plannedHours ? `${plannedHours} hrs` : "—"}
                      </span>
                    </div>

                    {/* Priority */}
                    <div className="summary-row d-flex justify-content-between border-bottom pb-2">
                      <span className="text-muted small fw-bold text-uppercase">Priority</span>
                      <StatusBadge status={priority || "MEDIUM"} />
                    </div>

                    {/* Capacity Warning */}
                    {overCapacity && (
                      <Alert variant="danger" className="py-2 px-3 mb-0 small">
                        <FaExclamationTriangle className="me-1" />
                        Planned qty exceeds the remaining capacity of <strong>{remainingQty} pcs</strong>.
                      </Alert>
                    )}

                    {remainingQty === 0 && !overCapacity && (
                      <Alert variant="warning" className="py-2 px-3 mb-0 small">
                        No remaining capacity on this weekly program.
                      </Alert>
                    )}
                  </div>
                </Card.Body>

                {/* Save Button */}
                <Card.Footer className="bg-white border-top p-4">
                  <div className="d-flex gap-2 flex-column">
                    <button
                      type="submit"
                      className="btn text-white w-100 fw-bold py-2 rounded-3"
                      style={{
                        backgroundColor: "var(--color-primary, #003428)",
                        borderColor: "var(--color-primary, #003428)",
                        fontSize: "15px"
                      }}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <><Spinner size="sm" className="me-2" />Saving...</>
                      ) : (
                        <><FaSave className="me-2" />{isEdit ? "Update Plan" : "Create Daily Plan"}</>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-light w-100 rounded-3"
                      onClick={() => navigate("/daily-machine-planning")}
                    >
                      <FaArrowLeft className="me-2" />Cancel
                    </button>
                  </div>
                </Card.Footer>
              </Card>
            </Col>
          </Row>
        </form>
      </Container>
    </div>
  );
};

export default DailyPlanCreate;
