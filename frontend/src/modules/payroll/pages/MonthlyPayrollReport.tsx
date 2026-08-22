import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, AlertTriangle, ChevronLeft, ChevronRight, Printer, FileDown, Users, TrendingUp, TrendingDown, Wallet, Shield, Clock } from 'lucide-react';
import ViewButton from '../../../components/ui/viewbutton/ViewButton';
import { usePermission } from '../../../hooks/usePermission';
import IconButton from '../../../components/ui/IconButton/IconButton';
import { FiRefreshCw } from 'react-icons/fi';
import CustomButton from '../../../components/ui/custombutton/CustomButton';
import ExportCSVButton from '../../../components/ui/ExportCSVButton/ExportCSVButton';
import DetailBox from '../../../components/ui/DetailBox/DetailBox';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import { useSocket } from '../../../providers/SocketProvider';
import { payrollService } from '../../../services/payrollService';
import type { ApiPayrollRun, ApiPayrollResult } from '../../../services/payrollService';
import DataTable, { type DataTableColumn } from '../../../components/ui/table/DataTable';
import PayslipModal from '../components/PayslipModal';
import FilterPopover from '../../../components/ui/FilterPopover/FilterPopover';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: any) => Number(n || 0).toLocaleString('en-IN');
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
  const { can } = usePermission();
  const canViewRun        = can("payroll-run.view");
  const { socket }    = useSocket();
  const [selectedYear, setSelectedYear]   = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [draftYear, setDraftYear]         = useState<string>('ALL');
  const [draftMonth, setDraftMonth]       = useState<string>('ALL');

  const hasActiveFilters = selectedMonth !== 'ALL' || selectedYear !== 'ALL';
  const activeFilterCount = (selectedMonth !== 'ALL' ? 1 : 0) + (selectedYear !== 'ALL' ? 1 : 0);

  const handleOpenFilter = () => {
    setDraftMonth(selectedMonth);
    setDraftYear(selectedYear);
  };

  const handleApplyFilters = () => {
    setSelectedMonth(draftMonth);
    setSelectedYear(draftYear);
  };

  const handleClearFilters = () => {
    setDraftMonth('ALL');
    setDraftYear('ALL');
    setSelectedMonth('ALL');
    setSelectedYear('ALL');
  };

  const [runs, setRuns]       = useState<ApiPayrollRun[]>([]);
  const [runIdx, setRunIdx]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [view, setView]       = useState<ViewMode>('ALL');
  const [page, setPage]       = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  // Track which result ids have PDF generation in progress (prevents double-click)
  const [pdfLoadingIds, setPdfLoadingIds] = useState<Set<number>>(new Set());
  const [payslipTarget, setPayslipTarget] = useState<{ runId: number; resultId: number; period: string; type: 'MONTHLY' | 'WEEKLY' } | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await payrollService.listRuns({
        type: 'MONTHLY',
        year: selectedYear !== 'ALL' ? selectedYear : undefined,
        month: selectedMonth !== 'ALL' ? selectedMonth : undefined,
        limit: 100,
      });
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
  }, [selectedYear, selectedMonth]);

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

  // Reset table page when run or view changes
  useEffect(() => { setPage(1); }, [runIdx, view]);

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

  // Direct PDF download (no modal) for a single result row — guarded against double-click
  const handleDirectPdf = async (r: ApiPayrollResult) => {
    if (!run || pdfLoadingIds.has(r.id)) return;
    setPdfLoadingIds((prev) => new Set(prev).add(r.id));
    try {
      const data = await payrollService.getPayslip(run.id, r.id);
      const { default: PayslipDocument } = await import('../components/PayslipDocument');
      const { default: ReactDOMServer }  = await import('react-dom/server');
      const React2 = await import('react');
      const html = ReactDOMServer.renderToStaticMarkup(
        React2.createElement(PayslipDocument, { data })
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
      let yPos = 0; let remaining = imgH;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      while (remaining > 0) {
        pdf.addImage(imgData, 'JPEG', 0, -yPos, pageW, imgH);
        remaining -= pageH; yPos += pageH;
        if (remaining > 0) pdf.addPage();
      }
      // Build filename
      const code = r.employeeCode.replace(/\s+/g, '');
      const period = run.period;
      let filename = `PAYSLIP_${code}_${period}.pdf`;
      if (/^\d{4}-\d{2}$/.test(period)) {
        const [y, m] = period.split('-');
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        filename = `PAYSLIP_${code}_${months[parseInt(m, 10) - 1]}_${y}.pdf`;
      }
      pdf.save(filename);
    } catch (err) {
      console.error('PDF generation failed', err);
    } finally {
      setPdfLoadingIds((prev) => { const s = new Set(prev); s.delete(r.id); return s; });
    }
  };

  const allResults: ApiPayrollResult[] = run?.results ?? [];
  const pfEmployees   = allResults.filter((r) => r.pfApplicable);
  const cashEmployees = allResults.filter((r) => !r.pfApplicable);

  const varianceCount = allResults.filter((r) => r.hasVariance).length;

  // ── Totals ──
  const allTotals = allResults.reduce(
    (a, e) => ({
      grossSalary:     a.grossSalary     + Number(e.grossSalary    || 0),
      presentDays:     a.presentDays     + Number(e.presentDays    || 0),
      absentDays:      a.absentDays      + Number(e.absentDays     || 0),
      halfDays:        a.halfDays        + Number(e.halfDays        || 0),
      lopDays:         a.lopDays         + Number(e.lopDays         || 0),
      otHours:         a.otHours         + Number(e.otHours         || 0),
      otPay:           a.otPay           + Number(e.otPay           || 0),
      totalDeductions: a.totalDeductions + Number(e.totalDeductions || 0),
      netSalary:       a.netSalary       + Number(e.netSalary       || 0),
    }),
    { grossSalary: 0, presentDays: 0, absentDays: 0, halfDays: 0, lopDays: 0, otHours: 0, otPay: 0, totalDeductions: 0, netSalary: 0 }
  );

  const pfTotals = pfEmployees.reduce(
    (a, e) => ({
      grossSalary:     a.grossSalary     + Number(e.grossSalary     || 0),
      earnedSalary:    a.earnedSalary    + Number(e.earnedSalary    || 0),
      lopDays:         a.lopDays         + Number(e.lopDays         || 0),
      otherDeductions: a.otherDeductions + Number(e.otherDeductions || 0),
      employeePf:      a.employeePf      + Number(e.employeePf      || 0),
      employerPf:      a.employerPf      + Number(e.employerPf      || 0),
      employeeEsi:     a.employeeEsi     + Number(e.employeeEsi     || 0),
      employerEsi:     a.employerEsi     + Number(e.employerEsi     || 0),
      netSalary:       a.netSalary       + Number(e.netSalary       || 0),
    }),
    { grossSalary: 0, earnedSalary: 0, lopDays: 0, otherDeductions: 0, employeePf: 0, employerPf: 0, employeeEsi: 0, employerEsi: 0, netSalary: 0 }
  );

  const cashTotals = cashEmployees.reduce(
    (a, e) => ({
      grossSalary:         a.grossSalary         + Number(e.grossSalary         || 0),
      presentDays:         a.presentDays         + Number(e.presentDays         || 0),
      otPay:               a.otPay               + Number(e.otPay               || 0),
      salaryAdvance:       a.salaryAdvance        + Number(e.salaryAdvance       || 0),
      permissionDeduction: a.permissionDeduction  + Number(e.permissionDeduction || 0),
      netSalary:           a.netSalary            + Number(e.netSalary           || 0),
    }),
    { grossSalary: 0, presentDays: 0, otPay: 0, salaryAdvance: 0, permissionDeduction: 0, netSalary: 0 }
  );

  const totalNet          = pfTotals.netSalary + cashTotals.netSalary;
  const totalPfLiability  = pfTotals.employeePf + pfTotals.employerPf;
  const totalEsiLiability = pfTotals.employeeEsi + pfTotals.employerEsi;
  const totalCashInHand = allResults.reduce((s, r) => s + Number(r.cashInHand || 0), 0);

  // ── CSV columns ──
  const allCsvCols = [
    { header: 'Emp Code',              accessor: (r: ApiPayrollResult) => r.employeeCode },
    { header: 'Name',                  accessor: (r: ApiPayrollResult) => r.employeeName },
    { header: 'Department',            accessor: (r: ApiPayrollResult) => r.department },
    { header: 'Salary Type',           accessor: (r: ApiPayrollResult) => SALARY_TYPE_LABEL[r.salaryType] ?? r.salaryType },
    { header: 'Present Days',          accessor: (r: ApiPayrollResult) => r.presentDays },
    { header: 'Absent Days',           accessor: (r: ApiPayrollResult) => r.absentDays },
    { header: 'Half Days',             accessor: (r: ApiPayrollResult) => r.halfDays },
    { header: 'LOP Days',              accessor: (r: ApiPayrollResult) => r.lopDays },
    { header: 'OT Hours',              accessor: (r: ApiPayrollResult) => r.otHours },
    { header: 'OT Pay (₹)',            accessor: (r: ApiPayrollResult) => r.otPay },
    { header: 'Gross (₹)',             accessor: (r: ApiPayrollResult) => r.grossSalary },
    { header: 'Total Deductions (₹)',  accessor: (r: ApiPayrollResult) => r.totalDeductions },
    { header: 'Net Salary (₹)',        accessor: (r: ApiPayrollResult) => r.netSalary },
    { header: 'Cash in Hand (₹)',     accessor: (r: ApiPayrollResult) => r.cashInHand || 0 },
    { header: 'Payment Mode',          accessor: (r: ApiPayrollResult) => r.paymentMode },
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
    { header: 'Cash in Hand (₹)', accessor: (r: ApiPayrollResult) => r.cashInHand || 0 },
  ];

  const cashCsvCols = [
    { header: 'Emp Code',             accessor: (r: ApiPayrollResult) => r.employeeCode },
    { header: 'Name',                 accessor: (r: ApiPayrollResult) => r.employeeName },
    { header: 'Department',           accessor: (r: ApiPayrollResult) => r.department },
    { header: 'Gross (₹)',            accessor: (r: ApiPayrollResult) => r.grossSalary },
    { header: 'Present Days',         accessor: (r: ApiPayrollResult) => r.presentDays },
    { header: 'OT Pay (₹)',           accessor: (r: ApiPayrollResult) => r.otPay },
    { header: 'Advance (₹)',          accessor: (r: ApiPayrollResult) => r.salaryAdvance },
    { header: 'Perm. Deduction (₹)',  accessor: (r: ApiPayrollResult) => r.permissionDeduction },
    { header: 'Net Salary (₹)',       accessor: (r: ApiPayrollResult) => r.netSalary },
    { header: 'Cash in Hand (₹)',    accessor: (r: ApiPayrollResult) => r.cashInHand || 0 },
    { header: 'Payment Mode',         accessor: (r: ApiPayrollResult) => r.paymentMode },
  ];

  const getCsvData = () => {
    if (view === 'PF')   return pfEmployees;
    if (view === 'CASH') return cashEmployees;
    return allResults;
  };
  const getCsvCols = () => {
    if (view === 'PF')   return pfCsvCols;
    if (view === 'CASH') return cashCsvCols;
    return allCsvCols;
  };

  // ── Shared actions column ─────────────────────────────────────────────────
  const actionsColumn: DataTableColumn<ApiPayrollResult> = {
    header: 'ACTIONS',
    align: 'center',
    render: (r) => (
      <div className="flex items-center justify-center gap-1">
        {canViewRun && (
          <ViewButton
            onClick={() => run && setPayslipTarget({ runId: run.id, resultId: r.id, period: run.period, type: 'MONTHLY' })}
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
  };

  // ── DataTable column definitions ──────────────────────────────────────────

  const allColumns: DataTableColumn<ApiPayrollResult>[] = [
    {
      header: '#',
      align: 'left',
      render: (_, idx) => <span className="text-text-muted">{idx + 1}</span>,
    },
    {
      header: 'EMP CODE',
      align: 'left',
      render: (r) => <span className="font-mono text-xs text-text-secondary">{r.employeeCode}</span>,
    },
    {
      header: 'NAME',
      align: 'left',
      render: (r) => (
        <span className="font-semibold text-text-primary whitespace-nowrap">
          {r.hasVariance && <AlertTriangle size={12} className="inline text-amber-500 mr-1" />}
          {r.employeeName}
        </span>
      ),
    },
    {
      header: 'DEPT',
      align: 'left',
      render: (r) => <span className="text-text-secondary">{r.department}</span>,
    },
    {
      header: 'TYPE',
      align: 'left',
      render: (r) => (
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
          r.pfApplicable ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {SALARY_TYPE_LABEL[r.salaryType] ?? r.salaryType}
        </span>
      ),
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
      header: 'LOP',
      align: 'right',
      render: (r) => (
        <span className={`font-mono ${Number(r.lopDays) > 0 ? 'text-red-600 font-semibold' : 'text-text-muted'}`}>
          {Number(r.lopDays) > 0 ? r.lopDays : '—'}
        </span>
      ),
    },
    {
      header: 'OT HRS',
      align: 'right',
      render: (r) => (
        <span className={`font-mono ${Number(r.otHours) > 0 ? 'text-blue-600' : 'text-text-muted'}`}>
          {Number(r.otHours) > 0 ? Number(r.otHours).toFixed(1) : '—'}
        </span>
      ),
    },
    {
      header: 'OT PAY (₹)',
      align: 'right',
      render: (r) => (
        <span className={`font-mono ${Number(r.otPay) > 0 ? 'text-blue-600' : 'text-text-muted'}`}>
          {Number(r.otPay) > 0 ? `₹${fmt(r.otPay)}` : '—'}
        </span>
      ),
    },
    {
      header: 'GROSS (₹)',
      align: 'right',
      render: (r) => <span className="font-mono font-semibold">₹{fmt(r.grossSalary)}</span>,
    },
    {
      header: 'DEDUCTIONS (₹)',
      align: 'right',
      render: (r) => (
        <span className={`font-mono ${Number(r.totalDeductions) > 0 ? 'text-red-600' : 'text-text-muted'}`}>
          {Number(r.totalDeductions) > 0 ? `₹${fmt(r.totalDeductions)}` : '—'}
        </span>
      ),
    },
    {
      header: 'NET (₹)',
      align: 'right',
      render: (r) => (
        <div className="flex flex-col items-end">
          <span className="font-mono font-bold text-text-primary text-base">₹{fmt(r.netSalary)}</span>
          {Number(r.cashInHand || 0) > 0 && (
            <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-1 rounded">
              Cash in Hand ₹{fmt(r.cashInHand)}
            </span>
          )}
        </div>
      ),
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
    actionsColumn,
  ];

  const pfColumns: DataTableColumn<ApiPayrollResult>[] = [
    {
      header: 'EMP CODE',
      align: 'left',
      render: (r) => <span className="font-mono text-xs text-text-secondary">{r.employeeCode}</span>,
    },
    {
      header: 'NAME',
      align: 'left',
      render: (r) => (
        <span className="font-semibold text-text-primary whitespace-nowrap">
          {r.hasVariance && <AlertTriangle size={12} className="inline text-amber-500 mr-1" />}
          {r.employeeName}
        </span>
      ),
    },
    {
      header: 'DEPT',
      align: 'left',
      render: (r) => <span className="text-text-secondary">{r.department}</span>,
    },
    {
      header: 'GROSS (₹)',
      align: 'right',
      render: (r) => <span className="font-mono font-semibold">₹{fmt(r.grossSalary)}</span>,
    },
    {
      header: 'EARNED (₹)',
      align: 'right',
      render: (r) => <span className="font-mono">₹{fmt(r.earnedSalary)}</span>,
    },
    {
      header: 'LOP DAYS',
      align: 'right',
      render: (r) => (
        <span className={`font-mono ${Number(r.lopDays) > 0 ? 'text-red-600' : 'text-text-muted'}`}>
          {Number(r.lopDays) > 0 ? r.lopDays : '—'}
        </span>
      ),
    },
    {
      header: 'PF WAGE (₹)',
      align: 'right',
      render: (r) => <span className="font-mono">₹{fmt(r.pfWage)}</span>,
    },
    {
      header: 'PF EMP (₹)',
      align: 'right',
      render: (r) => <span className="font-mono text-violet-700">₹{fmt(r.employeePf)}</span>,
    },
    {
      header: 'PF ER (₹)',
      align: 'right',
      render: (r) => <span className="font-mono text-violet-500">₹{fmt(r.employerPf)}</span>,
    },
    {
      header: 'ESI EMP (₹)',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-blue-700">
          {Number(r.employeeEsi) > 0 ? `₹${fmt(r.employeeEsi)}` : '—'}
        </span>
      ),
    },
    {
      header: 'ESI ER (₹)',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-blue-500">
          {Number(r.employerEsi) > 0 ? `₹${fmt(r.employerEsi)}` : '—'}
        </span>
      ),
    },
    {
      header: 'NET SALARY (₹)',
      align: 'right',
      render: (r) => (
        <div className="flex flex-col items-end">
          <span className="font-mono font-bold text-text-primary text-base">₹{fmt(r.netSalary)}</span>
          {Number(r.cashInHand || 0) > 0 && (
            <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-1 rounded">
              Cash in Hand ₹{fmt(r.cashInHand)}
            </span>
          )}
        </div>
      ),
    },
    actionsColumn,
  ];

  const cashColumns: DataTableColumn<ApiPayrollResult>[] = [
    {
      header: 'EMP CODE',
      align: 'left',
      render: (r) => <span className="font-mono text-xs text-text-secondary">{r.employeeCode}</span>,
    },
    {
      header: 'NAME',
      align: 'left',
      render: (r) => (
        <span className="font-semibold text-text-primary whitespace-nowrap">
          {r.hasVariance && <AlertTriangle size={12} className="inline text-amber-500 mr-1" />}
          {r.employeeName}
        </span>
      ),
    },
    {
      header: 'DEPT',
      align: 'left',
      render: (r) => <span className="text-text-secondary">{r.department}</span>,
    },
    {
      header: 'GROSS (₹)',
      align: 'right',
      render: (r) => <span className="font-mono font-semibold">₹{fmt(r.grossSalary)}</span>,
    },
    {
      header: 'PRESENT DAYS',
      align: 'right',
      render: (r) => <span className="font-mono text-emerald-700 font-semibold">{r.presentDays}</span>,
    },
    {
      header: 'OT PAY (₹)',
      align: 'right',
      render: (r) => (
        <span className={`font-mono ${Number(r.otPay) > 0 ? 'text-emerald-700' : 'text-text-muted'}`}>
          {Number(r.otPay) > 0 ? `₹${fmt(r.otPay)}` : '—'}
        </span>
      ),
    },
    {
      header: 'ADVANCE (₹)',
      align: 'right',
      render: (r) => (
        <span className={`font-mono ${Number(r.salaryAdvance) > 0 ? 'text-amber-700' : 'text-text-muted'}`}>
          {Number(r.salaryAdvance) > 0 ? `₹${fmt(r.salaryAdvance)}` : '—'}
        </span>
      ),
    },
    {
      header: 'PERM. DED. (₹)',
      align: 'right',
      render: (r) => (
        <span className={`font-mono ${Number(r.permissionDeduction) > 0 ? 'text-red-600' : 'text-text-muted'}`}>
          {Number(r.permissionDeduction) > 0 ? `₹${fmt(r.permissionDeduction)}` : '—'}
        </span>
      ),
    },
    {
      header: 'NET SALARY (₹)',
      align: 'right',
      render: (r) => (
        <div className="flex flex-col items-end">
          <span className="font-mono font-bold text-text-primary">₹{fmt(r.netSalary)}</span>
          {Number(r.cashInHand || 0) > 0 && (
            <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-1 rounded">
              Cash in Hand ₹{fmt(r.cashInHand)}
            </span>
          )}
        </div>
      ),
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
    actionsColumn,
  ];

  // ── Loading ──
  if (loading) return <CommonLoader text="Loading monthly payroll reports…" />;

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
      <div className="min-h-screen p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Monthly Payroll Report</h1>
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
          <p className="text-text-primary font-semibold text-lg">No monthly payroll runs found</p>
          <p className="text-text-secondary text-sm mt-1">Try selecting a different month or year filter using the Filters button.</p>
        </div>
      </div>
    );
  }

  // ── Active data for the selected view ──
  const activeData    = view === 'PF' ? pfEmployees : view === 'CASH' ? cashEmployees : allResults;
  const activeColumns = view === 'PF' ? pfColumns   : view === 'CASH' ? cashColumns   : allColumns;

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(activeData.length / pageSize));
  const pagedData  = activeData.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="min-h-screen p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Monthly Payroll Report</h1>
          {run && (
            <p className="text-sm text-text-secondary mt-0.5">
              {run.runCode} — {run.period}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[run.status]}`}>
                {run.status}
              </span>
            </p>
          )}
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

          {/* Filter Popover Button */}
          <FilterPopover
            activeFilterCount={activeFilterCount}
            hasActiveFilters={hasActiveFilters}
            onApply={handleApplyFilters}
            onClear={handleClearFilters}
            onOpen={handleOpenFilter}
          >
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
              data={getCsvData()}
              columns={getCsvCols()}
              filename={`monthly-payroll-${view.toLowerCase()}-${run.period}.csv`}
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

      {/* Main table — full width */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <DataTable
          columns={activeColumns}
          data={pagedData}
          rowKey={(r) => r.id}
          emptyMessage="No employees match the selected view."
          rowClassName={(r) => (r.hasVariance ? 'bg-amber-50 border-l-4 border-l-amber-400' : '')}
          density="compact"
          pagination={{ currentPage: page, totalPages, onPageChange: setPage }}
        />

        {/* Footer Summary Bar matching PayrollRun design */}
        {activeData.length > 0 && (
          <div className="bg-white border-t border-slate-200 overflow-hidden flex flex-col xl:flex-row items-stretch justify-between">

            {/* Left side: TOTAL EMPLOYEES */}
            <div className="px-6 py-4 flex items-center xl:border-r border-slate-200 xl:min-w-[180px] w-full xl:w-auto border-b xl:border-b-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL EMPLOYEES</p>
                  <p className="text-sm font-bold text-slate-800">{activeData.length}</p>
                </div>
              </div>
            </div>

            {/* Middle: EARNED | OT | GROSS | DEDUCTIONS */}
            <div className="flex-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6 py-4 text-xs border-b xl:border-b-0 border-slate-200">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">EARNED</span>
                <span className="font-mono font-semibold text-slate-700">
                  ₹{fmt(activeData.reduce((s, r) => s + Number(r.earnedSalary || 0), 0))}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">OT</span>
                <span className="font-mono font-semibold text-emerald-600">
                  ₹{fmt(activeData.reduce((s, r) => s + Number(r.otPay || 0), 0))}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">GROSS</span>
                <span className="font-mono font-bold text-slate-900">
                  ₹{fmt(activeData.reduce((s, r) => s + Number(r.grossSalary || 0), 0))}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-0.5">DEDUCTIONS</span>
                <span className="font-mono font-semibold text-rose-600">
                  PF ₹{fmt(activeData.reduce((s, r) => s + Number((r as any).employeePf || 0), 0))} · ESI ₹{fmt(activeData.reduce((s, r) => s + Number((r as any).employeeEsi || 0), 0))}
                </span>
              </div>
            </div>

            {/* Right side: NET PAY & CASH IN HAND */}
            <div className="flex items-stretch xl:border-l border-slate-200 bg-slate-50 w-full xl:w-auto">
              <div className="px-6 py-4 flex flex-col items-end justify-center border-r border-slate-200 flex-1 xl:flex-none">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">NET PAY</span>
                <span className="font-mono text-lg font-black text-emerald-700">
                  ₹{fmt(activeData.reduce((s, r) => s + Number(r.netSalary || 0), 0))}
                </span>
              </div>

              {activeData.reduce((s, r) => s + Number(r.cashInHand || 0), 0) > 0 && (
                <div className="px-6 py-4 flex flex-col items-end justify-center bg-indigo-50/70 flex-1 xl:flex-none">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-0.5">CASH IN HAND</span>
                  <span className="font-mono text-lg font-black text-indigo-700">
                    ₹{fmt(activeData.reduce((s, r) => s + Number(r.cashInHand || 0), 0))}
                  </span>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Summary Panel — below table as stat cards */}
      <div className="space-y-4">
        {/* Row 1: Headcount + Financials */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-text-muted">
              <Users size={15} />
              <span className="text-[11px] font-bold uppercase tracking-wide">Employees</span>
            </div>
            <DetailBox label="Total" value={<span className="text-lg font-bold text-text-primary">{allResults.length}</span>} />
            <div className="flex gap-3 mt-1">
              <DetailBox label="PF" value={<span className="text-sm font-semibold text-violet-700">{pfEmployees.length}</span>} />
              <DetailBox label="Cash" value={<span className="text-sm font-semibold text-emerald-700">{cashEmployees.length}</span>} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-text-muted">
              <TrendingUp size={15} />
              <span className="text-[11px] font-bold uppercase tracking-wide">Gross Salary</span>
            </div>
            <DetailBox
              label={`${allResults.length} employees`}
              value={<span className="text-base font-bold text-text-primary font-mono">₹{fmt(pfTotals.grossSalary + cashTotals.grossSalary)}</span>}
            />
          </div>

          <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-text-muted">
              <TrendingDown size={15} />
              <span className="text-[11px] font-bold uppercase tracking-wide">Deductions</span>
            </div>
            <DetailBox
              label="Total deducted"
              value={<span className="text-base font-bold text-red-600 font-mono">₹{fmt(allTotals.totalDeductions)}</span>}
            />
          </div>

          <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-text-muted">
              <Wallet size={15} />
              <span className="text-[11px] font-bold uppercase tracking-wide">Net Payable</span>
            </div>
            <DetailBox
              label="Total net salary"
              value={<span className="text-base font-bold text-primary font-mono">₹{fmt(totalNet)}</span>}
            />
          </div>

          {totalCashInHand > 0 && (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 shadow-sm p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-indigo-800">
                <Shield size={15} className="text-indigo-600" />
                <span className="text-[11px] font-bold uppercase tracking-wide">Cash In Hand</span>
              </div>
              <DetailBox
                label="Total Cash in Hand"
                value={<span className="text-base font-bold text-indigo-700 font-mono">₹{fmt(totalCashInHand)}</span>}
              />
            </div>
          )}

          <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-text-muted">
              <Clock size={15} />
              <span className="text-[11px] font-bold uppercase tracking-wide">Attendance</span>
            </div>
            <div className="flex gap-3 flex-wrap">
              <DetailBox label="Present" value={<span className="text-sm font-semibold text-emerald-700">{allTotals.presentDays}</span>} />
              <DetailBox label="Absent" value={<span className="text-sm font-semibold text-red-600">{allTotals.absentDays}</span>} />
              {allTotals.lopDays > 0 && (
                <DetailBox label="LOP" value={<span className="text-sm font-semibold text-red-600">{allTotals.lopDays}</span>} />
              )}
            </div>
          </div>

          {(totalPfLiability > 0 || totalEsiLiability > 0) && (
            <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-text-muted">
                <Shield size={15} />
                <span className="text-[11px] font-bold uppercase tracking-wide">Statutory</span>
              </div>
              {totalPfLiability > 0 && (
                <DetailBox
                  label="PF (Emp + Er)"
                  value={<span className="text-sm font-semibold text-violet-700 font-mono">₹{fmt(totalPfLiability)}</span>}
                />
              )}
              {totalEsiLiability > 0 && (
                <DetailBox
                  label="ESI (Emp + Er)"
                  value={<span className="text-sm font-semibold text-blue-700 font-mono">₹{fmt(totalEsiLiability)}</span>}
                />
              )}
            </div>
          )}
        </div>

        {/* Run info bar */}
        <div className="bg-white rounded-xl border border-border shadow-sm px-5 py-3 flex flex-wrap items-center gap-6">
          <DetailBox label="Run Code" value={<span className="font-mono text-sm text-text-primary">{run.runCode}</span>} />
          <DetailBox label="Period" value={<span className="font-mono text-sm text-text-primary">{run.period}</span>} />
          <DetailBox label="Status" value={
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[run.status]}`}>
              {run.status}
            </span>
          } />
          <DetailBox label="Calendar Days" value={<span className="font-mono text-sm">{run.calendarDays}</span>} />
          {varianceCount > 0 && (
            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold ml-auto">
              <AlertTriangle size={14} /> {varianceCount} Variance{varianceCount > 1 ? 's' : ''} flagged
            </div>
          )}
        </div>
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

export default MonthlyPayrollReport;
