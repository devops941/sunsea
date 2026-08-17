
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
    <div className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-slate-300'}`}>
      <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
    </div>
    {label && <span className="text-sm font-medium text-text-primary leading-none">{label}</span>}
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
    setDraft({ label: '', fromMinutes: 0, toMinutes: 0, amount: 0 });
  };
  const saveAdd = () => {
    onChange([...slabs, {
      id: uid(), label: draft.label || '',
      fromMinutes: Number(draft.fromMinutes) || 0,
      toMinutes:   Number(draft.toMinutes)   || 0,
      amount:      Number(draft.amount)      || 0,
      action:      (draft.action as SlabEntry['action']) ?? 'DEDUCT_AMOUNT',
      otHours:     Number(draft.otHours)     || 0,
    }]);
    setAdding(false); setDraft({});
  };
  const cancelAdd = () => { setAdding(false); setDraft({}); };
  const remove = (id: string) => {
    if (window.confirm('Remove this slab?')) onChange(slabs.filter(s => s.id !== id));
  };

  // Shared form fields — 3 reusable TextInput components
  // Shared form fields — 3 reusable TextInput components
  const renderSlabForm = (onSave: () => void, onCancel: () => void) => {
    const actionVal = (draft.action ?? 'DEDUCT_AMOUNT') as string;
    return (
      <div className="border border-primary/30 rounded-xl p-4 bg-primary/[0.03] space-y-3">
        <TextInput
          label="Label"
          name="slab-label"
          placeholder="e.g. 1–10 min"
          value={String(draft.label ?? '')}
          onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
          bottom
        />
        <div className="grid grid-cols-3 gap-3">
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
          {/* Action dropdown — only shown when this is used as Permission Slab */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">Action</label>
            <select
              value={actionVal}
              onChange={e => setDraft(d => ({ ...d, action: e.target.value as SlabEntry['action'], amount: 0, otHours: 0 }))}
              className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            >
              <option value="DEDUCT_AMOUNT">₹ Deduct Amount</option>
              <option value="HALF_DAY">Half Day (LOP)</option>
              <option value="HALF_DAY_PLUS_OT">Half Day + OT</option>
            </select>
          </div>
        </div>
        {/* Conditional fields */}
        {actionVal === 'DEDUCT_AMOUNT' && (
          <TextInput
            label="Amount (₹)"
            name="slab-amount"
            type="number"
            value={draft.amount !== undefined && draft.amount !== null ? String(draft.amount) : ''}
            onChange={e => setDraft(d => ({ ...d, amount: e.target.value ? Number(e.target.value) : '' as any }))}
            bottom
          />
        )}
        {actionVal === 'HALF_DAY_PLUS_OT' && (
          <TextInput
            label="Auto-add OT Hours"
            name="slab-ot-hours"
            type="number"
            placeholder="e.g. 3"
            value={draft.otHours !== undefined && draft.otHours !== null ? String(draft.otHours) : ''}
            onChange={e => setDraft(d => ({ ...d, otHours: e.target.value ? Number(e.target.value) : '' as any }))}
            bottom
          />
        )}
        {actionVal === 'HALF_DAY' && (
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            This slab will automatically convert the day to <strong>Half Day (0.5 LOP)</strong> with no ₹ deduction.
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Check size={13} /> Save Slab
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-text-secondary border border-border rounded-lg hover:bg-slate-50 transition-colors"
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
        <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
        {canEdit && !adding && !editing && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
          >
            <Plus size={13} /> Add Slab
          </button>
        )}
      </div>

      {/* Warning note when no slabs */}
      {warningNote && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
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
            <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-xl bg-white hover:border-primary/30 transition-colors group">
              {/* Slab label */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{s.label || '—'}</p>
              </div>
              {/* Range badge */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-text-secondary rounded-md">
                  {s.fromMinutes}{s.toMinutes === 0 ? '+ min' : ` – ${s.toMinutes} min`}
                </span>
                <span className="text-text-muted text-xs">→</span>
                {/* Action badge */}
                {(!s.action || s.action === 'DEDUCT_AMOUNT') && (
                  <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-md font-mono">
                    ₹{s.amount}
                  </span>
                )}
                {s.action === 'HALF_DAY' && (
                  <span className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 rounded-md">
                    ½ Day LOP
                  </span>
                )}
                {s.action === 'HALF_DAY_PLUS_OT' && (
                  <>
                    <span className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 rounded-md">
                      ½ Day LOP
                    </span>
                    <span className="text-text-muted text-xs">+</span>
                    <span className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 rounded-md">
                      {s.otHours ?? 0} hrs OT
                    </span>
                  </>
                )}
              </div>
              {/* Actions */}
              {canEdit && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(s)}
                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit slab"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
        <div className="flex flex-col items-center justify-center py-6 border border-dashed border-border rounded-xl text-text-muted">
          <p className="text-xs">No slabs configured.</p>
          {canEdit && (
            <button
              onClick={startAdd}
              className="mt-2 text-xs text-primary font-semibold hover:underline"
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
  <div className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4">
    <h3 className="text-sm font-bold text-text-primary border-b border-border pb-3">{title}</h3>
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
          <p className="text-sm text-text-secondary">{error}</p>
          <Button text="Retry" onClick={() => window.location.reload()} variant="primary" size="sm" />
        </div>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'policy',
      label: 'Company Policy',
      content: (
        <Section title="Company Policy">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectInput label="Salary Calculation Method" name="salaryCalculationMethod"
              value={config.salaryCalculationMethod ?? 'CALENDAR_DAYS'}
              options={[
                { value: 'CALENDAR_DAYS', label: 'Calendar Days' },
                { value: 'WORKING_DAYS',  label: 'Working Days'  },
                { value: 'FIXED_DAYS',    label: 'Fixed Days'    },
              ]}
              onChange={e => set({ salaryCalculationMethod: e.target.value })}
            />
            <TextInput label="Fixed Days (if fixed)" name="fixedDays" type="number"
              value={String(config.fixedDays ?? 26)}
              onChange={e => set({ fixedDays: Number(e.target.value) })}
            />
            {/* <TextInput label="Working Hours / Day" name="defaultWorkingHoursPerDay" type="number"
              value={String(config.defaultWorkingHoursPerDay ?? 8)}
              onChange={e => set({ defaultWorkingHoursPerDay: Number(e.target.value) })}
            /> */}
          </div>
          {/* <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Weekly Off Days</p>
            <div className="flex flex-wrap gap-3">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                <CheckboxInput key={d} label={d} name={`woff-${i}`}
                  checked={(config.weeklyOffDays ?? [0]).includes(i)}
                  onChange={e => {
                    const curr = (config.weeklyOffDays ?? [0]) as number[];
                    set({ weeklyOffDays: e.target.checked ? [...curr, i] : curr.filter(x => x !== i) });
                  }}
                />
              ))}
            </div>
          </div> */}
        </Section>
      ),
    },
    {
      key: 'daily',
      label: 'Daily Salary',
      content: (
        <Section title="Daily Salary Formula">
          <RadioInput label="Formula" name="dailySalaryFormula"
            value={config.dailySalaryFormula ?? 'MONTHLY_BY_CALENDAR'}
            options={[
              { value: 'MONTHLY_BY_CALENDAR', label: 'Monthly ÷ Calendar Days' },
              { value: 'MONTHLY_BY_WORKING',  label: 'Monthly ÷ Working Days'  },
              { value: 'FIXED_DAILY',         label: 'Fixed Daily Rate'         },
            ]}
            onChange={e => set({ dailySalaryFormula: e.target.value })}
          />
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 mt-2">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              {config.dailySalaryFormula === 'MONTHLY_BY_CALENDAR'
                ? 'Daily rate = Monthly salary ÷ Calendar days in month (e.g. ÷ 31 for August)'
                : config.dailySalaryFormula === 'MONTHLY_BY_WORKING'
                ? `Daily rate = Monthly salary ÷ ${config.fixedDays ?? 26} (working days setting)`
                : 'Each employee has a fixed daily rate configured individually'}
            </span>
          </div>
        </Section>
      ),
    },
    {
      key: 'overtime',
      label: 'Overtime',
      content: (
        <Section title="Overtime Settings">
          <Toggle checked={config.otEnabled ?? true} onChange={v => set({ otEnabled: v })} label="Enable Overtime" />
          {config.otEnabled && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectInput label="OT Method" name="otMethod"
                  value={config.otMethod ?? 'SLAB'}
                  options={[
                    { value: 'HOURLY_RATE',      label: 'Hourly Rate'      },
                    { value: 'FIXED_AMOUNT',     label: 'Fixed Amount'     },
                    { value: 'PERCENTAGE_DAILY', label: '% of Daily Rate'  },
                    { value: 'SLAB',             label: 'Slab-based'       },
                  ]}
                  onChange={e => set({ otMethod: e.target.value })}
                />
                {(config.otMethod === 'HOURLY_RATE' || config.otMethod === 'FIXED_AMOUNT') && (
                  <TextInput
                    label={config.otMethod === 'FIXED_AMOUNT' ? 'Fixed Amount per OT (₹)' : 'Rate per Hour (₹)'}
                    name="otRatePerHour" type="number"
                    value={String(config.otRatePerHour ?? 0)}
                    onChange={e => set({ otRatePerHour: Number(e.target.value) })}
                  />
                )}
                <TextInput label="Weekday OT Multiplier" name="weekdayOtMultiplier" type="number"
                  value={String(config.weekdayOtMultiplier ?? 1.5)}
                  onChange={e => set({ weekdayOtMultiplier: Number(e.target.value) })}
                />
                <TextInput label="Holiday OT Multiplier" name="holidayOtMultiplier" type="number"
                  value={String(config.holidayOtMultiplier ?? 2.0)}
                  onChange={e => set({ holidayOtMultiplier: Number(e.target.value) })}
                />
                <TextInput label="Max OT Hours / Day" name="maxOtHoursPerDay" type="number"
                  value={String(config.maxOtHoursPerDay ?? 4)}
                  onChange={e => set({ maxOtHoursPerDay: Number(e.target.value) })}
                />
                <TextInput label="Max OT Hours / Week" name="maxOtHoursPerWeek" type="number"
                  value={String(config.maxOtHoursPerWeek ?? 20)}
                  onChange={e => set({ maxOtHoursPerWeek: Number(e.target.value) })}
                />
              </div>
              {config.otMethod === 'SLAB' && (
                <SlabConfigurator
                  title="OT Slabs (by minutes)"
                  slabs={slabs.ot}
                  onChange={s => handleSlabChange('ot', s)}
                  warningNote="Slabs are non-linear — verify amounts don't decrease as duration increases."
                  canEdit={canEditSettings}
                />
              )}
            </>
          )}
        </Section>
      ),
    },
    {
      key: 'pf',
      label: 'PF Settings',
      content: (
        <Section title="Provident Fund (PF)">
          <Toggle checked={config.pfEnabled ?? true} onChange={v => set({ pfEnabled: v })} label="Enable PF" />
          {config.pfEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput label="PF Wage Formula" name="pfWageFormula"
                value={config.pfWageFormula ?? 'BASIC'}
                options={[{ value: 'BASIC', label: 'Basic Salary' }, { value: 'GROSS', label: 'Gross Salary' }]}
                onChange={e => set({ pfWageFormula: e.target.value })}
              />
              <TextInput label="Max PF Wage (₹)" name="maxPfWage" type="number"
                value={String(config.maxPfWage ?? 15000)}
                onChange={e => set({ maxPfWage: Number(e.target.value) })}
              />
              <TextInput label="Employee PF %" name="employeePfPercent" type="number"
                value={String(config.employeePfPercent ?? 12)}
                onChange={e => set({ employeePfPercent: Number(e.target.value) })}
              />
              <TextInput label="Employer PF %" name="employerPfPercent" type="number"
                value={String(config.employerPfPercent ?? 12)}
                onChange={e => set({ employerPfPercent: Number(e.target.value) })}
              />
              <SelectInput label="PF Rounding Rule" name="pfRoundingRule"
                value={config.pfRoundingRule ?? 'ROUND'}
                options={[{ value: 'ROUND', label: 'Round' }, { value: 'FLOOR', label: 'Floor' }, { value: 'CEILING', label: 'Ceiling' }]}
                onChange={e => set({ pfRoundingRule: e.target.value })}
              />
            </div>
          )}
        </Section>
      ),
    },
    {
      key: 'esi',
      label: 'ESI Settings',
      content: (
        <Section title="Employee State Insurance (ESI)">
          <Toggle checked={config.esiEnabled ?? true} onChange={v => set({ esiEnabled: v })} label="Enable ESI" />
          {config.esiEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Max ESI Salary (₹)" name="maxEsiSalary" type="number"
                value={String(config.maxEsiSalary ?? 21000)}
                onChange={e => set({ maxEsiSalary: Number(e.target.value) })}
              />
              <TextInput label="Employee ESI %" name="employeeEsiPercent" type="number"
                value={String(config.employeeEsiPercent ?? 0.75)}
                onChange={e => set({ employeeEsiPercent: Number(e.target.value) })}
              />
              <TextInput label="Employer ESI %" name="employerEsiPercent" type="number"
                value={String(config.employerEsiPercent ?? 3.25)}
                onChange={e => set({ employerEsiPercent: Number(e.target.value) })}
              />
              <SelectInput label="ESI Rounding Rule" name="esiRoundingRule"
                value={config.esiRoundingRule ?? 'ROUND'}
                options={[{ value: 'ROUND', label: 'Round' }, { value: 'FLOOR', label: 'Floor' }, { value: 'CEILING', label: 'Ceiling' }]}
                onChange={e => set({ esiRoundingRule: e.target.value })}
              />
            </div>
          )}
        </Section>
      ),
    },
    {
      key: 'leave',
      label: 'Leave & Attendance',
      content: (
        <Section title="Leave & Attendance Settings">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="Paid Leave / Year" name="paidLeavePerYear" type="number"
              value={String(config.paidLeavePerYear ?? 12)}
              onChange={e => set({ paidLeavePerYear: Number(e.target.value) })}
            />
            <TextInput label="Late Entry Grace Period (minutes)" name="lateEntryGraceMinutes" type="number"
              value={String(config.lateEntryGraceMinutes ?? 5)}
              onChange={e => set({ lateEntryGraceMinutes: Number(e.target.value) })}
            />
          </div>

          {/* ── How grace + slabs work together ── */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <Info size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold mb-1">How Late Entry Deduction works</p>
              <p>If an employee is late by ≤ <strong>{config.lateEntryGraceMinutes ?? 5} min</strong> (grace period), <strong>no deduction</strong> is applied.</p>
              <p className="mt-1">If late by more than the grace period, the <strong>total late minutes</strong> are looked up in the slab table below and that fixed amount is deducted.</p>
              <p className="mt-1 text-blue-600">Example: Late 30 min → matches slab "21–60 min → ₹50" → ₹50 deducted.</p>
              <p className="mt-1 text-blue-600">If no slabs are configured, a per-minute rate (Daily Rate ÷ Working Minutes) is used as fallback.</p>
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
          <SlabConfigurator
            title="Permission Deduction Slabs"
            slabs={slabs.perm}
            onChange={s => handleSlabChange('perm', s)}
            canEdit={canEditSettings}
            warningNote={
              slabs.perm.length === 0
                ? 'No slabs configured — add slabs to apply deduction rules when employees take permission.'
                : undefined
            }
          />
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 mt-1">
            <Info size={14} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold mb-1">Permission Slab Actions</p>
              <p><strong>₹ Deduct Amount</strong> — Deduct a fixed rupee amount from net salary.</p>
              <p className="mt-1"><strong>Half Day (LOP)</strong> — Convert the day to half day (0.5 LOP). No ₹ deduction.</p>
              <p className="mt-1"><strong>Half Day + OT</strong> — Mark half day LOP <em>and</em> automatically add the configured OT hours to that employee's OT pay.</p>
              <p className="mt-1 text-blue-600">Example: 09:00–21:00 shift. Employee arrives at 12:00 (180 min permission). Slab: <em>180+ min → Half Day + OT (3 hrs)</em>. Engine deducts 0.5 day salary and adds 3 hrs OT pay automatically.</p>
            </div>
          </div>
        </Section>
      ),
    },
    // {
    //   key: 'components',
    //   label: 'Salary Components',
    //   content: (
    //     <Section title="Salary Components">
    //       <SalaryComponentsEditor comps={comps} onChange={handleCompChange} />
    //     </Section>
    //   ),
    // },
    {
      key: 'deductions',
      label: 'Deductions',
      content: (
        <Section title="Deductions">
          <Toggle checked={config.professionalTaxEnabled ?? false} onChange={v => set({ professionalTaxEnabled: v })} label="Enable Professional Tax" />
          {config.professionalTaxEnabled && (
            <TextInput label="Professional Tax Amount (₹/month)" name="professionalTaxAmount" type="number"
              value={String(config.professionalTaxAmount ?? 200)}
              onChange={e => set({ professionalTaxAmount: Number(e.target.value) })}
            />
          )}
        </Section>
      ),
    },
    {
      key: 'rounding',
      label: 'Rounding',
      content: (
        <Section title="Rounding Rules">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectInput label="Net Salary Rounding" name="roundingRule"
              value={config.roundingRule ?? 'ROUND'}
              options={[
                { value: 'ROUND',   label: 'Round (nearest)'  },
                { value: 'FLOOR',   label: 'Floor (round down)' },
                { value: 'CEILING', label: 'Ceiling (round up)'  },
              ]}
              onChange={e => set({ roundingRule: e.target.value })}
            />
            <SelectInput label="Decimal Precision" name="decimalPrecision"
              value={String(config.decimalPrecision ?? 0)}
              options={[
                { value: '0', label: '₹0 (whole rupees)' },
                { value: '2', label: '₹0.00 (paise)'     },
              ]}
              onChange={e => set({ decimalPrecision: Number(e.target.value) })}
            />
          </div>
        </Section>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <div className="bg-white border-b border-border px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Payroll Settings</h1>
            <p className="text-sm text-text-secondary mt-0.5">
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
