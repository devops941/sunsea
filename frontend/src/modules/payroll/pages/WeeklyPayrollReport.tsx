import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Printer, Lock, AlertTriangle, Loader2 } from 'lucide-react';
import { FiRefreshCw } from 'react-icons/fi';
import CustomButton from '../../../components/ui/custombutton/CustomButton';
import ExportCSVButton from '../../../components/ui/ExportCSVButton/ExportCSVButton';
import { payrollService } from '../../../services/payrollService';
import type { ApiPayrollRun, ApiPayrollResult } from '../../../services/payrollService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('en-IN');

const STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  LOCKED:   'bg-slate-100 text-slate-600',
};


// ─── Component ────────────────────────────────────────────────────────────────
const WeeklyPayrollReport: React.FC = () => {
  const [runs, setRuns]         = useState<ApiPayrollRun[]>([]);
  const [runIdx, setRunIdx]     = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<'ALL' | 'BANK' | 'CASH'>('ALL');

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await payrollService.listRuns({ type: 'WEEKLY', limit: 100 });
      const sorted = [...(res.runs ?? [])].sort(
        (a, b) => new Date(b.period).getTime() - new Date(a.period).getTime()
      );
      setRuns(sorted);
      setRunIdx(0);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load weekly payroll runs.');
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
  const filtered = filter === 'ALL'
    ? allResults
    : allResults.filter((r) => r.paymentMode === filter);

  const totals = filtered.reduce(
    (acc, r) => ({
      earnedSalary: acc.earnedSalary + r.earnedSalary,
      otPay:        acc.otPay        + r.otPay,
      salaryAdvance: acc.salaryAdvance + r.salaryAdvance,
      permissionDeduction: acc.permissionDeduction + r.permissionDeduction,
      netSalary:    acc.netSalary    + r.netSalary,
      presentDays:  acc.presentDays  + r.presentDays,
      absentDays:   acc.absentDays   + r.absentDays,
      halfDays:     acc.halfDays     + r.halfDays,
    }),
    { earnedSalary: 0, otPay: 0, salaryAdvance: 0, permissionDeduction: 0, netSalary: 0, presentDays: 0, absentDays: 0, halfDays: 0 }
  );

  const varianceCount = filtered.filter((r) => r.hasVariance).length;

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={36} className="animate-spin text-primary mx-auto" />
          <p className="text-text-secondary text-sm">Loading weekly payroll reports…</p>
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
          <p className="text-text-primary font-semibold text-lg">No weekly payroll runs found</p>
          <p className="text-text-secondary text-sm">Run a weekly payroll to see the report here.</p>
        </div>
      </div>
    );
  }

  // ── CSV data with index accessor ──
  const csvData = filtered.map((r, i) => ({ ...r, _idx: i + 1 }));
  const csvColsIndexed = [
    { header: 'S.No',                accessor: (r: typeof csvData[0]) => r._idx },
    { header: 'Emp Code',            accessor: (r: typeof csvData[0]) => r.employeeCode },
    { header: 'Name',                accessor: (r: typeof csvData[0]) => r.employeeName },
    { header: 'Department',          accessor: (r: typeof csvData[0]) => r.department },
    { header: 'Salary/Day (₹)',      accessor: (r: typeof csvData[0]) => r.dailyRate },
    { header: 'Present Days',        accessor: (r: typeof csvData[0]) => r.presentDays },
    { header: 'Absent Days',         accessor: (r: typeof csvData[0]) => r.absentDays },
    { header: 'Half Days',           accessor: (r: typeof csvData[0]) => r.halfDays },
    { header: 'Earned Salary (₹)',   accessor: (r: typeof csvData[0]) => r.earnedSalary },
    { header: 'OT Hours',            accessor: (r: typeof csvData[0]) => r.otHours },
    { header: 'OT Pay (₹)',          accessor: (r: typeof csvData[0]) => r.otPay },
    { header: 'Advance (₹)',         accessor: (r: typeof csvData[0]) => r.salaryAdvance },
    { header: 'Perm. Deduction (₹)', accessor: (r: typeof csvData[0]) => r.permissionDeduction },
    { header: 'Net Salary (₹)',      accessor: (r: typeof csvData[0]) => r.netSalary },
    { header: 'Payment Mode',        accessor: (r: typeof csvData[0]) => r.paymentMode },
  ];

  return (
    <div className="min-h-screen bg-page p-6 space-y-5 print:p-0 print:bg-white">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Weekly Payroll Report</h1>
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
            data={csvData}
            columns={csvColsIndexed}
            filename={`weekly-payroll-${run.period}.csv`}
            text="Export CSV"
          />
        </div>
      </div>

      {/* Locked banner */}
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
            <span className="font-bold">Variance detected in {varianceCount} employee{varianceCount > 1 ? 's' : ''}.</span>
            <span className="ml-1">Engine-computed values differ from expected. Review before locking.</span>
            {filtered.filter((r) => r.hasVariance).map((r) => (
              <p key={r.employeeCode} className="mt-1 text-xs">
                • <b>{r.employeeName}</b>: {r.varianceNote ?? 'Variance flagged'}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 print:hidden flex-wrap">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Filter:</span>
        {([['ALL', 'All Employees'], ['BANK', 'Bank Transfer'], ['CASH', 'Cash']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filter === v
                ? 'bg-primary text-white border-primary'
                : 'border-border text-text-secondary hover:border-slate-400'
            }`}
          >
            {l}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-muted">{filtered.length} employee{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">S.No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Emp Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Employee Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Department</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">Salary/Day (₹)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">Present</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">Absent</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">Half</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">Earned (₹)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">OT Pay (₹)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">Advance (₹)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">Perm. Ded. (₹)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">Net Salary (₹)</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide">Mode</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-text-muted">
                    No employees match the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border transition-colors ${
                      r.hasVariance
                        ? 'bg-amber-50 border-l-4 border-l-amber-400'
                        : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    } hover:bg-blue-50/20`}
                  >
                    <td className="px-4 py-3 text-text-muted">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {r.employeeCode}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {r.hasVariance && <AlertTriangle size={12} className="inline text-amber-500 mr-1" />}
                      {r.employeeName}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{r.department}</td>
                    <td className="px-4 py-3 text-right font-mono">₹{fmt(r.dailyRate)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold">{r.presentDays}</td>
                    <td className={`px-4 py-3 text-right font-mono ${r.absentDays > 0 ? 'text-red-600' : 'text-text-muted'}`}>
                      {r.absentDays > 0 ? r.absentDays : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${r.halfDays > 0 ? 'text-amber-600' : 'text-text-muted'}`}>
                      {r.halfDays > 0 ? r.halfDays : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">₹{fmt(r.earnedSalary)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700">
                      {r.otPay > 0 ? `₹${fmt(r.otPay)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700">
                      {r.salaryAdvance > 0 ? `₹${fmt(r.salaryAdvance)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">
                      {r.permissionDeduction > 0 ? `₹${fmt(r.permissionDeduction)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-text-primary">
                      ₹{fmt(r.netSalary)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.paymentMode === 'BANK' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {r.paymentMode}
                      </span>
                    </td>
                  </tr>
                ))
              )}

              {/* Total row */}
              {filtered.length > 0 && (
                <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold text-text-primary">
                    TOTAL ({filtered.length} Employees)
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted">—</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">{totals.presentDays}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{totals.absentDays}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-600">{totals.halfDays}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{fmt(totals.earnedSalary)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">₹{fmt(totals.otPay)}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-700">₹{fmt(totals.salaryAdvance)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">₹{fmt(totals.permissionDeduction)}</td>
                  <td className="px-4 py-3 text-right font-mono text-primary text-base">₹{fmt(totals.netSalary)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
        {[
          {
            label: 'Total Gross',
            value: `₹${fmt(totals.earnedSalary + totals.otPay)}`,
            color: 'text-text-primary',
          },
          {
            label: 'Total Deductions',
            value: `₹${fmt(totals.salaryAdvance + totals.permissionDeduction)}`,
            color: 'text-red-600',
          },
          {
            label: 'Total Net Payable',
            value: `₹${fmt(totals.netSalary)}`,
            color: 'text-primary font-bold',
          },
          {
            label: 'Employees',
            value: String(filtered.length),
            color: 'text-text-primary',
          },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-border rounded-xl p-4 shadow-sm">
            <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyPayrollReport;
