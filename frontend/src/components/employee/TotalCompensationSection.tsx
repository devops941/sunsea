/**
 * TotalCompensationSection
 * ────────────────────────
 * Super Admin only — stores the confidential cash salary for an employee.
 * Only a single amount field is collected. No breakdown is shown.
 *
 * Security rules:
 *  • Never use labels like "Off Record", "Cash Salary", "Hidden Salary".
 *  • This component is never mounted for non-super-admin users.
 *  • Decrypted values are held only in local component state, never persisted
 *    in localStorage, Redux, or any shared store.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FaShieldAlt, FaSave, FaTrashAlt, FaSpinner, FaLock } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { payrollService, type ApiExtendedComp } from '../../services/payrollService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  employeeId: number | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TotalCompensationSection: React.FC<Props> = ({ employeeId }) => {
  const [amount, setAmount]   = useState('');
  const [existing, setExisting] = useState<ApiExtendedComp | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [clearing, setClearing] = useState(false);

  // ── Load existing config ──────────────────────────────────────────────────

  const loadExisting = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const data = await payrollService.getExtendedConfig(employeeId);
      setExisting(data);
      if (data) setAmount(String(data.offRecordAmount));
    } catch {
      // 403 = not super admin (parent guards render); other errors: silent
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!employeeId) {
      toast.error('Save the employee first, then configure total compensation.');
      return;
    }
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      toast.error('Enter a valid positive amount.');
      return;
    }
    setSaving(true);
    try {
      await payrollService.upsertExtendedConfig(employeeId, { offRecordAmount: parsed });
      toast.success('Total compensation saved.');
      await loadExisting();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!employeeId) return;
    if (!window.confirm('Remove additional compensation for this employee?')) return;
    setClearing(true);
    try {
      await payrollService.clearExtendedConfig(employeeId);
      setExisting(null);
      setAmount('');
      toast.success('Additional compensation removed.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to remove. Try again.');
    } finally {
      setClearing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-indigo-600">
        <FaShieldAlt className="text-white text-sm" />
        <span className="text-sm font-bold text-white tracking-wide uppercase">
          Total Compensation
        </span>
        <FaLock className="text-indigo-200 text-xs ml-auto" />
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-slate-400 text-sm">
            <FaSpinner className="animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <>
            {/* Amount input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.5px] text-slate-500 mb-1">
                Cash in Hand Amount (₹)
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min={0}
                step={0.01}
                placeholder="e.g. 10000"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !employeeId}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold uppercase tracking-wide hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                {saving ? 'Saving...' : 'Save'}
              </button>

              {existing && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={clearing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold uppercase tracking-wide hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {clearing ? <FaSpinner className="animate-spin" /> : <FaTrashAlt />}
                  {clearing ? 'Removing...' : 'Remove'}
                </button>
              )}
            </div>

            {!employeeId && (
              <p className="text-xs text-slate-400 italic">
                Save the employee first, then configure total compensation.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TotalCompensationSection;
