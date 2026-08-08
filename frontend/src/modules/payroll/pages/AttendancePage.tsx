import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, AlertCircle, RefreshCw,
  CheckCircle2, Users, Info, PlayCircle, Calendar, CalendarDays, Lock,
} from 'lucide-react';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import SelectInput from '../../../components/form/SelectInput/SelectInput';
import { payrollService } from '../../../services/payrollService';
import type { ApiEmployeePayroll, ApiPayrollConfig } from '../../../services/payrollService';
import { usePermission } from '../../../hooks/usePermission';

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'WEEKLY_OFF', 'HOLIDAY', 'LEAVE_PAID', 'LEAVE_UNPAID'] as const;
type AttStatus = typeof STATUSES[number];

const S: Record<AttStatus, { abbr: string; label: string; cell: string }> = {
  PRESENT:      { abbr: 'P',  label: 'Present',        cell: 'bg-emerald-500 text-white'  },
  ABSENT:       { abbr: 'A',  label: 'Absent',          cell: 'bg-red-500 text-white'      },
  HALF_DAY:     { abbr: 'HD', label: 'Half Day',        cell: 'bg-amber-400 text-white'    },
  WEEKLY_OFF:   { abbr: 'WO', label: 'Weekly Off',      cell: 'bg-slate-400 text-white'    },
  HOLIDAY:      { abbr: 'H',  label: 'Holiday',         cell: 'bg-blue-500 text-white'     },
  LEAVE_PAID:   { abbr: 'LP', label: 'Leave (Paid)',    cell: 'bg-violet-500 text-white'   },
  LEAVE_UNPAID: { abbr: 'LU', label: 'Leave (Unpaid)',  cell: 'bg-orange-500 text-white'   },
};

const CYCLE: (AttStatus | null)[] = [null, 'PRESENT', 'ABSENT', 'HALF_DAY', 'WEEKLY_OFF', 'HOLIDAY', 'LEAVE_PAID', 'LEAVE_UNPAID'];

// ─── Types ────────────────────────────────────────────────────────────────────
type CellData = {
  status: AttStatus | null;
  otHours: number;
  lateMinutes: number;
  permissionMinutes: number;
};
type GridState = Record<string, CellData>;

