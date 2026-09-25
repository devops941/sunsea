import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarRange, CalendarDays, PlayCircle, Eye, CheckCircle2, Lock,
  ChevronRight, ChevronLeft, AlertTriangle,
  IndianRupee, FileText, Download, X, Check,
  Building2, Wallet, TrendingUp, Info, Loader2, ClipboardList, Users
} from 'lucide-react';
import { useSocket } from '../../../providers/SocketProvider';
import { usePermission } from '../../../hooks/usePermission';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import Button from '../../../components/ui/Button/Button';
import { payrollService } from '../../../services/payrollService';
import type { ApiPayrollRun, ApiEmployeePayroll, AttendanceInput, ApiPayrollResult } from '../../../services/payrollService';
import DataTable, { type DataTableColumn } from '../../../components/ui/table/DataTable';
import { formatPeriod } from '../../../utils/dateUtils';

// ─── Steps ───────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Select Period', icon: CalendarRange },
  { id: 2, label: 'Review Attendance', icon: ClipboardList },
  { id: 3, label: 'Calculate & Preview', icon: Eye },
  { id: 4, label: 'Approve', icon: CheckCircle2 },
  { id: 5, label: 'Lock & Disburse', icon: Lock },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmt = (n: number) => n.toLocaleString('en-IN');
const fmtRs = (n: number) => `₹${fmt(Math.round(Number(n)))}`;
const fmtDec = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Date Helpers ─────────────────────────────────────────────────────────────
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getISOWeekInfo(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

interface WeekOption {
  weekOfMonth: number;
  startDay: number;
  endDay: number;
  startDate: string;
  endDate: string;
  isoWeek: number;
  isoYear: number;
  label: string;
}

function getWeeksOfMonth(year: number, month: number): WeekOption[] {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

  const firstDow = firstDayOfMonth.getDay() || 7; // Mon=1 ... Sun=7
  const firstMonday = new Date(firstDayOfMonth);
  firstMonday.setDate(firstDayOfMonth.getDate() - (firstDow - 1));

  const opts: WeekOption[] = [];
  let currentMonday = new Date(firstMonday);
  let weekOfMonth = 1;

  while (currentMonday <= lastDayOfMonth) {
    const sun = new Date(currentMonday);
    sun.setDate(currentMonday.getDate() + 6);

    const { week: isoWeek, year: isoYear } = getISOWeekInfo(currentMonday);
    const startFmt = `${MONTHS_SHORT[currentMonday.getMonth()]} ${currentMonday.getDate()}`;
    const endFmt = `${MONTHS_SHORT[sun.getMonth()]} ${sun.getDate()}`;

    opts.push({
      weekOfMonth,
      startDay: currentMonday.getDate(),
      endDay: sun.getDate(),
      startDate: currentMonday.toISOString().split('T')[0],
      endDate: sun.toISOString().split('T')[0],
      isoWeek,
      isoYear,
      label: `Week ${weekOfMonth} (${startFmt} – ${endFmt})`,
    });

    currentMonday.setDate(currentMonday.getDate() + 7);
    weekOfMonth++;
  }

  return opts;
}

type SalaryCategory = 'ALL' | 'FIXED_MONTHLY' | 'PF_MONTHLY' | 'CASH_MONTHLY' | 'DAILY_WEEKLY' | 'WEEKLY';

const CATEGORIES: { value: SalaryCategory; label: string }[] = [
  { value: 'ALL', label: 'All Employees' },
  { value: 'FIXED_MONTHLY', label: 'Fixed Monthly (Admin)' },
  { value: 'PF_MONTHLY', label: 'PF Workers (Monthly)' },
  { value: 'CASH_MONTHLY', label: 'Cash Monthly' },
  { value: 'DAILY_WEEKLY', label: 'Daily Wage (Weekly)' },
  { value: 'WEEKLY', label: 'Weekly Salary' },
];

// ─── Stepper ──────────────────────────────────────────────────────────────────
const StepHeader: React.FC<{ current: number }> = ({ current }) => (
  <div className="bg-card border-b border-line-soft px-6 py-4">
    <div className="flex items-center max-w-4xl mx-auto">
      {STEPS.map((step, idx) => {
        const done = current > step.id;
        const active = current === step.id;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 font-bold text-sm transition-all ${done ? 'bg-emerald-500 border-emerald-500 text-white' :
                active ? 'bg-primary border-primary text-white shadow-md' :
                  'bg-card-2 border-line-soft text-ink-subtle'
                }`}>
                {done ? <Check size={16} /> : <step.icon size={14} />}
              </div>
              <span className={`mt-1.5 text-[10px] font-semibold text-center leading-tight whitespace-nowrap ${active ? 'text-primary' : done ? 'text-emerald-500' : 'text-ink-subtle'
                }`}>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 transition-colors ${done ? 'bg-emerald-500' : 'bg-line-soft'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);

// ─── Step 1: Select Period ────────────────────────────────────────────────────
interface Step1Props {
  runType: 'WEEKLY' | 'MONTHLY'; setRunType: (t: 'WEEKLY' | 'MONTHLY') => void;
  month: number; setMonth: (m: number) => void;
  year: number; setYear: (y: number) => void;
  weekMonth: number; setWeekMonth: (m: number) => void;
  weekOfMonth: number; setWeekOfMonth: (w: number) => void;
  category: SalaryCategory; setCategory: (c: SalaryCategory) => void;
  calDays: number;
  employees: ApiEmployeePayroll[];
  loading: boolean;
  onNext: () => void;
  attValidationError?: { employees: { name: string; code: string; entered: number; expected: number }[] } | null;
}

const Step1: React.FC<Step1Props> = ({
  runType, setRunType, month, setMonth, year, setYear,
  weekMonth, setWeekMonth, weekOfMonth, setWeekOfMonth,
  category, setCategory, calDays,
  employees, loading, onNext, attValidationError,
}) => {
  // Filter employees strictly by selected Payroll Type (MONTHLY vs WEEKLY)
  const isWeeklyEmployee = (e: any) =>
    e.payrollConfig?.salaryType === 'DAILY_WEEKLY' || e.payrollConfig?.salaryType === 'WEEKLY' || e.salaryType === 'daily' || e.salaryType === 'weekly';

  const typeFiltered = employees.filter(e =>
    runType === 'WEEKLY' ? isWeeklyEmployee(e) : !isWeeklyEmployee(e)
  );

  const base = category === 'ALL'
    ? typeFiltered
    : typeFiltered.filter(e => e.payrollConfig?.salaryType === category);

  const filtered = base;
  const noConfig = 0;

  // For weekly: compute available weeks for selected month
  const weekOptions = runType === 'WEEKLY' ? getWeeksOfMonth(year, weekMonth) : [];
  const selectedWeek = weekOptions.find(w => w.weekOfMonth === weekOfMonth) ?? weekOptions[0];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center sm:text-left">
        <h2 className="text-xl font-extrabold text-ink tracking-tight">Select Payroll Period</h2>
        <p className="text-sm text-ink-muted mt-1">Choose the period type and timeline for this payroll run.</p>
      </div>

      {/* Payroll Type & Period Schedule Card */}
      <div className="bg-card rounded-2xl border border-line-soft shadow-xs hover:shadow-md transition-shadow p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-line-soft pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <CalendarRange size={18} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Payroll Schedule</h3>
              <p className="text-sm font-semibold text-ink">Frequency & Timeline</p>
            </div>
          </div>
        </div>

        {/* Type toggle buttons */}
        <div className="grid grid-cols-2 gap-3 p-1.5 bg-card-2 rounded-xl border border-line-soft">
          {(['MONTHLY', 'WEEKLY'] as const).map(t => {
            const isActive = runType === t;
            return (
              <button
                key={t}
                onClick={() => setRunType(t)}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-200 cursor-pointer ${isActive
                  ? 'bg-primary text-white shadow-sm shadow-primary/30 scale-[1.01]'
                  : 'text-ink-muted hover:text-ink hover:bg-card/60'
                  }`}
              >
                {t === 'MONTHLY'
                  ? <><CalendarRange size={16} /> Monthly Payroll</>
                  : <><CalendarDays size={16} /> Weekly Payroll</>}
              </button>
            );
          })}
        </div>

        {runType === 'MONTHLY' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-subtle uppercase tracking-wider mb-1.5">Select Month</label>
                <select
                  value={month}
                  onChange={e => setMonth(Number(e.target.value))}
                  className="w-full bg-card-2 border border-line-soft rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                >
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-subtle uppercase tracking-wider mb-1.5">Select Year</label>
                <select
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  className="w-full bg-card-2 border border-line-soft rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Period status card */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                  <CalendarDays size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest">Active Period</p>
                  <p className="text-base font-extrabold text-ink">{MONTHS[month - 1]} {year}</p>
                </div>
              </div>
              <div className="text-right border-l border-blue-500/20 pl-5">
                <p className="text-[10px] font-extrabold text-ink-subtle uppercase tracking-widest">Calendar Days</p>
                <p className="text-base font-extrabold text-primary font-mono">{calDays} <span className="text-xs font-semibold text-ink-muted">days</span></p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1.5">Select Month</label>
                <select
                  value={weekMonth}
                  onChange={e => { setWeekMonth(Number(e.target.value)); setWeekOfMonth(1); }}
                  className="w-full bg-card-2 border border-line-soft rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-card transition-all cursor-pointer"
                >
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1.5">Select Year</label>
                <select
                  value={year}
                  onChange={e => { setYear(Number(e.target.value)); setWeekOfMonth(1); }}
                  className="w-full bg-card-2 border border-line-soft rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-card transition-all cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1.5">Select Week</label>
              <div className="grid grid-cols-1 gap-2.5">
                {weekOptions.map(opt => {
                  const isSelected = weekOfMonth === opt.weekOfMonth;
                  return (
                    <button
                      key={opt.weekOfMonth}
                      onClick={() => setWeekOfMonth(opt.weekOfMonth)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left cursor-pointer ${isSelected
                        ? 'border-primary bg-blue-50/70 text-ink shadow-xs ring-2 ring-primary/20'
                        : 'border-line-soft bg-card text-ink-muted hover:border-line hover:bg-card-2'
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-primary' : 'bg-ink-subtle'}`} />
                        <span className="font-bold text-sm">{opt.label}</span>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${isSelected ? 'bg-blue-100 text-blue-700' : 'text-ink-subtle bg-card-2'}`}>
                        7 days
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedWeek && (
              <div className="bg-gradient-to-r from-blue-50/80 via-blue-50/30 to-card-2 border border-blue-100 rounded-xl p-4 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold">
                    <CalendarDays size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest">Active Weekly Period</p>
                    <p className="text-base font-extrabold text-ink">
                      {selectedWeek.label.replace(/^Week \d+\s*/, '')}
                    </p>
                  </div>
                </div>
                <div className="text-right border-l border-blue-200/60 pl-5">
                  <p className="text-[10px] font-extrabold text-ink-subtle uppercase tracking-widest">Days</p>
                  <p className="text-base font-extrabold text-primary font-mono">{calDays} <span className="text-xs font-semibold text-ink-muted">days</span></p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Target Selection / Employee Category (Hidden / Commented Out) */}
      {/*
      <div className="bg-card rounded-2xl border border-line-soft shadow-xs hover:shadow-md transition-shadow p-6 space-y-4 h-full flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-line-soft pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-card-2 text-ink-muted">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-ink-subtle uppercase tracking-widest">Target Selection</h3>
              <p className="text-sm font-semibold text-ink">Employee Category</p>
            </div>
          </div>
          <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
            {filtered.length} Selected
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {CATEGORIES.filter(c => runType === 'WEEKLY' ? c.value === 'DAILY_WEEKLY' || c.value === 'ALL' : true).map(c => {
            const count = typeFiltered.filter(e =>
              c.value === 'ALL' || e.payrollConfig?.salaryType === c.value
            ).length;
            const isSelected = category === c.value;
            return (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${isSelected
                  ? 'border-primary bg-primary/10 text-ink shadow-xs ring-2 ring-primary/20'
                  : 'border-line-soft bg-card-2 text-ink-muted hover:border-line hover:bg-card'
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? 'bg-primary' : 'bg-ink-subtle/50'}`} />
                  <span className="text-xs sm:text-sm font-bold text-ink">{c.label}</span>
                </div>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-primary/20 text-primary' : 'bg-card text-ink-subtle border border-line-soft'}`}>
                  {count} emp
                </span>
              </button>
            );
          })}
        </div>

        {noConfig > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-amber-600" />
            <span>
              <span className="font-bold">{noConfig}</span> employee{noConfig > 1 ? 's' : ''} skipped — no payroll config set up. Go to <strong>Payroll Settings → Employee Config</strong> to configure them.
            </span>
          </p>
        )}
      </div>
      */}

      {/* Attendance validation error */}
      {attValidationError && (
        <div className="rounded-2xl border border-red-200 bg-red-50/90 p-5 space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-red-100 text-red-700 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-red-900">
                Attendance Incomplete — Payroll Run Blocked
              </p>
              <p className="text-xs text-red-700 mt-1">
                All {attValidationError.employees[0]?.expected}-day entries must be saved for every employee before running payroll.
                Go to <strong>Attendance Entry</strong> and fill all days, then try again.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-red-200 bg-white overflow-hidden shadow-xs">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-100/80 text-red-800 uppercase tracking-wider font-bold">
                  <th className="text-left px-4 py-2.5">Employee</th>
                  <th className="text-center px-4 py-2.5">Days Entered</th>
                  <th className="text-center px-4 py-2.5">Required</th>
                  <th className="text-center px-4 py-2.5">Missing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {attValidationError.employees.map((e, i) => (
                  <tr key={i} className="text-ink hover:bg-red-50/40">
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-ink">{e.name}</span>
                      <span className="text-ink-subtle font-mono text-[11px] ml-1">({e.code})</span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-red-600 font-bold">{e.entered}</td>
                    <td className="px-4 py-2.5 text-center font-mono font-medium">{e.expected}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-red-700 font-black">{e.expected - e.entered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
          <Users size={16} className="text-primary" />
          <span><strong className="text-ink font-extrabold">{filtered.length}</strong> employees will be processed</span>
        </div>
        <Button
          text={loading ? "Checking Attendance..." : "Next: Review Attendance"}
          onClick={onNext}
          disabled={filtered.length === 0 || loading}
          size="md"
        />
      </div>
    </div>
  );
};

// ─── Step 2: Attendance Review (read-only from AttendancePage data) ───────────
interface AttRow extends AttendanceInput { name: string; code: string; salaryType: string; }

// ─── OT Calculation Tooltip ──────────────────────────────────────────────────
const OtTooltip: React.FC<{
  otHours: number;
  otPay: number;
  dailyRate: number;
}> = ({ otHours, otPay }) => {
  const [show, setShow] = React.useState(false);

  if (otHours <= 0 && otPay <= 0) {
    return <span className="font-mono text-xs text-text-muted">—</span>;
  }

  const otMins = Math.round(otHours * 60);

  return (
    <div
      className="relative inline-flex items-center cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="font-mono text-xs text-emerald-400 font-semibold underline decoration-dotted underline-offset-2">
        {`₹${Math.round(otPay).toLocaleString('en-IN')}`}
      </span>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 pointer-events-none">
          <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-3 text-xs space-y-1.5 border border-slate-700">
            <p className="font-bold text-emerald-400 text-[11px] uppercase tracking-wider mb-2">Overtime</p>
            {otHours > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">Duration</span>
                <span className="font-semibold">{otMins}m ({otHours.toFixed(1)}h)</span>
              </div>
            )}
            <div className="border-t border-slate-700 pt-1.5 flex justify-between">
              <span className="text-slate-400">OT Pay</span>
              <span className="font-bold text-emerald-400">₹{Math.round(otPay).toLocaleString('en-IN')}</span>
            </div>
          </div>
          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-2.5 h-2.5 bg-slate-900 rotate-45 -mt-1.5 border-r border-b border-slate-700" />
          </div>
        </div>
      )}
    </div>
  );
};

