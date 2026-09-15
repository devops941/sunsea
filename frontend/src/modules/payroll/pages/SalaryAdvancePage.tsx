import { formatDate } from "../../../utils/dateUtils";
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import { toast } from 'react-toastify';
import { payrollService } from '../../../services/payrollService';
import type { ApiSalaryAdvance } from '../../../services/payrollService';
import { usePermission } from '../../../hooks/usePermission';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtRs = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtDate = (s: string) => formatDate(s);

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PARTIAL: 'bg-blue-100  text-blue-700',
  CLEARED: 'bg-green-100 text-green-700',
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const SalaryAdvancePage: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreateAdvance = can("payroll-advance.create");
  const canDeleteAdvance = can("payroll-advance.delete");

  const [advances, setAdvances] = useState<ApiSalaryAdvance[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Esc key handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteId != null) {
        setDeleteId(null);
        return;
      }
      navigate(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteId, navigate]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const adv = await payrollService.listAdvances();
      setAdvances(adv);
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
    <div className="min-h-screen bg-page p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Wallet size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-ink">Salary Advance</h1>
            <p className="text-xs text-ink-muted">Record and track advances given to employees</p>
          </div>
        </div>
        {canCreateAdvance && (
          <button
            onClick={() => navigate('/payroll/advance/add')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Advance
          </button>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-sm text-red-500">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* ── Table card ── */}
      <div className="bg-card rounded-2xl border border-line-soft shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-ink">All Advances</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-card-2 text-ink-muted border border-line-soft">
              {advances.length}
            </span>
          </div>
        </div>

        {loading ? (
          <CommonLoader text="Loading advances…" fullScreen={false} />
        ) : advances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-ink-muted">
            <Wallet size={36} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">No salary advances recorded yet.</p>
            {canCreateAdvance && (
              <button
                onClick={() => navigate('/payroll/advance/add')}
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
                <tr className="bg-card-2 border-b border-line-soft text-xs font-bold text-ink-muted uppercase tracking-wide">
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
              <tbody className="divide-y divide-line-soft">
                {advances.map(adv => {
                  const pending = Number(adv.amount) - Number(adv.recoveredAmount);
                  const canDelete = canDeleteAdvance && adv.status === 'PENDING' && Number(adv.recoveredAmount) === 0;
                  return (
                    <tr key={adv.id} className="hover:bg-card-2/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-ink">{adv.employee.fullName}</div>
                        <div className="text-xs text-ink-subtle">{adv.employee.empCode}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-ink font-mono">
                        {fmtRs(Number(adv.amount))}
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted whitespace-nowrap">
                        {fmtDate(adv.disbursedDate)}
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted max-w-[180px] truncate">
                        {adv.reason ?? <span className="text-ink-subtle">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right text-ink-muted font-mono">
                        {fmtRs(Number(adv.recoveredAmount))}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-ink font-mono">
                        {fmtRs(pending)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[adv.status] ?? 'bg-card-2 text-ink-muted'}`}>
                          {adv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {canDelete ? (
                          <button
                            onClick={() => setDeleteId(adv.id)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                            title="Delete advance"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span className="text-ink-subtle text-xs">—</span>
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

      {/* ── Delete confirmation modal ── */}
      {deleteId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-card rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 border border-line-soft">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-ink">Delete Advance?</h3>
            </div>
            <p className="text-sm text-ink-muted mb-5">
              This action cannot be undone. The advance will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-ink-muted hover:bg-card-2 transition-colors"
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