const EMPTY_CELL: CellData = { status: null, otHours: 0, lateMinutes: 0, permissionMinutes: 0 };

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
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: WeekOfMonth[] = [];
  for (let w = 1; w <= 5; w++) {
    const startDay = (w - 1) * 7 + 1;
    if (startDay > daysInMonth) break;
    const endDay = Math.min(w * 7, daysInMonth);
    const dates: string[] = [];
    for (let d = startDay; d <= endDay; d++) {
      dates.push(`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    }
    const period = isoPeriod(dates[0]);
    result.push({
      num: w,
      dates,
      period,
      label: `Week ${w}  (${MONTHS[month - 1].slice(0, 3)} ${startDay}–${endDay})`,
    });
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
  const hasExtra = cell.otHours > 0 || cell.lateMinutes > 0 || cell.permissionMinutes > 0;
  return (
    <div className="relative inline-flex">
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        disabled={isLocked}
        className={`w-[32px] h-[28px] rounded flex items-center justify-center font-bold text-[9px] transition-all select-none ${
          isLocked
            ? 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-75 border border-slate-300'
            : cell.status
              ? S[cell.status].cell
              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
        }`}
        title={isLocked ? 'Locked (Payroll Approved)' : 'Left-click: cycle status | Right-click: edit OT / Late / Perm'}
      >
        {isLocked ? <Lock size={10} className="text-slate-600" /> : cell.status ? S[cell.status].abbr : '—'}
      </button>
      {hasExtra && (
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 pointer-events-none" />
      )}
    </div>
  );
};

// ─── Cell Edit Panel ──────────────────────────────────────────────────────────
const CellEditPanel: React.FC<{
  empName: string; date: string; cell: CellData; isLocked?: boolean;
  onChange: (c: CellData) => void; onClose: () => void;
}> = ({ empName, date, cell, isLocked, onChange, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-text-primary text-sm">{empName}</p>
          <p className="text-xs text-text-muted">{date} · {DAY_FULL[dayOfWeek(date)]}</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-lg text-text-muted hover:text-text-primary">×</button>
      </div>

      {isLocked && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-xl font-medium">
          <Lock size={14} className="shrink-0" />
          <span>This date is locked because payroll has been approved. Editing is disabled.</span>
        </div>
      )}

      {/* Status grid */}
      <div>
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Status</p>
        <div className="grid grid-cols-4 gap-1.5">
          {STATUSES.map(st => (
            <button key={st} disabled={isLocked} onClick={() => onChange({ ...cell, status: cell.status === st ? null : st })}
              className={`py-1.5 rounded-lg text-[10px] font-bold transition-all border-2 ${
                cell.status === st ? `${S[st].cell} border-transparent` : 'bg-white text-text-muted border-border hover:border-slate-300'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {S[st].abbr}
            </button>
          ))}
          <button disabled={isLocked} onClick={() => onChange({ ...cell, status: null })}
            className={`py-1.5 rounded-lg text-[10px] font-bold border-2 transition-all ${
              cell.status === null ? 'bg-slate-700 text-white border-transparent' : 'bg-white text-text-muted border-border hover:border-slate-300'
            } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
            —
          </button>
        </div>
      </div>

      {/* Extra numeric fields */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { label: 'OT Hours',   field: 'otHours',           step: 0.5 },
          { label: 'Late (min)', field: 'lateMinutes',       step: 1   },
          { label: 'Perm (min)', field: 'permissionMinutes', step: 1   },
        ] as const).map(f => (
          <div key={f.field}>
            <label className="block text-xs font-semibold text-text-muted mb-1">{f.label}</label>
            <input type="number" min={0} step={f.step} disabled={isLocked}
              value={cell[f.field]}
              onChange={e => onChange({ ...cell, [f.field]: Number(e.target.value) })}
              className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" />
          </div>
        ))}
      </div>

      <button onClick={onClose} className="w-full py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors">
        {isLocked ? 'Close' : 'Done'}
      </button>
    </div>
  </div>
);

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

  // ── Cell panel ────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<{ empId: number; empName: string; date: string } | null>(null);

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
  const isDateLocked = useCallback((dateStr: string): boolean => {
    if (lockedPeriods.length === 0) return false;
    const monthP = dateStr.slice(0, 7);
    const weekP  = isoPeriod(dateStr);
    return lockedPeriods.includes(monthP) || lockedPeriods.includes(weekP);
  }, [lockedPeriods]);

  const allDatesLocked = useMemo(() => dates.length > 0 && dates.every(d => isDateLocked(d)), [dates, isDateLocked]);
  const someDatesLocked = useMemo(() => dates.some(d => isDateLocked(d)), [dates, isDateLocked]);

  // ── Load employees + config ───────────────────────────────────────────────
  useEffect(() => {
    Promise.all([payrollService.listEmployees(), payrollService.getConfig()])
      .then(([emps, cfg]) => {
        setEmployees(emps);
        setPayrollCfg(cfg);
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rebuild grid when dates / filtered employees change ───────────────────
  useEffect(() => {
    if (filteredEmployees.length === 0) return;
    setGrid(prev => {
      const next: GridState = {};
      filteredEmployees.forEach(emp => {
        dates.forEach(date => {
          const k = cellKey(Number(emp.id), date);
          next[k] = prev[k] ?? { ...EMPTY_CELL };
        });
      });
      return next;
    });
    setHasSavedData(false);
    setSaveOk(false);
  }, [dates, filteredEmployees]);

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
                otHours:           Number(r.otHours),
                lateMinutes:       Number(r.lateMinutes),
                permissionMinutes: Number(r.permissionMinutes),
              };
            }
          });
          return next;
        });
        setHasSavedData(true);
      } else {
        setHasSavedData(false);
      }

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
    setSaveOk(false);
  };

  const cycleCell = (empId: number, date: string) => {
    if (isDateLocked(date)) return;
    const cur = getCell(empId, date);
    setCell(empId, date, { ...cur, status: cycleStatus(cur.status) });
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const applyCompanySchedule = () => {
    setGrid(prev => {
      const next = { ...prev };
      filteredEmployees.forEach(emp => {
        dates.forEach(date => {
          if (!isDateLocked(date)) {
            const k = cellKey(Number(emp.id), date);
            const isOff = weeklyOffDays.includes(dayOfWeek(date));
            next[k] = { ...(next[k] ?? EMPTY_CELL), status: isOff ? 'WEEKLY_OFF' : 'PRESENT' };
          }
        });
      });
      return next;
    });
    setSaveOk(false);
  };

  const clearAll = () => {
    setGrid(prev => {
      const next = { ...prev };
      filteredEmployees.forEach(emp => {
        dates.forEach(date => {
          if (!isDateLocked(date)) {
            next[cellKey(Number(emp.id), date)] = { ...EMPTY_CELL };
          }
        });
      });
      return next;
    });
    setSaveOk(false);
  };

  const markEmployeeRow = (empId: number, status: AttStatus) => {
    setGrid(prev => {
      const next = { ...prev };
      dates.forEach(date => {
        if (!isDateLocked(date)) {
          const k = cellKey(empId, date);
          next[k] = { ...(next[k] ?? EMPTY_CELL), status };
        }
      });
      return next;
    });
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
          otHours:           c.otHours,
          lateMinutes:       c.lateMinutes,
          permissionMinutes: c.permissionMinutes,
          salaryAdvance:     0,
        };
      }).filter((x): x is NonNullable<typeof x> => x !== null)
    ).map(r => ({ ...r, _period: p })); // carry period for multi-save

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setError(''); setSaveOk(false);
    try {
      if (allDatesLocked) {
        setError('Cannot save attendance. Payroll for this period has already been approved or locked.');
        return;
      }

      if (runType === 'WEEKLY' && fullMonthMode) {
        // ── Full-month save for weekly employees ─────────────────────────
        // Group all dates by their ISO week period, save each group separately
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
            await payrollService.bulkUpsertAttendance(wp, records as any);
            totalSaved += records.length;
          }
        }
        if (totalSaved === 0) { setError('No editable attendance data to save. Mark at least one unlocked cell.'); return; }
        setSaveOk(true); setHasSavedData(true);
      } else {
        // ── Normal single-period save ─────────────────────────────────────
        const editableDates = dates.filter(d => !isDateLocked(d));
        const records = buildRecords(filteredEmployees, editableDates, period);
        if (records.length === 0) { setError('No editable attendance data to save. Mark at least one unlocked cell.'); return; }
        await payrollService.bulkUpsertAttendance(period, records as any);
        setSaveOk(true); setHasSavedData(true);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  // ── Summary per employee ──────────────────────────────────────────────────
  const summary = (empId: number) => {
    let P = 0, A = 0, HD = 0, WO = 0, OT = 0, Late = 0;
    dates.forEach(date => {
      const c = getCell(empId, date);
      if (c.status === 'PRESENT')    P++;
      if (c.status === 'ABSENT')     A++;
      if (c.status === 'HALF_DAY')   HD++;
      if (c.status === 'WEEKLY_OFF') WO++;
      OT   += c.otHours;
      Late += c.lateMinutes;
    });
    return { P, A, HD, WO, OT, Late };
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

  const totalCells = filteredEmployees.length * dates.length;

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <CommonLoader text="Loading employees and payroll settings…" />;

  return (
    <div className="min-h-screen  flex flex-col">

      {/* ── Header ── */}
      <div className="bg-white border-b border-border px-6 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/payroll')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft size={16} /> Back
            </button>
            <div className="w-px h-5 bg-border" />
            <div>
              <h1 className="text-xl font-bold text-text-primary">Attendance Entry</h1>
              <p className="text-xs text-text-secondary mt-0.5">
                {period} · {filteredEmployees.length} employees
                {totalCells > 0 && (
                  <span className="ml-2 text-text-muted">· {totalMarked}/{totalCells} cells marked</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadSaved} disabled={loadingAtt}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-border text-text-secondary rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
              <RefreshCw size={14} className={loadingAtt ? 'animate-spin' : ''} />
              Load Saved
            </button>
            <button onClick={() => navigate(`/payroll/run?type=${runType === 'MONTHLY' ? 'monthly' : 'weekly'}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-primary text-primary rounded-lg hover:bg-red-50 transition-colors">
              <PlayCircle size={14} /> Run Payroll
            </button>
            {canEditAttendance && (
              <button onClick={handleSave} disabled={saving || allDatesLocked}
                className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving…' : runType === 'WEEKLY' && fullMonthMode ? 'Save Full Month' : 'Save Attendance'}
              </button>
            )}
          </div>
        </div>

        {allDatesLocked ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-medium">
            <Lock size={14} className="text-red-600 shrink-0" />
            <span>Attendance for <strong>{period}</strong> is LOCKED because payroll has been approved or locked. Attendance cannot be edited for this period.</span>
          </div>
        ) : someDatesLocked ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-medium">
            <Lock size={14} className="text-amber-600 shrink-0" />
            <span>Some period(s) in this view (<strong>{lockedPeriods.join(', ')}</strong>) are locked (payroll approved). Locked dates cannot be edited, but unlocked dates remain editable.</span>
          </div>
        ) : null}

        {saveOk && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle2 size={13} />
            Attendance saved for <strong className="ml-1">{period}</strong>.
            {runType === 'WEEKLY' && fullMonthMode && ' (Split across weekly periods automatically.)'}
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={13} /> {error}
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="bg-white border-b border-border px-6 py-3 flex flex-wrap items-center gap-3">

        {/* Period type toggle */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['MONTHLY','WEEKLY'] as const).map(t => (
            <button key={t} onClick={() => { setRunType(t); setFullMonthMode(false); setSaveOk(false); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                runType === t ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text-secondary'
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
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <CalendarDays size={13} />
              {fullMonthMode ? 'Full Month ON' : 'Full Month'}
            </button>

            {fullMonthMode && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                Showing all {dates.length} days · Save splits into {monthWeeks.length} weekly periods automatically
              </span>
            )}
          </>
        )}

        <div className="w-px h-5 bg-border" />

        <button onClick={clearAll} disabled={allDatesLocked}
          className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          Clear All
        </button>
      </div>

      {/* ── Info banners ── */}
      {hasSavedData && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 flex items-center gap-2 text-xs text-blue-700">
          <Info size={13} />
          Showing saved attendance for <strong className="mx-1">{period}</strong>.
          Changes will overwrite on next save.
        </div>
      )}

      {/* ── Legend ── */}
      <div className="bg-white border-b border-border px-6 py-2 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Legend:</span>
        {STATUSES.map(st => (
          <div key={st} className="flex items-center gap-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${S[st].cell}`}>{S[st].abbr}</span>
            <span className="text-[10px] text-text-muted">{S[st].label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-500">—</span>
          <span className="text-[10px] text-text-muted">Unset (not counted)</span>
        </div>
        <div className="flex items-center gap-1 ml-2 border-l border-border pl-3">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600 inline-flex items-center gap-0.5">
            <Lock size={9} /> Lock
          </span>
          <span className="text-[10px] text-text-muted">Payroll Approved</span>
        </div>
        <div className="ml-auto text-[10px] text-text-muted">
          Left-click = cycle · Right-click = OT / Late / Perm
        </div>
      </div>

      {/* ── Week divider labels in full-month mode ── */}
      {runType === 'WEEKLY' && fullMonthMode && (
        <div className="bg-slate-50 border-b border-border px-6 py-2 flex flex-wrap gap-2">
          {monthWeeks.map(w => {
            const isWkLocked = lockedPeriods.includes(w.period) || lockedPeriods.includes(`${year}-${String(month).padStart(2,'0')}`);
            return (
              <span key={w.num}
                className={`inline-flex items-center gap-1 text-[10px] font-semibold border rounded-md px-2 py-0.5 ${
                  isWkLocked ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-white text-slate-600 border-slate-200'
                }`}>
                <span className="w-3 h-3 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[8px] font-bold">{w.num}</span>
                {w.label.replace(`Week ${w.num}  `, '')} → <span className="text-primary font-bold">{w.period}</span>
                {isWkLocked && <Lock size={10} className="text-amber-600 ml-0.5" />}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Grid ── */}
      <div className="flex-1 p-4 overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted">
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
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden h-full">
            <div className="overflow-auto h-full">
              <table className="text-xs border-collapse" style={{ minWidth: `${220 + dates.length * 40 + 200}px` }}>

                {/* THEAD */}
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-50">
                    <th className="sticky left-0 z-30 bg-slate-50 text-left px-4 py-2.5 font-semibold text-text-muted uppercase tracking-wider border-b border-r border-border" style={{ minWidth: 220 }}>
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
                          className={`px-0 py-2 text-center font-semibold border-b border-r border-border ${
                            isWeekStart ? 'border-l-2 border-l-primary/40' : ''
                          } ${locked ? 'bg-slate-200/70' : isOff ? (isSun ? 'bg-red-50' : 'bg-amber-50/50') : 'bg-slate-50'}`}
                          style={{ width: 38, minWidth: 38 }}
                          title={locked ? 'Payroll Approved/Locked' : isWeekStart ? `Week ${Math.ceil(day / 7)} starts` : undefined}
                        >
                          <div className={`text-[11px] font-bold flex items-center justify-center gap-0.5 ${locked ? 'text-slate-500' : isOff ? (isSun ? 'text-red-500' : 'text-amber-600') : 'text-text-primary'}`}>
                            {day}
                            {locked && <Lock size={8} className="text-slate-500" />}
                          </div>
                          <div className={`text-[9px] ${locked ? 'text-slate-400' : isOff ? (isSun ? 'text-red-400' : 'text-amber-500') : 'text-text-muted'}`}>{DAY_ABBR[dow]}</div>
                          {isWeekStart && <div className="text-[8px] text-primary font-bold">W{Math.ceil(day/7)}</div>}
                        </th>
                      );
                    })}
                    {/* Summary */}
                    <th className="px-2 py-2 text-center font-bold text-emerald-700 bg-emerald-50/60 border-b border-r border-border">P</th>
                    <th className="px-2 py-2 text-center font-bold text-red-600 bg-red-50/40 border-b border-r border-border">A</th>
                    <th className="px-2 py-2 text-center font-bold text-amber-600 bg-amber-50/40 border-b border-r border-border">HD</th>
                    <th className="px-2 py-2 text-center font-bold text-slate-500 bg-slate-100/60 border-b border-r border-border">WO</th>
                    <th className="px-2 py-2 text-center font-semibold text-text-muted bg-slate-50 border-b border-r border-border whitespace-nowrap">OT h</th>
                    <th className="px-2 py-2 text-center font-semibold text-text-muted bg-slate-50 border-b border-border whitespace-nowrap">Late</th>
                  </tr>
                </thead>

                {/* TBODY */}
                <tbody>
                  {filteredEmployees.map((emp, idx) => {
                    const empId = Number(emp.id);
                    const sum   = summary(empId);
                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30';
                    return (
                      <tr key={emp.id} className={`${rowBg} hover:bg-blue-50/20 transition-colors`}>

                        {/* Employee sticky col */}
                        <td className={`sticky left-0 z-10 px-3 py-1.5 border-b border-r border-border ${rowBg}`} style={{ minWidth: 220 }}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-text-primary text-xs truncate">{emp.fullName}</p>
                              <p className="text-[10px] text-text-muted">{emp.empCode} · {(emp.payrollConfig?.salaryType ?? '—').replace(/_/g,' ')}</p>
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              <button onClick={() => markEmployeeRow(empId, 'PRESENT')} title="All Present" disabled={allDatesLocked}
                                className="w-5 h-5 rounded text-[8px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">P</button>
                              <button onClick={() => markEmployeeRow(empId, 'ABSENT')} title="All Absent" disabled={allDatesLocked}
                                className="w-5 h-5 rounded text-[8px] font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">A</button>
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
                              className={`px-0.5 py-0.5 border-b border-r border-border text-center ${
                                isWeekStart ? 'border-l-2 border-l-primary/30' : ''
                              } ${locked ? 'bg-slate-100/80' : isCompanyOff && !cell.status ? 'bg-slate-50/80' : ''}`}>
                              <StatusCell
                                cell={cell}
                                isLocked={locked}
                                onClick={() => cycleCell(empId, date)}
                                onContextMenu={e => { e.preventDefault(); setSelected({ empId, empName: emp.fullName, date }); }}
                              />
                            </td>
                          );
                        })}

                        {/* Summary */}
                        <td className="px-2 py-1.5 text-center font-bold text-emerald-700 border-b border-r border-border">{sum.P  > 0 ? sum.P  : '—'}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-red-600   border-b border-r border-border">{sum.A  > 0 ? sum.A  : '—'}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-amber-600 border-b border-r border-border">{sum.HD > 0 ? sum.HD : '—'}</td>
                        <td className="px-2 py-1.5 text-center font-semibold text-slate-500 border-b border-r border-border">{sum.WO > 0 ? sum.WO : '—'}</td>
                        <td className="px-2 py-1.5 text-center text-text-secondary border-b border-r border-border">{sum.OT > 0 ? sum.OT.toFixed(1) : '—'}</td>
                        <td className="px-2 py-1.5 text-center text-text-secondary border-b border-border">{sum.Late > 0 ? `${sum.Late}m` : '—'}</td>
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
          empName={selected.empName}
          date={selected.date}
          cell={getCell(selected.empId, selected.date)}
          isLocked={isDateLocked(selected.date)}
          onChange={c => setCell(selected.empId, selected.date, c)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default AttendancePage;
