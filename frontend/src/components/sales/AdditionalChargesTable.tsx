import React from "react";
import SelectInput from "../form/SelectInput/SelectInput";
import TextInput from "../form/TextInput/TextInput";
import DeleteButton from "../ui/DeleteButton/DeleteButton";
import CustomButton from "../ui/Button/Button";
import StatusBadge from "../ui/StatusBadge/Badge";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChargeRow {
    id: string;
    type: string;
    amount: string;
}

export interface ChargeOption {
    value: string;
    label: string;
    sign: 1 | -1;
}

export const DEFAULT_CHARGE_OPTIONS: ChargeOption[] = [
    { value: 'LORRY_FREIGHT',       label: 'Lorry Freight (+)',               sign: 1  },
    { value: 'LORRY_FREIGHT_MINUS', label: 'Lorry Freight (-)',               sign: -1 },
    { value: 'OTHERS_PLUS',         label: 'Others (+)',                      sign: 1  },
    { value: 'OTHERS_MINUS',        label: 'Others (-)',                      sign: -1 },
    { value: 'ROUND_OFF_PLUS',      label: 'Round Off (+)',                   sign: 1  },
    { value: 'ROUND_OFF_MINUS',     label: 'Round Off (-)',                   sign: -1 },
    { value: 'TDS',                 label: 'TDS on Pymt./Purc. of Goods (-)', sign: -1 },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Parse chargeRows from a narration JSON string (supports both __chargeRows__ and legacy __charges__) */
export function parseChargeRowsFromNarration(narration: string | null | undefined): ChargeRow[] {
    try {
        const raw = narration || "";
        if (!raw.startsWith("{")) return [];
        const parsed = JSON.parse(raw);

        if (parsed?.__chargeRows__) {
            return (parsed.__chargeRows__ as { type: string; amount: number }[]).map(r => ({
                id: `${Date.now()}-${Math.random()}`,
                type: r.type,
                amount: String(r.amount),
            }));
        }

        if (parsed?.__charges__) {
            const ch = parsed.__charges__ as Record<string, number>;
            const MAP = [
                { key: 'lorryFreight',  type: 'LORRY_FREIGHT'   },
                { key: 'othersPlus',    type: 'OTHERS_PLUS'     },
                { key: 'othersMinus',   type: 'OTHERS_MINUS'    },
                { key: 'roundOffPlus',  type: 'ROUND_OFF_PLUS'  },
                { key: 'roundOffMinus', type: 'ROUND_OFF_MINUS' },
                { key: 'tds',           type: 'TDS'             },
            ];
            return MAP
                .filter(m => Number(ch[m.key]) > 0)
                .map(m => ({
                    id: `${Date.now()}-${Math.random()}`,
                    type: m.type,
                    amount: String(ch[m.key]),
                }));
        }
    } catch { /* ignore */ }
    return [];
}

/** Serialize chargeRows to a narration JSON string */
export function serializeChargeRowsToNarration(rows: ChargeRow[]): string {
    return JSON.stringify({
        __chargeRows__: rows
            .filter(r => Number(r.amount) > 0)
            .map(({ type, amount }) => ({ type, amount: Number(amount) })),
    });
}

/** Compute additions and deductions totals from chargeRows */
export function computeChargeTotals(
    rows: ChargeRow[],
    options: ChargeOption[] = DEFAULT_CHARGE_OPTIONS
): { additions: number; deductions: number } {
    let additions = 0;
    let deductions = 0;
    rows.forEach(row => {
        const amt = Number(row.amount) || 0;
        if (amt <= 0) return;
        const opt = options.find(o => o.value === row.type);
        if (opt?.sign === 1) additions += amt;
        else deductions += amt;
    });
    return { additions, deductions };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AdditionalChargesTableProps {
    rows: ChargeRow[];
    onChange: (rows: ChargeRow[]) => void;
    options?: ChargeOption[];
}

const AdditionalChargesTable: React.FC<AdditionalChargesTableProps> = ({
    rows,
    onChange,
    options = DEFAULT_CHARGE_OPTIONS,
}) => {
    const addRow = () =>
        onChange([
            ...rows,
            { id: `${Date.now()}-${Math.random()}`, type: options[0]?.value ?? '', amount: '' },
        ]);

    const updateRow = (id: string, patch: Partial<ChargeRow>) =>
        onChange(rows.map(r => (r.id === id ? { ...r, ...patch } : r)));

    const removeRow = (id: string) =>
        onChange(rows.filter(r => r.id !== id));

    return (
        <div className="flex-1 border border-line rounded-xl bg-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-card-2 border-b border-line-soft">
                <span className="text-xs font-bold text-ink uppercase tracking-wide">
                    Additional Charges / Deductions
                </span>
                <CustomButton
                    text="+ Add Charge"
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={addRow}
                />
            </div>

            {rows.length === 0 ? (
                <p className="text-xs text-ink-muted text-center py-6">
                    No additional charges. Click "+ Add Charge" to add one.
                </p>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-card-2/60 border-b border-line-soft">
                            <th className="py-2 px-3 text-left text-[11px] font-bold text-ink-muted uppercase w-[55%]">Type</th>
                            <th className="py-2 px-3 text-center text-[11px] font-bold text-ink-muted uppercase w-[15%]">Effect</th>
                            <th className="py-2 px-3 text-right text-[11px] font-bold text-ink-muted uppercase w-[25%]">Amount (₹)</th>
                            <th className="py-2 px-2 w-[5%]" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => {
                            const opt = options.find(o => o.value === row.type);
                            const isAdd = opt?.sign === 1;
                            return (
                                <tr key={row.id} className="border-b border-line-soft last:border-0 hover:bg-card-2/30">
                                    {/* Type dropdown */}
                                    <td className="py-2 px-3">
                                        <SelectInput
                                            hideLabel
                                            label=""
                                            name={`charge-type-${row.id}`}
                                            value={row.type}
                                            options={options.map(o => ({ value: o.value, label: o.label }))}
                                            onChange={e => updateRow(row.id, { type: (e as any).target ? (e as any).target.value : String(e) })}
                                        />
                                    </td>

                                    {/* Effect badge */}
                                    <td className="py-2 px-3 text-center">
                                        <StatusBadge
                                            status=""
                                            customText={isAdd ? '+ Add' : '− Less'}
                                            customColor={
                                                isAdd
                                                    ? { bg: '#d1fae5', text: '#065f46' }
                                                    : { bg: '#fee2e2', text: '#b91c1c' }
                                            }
                                        />
                                    </td>

                                    {/* Amount input */}
                                    <td className="py-2 px-3">
                                        <TextInput
                                            name={`charge-amount-${row.id}`}
                                            type="number"
                                            min={0}
                                            preventNegative
                                            value={row.amount}
                                            onChange={e => updateRow(row.id, { amount: e.target.value })}
                                            placeholder="0.00"
                                            inputClassName="!text-right"
                                        />
                                    </td>

                                    {/* Remove */}
                                    <td className="py-2 px-2 text-center">
                                        <DeleteButton onClick={() => removeRow(row.id)} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default AdditionalChargesTable;
