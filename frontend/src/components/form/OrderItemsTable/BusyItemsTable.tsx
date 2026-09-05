import React, { useCallback, useRef } from "react";
import DeleteButton from "../../ui/DeleteButton/DeleteButton";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BusyColumn<T = any> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T, index: number, update: (patch: Partial<T>) => void) => React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
}

export interface TotalCell {
  colKey: string;
  value: string | number;
}

export interface SundryOption { value: string; label: string; sign: 1 | -1; }
export interface SundryRow { id: string; type: string; rate: string; amount: string; }
export interface BillSundryConfig {
  rows: SundryRow[];
  onChange: (rows: SundryRow[]) => void;
  options?: SundryOption[];
  title?: string;
}

export interface BusyItemsTableProps<T = any> {
  columns: BusyColumn<T>[];
  rows: T[];
  onChange?: (rows: T[]) => void;
  emptyRow?: T;
  visibleRows?: number;
  showTotals?: TotalCell[];
  billSundry?: BillSundryConfig;
  editable?: boolean;
  className?: string;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  renderExpandedRow?: (row: T, index: number) => React.ReactNode;
  expandedIndex?: number | null;
  onExpandToggle?: (index: number) => void;
  expandable?: boolean;
  canExpand?: (row: T, index: number) => boolean;
}

export const DEFAULT_SUNDRY_OPTIONS: SundryOption[] = [
  { value: "BILL_TAX_MINUS", label: "Bill Tax (-)", sign: -1 },
  { value: "BILL_TAX_PLUS", label: "Bill Tax (+)", sign: 1 },
  { value: "DISCOUNT_MINUS", label: "Discount (-)", sign: -1 },
  { value: "DISCOUNT_PLUS", label: "Discount (+)", sign: 1 },
  { value: "LORRY_FREIGHT_MINUS", label: "Lorry Freight (-)", sign: -1 },
  { value: "LORRY_FREIGHT_PLUS", label: "Lorry Freight (+)", sign: 1 },
  { value: "OTHERS_MINUS", label: "Others (-)", sign: -1 },
  { value: "OTHERS_PLUS", label: "Others (+)", sign: 1 },
  { value: "ROUND_OFF_MINUS", label: "Round Off (-)", sign: -1 },
];

const fmtINR = (v: string | number) => {
  const n = Number(v);
  if (!n && n !== 0) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── Shared cell / border style ──────────────────────────────────────────────

const B = "1px solid var(--color-line-soft, rgba(148,163,184,.25))";
const B2 = "2px solid var(--color-line, rgba(148,163,184,.4))";

const cellStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", padding: "0 6px",
  fontSize: 13, minWidth: 0, overflow: "hidden", borderRight: B,
};
const hdStyle: React.CSSProperties = {
  ...cellStyle, fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: 0.4, padding: "5px 6px",
};

// ─── Component ───────────────────────────────────────────────────────────────