const EditableAdvanceInput: React.FC<{
  initialValue: number;
  employeeId: number;
  textColorClass?: string;
  onSave: (empId: number, val: number) => void;
}> = ({ initialValue, employeeId, textColorClass = 'text-violet-700', onSave }) => {
  const [val, setVal] = useState<string>(String(initialValue ?? 0));

  useEffect(() => {
    setVal(String(initialValue ?? 0));
  }, [initialValue]);

  const commitChange = (raw: string) => {
    const num = Math.max(0, Number(raw) || 0);
    setVal(String(num));
    onSave(employeeId, num);
  };

  return (
    <div className="flex justify-end">
      <input
        type="number"
        min="0"
        value={val}
        onChange={(e) => {
          const raw = e.target.value;
          setVal(raw);
          const num = Math.max(0, Number(raw) || 0);
          onSave(employeeId, num);
        }}
        onBlur={(e) => commitChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitChange((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="0"
        className={`w-24 px-2.5 py-1 text-right font-mono text-xs font-bold ${textColorClass} bg-card border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-2xs`}
      />
    </div>
  );
};

const Step2: React.FC<{
  rows: AttRow[];
  hasData: boolean;
  period: string;
  calDays: number;
  runType: 'WEEKLY' | 'MONTHLY';
  onBack: () => void;
  onNext: () => void;
  onAdvanceChange?: (empId: number, amount: number) => void;
}> = ({ rows, hasData, period, calDays, runType, onBack, onNext, onAdvanceChange }) => {
  const navigate = useNavigate();

  // Summary totals
  const totalsRaw = rows.reduce(
    (acc, r) => ({
      present: acc.present + Number(r.presentDays || 0),
      absent: acc.absent + Number(r.absentDays || 0),
      half: acc.half + Number(r.halfDays || 0),
      ot: acc.ot + Number(r.otHours || 0),
      otDays: acc.otDays + Number(r.otDays || 0),
      teaOt: acc.teaOt + Number(r.teaOtCount || 0),
      adv: acc.adv + Number(r.advance || 0),
    }),
    { present: 0, absent: 0, half: 0, ot: 0, otDays: 0, teaOt: 0, adv: 0 }
  );
  const totals = {
    ...totalsRaw,
    present: runType === 'MONTHLY' ? totalsRaw.present + totalsRaw.half * 0.5 : totalsRaw.present,
  };

  if (!hasData) {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Review Attendance</h2>
          <p className="text-sm text-text-secondary mt-0.5">Attendance data from the Attendance module is used for payroll calculation.</p>
        </div>
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <ClipboardList size={26} className="text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-amber-800 text-base">No Attendance Data Found</p>
            <p className="text-sm text-amber-700 mt-1">
              No attendance has been saved for <strong>{period}</strong>.<br />
              Please enter attendance in the Attendance module first.
            </p>
          </div>
          <button
            onClick={() => navigate('/payroll/attendance')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-lg font-semibold text-sm hover:bg-amber-700 transition-colors"
          >
            <ClipboardList size={15} /> Go to Attendance Page
          </button>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-card-2 transition-colors">
            <ChevronLeft size={16} /> Back
          </button>
        </div>
      </div>
    );
  }
  const columns: DataTableColumn<AttRow>[] = [
    {
      header: "EMPLOYEE",
      align: "left",
      render: (row) => (
        <div>
          <p className="font-semibold text-text-primary text-xs">{row.name}</p>
          <p className="text-[10px] text-text-muted">{row.code} · {row.salaryType.replace(/_/g, ' ')}</p>
        </div>
      ),
    },
    {
      header: "PRESENT",
      headerNode: (
        <span>
          PRESENT <br />
          <span className="font-normal normal-case text-ink-subtle">/ {calDays}d</span>
        </span>
      ),
      align: "center",
      render: (row) => {
        const displayPresent = runType === 'MONTHLY' ? row.presentDays + row.halfDays * 0.5 : row.presentDays;
        return (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
            {displayPresent % 1 === 0 ? displayPresent : displayPresent.toFixed(1)}
          </span>
        );
      },
    },
    {
      header: "ABSENT",
      align: "center",
      render: (row) => (
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${row.absentDays > 0 ? 'bg-red-100 text-red-700' : 'bg-card-2 text-ink-subtle'
            }`}
        >
          {row.absentDays > 0 ? row.absentDays : '—'}
        </span>
      ),
    },
    {
      header: "HALF DAY",
      headerNode: (
        <span>
          HALF <br />
          <span className="font-normal normal-case text-ink-subtle">Day</span>
        </span>
      ),
      align: "center",
      render: (row) => (
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${row.halfDays > 0 ? 'bg-amber-100 text-amber-700' : 'bg-card-2 text-ink-subtle'
            }`}
        >
          {row.halfDays > 0 ? row.halfDays : '—'}
        </span>
      ),
    },
    {
      header: "OT DURATION",
      headerNode: (
        <span>
          OT <br />
          <span className="font-normal normal-case text-ink-subtle">Duration</span>
        </span>
      ),
      align: "center",
      render: (row) => (
        <div>
          <span className={`font-mono text-xs ${row.otHours > 0 ? 'text-blue-400 font-bold' : 'text-text-muted'}`}>
            {row.otHours > 0 ? `${Math.round(row.otHours * 60)}m (${Number(row.otHours).toFixed(1)}h)` : '—'}
          </span>
          {Number((row as any).otAmount) > 0 && (
            <div className="text-[10px] font-mono font-bold text-emerald-400">
              ₹{Number((row as any).otAmount)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "OT DAYS",
      headerNode: (
        <span>
          OT <br />
          <span className="font-normal normal-case text-ink-subtle">Days</span>
        </span>
      ),
      align: "center",
      render: (row) => (
        <div>
          <span className={`font-mono text-xs ${row.otDays > 0 ? 'text-blue-600 font-bold' : 'text-text-muted'}`}>
            {row.otDays > 0 ? `${row.otDays.toFixed(1)}d` : '—'}
          </span>
          {Number((row as any).otDaysAmount) > 0 && (
            <div className="text-[10px] font-mono font-bold text-emerald-500">
              ₹{Number((row as any).otDaysAmount)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "TEA OT",
      headerNode: (
        <span>
          Tea <br />
          <span className="font-normal normal-case text-ink-subtle">OT</span>
        </span>
      ),
      align: "center",
      render: (row) => (
        <div>
          <span className={`font-mono text-xs ${row.teaOtCount > 0 ? 'text-blue-600 font-bold' : 'text-text-muted'}`}>
            {row.teaOtCount > 0 ? row.teaOtCount : '—'}
          </span>
          {Number((row as any).teaOtAmount) > 0 && (
            <div className="text-[10px] font-mono font-bold text-emerald-500">
              ₹{Number((row as any).teaOtAmount)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "LATE MIN",
      headerNode: (
        <span>
          LATE <br />
          <span className="font-normal normal-case text-ink-subtle">min</span>
        </span>
      ),
      align: "center",
      render: (row) => (
        <div>
          <span className={`font-mono text-xs ${row.lateMinutes > 0 ? 'text-orange-600 font-bold' : 'text-text-muted'}`}>
            {row.lateMinutes > 0 ? `${row.lateMinutes}m` : '—'}
          </span>
          {Number((row as any).lateDeduction) > 0 && (
            <div className="text-[10px] font-mono font-bold text-red-500">
              ₹{Number((row as any).lateDeduction)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "PERM MIN",
      headerNode: (
        <span>
          PERM <br />
          <span className="font-normal normal-case text-ink-subtle">min</span>
        </span>
      ),
      align: "center",
      render: (row) => (
        <div>
          <span className={`font-mono text-xs ${row.permissionMinutes > 0 ? 'text-orange-600 font-bold' : 'text-text-muted'}`}>
            {row.permissionMinutes > 0 ? `${row.permissionMinutes}m` : '—'}
          </span>
          {Number((row as any).permissionDeduction) > 0 && (
            <div className="text-[10px] font-mono font-bold text-red-500">
              ₹{Number((row as any).permissionDeduction)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "ADVANCE ₹",
      align: "right",
      render: (row) => (
        <EditableAdvanceInput
          initialValue={row.advance}
          employeeId={row.employeeId}
          textColorClass="text-violet-700"
          onSave={(empId, amount) => onAdvanceChange?.(empId, amount)}
        />
      ),
    },
    {
      header: "STATUS",
      align: "center",
      render: (row) => {
        const totalTracked = row.presentDays + row.absentDays + row.halfDays;
        const missingDays = calDays - totalTracked;
        const overCap = totalTracked > calDays;
        return totalTracked === 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
            <AlertTriangle size={9} /> No Data
          </span>
        ) : overCap ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
            <AlertTriangle size={9} /> Over
          </span>
        ) : missingDays > 3 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
            <Info size={9} /> {missingDays}d unset
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
            OK
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Review Attendance</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Loaded from saved attendance for <strong>{period}</strong>. This data will be used to calculate payroll.
          </p>
        </div>
        <button
          onClick={() => navigate('/payroll/attendance')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-text-secondary rounded-lg text-xs font-semibold hover:bg-card-2 transition-colors"
        >
          <ClipboardList size={13} /> Edit Attendance
        </button>
      </div>

      {/* Per-employee attendance breakdown using reusable DataTable component */}
      <div className="bg-card rounded-2xl border border-line-soft shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(row) => row.employeeId}
          emptyMessage="No attendance records found."
          rowClassName={(row) => {
            const totalTracked = row.presentDays + row.absentDays + row.halfDays;
            const missingDays = calDays - totalTracked;
            const overCap = totalTracked > calDays;
            return totalTracked === 0 ? 'bg-red-50/40' :
              overCap ? 'bg-red-50' :
                missingDays > 5 ? 'bg-amber-50/50' : '';
          }}
          density="compact"
        />
        {/* Total Summary Footer — Step 3 Styled Footer */}
        <div className="bg-card border-t border-line-soft">
          <div className="flex flex-col xl:flex-row items-center justify-between">
            {/* Left side: Total count */}
            <div className="px-6 py-4 flex items-center xl:border-r border-line-soft xl:min-w-[200px] w-full xl:w-auto border-b xl:border-b-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card-2 text-ink-muted font-bold">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Total Employees</p>
                  <p className="text-sm font-bold text-ink">{rows.length}</p>
                </div>
              </div>
            </div>

            {/* Middle: Attendance Breakdown Metrics */}
            <div className="flex-1 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 px-6 py-4 text-sm border-b xl:border-b-0 border-line-soft">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-1">Present</span>
                <span className="font-mono font-bold text-emerald-600">{totals.present} days</span>
              </div>
              <div className="h-8 w-px bg-line-soft hidden sm:block"></div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-1">Absent</span>
                <span className="font-mono font-bold text-rose-600">{totals.absent} days</span>
              </div>
              <div className="h-8 w-px bg-line-soft hidden sm:block"></div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-1">Half Days</span>
                <span className="font-mono font-bold text-amber-600">{totals.half} days</span>
              </div>
              <div className="h-8 w-px bg-line-soft hidden sm:block"></div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-1">OT Hours</span>
                <span className="font-mono font-bold text-blue-600">{totals.ot.toFixed(1)} hrs</span>
              </div>
              <div className="h-8 w-px bg-line-soft hidden sm:block"></div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-1">Salary Advance</span>
                <span className="font-mono font-bold text-violet-700">
                  {totals.adv > 0 ? `₹${totals.adv.toLocaleString('en-IN')}` : '—'}
                </span>
              </div>
            </div>

            {/* Right side: Attendance Rate / Total Tracked */}
            <div className="flex items-stretch xl:border-l border-line-soft bg-card-2 w-full xl:w-auto">
              <div className="px-6 py-4 flex flex-col items-end justify-center flex-1 xl:flex-none">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Tracked</span>
                <span className="font-mono text-xl font-black text-emerald-700">{totals.present + totals.absent + totals.half} days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-700">
        <Info size={14} className="shrink-0" />
        This attendance is pulled from the Attendance module. LOP days and exact deductions are computed by the payroll engine.
        If data looks wrong, click <strong className="ml-0.5">Edit Attendance</strong> to update it.
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-card-2 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <button onClick={onNext} className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20 cursor-pointer">
          Calculate Payroll <PlayCircle size={16} />
        </button>
      </div>
    </div>
  );
};

// ─── Computing Progress Overlay ───────────────────────────────────────────────
interface ProgressState {
  current: number;
  total: number;
  currentEmployee: string;
  runCode: string;
}

const ComputingOverlay: React.FC<{ progress: ProgressState }> = ({ progress }) => {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 space-y-6 text-center">
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
            <Loader2 size={30} className="text-primary animate-spin" />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-text-primary">Computing Payroll</h3>
          <p className="text-sm text-text-secondary mt-1">Please wait while the server calculates salaries…</p>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-text-muted">
            <span>Processing: <span className="font-semibold text-text-primary">{progress.currentEmployee}</span></span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full bg-card-2 rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-sm font-bold text-primary">{pct}%</p>
        </div>
        <p className="text-xs text-text-muted font-mono">{progress.runCode}</p>
      </div>
    </div>
  );
};

// ─── Step 3: Preview ──────────────────────────────────────────────────────────
const Step3: React.FC<{
  run: ApiPayrollRun;
  onBack: () => void;
  onNext: () => void;
  onAdvanceChange?: (empId: number, amount: number) => void;
}> = ({ run, onBack, onNext, onAdvanceChange }) => {
  const results = run.results || [];
  const variances = results.filter(r => r.hasVariance);

  const totalOnRecordNet = run.totalNetSalary || results.reduce((s, r) => s + Number(r.netSalary || 0), 0);
  const totalCashInHand = results.reduce((s, r) => s + Number(r.cashInHand || 0), 0);

  const handleExportCSV = () => {
    const headers = [
      'S.No', 'Emp No', 'Employee Name', 'Actual Salary Per Month', '(PF) Gross Salary',
      'Balance Cash Salary', 'PF Salary', 'Working Days', 'PF Salary (Earned)', 'ESI Salary',
      'OT & Incentive', 'Salary Advance', 'Permission Deduction', 'Late Deduction',
      'PF Deduction', 'ESI Deduction', 'Bank Transfer', 'Cash Payment', 'Cash Paid'
    ];

    const rows = results.map((r, idx) => {
      const grossSal = Number(r.monthlySalary || 0);
      const configuredCash = Number((r as any).initialCashInHand ?? r.cashInHand ?? 0);
      const isCashEmp = r.paymentMode === 'CASH' && !r.pfApplicable;
      const balanceCash = configuredCash > 0 ? configuredCash : (isCashEmp ? grossSal : 0);
      const actualSalPerMonth = r.pfApplicable ? grossSal + configuredCash : grossSal;
      const pfSalaryBase = r.pfApplicable ? grossSal * 0.60 : 0;
      const pfSalaryEarned = Number(r.pfWage || 0);
      const esiSalary = r.esiApplicable ? Number(r.grossSalary || 0) : 0;
      const bankTransfer = Number(r.bankTransfer ?? 0);
      const cashPayment = Number(r.cashPayment ?? r.actualSalary ?? r.netSalary);
      const cashPaid = Number(r.cashPaid ?? r.netSalary);
      return [
        idx + 1,
        r.employeeCode,
        `"${r.employeeName.replace(/"/g, '""')}"`,
        actualSalPerMonth.toFixed(2),
        r.pfApplicable ? grossSal.toFixed(2) : '',
        balanceCash > 0 ? balanceCash.toFixed(2) : '',
        pfSalaryBase > 0 ? pfSalaryBase.toFixed(2) : '',
        Number(r.presentDays).toFixed(1),
        pfSalaryEarned > 0 ? pfSalaryEarned.toFixed(2) : '',
        esiSalary > 0 ? esiSalary.toFixed(2) : '',
        Number(r.otPay).toFixed(2),
        Number(r.salaryAdvance).toFixed(2),
        Number(r.permissionDeduction).toFixed(2),
        Number(r.lateEntryDeduction).toFixed(2),
        Number(r.employeePf).toFixed(2),
        Number(r.employeeEsi).toFixed(2),
        bankTransfer > 0 ? bankTransfer.toFixed(2) : '',
        cashPayment.toFixed(2),
        cashPaid.toFixed(2),
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payroll_Preview_${run.period}_${run.runCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Table cell helpers
  const th = "px-3 py-2.5 text-center border-r border-line-soft whitespace-nowrap align-middle";
  const thR = "px-3 py-2.5 text-right border-r border-line-soft whitespace-nowrap align-middle";
  const td = "px-3 py-2 text-center border-r border-line-soft font-mono whitespace-nowrap";
  const tdR = "px-3 py-2 text-right border-r border-line-soft font-mono whitespace-nowrap";
  const tdDed = "px-3 py-2 text-right border-r border-line-soft font-mono text-red-500 whitespace-nowrap";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Payroll Preview</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {formatPeriod(run.period)} · {results.length} employees · Run: <span className="font-mono text-xs text-text-muted">{run.runCode}</span>
          </p>
        </div>
        {/* 
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-3 py-1.5 border border-border text-text-secondary rounded-lg text-xs font-semibold hover:bg-card-2 transition-colors cursor-pointer"
        >
          <Download size={13} /> Export CSV
        </button>
        */}
      </div>

      {/* Cash in Hand Summary - shown when there is cash in hand */}
      {totalCashInHand > 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-card shadow-xs overflow-hidden my-2">
          <div className="flex items-center justify-between px-5 py-3 bg-indigo-600 text-white">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
              <Wallet size={15} /> Cash in Hand Summary
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-card-2 border border-line-soft flex flex-col gap-1">
                <span className="text-xs font-semibold text-ink-muted">Net Pay (Total)</span>
                <span className="text-xl font-extrabold text-ink font-mono">{fmtRs(totalOnRecordNet)}</span>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 flex flex-col gap-1">
                <span className="text-xs font-semibold text-indigo-600">Cash in Hand (included in Net)</span>
                <span className="text-xl font-extrabold text-indigo-700 font-mono">{fmtRs(totalCashInHand)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variance alert */}
      {variances.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
            <AlertTriangle size={15} /> {variances.length} Variance{variances.length > 1 ? 's' : ''} Detected
          </div>
          {variances.map(v => (
            <p key={v.employeeId} className="text-xs text-amber-600 pl-6">
              <span className="font-semibold">{v.employeeName}:</span> {v.varianceNote}
            </p>
          ))}
        </div>
      )}

      {/* Results table — Excel-style matching factory salary sheet */}
      <div className="bg-card rounded-2xl border border-line-soft shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-max w-full text-xs border-collapse text-ink">
            <thead>
              <tr className="bg-card-2 text-ink font-extrabold uppercase text-[11px] tracking-wider border-b border-line-soft">
                <th className={`${th} min-w-[40px]`}>S.No</th>
                <th className={`${th} min-w-[60px]`}>Emp No</th>
                <th className={`${th} min-w-[140px] text-left`}>Employee Name</th>
                <th className={`${thR} min-w-[110px]`}>Actual Salary<br /><span className="font-normal normal-case text-ink-subtle">Per Month</span></th>
                <th className={`${thR} min-w-[100px]`}>(PF) Gross<br /><span className="font-normal normal-case text-ink-subtle">Salary</span></th>
                <th className={`${thR} min-w-[100px]`}>Balance<br /><span className="font-normal normal-case text-ink-subtle">Cash Salary</span></th>
                <th className={`${thR} min-w-[80px]`}>PF<br /><span className="font-normal normal-case text-ink-subtle">Salary</span></th>
                <th className={`${th} min-w-[70px]`}>Working<br /><span className="font-normal normal-case text-ink-subtle">Days</span></th>
                <th className={`${thR} min-w-[90px]`}>PF<br /><span className="font-normal normal-case text-ink-subtle">Salary</span></th>
                <th className={`${thR} min-w-[90px]`}>ESI<br /><span className="font-normal normal-case text-ink-subtle">Salary</span></th>
                <th className={`${thR} min-w-[90px] bg-blue-500/10 text-blue-600`}>OT &<br /><span className="font-normal normal-case">Incentive</span></th>
                <th className={`${thR} min-w-[80px] text-red-500`}>Salary<br /><span className="font-normal normal-case">Advance</span></th>
                <th className={`${thR} min-w-[90px] text-red-500`}>Permission<br /><span className="font-normal normal-case">Deduction</span></th>
                <th className={`${thR} min-w-[80px] text-red-500`}>Late<br /><span className="font-normal normal-case">Deduction</span></th>
                <th className={`${thR} min-w-[80px] text-red-500`}>PF<br /><span className="font-normal normal-case">Deduction</span></th>
                <th className={`${thR} min-w-[80px] text-red-500`}>ESI<br /><span className="font-normal normal-case">Deduction</span></th>
                <th className={`${thR} min-w-[100px]`}>Bank<br /><span className="font-normal normal-case text-ink-subtle">Transfer</span></th>
                <th className={`${thR} min-w-[100px]`}>Cash<br /><span className="font-normal normal-case text-ink-subtle">Payment</span></th>
                <th className="px-3 py-2.5 text-right min-w-[100px] whitespace-nowrap align-middle bg-emerald-500/10 text-emerald-700 font-black">Cash<br /><span className="font-normal normal-case">Paid</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft bg-card">
              {results.length === 0 && (
                <tr><td colSpan={19} className="h-24 text-center text-ink-muted font-medium">No payroll results found.</td></tr>
              )}
              {results.map((r, idx) => {
                const grossSal = Number(r.monthlySalary || 0);
                const configuredCash = Number((r as any).initialCashInHand ?? r.cashInHand ?? 0);
                const isCashEmployee = r.paymentMode === 'CASH' && !r.pfApplicable;
                const balanceCashSalary = configuredCash > 0 ? configuredCash : (isCashEmployee ? grossSal : 0);
                const actualSalPerMonth = r.pfApplicable ? grossSal + configuredCash : grossSal;
                const pfSalaryBase = r.pfApplicable ? grossSal * 0.60 : 0;
                const pfSalaryEarned = Number(r.pfWage || 0);
                const esiSalary = r.pfApplicable ? Number(r.grossSalary || 0) : 0;
                const bankTransfer = Number(r.bankTransfer ?? 0);
                const cashPayment = Number(r.cashPayment ?? r.actualSalary ?? r.netSalary);
                const cashPaid = Number(r.cashPaid ?? r.netSalary);
                return (
                <tr key={r.id} className={`hover:bg-primary/5 transition-colors ${r.hasVariance ? 'border-l-2 border-l-amber-400' : ''}`}>
                  <td className={`${td} text-ink-muted`}>{idx + 1}</td>
                  <td className={`${td} font-semibold`}>{r.employeeCode}</td>
                  <td className="px-3 py-2 border-r border-line-soft min-w-[140px]">
                    <p className="font-semibold text-ink text-xs">{r.employeeName}</p>
                  </td>
                  <td className={`${tdR} font-bold`}>{fmtRs(actualSalPerMonth)}</td>
                  <td className={tdR}>{r.pfApplicable ? fmtRs(grossSal) : '—'}</td>
                  <td className={tdR}>{balanceCashSalary > 0 ? fmtRs(balanceCashSalary) : '—'}</td>
                  <td className={tdR}>{pfSalaryBase > 0 ? fmtRs(pfSalaryBase) : '—'}</td>
                  <td className={td}>{Number(r.presentDays).toFixed(1)}</td>
                  <td className={tdR}>{pfSalaryEarned > 0 ? fmtDec(pfSalaryEarned) : '—'}</td>
                  <td className={tdR}>{esiSalary > 0 ? fmtDec(esiSalary) : '—'}</td>
                  <td className={`${tdR} bg-blue-500/5 font-semibold text-blue-600`}>
                    {Number(r.otPay) > 0 ? fmtRs(Number(r.otPay)) : '—'}
                  </td>
                  <td className={tdDed}>
                    <EditableAdvanceInput
                      initialValue={Number(r.salaryAdvance)}
                      employeeId={Number(r.employeeId)}
                      textColorClass="text-red-600"
                      onSave={(empId, amount) => onAdvanceChange?.(empId, amount)}
                    />
                  </td>
                  <td className={tdDed}>{Number(r.permissionDeduction) > 0 ? fmtRs(Number(r.permissionDeduction)) : '—'}</td>
                  <td className={tdDed}>{Number(r.lateEntryDeduction) > 0 ? fmtRs(Number(r.lateEntryDeduction)) : '—'}</td>
                  <td className={tdDed}>{r.pfApplicable ? fmtRs(Number(r.employeePf)) : '—'}</td>
                  <td className={tdDed}>{r.esiApplicable ? fmtRs(Number(r.employeeEsi)) : '—'}</td>
                  <td className={`${tdR} font-semibold`}>{bankTransfer > 0 ? fmtRs(bankTransfer) : '—'}</td>
                  <td className={`${tdR} font-semibold`}>{fmtRs(cashPayment)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-mono font-black text-emerald-700 bg-emerald-500/5">{fmtRs(cashPaid)}</td>
                </tr>
                );
              })}
              {/* Totals row */}
              {results.length > 0 && (() => {
                const totActualSalPerMonth = results.reduce((s, r) => {
                  const g = Number(r.monthlySalary || 0);
                  const c = Number((r as any).initialCashInHand ?? r.cashInHand ?? 0);
                  return s + (r.pfApplicable ? g + c : g);
                }, 0);
                const totBalanceCash = results.reduce((s, r) => {
                  const c = Number((r as any).initialCashInHand ?? r.cashInHand ?? 0);
                  const isCash = r.paymentMode === 'CASH' && !r.pfApplicable;
                  return s + (c > 0 ? c : (isCash ? Number(r.monthlySalary || 0) : 0));
                }, 0);
                const totGrossPf = results.reduce((s, r) => {
                  return s + (r.pfApplicable ? Number(r.monthlySalary || 0) : 0);
                }, 0);
                const totOt = results.reduce((s, r) => s + Number(r.otPay || 0), 0);
                const totAdv = results.reduce((s, r) => s + Number(r.salaryAdvance || 0), 0);
                const totPerm = results.reduce((s, r) => s + Number(r.permissionDeduction || 0), 0);
                const totLate = results.reduce((s, r) => s + Number(r.lateEntryDeduction || 0), 0);
                const totPf = results.reduce((s, r) => s + Number(r.employeePf || 0), 0);
                const totEsi = results.reduce((s, r) => s + Number(r.employeeEsi || 0), 0);
                const totBank = results.reduce((s, r) => s + Number(r.bankTransfer ?? 0), 0);
                const totCashPay = results.reduce((s, r) => s + Number(r.cashPayment ?? r.actualSalary ?? r.netSalary), 0);
                const totCashPaid = results.reduce((s, r) => s + Number(r.cashPaid ?? r.netSalary), 0);
                return (
                  <tr className="bg-card-2 font-bold border-t-2 border-line-soft text-ink">
                    <td className={`${td} font-black`} colSpan={3}>TOTAL ({results.length} employees)</td>
                    <td className={`${tdR} font-black`}>{fmtRs(totActualSalPerMonth)}</td>
                    <td className={tdR}>{totGrossPf > 0 ? fmtRs(totGrossPf) : '—'}</td>
                    <td className={tdR}>{totBalanceCash > 0 ? fmtRs(totBalanceCash) : '—'}</td>
                    <td className={tdR}></td>
                    <td className={td}></td>
                    <td className={tdR}></td>
                    <td className={tdR}></td>
                    <td className={`${tdR} text-blue-600`}>{totOt > 0 ? fmtRs(totOt) : '—'}</td>
                    <td className={tdDed}>{totAdv > 0 ? fmtRs(totAdv) : '—'}</td>
                    <td className={tdDed}>{totPerm > 0 ? fmtRs(totPerm) : '—'}</td>
                    <td className={tdDed}>{totLate > 0 ? fmtRs(totLate) : '—'}</td>
                    <td className={tdDed}>{totPf > 0 ? fmtRs(totPf) : '—'}</td>
                    <td className={tdDed}>{totEsi > 0 ? fmtRs(totEsi) : '—'}</td>
                    <td className={`${tdR} font-black`}>{totBank > 0 ? fmtRs(totBank) : '—'}</td>
                    <td className={`${tdR} font-black`}>{fmtRs(totCashPay)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-mono font-black text-emerald-700 bg-emerald-500/5">{fmtRs(totCashPaid)}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>


      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-card-2 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <button onClick={onNext} className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors shadow-sm">
          Proceed to Approve <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ─── Step 4: Approve ──────────────────────────────────────────────────────────
const Step4: React.FC<{
  run: ApiPayrollRun;
  onBack: () => void;
  onApproved: (updated: ApiPayrollRun) => void;
}> = ({ run, onBack, onApproved }) => {
  const { can } = usePermission();
  const canEditRun = can("payroll-run.edit");
  const canViewCash = can("payroll-cash-in-hand");
  const [declared, setDeclared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const results = run.results || [];
  const bankRows = results.filter(r => r.paymentMode === 'BANK');
  const cashRows = results.filter(r => r.paymentMode === 'CASH');
  const totalCashInHand = results.reduce((s, r) => s + Number(r.cashInHand || 0), 0);

  const periodLabel = formatPeriod(run.period);

  const handleApprove = async () => {
    if (run.status === 'APPROVED') {
      onApproved(run);
      return;
    }
    setLoading(true); setError('');
    try {
      const updated = await payrollService.approveRun(run.id);
      onApproved(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      <div>
        <h2 className="text-lg font-bold text-text-primary">Approve Payroll Run</h2>
        <p className="text-sm text-text-secondary mt-0.5">Review the summary and approve to proceed to disbursement.</p>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-xl border border-line-soft shadow-xs p-5">
        <h3 className="text-sm font-bold text-text-primary border-b border-border pb-3 mb-4">Run Summary — {periodLabel}</h3>
        <div className="grid grid-cols-2 gap-3">
          {([
            { label: 'Total Employees', value: `${results.length}` },
            { label: 'Net Payroll', value: fmtRs(run.totalNetSalary), bold: true },
            totalCashInHand > 0 ? { label: 'Cash In Hand', value: fmtRs(totalCashInHand) } : null,
            { label: 'Bank Transfer', value: fmtRs(bankRows.reduce((s, r) => s + Number(r.bankTransfer ?? 0), 0)) },
            canViewCash ? { label: 'Cash Payment', value: fmtRs(cashRows.reduce((s, r) => s + Number(r.netSalary), 0)) } : null,
            { label: 'Employee PF', value: fmtRs(run.totalPfEmployee) },
            { label: 'Employer PF', value: fmtRs(run.totalPfEmployer) },
            { label: 'Employee ESI', value: fmtRs(run.totalEsiEmployee) },
            { label: 'Employer ESI', value: fmtRs(run.totalEsiEmployer) },
          ].filter(Boolean) as { label: string; value: string; bold?: boolean }[]).map(item => (
            <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-line-soft">
              <span className="text-sm text-text-secondary">{item.label}</span>
              <span className={`font-semibold ${item.bold ? 'text-primary text-base' : 'text-text-primary text-sm'}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment mode list */}
      <div className="bg-card rounded-xl border border-line-soft shadow-xs overflow-hidden">
        <div className="px-5 py-3 bg-card-2 border-b border-border">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Payment Mode Breakdown</p>
        </div>
        <div className="divide-y divide-border max-h-56 overflow-y-auto">
          {results.filter(r => canViewCash || r.paymentMode !== 'CASH').map(r => (
            <div key={r.id} className="flex items-center justify-between px-5 py-2.5">
              <div>
                <p className="text-sm font-semibold text-text-primary">{r.employeeName}</p>
                <p className="text-xs text-text-muted">{r.employeeCode}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${r.paymentMode === 'BANK' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                  {r.paymentMode === 'BANK' ? <Building2 size={10} /> : <Wallet size={10} />} {r.paymentMode}
                </span>
                <div className="flex flex-col items-end text-right">
                  <span className="font-mono font-semibold text-sm text-text-primary">{fmtRs(Number(r.netSalary))}</span>
                  {Number(r.cashInHand || 0) > 0 && (
                    <div className="text-[10px] text-text-muted font-mono leading-tight">(incl. Cash: {fmtRs(Number(r.cashInHand || 0))})</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Declaration */}
      <label className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 cursor-pointer">
        <input type="checkbox" checked={declared} onChange={e => setDeclared(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/30 cursor-pointer" />
        <span className="text-sm text-blue-800">
          I confirm the payroll data for <strong>{periodLabel}</strong> is accurate. All attendance records, deductions, and statutory contributions are correct.
          I approve this payroll for disbursement.
        </span>
      </label>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-card-2 transition-colors">
          <ChevronLeft size={16} /> Back to Preview
        </button>
        {canEditRun && (
          <Button
            text={loading ? "Approving..." : "Approve Payroll"}
            onClick={handleApprove}
            disabled={!declared || loading}
            size="md"
          />
        )}
      </div>
    </div>
  );
};

// ─── Step 5: Lock & Disburse ──────────────────────────────────────────────────
const Step5: React.FC<{
  run: ApiPayrollRun;
  onBack: () => void;
}> = ({ run, onBack }) => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canEditRun = can("payroll-run.edit");
  const canViewCash = can("payroll-cash-in-hand");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const { socket } = useSocket();

  const results = run.results || [];
  const bankRows = results.filter(r => r.paymentMode === 'BANK');
  const cashRows = results.filter(r => r.paymentMode === 'CASH');
  const bankTotal = bankRows.reduce((s, r) => s + Number(r.bankTransfer ?? 0), 0);
  const cashTotal = cashRows.reduce((s, r) => s + Number(r.netSalary), 0);
  const totalCashInHand = results.reduce((s, r) => s + Number(r.cashInHand || 0), 0);
  // PF employees who also receive cash in hand
  const bankCashInHandRows = bankRows.filter(r => Number(r.cashInHand || 0) > 0);

  const bankColumns: DataTableColumn<ApiPayrollResult>[] = [
    {
      header: "EMPLOYEE",
      align: "left",
      render: (r) => (
        <div>
          <p className="font-semibold text-text-primary text-xs">{r.employeeName}</p>
          <p className="text-[10px] text-text-muted">{r.employeeCode}</p>
        </div>
      ),
    },
    {
      header: "ACCOUNT",
      align: "left",
      render: (r) => (
        <div className="text-xs font-mono">
          {(r as any).employee?.accountNumber ? (
            <div>
              <p className="font-semibold text-text-primary text-xs">{(r as any).employee.accountNumber}</p>
              <p className="text-[10px] text-text-muted">{(r as any).employee.bankName || ''} · {(r as any).employee.ifscCode || ''}</p>
            </div>
          ) : '—'}
        </div>
      ),
    },
    {
      header: "AMOUNT",
      align: "right",
      render: (r) => (
        <span className="font-mono font-semibold text-text-primary text-xs">{fmtRs(Number(r.bankTransfer ?? 0))}</span>
      ),
    },
  ];

  const cashColumns: DataTableColumn<ApiPayrollResult>[] = [
    {
      header: "EMPLOYEE",
      align: "left",
      render: (r) => (
        <div>
          <p className="font-semibold text-text-primary text-xs">{r.employeeName}</p>
          <p className="text-[10px] text-text-muted">{r.employeeCode}</p>
        </div>
      ),
    },
    {
      header: "TYPE",
      align: "left",
      render: (r) => (
        <span className="text-xs text-text-secondary">
          {r.salaryType.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: "AMOUNT",
      align: "right",
      render: (r) => (
        <span className="font-mono font-semibold text-text-primary text-xs">{fmtRs(Number(r.netSalary))}</span>
      ),
    },
  ];

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { runId: number }) => {
      if (data.runId === run.id) setLocked(true);
    };
    socket.on('payroll:locked', handler);
    return () => { socket.off('payroll:locked', handler); };
  }, [socket, run.id]);

  const handleLock = async () => {
    setLoading(true); setError('');
    try {
      await payrollService.lockRun(run.id);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Lock failed');
      setLoading(false);
    }
  };

  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const escape = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csvContent = "data:text/csv;charset=utf-8," + [
      headers.map(escape).join(','),
      ...rows.map(row => row.map(escape).join(','))
    ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadNEFT = () => {
    const headers = ['Employee Name', 'Employee Code', 'Bank Name', 'Account Number', 'IFSC Code', 'Amount (Rs)'];
    const rows = bankRows.map(r => [
      r.employeeName,
      r.employeeCode,
      (r as any).employee?.bankName || '',
      (r as any).employee?.accountNumber || '',
      (r as any).employee?.ifscCode || '',
      String(r.bankTransfer ?? 0)
    ]);
    downloadCSV(`NEFT-List-${run.period}.csv`, headers, rows);
  };

  const handleDownloadCash = () => {
    const headers = ['Employee Name', 'Employee Code', 'Salary Type', 'Amount (Rs)'];
    const rows = cashRows.map(r => [
      r.employeeName,
      r.employeeCode,
      r.salaryType.replace('_', ' '),
      String(r.netSalary)
    ]);
    downloadCSV(`Cash-Disbursal-List-${run.period}.csv`, headers, rows);
  };

  if (locked) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-10">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Payroll Locked!</h2>
          <p className="text-text-secondary mt-2 text-sm">
            {formatPeriod(run.period)} payroll has been finalised for {results.length} employees.
          </p>
        </div>
        <div className="bg-card-2 rounded-xl border border-border p-5 text-left space-y-2">
          <div className="flex justify-between text-sm"><span className="text-text-secondary">Bank Transfers</span><span className="font-semibold text-text-primary">{fmtRs(bankTotal)}</span></div>
          {canViewCash && <div className="flex justify-between text-sm"><span className="text-text-secondary">Cash Payments</span><span className="font-semibold text-text-primary">{fmtRs(cashTotal)}</span></div>}
          {totalCashInHand > 0 && <div className="flex justify-between text-sm"><span className="text-text-secondary">Cash In Hand (incl. in Net)</span><span className="font-semibold text-text-primary">{fmtRs(totalCashInHand)}</span></div>}
          <div className="flex justify-between text-sm font-bold border-t border-border pt-2"><span>Total Disbursed</span><span className="text-primary">{fmtRs(run.totalNetSalary)}</span></div>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/payroll/monthly-report')}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-primary text-primary rounded-lg font-semibold text-sm hover:bg-red-50 transition-colors">
            <FileText size={14} /> View Report
          </button>
          <button onClick={() => navigate('/payroll')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors">
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-text-primary">Lock & Disburse</h2>
        <p className="text-sm text-text-secondary mt-0.5">Locking finalises the payroll. No changes can be made after locking.</p>
      </div>

      {/* Disbursal summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {([
          { label: 'Total Net Payroll', value: fmtRs(run.totalNetSalary), icon: IndianRupee, cls: 'text-text-primary bg-card-2' },
          { label: 'Bank Transfer', value: fmtRs(bankTotal), icon: Building2, cls: 'text-blue-700 bg-blue-50' },
          canViewCash ? { label: 'Cash Payment', value: fmtRs(cashTotal), icon: Wallet, cls: 'text-emerald-700 bg-emerald-50' } : null,
          totalCashInHand > 0 ? { label: 'Cash In Hand', value: fmtRs(totalCashInHand), icon: Wallet, cls: 'text-amber-700 bg-amber-50' } : null,
        ].filter(Boolean) as { label: string; value: string; icon: any; cls: string }[]).map(c => (
          <div key={c.label} className="bg-card rounded-xl border border-line-soft p-5 shadow-xs flex items-center gap-4">
            <div className={`p-3 rounded-xl ${c.cls}`}><c.icon size={20} /></div>
            <div>
              <p className="text-xs text-text-muted font-semibold">{c.label}</p>
              <p className="text-lg font-bold text-text-primary">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bank table using reusable DataTable component */}
      {bankRows.length > 0 && (
        <div className="bg-card rounded-xl border border-line-soft shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-blue-50/60">
            <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
              Bank Transfers ({bankRows.length})
            </h3>
            <button
              onClick={handleDownloadNEFT}
              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              <Download size={11} /> Download NEFT List
            </button>
          </div>
          <DataTable
            columns={bankColumns}
            data={bankRows}
            rowKey={(r) => r.id}
            emptyMessage="No bank transfer records."
            density="compact"
          />
          <div className="bg-card-2 border-t border-line-soft px-5 py-3 flex items-center justify-between text-xs font-bold text-text-primary">
            <span>TOTAL BANK</span>
            <span className="font-mono text-blue-700 text-sm">{fmtRs(bankTotal)}</span>
          </div>
        </div>
      )}

      {/* Cash table using reusable DataTable component */}
      {canViewCash && cashRows.length > 0 && (
        <div className="bg-card rounded-xl border border-line-soft shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-emerald-50/60">
            <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet size={12} /> Cash Payments ({cashRows.length})
            </h3>
            <button
              onClick={handleDownloadCash}
              className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
            >
              <Download size={11} /> Download Cash List
            </button>
          </div>
          <DataTable
            columns={cashColumns}
            data={cashRows}
            rowKey={(r) => r.id}
            emptyMessage="No cash payment records."
            density="compact"
          />
          <div className="bg-card-2 border-t border-line-soft px-5 py-3 flex items-center justify-between text-xs font-bold text-text-primary">
            <span>TOTAL CASH</span>
            <span className="font-mono text-emerald-700 text-sm">{fmtRs(cashTotal)}</span>
          </div>
        </div>
      )}

      {/* Cash In Hand table for PF/Bank employees who also receive cash */}
      {bankCashInHandRows.length > 0 && (
        <div className="bg-card rounded-xl border border-line-soft shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-amber-50/60">
            <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet size={12} /> Cash In Hand ({bankCashInHandRows.length})
            </h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-card-2 border-b border-line-soft text-[10px] font-bold text-text-muted uppercase tracking-wider">
                <th className="px-5 py-2.5 text-left">Employee</th>
                <th className="px-5 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {bankCashInHandRows.map(r => (
                <tr key={r.id} className="hover:bg-card-2/60 transition-colors">
                  <td className="px-5 py-2.5">
                    <p className="font-semibold text-text-primary text-xs">{r.employeeName}</p>
                    <p className="text-[10px] text-text-muted">{r.employeeCode}</p>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="font-mono font-semibold text-text-primary text-xs">{fmtRs(Number(r.cashInHand || 0))}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-card-2 border-t border-line-soft px-5 py-3 flex items-center justify-between text-xs font-bold text-text-primary">
            <span>TOTAL CASH IN HAND</span>
            <span className="font-mono text-amber-700 text-sm">{fmtRs(totalCashInHand)}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-card-2 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-card-2 transition-colors">
            <Download size={15} /> Generate Payslips
          </button>
          {canEditRun && (
            <button onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-sm">
              <Lock size={14} /> Lock & Finalise
            </button>
          )}
        </div>
      </div>

      {/* Lock confirm modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 rounded-xl"><AlertTriangle size={20} className="text-amber-600" /></div>
                <div>
                  <h3 className="font-bold text-text-primary">Confirm Lock</h3>
                  <p className="text-xs text-text-secondary mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text-primary transition-colors"><X size={18} /></button>
            </div>
            <p className="text-sm text-text-secondary bg-amber-50 border border-amber-200 rounded-xl p-4">
              You are about to <strong>lock {formatPeriod(run.period)} payroll</strong> for{' '}
              <strong>{results.length} employees</strong> totalling <strong>{fmtRs(run.totalNetSalary)}</strong>.
              Once locked, no changes can be made.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-border text-text-secondary rounded-xl font-semibold text-sm hover:bg-card-2 transition-colors">
                Cancel
              </button>
              <button onClick={handleLock} disabled={loading}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {loading
                  ? <><Loader2 size={14} className="animate-spin" /> Locking…</>
                  : <><Lock size={14} /> Confirm Lock</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main PayrollRun ──────────────────────────────────────────────────────────
const PayrollRun: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initType = searchParams.get('type') === 'weekly' ? 'WEEKLY' : 'MONTHLY';
  const { socket } = useSocket();

  const [step, setStep] = useState(1);

  // Step 1 state
  const [runType, setRunType] = useState<'WEEKLY' | 'MONTHLY'>(initType);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [weekMonth, setWeekMonth] = useState(new Date().getMonth() + 1);
  const [weekOfMonth, setWeekOfMonth] = useState(Math.ceil(new Date().getDate() / 7));
  const [category, setCategory] = useState<SalaryCategory>('ALL');

  // Auto-calculate calDays
  const calDays = useMemo(() => {
    if (runType === 'WEEKLY') {
      return 7;
    }
    return daysInMonth(year, month);
  }, [runType, year, month]);

  // Data from API
  const [employees, setEmployees] = useState<ApiEmployeePayroll[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(true);

  // Step 2 state
  const [attRows, setAttRows] = useState<AttRow[]>([]);

  // Step 3 computing state
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({ current: 0, total: 0, currentEmployee: '', runCode: '' });
  const [currentRun, setCurrentRun] = useState<ApiPayrollRun | null>(null);
  const [computeErr, setComputeErr] = useState('');
  const [loadingStep2, setLoadingStep2] = useState(false);
  const [attFromSaved, setAttFromSaved] = useState(false);
  const [attValidationError, setAttValidationError] = useState<{ employees: { name: string; code: string; entered: number; expected: number }[] } | null>(null);

  // Load employees on mount
  useEffect(() => {
    payrollService.listEmployees().then(setEmployees).catch(console.error).finally(() => setLoadingEmp(false));
  }, []);

  const loadedDraftRef = React.useRef(false);
  useEffect(() => {
    const runId = searchParams.get('runId');
    if (!runId || employees.length === 0 || loadedDraftRef.current) return;
    loadedDraftRef.current = true;

    const loadDraftRun = async () => {
      try {
        setLoadingStep2(true);
        const run = await payrollService.getRun(Number(runId));
        setCurrentRun(run);

        // Parse and set period states
        setRunType(run.type);
        setCategory(run.employeeCategory as SalaryCategory);

        if (run.type === 'MONTHLY') {
          const [y, m] = run.period.split('-');
          setYear(Number(y));
          setMonth(Number(m));
        } else {
          // WEEKLY: YYYY-Wxx
          const [y, wStr] = run.period.split('-W');
          const isoYear = Number(y);
          const isoWeek = Number(wStr);
          setYear(isoYear);

          let wMonth = new Date().getMonth() + 1;
          let wOfM = 1;
          for (let m = 1; m <= 12; m++) {
            const opts = getWeeksOfMonth(isoYear, m);
            const match = opts.find(o => o.isoWeek === isoWeek && o.isoYear === isoYear);
            if (match) {
              wMonth = m;
              wOfM = match.weekOfMonth;
              break;
            }
          }
          setWeekMonth(wMonth);
          setWeekOfMonth(wOfM);
        }

        const allRecords = await payrollService.getAttendance(run.period);
        let filteredRecords = allRecords;

        const typeFiltered = employees.filter(e =>
          run.type === 'WEEKLY' ? isWeeklyEmployee(e) : !isWeeklyEmployee(e)
        );
        const filtered = run.employeeCategory === 'ALL'
          ? typeFiltered
          : typeFiltered.filter(e => e.payrollConfig?.salaryType === run.employeeCategory);

        const defaultRows: AttRow[] = filtered.map(e => ({
          employeeId: Number(e.id),
          name: e.fullName,
          code: e.empCode,
          salaryType: e.payrollConfig?.salaryType ?? 'FIXED_MONTHLY',
          presentDays: 0,
          absentDays: 0,
          halfDays: 0,
          otHours: 0,
          otAmount: 0,
          otDays: 0,
          otDaysAmount: 0,
          teaOtCount: 0,
          teaOtAmount: 0,
          lateMinutes: 0,
          lateDeduction: 0,
          dailyLateMinutes: [],
          permissionMinutes: 0,
          permissionDeduction: 0,
          advance: 0,
        }));

        let rows = defaultRows;
        if (filteredRecords.length > 0) {
          const uniqueMap = new Map<string, any>();
          filteredRecords.forEach((r: any) => {
            uniqueMap.set(`${r.employeeId}-${r.date}`, r);
          });
          const uniqueRecs = Array.from(uniqueMap.values());

          type Agg = {
            present: number;
            absent: number;
            half: number;
            ot: number;
            otAmount: number;
            otDays: number;
            otDaysAmount: number;
            teaOt: number;
            teaOtAmount: number;
            late: number;
            lateDeduction: number;
            dailyLate: number[];
            perm: number;
            permissionDeduction: number;
            adv: number;
          };
          const agg: Record<number, Agg> = {};
          uniqueRecs.forEach((r: any) => {
            const empId = Number(r.employeeId);
            if (!agg[empId]) agg[empId] = {
              present: 0, absent: 0, half: 0,
              ot: 0, otAmount: 0,
              otDays: 0, otDaysAmount: 0,
              teaOt: 0, teaOtAmount: 0,
              late: 0, lateDeduction: 0,
              dailyLate: [],
              perm: 0, permissionDeduction: 0,
              adv: 0,
            };
            if (r.status === 'PRESENT') agg[empId].present++;
            if (runType === 'MONTHLY' && (r.status === 'WEEKLY_OFF' || r.status === 'HOLIDAY' || r.status === 'LEAVE_PAID')) agg[empId].present++;
            if (r.status === 'ABSENT' || r.status === 'LEAVE_UNPAID') agg[empId].absent++;
            if (r.status === 'HALF_DAY') agg[empId].half++;
            agg[empId].ot += Number(r.otHours || 0);
            agg[empId].otAmount += Number(r.otAmount || 0);
            agg[empId].otDays += Number(r.otDays || 0);
            agg[empId].otDaysAmount += Number(r.otDaysAmount || 0);
            agg[empId].teaOt += Number(r.teaOtCount || 0);
            agg[empId].teaOtAmount += Number(r.teaOtAmount || 0);
            agg[empId].late += Number(r.lateMinutes || 0);
            agg[empId].lateDeduction += Number(r.lateDeduction || 0);
            agg[empId].dailyLate.push(Number(r.lateMinutes || 0));
            agg[empId].perm += Number(r.permissionMinutes || 0);
            agg[empId].permissionDeduction += Number(r.permissionDeduction || 0);
            agg[empId].adv += Number(r.salaryAdvance || 0);
          });
          rows = defaultRows.map(row => {
            const a = agg[row.employeeId];
            if (!a) return row;
            return {
              ...row,
              presentDays: a.present,
              absentDays: a.absent,
              halfDays: a.half,
              otHours: a.ot,
              otAmount: a.otAmount,
              otDays: a.otDays,
              otDaysAmount: a.otDaysAmount,
              teaOtCount: a.teaOt,
              teaOtAmount: a.teaOtAmount,
              lateMinutes: a.late,
              lateDeduction: a.lateDeduction,
              dailyLateMinutes: a.dailyLate,
              permissionMinutes: a.perm,
              permissionDeduction: a.permissionDeduction,
              advance: a.adv,
            };
          });
          setAttFromSaved(true);
        }
        setAttRows(rows);
        if (run.status === 'APPROVED') {
          setStep(5);
        } else {
          setStep(3);
        }
      } catch (e) {
        console.error('Failed to load draft run', e);
      } finally {
        setLoadingStep2(false);
      }
    };

    loadDraftRun();
  }, [employees, searchParams]);

  // Socket: listen for progress events
  useEffect(() => {
    if (!socket) return;

    socket.on('payroll:computing', (data: { runCode: string; total: number }) => {
      setProgress({ current: 0, total: data.total, currentEmployee: '…', runCode: data.runCode });
      setComputing(true);
    });

    socket.on('payroll:progress', (data: { current: number; total: number; employee: { name: string }; runCode: string }) => {
      setProgress({
        current: data.current,
        total: data.total,
        currentEmployee: data.employee.name,
        runCode: data.runCode,
      });
    });

    socket.on('payroll:completed', (_data: { runId: number }) => {
      setComputing(false);
    });

    return () => {
      socket.off('payroll:computing');
      socket.off('payroll:progress');
      socket.off('payroll:completed');
    };
  }, [socket]);

  // Period string
  const period = useMemo(() => {
    if (runType === 'WEEKLY') {
      const opts = getWeeksOfMonth(year, weekMonth);
      const opt = opts.find(o => o.weekOfMonth === weekOfMonth) ?? opts[0];
      if (!opt) return `${year}-W01`;
      return `${opt.isoYear}-W${String(opt.isoWeek).padStart(2, '0')}`;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  }, [runType, year, month, weekMonth, weekOfMonth]);

  const periodLabel = useMemo(() => {
    if (runType === 'WEEKLY') {
      const opts = getWeeksOfMonth(year, weekMonth);
      const opt = opts.find(o => o.weekOfMonth === weekOfMonth) ?? opts[0];
      if (!opt) return `Week 1, ${year}`;
      return opt.label.replace(/^Week \d+\s*\(/, '').replace(/\)$/, '');
    }
    return `${MONTHS[month - 1]} ${year}`;
  }, [runType, year, month, weekMonth, weekOfMonth]);

  // Rebuild att rows when category/employees change
  const isWeeklyEmployee = (e: any) =>
    e.payrollConfig?.salaryType === 'DAILY_WEEKLY' || e.payrollConfig?.salaryType === 'WEEKLY' || e.salaryType === 'daily' || e.salaryType === 'weekly';

  const handleCategoryChange = (c: SalaryCategory) => {
    setAttValidationError(null);
    setCategory(c);
    const typeFiltered = employees.filter(e =>
      runType === 'WEEKLY' ? isWeeklyEmployee(e) : !isWeeklyEmployee(e)
    );
    const filtered = c === 'ALL' ? typeFiltered : typeFiltered.filter(e => e.payrollConfig?.salaryType === c);
    setAttRows(filtered.map(e => ({
      employeeId: Number(e.id),
      name: e.fullName,
      code: e.empCode,
      salaryType: e.payrollConfig?.salaryType ?? 'FIXED_MONTHLY',
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      otHours: 0,
      otAmount: 0,
      otDays: 0,
      otDaysAmount: 0,
      teaOtCount: 0,
      teaOtAmount: 0,
      lateMinutes: 0,
      lateDeduction: 0,
      dailyLateMinutes: [],
      permissionMinutes: 0,
      permissionDeduction: 0,
      advance: 0,
    })));
  };

  const handlePeriodNext = async () => {
    setLoadingStep2(true);
    setAttFromSaved(false);
    setAttValidationError(null);

    const typeFiltered = employees.filter(e =>
      runType === 'WEEKLY' ? isWeeklyEmployee(e) : !isWeeklyEmployee(e)
    );
    const filtered = category === 'ALL'
      ? typeFiltered
      : typeFiltered.filter(e => e.payrollConfig?.salaryType === category);

    const defaultRows: AttRow[] = filtered.map(e => ({
      employeeId: Number(e.id),
      name: e.fullName,
      code: e.empCode,
      salaryType: e.payrollConfig?.salaryType ?? 'FIXED_MONTHLY',
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      otHours: 0,
      otAmount: 0,
      otDays: 0,
      otDaysAmount: 0,
      teaOtCount: 0,
      teaOtAmount: 0,
      lateMinutes: 0,
      lateDeduction: 0,
      dailyLateMinutes: [],
      permissionMinutes: 0,
      permissionDeduction: 0,
      advance: 0,
    }));

    // Load saved attendance records
    let allRecords: any[] = [];

    try {
      allRecords = await payrollService.getAttendance(period);
    } catch {
      // attendance fetch failed — allRecords stays empty
    }

    // ── Validate: every employee must have all days of the period entered ──────
    const expectedDays = runType === 'WEEKLY' ? 7 : calDays;

    // Deduplicate records by employeeId and date to avoid duplicate counts
    const uniqueMap = new Map<string, any>();
    allRecords.forEach((r: any) => {
      uniqueMap.set(`${r.employeeId}-${r.date}`, r);
    });
    const uniqueRecords = Array.from(uniqueMap.values());

    // Count how many dates each employee has recorded
    const empDateCount: Record<number, number> = {};
    uniqueRecords.forEach((r: any) => {
      const empId = Number(r.employeeId);
      empDateCount[empId] = (empDateCount[empId] ?? 0) + 1;
    });

    const incomplete = filtered.filter(e => (empDateCount[Number(e.id)] ?? 0) < expectedDays);

    if (incomplete.length > 0) {
      setAttValidationError({
        employees: incomplete.map(e => ({
          name: e.fullName,
          code: e.empCode,
          entered: empDateCount[Number(e.id)] ?? 0,
          expected: expectedDays,
        })),
      });
      setLoadingStep2(false);
      return; // Block — do NOT proceed to Step 2
    }

    // ── All employees complete — aggregate attendance ──────────────────────────
    type Agg = {
      present: number;
      absent: number;
      half: number;
      ot: number;
      otAmount: number;
      otDays: number;
      otDaysAmount: number;
      teaOt: number;
      teaOtAmount: number;
      late: number;
      lateDeduction: number;
      dailyLate: number[];
      perm: number;
      permissionDeduction: number;
      adv: number;
    };
    const agg: Record<number, Agg> = {};
    uniqueRecords.forEach((r: any) => {
      const empId = Number(r.employeeId);
      if (!agg[empId]) agg[empId] = {
        present: 0, absent: 0, half: 0,
        ot: 0, otAmount: 0,
        otDays: 0, otDaysAmount: 0,
        teaOt: 0, teaOtAmount: 0,
        late: 0, lateDeduction: 0,
        dailyLate: [],
        perm: 0, permissionDeduction: 0,
        adv: 0,
      };
      if (r.status === 'PRESENT') agg[empId].present++;
      if (runType === 'MONTHLY' && (r.status === 'WEEKLY_OFF' || r.status === 'HOLIDAY' || r.status === 'LEAVE_PAID')) agg[empId].present++;
      if (r.status === 'ABSENT' || r.status === 'LEAVE_UNPAID') agg[empId].absent++;
      if (r.status === 'HALF_DAY') agg[empId].half++;
      agg[empId].ot += Number(r.otHours || 0);
      agg[empId].otAmount += Number(r.otAmount || 0);
      agg[empId].otDays += Number(r.otDays || 0);
      agg[empId].otDaysAmount += Number(r.otDaysAmount || 0);
      agg[empId].teaOt += Number(r.teaOtCount || 0);
      agg[empId].teaOtAmount += Number(r.teaOtAmount || 0);
      agg[empId].late += Number(r.lateMinutes || 0);
      agg[empId].lateDeduction += Number(r.lateDeduction || 0);
      agg[empId].dailyLate.push(Number(r.lateMinutes || 0));
      agg[empId].perm += Number(r.permissionMinutes || 0);
      agg[empId].permissionDeduction += Number(r.permissionDeduction || 0);
    });

    // ── Load salary advances disbursed within this period ─────────────────────
    const selectedWeekOpt = getWeeksOfMonth(year, weekMonth).find(o => o.weekOfMonth === weekOfMonth);
    const dateFrom = runType === 'WEEKLY' && selectedWeekOpt
      ? selectedWeekOpt.startDate
      : `${year}-${String(month).padStart(2, '0')}-01`;
    const dateTo = runType === 'WEEKLY' && selectedWeekOpt
      ? selectedWeekOpt.endDate
      : `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    const advanceMap: Record<number, number> = {};
    try {
      const pendingAdvances = await payrollService.listAdvances({ status: 'PENDING', dateTo });
      pendingAdvances.forEach(adv => {
        const empId = Number(adv.employeeId);
        const outstanding = Number(adv.amount) - Number(adv.recoveredAmount);
        if (outstanding > 0) {
          advanceMap[empId] = (advanceMap[empId] ?? 0) + outstanding;
        }
      });
      const partialAdvances = await payrollService.listAdvances({ status: 'PARTIAL', dateTo });
      partialAdvances.forEach(adv => {
        const empId = Number(adv.employeeId);
        const outstanding = Number(adv.amount) - Number(adv.recoveredAmount);
        if (outstanding > 0) {
          advanceMap[empId] = (advanceMap[empId] ?? 0) + outstanding;
        }
      });
    } catch {
      // advance fetch failed — no advance amounts shown
    }

    // ── Merge attendance + advances into rows ─────────────────────────────────
    let rows = defaultRows;
    if (allRecords.length > 0) {
      rows = defaultRows.map(row => {
        const a = agg[row.employeeId];
        return {
          ...row,
          presentDays: a?.present ?? 0,
          absentDays: a?.absent ?? 0,
          halfDays: a?.half ?? 0,
          otHours: a?.ot ?? 0,
          otAmount: a?.otAmount ?? 0,
          otDays: a?.otDays ?? 0,
          otDaysAmount: a?.otDaysAmount ?? 0,
          teaOtCount: a?.teaOt ?? 0,
          teaOtAmount: a?.teaOtAmount ?? 0,
          lateMinutes: a?.late ?? 0,
          lateDeduction: a?.lateDeduction ?? 0,
          dailyLateMinutes: a?.dailyLate ?? [],
          permissionMinutes: a?.perm ?? 0,
          permissionDeduction: a?.permissionDeduction ?? 0,
          advance: advanceMap[row.employeeId] ?? 0,
        };
      });
      setAttFromSaved(true);
    }

    setCategory(category);
    setAttRows(rows);
    setLoadingStep2(false);
    setStep(2);
  };

  const handleAdvanceChange = async (empId: number, amount: number) => {
    const updatedRows = attRows.map(r => Number(r.employeeId) === Number(empId) ? { ...r, advance: amount } : r);
    setAttRows(updatedRows);

    if (currentRun) {
      const attendance: AttendanceInput[] = updatedRows.map(r => ({
        employeeId: Number(r.employeeId),
        presentDays: r.presentDays,
        absentDays: r.absentDays,
        halfDays: r.halfDays,
        otHours: r.otHours,
        otAmount: (r as any).otAmount ?? 0,
        otDays: r.otDays,
        otDaysAmount: (r as any).otDaysAmount ?? 0,
        teaOtCount: r.teaOtCount,
        teaOtAmount: (r as any).teaOtAmount ?? 0,
        lateMinutes: r.lateMinutes,
        lateDeduction: (r as any).lateDeduction ?? 0,
        dailyLateMinutes: r.dailyLateMinutes ?? [],
        permissionMinutes: r.permissionMinutes,
        permissionDeduction: (r as any).permissionDeduction ?? 0,
        advance: Number(r.employeeId) === Number(empId) ? amount : r.advance,
      }));
      try {
        const run = await payrollService.computeRun({ period, type: runType, employeeCategory: category, calendarDays: calDays, attendance });
        setCurrentRun(run);
      } catch (e: any) {
        console.error('Failed to recalculate advance:', e);
      }
    }
  };

  const handleCalculate = async () => {
    setComputeErr('');
    const attendance: AttendanceInput[] = attRows.map(r => ({
      employeeId: r.employeeId,
      presentDays: r.presentDays,
      absentDays: r.absentDays,
      halfDays: r.halfDays,
      otHours: r.otHours,
      otAmount: (r as any).otAmount ?? 0,
      otDays: r.otDays,
      otDaysAmount: (r as any).otDaysAmount ?? 0,
      teaOtCount: r.teaOtCount,
      teaOtAmount: (r as any).teaOtAmount ?? 0,
      lateMinutes: r.lateMinutes,
      lateDeduction: (r as any).lateDeduction ?? 0,
      dailyLateMinutes: r.dailyLateMinutes ?? [],
      permissionMinutes: r.permissionMinutes,
      permissionDeduction: (r as any).permissionDeduction ?? 0,
      advance: r.advance,
    }));
    try {
      if (currentRun) {
        await payrollService.deleteRun(currentRun.id);
      }
      const run = await payrollService.computeRun({ period, type: runType, employeeCategory: category, calendarDays: calDays, attendance });
      setCurrentRun(run);
      setStep(3);
    } catch (e: any) {
      setComputeErr(e?.response?.data?.message ?? 'Computation failed. Please try again.');
      setComputing(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-line-soft px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink">Run Payroll</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              {periodLabel} · {runType === 'MONTHLY' ? 'Monthly' : 'Weekly'} Run
            </p>
          </div>
          {step > 1 && currentRun && (
            <div className="bg-card-2 rounded-lg border border-line-soft px-4 py-2 text-sm">
              <span className="text-ink-subtle">Run: </span>
              <span className="font-mono text-xs text-ink font-bold">{currentRun.runCode}</span>
              <span className="mx-2 text-line-soft">·</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${currentRun.status === 'LOCKED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                currentRun.status === 'APPROVED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>{currentRun.status}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stepper */}
      <StepHeader current={step} />

      {/* Content */}
      <div className="flex-1 p-6">
        {step === 1 && (
          loadingEmp
            ? <CommonLoader text="Loading employees…" fullScreen={false} />
            : <Step1
              runType={runType} setRunType={setRunType}
              month={month} setMonth={setMonth}
              year={year} setYear={setYear}
              weekMonth={weekMonth} setWeekMonth={setWeekMonth}
              weekOfMonth={weekOfMonth} setWeekOfMonth={setWeekOfMonth}
              category={category} setCategory={handleCategoryChange}
              calDays={calDays}
              employees={employees}
              loading={loadingStep2}
              onNext={handlePeriodNext}
              attValidationError={attValidationError}
            />
        )}

        {step === 2 && (
          <Step2
            rows={attRows}
            hasData={attFromSaved}
            period={period}
            calDays={calDays}
            runType={runType}
            onBack={() => setStep(1)}
            onNext={handleCalculate}
            onAdvanceChange={handleAdvanceChange}
          />
        )}

        {step === 2 && computeErr && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 max-w-xl">
            <AlertTriangle size={15} /> {computeErr}
          </div>
        )}

        {step === 3 && currentRun && (
          <Step3 run={currentRun} onBack={() => setStep(2)} onNext={() => setStep(currentRun.status === 'APPROVED' ? 5 : 4)} onAdvanceChange={handleAdvanceChange} />
        )}

        {step === 4 && currentRun && (
          <Step4
            run={currentRun}
            onBack={() => setStep(3)}
            onApproved={updated => { setCurrentRun(updated); setStep(5); }}
          />
        )}

        {step === 5 && currentRun && (
          <Step5 run={currentRun} onBack={() => setStep(4)} />
        )}
      </div>

      {/* Computing overlay */}
      {computing && <ComputingOverlay progress={progress} />}
    </div>
  );
};

export default PayrollRun;
