import React, { useEffect, useState, useCallback } from 'react';
import { Wallet, Plus, Trash2, X, Loader2, AlertTriangle } from 'lucide-react';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import { toast } from 'react-toastify';
import { payrollService } from '../../../services/payrollService';
import type { ApiSalaryAdvance, ApiEmployeePayroll } from '../../../services/payrollService';
import { usePermission } from '../../../hooks/usePermission';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtRs = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PARTIAL: 'bg-blue-100  text-blue-700',
  CLEARED: 'bg-green-100 text-green-700',
};

// ─── Add-Advance slide-in panel ────────────────────────────────────────────────
interface AddPanelProps {
  employees: ApiEmployeePayroll[];
  onClose: () => void;
  onSaved: () => void;
}

const AddPanel: React.FC<AddPanelProps> = ({ employees, onClose, onSaved }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount]         = useState('');
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason]         = useState('');
  const [saving, setSaving]         = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !amount || !date) {
      toast.error('Employee, amount and date are required.');
      return;
    }
    try {
      setSaving(true);
      await payrollService.createAdvance({
        employeeId: Number(employeeId),
        amount: Number(amount),
        disbursedDate: date,
        reason: reason.trim() || undefined,
      });
      toast.success('Salary advance recorded.');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save advance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* backdrop */}
      <div className="flex-1 " onClick={onClose} />
      {/* panel */}
      <div className="w-full max-w-md  shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-primary" />
            <h2 className="text-base font-bold text-slate-800">Add Salary Advance</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Employee */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Employee <span className="text-red-500">*</span></label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            >
              <option value="">Select employee…</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.empCode} – {emp.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Disbursed Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reason <span className="text-slate-400">(optional)</span></label>
            <input
              type="text"
              maxLength={200}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Medical emergency"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {saving ? 'Saving…' : 'Save Advance'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const SalaryAdvancePage: React.FC = () => {
  const { can } = usePermission();
  const canCreateAdvance = can("payroll-advance.create");
  const canDeleteAdvance = can("payroll-advance.delete");

  const [advances,  setAdvances]  = useState<ApiSalaryAdvance[]>([]);
  const [employees, setEmployees] = useState<ApiEmployeePayroll[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [adv, emps] = await Promise.all([
        payrollService.listAdvances(),
        payrollService.listEmployees(),
      ]);
      setAdvances(adv);
      setEmployees(emps);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (deleteId == null) return;
    try {
      setDeleting(true);
      await payrollService.deleteAdvance(deleteId);
      toast.success('Advance deleted.');
      setDeleteId(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to delete advance.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Wallet size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">Salary Advance</h1>
            <p className="text-xs text-slate-500">Record and track advances given to employees</p>
          </div>
        </div>
        {canCreateAdvance && (
          <button
            onClick={() => setShowPanel(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Advance
          </button>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">All Advances</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
              {advances.length}
            </span>
          </div>
        </div>

        {loading ? (
          <CommonLoader text="Loading advances…" fullScreen={false} />
        ) : advances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Wallet size={36} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">No salary advances recorded yet.</p>
            {canCreateAdvance && (
              <button
                onClick={() => setShowPanel(true)}
                className="mt-3 text-xs text-primary font-bold hover:underline"
              >
                Add the first advance →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Reason</th>
                  <th className="px-5 py-3 text-right">Recovered</th>
                  <th className="px-5 py-3 text-right">Pending</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {advances.map(adv => {
                  const pending = Number(adv.amount) - Number(adv.recoveredAmount);
                  const canDelete = canDeleteAdvance && adv.status === 'PENDING' && Number(adv.recoveredAmount) === 0;
                  return (
                    <tr key={adv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-800">{adv.employee.fullName}</div>
                        <div className="text-xs text-slate-400">{adv.employee.empCode}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                        {fmtRs(Number(adv.amount))}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        {fmtDate(adv.disbursedDate)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 max-w-[180px] truncate">
                        {adv.reason ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-600">
                        {fmtRs(Number(adv.recoveredAmount))}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                        {fmtRs(pending)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[adv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {adv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {canDelete ? (
                          <button
                            onClick={() => setDeleteId(adv.id)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete advance"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add panel ── */}
      {showPanel && (
        <AddPanel
          employees={employees}
          onClose={() => setShowPanel(false)}
          onSaved={() => { setShowPanel(false); load(); }}
        />
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Delete Advance?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              This action cannot be undone. The advance will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryAdvancePage;
