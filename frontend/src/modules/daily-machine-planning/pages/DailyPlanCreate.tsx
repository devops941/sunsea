import React, { useState, useEffect, useCallback, useMemo } from "react";
import { z } from "zod";
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
import { machineOperationAssignmentService } from "../../../services/machineOperationAssignmentService";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextArea from "../../../components/form/TextArea/TextArea";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";

import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import BackButton from "../../../components/ui/BackButton/BackButton";

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

  // ── Fetch active assignment ──────────────────────────────────────────────
  const [operatorName, setOperatorName] = useState("");
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // ── Carry Forward ─────────────────────────────────────────────────────────
  const [carryForwardFromPlanId, setCarryForwardFromPlanId] = useState<string | null>(null);
  const [carryForwardFromInfo, setCarryForwardFromInfo] = useState<any>(null);

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
      let data = [];
      if (Array.isArray(res)) data = res;
      else if (res && Array.isArray(res.data)) data = res.data;
      else if (res && res.data && Array.isArray(res.data.dailyPlans)) data = res.data.dailyPlans;
      else if (res && Array.isArray(res.dailyPlans)) data = res.dailyPlans;
      else if (res && Array.isArray(res.content)) data = res.content;
      setPlansForDateAndMachine(data);
    }).catch(() => { });

    // Fetch OEE summary for selected machine
    setLoadingOee(true);
    oeeService.getMachineOeeSummary(machineId, productionDate)
      .then((data: any) => setMachineOeeSummary(data))
      .catch(() => setMachineOeeSummary(null))
      .finally(() => setLoadingOee(false));
  }, [productionDate, machineId]);

  useEffect(() => {
    if (!machineId || !shiftId || !productionDate) {
      setOperatorName("");
      setAssignmentError(null);
      return;
    }

    setLoadingAssignment(true);
    setAssignmentError(null);

    machineOperationAssignmentService.resolveAssignment({
      machineId,
      shiftId,
      date: productionDate,
    })
      .then((res: any) => {
        const assignment = res.data;
        if (!assignment || !assignment.operators || assignment.operators.length === 0) {
          setOperatorName("");
          setAssignmentError("No operator is assigned to the selected machine for this shift. Please assign an operator before creating the Daily Production Plan.");
          return;
        }

        setOperatorName(assignment.operators.map((op: any) => op.fullName).join(", "));
        setAssignmentError(null);
      })
      .catch((err: any) => {
        console.error("Failed to resolve machine assignment:", err);
        setOperatorName("");
        setAssignmentError("Error resolving machine shift assignment. Please check configurations.");
      })
      .finally(() => {
        setLoadingAssignment(false);
      });
  }, [machineId, shiftId, productionDate]);

  const remainingShiftsHours = useMemo(() => {
    const hoursMap: Record<string, number> = {};
    if (!productionDate || !machineId || !shifts || shifts.length === 0) return hoursMap;

    shifts.forEach((s: any) => {
      const shiftHrs = computeShiftHours(s.startTime, s.endTime);
      const safePlans = Array.isArray(plansForDateAndMachine) ? plansForDateAndMachine : [];
      const existingPlans = safePlans.filter(
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

        const po = p.productionOrder;
        if (po) {
          const targetQty = Number(po.targetQty || 0);
          const producedQty = Number(po.producedQty || 0);
          if (producedQty >= targetQty && p.weeklyProgramId !== stateWpId) {
            return false;
          }
          if (["COMPLETED", "DISPATCHED", "READY_FOR_DISPATCH"].includes(po.status) && p.weeklyProgramId !== stateWpId) {
            return false;
          }
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
      let existingPlans: any[] = [];
      if (Array.isArray(res)) existingPlans = res;
      else if (res && Array.isArray(res.data)) existingPlans = res.data;
      else if (res && res.data && Array.isArray(res.data.dailyPlans)) existingPlans = res.data.dailyPlans;
      else if (res && Array.isArray(res.dailyPlans)) existingPlans = res.dailyPlans;
      else if (res && Array.isArray(res.content)) existingPlans = res.content;

      const safePlans = Array.isArray(existingPlans) ? existingPlans : [];
      const alreadyPlanned = safePlans
        .filter((p: any) => p.status !== "CANCELLED" && p.dailyPlanId !== editId)
        .reduce((sum: number, p: any) => {
          const produced = Array.isArray(p.hourlyProductions)
            ? p.hourlyProductions.reduce((s: number, h: any) => s + Number(h.qtyProduced || 0), 0)
            : 0;
          if (p.status === "COMPLETED" || p.status === "STOPPED" || p.dailyPlanId === carryForwardFromPlanId) {
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
      if (s.carryForwardFromPlanId) {
        setCarryForwardFromPlanId(s.carryForwardFromPlanId);
        setCarryForwardFromInfo(s.carryForwardFromInfo || null);
      }
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
      return;
    }

    if (assignmentError) {
      setSubmitError(assignmentError);
      toast.error(assignmentError);
      return;
    }

    if (!operatorName) {
      const errMsg = "No operator is assigned to the selected machine for this shift. Please assign an operator before creating the Daily Production Plan.";
      setSubmitError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (!isEdit && overCapacity) {
      setFormErrors({ plannedQty: `Cannot exceed weekly remaining capacity (${remainingQty} pcs)` });
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
        carryForwardFromPlanId: carryForwardFromPlanId || null,
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

    <form onSubmit={handleSubmit} className="bg-white  border border-slate-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {isEdit ? "Edit Daily Production Plan" : "New Daily Production Plan"}
          </h2>
        </div>
        <BackButton
          text="Back to Daily Planning"

        />
      </div>

      {submitError && (
        <div className="mx-6  p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
          <FaExclamationTriangle className="text-red-500" size={20} />
          <div>
            <p className="font-bold text-red-700 text-sm">Failed to Save Plan</p>
            <p className="text-red-600 text-xs">{submitError}</p>
          </div>
        </div>
      )}

      {assignmentError && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
          <FaExclamationTriangle className="text-red-500" size={20} />
          <div>
            <p className="font-bold text-red-700 text-sm">Assignment Validation Failed</p>
            <p className="text-red-600 text-xs">{assignmentError}</p>
          </div>
        </div>
      )}

      {/* ── Carry Forward Banner ──────────────────────────── */}
      {carryForwardFromPlanId && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
          <FaArrowLeft className="text-amber-600 rotate-180" size={18} />
          <div>
            <p className="font-bold text-amber-800 text-sm">Carry Forward from {carryForwardFromPlanId}</p>
            {carryForwardFromInfo && (
              <p className="text-amber-700 text-xs">
                {carryForwardFromInfo.shiftName || carryForwardFromInfo.shiftId} — {carryForwardFromInfo.productionDate ? new Date(carryForwardFromInfo.productionDate).toLocaleDateString() : ""}
              </p>
            )}
            <p className="text-amber-600 text-xs mt-0.5">The remaining quantity from plan <strong>{carryForwardFromPlanId}</strong> has been pre-filled below.</p>
          </div>
        </div>
      )}


      <div className="flex flex-col gap-6">
        {/* ─── Form Sections ─── */}
        <div className="w-full">

          {/* Section 1: Weekly Program */}

          <div className="px-5 py-4  flex items-center gap-2">

            <h6 className="font-bold text-lg text-slate-800">Step 1 — Select Weekly Program</h6>
          </div>
          <div className="px-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <SelectInput
                label="Weekly Program"
                required
                disabled={isEdit || !!(location.state as any)?.weeklyProgramId}
                value={weeklyProgramId}
                onChange={(e: any) => setWeeklyProgramId(e.target.value)}
                error={formErrors.weeklyProgramId}
                defaultOptionLabel="— Select Weekly Program —"
                options={weeklyPrograms.map((wp: any) => ({
                  value: wp.weeklyProgramId,
                  label: `${wp.weeklyProgramId}  — ${wp.productionOrder?.productItem?.productName} ${wp._isBacklog ? "⚠️ [PENDING FROM PREVIOUS WEEK]" : ""}`
                }))}
              />
            </div>

            {/* Auto-filled info banner */}
            {selectedWeeklyProg && (

              <div className="rounded-xl p-4 mt-4 bg-green-50 border border-green-200">
                <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase mb-1">Production Order</div>
                    <div className="font-bold text-slate-800">{selectedWeeklyProg.productionOrderId}</div>
                  </div>

                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase mb-1">Weekly Target</div>
                    <div className="font-bold text-slate-800">{selectedWeeklyProg.plannedQty} pcs</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase mb-1">Remaining Capacity</div>
                    {loadingRemaining ? (
                      <div className="inline-block w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <div className={`font-bold ${remainingQty === 0 ? "text-red-600" : "text-green-600"}`}>
                        {remainingQty !== null ? `${remainingQty} pcs` : "—"}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase mb-1">Week</div>
                    <div className="text-sm font-medium text-slate-700">
                      {selectedWeeklyProg.weekStartDate?.split("T")[0]} → {selectedWeeklyProg.weekEndDate?.split("T")[0]}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase mb-1">PO Target Qty</div>
                    <div className="font-bold text-slate-800">{selectedWeeklyProg.productionOrder?.targetQty || "—"} pcs</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-bold uppercase mb-1">Produced So Far</div>
                    <div className="font-bold text-slate-800">{selectedWeeklyProg.productionOrder?.producedQty || 0} pcs</div>
                  </div>
                </div>
              </div>

            )}
          </div>


          {/* Section 2: Schedule */}
          <div className="bg-white">
            <div className="px-5 py-4  flex items-center gap-2">

              <h6 className="font-bold text-lg text-slate-800">Step 2 — Schedule Details</h6>
            </div>
            <div className="px-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Production Date */}
                <div>
                  <DatePickerCalendar
                    label="Production Date"
                    name="productionDate"
                    required
                    value={productionDate}
                    error={formErrors.productionDate}
                    onChange={(e: any) => setProductionDate(e.target.value)}
                  />
                </div>

                {/* Machine */}
                <div>
                  <SelectInput
                    label="Machine"
                    required
                    value={machineId}
                    onChange={(e: any) => setMachineId(e.target.value)}
                    error={formErrors.machineId}
                    defaultOptionLabel="— Select Machine —"
                    options={allowedMachines.map((m: any) => ({
                      value: m.machineId,
                      label: `${m.machineName} (${m.machineId})`
                    }))}
                  />
                </div>

                {/* ─── Machine OEE Panel ─────────────────────────────────── */}
                {/* {machineId && (
                      <div className="md:col-span-2">
                        {loadingOee ? (
                          <div className="flex items-center gap-2 py-2 text-slate-500 text-sm">
                            <div className="inline-block w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                            Loading machine OEE...
                          </div>
                        ) : machineOeeSummary ? (
                          <div className="rounded-xl p-4 bg-blue-50 border border-blue-200">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-bold text-sm text-blue-800 flex items-center">
                                <FaIndustry className="mr-2" />
                                {machineOeeSummary.machineName} — Today's OEE
                              </span>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${machineOeeSummary.machineStatus === 'RUNNING' ? 'bg-green-100 text-green-800' : machineOeeSummary.machineStatus === 'BREAKDOWN' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                                {machineOeeSummary.machineStatus === 'RUNNING' ? '● ' : '○ '}{machineOeeSummary.machineStatus || 'IDLE'}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              {machineOeeSummary.oeeToday ? (
                                <>
                                  <div className="text-center">
                                    <div className="text-lg font-extrabold text-blue-700">
                                      {machineOeeSummary.oeeToday.oeePercent}%
                                    </div>
                                    <div className="text-slate-500 text-[10px] uppercase">OEE</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-sm font-bold text-green-700">
                                      {machineOeeSummary.oeeToday.availability}%
                                    </div>
                                    <div className="text-slate-500 text-[10px] uppercase">Availability</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-sm font-bold text-amber-700">
                                      {machineOeeSummary.oeeToday.performance}%
                                    </div>
                                    <div className="text-slate-500 text-[10px] uppercase">Performance</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-sm font-bold text-purple-700">
                                      {machineOeeSummary.oeeToday.quality}%
                                    </div>
                                    <div className="text-slate-500 text-[10px] uppercase">Quality</div>
                                  </div>
                                </>
                              ) : (
                                <div className="col-span-4 text-center text-slate-500 text-sm py-2">No production logged today — OEE will appear after first hourly entry</div>
                              )}
                            </div>
                            <div className="flex gap-4 mt-3 text-xs text-slate-500 justify-center border-t border-blue-200/50 pt-2">
                              <span>📋 Today: {machineOeeSummary.todayPlannedHours}h planned</span>
                              <span>⏱ Downtime: {machineOeeSummary.downtimeToday} min</span>
                              <span>🔄 Active orders: {machineOeeSummary.runningOrdersCount}</span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )} */}

                {/* Shift */}
                <div>
                  <SelectInput
                    label="Shift"
                    required
                    value={shiftId}
                    onChange={(e: any) => setShiftId(e.target.value)}
                    error={formErrors.shiftId}
                    defaultOptionLabel="— Select Shift —"
                    options={shifts.map((s: any) => {
                      const remainingHrs = remainingShiftsHours[s.shiftCode] ?? computeShiftHours(s.startTime, s.endTime);
                      const isFullyScheduled = remainingHrs === 0;
                      return {
                        value: s.shiftCode,
                        label: `${s.shiftName} (${s.startTime} – ${s.endTime})${isFullyScheduled ? " — Fully Scheduled" : ` — ${remainingHrs} hrs remaining`}`,
                        disabled: isFullyScheduled
                      };
                    })}
                  />

                  {/* Shift hours info */}
                  {/* {selectedShiftInfo && (
                        <div className="mt-2 flex items-center gap-2 text-slate-500 text-xs">
                          <FaClock size={12} />
                          {selectedShiftInfo.startTime} → {selectedShiftInfo.endTime} &nbsp;|&nbsp;
                          <strong className="text-slate-800">
                            {computeShiftHours(selectedShiftInfo.startTime, selectedShiftInfo.endTime)} hrs auto-filled
                          </strong>
                        </div>
                      )} */}
                </div>

                {/* Operators */}
                <div>
                  <label className="form-label text-sm font-semibold text-slate-700 mb-1 block">Operators</label>
                  {loadingAssignment ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm">
                      <div className="animate-pulse flex gap-2 items-center">
                        <div className="w-4 h-4 bg-slate-200 rounded-full"></div>
                        <div className="h-2 bg-slate-200 rounded w-24"></div>
                      </div>
                    </div>
                  ) : operatorName ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                      {operatorName.split(',').map((name, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5 leading-none">Operator {index + 1}</p>
                            <p className="text-sm text-slate-800 font-semibold mb-0 leading-none">{name.trim()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex flex-col gap-1">
                      <span className="font-semibold">No operator assigned</span>
                      {assignmentError && <span className="text-xs text-amber-600">{assignmentError}</span>}
                    </div>
                  )}
                  {assignmentError && assignmentError.includes("operator") && operatorName && (
                    <div className="text-red-500 text-xs mt-1">{assignmentError}</div>
                  )}
                </div>

                {/* Status (only for edit) */}
                {isEdit && (
                  <div>
                    <SelectInput
                      label="Status"
                      value={status}
                      onChange={(e: any) => setStatus(e.target.value)}
                      options={[
                        { value: "DRAFT", label: "Draft" },
                        { value: "PLANNED", label: "Planned" },
                        { value: "IN_PROGRESS", label: "In Progress" },
                        { value: "COMPLETED", label: "Completed" },
                        { value: "CANCELLED", label: "Cancelled" }
                      ]}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Quantity & Hours */}
          <div className="bg-white ">
            <div className="px-5 py-4  flex items-center gap-2">

              <h6 className="font-bold text-lg text-slate-800">Step 3 — Quantity & Time</h6>
            </div>
            <div className="px-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Planned Qty */}
                <div>
                  <TextInput
                    label="Planned Quantity (pcs)"
                    name="plannedQty"
                    type="number"
                    required
                    value={plannedQty}
                    error={formErrors.plannedQty}
                    placeholder={remainingQty !== null ? `Max: ${remainingQty}` : "e.g. 500"}
                    onChange={(e) => setPlannedQty(e.target.value)}
                  />
                  {overCapacity && (
                    <div className="text-red-500 text-xs  flex items-center">
                      <FaExclamationTriangle className="mr-1" />
                      Exceeds weekly remaining capacity ({remainingQty} pcs)
                    </div>
                  )}
                  {remainingQty !== null && !overCapacity && Number(plannedQty) > 0 && (
                    <div className="text-slate-500 text-xs ">
                      Remaining after this plan: {remainingQty - Number(plannedQty)} pcs
                    </div>
                  )}
                </div>

                {/* Planned Hours — auto-filled from shift */}
                <div>
                  <TextInput
                    label="Planned Hours"
                    name="plannedHours"
                    type="number"
                    value={plannedHours}
                    error={formErrors.plannedHours}
                    placeholder="Auto-filled from shift"
                    onChange={(e) => setPlannedHours(e.target.value)}
                  />
                  <div className="text-slate-500 text-xs flex items-center">
                    <FaClock size={11} className="mr-1" />
                    Auto-filled based on selected shift
                  </div>
                </div>

                {/* Priority — auto-filled from PO */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Priority
                    {selectedWeeklyProg?.productionOrder?.priority && (
                      <span className="ml-2 text-green-600 font-normal text-[10px] inline-flex items-center">
                        <FaCheckCircle className="mr-1" />auto from PO
                      </span>
                    )}
                  </label>
                  <SelectInput
                    hideLabel
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    options={[
                      { value: "LOW", label: "LOW" },
                      { value: "MEDIUM", label: "MEDIUM" },
                      { value: "HIGH", label: "HIGH" },
                      { value: "URGENT", label: "URGENT" }
                    ]}
                  />
                </div>

                {/* Remarks */}
                <div className="md:col-span-2 lg:col-span-1">
                  <TextArea
                    label="Remarks"
                    name="remarks"
                    rows={3}
                    value={remarks}
                    onChange={(e: any) => setRemarks(e.target.value)}
                    placeholder="Optional notes for this daily production plan..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Action Buttons ─── */}
        <div className="flex justify-end items-center gap-3 px-6 py-5 border-t border-slate-200">
          <CustomButton
            text="Cancel"

            onClick={() => navigate("/daily-machine-planning")}
          />
          <CustomButton
            text={isSubmitting ? "Saving..." : (isEdit ? "Update Plan" : "Create Plan")}
            icon={isSubmitting ? undefined : FaSave}
            type="submit"
            disabled={isSubmitting}
          />
        </div>
      </div>

    </form>

  );
};

export default DailyPlanCreate;
