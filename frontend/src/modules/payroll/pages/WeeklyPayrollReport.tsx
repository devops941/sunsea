import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Printer, Lock, AlertTriangle, Loader2 } from 'lucide-react';
import { FiRefreshCw } from 'react-icons/fi';
import CustomButton from '../../../components/ui/custombutton/CustomButton';
import ExportCSVButton from '../../../components/ui/ExportCSVButton/ExportCSVButton';
import { payrollService } from '../../../services/payrollService';
import type { ApiPayrollRun, ApiPayrollResult } from '../../../services/payrollService';
import DataTable, { type DataTableColumn } from '../../../components/ui/table/DataTable';

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
      <div className="min-h-screen  flex items-center justify-center">
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
      <div className="min-h-screen  flex items-center justify-center">
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
      <div className="min-h-screen  flex items-center justify-center">
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

  const reportColumns: DataTableColumn<ApiPayrollResult>[] = [
    {
      header: 'S.NO',
      align: 'left',
      render: (_, idx) => <span className="text-text-muted">{idx + 1}</span>,
    },
    {
      header: 'EMP CODE',
      align: 'left',
      render: (r) => <span className="font-mono text-xs text-text-secondary">{r.employeeCode}</span>,
    },
    {
      header: 'EMPLOYEE NAME',
      align: 'left',
      render: (r) => (
        <div className="font-semibold text-text-primary flex items-center gap-1">
          {r.hasVariance && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
          <span>{r.employeeName}</span>
        </div>
      ),
    },
    {
      header: 'DEPARTMENT',
      align: 'left',
      render: (r) => <span className="text-text-secondary">{r.department}</span>,
    },
    {
      header: 'SALARY/DAY (₹)',
      align: 'right',
      render: (r) => <span className="font-mono">₹{fmt(Number(r.dailyRate))}</span>,
    },
    {
      header: 'PRESENT',
      align: 'right',
      render: (r) => <span className="font-mono text-emerald-700 font-semibold">{r.presentDays}</span>,
    },
    {
      header: 'ABSENT',
      align: 'right',
      render: (r) => (
        <span className={`font-mono ${Number(r.absentDays) > 0 ? 'text-red-600 font-semibold' : 'text-text-muted'}`}>
          {Number(r.absentDays) > 0 ? r.absentDays : '—'}
        </span>
      ),
    },
    {
      header: 'HALF',
      align: 'right',
      render: (r) => (
        <span className={`font-mono ${Number(r.halfDays) > 0 ? 'text-amber-600 font-semibold' : 'text-text-muted'}`}>
          {Number(r.halfDays) > 0 ? r.halfDays : '—'}
        </span>
      ),
    },
    {
      header: 'EARNED (₹)',
      align: 'right',
      render: (r) => <span className="font-mono">₹{fmt(Number(r.earnedSalary))}</span>,
    },
    {
      header: 'OT PAY (₹)',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-emerald-700">
          {Number(r.otPay) > 0 ? `₹${fmt(Number(r.otPay))}` : '—'}
        </span>
      ),
    },
    {
      header: 'ADVANCE (₹)',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-amber-700">
          {Number(r.salaryAdvance) > 0 ? `₹${fmt(Number(r.salaryAdvance))}` : '—'}
        </span>
      ),
    },
    {
      header: 'PERM. DED. (₹)',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-red-600">
          {Number(r.permissionDeduction) > 0 ? `₹${fmt(Number(r.permissionDeduction))}` : '—'}
        </span>
      ),
    },
    {
      header: 'NET SALARY (₹)',
      align: 'right',
      render: (r) => <span className="font-mono font-bold text-text-primary">₹{fmt(Number(r.netSalary))}</span>,
    },
    {
      header: 'MODE',
      align: 'center',
      render: (r) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          r.paymentMode === 'BANK' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {r.paymentMode}
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-screen p-6 space-y-5 print:p-0 print:bg-white">

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

      {/* Table using reusable DataTable component */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <DataTable
          columns={reportColumns}
          data={filtered}
          rowKey={(r) => r.id}
          emptyMessage="No employees match the selected filter."
          rowClassName={(r) => (r.hasVariance ? 'bg-amber-50 border-l-4 border-l-amber-400' : '')}
          density="compact"
        />

        {/* Total summary row */}
        {filtered.length > 0 && (
          <div className="bg-slate-100 border-t-2 border-slate-300 p-4 flex flex-wrap justify-between items-center text-xs font-mono">
            <span className="font-bold text-slate-800 text-sm">TOTAL ({filtered.length} Employees)</span>
            <div className="flex gap-4 flex-wrap justify-end font-semibold">
              <span className="text-emerald-700">Present: {totals.presentDays}</span>
              <span className="text-red-600">Absent: {totals.absentDays}</span>
              <span className="text-amber-600">Half: {totals.halfDays}</span>
              <span>Earned: ₹{fmt(totals.earnedSalary)}</span>
              <span className="text-emerald-700">OT: ₹{fmt(totals.otPay)}</span>
              <span className="text-amber-700">Adv: ₹{fmt(totals.salaryAdvance)}</span>
              <span className="text-red-600">Perm Ded: ₹{fmt(totals.permissionDeduction)}</span>
              <span className="font-bold text-primary text-sm">Net: ₹{fmt(totals.netSalary)}</span>
            </div>
          </div>
        )}
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
