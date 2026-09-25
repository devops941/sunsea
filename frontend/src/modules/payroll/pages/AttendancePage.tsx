import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, AlertCircle, RefreshCw,
  CheckCircle2, Users, Info, PlayCircle, Calendar, CalendarDays, Lock, Clock, Plus, Trash2,
  TrendingUp, Coffee, DollarSign, X, Check, ArrowRight, Sparkles, ShieldAlert,
} from 'lucide-react';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import SelectInput from '../../../components/form/SelectInput/SelectInput';
import CommonConfirmModal from '../../../components/ui/CommonConfirmModal/CommonConfirmModal';
import { useDirtyNavGuard } from '../../../hooks/useDirtyNavGuard';
import { payrollService } from '../../../services/payrollService';
import type { ApiEmployeePayroll, ApiPayrollConfig } from '../../../services/payrollService';
import { shiftService } from '../../../services/shiftService';
import type { Shift } from '../../../features/shifts/types';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate } from '../../../utils/dateUtils';

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'HOLIDAY'] as const;
type AttStatus = typeof STATUSES[number] | 'WEEKLY_OFF' | 'LEAVE_PAID' | 'LEAVE_UNPAID';

const S: Record<string, { abbr: string; label: string; cell: string }> = {
  PRESENT:      { abbr: 'P',  label: 'Present',        cell: 'bg-emerald-500 text-white'  },
  ABSENT:       { abbr: 'A',  label: 'Absent',          cell: 'bg-red-500 text-white'      },
  HALF_DAY:     { abbr: 'HD', label: 'Half Day',        cell: 'bg-amber-400 text-white'    },
  HOLIDAY:      { abbr: 'H',  label: 'Holiday',         cell: 'bg-blue-500 text-white'     },
  WEEKLY_OFF:   { abbr: 'H',  label: 'Holiday',         cell: 'bg-blue-500 text-white'     },
  LEAVE_PAID:   { abbr: 'P',  label: 'Present',         cell: 'bg-emerald-500 text-white'  },
  LEAVE_UNPAID: { abbr: 'A',  label: 'Absent',          cell: 'bg-red-500 text-white'      },
};

const CYCLE: (AttStatus | null)[] = [null, 'PRESENT', 'ABSENT', 'HALF_DAY', 'HOLIDAY'];

// ─── Types ────────────────────────────────────────────────────────────────────
export type PunchSlot = { inTime: string; outTime: string };

type CellData = {
  status: AttStatus | null;
  inTime: string | null;
  outTime: string | null;
  punches?: PunchSlot[];
  otHours: number;
  otAmount?: number;
  otDays: number;
  otDaysAmount?: number;
  teaOtCount: number;
  teaOtAmount?: number;
  lateMinutes: number;
  lateDeduction?: number;
  permissionMinutes: number;
  permissionDeduction?: number;
  shiftId: number | null;
};
type GridState = Record<string, CellData>;

const EMPTY_CELL: CellData = {
  status: null,
  inTime: null,
  outTime: null,
  punches: [],
  otHours: 0,
  otAmount: 0,
  otDays: 0,
  otDaysAmount: 0,
  teaOtCount: 0,
  teaOtAmount: 0,
  lateMinutes: 0,
  lateDeduction: 0,
  permissionMinutes: 0,
  permissionDeduction: 0,
  shiftId: null,
};

/** Helper to find default shift for an employee from Employee record */
const getEmployeeDefaultShift = (emp?: ApiEmployeePayroll, shifts: Shift[] = []): Shift | undefined => {
  if (!emp) return undefined;
  return shifts.find(s =>
    (emp.shift?.id && s.id === emp.shift.id) ||
    (emp.shiftId && (s.shiftCode === emp.shiftId || String(s.id) === String(emp.shiftId))) ||
    (emp.shift?.shiftCode && s.shiftCode === emp.shift.shiftCode)
  );
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getMonthDates(year: number, month: number): string[] {
  const totalDays = new Date(year, month, 0).getDate();
  return Array.from({ length: totalDays }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  });
}

function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}

function cycleStatus(cur: AttStatus | null): AttStatus | null {
  if (cur === ('WEEKLY_OFF' as any)) return 'HOLIDAY';
  const i = CYCLE.indexOf(cur);
  return CYCLE[(i + 1) % CYCLE.length];
}

function cellKey(empId: number, date: string) { return `${empId}_${date}`; }

/** ISO week number of a date */
function isoWeekOf(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dow);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** ISO week-year (year the ISO week belongs to) */
function isoWeekYear(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dow);
  return d.getFullYear();
}

/** ISO week period string e.g. "2026-W32" */
function isoPeriod(dateStr: string): string {
  return `${isoWeekYear(dateStr)}-W${String(isoWeekOf(dateStr)).padStart(2,'0')}`;
}

/** All "weeks of month" – groups of 7 days starting from day 1 */
type WeekOfMonth = { num: number; dates: string[]; label: string; period: string };

function weeksOfMonth(year: number, month: number): WeekOfMonth[] {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

  const firstDow = firstDayOfMonth.getDay() || 7; // Mon=1 ... Sun=7
  const firstMonday = new Date(firstDayOfMonth);
  firstMonday.setDate(firstDayOfMonth.getDate() - (firstDow - 1));

  const result: WeekOfMonth[] = [];
  let currentMonday = new Date(firstMonday);
  let w = 1;

  while (currentMonday <= lastDayOfMonth) {
    const dates: string[] = [];
    const sun = new Date(currentMonday);
    sun.setDate(currentMonday.getDate() + 6);

    for (let i = 0; i < 7; i++) {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }

    const period = isoPeriod(dates[0]);
    const startFmt = `${MONTHS[currentMonday.getMonth()].slice(0, 3)} ${currentMonday.getDate()}`;
    const endFmt = `${MONTHS[sun.getMonth()].slice(0, 3)} ${sun.getDate()}`;

    result.push({
      num: w,
      dates,
      period,
      label: `Week ${w} (${startFmt} – ${endFmt})`,
    });

    currentMonday.setDate(currentMonday.getDate() + 7);
    w++;
  }

  return result;
}

// ─── Status Cell ──────────────────────────────────────────────────────────────
const StatusCell: React.FC<{
  cell: CellData;
  isLocked?: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ cell, isLocked, onClick, onContextMenu }) => {
  const hasExtra = cell.otHours > 0 || cell.otDays > 0 || cell.teaOtCount > 0 || cell.lateMinutes > 0 || cell.permissionMinutes > 0 || !!cell.inTime || !!cell.outTime;
  
  const tooltipDetails: string[] = [];
  if (cell.status) tooltipDetails.push(S[cell.status]?.label ?? cell.status);
  else tooltipDetails.push('Unset');
  if (cell.otHours > 0) tooltipDetails.push(`OT: ${cell.otHours}h`);
  if (cell.otDays > 0) tooltipDetails.push(`OT Days: ${cell.otDays}`);
  if (cell.teaOtCount > 0) tooltipDetails.push(`Tea OT: ${cell.teaOtCount}`);
  if (cell.lateMinutes > 0) tooltipDetails.push(`Late: ${cell.lateMinutes}m`);
  if (cell.permissionMinutes > 0) tooltipDetails.push(`Perm: ${cell.permissionMinutes}m`);

  return (
    <div className="relative inline-flex">
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        disabled={isLocked}
        className={`w-[32px] h-[28px] rounded flex items-center justify-center font-bold text-[9px] transition-all select-none ${
          isLocked
            ? cell.status
              ? `${S[cell.status].cell} opacity-90 cursor-not-allowed border border-slate-300/60`
              : 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-90 border border-slate-300'
            : cell.status
              ? S[cell.status].cell
              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
        }`}
        title={
          isLocked
            ? `Locked (Payroll Approved) — ${tooltipDetails.join(' · ')}`
            : tooltipDetails.join(' · ') + ' (Click to edit)'
        }
      >
        {cell.status ? S[cell.status].abbr : '—'}
      </button>
      {hasExtra && (
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 pointer-events-none" />
      )}
    </div>
  );
};

