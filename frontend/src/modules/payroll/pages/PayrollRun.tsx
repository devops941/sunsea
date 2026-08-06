import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarRange, CalendarDays, PlayCircle, Eye, CheckCircle2, Lock,
  ChevronRight, ChevronLeft, AlertTriangle,
  IndianRupee, FileText, Download, X, Check,
  Building2, Wallet, TrendingUp, Info, Loader2, ClipboardList,
} from 'lucide-react';
import { useSocket } from '../../../providers/SocketProvider';
import { usePermission } from '../../../hooks/usePermission';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import { payrollService } from '../../../services/payrollService';
import type { ApiPayrollRun, ApiEmployeePayroll, AttendanceInput, ApiPayrollResult } from '../../../services/payrollService';
import DataTable, { type DataTableColumn } from '../../../components/ui/table/DataTable';

// ─── Steps ───────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Select Period',        icon: CalendarRange  },
  { id: 2, label: 'Review Attendance',    icon: ClipboardList  },
  { id: 3, label: 'Calculate & Preview',  icon: Eye            },
  { id: 4, label: 'Approve',              icon: CheckCircle2   },
  { id: 5, label: 'Lock & Disburse',      icon: Lock           },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmt    = (n: number) => n.toLocaleString('en-IN');
const fmtRs  = (n: number) => `₹${fmt(Math.round(Number(n)))}`;
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
  const total = daysInMonth(year, month);
  const mm = String(month).padStart(2, '0');
  const opts: WeekOption[] = [];
  let weekOfMonth = 1;
  for (let startDay = 1; startDay <= total; startDay += 7) {
    const endDay = Math.min(startDay + 6, total);
    const startDate = `${year}-${mm}-${String(startDay).padStart(2, '0')}`;
    const endDate   = `${year}-${mm}-${String(endDay).padStart(2, '0')}`;
    const { week: isoWeek, year: isoYear } = getISOWeekInfo(new Date(year, month - 1, startDay));
    opts.push({
      weekOfMonth,
      startDay,
      endDay,
      startDate,
      endDate,
      isoWeek,
      isoYear,
      label: `Week ${weekOfMonth}  (${MONTHS_SHORT[month - 1]} ${startDay}–${endDay})`,
    });
    weekOfMonth++;
  }
  return opts;
}

type SalaryCategory = 'ALL' | 'FIXED_MONTHLY' | 'PF_MONTHLY' | 'CASH_MONTHLY' | 'DAILY_WEEKLY' | 'WEEKLY';

const CATEGORIES: { value: SalaryCategory; label: string }[] = [
  { value: 'ALL',           label: 'All Employees'          },
  { value: 'FIXED_MONTHLY', label: 'Fixed Monthly (Admin)'  },
  { value: 'PF_MONTHLY',    label: 'PF Workers (Monthly)'   },
  { value: 'CASH_MONTHLY',  label: 'Cash Monthly'           },
  { value: 'DAILY_WEEKLY',  label: 'Daily Wage (Weekly)'    },
  { value: 'WEEKLY',        label: 'Weekly Salary'          },
];

