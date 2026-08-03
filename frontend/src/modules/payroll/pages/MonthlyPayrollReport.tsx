import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Lock, ChevronLeft, ChevronRight, Printer, Loader2 } from 'lucide-react';
import { FiRefreshCw } from 'react-icons/fi';
import CustomButton from '../../../components/ui/custombutton/CustomButton';
import ExportCSVButton from '../../../components/ui/ExportCSVButton/ExportCSVButton';
import { payrollService } from '../../../services/payrollService';
import type { ApiPayrollRun, ApiPayrollResult } from '../../../services/payrollService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: any) => Number(n || 0).toLocaleString('en-IN');

const STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  LOCKED:   'bg-slate-100 text-slate-600',
};

const SALARY_TYPE_LABEL: Record<string, string> = {
  FIXED_MONTHLY:  'Fixed',
  PF_MONTHLY:     'PF',
  CASH_MONTHLY:   'Cash',
  DAILY_WEEKLY:   'Daily',
};

type ViewMode = 'ALL' | 'PF' | 'CASH';

// ─── Component ────────────────────────────────────────────────────────────────
const MonthlyPayrollReport: React.FC = () => {
  const [runs, setRuns]       = useState<ApiPayrollRun[]>([]);
  const [runIdx, setRunIdx]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [view, setView]       = useState<ViewMode>('ALL');

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await payrollService.listRuns({ type: 'MONTHLY', limit: 100 });
      const sorted = [...(res.runs ?? [])].sort(
        (a, b) => new Date(b.period).getTime() - new Date(a.period).getTime()
      );
      setRuns(sorted);
      setRunIdx(0);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load monthly payroll runs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const run: ApiPayrollRun | undefined = runs[runIdx];

  // Ensure full run details with results are loaded for the selected run
  useEffect(() => {
    if (run?.id && (!run.results || run.results.length === 0)) {
      payrollService.getRun(run.id).then((fullRun) => {
        if (fullRun && fullRun.results) {
          setRuns((prev) => prev.map((r) => (r.id === fullRun.id ? fullRun : r)));
        }
      }).catch(() => {});
    }
  }, [run?.id]);
  const isLocked = run?.status === 'LOCKED';

  const allResults: ApiPayrollResult[] = run?.results ?? [];
  const pfEmployees   = allResults.filter((r) => r.pfApplicable);
  const cashEmployees = allResults.filter((r) => !r.pfApplicable);

  const varianceCount = allResults.filter((r) => r.hasVariance).length;

  // ── Totals ──
  const allTotals = allResults.reduce(
    (a, e) => ({
      grossSalary:    a.grossSalary    + Number(e.grossSalary || 0),
      presentDays:    a.presentDays    + Number(e.presentDays || 0),
      absentDays:     a.absentDays     + Number(e.absentDays || 0),
      halfDays:       a.halfDays       + Number(e.halfDays || 0),
      lopDays:        a.lopDays        + Number(e.lopDays || 0),
      otHours:        a.otHours        + Number(e.otHours || 0),
      otPay:          a.otPay          + Number(e.otPay || 0),
      totalDeductions: a.totalDeductions + Number(e.totalDeductions || 0),
      netSalary:      a.netSalary      + Number(e.netSalary || 0),
    }),
    { grossSalary: 0, presentDays: 0, absentDays: 0, halfDays: 0, lopDays: 0, otHours: 0, otPay: 0, totalDeductions: 0, netSalary: 0 }
  );

  const pfTotals = pfEmployees.reduce(
    (a, e) => ({
      grossSalary:  a.grossSalary  + Number(e.grossSalary || 0),
      earnedSalary: a.earnedSalary + Number(e.earnedSalary || 0),
      lopDays:      a.lopDays      + Number(e.lopDays || 0),
      otherDeductions: a.otherDeductions + Number(e.otherDeductions || 0),
      employeePf:   a.employeePf   + Number(e.employeePf || 0),
      employerPf:   a.employerPf   + Number(e.employerPf || 0),
      employeeEsi:  a.employeeEsi  + Number(e.employeeEsi || 0),
      employerEsi:  a.employerEsi  + Number(e.employerEsi || 0),
      netSalary:    a.netSalary    + Number(e.netSalary || 0),
    }),
    { grossSalary: 0, earnedSalary: 0, lopDays: 0, otherDeductions: 0, employeePf: 0, employerPf: 0, employeeEsi: 0, employerEsi: 0, netSalary: 0 }
  );

  const cashTotals = cashEmployees.reduce(
    (a, e) => ({
      grossSalary:         a.grossSalary         + Number(e.grossSalary || 0),
      presentDays:         a.presentDays         + Number(e.presentDays || 0),
      otPay:               a.otPay               + Number(e.otPay || 0),
      salaryAdvance:       a.salaryAdvance        + Number(e.salaryAdvance || 0),
      permissionDeduction: a.permissionDeduction  + Number(e.permissionDeduction || 0),
      netSalary:           a.netSalary            + Number(e.netSalary || 0),
    }),
    { grossSalary: 0, presentDays: 0, otPay: 0, salaryAdvance: 0, permissionDeduction: 0, netSalary: 0 }
  );

  const totalNet          = pfTotals.netSalary + cashTotals.netSalary;
  const totalPfLiability  = pfTotals.employeePf + pfTotals.employerPf;
  const totalEsiLiability = pfTotals.employeeEsi + pfTotals.employerEsi;

  // ── CSV columns ──
  const allCsvCols = [
    { header: 'Emp Code',          accessor: (r: ApiPayrollResult) => r.employeeCode },
    { header: 'Name',              accessor: (r: ApiPayrollResult) => r.employeeName },
    { header: 'Department',        accessor: (r: ApiPayrollResult) => r.department },
    { header: 'Salary Type',       accessor: (r: ApiPayrollResult) => SALARY_TYPE_LABEL[r.salaryType] ?? r.salaryType },
    { header: 'Present Days',      accessor: (r: ApiPayrollResult) => r.presentDays },
    { header: 'Absent Days',       accessor: (r: ApiPayrollResult) => r.absentDays },
    { header: 'Half Days',         accessor: (r: ApiPayrollResult) => r.halfDays },
    { header: 'LOP Days',          accessor: (r: ApiPayrollResult) => r.lopDays },
    { header: 'OT Hours',          accessor: (r: ApiPayrollResult) => r.otHours },
    { header: 'OT Pay (₹)',        accessor: (r: ApiPayrollResult) => r.otPay },
    { header: 'Gross (₹)',         accessor: (r: ApiPayrollResult) => r.grossSalary },
    { header: 'Total Deductions (₹)', accessor: (r: ApiPayrollResult) => r.totalDeductions },
    { header: 'Net Salary (₹)',    accessor: (r: ApiPayrollResult) => r.netSalary },
    { header: 'Payment Mode',      accessor: (r: ApiPayrollResult) => r.paymentMode },
  ];

  const pfCsvCols = [
    { header: 'Emp Code',       accessor: (r: ApiPayrollResult) => r.employeeCode },
    { header: 'Name',           accessor: (r: ApiPayrollResult) => r.employeeName },
    { header: 'Department',     accessor: (r: ApiPayrollResult) => r.department },
    { header: 'Gross (₹)',      accessor: (r: ApiPayrollResult) => r.grossSalary },
    { header: 'Earned (₹)',     accessor: (r: ApiPayrollResult) => r.earnedSalary },
    { header: 'LOP Days',       accessor: (r: ApiPayrollResult) => r.lopDays },
    { header: 'PF Wage (₹)',    accessor: (r: ApiPayrollResult) => r.pfWage },
    { header: 'PF Emp (₹)',     accessor: (r: ApiPayrollResult) => r.employeePf },
    { header: 'PF Er (₹)',      accessor: (r: ApiPayrollResult) => r.employerPf },
    { header: 'ESI Emp (₹)',    accessor: (r: ApiPayrollResult) => r.employeeEsi },
    { header: 'ESI Er (₹)',     accessor: (r: ApiPayrollResult) => r.employerEsi },
    { header: 'Net Salary (₹)', accessor: (r: ApiPayrollResult) => r.netSalary },
  ];
  const cashCsvCols = [
    { header: 'Emp Code',            accessor: (r: ApiPayrollResult) => r.employeeCode },
    { header: 'Name',                accessor: (r: ApiPayrollResult) => r.employeeName },
    { header: 'Department',          accessor: (r: ApiPayrollResult) => r.department },
    { header: 'Gross (₹)',           accessor: (r: ApiPayrollResult) => r.grossSalary },
    { header: 'Present Days',        accessor: (r: ApiPayrollResult) => r.presentDays },
    { header: 'OT Pay (₹)',          accessor: (r: ApiPayrollResult) => r.otPay },
    { header: 'Advance (₹)',         accessor: (r: ApiPayrollResult) => r.salaryAdvance },
    { header: 'Perm. Deduction (₹)', accessor: (r: ApiPayrollResult) => r.permissionDeduction },
    { header: 'Net Salary (₹)',      accessor: (r: ApiPayrollResult) => r.netSalary },
    { header: 'Payment Mode',        accessor: (r: ApiPayrollResult) => r.paymentMode },
  ];

  const thCls = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap';
  const tdCls = 'px-3 py-2.5 text-sm';
  const tdNum = 'px-3 py-2.5 text-right font-mono text-sm';

  const getCsvData = () => {
    if (view === 'ALL')  return allResults;
    if (view === 'PF')   return pfEmployees;
    return cashEmployees;
  };
  const getCsvCols = () => {
    if (view === 'ALL')  return allCsvCols;
    if (view === 'PF')   return pfCsvCols;
    return cashCsvCols;
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={36} className="animate-spin text-primary mx-auto" />
          <p className="text-text-secondary text-sm">Loading monthly payroll reports…</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle size={36} className="text-red-500 mx-auto" />
          <p className="text-text-primary font-semibold">{error}</p>
          <CustomButton text="Retry" icon={FiRefreshCw} onClick={fetchRuns} variant="outline" />
        </div>
      </div>
    );
  }

  // ── Empty ──
  if (runs.length === 0) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-text-primary font-semibold text-lg">No monthly payroll runs found</p>
          <p className="text-text-secondary text-sm">Run a monthly payroll to see the report here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Monthly Payroll Report</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {run.runCode} — {run.period}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[run.status]}`}>
              {run.status}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Period navigation */}
          <button
            onClick={() => setRunIdx((i) => Math.min(i + 1, runs.length - 1))}
            disabled={runIdx >= runs.length - 1}
            className="p-2 border border-border rounded-lg text-text-secondary hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-medium text-text-primary px-1">
            {runIdx + 1} / {runs.length}
          </span>
          <button
            onClick={() => setRunIdx((i) => Math.max(i - 1, 0))}
            disabled={runIdx <= 0}
            className="p-2 border border-border rounded-lg text-text-secondary hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight size={15} />
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-slate-50"
          >
            <Printer size={15} /> Print
          </button>

          <ExportCSVButton
            data={getCsvData()}
            columns={getCsvCols()}
            filename={`monthly-payroll-${view.toLowerCase()}-${run.period}.csv`}
            text="Export CSV"
          />
        </div>
      </div>

      {/* Locked */}
      {isLocked && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800 font-medium">
          <Lock size={16} /> This payroll period is LOCKED. Read-only view.
        </div>
      )}

      {/* Variance alert */}
      {varianceCount > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">
              Variance detected in {varianceCount} employee{varianceCount > 1 ? 's' : ''}.
            </span>
            <span className="ml-1">Engine-computed values differ from expected. Review before locking.</span>
            {allResults.filter((r) => r.hasVariance).map((r) => (
              <p key={r.employeeCode} className="mt-1 text-xs">
                • <b>{r.employeeName}</b>: {r.varianceNote ?? 'Variance flagged'}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* View toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border-2 border-border overflow-hidden shadow-sm">
          {([
            ['ALL',  `All Employees (${allResults.length})`],
            ['PF',   `PF / Fixed (${pfEmployees.length})`],
            ['CASH', `Cash / Non-PF (${cashEmployees.length})`],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-5 py-2.5 text-sm font-semibold transition-colors ${
                view === v ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* Main table */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">

            {/* ── All Employees View ── */}
            {view === 'ALL' && (
              allResults.length === 0 ? (
                <div className="py-12 text-center text-text-muted">No results in this payroll run.</div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className={thCls}>#</th>
                      <th className={thCls}>Emp Code</th>
                      <th className={thCls}>Name</th>
                      <th className={thCls}>Dept</th>
                      <th className={thCls}>Type</th>
                      <th className={`${thCls} text-right`}>Present</th>
                      <th className={`${thCls} text-right`}>Absent</th>
                      <th className={`${thCls} text-right`}>Half</th>
                      <th className={`${thCls} text-right`}>LOP</th>
                      <th className={`${thCls} text-right`}>OT Hrs</th>
                      <th className={`${thCls} text-right`}>OT Pay (₹)</th>
                      <th className={`${thCls} text-right`}>Gross (₹)</th>
                      <th className={`${thCls} text-right`}>Deductions (₹)</th>
                      <th className={`${thCls} text-right`}>Net (₹)</th>
                      <th className={`${thCls} text-center`}>Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allResults.map((e, idx) => (
                      <tr
                        key={e.id}
                        className={`${
                          e.hasVariance
                            ? 'bg-amber-50 border-l-4 border-l-amber-400'
                            : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                        } hover:bg-blue-50/20`}
                      >
                        <td className={`${tdCls} text-text-muted`}>{idx + 1}</td>
                        <td className={`${tdCls} font-mono text-xs text-text-secondary`}>{e.employeeCode}</td>
                        <td className={`${tdCls} font-semibold text-text-primary whitespace-nowrap`}>
                          {e.hasVariance && <AlertTriangle size={12} className="inline text-amber-500 mr-1" />}
                          {e.employeeName}
                        </td>
                        <td className={`${tdCls} text-text-secondary`}>{e.department}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            e.pfApplicable ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {SALARY_TYPE_LABEL[e.salaryType] ?? e.salaryType}
                          </span>
                        </td>
                        <td className={`${tdNum} text-emerald-700 font-semibold`}>{e.presentDays}</td>
                        <td className={`${tdNum} ${e.absentDays > 0 ? 'text-red-600' : 'text-text-muted'}`}>
                          {e.absentDays > 0 ? e.absentDays : '—'}
                        </td>
                        <td className={`${tdNum} ${e.halfDays > 0 ? 'text-amber-600' : 'text-text-muted'}`}>
                          {e.halfDays > 0 ? e.halfDays : '—'}
                        </td>
                        <td className={`${tdNum} ${e.lopDays > 0 ? 'text-red-600' : 'text-text-muted'}`}>
                          {e.lopDays > 0 ? e.lopDays : '—'}
                        </td>
                        <td className={`${tdNum} ${e.otHours > 0 ? 'text-blue-600' : 'text-text-muted'}`}>
                          {Number(e.otHours) > 0 ? Number(e.otHours).toFixed(1) : '—'}
                        </td>
                        <td className={`${tdNum} ${e.otPay > 0 ? 'text-blue-600' : 'text-text-muted'}`}>
                          {e.otPay > 0 ? `₹${fmt(e.otPay)}` : '—'}
                        </td>
                        <td className={`${tdNum} font-semibold`}>₹{fmt(e.grossSalary)}</td>
                        <td className={`${tdNum} ${e.totalDeductions > 0 ? 'text-red-600' : 'text-text-muted'}`}>
                          {e.totalDeductions > 0 ? `₹${fmt(e.totalDeductions)}` : '—'}
                        </td>
                        <td className={`${tdNum} font-bold text-text-primary text-base`}>₹{fmt(e.netSalary)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            e.paymentMode === 'BANK' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {e.paymentMode}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                      <td className="px-3 py-3" colSpan={5}>
                        <span className="text-sm font-bold text-text-primary">
                          TOTAL ({allResults.length} employees)
                        </span>
                      </td>
                      <td className={`${tdNum} text-emerald-700`}>{allTotals.presentDays}</td>
                      <td className={`${tdNum} text-red-600`}>{allTotals.absentDays}</td>
                      <td className={`${tdNum} text-amber-600`}>{allTotals.halfDays}</td>
                      <td className={`${tdNum} text-red-600`}>{allTotals.lopDays}</td>
                      <td className={`${tdNum} text-blue-600`}>{Number(allTotals.otHours).toFixed(1)}</td>
                      <td className={`${tdNum} text-blue-600`}>₹{fmt(allTotals.otPay)}</td>
                      <td className={`${tdNum} font-bold`}>₹{fmt(allTotals.grossSalary)}</td>
                      <td className={`${tdNum} text-red-600`}>₹{fmt(allTotals.totalDeductions)}</td>
                      <td className={`${tdNum} text-primary text-base font-bold`}>₹{fmt(allTotals.netSalary)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              )
            )}

            {/* ── PF / Fixed View ── */}
            {view === 'PF' && (
              pfEmployees.length === 0 ? (
                <div className="py-12 text-center text-text-muted">
                  No PF-eligible employees in this payroll run.
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className={thCls}>Emp Code</th>
                      <th className={thCls}>Name</th>
                      <th className={thCls}>Dept</th>
                      <th className={`${thCls} text-right`}>Gross (₹)</th>
                      <th className={`${thCls} text-right`}>Earned (₹)</th>
                      <th className={`${thCls} text-right`}>LOP Days</th>
                      <th className={`${thCls} text-right`}>PF Wage (₹)</th>
                      <th className={`${thCls} text-right`}>PF Emp (₹)</th>
                      <th className={`${thCls} text-right`}>PF Er (₹)</th>
                      <th className={`${thCls} text-right`}>ESI Emp (₹)</th>
                      <th className={`${thCls} text-right`}>ESI Er (₹)</th>
                      <th className={`${thCls} text-right`}>Net Salary (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pfEmployees.map((e, idx) => (
                      <tr
                        key={e.id}
                        className={`${
                          e.hasVariance
                            ? 'bg-amber-50 border-l-4 border-l-amber-400'
                            : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                        } hover:bg-blue-50/20`}
                      >
                        <td className={`${tdCls} font-mono text-xs text-text-secondary`}>{e.employeeCode}</td>
                        <td className={`${tdCls} font-semibold text-text-primary whitespace-nowrap`}>
                          {e.hasVariance && <AlertTriangle size={12} className="inline text-amber-500 mr-1" />}
                          {e.employeeName}
                        </td>
                        <td className={`${tdCls} text-text-secondary`}>{e.department}</td>
                        <td className={`${tdNum} font-semibold`}>₹{fmt(e.grossSalary)}</td>
                        <td className={tdNum}>₹{fmt(e.earnedSalary)}</td>
                        <td className={`${tdNum} text-red-600`}>{e.lopDays > 0 ? e.lopDays : '—'}</td>
                        <td className={tdNum}>₹{fmt(e.pfWage)}</td>
                        <td className={`${tdNum} text-violet-700`}>₹{fmt(e.employeePf)}</td>
                        <td className={`${tdNum} text-violet-500`}>₹{fmt(e.employerPf)}</td>
                        <td className={`${tdNum} text-blue-700`}>
                          {e.employeeEsi > 0 ? `₹${fmt(e.employeeEsi)}` : '—'}
                        </td>
                        <td className={`${tdNum} text-blue-500`}>
                          {e.employerEsi > 0 ? `₹${fmt(e.employerEsi)}` : '—'}
                        </td>
                        <td className={`${tdNum} font-bold text-text-primary text-base`}>₹{fmt(e.netSalary)}</td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                      <td className="px-3 py-3" colSpan={3}>
                        <span className="text-sm font-bold text-text-primary">
                          TOTAL ({pfEmployees.length} employees)
                        </span>
                      </td>
                      <td className={`${tdNum} font-bold`}>₹{fmt(pfTotals.grossSalary)}</td>
                      <td className={tdNum}>₹{fmt(pfTotals.earnedSalary)}</td>
                      <td className={`${tdNum} text-red-700`}>{pfTotals.lopDays}</td>
                      <td className={tdNum}>—</td>
                      <td className={`${tdNum} text-violet-700`}>₹{fmt(pfTotals.employeePf)}</td>
                      <td className={`${tdNum} text-violet-500`}>₹{fmt(pfTotals.employerPf)}</td>
                      <td className={`${tdNum} text-blue-700`}>₹{fmt(pfTotals.employeeEsi)}</td>
                      <td className={`${tdNum} text-blue-500`}>₹{fmt(pfTotals.employerEsi)}</td>
                      <td className={`${tdNum} text-primary text-base font-bold`}>₹{fmt(pfTotals.netSalary)}</td>
                    </tr>
                  </tbody>
                </table>
              )
            )}

            {/* ── Cash / Non-PF View ── */}
            {view === 'CASH' && (
              cashEmployees.length === 0 ? (
                <div className="py-12 text-center text-text-muted">
                  No cash/non-PF employees in this payroll run.
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className={thCls}>Emp Code</th>
                      <th className={thCls}>Name</th>
                      <th className={thCls}>Dept</th>
                      <th className={`${thCls} text-right`}>Gross (₹)</th>
                      <th className={`${thCls} text-right`}>Present Days</th>
                      <th className={`${thCls} text-right`}>OT Pay (₹)</th>
                      <th className={`${thCls} text-right`}>Advance (₹)</th>
                      <th className={`${thCls} text-right`}>Perm. Ded. (₹)</th>
                      <th className={`${thCls} text-right`}>Net Salary (₹)</th>
                      <th className={`${thCls} text-center`}>Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cashEmployees.map((e, idx) => (
                      <tr
                        key={e.id}
                        className={`${
                          e.hasVariance
                            ? 'bg-amber-50 border-l-4 border-l-amber-400'
                            : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                        } hover:bg-blue-50/20`}
                      >
                        <td className={`${tdCls} font-mono text-xs text-text-secondary`}>{e.employeeCode}</td>
                        <td className={`${tdCls} font-semibold text-text-primary whitespace-nowrap`}>
                          {e.hasVariance && <AlertTriangle size={12} className="inline text-amber-500 mr-1" />}
                          {e.employeeName}
                        </td>
                        <td className={`${tdCls} text-text-secondary`}>{e.department}</td>
                        <td className={`${tdNum} font-semibold`}>₹{fmt(e.grossSalary)}</td>
                        <td className={tdNum}>{e.presentDays}</td>
                        <td className={`${tdNum} text-emerald-700`}>
                          {e.otPay > 0 ? `₹${fmt(e.otPay)}` : '—'}
                        </td>
                        <td className={`${tdNum} text-amber-700`}>
                          {e.salaryAdvance > 0 ? `₹${fmt(e.salaryAdvance)}` : '—'}
                        </td>
                        <td className={`${tdNum} text-red-600`}>
                          {e.permissionDeduction > 0 ? `₹${fmt(e.permissionDeduction)}` : '—'}
                        </td>
                        <td className={`${tdNum} font-bold text-text-primary`}>₹{fmt(e.netSalary)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            e.paymentMode === 'BANK' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {e.paymentMode}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Total */}
                    <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                      <td className="px-3 py-3" colSpan={3}>
                        <span className="text-sm font-bold">
                          TOTAL ({cashEmployees.length} employees)
                        </span>
                      </td>
                      <td className={`${tdNum} font-bold`}>₹{fmt(cashTotals.grossSalary)}</td>
                      <td className={tdNum}>{cashTotals.presentDays}</td>
                      <td className={`${tdNum} text-emerald-700`}>₹{fmt(cashTotals.otPay)}</td>
                      <td className={`${tdNum} text-amber-700`}>₹{fmt(cashTotals.salaryAdvance)}</td>
                      <td className={`${tdNum} text-red-600`}>₹{fmt(cashTotals.permissionDeduction)}</td>
                      <td className={`${tdNum} text-primary text-base font-bold`}>₹{fmt(cashTotals.netSalary)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>

        {/* Summary Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-bold text-text-primary border-b border-border pb-2 mb-3">
              Summary — {run.period}
            </h3>

            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Run Code</span>
              <span className="font-mono text-xs text-text-primary">{run.runCode}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Total Employees</span>
              <span className="font-medium text-text-primary">{allResults.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">PF-eligible</span>
              <span className="font-medium text-text-primary">{pfEmployees.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Cash / Non-PF</span>
              <span className="font-medium text-text-primary">{cashEmployees.length}</span>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Total Present Days</span>
                <span className="font-mono font-semibold text-emerald-700">{allTotals.presentDays}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Total Absent Days</span>
                <span className="font-mono font-semibold text-red-600">{allTotals.absentDays}</span>
              </div>
              {allTotals.lopDays > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Total LOP Days</span>
                  <span className="font-mono font-semibold text-red-600">{allTotals.lopDays}</span>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Total Gross</span>
                <span className="font-mono font-semibold">
                  ₹{fmt(pfTotals.grossSalary + cashTotals.grossSalary)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Total Deductions</span>
                <span className="font-mono font-semibold text-red-600">₹{fmt(allTotals.totalDeductions)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Total Net Payable</span>
                <span className="font-mono font-bold text-primary">₹{fmt(totalNet)}</span>
              </div>
            </div>

            {(totalPfLiability > 0 || totalEsiLiability > 0) && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Statutory Liabilities
                </p>
                {totalPfLiability > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Total PF (E+Er)</span>
                      <span className="font-mono font-semibold text-violet-700">₹{fmt(totalPfLiability)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary pl-3">— Employee PF</span>
                      <span className="font-mono text-xs text-text-muted">₹{fmt(pfTotals.employeePf)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary pl-3">— Employer PF</span>
                      <span className="font-mono text-xs text-text-muted">₹{fmt(pfTotals.employerPf)}</span>
                    </div>
                  </>
                )}
                {totalEsiLiability > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Total ESI (E+Er)</span>
                      <span className="font-mono font-semibold text-blue-700">₹{fmt(totalEsiLiability)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary pl-3">— Employee ESI</span>
                      <span className="font-mono text-xs text-text-muted">₹{fmt(pfTotals.employeeEsi)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary pl-3">— Employer ESI</span>
                      <span className="font-mono text-xs text-text-muted">₹{fmt(pfTotals.employerEsi)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {varianceCount > 0 && (
              <div className="border-t border-border pt-3">
                <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold">
                  <AlertTriangle size={14} /> {varianceCount} Variance{varianceCount > 1 ? 's' : ''} flagged
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyPayrollReport;