// ─── Cell Edit Panel ──────────────────────────────────────────────────────────
const CellEditPanel: React.FC<{
  emp?: ApiEmployeePayroll;
  empName: string;
  date: string;
  cell: CellData;
  isLocked: boolean;
  shifts: Shift[];
  weeklyOffDays: number[];
  payrollCfg: ApiPayrollConfig | null;
  calendarDays: number;
  onChange: (c: CellData) => void;
  onClose: () => void;
}> = ({ emp, empName, date, cell, isLocked, shifts, weeklyOffDays, payrollCfg, calendarDays, onChange, onClose }) => {
  const isWeeklyOff = weeklyOffDays.includes(dayOfWeek(date));

  // Employee's default shift configured in Employee Master
  const defaultShift = useMemo(() => getEmployeeDefaultShift(emp, shifts), [emp, shifts]);

  // Local draft state for cell edits
  const [draftCell, setDraftCell] = useState<CellData>(() => {
    let initial = { ...cell };
    if (initial.shiftId == null && defaultShift) {
      initial.shiftId = defaultShift.id;
      initial.inTime = initial.inTime || defaultShift.startTime || null;
      initial.outTime = initial.outTime || defaultShift.endTime || null;
    }
    return initial;
  });

  const [isDirty, setIsDirty] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const showExtras = draftCell.status !== null;

  // Multi-punch sessions state
  const initialPunches = useMemo<PunchSlot[]>(() => {
    if (cell.punches && cell.punches.length > 0) {
      return cell.punches;
    }
    if (cell.inTime || cell.outTime) {
      return [{ inTime: cell.inTime || '', outTime: cell.outTime || '' }];
    }
    if (defaultShift?.startTime || defaultShift?.endTime) {
      return [{ inTime: defaultShift.startTime || '', outTime: defaultShift.endTime || '' }];
    }
    return [{ inTime: '', outTime: '' }];
  }, [cell.punches, cell.inTime, cell.outTime, defaultShift]);

  const [punches, setPunches] = useState<PunchSlot[]>(initialPunches);

  const handlePunchChange = (index: number, field: 'inTime' | 'outTime', value: string) => {
    const updated = punches.map((p, idx) => (idx === index ? { ...p, [field]: value } : p));
    setPunches(updated);
    const firstIn = updated.find(p => p.inTime)?.inTime || null;
    const lastOut = [...updated].reverse().find(p => p.outTime)?.outTime || null;
    setDraftCell(prev => ({
      ...prev,
      inTime: firstIn,
      outTime: lastOut,
      punches: updated,
    }));
    setIsDirty(true);
  };

  const handleAddPunch = () => {
    const updated = [...punches, { inTime: '', outTime: '' }];
    setPunches(updated);
    setDraftCell(prev => ({
      ...prev,
      punches: updated,
    }));
    setIsDirty(true);
  };

  const handleRemovePunch = (index: number) => {
    if (punches.length <= 1) {
      handlePunchChange(0, 'inTime', '');
      handlePunchChange(0, 'outTime', '');
      return;
    }
    const updated = punches.filter((_, idx) => idx !== index);
    setPunches(updated);
    const firstIn = updated.find(p => p.inTime)?.inTime || null;
    const lastOut = [...updated].reverse().find(p => p.outTime)?.outTime || null;
    setDraftCell(prev => ({
      ...prev,
      inTime: firstIn,
      outTime: lastOut,
      punches: updated,
    }));
    setIsDirty(true);
  };

  // ── Rate Calculations ──
  const empDailyRate = useMemo(() => {
    if (!emp) return 0;
    const pc = emp.payrollConfig;
    const gross = Number(pc?.monthlySalary || 0);
    const st = (pc?.salaryType || emp.salaryType || '').toUpperCase();
    if (st === 'WEEKLY') {
      return gross / 6;
    }
    if (st === 'DAILY' || st === 'DAILY_WEEKLY') {
      return Number(pc?.dailySalary || gross || 0);
    }
    const divisor = calendarDays > 0 ? calendarDays : 30;
    return gross / divisor;
  }, [emp, calendarDays]);

  const defaultWorkingHours = Number(payrollCfg?.defaultWorkingHoursPerDay || 8);
  const otHourlyRate = Number(payrollCfg?.otRatePerHour || 0) > 0
    ? Number(payrollCfg?.otRatePerHour)
    : (defaultWorkingHours > 0 ? empDailyRate / defaultWorkingHours : 0);
  const teaOtRate = Number(payrollCfg?.teaOtRate || 0);
  const graceMinutes = Number(payrollCfg?.lateEntryGraceMinutes ?? 10);
  const workingMinutes = defaultWorkingHours * 60;
  const perMinuteRate = workingMinutes > 0 ? empDailyRate / workingMinutes : 0;

  const isOfficeStaff = (emp?.payrollConfig?.salaryType !== 'DAILY_WEEKLY' && emp?.payrollConfig?.salaryType !== 'WEEKLY') &&
    (emp?.employeeCategory === 'office_staff' || !emp?.employeeCategory);
  const staffFreeMinutes = Number(payrollCfg?.staffPermissionFreeMinutes ?? 240);
  const staffHourlyRate = Number(payrollCfg?.staffExcessHourlyRate ?? 50);

  // Late deduction calculation
  const computeLateDeduction = useCallback((mins: number): number => {
    if (mins <= graceMinutes) return 0;
    const slabs = (payrollCfg?.lateEntrySlabs as any[]) || [];
    const matched = slabs.find(s => mins >= s.fromMinutes && (s.toMinutes === 0 || mins <= s.toMinutes));
    if (matched && Number(matched.amount) > 0) {
      return Number(matched.amount);
    }
    return (mins - graceMinutes) * perMinuteRate;
  }, [graceMinutes, payrollCfg?.lateEntrySlabs, perMinuteRate]);

  // Permission deduction calculation
  const computePermDeduction = useCallback((mins: number): number => {
    if (mins <= 0) return 0;
    if (isOfficeStaff) {
      const excess = Math.max(0, mins - staffFreeMinutes);
      const excessHours = Math.ceil(excess / 60);
      return excessHours * staffHourlyRate;
    }
    const slabs = (payrollCfg?.permissionSlabs as any[]) || [];
    const matched = slabs.find(s => mins >= s.fromMinutes && (s.toMinutes === 0 || mins <= s.toMinutes));
    return matched ? Number(matched.amount) : 0;
  }, [isOfficeStaff, staffFreeMinutes, staffHourlyRate, payrollCfg?.permissionSlabs]);

  // Current amounts (purely manual value from draftCell)
  const otHoursAmt = Number(draftCell.otAmount ?? 0);
  const otDaysAmt = Number(draftCell.otDaysAmount ?? 0);
  const teaOtAmt = Number(draftCell.teaOtAmount ?? 0);
  const lateDedAmt = Number(draftCell.lateDeduction ?? 0);
  const permDedAmt = Number(draftCell.permissionDeduction ?? 0);

  const totalEarnings = otHoursAmt + otDaysAmt + teaOtAmt;
  const totalDeductions = lateDedAmt + permDedAmt;
  const netImpact = totalEarnings - totalDeductions;

  // Calculate session duration helper
  const getSlotDuration = (inT: string, outT: string): string => {
    if (!inT || !outT) return '';
    const [inH, inM] = inT.split(':').map(Number);
    const [outH, outM] = outT.split(':').map(Number);
    if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return '';
    let diff = (outH * 60 + outM) - (inH * 60 + inM);
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m > 0 ? `${m}m` : ''}`;
  };

  // Discard / Save logic for Cell Modal
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const saveConfirmOpenRef = useRef(saveConfirmOpen);
  useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

  const handleResume = useCallback(() => {
    setSaveConfirmOpen(false);
  }, []);

  const handleDiscard = useCallback(() => {
    setSaveConfirmOpen(false);
    onClose();
  }, [onClose]);

  const handleSaveFromModal = useCallback(() => {
    setSaveConfirmOpen(false);
    onChange(draftCell);
    onClose();
  }, [draftCell, onChange, onClose]);

  const handleRequestClose = useCallback(() => {
    if (isLocked) {
      onClose();
      return;
    }
    if (saveConfirmOpenRef.current) {
      handleResume();
      return;
    }
    if (isDirtyRef.current) {
      setSaveConfirmOpen(true);
    } else {
      onClose();
    }
  }, [isLocked, handleResume, onClose]);

  const handleDone = () => {
    if (!isLocked && isDirty) {
      onChange(draftCell);
    }
    onClose();
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[data-select-portal]')) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (saveConfirmOpenRef.current) {
        handleResume();
      } else if (isDirtyRef.current && !isLocked) {
        setTimeout(() => setSaveConfirmOpen(true), 0);
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, { capture: true });
    return () => window.removeEventListener('keydown', handleEsc, { capture: true });
  }, [handleResume, onClose, isLocked]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm" onClick={handleRequestClose}>
      <div
        role="dialog"
        aria-modal="true"
        data-escape-guarded
        className="bg-card text-ink border border-line-soft rounded-2xl shadow-2xl w-full max-w-5xl xl:max-w-6xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line-soft bg-card-2/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-sm shadow-xs">
              {empName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-ink text-sm sm:text-base">{empName}</h3>
                {emp?.empCode && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-card border border-line-soft text-ink-muted">
                    {emp.empCode}
                  </span>
                )}
                {emp?.department?.name && (
                  <span className="text-[11px] font-medium text-ink-subtle hidden sm:inline">
                    · {emp.department.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-muted flex items-center gap-1.5 mt-0.5">
                <Calendar size={12} className="text-primary" />
                <span className="font-semibold text-ink">{formatDate(date)}</span>
                <span className="text-ink-subtle">·</span>
                <span className="font-medium text-ink-subtle">{DAY_FULL[dayOfWeek(date)]}</span>
                {isWeeklyOff && (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Weekly Off
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleRequestClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-card-2 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body — Non-scrollable Single Page Grid */}
        <div className="p-4 sm:p-5 space-y-3.5">
          {isLocked && (
            <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-3 py-2 rounded-xl font-medium">
              <Lock size={14} className="shrink-0 text-amber-400" />
              <span>This date is locked because payroll has already been approved or generated. Editing is disabled.</span>
            </div>
          )}

          {/* Row 1: Attendance Status Buttons & Shift Selector in One Unified Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-card-2/40 border border-line-soft p-3 rounded-xl">
            {/* Status Selector (7 cols) */}
            <div className="md:col-span-7 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Attendance Status</label>
                <span className="text-[10px] text-ink-muted">
                  Selected: <span className="font-bold text-ink">{draftCell.status ? (S[draftCell.status]?.label || draftCell.status) : 'Not Marked'}</span>
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {STATUSES.map(st => (
                  <button
                    key={st}
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      const newStatus = draftCell.status === st ? null : st;
                      const autoOtDay = isWeeklyOff && newStatus === 'PRESENT' ? 1 : (isWeeklyOff && newStatus !== 'PRESENT' ? 0 : draftCell.otDays);
                      const assignedShiftId = draftCell.shiftId ?? defaultShift?.id ?? null;
                      const defaultIn = (!draftCell.inTime && defaultShift?.startTime) ? defaultShift.startTime : draftCell.inTime;
                      const defaultOut = (!draftCell.outTime && defaultShift?.endTime) ? defaultShift.endTime : draftCell.outTime;
                      setDraftCell(prev => ({
                        ...prev,
                        status: newStatus,
                        otDays: autoOtDay,
                        shiftId: assignedShiftId,
                        inTime: defaultIn,
                        outTime: defaultOut,
                      }));
                      setIsDirty(true);
                    }}
                    className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                      draftCell.status === st
                        ? `${S[st].cell} border-transparent shadow-sm ring-2 ring-primary/40 scale-[1.02]`
                        : 'bg-card text-ink border-line-soft hover:border-primary/40 hover:bg-card-2'
                    } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-xs font-extrabold">{S[st].abbr}</span>
                    <span className="text-[10px] opacity-85 hidden sm:inline">{S[st].label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    setDraftCell(prev => ({
                      ...prev,
                      status: null,
                      inTime: null,
                      outTime: null,
                      punches: [],
                      otHours: 0,
                      otAmount: 0,
                      otDays: 0,
                      otDaysAmount: 0,
                      teaOtCount: 0,
                      teaOtAmount: 0,
                      lateMinutes: 0,
                      lateDeduction: 0,
                      permissionMinutes: 0,
                      permissionDeduction: 0,
                      shiftId: null,
                    }));
                    setPunches([{ inTime: '', outTime: '' }]);
                    setIsDirty(true);
                  }}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    draftCell.status === null
                      ? 'bg-slate-700 text-white border-transparent shadow-sm ring-2 ring-slate-500/40'
                      : 'bg-card text-ink border-line-soft hover:border-primary/40 hover:bg-card-2'
                  } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="text-xs font-extrabold">—</span>
                  <span className="text-[10px] opacity-85">Clear</span>
                </button>
              </div>
            </div>

            {/* Shift Selector (5 cols) */}
            <div className="md:col-span-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider flex items-center gap-1">
                  <Clock size={11} className="text-primary" /> Shift Configuration
                </label>
                {defaultShift && (
                  <span className="text-[9px] text-primary font-bold px-1.5 py-0.2 rounded bg-primary/10 border border-primary/20">
                    ★ {defaultShift.shiftName}
                  </span>
                )}
              </div>
              <SelectInput
                name="shiftId"
                value={draftCell.shiftId ?? ''}
                defaultOptionLabel="— No Shift Assigned —"
                disabled={isLocked}
                noMargin
                searchable={false}
                options={shifts.map(sh => ({
                  value: sh.id,
                  label: `${sh.shiftName} (${sh.startTime} – ${sh.endTime})${defaultShift?.id === sh.id ? ' ★' : ''}`,
                }))}
                onChange={e => {
                  const selectedShiftId = e.target.value ? Number(e.target.value) : null;
                  const matchedShift = shifts.find(s => s.id === selectedShiftId);
                  setDraftCell(prev => ({
                    ...prev,
                    shiftId: selectedShiftId,
                    inTime: (!prev.inTime && matchedShift?.startTime) ? matchedShift.startTime : prev.inTime,
                    outTime: (!prev.outTime && matchedShift?.endTime) ? matchedShift.endTime : prev.outTime,
                  }));
                  setIsDirty(true);
                }}
              />
            </div>
          </div>

          {/* Row 2: Two-Column Side-by-Side Content */}
          {showExtras && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {/* LEFT COLUMN: Overtime & Earnings */}
              <div className="bg-card-2/40 border border-line-soft rounded-xl p-3.5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-line-soft/60 pb-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-emerald-400" />
                      <span className="text-[11px] font-bold text-ink uppercase tracking-wider">Overtime & Earnings</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                      Total: +₹{totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* 3 Metric Cards */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* OT Minutes */}
                    <div className="bg-card p-2.5 rounded-xl border border-line-soft space-y-1.5">
                      <span className="text-[10px] font-bold text-ink block truncate">OT Duration</span>
                      <div>
                        <span className="text-[8px] font-bold text-ink-muted uppercase block">Minutes</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          disabled={isLocked}
                          value={draftCell.otHours ? Math.round(draftCell.otHours * 60) : ''}
                          placeholder="0"
                          onChange={e => {
                            const mins = Number(e.target.value) || 0;
                            const hours = Math.max(0, mins / 60);
                            setDraftCell(prev => ({ ...prev, otHours: hours }));
                            setIsDirty(true);
                          }}
                          className="w-full bg-card-2 border border-line-soft text-ink font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-emerald-400 uppercase block">Amount (₹)</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-400">₹</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={isLocked}
                            value={draftCell.otAmount !== undefined ? draftCell.otAmount : ''}
                            placeholder="0"
                            onChange={e => {
                              const amt = e.target.value === '' ? 0 : Number(e.target.value);
                              setDraftCell(prev => ({ ...prev, otAmount: Math.max(0, amt) }));
                              setIsDirty(true);
                            }}
                            className="w-full bg-card-2 border border-emerald-500/30 text-emerald-400 font-mono font-bold rounded-lg pl-5 pr-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>

                    {/* OT Days */}
                    <div className="bg-card p-2.5 rounded-xl border border-line-soft space-y-1.5">
                      <span className="text-[10px] font-bold text-ink block truncate">OT Days</span>
                      <div>
                        <span className="text-[8px] font-bold text-ink-muted uppercase block">Days</span>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          disabled={isLocked}
                          value={draftCell.otDays || ''}
                          placeholder="0"
                          onChange={e => {
                            const val = Number(e.target.value) || 0;
                            setDraftCell(prev => ({ ...prev, otDays: Math.max(0, val) }));
                            setIsDirty(true);
                          }}
                          className="w-full bg-card-2 border border-line-soft text-ink font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-emerald-400 uppercase block">Amount (₹)</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-400">₹</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={isLocked}
                            value={draftCell.otDaysAmount !== undefined ? draftCell.otDaysAmount : ''}
                            placeholder="0"
                            onChange={e => {
                              const amt = e.target.value === '' ? 0 : Number(e.target.value);
                              setDraftCell(prev => ({ ...prev, otDaysAmount: Math.max(0, amt) }));
                              setIsDirty(true);
                            }}
                            className="w-full bg-card-2 border border-emerald-500/30 text-emerald-400 font-mono font-bold rounded-lg pl-5 pr-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tea OT */}
                    <div className="bg-card p-2.5 rounded-xl border border-line-soft space-y-1.5">
                      <span className="text-[10px] font-bold text-ink block truncate">Tea OT</span>
                      <div>
                        <span className="text-[8px] font-bold text-ink-muted uppercase block">Count</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          disabled={isLocked}
                          value={draftCell.teaOtCount || ''}
                          placeholder="0"
                          onChange={e => {
                            const val = Number(e.target.value) || 0;
                            setDraftCell(prev => ({ ...prev, teaOtCount: Math.max(0, val) }));
                            setIsDirty(true);
                          }}
                          className="w-full bg-card-2 border border-line-soft text-ink font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-emerald-400 uppercase block">Amount (₹)</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-400">₹</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={isLocked}
                            value={draftCell.teaOtAmount !== undefined ? draftCell.teaOtAmount : ''}
                            placeholder="0"
                            onChange={e => {
                              const amt = e.target.value === '' ? 0 : Number(e.target.value);
                              setDraftCell(prev => ({ ...prev, teaOtAmount: Math.max(0, amt) }));
                              setIsDirty(true);
                            }}
                            className="w-full bg-card-2 border border-emerald-500/30 text-emerald-400 font-mono font-bold rounded-lg pl-5 pr-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Punch Sessions (In / Out) */}
                <div className="bg-card/70 border border-line-soft rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider flex items-center gap-1">
                      <Clock size={11} className="text-primary" /> In / Out Punch Sessions ({punches.length})
                    </span>
                    {!isLocked && punches.length < 10 && (
                      <button
                        type="button"
                        onClick={handleAddPunch}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 hover:bg-primary/20"
                      >
                        <Plus size={11} /> Add Punch Slot ({punches.length}/10)
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                    {punches.map((p, idx) => {
                      const duration = getSlotDuration(p.inTime, p.outTime);
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-card-2 p-1.5 rounded-lg border border-line-soft">
                          <span className="text-[9px] font-bold text-ink-muted w-4 text-center shrink-0">#{idx + 1}</span>
                          <div className="flex-1">
                            <input
                              type="time"
                              disabled={isLocked}
                              value={p.inTime || ''}
                              onChange={e => handlePunchChange(idx, 'inTime', e.target.value)}
                              className="w-full bg-card border border-line-soft text-ink font-bold rounded-md px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                            />
                          </div>
                          <span className="text-ink-subtle font-bold text-xs">→</span>
                          <div className="flex-1">
                            <input
                              type="time"
                              disabled={isLocked}
                              value={p.outTime || ''}
                              onChange={e => handlePunchChange(idx, 'outTime', e.target.value)}
                              className="w-full bg-card border border-line-soft text-ink font-bold rounded-md px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                            />
                          </div>
                          {duration && (
                            <div className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 font-mono shrink-0">
                              {duration}
                            </div>
                          )}
                          {punches.length > 1 && !isLocked && (
                            <button
                              type="button"
                              onClick={() => handleRemovePunch(idx)}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors cursor-pointer shrink-0"
                              title="Remove session"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Lost Time & Deductions + Net Impact */}
              <div className="bg-card-2/40 border border-line-soft rounded-xl p-3.5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-line-soft/60 pb-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle size={14} className="text-red-400" />
                      <span className="text-[11px] font-bold text-ink uppercase tracking-wider">Lost Time & Deductions</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-red-400 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md">
                      Total: -₹{totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* 2 Deduction Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Late Entry */}
                    <div className="bg-card p-2.5 rounded-xl border border-line-soft space-y-1.5">
                      <span className="text-[10px] font-bold text-ink block truncate">Late Entry</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <span className="text-[8px] font-bold text-ink-muted uppercase block">Minutes</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={isLocked}
                            value={draftCell.lateMinutes || ''}
                            placeholder="0"
                            onChange={e => {
                              const val = Number(e.target.value) || 0;
                              setDraftCell(prev => ({ ...prev, lateMinutes: Math.max(0, val) }));
                              setIsDirty(true);
                            }}
                            className="w-full bg-card-2 border border-line-soft text-ink font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <span className="text-[8px] font-bold text-red-400 uppercase block">Deduction (₹)</span>
                          <div className="relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-red-400">-₹</span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              disabled={isLocked}
                              value={draftCell.lateDeduction !== undefined ? draftCell.lateDeduction : ''}
                              placeholder="0"
                              onChange={e => {
                                const amt = e.target.value === '' ? 0 : Number(e.target.value);
                                setDraftCell(prev => ({ ...prev, lateDeduction: Math.max(0, amt) }));
                                setIsDirty(true);
                              }}
                              className="w-full bg-card-2 border border-red-500/30 text-red-400 font-mono font-bold rounded-lg pl-6 pr-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Permission */}
                    <div className="bg-card p-2.5 rounded-xl border border-line-soft space-y-1.5">
                      <span className="text-[10px] font-bold text-ink block truncate">Permission</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <span className="text-[8px] font-bold text-ink-muted uppercase block">Minutes</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={isLocked}
                            value={draftCell.permissionMinutes || ''}
                            placeholder="0"
                            onChange={e => {
                              const val = Number(e.target.value) || 0;
                              setDraftCell(prev => ({ ...prev, permissionMinutes: Math.max(0, val) }));
                              setIsDirty(true);
                            }}
                            className="w-full bg-card-2 border border-line-soft text-ink font-bold rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <span className="text-[8px] font-bold text-red-400 uppercase block">Deduction (₹)</span>
                          <div className="relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-red-400">-₹</span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              disabled={isLocked}
                              value={draftCell.permissionDeduction !== undefined ? draftCell.permissionDeduction : ''}
                              placeholder="0"
                              onChange={e => {
                                const amt = e.target.value === '' ? 0 : Number(e.target.value);
                                setDraftCell(prev => ({ ...prev, permissionDeduction: Math.max(0, amt) }));
                                setIsDirty(true);
                              }}
                              className="w-full bg-card-2 border border-red-500/30 text-red-400 font-mono font-bold rounded-lg pl-6 pr-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Financial Net Summary Card */}
                <div className="bg-gradient-to-r from-blue-950/40 via-card to-indigo-950/40 border border-blue-500/25 rounded-xl p-3">
                  <div className="grid grid-cols-3 gap-2 text-center divide-x divide-line-soft">
                    <div className="px-1">
                      <span className="text-[9px] text-ink-subtle uppercase font-bold block">Earnings</span>
                      <span className="font-mono font-bold text-xs sm:text-sm text-emerald-400">+₹{totalEarnings.toFixed(2)}</span>
                    </div>
                    <div className="px-1">
                      <span className="text-[9px] text-ink-subtle uppercase font-bold block">Deductions</span>
                      <span className="font-mono font-bold text-xs sm:text-sm text-red-400">-₹{totalDeductions.toFixed(2)}</span>
                    </div>
                    <div className="px-1">
                      <span className="text-[9px] text-ink-subtle uppercase font-bold block">Net Adjustment</span>
                      <span className={`font-mono font-black text-xs sm:text-sm ${netImpact >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                        {netImpact >= 0 ? '+' : ''}₹{netImpact.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-card-2/70 border-t border-line-soft flex items-center justify-between gap-3">
          <span className="text-xs text-ink-muted hidden sm:inline">
            Amounts & punches entered here flow directly into payroll calculations.
          </span>
          <div className="flex items-center gap-2.5 ml-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-4 py-2 bg-card border border-line-soft text-ink hover:bg-card-2 rounded-xl font-semibold text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="px-6 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-sm hover:shadow-primary/20 flex items-center justify-center gap-1.5"
            >
              <Check size={14} />
              <span>{isLocked ? 'Close' : 'Done & Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Discard Changes Confirm Modal for Cell Modal */}
      <CommonConfirmModal
        isOpen={saveConfirmOpen}
        onClose={handleResume}
        onCancel={handleDiscard}
        onConfirm={handleSaveFromModal}
        title="Discard Changes?"
        message="Are you sure you want to discard your changes for this date?"
        warningText="Save to keep your changes, or Discard to leave."
        cancelText="Discard"
        cancelVariant="danger"
        confirmText="Save"
        confirmVariant="primary"
        confirmIcon={Check}
        isDangerous={false}
        defaultFocusCancel={false}
      />
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AttendancePage: React.FC = () => {
  const navigate  = useNavigate();
  const { can } = usePermission();
  const canEditAttendance = can("payroll-attendance.edit");
  const now       = new Date();

  // ── Period state ──────────────────────────────────────────────────────────
  const [runType,      setRunType]      = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY');
  const [month,        setMonth]        = useState(now.getMonth() + 1);
  const [year,         setYear]         = useState(now.getFullYear());
  const [weekOfMonth,  setWeekOfMonth]  = useState(1);   // 1-5, week within selected month
  const [fullMonthMode,setFullMonthMode]= useState(false); // show all days of month in WEEKLY view

  // ── Data state ────────────────────────────────────────────────────────────
  const [employees,    setEmployees]    = useState<ApiEmployeePayroll[]>([]);
  const [payrollCfg,   setPayrollCfg]   = useState<ApiPayrollConfig | null>(null);
  const [grid,         setGrid]         = useState<GridState>({});
  const [loading,      setLoading]      = useState(true);
  const [loadingAtt,   setLoadingAtt]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saveOk,       setSaveOk]       = useState(false);
  const [error,        setError]        = useState('');
  const [hasSavedData, setHasSavedData] = useState(false);
  const [lockedPeriods, setLockedPeriods] = useState<string[]>([]);
  const [shifts,        setShifts]       = useState<Shift[]>([]);

  // ── Unsaved / Discard modal state ─────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const [pageConfirmOpen, setPageConfirmOpen] = useState(false);
  const proceedRef = useRef<(() => void) | null>(null);
  const resetRef = useRef<(() => void) | null>(null);

  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const pageConfirmOpenRef = useRef(pageConfirmOpen);
  useEffect(() => { pageConfirmOpenRef.current = pageConfirmOpen; }, [pageConfirmOpen]);

  // ── Cell panel ────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<{ empId: number; empName: string; date: string } | null>(null);
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Block route navigation when grid is dirty and no cell modal is active
  useDirtyNavGuard(isDirty && !selected, (proceed, reset) => {
    proceedRef.current = proceed;
    resetRef.current = reset;
    setPageConfirmOpen(true);
  });

  const handleResumePage = useCallback(() => {
    setPageConfirmOpen(false);
    if (resetRef.current) {
      const r = resetRef.current;
      proceedRef.current = null;
      resetRef.current = null;
      r();
    }
  }, []);

  const handleDiscardPage = useCallback(() => {
    setPageConfirmOpen(false);
    setIsDirty(false);
    if (proceedRef.current) {
      const p = proceedRef.current;
      proceedRef.current = null;
      resetRef.current = null;
      p();
      return;
    }
    navigate(-1);
  }, [navigate]);

  // ── Derived: employees filtered by salary type ────────────────────────────
  const isWeeklyEmployee = (e: ApiEmployeePayroll) =>
    e.payrollConfig?.salaryType === 'DAILY_WEEKLY' ||
    e.payrollConfig?.salaryType === 'WEEKLY' ||
    e.salaryType === 'daily' ||
    e.salaryType === 'weekly';

  const filteredEmployees = useMemo((): ApiEmployeePayroll[] => {
    if (runType === 'MONTHLY') {
      // Monthly view: all employees EXCEPT daily/weekly wage
      return employees.filter(e => !isWeeklyEmployee(e));
    } else {
      // Weekly view: only daily/weekly wage employees
      return employees.filter(e => isWeeklyEmployee(e));
    }
  }, [employees, runType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived: weeks within the selected month ──────────────────────────────
  const monthWeeks = useMemo(() => weeksOfMonth(year, month), [year, month]);

  // ── Derived: active dates to display ─────────────────────────────────────
  const dates = useMemo(() => {
    if (runType === 'MONTHLY') return getMonthDates(year, month);
    if (fullMonthMode)         return getMonthDates(year, month); // all days, weekly employees
    const wk = monthWeeks.find(w => w.num === weekOfMonth) ?? monthWeeks[0];
    return wk?.dates ?? [];
  }, [runType, year, month, weekOfMonth, monthWeeks, fullMonthMode]);

  // ── Derived: period string (used for single-week save & load) ─────────────
  const period = useMemo(() => {
    if (runType === 'MONTHLY') return `${year}-${String(month).padStart(2,'0')}`;
    if (fullMonthMode)         return `${year}-${String(month).padStart(2,'0')}`; // date-range query
    const wk = monthWeeks.find(w => w.num === weekOfMonth) ?? monthWeeks[0];
    return wk?.period ?? `${year}-W01`;
  }, [runType, year, month, weekOfMonth, monthWeeks, fullMonthMode]);

  const weeklyOffDays: number[] = payrollCfg?.weeklyOffDays ?? [];

  // Helper to check if a date is locked by an approved/locked payroll run
  // Only check locks matching the current run type so a weekly lock doesn't block monthly editing and vice-versa
  const isDateLocked = useCallback((dateStr: string): boolean => {
    if (lockedPeriods.length === 0) return false;
    if (runType === 'MONTHLY') {
      const monthP = dateStr.slice(0, 7);
      return lockedPeriods.includes(monthP);
    }
    const weekP = isoPeriod(dateStr);
    return lockedPeriods.includes(weekP);
  }, [lockedPeriods, runType]);

  const allDatesLocked = useMemo(() => dates.length > 0 && dates.every(d => isDateLocked(d)), [dates, isDateLocked]);
  const someDatesLocked = useMemo(() => dates.some(d => isDateLocked(d)), [dates, isDateLocked]);

  // ── Load employees + config + shifts ───────────────────────────────────────
  useEffect(() => {
    Promise.all([payrollService.listEmployees({ period }), payrollService.getConfig(), shiftService.fetchAll()])
      .then(([emps, cfg, allShifts]) => {
        setEmployees(emps);
        setPayrollCfg(cfg);
        const shiftList: Shift[] = Array.isArray(allShifts) ? allShifts : (allShifts?.data || []);
        setShifts(shiftList.filter((s: Shift) => s.isActive));
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, [period]);

  // ── Rebuild grid when dates / filtered employees change ───────────────────
  useEffect(() => {
    if (filteredEmployees.length === 0) return;
    setGrid(prev => {
      const next: GridState = {};
      filteredEmployees.forEach(emp => {
        dates.forEach(date => {
          const k = cellKey(Number(emp.id), date);
          const isSun = dayOfWeek(date) === 0 || weeklyOffDays.includes(dayOfWeek(date));
          if (prev[k]) {
            next[k] = prev[k];
          } else {
            next[k] = { ...EMPTY_CELL, status: isSun ? 'HOLIDAY' : null };
          }
        });
      });
      return next;
    });
    setHasSavedData(false);
    setSaveOk(false);
  }, [dates, filteredEmployees, weeklyOffDays]);

  // ── Reset weekOfMonth to 1 when month/year changes ───────────────────────
  useEffect(() => { setWeekOfMonth(1); }, [month, year]);

  // ── Load saved attendance from API ────────────────────────────────────────
  const loadSaved = useCallback(async () => {
    setLoadingAtt(true); setSaveOk(false); setError('');
    try {
      const records: any[] = await payrollService.getAttendance(period);
      if (records.length > 0) {
        setGrid(prev => {
          const next = { ...prev };
          records.forEach(r => {
            const k = cellKey(Number(r.employeeId), r.date);
            if (k in next) {
              next[k] = {
                status:            r.status as AttStatus,
                inTime:            r.inTime ?? null,
                outTime:           r.outTime ?? null,
                otHours:           Number(r.otHours || 0),
                otAmount:          Number(r.otAmount || 0),
                otDays:            Number(r.otDays || 0),
                otDaysAmount:      Number(r.otDaysAmount || 0),
                teaOtCount:        Number(r.teaOtCount || 0),
                teaOtAmount:       Number(r.teaOtAmount || 0),
                lateMinutes:       Number(r.lateMinutes || 0),
                lateDeduction:     Number(r.lateDeduction || 0),
                permissionMinutes: Number(r.permissionMinutes || 0),
                permissionDeduction: Number(r.permissionDeduction || 0),
                shiftId:           r.shiftId ?? null,
              };
            }
          });
          return next;
        });
        setHasSavedData(true);
      } else {
        setHasSavedData(false);
      }
      setIsDirty(false);

      // Check if period or month is locked/approved
      try {
        const monthQuery = `${year}-${String(month).padStart(2,'0')}`;
        const runRes = await payrollService.listRuns({ period: monthQuery });
        const lockedList = runRes.runs
          .filter(r => r.status === 'APPROVED' || r.status === 'LOCKED')
          .map(r => r.period);
        setLockedPeriods(lockedList);
      } catch {
        setLockedPeriods([]);
      }
    } catch {
      // No saved records is fine
    } finally {
      setLoadingAtt(false);
    }
  }, [period, year, month]);

  useEffect(() => {
    if (!loading) loadSaved();
  }, [period, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cell helpers ──────────────────────────────────────────────────────────
  const getCell = (empId: number, date: string): CellData =>
    grid[cellKey(empId, date)] ?? EMPTY_CELL;

  const setCell = (empId: number, date: string, data: CellData) => {
    if (isDateLocked(date)) return;
    setGrid(prev => ({ ...prev, [cellKey(empId, date)]: data }));
    setIsDirty(true);
    setSaveOk(false);
  };

  const cycleCell = (empId: number, date: string) => {
    if (isDateLocked(date)) return;
    const cur = getCell(empId, date);
    const nextStatus = cycleStatus(cur.status);
    const emp = employees.find(e => Number(e.id) === empId);
    const defaultShift = getEmployeeDefaultShift(emp, shifts);
    const assignedShiftId = cur.shiftId ?? (nextStatus ? defaultShift?.id ?? null : null);
    const defaultIn = (!cur.inTime && nextStatus && defaultShift?.startTime) ? defaultShift.startTime : cur.inTime;
    const defaultOut = (!cur.outTime && nextStatus && defaultShift?.endTime) ? defaultShift.endTime : cur.outTime;
    setCell(empId, date, {
      ...cur,
      status: nextStatus,
      shiftId: assignedShiftId,
      inTime: defaultIn,
      outTime: defaultOut,
    });
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const applyCompanySchedule = () => {
    setGrid(prev => {
      const next = { ...prev };
      filteredEmployees.forEach(emp => {
        const defaultShift = getEmployeeDefaultShift(emp, shifts);
        dates.forEach(date => {
          if (!isDateLocked(date)) {
            const k = cellKey(Number(emp.id), date);
            const isOff = dayOfWeek(date) === 0 || weeklyOffDays.includes(dayOfWeek(date));
            const existing = next[k] ?? EMPTY_CELL;
            next[k] = {
              ...existing,
              status: isOff ? 'HOLIDAY' : 'PRESENT',
              shiftId: existing.shiftId ?? (!isOff ? defaultShift?.id ?? null : null),
              inTime: existing.inTime ?? (!isOff ? defaultShift?.startTime ?? null : null),
              outTime: existing.outTime ?? (!isOff ? defaultShift?.endTime ?? null : null),
            };
          }
        });
      });
      return next;
    });
    setIsDirty(true);
    setSaveOk(false);
  };

  const clearAll = () => {
    setGrid(prev => {
      const next = { ...prev };
      filteredEmployees.forEach(emp => {
        dates.forEach(date => {
          if (!isDateLocked(date)) {
            const k = cellKey(Number(emp.id), date);
            const isOff = dayOfWeek(date) === 0 || weeklyOffDays.includes(dayOfWeek(date));
            next[k] = { ...EMPTY_CELL, status: isOff ? 'HOLIDAY' : null };
          }
        });
      });
      return next;
    });
    setIsDirty(true);
    setSaveOk(false);
  };

  const markEmployeeRow = (empId: number, status: AttStatus) => {
    setGrid(prev => {
      const next = { ...prev };
      dates.forEach(date => {
        if (!isDateLocked(date)) {
          const k = cellKey(empId, date);
          const isOff = dayOfWeek(date) === 0 || weeklyOffDays.includes(dayOfWeek(date));
          if (status === 'PRESENT' && isOff) {
            next[k] = { ...(next[k] ?? EMPTY_CELL), status: 'HOLIDAY' };
          } else {
            next[k] = { ...(next[k] ?? EMPTY_CELL), status };
          }
        }
      });
      return next;
    });
    setIsDirty(true);
    setSaveOk(false);
  };

  // ── Build records for a given set of dates / period ───────────────────────
  const buildRecords = (empList: ApiEmployeePayroll[], dayList: string[], p: string) =>
    empList.flatMap(emp =>
      dayList.map(date => {
        if (isDateLocked(date)) return null;
        const c = getCell(Number(emp.id), date);
        if (!c.status) return null;
        return {
          employeeId:        Number(emp.id),
          date,
          status:            c.status,
          inTime:            c.inTime ?? null,
          outTime:           c.outTime ?? null,
          otHours:           c.otHours,
          otAmount:          c.otAmount ?? 0,
          otDays:            c.otDays,
          otDaysAmount:      c.otDaysAmount ?? 0,
          teaOtCount:        c.teaOtCount,
          teaOtAmount:       c.teaOtAmount ?? 0,
          lateMinutes:       c.lateMinutes,
          lateDeduction:     c.lateDeduction ?? 0,
          permissionMinutes: c.permissionMinutes,
          permissionDeduction: c.permissionDeduction ?? 0,
          salaryAdvance:     0,
          shiftId:           c.shiftId,
        };
      }).filter((x): x is NonNullable<typeof x> => x !== null)
    ).map(r => ({ ...r, _period: p })); // carry period for multi-save

  // ── Build list of cleared (null status) cells to delete from DB ─────────
  const buildClearedDates = (empList: ApiEmployeePayroll[], dayList: string[]) =>
    empList.flatMap(emp =>
      dayList.filter(date => !isDateLocked(date) && !getCell(Number(emp.id), date).status)
        .map(date => ({ employeeId: Number(emp.id), date }))
    );

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (): Promise<boolean> => {
    setSaving(true); setError(''); setSaveOk(false);
    try {
      if (allDatesLocked) {
        setError('Cannot save attendance. Payroll for this period has already been approved or locked.');
        return false;
      }

      // Collect cleared cells to delete from DB
      const clearedDates = buildClearedDates(filteredEmployees, dates.filter(d => !isDateLocked(d)));

      if (runType === 'WEEKLY' && fullMonthMode) {
        // ── Full-month save for weekly employees ─────────────────────────
        const weekGroups = new Map<string, string[]>();
        dates.forEach(date => {
          if (!isDateLocked(date)) {
            const wp = isoPeriod(date);
            if (!weekGroups.has(wp)) weekGroups.set(wp, []);
            weekGroups.get(wp)!.push(date);
          }
        });

        let totalSaved = 0;
        for (const [wp, wDates] of weekGroups) {
          const records = buildRecords(filteredEmployees, wDates, wp);
          if (records.length > 0) {
            await payrollService.bulkUpsertAttendance(wp, records as any, clearedDates);
            totalSaved += records.length;
          }
        }
        if (totalSaved === 0 && clearedDates.length === 0) { setError('No editable attendance data to save. Mark at least one unlocked cell.'); return false; }
        if (totalSaved === 0 && clearedDates.length > 0) {
          // Only clearing — still need to send the delete request
          await payrollService.bulkUpsertAttendance(period, [], clearedDates);
        }
        setSaveOk(true); setHasSavedData(true); setIsDirty(false);
        return true;
      } else {
        // ── Normal single-period save ─────────────────────────────────────
        const editableDates = dates.filter(d => !isDateLocked(d));
        const records = buildRecords(filteredEmployees, editableDates, period);
        if (records.length === 0 && clearedDates.length === 0) { setError('No editable attendance data to save. Mark at least one unlocked cell.'); return false; }
        await payrollService.bulkUpsertAttendance(period, records as any, clearedDates);
        setSaveOk(true); setHasSavedData(true); setIsDirty(false);
        return true;
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save attendance');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── Summary per employee ──────────────────────────────────────────────────
  const summary = (empId: number) => {
    let P = 0, A = 0, HD = 0, H = 0, OT = 0, Late = 0;
    dates.forEach(date => {
      const c = getCell(empId, date);
      if (c.status === 'PRESENT' || c.status === 'LEAVE_PAID') P++;
      if (c.status === 'ABSENT' || c.status === 'LEAVE_UNPAID')  A++;
      if (c.status === 'HALF_DAY')   HD++;
      if (c.status === 'HOLIDAY' || c.status === 'WEEKLY_OFF') H++;
      OT   += c.otHours;
      Late += c.lateMinutes;
    });
    return { P, A, HD, H, OT, Late };
  };

  const totalMarked = useMemo(() => {
    let count = 0;
    filteredEmployees.forEach(emp => {
      dates.forEach(date => {
        if (getCell(Number(emp.id), date).status !== null) count++;
      });
    });
    return count;
  }, [grid, filteredEmployees, dates]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalMarkedRef = useRef(totalMarked);
  useEffect(() => { totalMarkedRef.current = totalMarked; }, [totalMarked]);

  const handleSaveFromPageModal = useCallback(async () => {
    setPageConfirmOpen(false);
    const success = await handleSave();
    if (success) {
      if (proceedRef.current) {
        const p = proceedRef.current;
        proceedRef.current = null;
        resetRef.current = null;
        p();
      } else {
        navigate(-1);
      }
    }
  }, [handleSave, navigate]);

  const handleBack = useCallback(() => {
    if (isDirty || totalMarked > 0) {
      setPageConfirmOpen(true);
    } else {
      navigate(-1);
    }
  }, [isDirty, totalMarked, navigate]);

  // Esc anywhere on the page (when no cell modal is active)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedRef.current) return;
      if (document.querySelector('[data-select-portal]')) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (pageConfirmOpenRef.current) {
        handleResumePage();
      } else if (isDirtyRef.current || totalMarkedRef.current > 0) {
        setTimeout(() => setPageConfirmOpen(true), 0);
      } else {
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handleEsc, { capture: true });
    return () => window.removeEventListener('keydown', handleEsc, { capture: true });
  }, [handleResumePage, navigate]);

  const totalCells = filteredEmployees.length * dates.length;

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <CommonLoader text="Loading employees and payroll settings…" />;

  return (
    <div data-escape-guarded className="min-h-screen bg-page flex flex-col">

      {/* ── Header ── */}
      <div className="bg-card border-b border-line-soft px-6 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer">
              <ArrowLeft size={16} /> Back
            </button>
            <div className="w-px h-5 bg-line-soft" />
            <div>
              <h1 className="text-xl font-bold text-ink">Attendance Entry</h1>
              <p className="text-xs text-ink-muted mt-0.5">
                {period} · {filteredEmployees.length} employees
                {totalCells > 0 && (
                  <span className="ml-2 text-ink-subtle">· {totalMarked}/{totalCells} cells marked</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadSaved} disabled={loadingAtt}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-line-soft text-ink-muted rounded-lg hover:bg-card-2 transition-colors disabled:opacity-50">
              <RefreshCw size={14} className={loadingAtt ? 'animate-spin' : ''} />
              Load Saved
            </button>
            <button onClick={() => navigate(`/payroll/run?type=${runType === 'MONTHLY' ? 'monthly' : 'weekly'}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors">
              <PlayCircle size={14} /> Run Payroll
            </button>
            {canEditAttendance && (
              <button onClick={handleSave} disabled={saving || allDatesLocked}
                className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving…' : runType === 'WEEKLY' && fullMonthMode ? 'Save Full Month' : 'Save Attendance'}
              </button>
            )}
          </div>
        </div>

        {allDatesLocked ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-medium">
            <Lock size={14} className="text-red-400 shrink-0" />
            <span>Attendance for <strong>{period}</strong> is LOCKED because payroll has been approved or locked. Attendance cannot be edited for this period.</span>
          </div>
        ) : someDatesLocked ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 font-medium">
            <Lock size={14} className="text-amber-400 shrink-0" />
            <span>Some period(s) in this view (<strong>{lockedPeriods.join(', ')}</strong>) are locked (payroll approved). Locked dates cannot be edited, but unlocked dates remain editable.</span>
          </div>
        ) : null}

        {saveOk && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            <CheckCircle2 size={13} />
            Attendance saved for <strong className="ml-1">{period}</strong>.
            {runType === 'WEEKLY' && fullMonthMode && ' (Split across weekly periods automatically.)'}
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={13} /> {error}
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="bg-card-2 border-b border-line-soft px-6 py-3 flex flex-wrap items-center gap-3">

        {/* Period type toggle */}
        <div className="flex gap-1 bg-card rounded-lg p-1 border border-line-soft">
          {(['MONTHLY','WEEKLY'] as const).map(t => (
            <button key={t} onClick={() => { setRunType(t); setFullMonthMode(false); setSaveOk(false); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                runType === t ? 'bg-card-2 shadow-xs text-primary font-bold' : 'text-ink-muted hover:text-ink'
              }`}>
              {t === 'MONTHLY' ? 'Monthly' : 'Weekly'}
            </button>
          ))}
        </div>

        {/* Month + Year (both modes share these) */}
        <div className="flex items-center gap-2">
          <div className="w-36">
            <SelectInput
              name="month"
              value={String(month)}
              options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
              noMargin
              onChange={e => setMonth(Number(e.target.value))}
            />
          </div>
          <div className="w-28">
            <SelectInput
              name="year"
              value={String(year)}
              options={[2024, 2025, 2026, 2027].map(y => ({ value: String(y), label: String(y) }))}
              noMargin
              onChange={e => setYear(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Weekly-only: week picker + full-month toggle */}
        {runType === 'WEEKLY' && (
          <>
            {/* Week of month dropdown */}
            {!fullMonthMode && (
              <div className="w-52">
                <SelectInput
                  name="weekOfMonth"
                  value={String(weekOfMonth)}
                  options={monthWeeks.map(w => ({ value: String(w.num), label: w.label }))}
                  noMargin
                  onChange={e => setWeekOfMonth(Number(e.target.value))}
                />
              </div>
            )}

            {/* Full month toggle button */}
            <button
              onClick={() => { setFullMonthMode(f => !f); setSaveOk(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                fullMonthMode
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-ink-muted border-line-soft hover:bg-card-2'
              }`}
            >
              <CalendarDays size={13} />
              {fullMonthMode ? 'Full Month ON' : 'Full Month'}
            </button>

            {fullMonthMode && (
              <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                Showing all {dates.length} days · Save splits into {monthWeeks.length} weekly periods automatically
              </span>
            )}
          </>
        )}

        <div className="w-px h-5 bg-line-soft" />

        <button onClick={applyCompanySchedule} disabled={allDatesLocked}
          className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          Auto-Fill Schedule
        </button>

        <button onClick={clearAll} disabled={allDatesLocked}
          className="text-xs font-semibold text-ink-muted bg-card border border-line-soft px-3 py-1.5 rounded-lg hover:bg-card-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          Clear All
        </button>
      </div>

      {/* ── Info banners ── */}
      {hasSavedData && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-6 py-2 flex items-center gap-2 text-xs text-blue-400">
          <Info size={13} />
          Showing saved attendance for <strong className="mx-1">{period}</strong>.
          Changes will overwrite on next save.
        </div>
      )}

      {/* ── Legend ── */}
      <div className="bg-card border-b border-line-soft px-6 py-2 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Legend:</span>
        {STATUSES.map(st => (
          <div key={st} className="flex items-center gap-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${S[st].cell}`}>{S[st].abbr}</span>
            <span className="text-[10px] text-ink-muted">{S[st].label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-card-2 text-ink-muted border border-line-soft">—</span>
          <span className="text-[10px] text-ink-subtle">Unset (not counted)</span>
        </div>
        <div className="flex items-center gap-1 ml-2 border-l border-line-soft pl-3">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-card-2 text-ink-muted border border-line-soft inline-flex items-center gap-0.5">
            <Lock size={9} /> Lock
          </span>
          <span className="text-[10px] text-ink-subtle">Payroll Approved</span>
        </div>
        <div className="ml-auto text-[10px] text-ink-subtle">
          Left-click = cycle · Right-click = OT / Late / Perm
        </div>
      </div>

      {/* ── Week divider labels in full-month mode ── */}
      {runType === 'WEEKLY' && fullMonthMode && (
        <div className="bg-card-2 border-b border-line-soft px-6 py-2 flex flex-wrap gap-2">
          {monthWeeks.map(w => {
            const isWkLocked = lockedPeriods.includes(w.period) || lockedPeriods.includes(`${year}-${String(month).padStart(2,'0')}`);
            return (
              <span key={w.num}
                className={`inline-flex items-center gap-1 text-[10px] font-semibold border rounded-md px-2 py-0.5 ${
                  isWkLocked ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-card text-ink-muted border-line-soft'
                }`}>
                <span className="w-3 h-3 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[8px] font-bold">{w.num}</span>
                {w.label.replace(`Week ${w.num}  `, '')} → <span className="text-primary font-bold">{w.period}</span>
                {isWkLocked && <Lock size={10} className="text-amber-400 ml-0.5" />}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Grid ── */}
      <div className="flex-1 p-4 overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-ink-subtle">
            <Users size={36} className="mb-3 opacity-30" />
            <p className="text-sm">
              {employees.length === 0
                ? 'No employees found.'
                : runType === 'MONTHLY'
                  ? 'No monthly employees found. Switch to Weekly tab for daily-wage employees.'
                  : 'No daily-wage (DAILY_WEEKLY) employees found. Switch to Monthly tab for monthly employees.'}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-line-soft shadow-xs overflow-hidden h-full">
            <div className="overflow-auto h-full">
              <table className="text-xs border-collapse" style={{ minWidth: `${250 + dates.length * 38 + 200}px` }}>

                {/* THEAD */}
                <thead className="sticky top-0 z-20">
                  <tr className="bg-card-2">
                    <th className="sticky left-0 z-30 bg-card-2 text-left px-4 py-2.5 font-bold text-ink uppercase tracking-wider border-b border-r border-line-soft shadow-[4px_0_10px_-2px_rgba(0,0,0,0.12)] w-[250px] min-w-[250px] max-w-[250px]">
                      Employee
                    </th>
                    {dates.map((date, idx) => {
                      const day  = parseInt(date.split('-')[2], 10);
                      const dow  = dayOfWeek(date);
                      const isOff = weeklyOffDays.includes(dow);
                      const isSun = dow === 0;
                      const isWeekStart = fullMonthMode && runType === 'WEEKLY' && (day === 8 || day === 15 || day === 22 || day === 29);
                      const locked = isDateLocked(date);
                      return (
                        <th key={date}
                          className={`px-0 py-2 text-center font-semibold border-b border-r border-line-soft ${
                            isWeekStart ? 'border-l-2 border-l-primary/40' : ''
                          } ${locked ? 'bg-card-2' : isOff ? (isSun ? 'bg-red-500/10' : 'bg-amber-500/10') : 'bg-card-2'}`}
                          style={{ width: 38, minWidth: 38 }}
                          title={locked ? 'Payroll Approved/Locked' : isWeekStart ? `Week ${Math.ceil(day / 7)} starts` : undefined}
                        >
                          <div className={`text-[11px] font-bold flex items-center justify-center gap-0.5 ${locked ? 'text-ink-subtle' : isOff ? (isSun ? 'text-red-400' : 'text-amber-400') : 'text-ink'}`}>
                            {day}
                            {locked && <Lock size={8} className="text-ink-subtle" />}
                          </div>
                          <div className={`text-[9px] ${locked ? 'text-ink-subtle' : isOff ? (isSun ? 'text-red-400/80' : 'text-amber-400/80') : 'text-ink-subtle'}`}>{DAY_ABBR[dow]}</div>
                          {isWeekStart && <div className="text-[8px] text-primary font-bold">W{Math.ceil(day/7)}</div>}
                        </th>
                      );
                    })}
                    {/* Summary */}
                    <th className="px-2 py-2 text-center font-bold text-emerald-400 bg-emerald-500/10 border-b border-r border-line-soft">P</th>
                    <th className="px-2 py-2 text-center font-bold text-red-400 bg-red-500/10 border-b border-r border-line-soft">A</th>
                    <th className="px-2 py-2 text-center font-bold text-amber-400 bg-amber-500/10 border-b border-r border-line-soft">HD</th>
                    <th className="px-2 py-2 text-center font-bold text-blue-400 bg-blue-500/10 border-b border-r border-line-soft">H</th>
                    <th className="px-2 py-2 text-center font-semibold text-ink-subtle bg-card-2 border-b border-r border-line-soft whitespace-nowrap">OT m</th>
                    <th className="px-2 py-2 text-center font-semibold text-ink-subtle bg-card-2 border-b border-line-soft whitespace-nowrap">Late</th>
                  </tr>
                </thead>

                {/* TBODY */}
                <tbody>
                  {filteredEmployees.map((emp, idx) => {
                    const empId = Number(emp.id);
                    const sum   = summary(empId);
                    const isEven = idx % 2 === 0;
                    const solidBg = isEven ? 'bg-card' : 'bg-card-2';
                    return (
                      <tr key={emp.id} className={`${solidBg} hover:bg-primary/5 transition-colors`}>

                        {/* Employee sticky col */}
                        <td className={`sticky left-0 z-20 px-3 py-1.5 border-b border-r border-line-soft shadow-[4px_0_10px_-2px_rgba(0,0,0,0.12)] w-[250px] min-w-[250px] max-w-[250px] ${solidBg}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 pr-1">
                              <p className="font-semibold text-ink text-xs truncate flex items-center gap-1.5">
                                <span>{emp.fullName}</span>
                                {(emp as any).status === 'inactive' && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded">Inactive</span>
                                )}
                              </p>
                              <p className="text-[10px] text-ink-subtle">{emp.empCode} · {(emp.payrollConfig?.salaryType ?? '—').replace(/_/g,' ')}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => markEmployeeRow(empId, 'PRESENT')} title="All Present" disabled={allDatesLocked}
                                className="w-5 h-5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">P</button>
                              <button onClick={() => markEmployeeRow(empId, 'ABSENT')} title="All Absent" disabled={allDatesLocked}
                                className="w-5 h-5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">A</button>
                            </div>
                          </div>
                        </td>

                        {/* Status cells */}
                        {dates.map(date => {
                          const cell = getCell(empId, date);
                          const isCompanyOff = weeklyOffDays.includes(dayOfWeek(date));
                          const day = parseInt(date.split('-')[2], 10);
                          const isWeekStart = fullMonthMode && runType === 'WEEKLY' && (day === 8 || day === 15 || day === 22 || day === 29);
                          const locked = isDateLocked(date);
                          return (
                            <td key={date}
                              className={`px-0.5 py-0.5 border-b border-r border-line-soft text-center ${
                                isWeekStart ? 'border-l-2 border-l-primary/30' : ''
                              } ${locked ? 'bg-card-2/80' : isCompanyOff && !cell.status ? 'bg-card-2/40' : ''}`}>
                              <StatusCell
                                cell={cell}
                                isLocked={locked}
                                onClick={() => setSelected({ empId, empName: emp.fullName, date })}
                                onContextMenu={e => { e.preventDefault(); setSelected({ empId, empName: emp.fullName, date }); }}
                              />
                            </td>
                          );
                        })}

                        {/* Summary */}
                        <td className="px-2 py-1.5 text-center font-bold text-emerald-400 border-b border-r border-line-soft">{sum.P  > 0 ? sum.P  : '—'}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-red-400   border-b border-r border-line-soft">{sum.A  > 0 ? sum.A  : '—'}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-amber-400 border-b border-r border-line-soft">{sum.HD > 0 ? sum.HD : '—'}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-blue-400  border-b border-r border-line-soft">{sum.H  > 0 ? sum.H  : '—'}</td>
                        <td className="px-2 py-1.5 text-center text-ink-subtle border-b border-r border-line-soft">{sum.OT > 0 ? `${Math.round(sum.OT * 60)}m` : '—'}</td>
                        <td className="px-2 py-1.5 text-center text-text-secondary border-b border-line-soft">{sum.Late > 0 ? `${sum.Late}m` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Cell Edit Panel ── */}
      {selected && (
        <CellEditPanel
          emp={employees.find(e => Number(e.id) === selected.empId)}
          empName={selected.empName}
          date={selected.date}
          cell={getCell(selected.empId, selected.date)}
          isLocked={isDateLocked(selected.date)}
          shifts={shifts}
          weeklyOffDays={weeklyOffDays}
          payrollCfg={payrollCfg}
          calendarDays={dates.length}
          onChange={c => setCell(selected.empId, selected.date, c)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* ── Page-level Discard / Save Changes Modal ── */}
      <CommonConfirmModal
        isOpen={pageConfirmOpen}
        onClose={handleResumePage}
        onCancel={handleDiscardPage}
        onConfirm={handleSaveFromPageModal}
        title="Discard Changes?"
        message="Are you sure you want to leave? Any unsaved attendance entries will be lost."
        warningText="Save to keep your changes, or Discard to leave."
        cancelText="Discard"
        cancelVariant="danger"
        confirmText="Save"
        confirmVariant="primary"
        confirmIcon={Save}
        isDangerous={false}
        defaultFocusCancel={false}
      />
    </div>
  );
};

export default AttendancePage;
