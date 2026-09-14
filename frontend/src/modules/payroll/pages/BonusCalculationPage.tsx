import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift, Calendar, Users, IndianRupee, Printer,
  RefreshCw, Search, ArrowLeft,
  FileSpreadsheet,
} from 'lucide-react';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import Button from '../../../components/ui/Button/Button';
import { usePermission } from '../../../hooks/usePermission';
import { payrollService } from '../../../services/payrollService';
import type {
  ApiBonusCalculationResponse,
  ApiBonusEmployeeRow,
  ApiBonusMonthMeta,
} from '../../../services/payrollService';
import { toast } from 'react-toastify';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number | string | undefined | null) => Number(n || 0).toLocaleString('en-IN');
const fmtRs = (n: number | string | undefined | null) => `₹${fmt(Math.round(Number(n || 0)))}`;
const fmtDecimal = (n: number | string | undefined | null, decimals = 2) =>
  Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const CATEGORIES = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'WEEKLY', label: 'Weekly' },
];

const BonusCalculationPage: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermission();

  // Date filters
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate]     = useState<string>('2026-12-31');
  const [category, setCategory]   = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [hoveredEmpId, setHoveredEmpId] = useState<string | null>(null);

  // Data & Loading
  const [data, setData]       = useState<ApiBonusCalculationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError]     = useState<string>('');

  const fetchBonusData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError('');

      const res = await payrollService.getBonusCalculation({
        startDate,
        endDate,
        category: category !== 'ALL' ? category : undefined,
      });
      setData(res);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to calculate bonus data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, category]);

  useEffect(() => {
    fetchBonusData();
  }, [fetchBonusData]);

  // Filter employees by search term
  const filteredEmployees = useMemo(() => {
    if (!data?.employees) return [];
    if (!searchTerm.trim()) return data.employees;
    const term = searchTerm.toLowerCase();
    return data.employees.filter(
      emp =>
        emp.employeeName.toLowerCase().includes(term) ||
        emp.rollNo.toLowerCase().includes(term) ||
        emp.department.toLowerCase().includes(term)
    );
  }, [data?.employees, searchTerm]);

  // Dynamic summary calculation based on filtered employees
  const filteredSummary = useMemo(() => {
    const list = filteredEmployees;
    return {
      totalEmployees: list.length,
      totalGrossSalary: list.reduce((s, r) => s + r.monthlySalary, 0),
      totalPresentDays: Number(list.reduce((s, r) => s + r.totalPresentDays, 0).toFixed(1)),
      totalLeaveDays: Number(list.reduce((s, r) => s + r.totalLeaveDays, 0).toFixed(1)),
      totalBonus: Number(list.reduce((s, r) => s + r.bonus, 0).toFixed(2)),
      totalPaidAmount: Number(list.reduce((s, r) => s + r.paidAmount, 0).toFixed(2)),
      totalBalance: Number(list.reduce((s, r) => s + r.balance, 0).toFixed(2)),
    };
  }, [filteredEmployees]);

  // CSV Export
  const handleExportCSV = () => {
    if (!data || !filteredEmployees.length) return;

    const months = data.months;
    const headerRow1 = [
      'S.No',
      'Roll No',
      'Employee Name',
      'Department',
      'Date Of Joining',
      'Total Exp (Years)',
      'Monthly Salary',
      'Salary Type',
      ...months.flatMap(m => [`${m.label} Leave Days`, `${m.label} Present Days`]),
      'Overall Total Leave Days',
      'Overall Total Present Days',
      'Per Day Bonus (₹)',
      'Overall Bonus (₹)',
      'Paid Amount (₹)',
      'Balance (₹)',
    ];

    const csvRows = [headerRow1.join(',')];

    filteredEmployees.forEach(emp => {
      const row = [
        emp.sNo,
        `"${emp.rollNo}"`,
        `"${emp.employeeName}"`,
        `"${emp.department}"`,
        `"${emp.formattedDoj}"`,
        emp.experienceYears,
        emp.monthlySalary,
        `"${emp.salaryType}"`,
        ...emp.monthlyData.flatMap(m => [m.leaveDays, m.presentDays]),
        emp.totalLeaveDays,
        emp.totalPresentDays,
        emp.perDayBonus,
        emp.bonus,
        emp.paidAmount,
        emp.balance,
      ];
      csvRows.push(row.join(','));
    });

    // Summary Row
    const summaryRow = [
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      filteredSummary.totalGrossSalary,
      '',
      ...months.flatMap(m => {
        const mLeave = filteredEmployees.reduce((s, e) => {
          const d = e.monthlyData.find(x => x.monthKey === m.monthKey);
          return s + (d?.leaveDays || 0);
        }, 0);
        const mPres = filteredEmployees.reduce((s, e) => {
          const d = e.monthlyData.find(x => x.monthKey === m.monthKey);
          return s + (d?.presentDays || 0);
        }, 0);
        return [mLeave, mPres];
      }),
      filteredSummary.totalLeaveDays,
      filteredSummary.totalPresentDays,
      '',
      filteredSummary.totalBonus,
      filteredSummary.totalPaidAmount,
      filteredSummary.totalBalance,
    ];
    csvRows.push(summaryRow.join(','));

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bonus_Calculation_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Bonus report exported successfully');
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && !data) return <CommonLoader text="Calculating attendance & bonus metrics…" />;

  return (
    <div className="min-h-screen bg-page p-4 sm:p-6 space-y-5">

      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line-soft pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => navigate('/payroll')}
              className="p-1.5 rounded-xl text-ink-muted hover:text-ink hover:bg-card-2 border border-line-soft transition-all cursor-pointer"
              title="Back to Payroll Dashboard"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight flex items-center gap-2.5">
              <Gift className="text-primary" size={26} />
              <span>Employee Bonus Calculation</span>
            </h1>
          </div>
          <p className="text-xs text-ink-muted flex items-center gap-2 pl-8">
            <span>Automated calculation based on Payroll Attendance records</span>
            <span>•</span>
            <span className="font-semibold text-ink">Formula: (Gross Salary ÷ 365) × Present Days</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            text={refreshing ? 'Refreshing…' : 'Refresh'}
            icon={RefreshCw as any}
            variant="secondary"
            size="sm"
            onClick={() => fetchBonusData(true)}
            disabled={refreshing}
          />
          <Button
            text="Export Excel"
            icon={FileSpreadsheet as any}
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={!filteredEmployees.length}
          />
          <Button
            text="Print Report"
            icon={Printer as any}
            variant="primary"
            size="sm"
            onClick={handlePrint}
            disabled={!filteredEmployees.length}
          />
        </div>
      </div>

      {/* ── Filter Toolbar (Start Date, End Date, Category, Search) ── */}
      <div className="bg-card rounded-2xl border border-line-soft p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">
              Start Date
            </label>
            <div className="flex items-center gap-2 bg-card-2 border border-line-soft rounded-xl px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Calendar size={15} className="text-ink-subtle shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-ink outline-none w-full cursor-pointer"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">
              End Date
            </label>
            <div className="flex items-center gap-2 bg-card-2 border border-line-soft rounded-xl px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Calendar size={15} className="text-ink-subtle shrink-0" />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-ink outline-none w-full cursor-pointer"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">
              Employee Category
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-card-2 border border-line-soft rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none cursor-pointer focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1.5">
              Search Employee
            </label>
            <div className="flex items-center gap-2 bg-card-2 border border-line-soft rounded-xl px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Search size={15} className="text-ink-subtle shrink-0" />
              <input
                type="text"
                placeholder="Search name or roll no..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent text-xs font-semibold text-ink placeholder:text-ink-subtle outline-none w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bonus Calculation Matrix Table Container ── */}
      <div className="bg-card rounded-2xl border border-line-soft shadow-xs overflow-hidden">
        {/* Table Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 border-b border-line-soft gap-3 bg-card-2/50">
          <div>
            <h2 className="text-sm font-extrabold text-ink tracking-tight flex items-center gap-2">
              <span>Bonus & Leave History Matrix</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                {startDate} to {endDate}
              </span>
            </h2>
            <p className="text-[11px] text-ink-muted mt-0.5">
              Showing {filteredEmployees.length} of {data?.employees.length || 0} employees across {data?.months.length || 0} months
            </p>
          </div>
          <div className="text-[11px] font-mono font-semibold text-ink-muted">
            Formula: <span className="text-ink font-bold">Bonus = Present Days × (Gross ÷ 365)</span>
          </div>
        </div>

        {/* Dual-Pane Table: Left Frozen Pane + Right Horizontally Scrollable Pane */}
        <div className="flex border-t border-line-soft overflow-hidden">
          {/* ── LEFT PANE: Frozen Columns (S.No, Roll No, Employee Name) ── */}
          <div className="w-[352px] shrink-0 border-r border-line-soft bg-card shadow-[4px_0_10px_-2px_rgba(0,0,0,0.08)] z-20 flex flex-col">
            {/* Left Header */}
            <div className="h-[73px] bg-card-2 border-b border-line-soft flex items-center text-ink font-extrabold uppercase text-[11px] tracking-wider shrink-0">
              <div className="w-[52px] h-full flex items-center justify-center border-r border-line-soft shrink-0">
                S.No
              </div>
              <div className="w-[90px] h-full flex items-center justify-center border-r border-line-soft shrink-0">
                Roll No
              </div>
              <div className="w-[210px] h-full flex items-center px-4 shrink-0">
                Employee Name
              </div>
            </div>

            {/* Left Body Rows */}
            <div className="divide-y divide-line-soft flex-1">
              {filteredEmployees.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-xs text-ink-muted font-medium">
                  No data
                </div>
              ) : (
                filteredEmployees.map((emp, i) => (
                  <div
                    key={emp.employeeId}
                    onMouseEnter={() => setHoveredEmpId(emp.employeeId)}
                    onMouseLeave={() => setHoveredEmpId(null)}
                    className={`h-11 flex items-center text-xs transition-colors font-medium ${
                      hoveredEmpId === emp.employeeId ? 'bg-primary/10' : 'bg-card'
                    }`}
                  >
                    <div className="w-[52px] h-full flex items-center justify-center border-r border-line-soft font-mono text-ink-subtle shrink-0">
                      {i + 1}
                    </div>
                    <div className="w-[90px] h-full flex items-center justify-center border-r border-line-soft font-mono font-bold text-primary shrink-0">
                      {emp.rollNo}
                    </div>
                    <div
                      className="w-[210px] h-full flex items-center px-4 font-bold text-ink whitespace-nowrap overflow-hidden text-ellipsis shrink-0"
                      title={emp.employeeName}
                    >
                      <span className="truncate">{emp.employeeName}</span>
                      {emp.department && emp.department !== '—' && (
                        <span className="text-[10px] font-normal text-ink-subtle ml-1 shrink-0">
                          ({emp.department})
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Left Footer Total */}
            {filteredEmployees.length > 0 && (
              <div className="h-12 bg-card-2 border-t-2 border-line-soft flex items-center px-4 font-extrabold uppercase text-xs text-ink shrink-0">
                Total ({filteredEmployees.length} Employees)
              </div>
            )}
          </div>

          {/* ── RIGHT PANE: Horizontally Scrollable Matrix Columns ── */}
          <div className="flex-1 overflow-x-auto min-w-0 bg-card">
            <table className="min-w-max w-full text-xs border-collapse text-ink">
              <thead>
                {/* Row 1: Group Headers */}
                <tr className="bg-card-2 text-ink font-extrabold uppercase text-[11px] tracking-wider h-[42px] border-b border-line-soft">
                  <th className="px-3 py-2 text-center border-r border-line-soft min-w-[120px] whitespace-nowrap align-middle" rowSpan={2}>
                    Date Of Joining
                  </th>
                  <th className="px-3 py-2 text-center border-r border-line-soft min-w-[110px] whitespace-nowrap align-middle" rowSpan={2}>
                    Total Exp. (Yrs)
                  </th>
                  <th className="px-3 py-2 text-right border-r border-line-soft min-w-[120px] whitespace-nowrap align-middle" rowSpan={2}>
                    Monthly Salary
                  </th>
                  <th className="px-3 py-2 text-center border-r border-line-soft min-w-[110px] whitespace-nowrap align-middle" rowSpan={2}>
                    Salary Type
                  </th>

                  {/* Dynamic Months Group Headers */}
                  {data?.months.map(m => (
                    <th
                      key={m.monthKey}
                      colSpan={2}
                      className="px-3 py-1.5 text-center border-r border-line-soft bg-card-2 text-ink min-w-[130px]"
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-xs text-ink">{m.label}</span>
                        <span className="text-[10px] font-mono text-ink-subtle">({m.daysInMonth} Days)</span>
                      </div>
                    </th>
                  ))}

                  {/* Period Total */}
                  <th
                    colSpan={2}
                    className="px-3 py-1.5 text-center border-r border-line-soft bg-primary/10 text-primary min-w-[140px]"
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-extrabold text-xs">Period Total</span>
                      <span className="text-[10px] font-mono">
                        ({data?.months.reduce((s, m) => s + m.daysInMonth, 0) || 365} Days)
                      </span>
                    </div>
                  </th>

                  <th className="px-3 py-2 text-right border-r border-line-soft min-w-[110px] bg-primary/10 text-primary whitespace-nowrap align-middle" rowSpan={2}>
                    Per Day Bonus
                  </th>
                  <th className="px-4 py-2 text-right border-r border-line-soft min-w-[120px] bg-primary/20 text-primary font-black whitespace-nowrap align-middle" rowSpan={2}>
                    Bonus (₹)
                  </th>
                  <th className="px-3 py-2 text-right border-r border-line-soft min-w-[105px] bg-card-2 text-ink whitespace-nowrap align-middle" rowSpan={2}>
                    Paid Amount
                  </th>
                  <th className="px-3 py-2 text-right min-w-[105px] bg-card-2 text-ink whitespace-nowrap align-middle" rowSpan={2}>
                    Balance
                  </th>
                </tr>

                {/* Row 2: Sub-headers */}
                <tr className="bg-card-2 text-[10px] font-bold text-ink-muted uppercase h-[31px] border-b border-line-soft">
                  {data?.months.map(m => (
                    <React.Fragment key={m.monthKey}>
                      <th className="px-2 py-1 text-center border-r border-line-soft min-w-[65px] text-red-600 bg-red-50/60">
                        Leave
                      </th>
                      <th className="px-2 py-1 text-center border-r border-line-soft min-w-[65px] text-emerald-700 bg-emerald-50/60">
                        Present
                      </th>
                    </React.Fragment>
                  ))}
                  {/* Period Total Sub-headers */}
                  <th className="px-2.5 py-1 text-center border-r border-line-soft min-w-[70px] text-red-600 bg-red-100/70 font-black">
                    Leave
                  </th>
                  <th className="px-2.5 py-1 text-center border-r border-line-soft min-w-[70px] text-emerald-700 bg-emerald-100/70 font-black">
                    Present
                  </th>
                </tr>
              </thead>

              {/* Body */}
              <tbody className="divide-y divide-line-soft bg-card">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8 + (data?.months.length || 0) * 2} className="h-24 text-center text-ink-muted font-medium">
                      No employee attendance or bonus records found for the selected range.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr
                      key={emp.employeeId}
                      onMouseEnter={() => setHoveredEmpId(emp.employeeId)}
                      onMouseLeave={() => setHoveredEmpId(null)}
                      className={`h-11 transition-colors font-medium ${
                        hoveredEmpId === emp.employeeId ? 'bg-primary/10' : 'bg-card'
                      }`}
                    >
                      {/* DOJ */}
                      <td className="px-3 py-2 text-center border-r border-line-soft font-mono text-ink-muted whitespace-nowrap">
                        {emp.formattedDoj}
                      </td>

                      {/* Total Exp. (Years) */}
                      <td className="px-3 py-2 text-center border-r border-line-soft font-mono font-semibold text-ink whitespace-nowrap">
                        {fmtDecimal(emp.experienceYears)}
                      </td>

                      {/* Monthly Salary */}
                      <td className="px-3 py-2 text-right border-r border-line-soft font-mono font-bold text-ink whitespace-nowrap">
                        {fmtRs(emp.monthlySalary)}
                      </td>

                      {/* Salary Type */}
                      <td className="px-3 py-2 text-center border-r border-line-soft text-[11px] font-semibold text-ink-muted whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-card-2 border border-line-soft">
                          {emp.salaryType}
                        </span>
                      </td>

                      {/* Dynamic Monthly Columns */}
                      {emp.monthlyData.map(m => (
                        <React.Fragment key={m.monthKey}>
                          {/* Leave Day */}
                          <td className={`px-2 py-2 text-center border-r border-line-soft font-mono min-w-[65px] ${
                            m.leaveDays > 0 ? 'text-red-600 font-bold bg-red-50/20' : 'text-ink-subtle'
                          }`}>
                            {m.leaveDays > 0 ? m.leaveDays : '0'}
                          </td>

                          {/* Present Day */}
                          <td className={`px-2 py-2 text-center border-r border-line-soft font-mono min-w-[65px] ${
                            m.presentDays > 0 ? 'text-emerald-700 font-bold bg-emerald-50/20' : 'text-ink-subtle'
                          }`}>
                            {m.presentDays > 0 ? m.presentDays : '0'}
                          </td>
                        </React.Fragment>
                      ))}

                      {/* Overall Total Leave Days */}
                      <td className="px-3 py-2 text-center border-r border-line-soft font-mono font-black text-red-600 bg-red-50/30">
                        {emp.totalLeaveDays}
                      </td>

                      {/* Overall Total Present Days */}
                      <td className="px-3 py-2 text-center border-r border-line-soft font-mono font-black text-emerald-700 bg-emerald-50/30">
                        {emp.totalPresentDays}
                      </td>

                      {/* Per Day Bonus (Gross / 365) */}
                      <td className="px-3 py-2 text-right border-r border-line-soft font-mono font-semibold text-ink whitespace-nowrap bg-primary/5">
                        ₹{fmtDecimal(emp.perDayBonus)}
                      </td>

                      {/* Bonus (₹) */}
                      <td className="px-4 py-2 text-right border-r border-line-soft font-mono font-extrabold text-primary text-sm whitespace-nowrap bg-primary/10">
                        {fmtRs(emp.bonus)}
                      </td>

                      {/* Paid Amount */}
                      <td className="px-3 py-2 text-right border-r border-line-soft font-mono text-ink-muted whitespace-nowrap">
                        {emp.paidAmount > 0 ? fmtRs(emp.paidAmount) : '—'}
                      </td>

                      {/* Balance */}
                      <td className="px-3 py-2 text-right font-mono font-bold text-ink whitespace-nowrap">
                        {fmtRs(emp.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Table Footer Summary Row */}
              {filteredEmployees.length > 0 && (
                <tfoot className="bg-card-2 border-t-2 border-line-soft font-bold text-xs h-12">
                  <tr className="text-ink">
                    <td className="px-3 py-2 text-center border-r border-line-soft font-mono">
                      —
                    </td>
                    <td className="px-3 py-2 text-center border-r border-line-soft font-mono">
                      —
                    </td>
                    <td className="px-3 py-2 text-right border-r border-line-soft font-mono font-black text-ink whitespace-nowrap">
                      {fmtRs(filteredSummary.totalGrossSalary)}
                    </td>
                    <td className="px-3 py-2 text-center border-r border-line-soft">
                      —
                    </td>

                    {/* Monthly totals */}
                    {data?.months.map(m => {
                      const mLeave = filteredEmployees.reduce((s, e) => {
                        const d = e.monthlyData.find(x => x.monthKey === m.monthKey);
                        return s + (d?.leaveDays || 0);
                      }, 0);
                      const mPres = filteredEmployees.reduce((s, e) => {
                        const d = e.monthlyData.find(x => x.monthKey === m.monthKey);
                        return s + (d?.presentDays || 0);
                      }, 0);
                      return (
                        <React.Fragment key={m.monthKey}>
                          <td className="px-2 py-2 text-center border-r border-line-soft font-mono text-red-600 font-bold bg-red-50/40">
                            {Number(mLeave.toFixed(1))}
                          </td>
                          <td className="px-2 py-2 text-center border-r border-line-soft font-mono text-emerald-700 font-bold bg-emerald-50/40">
                            {Number(mPres.toFixed(1))}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* Period Leave Total */}
                    <td className="px-3 py-2 text-center border-r border-line-soft font-mono font-black text-red-600 bg-red-100/50">
                      {filteredSummary.totalLeaveDays}
                    </td>

                    {/* Period Present Total */}
                    <td className="px-3 py-2 text-center border-r border-line-soft font-mono font-black text-emerald-700 bg-emerald-100/50">
                      {filteredSummary.totalPresentDays}
                    </td>

                    {/* Per day bonus indicator */}
                    <td className="px-3 py-2 text-right border-r border-line-soft font-mono text-ink-subtle bg-primary/5">
                      —
                    </td>

                    {/* Overall Bonus Total */}
                    <td className="px-4 py-2 text-right border-r border-line-soft font-mono font-black text-primary text-sm whitespace-nowrap bg-primary/20">
                      {fmtRs(filteredSummary.totalBonus)}
                    </td>

                    {/* Paid Total */}
                    <td className="px-3 py-2 text-right border-r border-line-soft font-mono text-ink-muted whitespace-nowrap">
                      {fmtRs(filteredSummary.totalPaidAmount)}
                    </td>

                    {/* Balance Total */}
                    <td className="px-3 py-2 text-right font-mono font-black text-ink whitespace-nowrap">
                      {fmtRs(filteredSummary.totalBalance)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BonusCalculationPage;
