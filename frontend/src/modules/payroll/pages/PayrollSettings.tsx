
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Plus, Trash2, Edit3, Check, X, AlertTriangle, Save, Info, Loader2 } from 'lucide-react';
import { usePermission } from '../../../hooks/usePermission';
import CommonLoader from '../../../components/ui/Loader/CommonLoader';
import Button from '../../../components/ui/Button/Button';
import TextInput from '../../../components/form/TextInput/TextInput';
import SelectInput from '../../../components/form/SelectInput/SelectInput';
import CheckboxInput from '../../../components/form/CheckboxInput/CheckboxInput';
import RadioInput from '../../../components/form/RadioInput/RadioInput';
import Tabs from '../../../components/ui/tab/Tabs';
import { payrollService } from '../../../services/payrollService';
import type { ApiPayrollConfig } from '../../../services/payrollService';
import { formatAmountOnBlur } from '../../../utils/pricingUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface SlabEntry {
  id: string;
  label: string;
  fromMinutes: number;
  toMinutes: number;
  amount: number;
  action?: 'DEDUCT_AMOUNT' | 'HALF_DAY' | 'HALF_DAY_PLUS_OT';
  otHours?: number;
}

interface SalaryComponent {
  id: string;
  code: string;
  name: string;
  category: 'EARNING' | 'DEDUCTION';
  calcType: 'FIXED' | 'PERCENTAGE' | 'FORMULA';
  defaultValue: number;
  isTaxable: boolean;
  isPfApplicable: boolean;
  isEsiApplicable: boolean;
  includeInGross: boolean;
  includeInNet: boolean;
  isActive: boolean;
}