// ─── Stepper ──────────────────────────────────────────────────────────────────
const StepHeader: React.FC<{ current: number }> = ({ current }) => (
  <div className="bg-white border-b border-border px-6 py-4">
    <div className="flex items-center max-w-4xl mx-auto">
      {STEPS.map((step, idx) => {
        const done   = current > step.id;
        const active = current === step.id;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 font-bold text-sm transition-all ${
                done   ? 'bg-emerald-500 border-emerald-500 text-white' :
                active ? 'bg-primary border-primary text-white shadow-md' :
                         'bg-white border-border text-text-muted'
              }`}>
                {done ? <Check size={16} /> : <step.icon size={14} />}
              </div>
              <span className={`mt-1.5 text-[10px] font-semibold text-center leading-tight whitespace-nowrap ${
                active ? 'text-primary' : done ? 'text-emerald-600' : 'text-text-muted'
              }`}>{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 transition-colors ${done ? 'bg-emerald-400' : 'bg-border'}`} />
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
  year: number;  setYear:  (y: number) => void;
  weekMonth: number;    setWeekMonth:    (m: number) => void;
  weekOfMonth: number;  setWeekOfMonth:  (w: number) => void;
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
    e.payrollConfig?.salaryType === 'DAILY_WEEKLY' || e.salaryType === 'daily' || e.salaryType === 'weekly';

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
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-text-primary">Select Payroll Period</h2>
        <p className="text-sm text-text-secondary mt-0.5">Choose the period type and employee category for this run.</p>
      </div>

      {/* Type toggle */}
      <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Payroll Type</p>
        <div className="flex gap-3">
          {(['MONTHLY','WEEKLY'] as const).map(t => (
            <button key={t} onClick={() => setRunType(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-semibold text-sm transition-all ${
                runType === t ? 'border-primary bg-red-50 text-primary' : 'border-border bg-white text-text-secondary hover:border-primary/40'
              }`}>
              {t === 'MONTHLY'
                ? <><CalendarRange size={16} /> Monthly Payroll</>
                : <><CalendarDays  size={16} /> Weekly Payroll</>}
            </button>
          ))}
        </div>

        {runType === 'MONTHLY' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Month</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700 font-semibold">Period</p>
                <p className="text-sm font-bold text-emerald-800">{MONTHS[month-1]} {year}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700 font-semibold">Calendar Days</p>
                <p className="text-sm font-bold text-emerald-800 text-right">{calDays} days</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">Month</label>
                <select value={weekMonth} onChange={e => { setWeekMonth(Number(e.target.value)); setWeekOfMonth(1); }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                  {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">Year</label>
                <select value={year} onChange={e => { setYear(Number(e.target.value)); setWeekOfMonth(1); }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                  {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Select Week</label>
              <div className="grid grid-cols-1 gap-2">
                {weekOptions.map(opt => (
                  <button
                    key={opt.weekOfMonth}
                    onClick={() => setWeekOfMonth(opt.weekOfMonth)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                      weekOfMonth === opt.weekOfMonth
                        ? 'border-primary bg-red-50 text-primary'
                        : 'border-border bg-white text-text-secondary hover:border-primary/40'
                    }`}
                  >
                    <span className="font-semibold">{opt.label}</span>
                    <span className={`text-xs ${weekOfMonth === opt.weekOfMonth ? 'text-primary/70' : 'text-text-muted'}`}>
                      {opt.endDay - opt.startDay + 1} days
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {selectedWeek && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 font-semibold">Selected Period</p>
                  <p className="text-sm font-bold text-emerald-800">
                    {MONTHS_SHORT[weekMonth - 1]} {selectedWeek.startDay}–{selectedWeek.endDay}, {year}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-emerald-700 font-semibold">Days</p>
                  <p className="text-sm font-bold text-emerald-800">{calDays} days</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category */}
      <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-3">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Employee Category</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CATEGORIES.filter(c => runType === 'WEEKLY' ? c.value === 'DAILY_WEEKLY' || c.value === 'ALL' : true).map(c => {
            const count = typeFiltered.filter(e =>
              c.value === 'ALL' || e.payrollConfig?.salaryType === c.value
            ).length;
            return (
              <button key={c.value} onClick={() => setCategory(c.value)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  category === c.value ? 'border-primary bg-red-50 text-primary ring-2 ring-offset-1 ring-primary/20' : 'border-border bg-white text-text-secondary hover:border-primary/40'
                }`}>
                <span className={`w-2 h-2 rounded-full ${category === c.value ? 'bg-primary' : 'bg-border'}`} />
                {c.label}
                <span className="ml-auto text-xs text-text-muted">{count} emp</span>
              </button>
            );
          })}
        </div>
        {filtered.length > 0 && (
          <p className="text-xs text-text-secondary pt-1">
            <span className="font-semibold text-text-primary">{filtered.length}</span> employees will be included in this run.
          </p>
        )}
        {noConfig > 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="font-semibold">{noConfig}</span> employee{noConfig > 1 ? 's' : ''} skipped — no payroll config set up. Go to <strong>Payroll Settings → Employee Config</strong> to configure them.
          </p>
        )}
      </div>

      {/* Attendance validation error — blocks run if any employee has incomplete entries */}
      {attValidationError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">
                Attendance incomplete — payroll run blocked
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                All {attValidationError.employees[0]?.expected}-day entries must be saved for every employee before running payroll.
                Go to <strong>Attendance Entry</strong> and fill all days, then try again.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-red-200 bg-white overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-100 text-red-700">
                  <th className="text-left px-3 py-2 font-semibold">Employee</th>
                  <th className="text-center px-3 py-2 font-semibold">Days Entered</th>
                  <th className="text-center px-3 py-2 font-semibold">Required</th>
                  <th className="text-center px-3 py-2 font-semibold">Missing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {attValidationError.employees.map((e, i) => (
                  <tr key={i} className="text-slate-700">
                    <td className="px-3 py-2">
                      <span className="font-medium">{e.name}</span>
                      <span className="text-slate-400 ml-1">({e.code})</span>
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-red-600 font-semibold">{e.entered}</td>
                    <td className="px-3 py-2 text-center font-mono">{e.expected}</td>
                    <td className="px-3 py-2 text-center font-mono text-red-700 font-bold">{e.expected - e.entered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={onNext} disabled={filtered.length === 0 || loading}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
          {loading
            ? <><Loader2 size={15} className="animate-spin" /> Checking Attendance…</>
            : <>Next: Review Attendance <ChevronRight size={16} /></>}
        </button>
      </div>
    </div>
  );
};

// ─── Step 2: Attendance Review (read-only from AttendancePage data) ───────────
interface AttRow extends AttendanceInput { name: string; code: string; salaryType: string; }


const Step2: React.FC<{
  rows: AttRow[];
  hasData: boolean;
  period: string;
  calDays: number;
  onBack: () => void;
  onNext: () => void;
}> = ({ rows, hasData, period, calDays, onBack, onNext }) => {
  const navigate = useNavigate();

  // Summary totals
  const totals = rows.reduce(
    (acc, r) => ({
      present: acc.present + Number(r.presentDays || 0),
      absent:  acc.absent  + Number(r.absentDays || 0),
      half:    acc.half    + Number(r.halfDays || 0),
      ot:      acc.ot      + Number(r.otHours || 0),
      adv:     acc.adv     + Number(r.advance || 0),
    }),
    { present: 0, absent: 0, half: 0, ot: 0, adv: 0 }
  );

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
          <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
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
          <span className="font-normal normal-case text-slate-400">/ {calDays}d</span>
        </span>
      ),
      align: "center",
      render: (row) => (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
          {row.presentDays}
        </span>
      ),
    },
    {
      header: "ABSENT",
      align: "center",
      render: (row) => (
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
            row.absentDays > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'
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
          <span className="font-normal normal-case text-slate-400">Day</span>
        </span>
      ),
      align: "center",
      render: (row) => (
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
            row.halfDays > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
          }`}
        >
          {row.halfDays > 0 ? row.halfDays : '—'}
        </span>
      ),
    },
    {
      header: "OT HRS",
      headerNode: (
        <span>
          OT <br />
          <span className="font-normal normal-case text-slate-400">Hrs</span>
        </span>
      ),
      align: "center",
      render: (row) => (
        <span className={`font-mono text-sm ${row.otHours > 0 ? 'text-blue-600 font-semibold' : 'text-text-muted'}`}>
          {row.otHours > 0 ? row.otHours.toFixed(1) : '—'}
        </span>
      ),
    },
    {
      header: "LATE MIN",
      headerNode: (
        <span>
          LATE <br />
          <span className="font-normal normal-case text-slate-400">min</span>
        </span>
      ),
      align: "center",
      render: (row) => (
        <span className={`font-mono text-sm ${row.lateMinutes > 0 ? 'text-orange-600' : 'text-text-muted'}`}>
          {row.lateMinutes > 0 ? row.lateMinutes : '—'}
        </span>
      ),
    },
    {
      header: "PERM MIN",
      headerNode: (
        <span>
          PERM <br />
          <span className="font-normal normal-case text-slate-400">min</span>
        </span>
      ),
      align: "center",
      render: (row) => (
        <span className={`font-mono text-sm ${row.permissionMinutes > 0 ? 'text-orange-600' : 'text-text-muted'}`}>
          {row.permissionMinutes > 0 ? row.permissionMinutes : '—'}
        </span>
      ),
    },
    {
      header: "ADVANCE ₹",
      align: "right",
      render: (row) => (
        <span className={`font-mono text-sm ${row.advance > 0 ? 'text-violet-700 font-semibold' : 'text-text-muted'}`}>
          {row.advance > 0 ? `₹${row.advance.toLocaleString('en-IN')}` : '—'}
        </span>
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-text-secondary rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
        >
          <ClipboardList size={13} /> Edit Attendance
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Present',   value: totals.present, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          { label: 'Total Absent',    value: totals.absent,  cls: 'text-red-600 bg-red-50 border-red-200'             },
          { label: 'Total Half Days', value: totals.half,    cls: 'text-amber-600 bg-amber-50 border-amber-200'       },
          { label: 'Total OT Hours',  value: totals.ot.toFixed(1), cls: 'text-blue-600 bg-blue-50 border-blue-200'   },
          { label: 'Total Advance',   value: `₹${totals.adv.toLocaleString('en-IN')}`, cls: 'text-violet-600 bg-violet-50 border-violet-200' },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-3.5 ${c.cls}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{c.label}</p>
            <p className="text-xl font-bold mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Per-employee attendance breakdown using reusable DataTable component */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
        {/* Total Summary Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-wrap justify-between items-center text-xs font-mono">
          <span className="font-bold text-slate-800 text-sm">TOTAL ({rows.length} employees)</span>
          <div className="flex gap-6 flex-wrap justify-end font-semibold">
            <span className="text-emerald-700">Present: {totals.present}</span>
            <span className="text-red-600">Absent: {totals.absent}</span>
            <span className="text-amber-600">Half: {totals.half}</span>
            <span className="text-blue-600 font-mono">OT: {totals.ot.toFixed(1)}h</span>
            <span className="text-violet-700 font-mono">Advance: {totals.adv > 0 ? `₹${totals.adv.toLocaleString('en-IN')}` : '—'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-700">
        <Info size={14} className="shrink-0" />
        This attendance is pulled from the Attendance module. LOP days and exact deductions are computed by the payroll engine.
        If data looks wrong, click <strong className="ml-0.5">Edit Attendance</strong> to update it.
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <button onClick={onNext} className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors shadow-sm">
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 space-y-6 text-center">
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
          <div className="w-full bg-slate-100 rounded-full h-2.5">
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
}> = ({ run, onBack, onNext }) => {
  const results   = run.results || [];
  const variances = results.filter(r => r.hasVariance);

  const columns: DataTableColumn<ApiPayrollResult>[] = [
    {
      header: "Employee",
      align: "left",
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.hasVariance && <AlertTriangle size={11} className="text-amber-500 shrink-0" />}
          <div>
            <p className="font-semibold text-text-primary text-xs">{r.employeeName}</p>
            <p className="text-[10px] text-text-muted">{r.employeeCode}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Pres / LOP",
      align: "center",
      render: (r) => (
        <div className="text-xs">
          <span className="text-emerald-600 font-semibold">{Number(r.presentDays).toFixed(1)}</span>
          <span className="text-text-muted"> / </span>
          <span className={Number(r.lopDays) > 0 ? 'text-red-500 font-semibold' : 'text-text-muted'}>
            {Number(r.lopDays).toFixed(1)}
          </span>
        </div>
      ),
    },
    {
      header: "Daily Rate",
      align: "right",
      render: (r) => (
        <span
          className="font-mono text-xs cursor-help"
          title={r.monthlySalary !== undefined
            ? `Daily Rate = ₹${r.monthlySalary.toLocaleString('en-IN')} ÷ ${r.formulaDivisor || 1} days\n= ${fmtDec(Number(r.dailyRate))}/day`
            : `Daily Rate\n= ${fmtDec(Number(r.dailyRate))}/day`}
        >
          {fmtDec(Number(r.dailyRate))}
        </span>
      ),
    },
    {
      header: "Earned",
      align: "right",
      render: (r) => (
        <span
          className="font-mono text-xs cursor-help"
          title={`Earned = Daily Rate × Payable Days\n= ${fmtDec(Number(r.dailyRate))} × ${Number(r.presentDays).toFixed(1)}d\n= ${fmtDec(Number(r.earnedSalary))}`}
        >
          {fmtRs(Number(r.earnedSalary))}
        </span>
      ),
    },
    {
      header: "OT Pay",
      align: "right",
      render: (r) => (
        <span
          className="font-mono text-xs text-emerald-600 cursor-help"
          title={Number(r.otHours) > 0
            ? `OT = ${r.otHours}h × ₹${Number(r.otHours) > 0 ? (Number(r.otPay) / Number(r.otHours)).toFixed(2) : 0}/h\n= ${fmtDec(Number(r.otPay))}`
            : 'No overtime'}
        >
          {Number(r.otPay) > 0 ? fmtRs(Number(r.otPay)) : '—'}
        </span>
      ),
    },
    {
      header: "Gross",
      align: "right",
      render: (r) => (
        <span
          className="font-mono text-xs font-semibold cursor-help"
          title={`Gross = Earned + OT\n= ${fmtDec(Number(r.earnedSalary))} + ${fmtDec(Number(r.otPay))}\n= ${fmtDec(Number(r.grossSalary))}`}
        >
          {fmtRs(Number(r.grossSalary))}
        </span>
      ),
    },
    {
      header: "Emp PF",
      align: "right",
      render: (r) => (
        <span
          className="font-mono text-xs text-red-500 cursor-help"
          title={r.pfApplicable
            ? `PF Wage: ₹${Number(r.pfWage).toLocaleString('en-IN')}\nEmployee PF @ 12%\n= ${fmtRs(Number(r.employeePf))}`
            : 'PF not applicable'}
        >
          {r.pfApplicable ? fmtRs(Number(r.employeePf)) : '—'}
        </span>
      ),
    },
    {
      header: "Emp ESI",
      align: "right",
      render: (r) => (
        <span
          className="font-mono text-xs text-red-500 cursor-help"
          title={r.esiApplicable
            ? `ESI on Gross ₹${fmtRs(Number(r.grossSalary))}\nEmployee ESI @ 0.75%\n= ${fmtRs(Number(r.employeeEsi))}`
            : 'ESI not applicable (gross > limit)'}
        >
          {r.esiApplicable ? fmtRs(Number(r.employeeEsi)) : '—'}
        </span>
      ),
    },
    {
      header: "PT",
      align: "right",
      render: (r) => (
        <span
          className="font-mono text-xs text-red-500 cursor-help"
          title={Number(r.professionalTax) > 0
            ? `Professional Tax (monthly slab)\n= ${fmtRs(Number(r.professionalTax))}`
            : 'PT: ₹0 (weekly run — applied in monthly payroll)'}
        >
          {Number(r.professionalTax) > 0 ? fmtRs(Number(r.professionalTax)) : '—'}
        </span>
      ),
    },
    {
      header: "Late Ded",
      align: "right",
      render: (r) => (
        <span
          className="font-mono text-xs text-red-500 cursor-help"
          title={Number(r.lateEntryDeduction) > 0
            ? `Late Entry Deduction\n= ${r.lateMinutes ? r.lateMinutes + ' mins late' : 'Calculated by Slab'}\n= ${fmtRs(Number(r.lateEntryDeduction))}`
            : 'No late entry deduction'}
        >
          {Number(r.lateEntryDeduction) > 0 ? fmtRs(Number(r.lateEntryDeduction)) : '—'}
        </span>
      ),
    },
    {
      header: "Perm Ded",
      align: "right",
      render: (r) => (
        <span
          className="font-mono text-xs text-red-500 cursor-help"
          title={Number(r.permissionDeduction) > 0
            ? `Permission Deduction\n= ${r.permissionMinutes ? r.permissionMinutes + ' mins permission' : 'Calculated by Slab'}\n= ${fmtRs(Number(r.permissionDeduction))}`
            : 'No permission deduction'}
        >
          {Number(r.permissionDeduction) > 0 ? fmtRs(Number(r.permissionDeduction)) : '—'}
        </span>
      ),
    },
    {
      header: "Advance",
      align: "right",
      render: (r) => (
        <span
          className="font-mono text-xs text-red-500 cursor-help"
          title={Number(r.salaryAdvance) > 0
            ? `Salary Advance Recovery\n= ${fmtRs(Number(r.salaryAdvance))}`
            : 'No advance deduction'}
        >
          {Number(r.salaryAdvance) > 0 ? fmtRs(Number(r.salaryAdvance)) : '—'}
        </span>
      ),
    },
    {
      header: "Net",
      align: "right",
      render: (r) => (
        <span
          className="font-mono font-bold text-xs text-text-primary cursor-help"
          title={`Net = Gross − All Deductions\n= ${fmtDec(Number(r.grossSalary))} − ${fmtDec(Number(r.totalDeductions))}\n= ${fmtDec(Number(r.netSalary))}`}
        >
          {fmtRs(Number(r.netSalary))}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Payroll Preview</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {run.period} · {results.length} employees · Run: <span className="font-mono text-xs text-text-muted">{run.runCode}</span>
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-3 py-1.5 border border-border text-text-secondary rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors">
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gross Payroll',  value: fmtRs(Number(run.totalGross || 0)),       icon: TrendingUp,   cls: 'text-blue-600 bg-blue-50'     },
          { label: 'Net Payroll',    value: fmtRs(Number(run.totalNetSalary || 0)),    icon: IndianRupee,  cls: 'text-emerald-600 bg-emerald-50'},
          { label: 'PF Liability',   value: fmtRs(Number(run.totalPfEmployee || 0) + Number(run.totalPfEmployer || 0)), icon: Building2, cls: 'text-violet-600 bg-violet-50' },
          { label: 'ESI Liability',  value: fmtRs(Number(run.totalEsiEmployee || 0) + Number(run.totalEsiEmployer || 0)), icon: FileText, cls: 'text-amber-600 bg-amber-50'  },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{c.label}</p>
              <div className={`p-1.5 rounded-lg ${c.cls}`}><c.icon size={13} /></div>
            </div>
            <p className="text-lg font-bold text-text-primary">{c.value}</p>
          </div>
        ))}
      </div>

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

      {/* Results table using reusable DataTable component */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={results}
          rowKey={(r) => r.id}
          emptyMessage="No payroll results found."
          rowClassName={(r) => (r.hasVariance ? 'border-l-2 border-l-amber-400' : '')}
          density="compact"
        />
        {/* Total Summary Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-wrap justify-between items-center text-xs font-mono">
          <span className="font-bold text-slate-800 text-sm">TOTAL ({results.length} employees)</span>
          <div className="flex gap-4 flex-wrap justify-end font-semibold">
            <span>Earned: {fmtRs(results.reduce((s,r)=>s+Number(r.earnedSalary),0))}</span>
            <span className="text-emerald-600">OT: {fmtRs(results.reduce((s,r)=>s+Number(r.otPay),0))}</span>
            <span className="font-bold text-slate-900">Gross: {fmtRs(run.totalGross)}</span>
            <span className="text-rose-600">PF: {fmtRs(results.reduce((s,r)=>s+Number(r.employeePf),0))}</span>
            <span className="text-rose-600">ESI: {fmtRs(results.reduce((s,r)=>s+Number(r.employeeEsi),0))}</span>
            <span className="text-rose-600">Adv: {fmtRs(results.reduce((s,r)=>s+Number(r.salaryAdvance),0))}</span>
            <span className="font-bold text-emerald-700 text-sm">Net: {fmtRs(run.totalNetSalary)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
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
  const [declared, setDeclared] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const results   = run.results || [];
  const bankRows  = results.filter(r => r.paymentMode === 'BANK');
  const cashRows  = results.filter(r => r.paymentMode === 'CASH');
  const periodLabel = run.period.startsWith('20') && run.period.length === 7
    ? `${MONTHS[parseInt(run.period.split('-')[1], 10) - 1]} ${run.period.split('-')[0]}`
    : run.period;

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
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-text-primary">Approve Payroll Run</h2>
        <p className="text-sm text-text-secondary mt-0.5">Review the summary and approve to proceed to disbursement.</p>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <h3 className="text-sm font-bold text-text-primary border-b border-border pb-3 mb-4">Run Summary — {periodLabel}</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Employees', value: `${results.length}` },
            { label: 'Net Payroll',     value: fmtRs(run.totalNetSalary), bold: true },
            { label: 'Bank Transfer',   value: fmtRs(bankRows.reduce((s,r)=>s+Number(r.netSalary),0)) },
            { label: 'Cash Payment',    value: fmtRs(cashRows.reduce((s,r)=>s+Number(r.netSalary),0)) },
            { label: 'Employee PF',     value: fmtRs(run.totalPfEmployee) },
            { label: 'Employer PF',     value: fmtRs(run.totalPfEmployer) },
            { label: 'Employee ESI',    value: fmtRs(run.totalEsiEmployee) },
            { label: 'Employer ESI',    value: fmtRs(run.totalEsiEmployer) },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-sm text-text-secondary">{item.label}</span>
              <span className={`font-semibold ${item.bold ? 'text-primary text-base' : 'text-text-primary text-sm'}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment mode list */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-border">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Payment Mode Breakdown</p>
        </div>
        <div className="divide-y divide-border max-h-56 overflow-y-auto">
          {results.map(r => (
            <div key={r.id} className="flex items-center justify-between px-5 py-2.5">
              <div>
                <p className="text-sm font-semibold text-text-primary">{r.employeeName}</p>
                <p className="text-xs text-text-muted">{r.employeeCode}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${
                  r.paymentMode === 'BANK' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {r.paymentMode === 'BANK' ? <Building2 size={10} /> : <Wallet size={10} />} {r.paymentMode}
                </span>
                <span className="font-mono font-semibold text-sm text-text-primary">{fmtRs(Number(r.netSalary))}</span>
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
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
          <ChevronLeft size={16} /> Back to Preview
        </button>
        {canEditRun && (
          <button onClick={handleApprove} disabled={!declared || loading}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all ${
              declared && !loading ? 'bg-primary text-white hover:bg-red-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}>
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Approving…</>
              : <><CheckCircle2 size={15} /> Approve Payroll</>
            }
          </button>
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
  const navigate   = useNavigate();
  const { can } = usePermission();
  const canEditRun = can("payroll-run.edit");
  const [showModal, setShowModal] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [locked,    setLocked]    = useState(false);
  const [error,     setError]     = useState('');
  const { socket }  = useSocket();

  const results  = run.results || [];
  const bankRows = results.filter(r => r.paymentMode === 'BANK');
  const cashRows = results.filter(r => r.paymentMode === 'CASH');
  const bankTotal = bankRows.reduce((s,r) => s + Number(r.netSalary), 0);
  const cashTotal = cashRows.reduce((s,r) => s + Number(r.netSalary), 0);

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
        <span className="font-mono font-semibold text-text-primary text-xs">
          {fmtRs(Number(r.netSalary))}
        </span>
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
        <span className="font-mono font-semibold text-text-primary text-xs">
          {fmtRs(Number(r.netSalary))}
        </span>
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
      String(r.netSalary)
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
            {run.period} payroll has been finalised for {results.length} employees.
          </p>
        </div>
        <div className="bg-slate-50 rounded-xl border border-border p-5 text-left space-y-2">
          <div className="flex justify-between text-sm"><span className="text-text-secondary">Bank Transfers</span><span className="font-semibold text-text-primary">{fmtRs(bankTotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-text-secondary">Cash Payments</span><span className="font-semibold text-text-primary">{fmtRs(cashTotal)}</span></div>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Net Payroll', value: fmtRs(run.totalNetSalary), icon: IndianRupee, cls: 'text-text-primary bg-slate-100' },
          { label: 'Bank Transfer',     value: fmtRs(bankTotal),           icon: Building2,   cls: 'text-blue-700 bg-blue-50'      },
          { label: 'Cash Payment',      value: fmtRs(cashTotal),           icon: Wallet,      cls: 'text-emerald-700 bg-emerald-50'},
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-border p-5 shadow-sm flex items-center gap-4">
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
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
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
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-xs font-bold text-text-primary">
            <span>TOTAL BANK</span>
            <span className="font-mono text-blue-700 text-sm">{fmtRs(bankTotal)}</span>
          </div>
        </div>
      )}

      {/* Cash table using reusable DataTable component */}
      {cashRows.length > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
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
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-xs font-bold text-text-primary">
            <span>TOTAL CASH</span>
            <span className="font-mono text-emerald-700 text-sm">{fmtRs(cashTotal)}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
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
              You are about to <strong>lock {run.period} payroll</strong> for{' '}
              <strong>{results.length} employees</strong> totalling <strong>{fmtRs(run.totalNetSalary)}</strong>.
              Once locked, no changes can be made.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-border text-text-secondary rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors">
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
  const [searchParams]  = useSearchParams();
  const initType        = searchParams.get('type') === 'weekly' ? 'WEEKLY' : 'MONTHLY';
  const { socket }      = useSocket();

  const [step, setStep] = useState(1);

  // Step 1 state
  const [runType,      setRunType]      = useState<'WEEKLY' | 'MONTHLY'>(initType);
  const [month,        setMonth]        = useState(new Date().getMonth() + 1);
  const [year,         setYear]         = useState(new Date().getFullYear());
  const [weekMonth,    setWeekMonth]    = useState(new Date().getMonth() + 1);
  const [weekOfMonth,  setWeekOfMonth]  = useState(Math.ceil(new Date().getDate() / 7));
  const [category,     setCategory]     = useState<SalaryCategory>('ALL');

  // Auto-calculate calDays
  const calDays = useMemo(() => {
    if (runType === 'WEEKLY') {
      const opts = getWeeksOfMonth(year, weekMonth);
      const opt  = opts.find(o => o.weekOfMonth === weekOfMonth) ?? opts[0];
      return opt ? opt.endDay - opt.startDay + 1 : 7;
    }
    return daysInMonth(year, month);
  }, [runType, year, month, weekMonth, weekOfMonth]);

  // Data from API
  const [employees,  setEmployees]  = useState<ApiEmployeePayroll[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(true);

  // Step 2 state
  const [attRows, setAttRows] = useState<AttRow[]>([]);

  // Step 3 computing state
  const [computing,      setComputing]      = useState(false);
  const [progress,       setProgress]       = useState<ProgressState>({ current: 0, total: 0, currentEmployee: '', runCode: '' });
  const [currentRun,     setCurrentRun]     = useState<ApiPayrollRun | null>(null);
  const [computeErr,     setComputeErr]     = useState('');
  const [loadingStep2,      setLoadingStep2]      = useState(false);
  const [attFromSaved,      setAttFromSaved]      = useState(false);
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

        // Fetch attendance for the period to populate Step 2 attRows in case they go back
        let lookupPeriod: string;
        let weekStartDay = 1;
        let weekEndDay   = run.calendarDays;

        if (run.type === 'WEEKLY') {
          const [y, wStr] = run.period.split('-W');
          const isoYear = Number(y);
          const isoWeek = Number(wStr);
          
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
          lookupPeriod = `${isoYear}-${String(wMonth).padStart(2, '0')}`;
          const opts = getWeeksOfMonth(isoYear, wMonth);
          const opt  = opts.find(o => o.weekOfMonth === wOfM) ?? opts[0];
          if (opt) { weekStartDay = opt.startDay; weekEndDay = opt.endDay; }
        } else {
          lookupPeriod = run.period;
        }

        const allRecords = await payrollService.getAttendance(lookupPeriod);
        let filteredRecords = allRecords;
        if (run.type === 'WEEKLY') {
          filteredRecords = allRecords.filter((r: any) => {
            const day = parseInt(r.date.split('-')[2], 10);
            return day >= weekStartDay && day <= weekEndDay;
          });
        }

        const typeFiltered = employees.filter(e =>
          run.type === 'WEEKLY' ? isWeeklyEmployee(e) : !isWeeklyEmployee(e)
        );
        const filtered = run.employeeCategory === 'ALL'
          ? typeFiltered
          : typeFiltered.filter(e => e.payrollConfig?.salaryType === run.employeeCategory);

        const defaultRows: AttRow[] = filtered.map(e => ({
          employeeId:        Number(e.id),
          name:              e.fullName,
          code:              e.empCode,
          salaryType:        e.payrollConfig?.salaryType ?? 'FIXED_MONTHLY',
          presentDays:       0,
          absentDays:        0,
          halfDays:          0,
          otHours:           0,
          lateMinutes:       0,
          dailyLateMinutes:  [],
          permissionMinutes: 0,
          advance:           0,
        }));

        let rows = defaultRows;
        if (filteredRecords.length > 0) {
          type Agg = { present: number; absent: number; half: number; ot: number; late: number; dailyLate: number[]; perm: number; adv: number };
          const agg: Record<number, Agg> = {};
          filteredRecords.forEach((r: any) => {
            const empId = Number(r.employeeId);
            if (!agg[empId]) agg[empId] = { present: 0, absent: 0, half: 0, ot: 0, late: 0, dailyLate: [], perm: 0, adv: 0 };
            if (r.status === 'PRESENT')   agg[empId].present++;
            if (r.status === 'ABSENT')    agg[empId].absent++;
            if (r.status === 'HALF_DAY')  agg[empId].half++;
            agg[empId].ot   += Number(r.otHours);
            agg[empId].late += Number(r.lateMinutes);
            agg[empId].dailyLate.push(Number(r.lateMinutes));
            agg[empId].perm += Number(r.permissionMinutes);
            agg[empId].adv  += Number(r.salaryAdvance);
          });
          rows = defaultRows.map(row => {
            const a = agg[row.employeeId];
            if (!a) return row;
            return {
              ...row,
              presentDays:       a.present,
              absentDays:        a.absent,
              halfDays:          a.half,
              otHours:           a.ot,
              lateMinutes:       a.late,
              dailyLateMinutes:  a.dailyLate,
              permissionMinutes: a.perm,
              advance:           a.adv,
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
        current:         data.current,
        total:           data.total,
        currentEmployee: data.employee.name,
        runCode:         data.runCode,
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
      const opt  = opts.find(o => o.weekOfMonth === weekOfMonth) ?? opts[0];
      if (!opt) return `${year}-W01`;
      return `${opt.isoYear}-W${String(opt.isoWeek).padStart(2, '0')}`;
    }
    return `${year}-${String(month).padStart(2,'0')}`;
  }, [runType, year, month, weekMonth, weekOfMonth]);

  const periodLabel = useMemo(() => {
    if (runType === 'WEEKLY') {
      const opts = getWeeksOfMonth(year, weekMonth);
      const opt  = opts.find(o => o.weekOfMonth === weekOfMonth) ?? opts[0];
      if (!opt) return `Week 1, ${year}`;
      return `${MONTHS_SHORT[weekMonth - 1]} ${opt.startDay}–${opt.endDay}, ${year}`;
    }
    return `${MONTHS[month - 1]} ${year}`;
  }, [runType, year, month, weekMonth, weekOfMonth]);

  // Rebuild att rows when category/employees change
  const isWeeklyEmployee = (e: any) =>
    e.payrollConfig?.salaryType === 'DAILY_WEEKLY' || e.salaryType === 'daily' || e.salaryType === 'weekly';

  const handleCategoryChange = (c: SalaryCategory) => {
    setAttValidationError(null);
    setCategory(c);
    const typeFiltered = employees.filter(e =>
      runType === 'WEEKLY' ? isWeeklyEmployee(e) : !isWeeklyEmployee(e)
    );
    const filtered = c === 'ALL' ? typeFiltered : typeFiltered.filter(e => e.payrollConfig?.salaryType === c);
    setAttRows(filtered.map(e => ({
      employeeId:        Number(e.id),
      name:              e.fullName,
      code:              e.empCode,
      salaryType:        e.payrollConfig?.salaryType ?? 'FIXED_MONTHLY',
      presentDays:       0,
      absentDays:        0,
      halfDays:          0,
      otHours:           0,
      lateMinutes:       0,
      dailyLateMinutes:  [],
      permissionMinutes: 0,
      advance:           0,
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
      employeeId:        Number(e.id),
      name:              e.fullName,
      code:              e.empCode,
      salaryType:        e.payrollConfig?.salaryType ?? 'FIXED_MONTHLY',
      presentDays:       0,
      absentDays:        0,
      halfDays:          0,
      otHours:           0,
      lateMinutes:       0,
      dailyLateMinutes:  [],
      permissionMinutes: 0,
      advance:           0,
    }));

    // Load saved attendance records
    let allRecords: any[] = [];
    let lookupPeriod = period;
    let weekStartDay = 1;
    let weekEndDay   = calDays;

    try {
      if (runType === 'WEEKLY') {
        lookupPeriod = `${year}-${String(weekMonth).padStart(2, '0')}`;
        const opts = getWeeksOfMonth(year, weekMonth);
        const opt  = opts.find(o => o.weekOfMonth === weekOfMonth) ?? opts[0];
        if (opt) { weekStartDay = opt.startDay; weekEndDay = opt.endDay; }
      }

      let fetched: any[] = await payrollService.getAttendance(lookupPeriod);

      if (runType === 'WEEKLY') {
        fetched = fetched.filter((r: any) => {
          const day = parseInt(r.date.split('-')[2], 10);
          return day >= weekStartDay && day <= weekEndDay;
        });
      }
      allRecords = fetched;
    } catch {
      // attendance fetch failed — allRecords stays empty
    }

    // ── Validate: every employee must have all days of the period entered ──────
    const expectedDays = runType === 'WEEKLY'
      ? (weekEndDay - weekStartDay + 1)
      : calDays;

    // Count how many dates each employee has recorded
    const empDateCount: Record<number, number> = {};
    allRecords.forEach((r: any) => {
      const empId = Number(r.employeeId);
      empDateCount[empId] = (empDateCount[empId] ?? 0) + 1;
    });

    const incomplete = filtered.filter(e => (empDateCount[Number(e.id)] ?? 0) < expectedDays);

    if (incomplete.length > 0) {
      setAttValidationError({
        employees: incomplete.map(e => ({
          name:     e.fullName,
          code:     e.empCode,
          entered:  empDateCount[Number(e.id)] ?? 0,
          expected: expectedDays,
        })),
      });
      setLoadingStep2(false);
      return; // Block — do NOT proceed to Step 2
    }

    // ── All employees complete — aggregate attendance ──────────────────────────
    type Agg = { present: number; absent: number; half: number; ot: number; late: number; dailyLate: number[]; perm: number; adv: number };
    const agg: Record<number, Agg> = {};
    allRecords.forEach((r: any) => {
      const empId = Number(r.employeeId);
      if (!agg[empId]) agg[empId] = { present: 0, absent: 0, half: 0, ot: 0, late: 0, dailyLate: [], perm: 0, adv: 0 };
      if (r.status === 'PRESENT')  agg[empId].present++;
      if (r.status === 'ABSENT')   agg[empId].absent++;
      if (r.status === 'HALF_DAY') agg[empId].half++;
      agg[empId].ot   += Number(r.otHours);
      agg[empId].late += Number(r.lateMinutes);
      agg[empId].dailyLate.push(Number(r.lateMinutes));
      agg[empId].perm += Number(r.permissionMinutes);
    });

    // ── Load salary advances disbursed within this period ─────────────────────
    // Date range: for weekly, use the actual start/end dates of the selected week
    const mm = String(weekMonth).padStart(2, '0');
    const dateFrom = runType === 'WEEKLY'
      ? `${year}-${mm}-${String(weekStartDay).padStart(2, '0')}`
      : `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay  = runType === 'WEEKLY'
      ? weekEndDay
      : new Date(year, month, 0).getDate();
    const dateTo   = runType === 'WEEKLY'
      ? `${year}-${mm}-${String(weekEndDay).padStart(2, '0')}`
      : `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const advanceMap: Record<number, number> = {};
    try {
      const advances = await payrollService.listAdvances({ status: 'PENDING', dateFrom, dateTo });
      advances.forEach(adv => {
        const empId = Number(adv.employeeId);
        const outstanding = Number(adv.amount) - Number(adv.recoveredAmount);
        if (outstanding > 0) {
          advanceMap[empId] = (advanceMap[empId] ?? 0) + outstanding;
        }
      });
      // Also include PARTIAL advances disbursed in this period
      const partials = await payrollService.listAdvances({ status: 'PARTIAL', dateFrom, dateTo });
      partials.forEach(adv => {
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
          presentDays:       a?.present   ?? 0,
          absentDays:        a?.absent    ?? 0,
          halfDays:          a?.half      ?? 0,
          otHours:           a?.ot        ?? 0,
          lateMinutes:       a?.late      ?? 0,
          dailyLateMinutes:  a?.dailyLate ?? [],
          permissionMinutes: a?.perm      ?? 0,
          advance:           advanceMap[row.employeeId] ?? 0,
        };
      });
      setAttFromSaved(true);
    }

    setCategory(category);
    setAttRows(rows);
    setLoadingStep2(false);
    setStep(2);
  };

  const handleCalculate = async () => {
    setComputeErr('');
    const attendance: AttendanceInput[] = attRows.map(r => ({
      employeeId:        r.employeeId,
      presentDays:       r.presentDays,
      absentDays:        r.absentDays,
      halfDays:          r.halfDays,
      otHours:           r.otHours,
      lateMinutes:       r.lateMinutes,
      dailyLateMinutes:  r.dailyLateMinutes ?? [],
      permissionMinutes: r.permissionMinutes,
      advance:           r.advance,
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Run Payroll</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {periodLabel} · {runType === 'MONTHLY' ? 'Monthly' : 'Weekly'} Run
            </p>
          </div>
          {step > 1 && currentRun && (
            <div className="bg-slate-50 rounded-lg border border-border px-4 py-2 text-sm">
              <span className="text-text-muted">Run: </span>
              <span className="font-mono text-xs text-text-primary">{currentRun.runCode}</span>
              <span className="mx-2 text-border">·</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                currentRun.status === 'LOCKED'   ? 'bg-emerald-100 text-emerald-700' :
                currentRun.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
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
                runType={runType}       setRunType={setRunType}
                month={month}           setMonth={setMonth}
                year={year}             setYear={setYear}
                weekMonth={weekMonth}   setWeekMonth={setWeekMonth}
                weekOfMonth={weekOfMonth} setWeekOfMonth={setWeekOfMonth}
                category={category}     setCategory={handleCategoryChange}
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
            onBack={() => setStep(1)}
            onNext={handleCalculate}
          />
        )}

        {step === 2 && computeErr && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 max-w-xl">
            <AlertTriangle size={15} /> {computeErr}
          </div>
        )}

        {step === 3 && currentRun && (
          <Step3 run={currentRun} onBack={() => setStep(2)} onNext={() => setStep(currentRun.status === 'APPROVED' ? 5 : 4)} />
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
