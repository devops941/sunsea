import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Printer, AlertTriangle, FileDown, Users } from 'lucide-react';
import ViewButton from '../../../components/ui/viewbutton/ViewButton';
import { usePermission } from '../../../hooks/usePermission';
import IconButton from '../../../components/ui/IconButton/IconButton';
import { FiRefreshCw } from 'react-icons/fi';
import CustomButton from '../../../components/ui/custombutton/CustomButton';
import ExportCSVButton from '../../../components/ui/ExportCSVButton/ExportCSVButton';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import { useSocket } from '../../../providers/SocketProvider';
import { payrollService } from '../../../services/payrollService';
import type { ApiPayrollRun, ApiPayrollResult } from '../../../services/payrollService';
import DataTable, { type DataTableColumn } from '../../../components/ui/table/DataTable';
import PayslipModal from '../components/PayslipModal';
import FilterPopover from '../../../components/ui/FilterPopover/FilterPopover';

const ITEMS_PER_PAGE = 10;

const MONTH_OPTIONS = [
  { value: 'ALL', label: 'All Months' },
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const YEAR_OPTIONS = [
  { value: 'ALL', label: 'All Years' },
  { value: '2027', label: '2027' },
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
];

const WEEK_OPTIONS = [
  { value: 'ALL', label: 'All Weeks' },
  ...Array.from({ length: 52 }, (_, i) => {
    const w = `W${String(i + 1).padStart(2, '0')}`;
    return { value: w, label: `Week ${i + 1} (${w})` };
  })
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('en-IN');

const STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  LOCKED:   'bg-slate-100 text-slate-600',
};


// ─── Component ────────────────────────────────────────────────────────────────
const WeeklyPayrollReport: React.FC = () => {
  const { can } = usePermission();
  const canViewRun        = can("payroll-run.view");
  const canViewCashInHand = can("payroll-extended-comp.view");
  const { socket }              = useSocket();
  const [selectedYear, setSelectedYear]   = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedWeek, setSelectedWeek]   = useState<string>('ALL');
  const [draftYear, setDraftYear]         = useState<string>('ALL');
  const [draftMonth, setDraftMonth]       = useState<string>('ALL');
  const [draftWeek, setDraftWeek]         = useState<string>('ALL');

  const hasActiveFilters = selectedWeek !== 'ALL' || selectedMonth !== 'ALL' || selectedYear !== 'ALL';
  const activeFilterCount = (selectedWeek !== 'ALL' ? 1 : 0) + (selectedMonth !== 'ALL' ? 1 : 0) + (selectedYear !== 'ALL' ? 1 : 0);

  const handleOpenFilter = () => {
    setDraftWeek(selectedWeek);
    setDraftMonth(selectedMonth);
    setDraftYear(selectedYear);
  };

  const handleApplyFilters = () => {
    setSelectedWeek(draftWeek);
    setSelectedMonth(draftMonth);
    setSelectedYear(draftYear);
  };

  const handleClearFilters = () => {
    setDraftWeek('ALL');
    setDraftMonth('ALL');
    setDraftYear('ALL');
    setSelectedWeek('ALL');
    setSelectedMonth('ALL');
    setSelectedYear('ALL');
  };
  const [runs, setRuns]         = useState<ApiPayrollRun[]>([]);
  const [runIdx, setRunIdx]     = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<'ALL' | 'BANK' | 'CASH'>('ALL');
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [pdfLoadingIds, setPdfLoadingIds] = useState<Set<number>>(new Set());
  const [payslipTarget, setPayslipTarget] = useState<{ runId: number; resultId: number; period: string; type: 'MONTHLY' | 'WEEKLY' } | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await payrollService.listRuns({
        type: 'WEEKLY',
        year: selectedYear !== 'ALL' ? selectedYear : undefined,
        month: selectedMonth !== 'ALL' ? selectedMonth : undefined,
        week: selectedWeek !== 'ALL' ? selectedWeek : undefined,
        limit: 100,
      });
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
  }, [selectedYear, selectedMonth, selectedWeek]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  // ── Socket: refresh when any payroll run changes ──────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onRefresh = () => fetchRuns();
    socket.on('payroll:completed', onRefresh);
    socket.on('payroll:approved',  onRefresh);
    socket.on('payroll:locked',    onRefresh);
    socket.on('payroll:deleted',   onRefresh);
    return () => {
      socket.off('payroll:completed', onRefresh);
      socket.off('payroll:approved',  onRefresh);
      socket.off('payroll:locked',    onRefresh);
      socket.off('payroll:deleted',   onRefresh);
    };
  }, [socket, fetchRuns]);

  const run: ApiPayrollRun | undefined = runs[runIdx];

  // Reset table page when run or filter changes
  useEffect(() => { setPage(1); }, [runIdx, filter]);

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
  // Direct PDF download for a row — guarded against double-click
  const handleDirectPdf = async (r: ApiPayrollResult) => {
    if (!run || pdfLoadingIds.has(r.id)) return;
    setPdfLoadingIds((prev) => new Set(prev).add(r.id));
    try {
      const data = await payrollService.getPayslip(run.id, r.id);
      const { default: PayslipDocumentComp } = await import('../components/PayslipDocument');
      const { default: ReactDOMServer } = await import('react-dom/server');
      const React2 = await import('react');
      const html = ReactDOMServer.renderToStaticMarkup(
        React2.createElement(PayslipDocumentComp, { data })
      );
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;';
      container.innerHTML = html;
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      document.body.removeChild(container);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = pageW / canvas.width;
      const imgH  = canvas.height * ratio;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      let yPos = 0; let remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, 'JPEG', 0, -yPos, pageW, imgH);
        remaining -= pageH; yPos += pageH;
        if (remaining > 0) pdf.addPage();
      }
      const code   = r.employeeCode.replace(/\s+/g, '');
      const period = run.period;
      const wMatch = period.match(/^(\d{4})-W(\d{2})$/);
      const filename = wMatch
        ? `PAYSLIP_${code}_WEEK${wMatch[2]}_${wMatch[1]}.pdf`
        : `PAYSLIP_${code}_${period}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('PDF generation failed', err);
    } finally {
      setPdfLoadingIds((prev) => { const s = new Set(prev); s.delete(r.id); return s; });
    }
  };

  const allResults: ApiPayrollResult[] = run?.results ?? [];
  const filtered = filter === 'ALL'
    ? allResults
    : allResults.filter((r) => r.paymentMode === filter);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedData  = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totals = filtered.reduce(
    (acc, r) => ({
      earnedSalary:        acc.earnedSalary        + Number(r.earnedSalary || 0),
      otPay:               acc.otPay               + Number(r.otPay || 0),
      salaryAdvance:       acc.salaryAdvance       + Number(r.salaryAdvance || 0),
      permissionDeduction: acc.permissionDeduction + Number(r.permissionDeduction || 0),
      netSalary:           acc.netSalary           + Number(r.netSalary || 0),
      presentDays:         acc.presentDays         + Number(r.presentDays || 0),
      absentDays:          acc.absentDays          + Number(r.absentDays || 0),
      halfDays:            acc.halfDays            + Number(r.halfDays || 0),
    }),
    { earnedSalary: 0, otPay: 0, salaryAdvance: 0, permissionDeduction: 0, netSalary: 0, presentDays: 0, absentDays: 0, halfDays: 0 }
  );

  const totalAdditionalComp = run?.totalAdditionalComp || allResults.reduce((s, r) => s + Number(r.additionalComp?.additionalAmount || 0), 0);
  const totalCombinedNet = run?.totalCombinedNet || (totals.netSalary + totalAdditionalComp);

  const varianceCount = filtered.filter((r) => r.hasVariance).length;

  // ── Loading ──
  if (loading) return <CommonLoader text="Loading weekly payroll reports…" />;

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
      <div className="min-h-screen p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Weekly Payroll Report</h1>
            <p className="text-sm text-text-secondary mt-0.5">No payroll runs found for selected filters.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <FilterPopover
              activeFilterCount={activeFilterCount}
              hasActiveFilters={hasActiveFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              onOpen={handleOpenFilter}
            >
              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Week
                </label>
                <select
                  className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white text-slate-700 font-medium cursor-pointer"
                  value={draftWeek}
                  onChange={(e) => setDraftWeek(e.target.value)}
                >
                  {WEEK_OPTIONS.map((w) => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Month
                </label>
                <select
                  className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white text-slate-700 font-medium cursor-pointer"
                  value={draftMonth}
                  onChange={(e) => setDraftMonth(e.target.value)}
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Year
                </label>
                <select
                  className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white text-slate-700 font-medium cursor-pointer"
                  value={draftYear}
                  onChange={(e) => setDraftYear(e.target.value)}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y.value} value={y.value}>{y.label}</option>
                  ))}
                </select>
              </div>
            </FilterPopover>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-12 text-center shadow-sm">
          <p className="text-text-primary font-semibold text-lg">No weekly payroll runs found</p>
          <p className="text-text-secondary text-sm mt-1">Try selecting a different week, month, or year filter using the Filters button.</p>
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
    ...(canViewCashInHand ? [
      { header: 'Cash in Hand (₹)',  accessor: (r: typeof csvData[0]) => r.additionalComp?.additionalAmount || 0 },
      { header: 'Combined Net (₹)',  accessor: (r: typeof csvData[0]) => r.additionalComp?.combinedNet || r.netSalary },
    ] : []),
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
      header: canViewCashInHand ? 'COMBINED NET (₹)' : 'NET SALARY (₹)',
      align: 'right',
      render: (r) => {
        const hasAddl = canViewCashInHand && r.additionalComp && r.additionalComp.additionalAmount > 0;
        const combNet = hasAddl ? r.additionalComp!.combinedNet : r.netSalary;
        return (
          <div className="flex flex-col items-end">
            <span className="font-mono font-bold text-text-primary">₹{fmt(Number(combNet))}</span>
            {hasAddl && (
              <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-1 rounded">
                Net ₹{fmt(Number(r.netSalary))} + Cash ₹{fmt(Number(r.additionalComp!.additionalAmount))}
              </span>
            )}
          </div>
        );
      },
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
    {
      header: 'ACTIONS',
      align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          {canViewRun && (
            <ViewButton
              onClick={() => run && setPayslipTarget({ runId: run.id, resultId: r.id, period: run.period, type: 'WEEKLY' })}
            />
          )}
          <IconButton
            icon={FileDown}
            variant="success"
            title={pdfLoadingIds.has(r.id) ? 'Generating…' : 'Download PDF'}
            disabled={pdfLoadingIds.has(r.id)}
            onClick={() => handleDirectPdf(r)}
          />
        </div>
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
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Run Selector if multiple runs exist */}
          {runs.length > 1 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-sm">
              <span className="text-slate-500">Run:</span>
              <select
                value={runIdx}
                onChange={(e) => setRunIdx(Number(e.target.value))}
                className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer"
              >
                {runs.map((r, i) => (
                  <option key={r.id} value={i}>
                    {r.runCode} ({r.period})
                  </option>
                ))}
              </select>
            </div>
          )}

          <FilterPopover
            activeFilterCount={activeFilterCount}
            hasActiveFilters={hasActiveFilters}
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            onOpen={handleOpenFilter}
          >
            <div className="mb-3">
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Week
              </label>
              <select
                className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white text-slate-700 font-medium cursor-pointer"
                value={draftWeek}
                onChange={(e) => setDraftWeek(e.target.value)}
              >
                {WEEK_OPTIONS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Month
              </label>
              <select
                className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white text-slate-700 font-medium cursor-pointer"
                value={draftMonth}
                onChange={(e) => setDraftMonth(e.target.value)}
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Year
              </label>
              <select
                className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white text-slate-700 font-medium cursor-pointer"
                value={draftYear}
                onChange={(e) => setDraftYear(e.target.value)}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>
          </FilterPopover>

          {run && (
            <ExportCSVButton
              data={csvData}
              columns={csvColsIndexed}
              filename={`weekly-payroll-${run.period}.csv`}
              text="Export CSV"
            />
          )}
        </div>
      </div>

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
          data={pagedData}
          rowKey={(r) => r.id}
          emptyMessage="No employees match the selected filter."
          rowClassName={(r) => (r.hasVariance ? 'bg-amber-50 border-l-4 border-l-amber-400' : '')}
          density="compact"
          pagination={{ currentPage: page, totalPages, onPageChange: setPage }}
        />

        {/* Footer Summary Bar matching PayrollRun design */}
        {filtered.length > 0 && (
          <div className="bg-white border-t border-slate-200 overflow-hidden flex flex-col xl:flex-row items-stretch justify-between">

            {/* Left side: TOTAL EMPLOYEES */}
            <div className="px-6 py-4 flex items-center xl:border-r border-slate-200 xl:min-w-[180px] w-full xl:w-auto border-b xl:border-b-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL EMPLOYEES</p>
                  <p className="text-sm font-bold text-slate-800">{filtered.length}</p>
                </div>
              </div>
            </div>

            {/* Middle: EARNED | OT | GROSS | DEDUCTIONS */}
            <div className="flex-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6 py-4 text-xs border-b xl:border-b-0 border-slate-200">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">EARNED</span>
                <span className="font-mono font-semibold text-slate-700">
                  ₹{fmt(totals.earnedSalary)}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">OT</span>
                <span className="font-mono font-semibold text-emerald-600">
                  ₹{fmt(totals.otPay)}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">GROSS</span>
                <span className="font-mono font-bold text-slate-900">
                  ₹{fmt(totals.earnedSalary + totals.otPay)}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-0.5">DEDUCTIONS</span>
                <span className="font-mono font-semibold text-rose-600">
                  ADV ₹{fmt(totals.salaryAdvance)} · PERM ₹{fmt(totals.permissionDeduction)}
                </span>
              </div>
            </div>

            {/* Right side: NET PAY & CASH IN HAND */}
            <div className="flex items-stretch xl:border-l border-slate-200 bg-slate-50 w-full xl:w-auto">
              <div className="px-6 py-4 flex flex-col items-end justify-center border-r border-slate-200 flex-1 xl:flex-none">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">NET PAY</span>
                <span className="font-mono text-lg font-black text-emerald-700">
                  ₹{fmt(totals.netSalary)}
                </span>
              </div>

              {canViewCashInHand && (
                <div className="px-6 py-4 flex flex-col items-end justify-center bg-indigo-50/70 flex-1 xl:flex-none">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-0.5">CASH IN HAND</span>
                  <span className="font-mono text-lg font-black text-indigo-700">
                    ₹{fmt(totalAdditionalComp)}
                  </span>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 print:hidden">
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
          ...(canViewCashInHand && totalAdditionalComp > 0 ? [
            {
              label: 'Cash in Hand (Confidential)',
              value: `₹${fmt(totalAdditionalComp)}`,
              color: 'text-indigo-700 font-bold',
            }
          ] : []),
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

      {/* Payslip Modal */}
      {payslipTarget && (
        <PayslipModal
          runId={payslipTarget.runId}
          resultId={payslipTarget.resultId}
          period={payslipTarget.period}
          type={payslipTarget.type}
          onClose={() => setPayslipTarget(null)}
        />
      )}
    </div>
  );
};

export default WeeklyPayrollReport;
