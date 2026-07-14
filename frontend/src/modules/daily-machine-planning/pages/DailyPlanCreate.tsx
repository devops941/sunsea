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
    }).catch(() => { });

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
    <div className="p-4 md:p-6 min-h-screen bg-white">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {isEdit ? "Edit Daily Production Plan" : "New Daily Production Plan"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">Home / Production / Daily Planning / {isEdit ? "Edit" : "Create"}</p>
          </div>
          <CustomButton
            text="Back to Daily Planning"
            icon={FaArrowLeft}
            onClick={() => navigate("/daily-machine-planning")}
          />
        </div>

        {submitError && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
            <FaExclamationTriangle className="text-red-500" size={20} />
            <div>
              <p className="font-bold text-red-700 text-sm">Failed to Save Plan</p>
              <p className="text-red-600 text-xs">{submitError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* ─── LEFT: Form Sections ─── */}
            <div className="xl:col-span-2 space-y-6">

              {/* Section 1: Weekly Program */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <FaCalendarAlt className="text-teal-600" />
                  <h6 className="font-bold text-slate-800">Step 1 — Select Weekly Program</h6>
                </div>
                <div className="p-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Weekly Program <span className="text-red-500">*</span>
                    </label>
                    {loadingWeekly ? (
                      <div className="flex items-center gap-2 py-2 text-slate-500 text-sm">
                        <div className="inline-block w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> Loading weekly programs...
                      </div>
                    ) : (
                      <>
                        <select
                          className="w-full h-11 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
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
                        {formErrors.weeklyProgramId && <div className="text-red-500 text-xs mt-1">{formErrors.weeklyProgramId}</div>}
                      </>
                    )}
                  </div>

                  {/* Auto-filled info banner */}
                  {selectedWeeklyProg && (
                    <div className="mt-4">
                      <div className="rounded-xl p-4 mt-4 bg-green-50 border border-green-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-slate-500 text-xs font-bold uppercase mb-1">Production Order</div>
                            <div className="font-bold text-slate-800">{selectedWeeklyProg.productionOrderId}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-xs font-bold uppercase mb-1">Product</div>
                            <div className="font-semibold text-slate-800 text-sm">
                              {selectedWeeklyProg.productionOrder?.productItem?.productName || "—"}
                            </div>
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
                            <div className="text-slate-500 text-xs font-bold uppercase mb-1">PO Status</div>
                            <StatusBadge status={selectedWeeklyProg.productionOrder?.status || selectedWeeklyProg.status} />
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
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Schedule */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <FaIndustry className="text-teal-600" />
                  <h6 className="font-bold text-slate-800">Step 2 — Schedule Details</h6>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Production Date */}
                    <div>
                      <TextInput
                        label="Production Date *"
                        name="productionDate"
                        type="date"
                        required
                        value={productionDate}
                        error={formErrors.productionDate}
                        onChange={(e) => setProductionDate(e.target.value)}
                      />
                    </div>

                    {/* Machine */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        Machine <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="w-full h-11 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      {formErrors.machineId && <div className="text-red-500 text-xs mt-1">{formErrors.machineId}</div>}
                    </div>

                    {/* ─── Machine OEE Panel ─────────────────────────────────── */}
                    {machineId && (
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
                    )}

                    {/* Shift */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        Shift <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="w-full h-11 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      {formErrors.shiftId && <div className="text-red-500 text-xs mt-1">{formErrors.shiftId}</div>}

                      {/* Shift hours info */}
                      {selectedShiftInfo && (
                        <div className="mt-2 flex items-center gap-2 text-slate-500 text-xs">
                          <FaClock size={12} />
                          {selectedShiftInfo.startTime} → {selectedShiftInfo.endTime} &nbsp;|&nbsp;
                          <strong className="text-slate-800">
                            {computeShiftHours(selectedShiftInfo.startTime, selectedShiftInfo.endTime)} hrs auto-filled
                          </strong>
                        </div>
                      )}
                    </div>

                    {/* Status (only for edit) */}
                    {isEdit && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                        <select
                          className="w-full h-11 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Quantity & Hours */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <FaBoxes className="text-teal-600" />
                  <h6 className="font-bold text-slate-800">Step 3 — Quantity & Time</h6>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Planned Qty */}
                    <div>
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
                      <div className="text-muted small mt-1">
                        <FaClock size={11} className="me-1" />
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
                      <select
                        className="w-full h-11 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="URGENT">URGENT</option>
                      </select>
                    </div>

                    {/* Remarks */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remarks</label>
                      <textarea
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={3}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Optional notes for this daily production plan..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── RIGHT: Summary Card ─── */}
            <div className="xl:col-span-1">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-20">
                <div className="px-5 py-4" style={{ background: "var(--color-primary, #003428)" }}>
                  <h6 className="font-bold text-white flex items-center gap-2">
                    <FaInfoCircle /> Plan Summary
                  </h6>
                </div>
                <div className="p-5">
                  <div className="flex flex-col gap-4">

                    {/* Weekly Program */}
                    <div className="flex justify-between border-b border-slate-100 pb-3">
                      <span className="text-muted small fw-bold text-uppercase">Weekly Program</span>
                      <span className="fw-semibold text-end" style={{ maxWidth: "60%", fontSize: "13px" }}>
                        {weeklyProgramId || <span className="text-muted">Not selected</span>}
                      </span>
                    </div>

                    {/* Production Order */}
                    {selectedWeeklyProg && (
                      <div className="flex justify-between border-b border-slate-100 pb-3">
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
                    <div className="flex justify-between border-b border-slate-100 pb-3">
                      <span className="text-muted small fw-bold text-uppercase">Date</span>
                      <span className="fw-semibold" style={{ fontSize: "13px" }}>
                        {productionDate || <span className="text-muted">Not set</span>}
                      </span>
                    </div>

                    {/* Machine */}
                    <div className="flex justify-between border-b border-slate-100 pb-3">
                      <span className="text-muted small fw-bold text-uppercase">Machine</span>
                      <span className="fw-semibold" style={{ fontSize: "13px" }}>
                        {machineId ? allowedMachines.find((m: any) => m.machineId === machineId)?.machineName || machineId : <span className="text-muted">Not selected</span>}
                      </span>
                    </div>

                    {/* Shift */}
                    <div className="flex justify-between border-b border-slate-100 pb-3">
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
                    <div className="flex justify-between border-b border-slate-100 pb-3">
                      <span className="text-muted small fw-bold text-uppercase">Planned Qty</span>
                      <span className={`fw-bold ${overCapacity ? "text-danger" : "text-dark"}`} style={{ fontSize: "16px" }}>
                        {plannedQty ? `${Number(plannedQty).toLocaleString()} pcs` : <span className="text-muted fw-normal">—</span>}
                      </span>
                    </div>

                    {/* Planned Hours */}
                    <div className="flex justify-between border-b border-slate-100 pb-3">
                      <span className="text-muted small fw-bold text-uppercase">Planned Hours</span>
                      <span className="fw-semibold" style={{ fontSize: "13px" }}>
                        {plannedHours ? `${plannedHours} hrs` : "—"}
                      </span>
                    </div>

                    {/* Priority */}
                    <div className="flex justify-between border-b border-slate-100 pb-3">
                      <span className="text-muted small fw-bold text-uppercase">Priority</span>
                      <StatusBadge status={priority || "MEDIUM"} />
                    </div>

                    {/* Capacity Warning */}
                    {overCapacity && (
                      <div className="py-2 px-3 rounded text-red-800 bg-red-100 border border-red-200 text-xs flex items-center">
                        <FaExclamationTriangle className="mr-2" />
                        Planned qty exceeds the remaining capacity of <strong className="ml-1">{remainingQty} pcs</strong>.
                      </div>
                    )}

                    {remainingQty === 0 && !overCapacity && (
                      <div className="py-2 px-3 rounded text-amber-800 bg-amber-100 border border-amber-200 text-xs">
                        No remaining capacity on this weekly program.
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Button */}
                <div className="px-5 py-4 border-t border-slate-100">
                  <div className="flex flex-col gap-2">
                    <button
                      type="submit"
                      className="w-full flex justify-center items-center py-2.5 rounded-lg text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: "var(--color-primary, #003428)" }}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <><div className="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Saving...</>
                      ) : (
                        <><FaSave className="mr-2" />{isEdit ? "Update Plan" : "Create Daily Plan"}</>
                      )}
                    </button>
                    <button
                      type="button"
                      className="w-full flex justify-center items-center py-2.5 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold transition-colors"
                      onClick={() => navigate("/daily-machine-planning")}
                    >
                      <FaArrowLeft className="mr-2" />Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DailyPlanCreate;