// ─── Sub: Toggle ──────────────────────────────────────────────────────────────
const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}> = ({ checked, onChange, label }) => (
  <div
    className="inline-flex items-center gap-3 cursor-pointer select-none"
    onClick={() => onChange(!checked)}
  >
    <div className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-card-2 border border-line-soft'}`}>
      <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-xs transition-transform duration-200 ${checked ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
    </div>
    {label && <span className="text-sm font-bold text-ink leading-none">{label}</span>}
  </div>
);

// ─── Sub: SlabConfigurator ────────────────────────────────────────────────────
const SlabConfigurator: React.FC<{
  slabs: SlabEntry[];
  onChange: (s: SlabEntry[]) => void;
  title: string;
  warningNote?: string;
  canEdit?: boolean;
}> = ({ slabs, onChange, title, warningNote, canEdit = false }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding,  setAdding]  = useState(false);
  const [draft,   setDraft]   = useState<Partial<SlabEntry>>({});

  const startEdit = (s: SlabEntry) => { setEditing(s.id); setDraft({ ...s }); setAdding(false); };
  const cancelEdit = () => { setEditing(null); setDraft({}); };
  const saveEdit = () => {
    if (editing) {
      onChange(slabs.map(s => s.id === editing ? { ...s, ...draft } as SlabEntry : s));
      setEditing(null); setDraft({});
    }
  };
  const startAdd = () => {
    setAdding(true); setEditing(null);
    setDraft({ label: '', fromMinutes: 0, toMinutes: 0, amount: 0, action: 'DEDUCT_AMOUNT', otHours: 0 });
  };
  const saveAdd = () => {
    onChange([...slabs, {
      id: uid(), label: draft.label || '',
      fromMinutes: Number(draft.fromMinutes) || 0,
      toMinutes:   Number(draft.toMinutes)   || 0,
      amount:      Number(draft.amount)      || 0,
      action:      'DEDUCT_AMOUNT',
      otHours:     0,
    }]);
    setAdding(false); setDraft({});
  };
  const cancelAdd = () => { setAdding(false); setDraft({}); };
  const remove = (id: string) => {
    if (window.confirm('Remove this slab?')) onChange(slabs.filter(s => s.id !== id));
  };

  // Shared form fields — 3 reusable TextInput components
  const renderSlabForm = (onSave: () => void, onCancel: () => void) => {
    return (
      <div className="border border-primary/30 rounded-xl p-4 bg-primary/10 space-y-3">
        <TextInput
          label="Label"
          name="slab-label"
          placeholder="e.g. 1–10 min"
          value={String(draft.label ?? '')}
          onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
          bottom
        />
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="From (min)"
            name="slab-from"
            type="number"
            value={draft.fromMinutes !== undefined && draft.fromMinutes !== null ? String(draft.fromMinutes) : ''}
            onChange={e => setDraft(d => ({ ...d, fromMinutes: e.target.value ? Number(e.target.value) : '' as any }))}
            bottom
          />
          <TextInput
            label="To (min) — 0 = & above"
            name="slab-to"
            type="number"
            value={draft.toMinutes !== undefined && draft.toMinutes !== null ? String(draft.toMinutes) : ''}
            onChange={e => setDraft(d => ({ ...d, toMinutes: e.target.value ? Number(e.target.value) : '' as any }))}
            bottom
          />
        </div>
        <TextInput
          label="Amount (₹)"
          name="slab-amount"
          type="number"
          value={draft.amount !== undefined && draft.amount !== null ? String(draft.amount) : ''}
          onChange={e => setDraft(d => ({ ...d, amount: e.target.value ? Number(e.target.value) : '' as any }))}
          onBlur={formatAmountOnBlur((v) => setDraft(d => ({ ...d, amount: Number(v) })))}
          bottom
        />
        <div className="flex gap-2 pt-1">
          <button
            onClick={onSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Check size={13} /> Save Slab
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-ink-subtle bg-card-2 border border-line-soft rounded-xl hover:bg-card transition-colors"
          >
            <X size={13} /> Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-ink">{title}</h4>
        {canEdit && !adding && !editing && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary border border-primary/30 rounded-xl hover:bg-primary/10 transition-colors"
          >
            <Plus size={13} /> Add Slab
          </button>
        )}
      </div>

      {/* Warning note when no slabs */}
      {warningNote && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-400 font-medium">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{warningNote}</span>
        </div>
      )}

      {/* Existing slab cards */}
      {slabs.map(s => (
        <div key={s.id}>
          {editing === s.id ? (
            renderSlabForm(saveEdit, cancelEdit)
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 border border-line-soft rounded-2xl bg-card-2 hover:border-primary/50 transition-colors group">
              {/* Slab label */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink truncate">{s.label || '—'}</p>
              </div>
              {/* Range badge */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2.5 py-1 text-xs font-bold bg-card border border-line-soft text-ink-subtle rounded-lg">
                  {s.fromMinutes}{s.toMinutes === 0 ? '+ min' : ` – ${s.toMinutes} min`}
                </span>
                <span className="text-ink-subtle text-xs">→</span>
                <span className="px-2.5 py-1 text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg font-mono">
                    ₹{s.amount}
                </span>
              </div>
              {/* Actions */}
              {canEdit && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(s)}
                    className="p-1.5 text-blue-400 hover:bg-card rounded-lg transition-colors"
                    title="Edit slab"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="p-1.5 text-red-400 hover:bg-card rounded-lg transition-colors"
                    title="Delete slab"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Empty state */}
      {slabs.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-6 border border-dashed border-line-soft rounded-2xl text-ink-subtle font-semibold">
          <p className="text-xs">No slabs configured.</p>
          {canEdit && (
            <button
              onClick={startAdd}
              className="mt-2 text-xs text-primary font-bold hover:underline"
            >
              + Add your first slab
            </button>
          )}
        </div>
      )}

      {/* Add form */}
      {adding && renderSlabForm(saveAdd, cancelAdd)}
    </div>
  );
};

// ─── Sub: SalaryComponentsEditor ─────────────────────────────────────────────
const SalaryComponentsEditor: React.FC<{
  comps: SalaryComponent[];
  onChange: (comps: SalaryComponent[]) => void;
  canEdit?: boolean;
}> = ({ comps, onChange, canEdit = false }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft,     setDraft]     = useState<Partial<SalaryComponent>>({});

  const startEdit = (c: SalaryComponent) => {
    setEditingId(c.id);
    setDraft({ ...c });
  };

  const cancelEdit = useCallback(() => {
    // If adding a new row that was never saved (empty code), remove it
    const current = comps.find(c => c.id === editingId);
    if (current && current.code === '' && current.name === 'New Component') {
      onChange(comps.filter(c => c.id !== editingId));
    }
    setEditingId(null);
    setDraft({});
  }, [editingId, comps, onChange]);

  const saveEdit = () => {
    if (!editingId) return;
    onChange(comps.map(c => c.id === editingId ? { ...c, ...draft } as SalaryComponent : c));
    setEditingId(null);
    setDraft({});
  };

  const addNew = () => {
    if (editingId) return;
    const newId = uid();
    const newComp: SalaryComponent = {
      id: newId, code: '', name: 'New Component',
      category: 'EARNING', calcType: 'FIXED', defaultValue: 0,
      isTaxable: false, isPfApplicable: false, isEsiApplicable: false,
      includeInGross: true, includeInNet: true, isActive: true,
    };
    onChange([...comps, newComp]);
    setEditingId(newId);
    setDraft({ ...newComp });
  };

  const deleteComp = (id: string) => {
    if (window.confirm('Delete this salary component? This cannot be undone.')) {
      onChange(comps.filter(c => c.id !== id));
      if (editingId === id) { setEditingId(null); setDraft({}); }
    }
  };

  const th  = 'px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-300 whitespace-nowrap';
  const thC = 'px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-300 whitespace-nowrap';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          Define earning and deduction components used in salary computation.
        </p>
        {canEdit && (
          <button
            onClick={addNew}
            disabled={!!editingId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary border border-primary rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} /> Add Component
          </button>
        )}
      </div>

      <div className="border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 1100 }}>
            <thead>
              <tr className="bg-slate-800">
                <th className={th} style={{ width: 90 }}>Code</th>
                <th className={th}>Component Name</th>
                <th className={th} style={{ width: 110 }}>Category</th>
                <th className={th} style={{ width: 130 }}>Calc Type</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-300 whitespace-nowrap" style={{ width: 130 }}>
                  Default Value
                </th>
                <th className={thC} style={{ width: 70 }}>Taxable</th>
                <th className={thC} style={{ width: 50 }}>PF</th>
                <th className={thC} style={{ width: 50 }}>ESI</th>
                <th className={thC} style={{ width: 75 }}>In Gross</th>
                <th className={thC} style={{ width: 65 }}>In Net</th>
                <th className={thC} style={{ width: 60 }}>Active</th>
                <th className={thC} style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {comps.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center">
                    <p className="text-sm font-medium text-text-muted">No salary components configured</p>
                    <p className="text-xs text-text-muted mt-1">Click "+ Add Component" to define earning and deduction components.</p>
                  </td>
                </tr>
              )}

              {comps.map((c, idx) => {
                const isEditing = editingId === c.id;
                const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';

                if (isEditing) {
                  return (
                    <tr key={c.id} className="bg-blue-50/50 border-l-[3px] border-l-primary">
                      {/* Code */}
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={draft.code ?? ''}
                          onChange={e => setDraft(d => ({ ...d, code: e.target.value.toUpperCase() }))}
                          placeholder="BASIC"
                          maxLength={10}
                          className="w-full border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-white"
                        />
                      </td>
                      {/* Name */}
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={draft.name ?? ''}
                          onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                          placeholder="Component Name"
                          className="w-full border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-white"
                        />
                      </td>
                      {/* Category */}
                      <td className="px-3 py-2.5">
                        <select
                          value={draft.category ?? 'EARNING'}
                          onChange={e => setDraft(d => ({ ...d, category: e.target.value as 'EARNING' | 'DEDUCTION' }))}
                          className="w-full border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary bg-white"
                        >
                          <option value="EARNING">Earning</option>
                          <option value="DEDUCTION">Deduction</option>
                        </select>
                      </td>
                      {/* Calc Type */}
                      <td className="px-3 py-2.5">
                        <select
                          value={draft.calcType ?? 'FIXED'}
                          onChange={e => setDraft(d => ({ ...d, calcType: e.target.value as 'FIXED' | 'PERCENTAGE' | 'FORMULA' }))}
                          className="w-full border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-primary bg-white"
                        >
                          <option value="FIXED">Fixed Amount</option>
                          <option value="PERCENTAGE">Percentage</option>
                          <option value="FORMULA">Formula</option>
                        </select>
                      </td>
                      {/* Default Value */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-xs text-text-muted shrink-0">
                            {draft.calcType === 'PERCENTAGE' ? '%' : draft.calcType === 'FORMULA' ? 'expr' : '₹'}
                          </span>
                          <input
                            type={draft.calcType === 'FORMULA' ? 'text' : 'number'}
                            min={0}
                            step={draft.calcType === 'PERCENTAGE' ? 0.01 : 1}
                            value={draft.defaultValue ?? 0}
                            onChange={e => setDraft(d => ({
                              ...d,
                              defaultValue: draft.calcType === 'FORMULA' ? (e.target.value as any) : Number(e.target.value),
                            }))}
                            className="w-24 border border-border rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-white"
                          />
                        </div>
                      </td>
                      {/* Boolean fields */}
                      {(['isTaxable','isPfApplicable','isEsiApplicable','includeInGross','includeInNet','isActive'] as const).map(field => (
                        <td key={field} className="px-3 py-2.5 text-center">
                          <div className="flex justify-center">
                            <input
                              type="checkbox"
                              checked={!!draft[field]}
                              onChange={e => setDraft(d => ({ ...d, [field]: e.target.checked }))}
                              className="w-4 h-4 rounded text-primary focus:ring-primary/30 border-border cursor-pointer"
                            />
                          </div>
                        </td>
                      ))}
                      {/* Save / Cancel */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={saveEdit} title="Save changes"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white text-xs font-semibold rounded hover:bg-emerald-600 transition-colors">
                            <Check size={11} /> Save
                          </button>
                          <button onClick={cancelEdit} title="Cancel"
                            className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors">
                            <X size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // ── View row ──
                const catCls = c.category === 'EARNING'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-red-100 text-red-700 border-red-200';
                const calcLabel = c.calcType === 'FIXED' ? 'Fixed ₹'
                  : c.calcType === 'PERCENTAGE' ? 'Percentage %' : 'Formula';
                const valueDisplay = c.calcType === 'PERCENTAGE'
                  ? `${c.defaultValue}%`
                  : `₹${Number(c.defaultValue).toLocaleString('en-IN')}`;

                return (
                  <tr
                    key={c.id}
                    className={`${rowBg} hover:bg-blue-50/20 transition-colors ${!c.isActive ? 'opacity-50' : ''}`}
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs font-bold text-text-primary bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {c.code || <span className="text-text-muted font-normal">—</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-semibold text-text-primary">{c.name}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold border ${catCls}`}>
                        {c.category === 'EARNING' ? 'Earning' : 'Deduction'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-text-secondary">{calcLabel}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-text-primary">
                      {valueDisplay}
                    </td>
                    {(['isTaxable','isPfApplicable','isEsiApplicable','includeInGross','includeInNet','isActive'] as const).map(field => (
                      <td key={field} className="px-3 py-2.5 text-center">
                        {c[field]
                          ? <Check size={14} className="mx-auto text-emerald-500" />
                          : <span className="text-slate-300 text-xs mx-auto block text-center">—</span>
                        }
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => startEdit(c)}
                              disabled={!!editingId}
                              title="Edit component"
                              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => deleteComp(c.id)}
                              disabled={!!editingId}
                              title="Delete component"
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {comps.length > 0 && (
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <Info size={12} />
          {comps.filter(c => c.isActive).length} active · {comps.filter(c => c.category === 'EARNING').length} earnings · {comps.filter(c => c.category === 'DEDUCTION').length} deductions
        </p>
      )}
    </div>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-card rounded-2xl border border-line-soft p-6 shadow-xs space-y-4 text-ink">
    <h3 className="text-sm font-extrabold text-ink border-b border-line-soft pb-3">{title}</h3>
    {children}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const PayrollSettings: React.FC = () => {
  const { can } = usePermission();
  const canEditSettings = can("payroll-settings.edit");

  const [config,   setConfig]  = useState<Partial<ApiPayrollConfig>>({});
  const [slabs,    setSlabs]   = useState<{ ot: SlabEntry[]; lateEntry: SlabEntry[]; perm: SlabEntry[] }>({ ot: [], lateEntry: [], perm: [] });
  const [comps,    setComps]   = useState<SalaryComponent[]>([]);
  const [loading,  setLoading] = useState(true);
  const [saving,   setSaving]  = useState(false);
  const [isDirty,  setIsDirty] = useState(false);
  const [error,    setError]   = useState('');

  // Load config from API on mount
  useEffect(() => {
    payrollService.getConfig()
      .then(cfg => {
        setConfig(cfg);
        setSlabs({ ot: (cfg.otSlabs as SlabEntry[]) ?? [], lateEntry: (cfg.lateEntrySlabs as SlabEntry[]) ?? [], perm: (cfg.permissionSlabs as SlabEntry[]) ?? [] });
        setComps((cfg.components as SalaryComponent[]) ?? []);
        setIsDirty(false);
      })
      .catch(e => setError(e?.response?.data?.message ?? 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const set = (patch: Partial<ApiPayrollConfig>) => {
    setConfig(c => ({ ...c, ...patch }));
    setIsDirty(true);
  };

  const handleSlabChange = (type: 'ot' | 'lateEntry' | 'perm', s: SlabEntry[]) => {
    setSlabs(prev => ({ ...prev, [type]: s }));
    setIsDirty(true);
  };

  const handleCompChange = (updated: SalaryComponent[]) => {
    setComps(updated);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await payrollService.updateConfig({
        ...config,
        otSlabs:         slabs.ot,
        lateEntrySlabs:  slabs.lateEntry,
        permissionSlabs: slabs.perm,
        components:      comps,
      } as Partial<ApiPayrollConfig>);
      setConfig(updated);
      setSlabs({ ot: (updated.otSlabs as SlabEntry[]) ?? [], lateEntry: (updated.lateEntrySlabs as SlabEntry[]) ?? [], perm: (updated.permissionSlabs as SlabEntry[]) ?? [] });
      setComps((updated.components as SalaryComponent[]) ?? []);
      setIsDirty(false);
      toast.success('Payroll settings saved successfully');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CommonLoader text="Loading payroll settings…" />;

  if (error) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle size={40} className="text-red-400 mx-auto" />
          <p className="text-sm text-ink-subtle">{error}</p>
          <Button text="Retry" onClick={() => window.location.reload()} variant="primary" size="sm" />
        </div>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'general',
      label: 'General',
      content: (
        <div className="bg-card rounded-2xl border border-line-soft p-6 shadow-xs space-y-6 text-ink">
          {/* Company Policy */}
          <div>
            <h3 className="text-sm font-extrabold text-ink mb-3">Company Policy</h3>
            <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 rounded-xl p-3.5 text-xs text-primary font-medium">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>Daily rate = Monthly salary ÷ Calendar days in month (e.g. ÷ 31 for August)</span>
            </div>
          </div>

          <hr className="border-line-soft" />

          {/* Overtime */}
          <div>
            <h3 className="text-sm font-extrabold text-ink mb-3">Overtime</h3>
            <Toggle checked={config.otEnabled ?? true} onChange={v => set({ otEnabled: v })} label="Enable Overtime" />
            {config.otEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <TextInput
                  label="OT Rate per Hour (₹)"
                  name="otRatePerHour" type="number"
                  value={String(config.otRatePerHour ?? 0)}
                  onChange={e => set({ otRatePerHour: Number(e.target.value) })}
                  onBlur={formatAmountOnBlur((v) => set({ otRatePerHour: Number(v) }))}
                />
                <TextInput
                  label="Tea OT Rate (₹)"
                  name="teaOtRate" type="number"
                  value={String(config.teaOtRate ?? 0)}
                  onChange={e => set({ teaOtRate: Number(e.target.value) })}
                />
              </div>
            )}
            {config.otEnabled && (
              <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 text-xs text-blue-400 font-medium mt-3">
                <Info size={14} className="mt-0.5 shrink-0 text-blue-400" />
                <div>
                  <p className="font-bold mb-1">OT Pay Calculation</p>
                  <p>OT Pay = (OT Hours × OT Rate/Hr) + (OT Days × Employee Daily Rate) + (Tea OT × Tea OT Rate)</p>
                  <p className="mt-0.5 text-blue-400/80">OT Days uses the employee's daily salary rate, not the hourly rate.</p>
                </div>
              </div>
            )}
          </div>

          <hr className="border-line-soft" />

          {/* PF */}
          <div>
            <h3 className="text-sm font-extrabold text-ink mb-3">Provident Fund (PF)</h3>
            <Toggle checked={config.pfEnabled ?? true} onChange={v => set({ pfEnabled: v })} label="Enable PF" />
            {config.pfEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <SelectInput label="PF Wage Formula" name="pfWageFormula"
                  value={config.pfWageFormula ?? 'BASIC'}
                  options={[{ value: 'BASIC', label: 'Basic Salary' }, { value: 'GROSS', label: 'Gross Salary' }]}
                  onChange={e => set({ pfWageFormula: e.target.value })}
                />
                <TextInput label="Max PF Wage (₹)" name="maxPfWage" type="number"
                  value={String(config.maxPfWage ?? 15000)}
                  onChange={e => set({ maxPfWage: Number(e.target.value) })}
                  onBlur={formatAmountOnBlur((v) => set({ maxPfWage: Number(v) }))}
                />
                <TextInput label="Employee PF %" name="employeePfPercent" type="number"
                  value={String(config.employeePfPercent ?? 12)}
                  onChange={e => set({ employeePfPercent: Number(e.target.value) })}
                />
                <TextInput label="Employer PF %" name="employerPfPercent" type="number"
                  value={String(config.employerPfPercent ?? 12)}
                  onChange={e => set({ employerPfPercent: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          <hr className="border-line-soft" />

          {/* ESI */}
          <div>
            <h3 className="text-sm font-extrabold text-ink mb-3">Employee State Insurance (ESI)</h3>
            <Toggle checked={config.esiEnabled ?? true} onChange={v => set({ esiEnabled: v })} label="Enable ESI" />
            {config.esiEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <TextInput label="Max ESI Salary (₹)" name="maxEsiSalary" type="number"
                  value={String(config.maxEsiSalary ?? 21000)}
                  onChange={e => set({ maxEsiSalary: Number(e.target.value) })}
                  onBlur={formatAmountOnBlur((v) => set({ maxEsiSalary: Number(v) }))}
                />
                <TextInput label="Employee ESI %" name="employeeEsiPercent" type="number"
                  value={String(config.employeeEsiPercent ?? 0.75)}
                  onChange={e => set({ employeeEsiPercent: Number(e.target.value) })}
                />
                <TextInput label="Employer ESI %" name="employerEsiPercent" type="number"
                  value={String(config.employerEsiPercent ?? 3.25)}
                  onChange={e => set({ employerEsiPercent: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          <hr className="border-line-soft" />

          {/* Professional Tax */}
          <div>
            <h3 className="text-sm font-extrabold text-ink mb-3">Professional Tax</h3>
            <Toggle checked={config.professionalTaxEnabled ?? false} onChange={v => set({ professionalTaxEnabled: v })} label="Enable Professional Tax" />
            {config.professionalTaxEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <TextInput label="Professional Tax Amount (₹/month)" name="professionalTaxAmount" type="number"
                  value={String(config.professionalTaxAmount ?? 200)}
                  onChange={e => set({ professionalTaxAmount: Number(e.target.value) })}
                  onBlur={formatAmountOnBlur((v) => set({ professionalTaxAmount: Number(v) }))}
                />
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'deductions',
      label: 'Deductions',
      content: (
        <div className="space-y-6">
          {/* Office Staff Policy */}
          <Section title="Office Staff — Permission & Late Entry Policy">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <TextInput
                  label="Free Permission Pool (Minutes)"
                  name="staffPermissionFreeMinutes"
                  type="number"
                  value={String(config.staffPermissionFreeMinutes ?? 240)}
                  onChange={e => set({ staffPermissionFreeMinutes: Number(e.target.value) })}
                />
                <p className="text-[11px] text-ink-subtle mt-1 font-medium">
                  Default: 240 mins ({((config.staffPermissionFreeMinutes ?? 240) / 60).toFixed(1)} hours) per period.
                </p>
              </div>
              <div>
                <TextInput
                  label="Excess Hourly Deduction Rate (₹/hour)"
                  name="staffExcessHourlyRate"
                  type="number"
                  value={String(config.staffExcessHourlyRate ?? 50)}
                  onChange={e => set({ staffExcessHourlyRate: Number(e.target.value) })}
                />
                <p className="text-[11px] text-ink-subtle mt-1 font-medium">
                  Charged per 1-hour block (e.g. 1–60 mins excess = 1 hr = ₹{config.staffExcessHourlyRate ?? 50}).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 text-xs text-blue-400 font-medium">
              <Info size={14} className="mt-0.5 shrink-0 text-blue-400" />
              <div>
                <p className="font-bold mb-1">How Office Staff Policy Works</p>
                <p>Office staff receive a monthly free pool of <strong>{config.staffPermissionFreeMinutes ?? 240} minutes ({((config.staffPermissionFreeMinutes ?? 240) / 60).toFixed(1)} hrs)</strong>.</p>
                <p className="mt-0.5">Late arrival minutes automatically pool with permission minutes.</p>
                <p className="mt-0.5">Any excess beyond the free pool is deducted at <strong>₹{config.staffExcessHourlyRate ?? 50} per hour</strong> in 1-hour chunks.</p>
              </div>
            </div>
          </Section>

          {/* Labour Policy */}
          <Section title="Labour — Grace Time & Slab Deductions">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <TextInput
                  label="Late Entry Grace Period (Minutes)"
                  name="lateEntryGraceMinutes"
                  type="number"
                  value={String(config.lateEntryGraceMinutes ?? 10)}
                  onChange={e => set({ lateEntryGraceMinutes: Number(e.target.value) })}
                />
                <p className="text-[11px] text-ink-subtle mt-1 font-medium">
                  Daily grace time before late deductions start (Default: 10 mins).
                </p>
              </div>
            </div>

            <SlabConfigurator
              title="Late Entry Deduction Slabs"
              slabs={slabs.lateEntry}
              onChange={s => handleSlabChange('lateEntry', s)}
              canEdit={canEditSettings}
              warningNote={
                slabs.lateEntry.length === 0
                  ? 'No slabs configured — per-minute fallback will be used. Add slabs below to apply fixed deduction amounts.'
                  : undefined
              }
            />

            <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 rounded-xl p-3.5 text-xs text-primary font-medium">
              <Info size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold mb-1">How Labour Late Entry Deduction works</p>
                <p>If an employee is late by ≤ <strong>{config.lateEntryGraceMinutes ?? 10} min</strong> (grace period), <strong>no deduction</strong> is applied.</p>
                <p className="mt-1">If late by more than the grace period on any day, the <strong>daily late minutes</strong> are looked up in the slab table above and that fixed amount is deducted.</p>
                <p className="mt-1 text-primary">If no slabs are configured, a per-minute rate (Daily Rate ÷ Working Minutes) is used as fallback.</p>
              </div>
            </div>
          </Section>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <div className="bg-card border-b border-line-soft px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink">Payroll Settings</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Configure payroll policies, statutory deductions, and salary components.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isDirty && (
              <span className="text-xs text-amber-600 font-semibold flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes
              </span>
            )}
            {canEditSettings && (
              <Button
                text={saving ? 'Saving…' : 'Save Changes'}
                icon={saving ? (Loader2 as any) : (Save as any)}
                variant="primary"
                size="md"
                disabled={saving || !isDirty}
                onClick={handleSave}
                className={saving ? "[&>svg]:animate-spin" : ""}
              />
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        <Tabs tabs={tabItems} variant="primary" />
      </div>
    </div>
  );
};

export default PayrollSettings;
