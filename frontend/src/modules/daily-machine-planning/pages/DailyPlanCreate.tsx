import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { useSocketSync } from "../../../hooks/useSocketSync";
import { createDailyPlan, updateDailyPlan } from "../../../features/daily-plans/dailyPlanSlice";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import { dailyPlanService } from "../../../services/dailyPlanService";
import { productionOrderService } from "../../../services/productionOrderService";
import { productCapacityHistoryService } from "../../../services/productCapacityHistoryService";
import { oeeService } from "../../../services/oeeService";
import { machineOperationAssignmentService } from "../../../services/machineOperationAssignmentService";
import MultiSelect from "../../../components/form/multiSelect/MultiSelect";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextArea from "../../../components/form/TextArea/TextArea";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";

import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import BackButton from "../../../components/ui/BackButton/BackButton";
import { usePermission } from "../../../hooks/usePermission";

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
  const { can } = usePermission();
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
  const [plannedHours, setPlannedHours] = useState("0");
  const [priority, setPriority] = useState("MEDIUM");
  const [status, setStatus] = useState("DRAFT");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [availableShiftHours, setAvailableShiftHours] = useState<number>(0);
  const [totalShiftHours, setTotalShiftHours] = useState<number>(0);

  // ── Fetch active assignment ──────────────────────────────────────────────
  const loadedPlanRef = useRef<{ machineId?: string; shiftId?: string; prodDate?: string } | null>(null);
  const [availableOperators, setAvailableOperators] = useState<any[]>([]);
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const operatorName = useMemo(() => {
    return selectedOperators
      .map((id) => {
        const op = availableOperators.find((o: any) => (o.id || o.employeeId)?.toString() === id);
        return op ? op.fullName : id;
      })
      .filter(Boolean)
      .join(", ");
  }, [selectedOperators, availableOperators]);

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

  // ── Machine-specific product capacity ────────────────────────────────────
  const [machineProductCapacity, setMachineProductCapacity] = useState<number | null>(null);

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

  // ── Fetch machine-specific product capacity ─────────────────────────────
  useEffect(() => {
    if (!machineId || !selectedWeeklyProg?.productionOrder?.productItem?.id) {
      setMachineProductCapacity(null);
      return;
    }
    const productId = Number(selectedWeeklyProg.productionOrder.productItem.id);
    productCapacityHistoryService.fetchByProductAndMachine(productId, machineId)
      .then((rec: any) => {
        if (rec && rec.newCapacity != null) {
          setMachineProductCapacity(Number(rec.newCapacity));
        } else {
          setMachineProductCapacity(null);
        }
      })
      .catch(() => setMachineProductCapacity(null));
  }, [machineId, selectedWeeklyProg]);

  useEffect(() => {
    if (!machineId || !shiftId || !productionDate) {
      setAvailableOperators([]);
      setSelectedOperators([]);
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
          setAvailableOperators([]);
          setSelectedOperators([]);
          setAssignmentError("No operator is assigned to the selected machine for this shift in Weekly Machine Assignment.");
          return;
        }

        const isInitialEditLoad = isEdit &&
          loadedPlanRef.current &&
          loadedPlanRef.current.machineId === machineId &&
          loadedPlanRef.current.shiftId === shiftId &&
          loadedPlanRef.current.prodDate === productionDate;

        setAvailableOperators(assignment.operators);
        if (!isInitialEditLoad) {
          setSelectedOperators(assignment.operators.map((op: any) => (op.id || op.employeeId)?.toString()).filter(Boolean));
        }
        setAssignmentError(null);
      })
      .catch((err: any) => {
        console.error("Failed to resolve machine assignment:", err);
        setAvailableOperators([]);
        setSelectedOperators([]);
        setAssignmentError("Error resolving machine shift assignment. Please check Weekly Machine Assignment.");
      })
      .finally(() => {
        setLoadingAssignment(false);
      });
  }, [machineId, shiftId, productionDate]);

  const remainingShiftsHours = useMemo(() => {
    const hoursMap: Record<string, number> = {};
    if (!productionDate || !machineId || !shifts || shifts.length === 0) return hoursMap;

    const TERMINAL_STATUSES = ["COMPLETED", "STOPPED", "SHORT_CLOSED", "POST_PRODUCTION", "PARTIAL_COMPLETED", "COMPLETED_WITH_SHORTFALL"];

    shifts.forEach((s: any) => {
      const shiftHrs = computeShiftHours(s.startTime, s.endTime);
      const safePlans = Array.isArray(plansForDateAndMachine) ? plansForDateAndMachine : [];
      const existingPlans = safePlans.filter(
        (p: any) => p.shiftId === s.shiftCode && p.status !== "CANCELLED" && p.dailyPlanId !== editId
      );

      const plannedHrsSum = existingPlans
        .reduce((sum: number, p: any) => {
          const loggedHours = Array.isArray(p.hourlyProductions) ? p.hourlyProductions.length : 0;
          if (TERMINAL_STATUSES.includes(p.status)) {
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

  // ── Real-time socket callbacks ────────────────────────────────────────────

  // Re-fetch daily plans for the current date+machine (affects remaining shift hours)
  const refreshDailyPlans = useCallback(() => {
    if (!productionDate || !machineId) return;
    dailyPlanService.getAll({ productionDate, machineId }).then((res) => {
      let data: any[] = [];
      if (Array.isArray(res)) data = res;
      else if (res && Array.isArray((res as any).data)) data = (res as any).data;
      else if (res && (res as any).data && Array.isArray((res as any).data.dailyPlans)) data = (res as any).data.dailyPlans;
      else if (res && Array.isArray((res as any).dailyPlans)) data = (res as any).dailyPlans;
      else if (res && Array.isArray((res as any).content)) data = (res as any).content;
      setPlansForDateAndMachine(data);
    }).catch(() => {});
  }, [productionDate, machineId]);

  // Re-resolve machine assignment (operators) when assignments change
  const refreshAssignment = useCallback(() => {
    if (!machineId || !shiftId || !productionDate) return;
    machineOperationAssignmentService.resolveAssignment({ machineId, shiftId, date: productionDate })
      .then((res: any) => {
        const assignment = res.data;
        if (!assignment || !assignment.operators || assignment.operators.length === 0) {
          setAvailableOperators([]);
          setAssignmentError("No operator is assigned to the selected machine for this shift in Weekly Machine Assignment.");
          return;
        }
        setAvailableOperators(assignment.operators);
        setAssignmentError(null);
      })
      .catch(() => {
        setAvailableOperators([]);
        setAssignmentError("Error resolving machine shift assignment.");
      });
  }, [machineId, shiftId, productionDate]);

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
        if (p.status === "CANCELLED") return p.weeklyProgramId === stateWpId;

        const po = p.productionOrder;

        // PO was permanently stopped (COMPLETED_WITH_SHORTFALL/CLOSED from force-stop) → hide from dropdown
        if (po && (po.status === "COMPLETED_WITH_SHORTFALL" || po.status === "CLOSED") && p.weeklyProgramId !== stateWpId) return false;
        if (po) {
          const targetQty = Number(po.targetQty || 0);
          const producedQty = Math.max(0, Number(po.producedQty || 0) - Number(po.rejectedQty || 0) - Number(po.scrapQty || 0));

          const plans = po.dailyProductionPlans || [];

          // poRemaining = simply how many pcs still need to be produced for the PO
          // po.producedQty already reflects all completed production, so we just subtract that
          const poRemaining = targetQty > 0 ? Math.max(0, targetQty - producedQty) : 0;

          // Only count ACTIVE plans (not yet finished) — finished plan quantities
          // are already reflected in poProducedQty, so counting them again would double-subtract.
          const alreadyPlanned = plans
            .filter((dp: any) => ["PLANNED", "APPROVED", "IN_PROGRESS"].includes(dp.status))
            .reduce((sum: number, dp: any) => {
              const produced = Array.isArray(dp.hourlyProductions)
                ? dp.hourlyProductions.reduce((s: number, h: any) => s + Number(h.qtyProduced || 0), 0)
                : 0;
              return sum + Math.max(Number(dp.plannedQty || 0), produced);
            }, 0);

          const wpPlanned = Number(p.plannedQty || 0);
          const baseCapacity = (wpPlanned > 0 && targetQty > 0) ? Math.min(wpPlanned, poRemaining) : (poRemaining || wpPlanned);
          const remaining = Math.max(0, baseCapacity - alreadyPlanned);

          if (remaining <= 0 && p.weeklyProgramId !== stateWpId) {
            return false;
          }

          const isTargetMet = targetQty > 0 && producedQty >= targetQty;
          const poTerminal = po.status === "CANCELLED" || isTargetMet;

          if (isTargetMet && p.weeklyProgramId !== stateWpId) {
            return false;
          }

          if (p.status === "COMPLETED") {
            if (p.weeklyProgramId === stateWpId) return true;
            const hasActiveWp = list.some(
              (other: any) =>
                other.productionOrderId === p.productionOrderId &&
                other.weeklyProgramId !== p.weeklyProgramId &&
                ["PLANNED", "APPROVED", "IN_PROGRESS"].includes(other.status)
            );
            if (!poTerminal && producedQty < targetQty && !hasActiveWp) return true;
            return false;
          }

          if (poTerminal && p.weeklyProgramId !== stateWpId) {
            return false;
          }
        } else if (p.status === "COMPLETED") {
          return p.weeklyProgramId === stateWpId;
        }

        const isSelectedWeek = p.weekStartDate && p.weekStartDate.startsWith(selectedWeekPrefix);
        const isPending = ["PLANNED", "APPROVED", "IN_PROGRESS"].includes(p.status);
        return isSelectedWeek || isPending || p.weeklyProgramId === stateWpId;
      }).map((p: any) => {
        const isSelectedWeek = p.weekStartDate && p.weekStartDate.startsWith(selectedWeekPrefix);
        const isPending = ["PLANNED", "APPROVED", "IN_PROGRESS"].includes(p.status);
        // Tag completed WPs with remaining PO qty so the label can show it
        if (p.status === "COMPLETED" && p.weeklyProgramId !== stateWpId) {
          const po = p.productionOrder;
          const netProduced = po ? Math.max(0, Number(po.producedQty || 0) - Number(po.rejectedQty || 0) - Number(po.scrapQty || 0)) : 0;
          const poRemaining = po ? Math.max(0, Number(po.targetQty || 0) - netProduced) : 0;
          return { ...p, _isBacklog: true, _poRemaining: poRemaining };
        }
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

  // ── Socket sync: keep dropdowns and remaining quantities live ─────────────
  useSocketSync("machine", undefined, () => dispatch(fetchMachines()));
  useSocketSync("shift", undefined, () => dispatch(fetchShifts()));
  useSocketSync("weeklyProgram", undefined, loadWeeklyPrograms);
  useSocketSync("dailyPlan", undefined, refreshDailyPlans);
  useSocketSync("machineAssignment", undefined, refreshAssignment);

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
      loadedPlanRef.current = {
        machineId: plan.machineId,
        shiftId: plan.shiftId,
        prodDate: plan.productionDate?.split("T")[0]
      };
      if (plan.selectedOperatorIds && plan.selectedOperatorIds.trim() !== "") {
        setSelectedOperators(plan.selectedOperatorIds.split(",").map((id: string) => id.trim()).filter(Boolean));
      } else if (plan.operators && Array.isArray(plan.operators)) {
        setSelectedOperators(plan.operators.map((op: any) => (op.id || op.employeeId)?.toString()).filter(Boolean));
      }
    }).catch(() => toast.error("Failed to load plan for editing"));
  }, [isEdit, editId]);

  // ── Auto-fill: Weekly Program selected or Machine changes ────────────────
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

    const isCarryForward = !!carryForwardFromPlanId;
    const wpPlanned = Number(wp.plannedQty || 0);

    // Use machine-specific capacity when machine is selected, else product-level
    const effectiveCapacity = machineId && machineProductCapacity != null
      ? machineProductCapacity
      : Number(wp.productionOrder?.productItem?.capacityLitres || 0);

    const getCapacity = async (): Promise<number> => {
      if (effectiveCapacity > 0) return effectiveCapacity;
      try {
        const po = await productionOrderService.getById(wp.productionOrderId);
        return Number((po as any)?.productItem?.capacityLitres || 0);
      } catch { return 0; }
    };

    const poTarget = Number(wp.productionOrder?.targetQty || 0);
    const poProduced = Math.max(0, Number(wp.productionOrder?.producedQty || 0) - Number(wp.productionOrder?.rejectedQty || 0) - Number(wp.productionOrder?.scrapQty || 0));
    const poRemaining = Math.max(0, poTarget - poProduced);

    if (!isCarryForward) {
      // First plan — use remaining PO qty but capped at capacity if capacity > 0
      getCapacity().then((cap) => {
        setRemainingQty(poRemaining);
        if (!isEdit && machineId) {
          if (location.state && (location.state as any).plannedQty) {
            setPlannedQty(String(Number((location.state as any).plannedQty)));
          } else {
            const qty = (cap > 0 && poRemaining > cap) ? cap : poRemaining;
            setPlannedQty(String(qty));
          }
        }
      });
      return;
    }

    // Carry forward — compute remaining
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
        .filter((p: any) =>
          ["PLANNED", "APPROVED", "IN_PROGRESS"].includes(p.status) &&
          p.dailyPlanId !== editId &&
          p.dailyPlanId !== carryForwardFromPlanId
        )
        .reduce((sum: number, p: any) => {
          const produced = Array.isArray(p.hourlyProductions)
            ? p.hourlyProductions.reduce((s: number, h: any) => s + Number(h.qtyProduced || 0), 0)
            : 0;
          return sum + Math.max(Number(p.plannedQty || 0), produced);
        }, 0);
      const remaining = Math.max(0, poTarget - poProduced);
      setRemainingQty(remaining);
      if (!isEdit) {
        if (location.state && (location.state as any).plannedQty) {
          const stateQty = Number((location.state as any).plannedQty);
          setPlannedQty(String(Math.round(stateQty * 1000) / 1000));
        } else if (effectiveCapacity > 0) {
          const qty = (remaining > effectiveCapacity) ? effectiveCapacity : remaining;
          setPlannedQty(String(qty));
        } else {
          setPlannedQty(String(remaining > 0 ? remaining : ""));
        }
      }
    }).catch(() => setRemainingQty(null))
      .finally(() => setLoadingRemaining(false));
  }, [weeklyProgramId, weeklyPrograms, editId, isEdit, location.state, carryForwardFromPlanId, machineId, machineProductCapacity]);

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
    if (!shiftId) { setPlannedHours("0"); return; }
    const selectedShift = shifts.find((s: any) => s.shiftCode === shiftId);
    if (selectedShift?.startTime && selectedShift?.endTime) {
      const shiftHrs = computeShiftHours(selectedShift.startTime, selectedShift.endTime);
      setTotalShiftHours(shiftHrs);
      if (productionDate && machineId) {
        setLoadingRemaining(true);
        dailyPlanService.getAll({ productionDate, machineId, shiftId })
          .then((res: any) => {
            let existingPlans: any[] = [];
            if (Array.isArray(res)) existingPlans = res;
            else if (Array.isArray(res?.data)) existingPlans = res.data;
            else if (Array.isArray(res?.data?.dailyPlans)) existingPlans = res.data.dailyPlans;
            else if (Array.isArray(res?.dailyPlans)) existingPlans = res.dailyPlans;

            const plannedHrsSum = existingPlans
              .filter((p: any) => p.status !== "CANCELLED" && p.dailyPlanId !== editId)
              .reduce((sum: number, p: any) => {
                const loggedHours = Array.isArray(p.hourlyProductions) ? p.hourlyProductions.length : 0;
                if (p.status === "COMPLETED" || p.status === "STOPPED" || p.status === "SHORT_CLOSED") {
                  return sum + loggedHours;
                } else {
                  return sum + Math.max(Number(p.plannedHours || 0), loggedHours);
                }
              }, 0);
            const remainingHrs = Math.max(0, shiftHrs - plannedHrsSum);
            setPlannedHours(String(remainingHrs));
            setAvailableShiftHours(remainingHrs);
          })
          .catch(() => {
            setPlannedHours(String(shiftHrs));
            setAvailableShiftHours(shiftHrs);
          })
          .finally(() => {
            setLoadingRemaining(false);
          });
      } else {
        setPlannedHours(String(shiftHrs));
        setAvailableShiftHours(shiftHrs);
      }
    } else {
      setAvailableShiftHours(0);
      setTotalShiftHours(0);
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
      plannedHours: z.coerce.number()
        .positive("Planned Hours must be greater than 0")
        .max(availableShiftHours, `Planned Hours cannot exceed available shift hours (${availableShiftHours}h)`)
        .optional(),
      selectedOperators: z.array(z.string()).min(1, "Please select at least one operator"),
    });

    const result = schema.safeParse({
      weeklyProgramId,
      productionDate,
      machineId,
      shiftId,
      plannedQty,
      plannedHours,
      selectedOperators
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

    if (selectedOperators.length === 0 && assignmentError) {
      setSubmitError(assignmentError);
      toast.error(assignmentError);
      return;
    }

    // The selectedOperators validation is now handled by Zod above
    if (selectedOperators.length === 0 && assignmentError) {
      setSubmitError(assignmentError);
      toast.error(assignmentError);
      return;
    }

    // Allow overproduction, so we removed the overCapacity block

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
        selectedOperatorIds: selectedOperators.join(","),
      };

      if (isEdit && editId) {
        await dispatch(updateDailyPlan({ id: editId, data: payload })).unwrap();
        toast.success("Daily Production Plan updated successfully!");
      } else {
        const created = await dispatch(createDailyPlan(payload)).unwrap();
        const planId = created?.data?.dailyPlanId || created?.dailyPlanId || "New Plan";
        const machineName = (machines || []).find((m: any) => m.machineId === machineId)?.machineName || machineId;
        const shiftName = shifts.find((s: any) => s.shiftCode === shiftId)?.shiftName || shiftId;
        toast.success(
          ` Plan ${planId} created!\n ${productionDate}   ${machineName}   ${shiftName} ${plannedQty} pcs`,
          { autoClose: 6000 }
        );
        // Rich reminder notification
        setTimeout(() => {
          toast.info(
            ` Reminder: Plan ${planId} is scheduled for ${productionDate} on ${machineName} (${shiftName}). Target: ${plannedQty} pcs. Don't forget to start production and log hourly entries!`,
            { autoClose: 10000, toastId: `reminder-${planId}` }
          );
        }, 1200);
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
    <div className="w-full max-w-[1024px] xl:mr-auto">
    <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-line shadow-sm overflow-hidden">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-5 py-4 border-b border-line">
        <div>
          <h2 className="text-xl font-bold text-ink">
            {isEdit ? "Edit Daily Production Plan" : "New Daily Production Plan"}
          </h2>
        </div>
        <BackButton
          text="Back to Daily Planning"
        />
      </div>

      {submitError && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <FaExclamationTriangle className="text-red-400" size={20} />
          <div>
            <p className="font-bold text-red-400 text-sm">Failed to Save Plan</p>
            <p className="text-red-300 text-xs">{submitError}</p>
          </div>
        </div>
      )}

      {assignmentError && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <FaExclamationTriangle className="text-red-400" size={20} />
          <div>
            <p className="font-bold text-red-400 text-sm">Assignment Validation Failed</p>
            <p className="text-red-300 text-xs">{assignmentError}</p>
          </div>
        </div>
      )}

      {/* ── Carry Forward Banner ──────────────────────────── */}
      {carryForwardFromPlanId && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
          <FaArrowLeft className="text-amber-400 rotate-180" size={18} />
          <div>
            <p className="font-bold text-amber-400 text-sm">Carry Forward from {carryForwardFromPlanId}</p>
            {carryForwardFromInfo && (
              <p className="text-amber-300 text-xs">
                {carryForwardFromInfo.shiftName || carryForwardFromInfo.shiftId} — {carryForwardFromInfo.productionDate ? new Date(carryForwardFromInfo.productionDate).toLocaleDateString() : ""}
              </p>
            )}
            <p className="text-amber-300 text-xs mt-0.5">The remaining quantity from plan <strong>{carryForwardFromPlanId}</strong> has been pre-filled below.</p>
          </div>
        </div>
      )}


      {/* ─── Form Body ─── */}
      <div className="p-5 lg:p-6 space-y-5">

        {/* Section 1: Weekly Program */}
        <div>
          <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px] mb-3">Weekly Program</h6>
          <SelectInput
            label="Weekly Program"
            required
            disabled={isEdit || !!(location.state as any)?.weeklyProgramId}
            value={weeklyProgramId}
            onChange={(e: any) => setWeeklyProgramId(e.target.value)}
            error={formErrors.weeklyProgramId}
            defaultOptionLabel="— Select Weekly Program —"
            horizontal
            options={weeklyPrograms.map((wp: any) => {
              const po = wp.productionOrder;
              const poTargetQty = Number(wp.poTargetQty ?? po?.targetQty ?? 0);
              const poProducedRaw = Number(wp.poProducedQty ?? po?.producedQty ?? 0);
              const poRejectedQty = Number(po?.rejectedQty ?? 0);
              const poScrapQty = Number(po?.scrapQty ?? 0);
              const poNetProduced = Math.max(0, poProducedRaw - poRejectedQty - poScrapQty);
              const poRemaining = Math.max(0, poTargetQty - poNetProduced);
              const displayQty = poRemaining;
              const productName = po?.productItem?.productName || "";
              let tagNode: React.ReactNode = null;
              if (wp._poRemaining !== undefined) {
                tagNode = <span className="text-amber-400 font-semibold">REMAINING: {wp._poRemaining} pcs</span>;
              } else if (wp._isBacklog) {
                tagNode = <span className="text-orange-400 font-semibold">PENDING FROM PREVIOUS WEEK</span>;
              }
              return {
                value: wp.weeklyProgramId,
                selectedLabel: `${productName} — ${displayQty} pcs`,
                label: <span>{productName} — {displayQty} pcs{tagNode ? <span className="ml-2">{tagNode}</span> : null}</span>
              };
            })}
          />

          {/* Auto-filled info banner */}
          {selectedWeeklyProg && (
            <div className="rounded-xl p-3 mt-3 bg-emerald-500/10 border border-emerald-500/20 text-ink">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                <div>
                  <div className="text-ink-subtle text-[10px] font-bold uppercase mb-0.5">Production Order</div>
                  <div className="font-bold text-ink text-sm">{selectedWeeklyProg.productionOrderId}</div>
                </div>
                <div>
                  <div className="text-ink-subtle text-[10px] font-bold uppercase mb-0.5">Product</div>
                  <div className="text-sm font-bold text-ink">{selectedWeeklyProg.productionOrder?.productItem?.productName || "—"}</div>
                </div>
                <div>
                  <div className="text-ink-subtle text-[10px] font-bold uppercase mb-0.5">PO Target Qty</div>
                  <div className="font-bold text-ink text-sm">{selectedWeeklyProg.productionOrder?.targetQty || "—"} pcs</div>
                </div>
                <div>
                  <div className="text-ink-subtle text-[10px] font-bold uppercase mb-0.5">Remaining</div>
                  {(() => {
                    const tgt = Number(selectedWeeklyProg.productionOrder?.targetQty || 0);
                    const produced = Math.max(0, Number(selectedWeeklyProg.productionOrder?.producedQty || 0) - Number(selectedWeeklyProg.productionOrder?.rejectedQty || 0) - Number(selectedWeeklyProg.productionOrder?.scrapQty || 0));
                    const rem = Math.max(0, tgt - produced);
                    return <div className={`font-bold text-sm ${rem <= 0 ? "text-red-400" : "text-emerald-400"}`}>{rem} pcs</div>;
                  })()}
                </div>
                <div>
                  <div className="text-ink-subtle text-[10px] font-bold uppercase mb-0.5">Produced</div>
                  <div className="font-bold text-ink text-sm">{Math.max(0, Number(selectedWeeklyProg.productionOrder?.producedQty || 0) - Number(selectedWeeklyProg.productionOrder?.rejectedQty || 0) - Number(selectedWeeklyProg.productionOrder?.scrapQty || 0))} pcs</div>
                </div>
                {machineId && machineProductCapacity != null && (
                  <div>
                    <div className="text-ink-subtle text-[10px] font-bold uppercase mb-0.5">Capacity/Shift</div>
                    <div className="font-bold text-ink text-sm">{machineProductCapacity.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line-soft" />

        {/* Section 2: Schedule Details */}
        <div>
          <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px] mb-3">Schedule Details</h6>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-8 xl:gap-x-10 gap-y-3 md:gap-y-4">

            <DatePickerCalendar
              label="Production Date"
              name="productionDate"
              required
              horizontal
              value={productionDate}
              error={formErrors.productionDate}
              onChange={(e: any) => setProductionDate(e.target.value)}
            />

            <SelectInput
              label="Machine"
              required
              horizontal
              value={machineId}
              onChange={(e: any) => setMachineId(e.target.value)}
              error={formErrors.machineId}
              defaultOptionLabel="— Select Machine —"
              options={allowedMachines.map((m: any) => ({
                value: m.machineId,
                label: `${m.machineName} (${m.machineId})`
              }))}
            />

            <div>
              <SelectInput
                label="Shift"
                required
                horizontal
                value={shiftId}
                onChange={(e: any) => setShiftId(e.target.value)}
                error={formErrors.shiftId}
                defaultOptionLabel="— Select Shift —"
                options={shifts.map((s: any) => {
                  const totalHrs = computeShiftHours(s.startTime, s.endTime);
                  const remainingHrs = remainingShiftsHours[s.shiftCode] ?? totalHrs;
                  return {
                    value: s.shiftCode,
                    label: remainingHrs > 0
                      ? `${s.shiftName} (${s.startTime} – ${s.endTime}) — ${remainingHrs}h available`
                      : `${s.shiftName} (${s.startTime} – ${s.endTime}) — Full`,
                    disabled: remainingHrs === 0,
                  };
                })}
              />
              {shiftId && (() => {
                const sel = shifts.find((s: any) => s.shiftCode === shiftId);
                if (!sel) return null;
                const hrs = computeShiftHours(sel.startTime, sel.endTime);
                return (
                  <div className="mt-1.5 ml-[148px] flex items-center gap-2 text-ink-subtle text-xs">
                    <FaClock size={11} />
                    {sel.startTime} → {sel.endTime} | <strong className="text-ink">{hrs} hrs</strong>
                  </div>
                );
              })()}
            </div>

            <div>
              {loadingAssignment ? (
                <div className="flex items-center gap-3">
                  <span className="shrink-0 w-[140px] text-[12px] font-extrabold uppercase tracking-[0.5px] text-ink">Operators <span className="text-red-500">*</span></span>
                  <div className="flex-1 p-2.5 bg-card-2 border border-line-soft rounded-lg">
                    <div className="animate-pulse flex gap-2 items-center">
                      <div className="w-4 h-4 bg-card rounded-full"></div>
                      <div className="h-2 bg-card rounded w-24"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <MultiSelect
                  label="Operators"
                  name="operators"
                  required={true}
                  options={availableOperators.map((op: any) => ({
                    value: (op.id || op.employeeId)?.toString(),
                    label: op.fullName + (op.empCode ? ` (${op.empCode})` : "") + (op.role?.name ? ` • ${op.role.name}` : ""),
                  }))}
                  value={selectedOperators}
                  onChange={(_name, vals) => {
                    setSelectedOperators(vals);
                    setAssignmentError(null);
                  }}
                  placeholder={availableOperators.length === 0 ? "No operators assigned to this machine..." : "-- Select Assigned Operators --"}
                  error={formErrors.selectedOperators || (selectedOperators.length === 0 && assignmentError ? assignmentError : undefined)}
                />
              )}
              {availableOperators.length === 0 && !loadingAssignment && (
                <div className="mt-1.5 px-2.5 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-300 text-[11px] font-medium flex items-center gap-1.5">
                  <FaExclamationTriangle className="text-amber-400 shrink-0" size={11} />
                  <span>No operator assigned to this machine in Weekly Assignment.</span>
                </div>
              )}
            </div>

            {isEdit && (
              <SelectInput
                label="Status"
                horizontal
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
            )}
          </div>
        </div>

        <div className="border-t border-line-soft" />

        {/* Section 3: Quantity & Time */}
        <div>
          <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px] mb-3">Quantity & Time</h6>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-8 xl:gap-x-10 gap-y-3 md:gap-y-4">

            <div>
              <TextInput
                label="Planned Qty (pcs)"
                name="plannedQty"
                type="number"
                required
                horizontal
                value={plannedQty}
                error={formErrors.plannedQty}
                placeholder={remainingQty !== null ? `Max: ${remainingQty}` : "e.g. 500"}
                onChange={(e) => setPlannedQty(e.target.value)}
              />
              {machineId && machineProductCapacity != null && (
                <div className="text-[11px] text-primary font-semibold mt-1 ml-[148px]">
                  Capacity: {machineProductCapacity.toLocaleString()} / Shift
                  {Number(plannedQty) < machineProductCapacity && ` · ${machineProductCapacity - Number(plannedQty)} pcs remaining`}
                </div>
              )}
              {overCapacity && (
                <div className="text-amber-400 text-xs flex items-center mt-1 ml-[148px]">
                  <FaExclamationTriangle className="mr-1" />
                  Exceeds remaining ({remainingQty} pcs) — Overproduction allowed
                </div>
              )}
              {remainingQty !== null && !overCapacity && Number(plannedQty) > 0 && (
                <div className="text-ink-subtle text-xs mt-1 ml-[148px]">
                  Remaining after this plan: {remainingQty - Number(plannedQty)} pcs
                </div>
              )}
            </div>

            <div>
              <TextInput
                label="Planned Hours"
                name="plannedHours"
                type="number"
                horizontal
                value={plannedHours}
                error={formErrors.plannedHours}
                placeholder="Auto-filled from shift"
                onChange={(e) => setPlannedHours(e.target.value)}
              />
              <div className="flex items-center gap-1.5 mt-1.5 ml-[148px] text-xs text-ink-muted font-medium">
                <FaInfoCircle className="text-primary text-xs" />
                Max: {availableShiftHours}/{totalShiftHours}h available
              </div>
            </div>

            <SelectInput
              label={selectedWeeklyProg?.productionOrder?.priority
                ? "Priority (auto)"
                : "Priority"}
              horizontal
              value={priority}
              onChange={(e: any) => setPriority(e.target.value)}
              options={[
                { value: "LOW", label: "LOW" },
                { value: "MEDIUM", label: "MEDIUM" },
                { value: "HIGH", label: "HIGH" },
                { value: "URGENT", label: "URGENT" }
              ]}
            />

            <div className="md:col-span-2">
              <TextArea
                label="Narration"
                name="remarks"
                rows={2}
                value={remarks}
                onChange={(e: any) => setRemarks(e.target.value)}
                placeholder="Optional notes for this daily production plan..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Action Buttons ─── */}
      <div className="flex justify-end items-center gap-3 px-5 py-4 border-t border-line bg-card-2">
        <CustomButton
          text="Cancel"
          variant="secondary"
          onClick={() => navigate("/daily-machine-planning")}
        />
        {(isEdit ? can("daily-machine-planning.edit") : can("daily-machine-planning.create")) && (
          <CustomButton
            text={isSubmitting ? "Saving..." : (isEdit ? "Update Plan" : "Create Plan")}
            icon={isSubmitting ? undefined : FaSave}
            type="submit"
            disabled={isSubmitting}
          />
        )}
      </div>

    </form>
    </div>
  );
};

export default DailyPlanCreate;
