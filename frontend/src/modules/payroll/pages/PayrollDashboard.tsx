import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, IndianRupee, Clock, CheckCircle2,
  CalendarDays, FileText, Settings, BarChart3, ChevronRight,
  PlayCircle, AlertCircle, Building2, Loader2, ClipboardList, Trash2, Wallet,
  Calendar, RotateCcw,
} from 'lucide-react';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import { toast } from 'react-toastify';
import { StatusBadge } from '../../../components/ui/StatusBadge/Badge';
import CustomButton from '../../../components/ui/custombutton/CustomButton';
import Button from '../../../components/ui/Button/Button';
import ViewButton from '../../../components/ui/viewbutton/ViewButton';
import EditButton from '../../../components/ui/EditButton/EditButton';
import DeleteButton from '../../../components/ui/DeleteButton/DeleteButton';
import CommonConfirmModal from '../../../components/ui/CommonConfirmModal/CommonConfirmModal';
import DataTable from '../../../components/ui/table/DataTable';
import { payrollService } from '../../../services/payrollService';
import type { ApiPayrollRun, ApiEmployeePayroll } from '../../../services/payrollService';
import { usePermission } from '../../../hooks/usePermission';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt   = (n: number) => Number(n).toLocaleString('en-IN');
const fmtRs = (n: number) => `₹${fmt(Math.round(Number(n)))}`;

// ─── Component ────────────────────────────────────────────────────────────────
const getCurrentMonth = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

const PayrollDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreateRun      = can("payroll-run.create");
  const canEditRun        = can("payroll-run.edit");
  const canDeleteRun      = can("payroll-run.delete");
  const canViewRun        = can("payroll-run.view");
  const canViewCashInHand = can("payroll-extended-comp.view");

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth);
  const [runs,          setRuns]          = useState<ApiPayrollRun[]>([]);
  const [employees,     setEmployees]     = useState<ApiEmployeePayroll[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [runsLoading,   setRunsLoading]   = useState(false);
  const [error,         setError]         = useState('');
  const [deleteRunId,   setDeleteRunId]   = useState<number | null>(null);
  const [isDeleting,    setIsDeleting]    = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteRunId) return;
    setIsDeleting(true);
    try {
      await payrollService.deleteRun(deleteRunId);
      toast.success('Draft payroll run deleted successfully');
      setRuns(prev => prev.filter(r => r.id !== deleteRunId));
      setDeleteRunId(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to delete payroll run');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setRunsLoading(true);
        const [runsData, empData] = await Promise.all([
          payrollService.listRuns({ period: selectedMonth || undefined, limit: 50 }),
          payrollService.listEmployees(),
        ]);
        setRuns(runsData.runs);
        setEmployees(empData);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? 'Failed to load payroll data');
      } finally {
        setLoading(false);
        setRunsLoading(false);
      }
    };
    load();
  }, [selectedMonth]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalEmployees = employees.length;
  const empWithPayroll = employees.filter(e => e.payrollConfig);
  const lockedRuns     = runs.filter(r => r.status === 'LOCKED');
  const pendingRun     = runs.find(r => r.status === 'DRAFT');
  const lastRunNet     = lockedRuns.reduce((sum, r) => sum + Number(r.totalNetSalary || 0), 0);
  const lockedPeriods  = lockedRuns.map(r => r.period).join(', ');

  const categoryCounts = {
    FIXED_MONTHLY: employees.filter(e => e.payrollConfig?.salaryType === 'FIXED_MONTHLY').length,
    PF_MONTHLY:    employees.filter(e => e.payrollConfig?.salaryType === 'PF_MONTHLY').length,
    CASH_MONTHLY:  employees.filter(e => e.payrollConfig?.salaryType === 'CASH_MONTHLY').length,
    DAILY_WEEKLY:  employees.filter(e => e.payrollConfig?.salaryType === 'DAILY_WEEKLY' || e.payrollConfig?.salaryType === 'WEEKLY' || e.salaryType === 'daily' || e.salaryType === 'weekly').length,
  };

  const latestRun     = runs[0];
  const currentPeriod = latestRun?.period ?? '—';

  const timelineSteps = [
    { label: 'Attendance Capture',  sub: 'Completed',   done: !!latestRun,                                                              active: false                          },
    { label: 'Payroll Run',         sub: latestRun ? 'Computed' : 'Pending',                                                            done: !!latestRun,                     active: !latestRun },
    { label: 'Preview & Review',    sub: latestRun?.status === 'DRAFT' ? 'Pending' : 'Done',                                            done: latestRun?.status !== 'DRAFT',   active: latestRun?.status === 'DRAFT' },
    { label: 'Approval',            sub: latestRun?.status === 'APPROVED' || latestRun?.status === 'LOCKED' ? 'Approved' : 'Pending',   done: latestRun?.status === 'APPROVED' || latestRun?.status === 'LOCKED', active: latestRun?.status === 'DRAFT' },
    { label: 'Lock & Disburse',     sub: latestRun?.status === 'LOCKED' ? 'Locked' : 'Pending',                                         done: latestRun?.status === 'LOCKED',  active: latestRun?.status === 'APPROVED' },
  ];

  // ── Run table columns ──────────────────────────────────────────────────────
  const runColumns = [
    {
      header: 'Period',
      render: (r: ApiPayrollRun) => <span className="font-medium text-text-primary">{r.period}</span>,
    },
    {
      header: 'Type',
      render: (r: ApiPayrollRun) => <StatusBadge status={r.type} />,
    },
    {
      header: 'Employees',
      align: 'right' as const,
      render: (r: ApiPayrollRun) => <span className="text-text-secondary">{r.totalEmployees}</span>,
    },
    {
      header: 'Net Salary',
      align: 'right' as const,
      render: (r: ApiPayrollRun) => {
        const netSal = Number(r.totalNetSalary || 0);
        const addlComp = Number(r.totalAdditionalComp || 0);
        const combNet = Number(r.totalCombinedNet || (netSal + addlComp));

        if (canViewCashInHand && addlComp > 0) {
          return (
            <div className="flex flex-col items-end">
              <span className="font-mono font-bold text-slate-900">
                {fmtRs(combNet)}
              </span>
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                <span>Net: {fmtRs(netSal)}</span>
                <span>+</span>
                <span>Cash: {fmtRs(addlComp)}</span>
              </span>
            </div>
          );
        }

        return (
          <span className="font-mono font-semibold">
            {netSal > 0 ? fmtRs(netSal) : '—'}
          </span>
        );
      },
    },
    {
      header: 'Status',
      render: (r: ApiPayrollRun) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Action',
      align: 'right' as const,
      render: (r: ApiPayrollRun) => (
        <div className="flex items-center justify-end gap-2">
          {canViewRun && (
            <ViewButton
              onClick={() => navigate(r.type === 'WEEKLY' ? '/payroll/weekly-report' : '/payroll/monthly-report')}
            />
          )}

          {canEditRun && (r.status === 'DRAFT' || r.status === 'APPROVED') && (
            <EditButton
              onClick={() => navigate(`/payroll/run?runId=${r.id}`)}
            />
          )}

          {canDeleteRun && r.status === 'DRAFT' && (
            <DeleteButton
              onClick={() => setDeleteRunId(r.id)}
            />
          )}
        </div>
      ),
    },
  ];

  if (loading) return <CommonLoader text="Loading payroll data…" />;

  if (error) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle size={40} className="text-red-400 mx-auto" />
          <p className="text-sm text-text-secondary">{error}</p>
          <CustomButton text="Retry" onClick={() => window.location.reload()} variant="primary" size="sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen  p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight"> </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span>Sunsea Plastics</span>
            <span>•</span>
            <span>Payroll Overview</span>
            {currentPeriod !== '—' && (
              <>
                <span>•</span>
                <span className="font-bold text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded-md">{currentPeriod}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex gap-2.5">
          {canCreateRun && (
            <Button
              text="Generate Weekly"
              icon={CalendarDays as any}
              variant="secondary"
              size="sm"
              onClick={() => navigate('/payroll/run?type=weekly')}
            />
          )}
          {canCreateRun && (
            <Button
              text="Generate Monthly"
              icon={PlayCircle as any}
              variant="primary"
              size="sm"
              onClick={() => navigate('/payroll/run?type=monthly')}
            />
          )}
        </div>
      </div>

      {/* ── Top KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Employees</p>
              <h3 className="text-3xl font-extrabold text-slate-800 mt-2 tracking-tight">{totalEmployees}</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users size={22} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
            <span>{empWithPayroll.length} configured for payroll</span>
          </div>
        </div>

        {/* Last Pay Run */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last Pay Run</p>
              <h3 className="text-3xl font-extrabold text-slate-800 mt-2 tracking-tight">
                {lastRunNet > 0 ? fmtRs(lastRunNet) : '—'}
              </h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee size={22} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>{lockedPeriods ? lockedPeriods : 'No locked run yet'}</span>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Approval</p>
              <h3 className="text-3xl font-extrabold text-amber-600 mt-2 tracking-tight">
                {pendingRun ? 1 : 0}
              </h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle size={22} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            <span>{pendingRun ? `${pendingRun.period} ${pendingRun.type} (Draft)` : 'No pending runs'}</span>
          </div>
        </div>

        {/* Total Runs */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Runs</p>
              <h3 className="text-3xl font-extrabold text-slate-800 mt-2 tracking-tight">{runs.length}</h3>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-violet-500" />
            <span>{runs.filter(r => r.status === 'LOCKED').length} locked · {runs.filter(r => r.status === 'APPROVED').length} approved</span>
          </div>
        </div>
      </div>

      {/* ── Category Breakdown Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Fixed Monthly (Admin)',  count: categoryCounts.FIXED_MONTHLY, color: 'bg-blue-500',    light: 'bg-blue-50/70 border-blue-200/60',    text: 'text-blue-700'    },
          { label: 'PF Workers (Monthly)',   count: categoryCounts.PF_MONTHLY,    color: 'bg-violet-500',  light: 'bg-violet-50/70 border-violet-200/60',text: 'text-violet-700'  },
          { label: 'Cash Workers (Monthly)', count: categoryCounts.CASH_MONTHLY,  color: 'bg-emerald-500', light: 'bg-emerald-50/70 border-emerald-200/60', text: 'text-emerald-700' },
          { label: 'Daily Wage (Weekly)',    count: categoryCounts.DAILY_WEEKLY,  color: 'bg-amber-500',   light: 'bg-amber-50/70 border-amber-200/60',  text: 'text-amber-700'   },
        ].map(cat => (
          <div key={cat.label} className={`rounded-2xl border p-4 shadow-sm hover:shadow transition-all ${cat.light}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
              <span className="text-xs font-bold text-slate-700">{cat.label}</span>
            </div>
            <p className={`text-2xl font-extrabold ${cat.text}`}>
              {cat.count} <span className="text-xs font-semibold opacity-70">employees</span>
            </p>
          </div>
        ))}
      </div>

      {/* ── Module Navigation Tabs ── */}
      <div className="bg-slate-100/80 border border-slate-200/60 p-1.5 rounded-2xl inline-flex flex-wrap items-center gap-1.5 w-full">
        {[
          // { label: 'Overview',         path: '/payroll/dashboard',        icon: BarChart3,     active: true,  show: true },
          { label: 'Attendance',       path: '/payroll/attendance',       icon: ClipboardList, active: false, show: can("payroll-attendance.view") },
          // { label: 'Generate Weekly',  path: '/payroll/run?type=weekly',  icon: CalendarDays,  active: false, show: canCreateRun },
          // { label: 'Generate Monthly', path: '/payroll/run?type=monthly', icon: PlayCircle,    active: false, show: canCreateRun },
          { label: 'Weekly Report',    path: '/payroll/weekly-report',    icon: FileText,      active: false, show: canViewRun },
          { label: 'Monthly Report',   path: '/payroll/monthly-report',   icon: FileText,      active: false, show: canViewRun },
          { label: 'Salary Advance',   path: '/payroll/advance',          icon: Wallet,        active: false, show: can("payroll-advance.view") },
          { label: 'Settings',         path: '/payroll/settings',         icon: Settings,      active: false, show: can("payroll-settings.view") },
        ].filter(t => t.show).map(tab => (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              tab.active
                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <tab.icon size={15} className={tab.active ? 'text-primary' : 'text-slate-400'} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Recent Payroll Runs Table (Full Width 100%) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">Recent Payroll Runs</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
              {runs.length}
            </span>
            {runsLoading && <Loader2 size={16} className="animate-spin text-primary ml-2" />}
          </div>

          {/* Month Filter controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Calendar size={14} className="text-slate-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
              />
            </div>

            {selectedMonth !== getCurrentMonth() && (
              <button
                type="button"
                onClick={() => setSelectedMonth(getCurrentMonth())}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                title="Reset to current month"
              >
                <RotateCcw size={12} />
                <span>Current Month</span>
              </button>
            )}

            {selectedMonth !== '' && (
              <button
                type="button"
                onClick={() => setSelectedMonth('')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Show all payroll runs"
              >
                All Months
              </button>
            )}
          </div>
        </div>

        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400">
            <Clock size={36} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">No payroll runs yet.</p>
            {canCreateRun && (
              <button
                onClick={() => navigate('/payroll/run')}
                className="mt-3 text-xs text-primary font-bold hover:underline"
              >
                Start your first run →
              </button>
            )}
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <DataTable
              columns={runColumns}
              data={runs.slice(0, 10)}
              rowKey={r => r.id}
              density="compact"
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <CommonConfirmModal
        isOpen={deleteRunId !== null}
        onClose={() => setDeleteRunId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Payroll Run"
        message="Are you sure you want to delete this payroll run? This action cannot be undone."
        confirmText="Delete Run"
        confirmVariant="danger"
        isLoading={isDeleting}
      />

    </div>
  );
};

export default PayrollDashboard;