function BusyItemsTable<T extends Record<string, any>>({
  columns, rows, onChange, emptyRow, visibleRows = 10, showTotals, billSundry,
  editable = true, className = "", onAdd, onRemove,
  renderExpandedRow, expandedIndex, onExpandToggle, expandable = false, canExpand,
}: BusyItemsTableProps<T>) {

  const ROW = 32;
  const SN = "40px";
  const colW = columns.map(c => c.width || "1fr").join(" ");
  const grid = `${SN} ${colW}${expandable ? " 32px" : ""}${editable ? " 36px" : ""}`;

  const updateRow = useCallback((i: number, patch: Partial<T>) => {
    if (!onChange) return;
    const n = [...rows]; n[i] = { ...n[i], ...patch }; onChange(n);
  }, [rows, onChange]);

  const doRemove = useCallback((i: number) => {
    if (onRemove) { onRemove(i); return; }
    if (onChange) onChange(rows.filter((_, j) => j !== i));
  }, [rows, onChange, onRemove]);

  const doAdd = useCallback(() => {
    if (onAdd) { onAdd(); return; }
    if (emptyRow && onChange) onChange([...rows, { ...emptyRow }]);
  }, [rows, onChange, emptyRow, onAdd]);

  const count = Math.max(rows.length, visibleRows);
  const colCount = columns.length + (expandable ? 1 : 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 2) doAdd();
  }, [doAdd]);

  // ── Keyboard nav ──────────────────────────────────────────────
  const focus = useCallback((r: number, c: number) => {
    const t = tableRef.current;
    if (!t) return;
    const cell = t.querySelector(`[data-r="${r}"][data-c="${c}"]`) as HTMLElement | null;
    if (!cell) return;
    // Try to focus an input/select inside the cell first, otherwise focus the cell itself
    const el = cell.querySelector("input, select, [tabindex]") as HTMLElement | null;
    if (el) el.focus();
    else cell.focus();
  }, []);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    const tgt = e.target as HTMLElement;
    // Skip if inside an open dropdown (autocomplete handles its own keys)
    if (tgt.closest("[data-dropdown-open]")) return;
    // Skip Enter/Space when inside an autocomplete cell (let it open the dropdown)
    if ((e.key === "Enter" || e.key === " ") && tgt.closest("[data-autocomplete]")) return;
    // Skip Enter/Space/ArrowDown/ArrowUp when target is a <select> (let browser handle it)
    if ((e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") && tgt.tagName === "SELECT") return;
    const cell = tgt.closest("[data-r][data-c]") as HTMLElement | null;
    if (!cell) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    // Skip Enter/Space on the expand column (let it toggle components)
    if ((e.key === "Enter" || e.key === " ") && expandable && c === columns.length) return;

    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      if (r >= rows.length - 1) {
        doAdd();
        setTimeout(() => focus(r + 1, c), 50);
      } else {
        focus(r + 1, c);
      }
    } else if (e.key === "ArrowUp" && r > 0) {
      e.preventDefault(); focus(r - 1, c);
    } else if (e.key === "ArrowRight" && c < colCount - 1) {
      e.preventDefault(); focus(r, c + 1);
    } else if (e.key === "ArrowLeft" && c > 0) {
      e.preventDefault(); focus(r, c - 1);
    } else if (e.key === "Tab" && !e.shiftKey) {
      if (c < colCount - 1) { e.preventDefault(); focus(r, c + 1); }
      else if (r < rows.length - 1) { e.preventDefault(); focus(r + 1, 0); }
      else if (r >= rows.length - 1) { e.preventDefault(); doAdd(); setTimeout(() => focus(r + 1, 0), 50); }
    } else if (e.key === "Tab" && e.shiftKey) {
      if (c > 0) { e.preventDefault(); focus(r, c - 1); }
      else if (r > 0) { e.preventDefault(); focus(r - 1, colCount - 1); }
    }
  }, [rows.length, colCount, focus, doAdd]);

  return (
    <div className={className}>
      <div ref={tableRef} onKeyDownCapture={onKey} style={{ border: B2, overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: B2, background: "var(--color-card-2, #1e293b)" }}>
          <div style={{ ...hdStyle, justifyContent: "center" }}>S.N.</div>
          {columns.map(col => (
            <div key={col.key} style={{ ...hdStyle, justifyContent: col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start" }}>
              {col.header}
            </div>
          ))}
          {expandable && <div style={hdStyle} />}
          {editable && <div style={{ ...hdStyle, borderRight: "none" }} />}
        </div>

        {/* Rows */}
        <div ref={scrollRef} onScroll={onScroll} style={{ overflowY: "auto", maxHeight: visibleRows * ROW }}>
          {Array.from({ length: count }).map((_, i) => {
            const row = rows[i];
            const real = i < rows.length;
            const canExp = real && expandable && (!canExpand || canExpand(row, i));
            const expanded = canExp && expandedIndex === i;
            const expContent = expanded && renderExpandedRow ? renderExpandedRow(row, i) : null;

            return (
              <React.Fragment key={i}>
                <div
                  style={{ display: "grid", gridTemplateColumns: grid, height: ROW, borderBottom: B }}
                  onClick={undefined}
                >
                  {/* S.N. */}
                  <div style={{ ...cellStyle, justifyContent: "center", color: "var(--color-ink-subtle)", fontWeight: 500 }}>{i + 1}</div>

                  {/* Cells */}
                  {columns.map((col, ci) => (
                    <div
                      key={col.key} data-r={i} data-c={ci} tabIndex={-1}
                      style={{ ...cellStyle, justifyContent: col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start", outline: "none", position: "relative" }}
                    >
                      {real
                        ? col.render ? col.render(row, i, p => updateRow(i, p))
                          : col.accessor ? col.accessor(row)
                          : (row[col.key] ?? "")
                        : ""}
                    </div>
                  ))}

                  {/* Expand */}
                  {expandable && (
                    <div data-r={i} data-c={columns.length} tabIndex={-1}
                      style={{ ...cellStyle, justifyContent: "center", outline: "none" }}
                      onKeyDown={(ev) => {
                        if ((ev.key === "Enter" || ev.key === " ") && canExp && onExpandToggle) {
                          ev.preventDefault(); ev.stopPropagation();
                          onExpandToggle(i);
                        }
                      }}
                    >
                      {canExp && onExpandToggle && (
                        <button type="button" tabIndex={-1} onClick={() => onExpandToggle(i)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-ink-subtle)", padding: 2 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {expanded ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                          </svg>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Delete */}
                  {editable && (
                    <div style={{ ...cellStyle, justifyContent: "center", borderRight: "none" }}>
                      {real && rows.length > 1 && <DeleteButton onClick={() => doRemove(i)} />}
                    </div>
                  )}
                </div>

                {expContent && <div style={{ borderBottom: B, background: "var(--color-card-2, #1e293b)" }}>{expContent}</div>}
              </React.Fragment>
            );
          })}
        </div>

        {/* Totals */}
        {showTotals && showTotals.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: grid, height: ROW, borderTop: B2, background: "var(--color-card-2, #1e293b)" }}>
            <div style={cellStyle} />
            {columns.map(col => {
              const tot = showTotals.find(t => t.colKey === col.key);
              return (
                <div key={col.key} style={{ ...cellStyle, fontWeight: 700, justifyContent: col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start" }}>
                  {tot ? tot.value : ""}
                </div>
              );
            })}
            {expandable && <div style={cellStyle} />}
            {editable && <div style={{ ...cellStyle, borderRight: "none" }} />}
          </div>
        )}
      </div>

      {billSundry && <BillSundryTable {...billSundry} />}

      <style dangerouslySetInnerHTML={{ __html: `
        [data-r][data-c]:focus-within { box-shadow: inset 0 0 0 2px var(--color-primary, #2dd4bf); z-index: 1; }
        [data-r][data-c]:focus { box-shadow: inset 0 0 0 2px var(--color-primary, #2dd4bf); z-index: 1; }
        [data-r][data-c] input:focus { outline: none; }
      `}} />
    </div>
  );
}

// ─── Bill Sundry ─────────────────────────────────────────────────────────────

const BillSundryTable: React.FC<BillSundryConfig> = ({
  rows, onChange, options = DEFAULT_SUNDRY_OPTIONS, title = "Bill Sundry",
}) => {
  const ROW = 32;
  const grid = "40px 1fr 120px 36px";
  const usedTypes = new Set(rows.map(r => r.type));
  const nextAvailable = options.find(o => !usedTypes.has(o.value))?.value ?? options[0]?.value ?? "";
  const add = () => { if (nextAvailable) onChange([...rows, { id: `${Date.now()}-${Math.random()}`, type: nextAvailable, rate: "", amount: "" }]); };
  const upd = (id: string, p: Partial<SundryRow>) => onChange(rows.map(r => r.id === id ? { ...r, ...p } : r));
  const del = (id: string) => onChange(rows.filter(r => r.id !== id));
  const total = rows.reduce((s, r) => { const a = Number(r.amount) || 0; const o = options.find(x => x.value === r.type); return s + (o?.sign === -1 ? -a : a); }, 0);
  const allUsed = rows.length >= options.length;

  return (
    <div style={{ border: B2, overflow: "hidden", maxWidth: 480, marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: B2, background: "var(--color-card-2)" }}>
        <div style={{ ...hdStyle, justifyContent: "center" }}>S.N.</div>
        <div style={hdStyle}>{title}</div>
        <div style={{ ...hdStyle, justifyContent: "flex-end" }}>Amount (₹)</div>
        <div style={{ ...hdStyle, borderRight: "none" }} />
      </div>
      <div>
        {rows.length === 0 ? (
          <div onClick={!allUsed ? add : undefined} style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "var(--color-ink-muted)", cursor: allUsed ? "default" : "pointer" }}>
            Click to add {title.toLowerCase()} entry
          </div>
        ) : rows.map((r, i) => {
          const isNeg = options.find(o => o.value === r.type)?.sign === -1;
          return (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: grid, height: ROW, borderBottom: B }}>
              <div style={{ ...cellStyle, justifyContent: "center", color: "var(--color-ink-subtle)" }}>{i + 1}</div>
              <div style={cellStyle}>
                <select value={r.type} onChange={e => upd(r.id, { type: e.target.value })}
                  style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--color-ink)", cursor: "pointer" }}>
                  {options.map(o => <option key={o.value} value={o.value} disabled={o.value !== r.type && usedTypes.has(o.value)}>{o.label}</option>)}
                </select>
              </div>
              <div style={cellStyle}>
                <input type="text" inputMode="decimal" value={r.amount} onChange={e => upd(r.id, { amount: e.target.value.replace(/[^0-9.]/g, "") })}
                  placeholder="0.00" style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 13, textAlign: "right", fontWeight: 600, color: isNeg ? "#ef4444" : "var(--color-ink)" }} />
              </div>
              <div style={{ ...cellStyle, justifyContent: "center", borderRight: "none" }}><DeleteButton onClick={() => del(r.id)} /></div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: grid, height: ROW, borderTop: B2, background: "var(--color-card-2)" }}>
        <div style={cellStyle} />
        <div style={cellStyle}>
          {!allUsed && <button type="button" onClick={add} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--color-accent)" }}>+ Add Entry</button>}
        </div>
        <div style={{ ...cellStyle, justifyContent: "flex-end", fontWeight: 700, color: total < 0 ? "#ef4444" : "var(--color-ink)" }}>
          {fmtINR(Math.abs(total))}{total !== 0 && <span style={{ fontSize: 10, marginLeft: 4, color: "var(--color-ink-muted)" }}>{total > 0 ? "(+)" : "(-)"}</span>}
        </div>
        <div style={{ ...cellStyle, borderRight: "none" }} />
      </div>
    </div>
  );
};

export { BillSundryTable };
export default BusyItemsTable;
