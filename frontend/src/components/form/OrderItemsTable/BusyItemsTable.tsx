import React, { useCallback, useRef, useMemo, useState } from "react";
import DeleteButton from "../../ui/DeleteButton/DeleteButton";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BusyColumn<T = any> {
  key: string;
  header: string | React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T, index: number, update: (patch: Partial<T>) => void) => React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
  /** Explicitly mark a column as (non-)editable for keyboard navigation. Overrides the
   *  key-name heuristic that otherwise treats "total"/"amount_calc" columns as read-only. */
  editable?: boolean;
}

export interface TotalCell {
  colKey: string;
  value: string | number | React.ReactNode;
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
  /** Height (px) of each data row. Default 32. Use a larger value (e.g. 44) when cells contain form inputs. */
  rowHeight?: number;
  showTotals?: TotalCell[];
  billSundry?: BillSundryConfig;
  editable?: boolean;
  className?: string;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  isRowDeletable?: (row: T, index: number) => boolean;
  rowDeleteDisabledMessage?: string | ((row: T, index: number) => string);
  renderExpandedRow?: (row: T, index: number) => React.ReactNode;
  expandedIndex?: number | null;
  onExpandToggle?: (index: number) => void;
  expandable?: boolean;
  canExpand?: (row: T, index: number) => boolean;
  getFieldBeforeTable?: () => HTMLElement | null | undefined;
  getFieldAfterTable?: () => HTMLElement | null | undefined;
  onNavigateRight?: (row: number, col: number) => boolean | void;
  onNavigateLeft?: (row: number, col: number) => boolean | void;
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
  { value: "ROUND_OFF_PLUS", label: "Round Off (+)", sign: 1 },
];

const fmtINR = (v: string | number) => {
  const n = Number(v);
  if (!n && n !== 0) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── Shared cell / border style ──────────────────────────────────────────────

const B = "1px solid var(--color-line-soft, rgba(148,163,184,.25))";
const B2 = "1px solid var(--color-line-soft, rgba(148,163,184,.25))";

const cellStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", padding: "0 6px",
  fontSize: 13, minWidth: 0, overflow: "hidden", borderRight: B,
};
const hdStyle: React.CSSProperties = {
  ...cellStyle, fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: 0.4, padding: "5px 6px",
};

// ─── Helpers for Form Integration & Boundary Check ────────────────────────────

function getNavigableFormElements(tableEl: HTMLElement | null): HTMLElement[] {
  const form = tableEl?.closest("form") || document.body;
  return Array.from(
    form.querySelectorAll<HTMLElement>("[data-nav]")
  ).filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      !(el as HTMLInputElement).disabled &&
      el.offsetParent !== null &&
      !el.closest("[data-busy-table]")
  );
}

function getFieldBeforeTable(tableEl: HTMLElement | null): HTMLElement | null {
  if (!tableEl) return null;
  const allNav = getNavigableFormElements(tableEl);
  const before = allNav.filter(el =>
    Boolean(tableEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)
  );
  return before.length > 0 ? before[before.length - 1] : null;
}

function getFieldAfterTable(tableEl: HTMLElement | null): HTMLElement | null {
  if (!tableEl) return null;
  const allNav = getNavigableFormElements(tableEl);
  const after = allNav.filter(el =>
    Boolean(tableEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
  return after.length > 0 ? after[0] : null;
}

function isInputAtLeftBoundary(input: HTMLInputElement): boolean {
  try {
    const { selectionStart, selectionEnd } = input;
    if (selectionStart === null || selectionEnd === null) return true;
    if (selectionStart === 0 && selectionEnd === input.value.length) return true;
    return selectionStart === 0 && selectionEnd === 0;
  } catch {
    return true;
  }
}

function isInputAtRightBoundary(input: HTMLInputElement): boolean {
  try {
    const { selectionStart, selectionEnd, value } = input;
    if (selectionStart === null || selectionEnd === null) return true;
    if (selectionStart === 0 && selectionEnd === value.length) return true;
    return selectionStart === value.length && selectionEnd === value.length;
  } catch {
    return true;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

function BusyItemsTable<T extends Record<string, any>>({
  columns, rows, onChange, emptyRow, visibleRows = 10, rowHeight, showTotals, billSundry,
  editable = true, className = "", onAdd, onRemove,
  isRowDeletable, rowDeleteDisabledMessage,
  renderExpandedRow, expandedIndex, onExpandToggle, expandable = false, canExpand,
  getFieldBeforeTable: propGetFieldBefore, getFieldAfterTable: propGetFieldAfter,
  onNavigateRight: propOnNavigateRight, onNavigateLeft: propOnNavigateLeft,
}: BusyItemsTableProps<T>) {

  const ROW = rowHeight ?? 32;
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

  // Extra empty rows appended purely by keyboard navigation: arrowing Down past the last
  // visible row grows the grid (Busy-style) instead of leaving it. Arrows stay inside the
  // table; only Tab exits to the next field (e.g. Narration).
  const [extraRows, setExtraRows] = useState(0);
  const count = Math.max(rows.length, visibleRows) + extraRows;
  const colCount = columns.length + (expandable ? 1 : 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only auto-append when the real rows already fill the visible window. While the
    // table is padded with empty placeholder rows (rows.length < visibleRows), scrolling
    // to the bottom — e.g. when ArrowDown scrolls the last empty row into view — must NOT
    // spawn a phantom row; the caret should instead move to the next field (Narration).
    if (rows.length < visibleRows) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 2) doAdd();
  }, [doAdd, rows.length, visibleRows]);

  // Find last column that actually contains user-editable inputs (e.g. not read-only total)
  const lastEditableCol = useMemo(() => {
    for (let i = columns.length - 1; i >= 0; i--) {
      const col = columns[i];
      // An explicit `editable` flag wins; otherwise fall back to the key-name heuristic
      // (columns named like a computed "total"/"amount_calc" are treated as read-only).
      const k = col.key.toLowerCase();
      const isEditable = col.editable !== undefined
        ? col.editable
        : (!k.includes("total") && !k.includes("amount_calc"));
      if (isEditable) {
        return i;
      }
    }
    return Math.max(0, columns.length - 1);
  }, [columns]);

  // ── Keyboard nav ──────────────────────────────────────────────
  const focus = useCallback((r: number, c: number) => {
    const doFocus = () => {
      const t = tableRef.current;
      if (!t) return false;
      const cell = t.querySelector(`[data-r="${r}"][data-c="${c}"]`) as HTMLElement | null;
      if (!cell) return false;
      // Try to focus an input/select inside the cell first, otherwise focus the cell itself
      const el = cell.querySelector("[data-nav]:not([disabled]), input:not([disabled]), select:not([disabled]), [role='combobox']:not([disabled]), [tabindex]:not([tabindex='-1'])") as HTMLElement | null;
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement && el.type !== "button" && el.type !== "checkbox") {
          try { el.select(); } catch {}
        }
        return true;
      } else {
        cell.focus();
        return true;
      }
    };
    if (!doFocus()) {
      setTimeout(doFocus, 30);
      setTimeout(doFocus, 80);
    }
  }, []);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    const tgt = e.target as HTMLElement;
    // If inside an open autocomplete dropdown, let AutocompleteInput handle the keys
    if (tgt.closest("[data-dropdown-open='true']")) return;

    // If inside a cell explicitly marked to let Enter/ArrowDown open the autocomplete dropdown, skip handling
    if (tgt.closest("[data-enter-opens-autocomplete]") && (e.key === "Enter" || e.key === "ArrowDown" || (e.altKey && e.key === "ArrowDown"))) return;

    // If target is a standard HTML <select>, let native select handle Space / ArrowDown / ArrowUp / Enter, but let Left/Right navigate
    if (tgt.tagName === "SELECT" && (e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter")) return;

    // If target is a MultiSelect or combobox or if a dropdown portal is open, let MultiSelect handle navigation keys
    if (
      tgt.closest("[role='combobox']") ||
      tgt.closest("[aria-expanded='true']") ||
      document.querySelector("[data-select-portal]")
    ) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " " || e.key === "Escape") {
        return;
      }
    }

    const cell = tgt.closest("[data-r][data-c]") as HTMLElement | null;
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);

    // If the focused cell is an empty placeholder row (r >= rows.length)
    if (r >= rows.length) {
      if (e.key === "Enter" || e.key === " " || e.key === "F2" || (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        if (onChange && emptyRow) {
          const newRows = [...rows];
          while (newRows.length <= r) {
            newRows.push({ ...emptyRow });
          }
          onChange(newRows);
          setTimeout(() => focus(r, c), 40);
        } else if (onAdd) {
          onAdd();
          setTimeout(() => focus(r, c), 40);
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        if (c === 0 && propOnNavigateLeft) {
          const handled = propOnNavigateLeft(r, c);
          if (handled !== false) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
        if (c > 0) {
          e.preventDefault();
          e.stopPropagation();
          focus(r, c - 1);
        } else if (r > 0) {
          e.preventDefault();
          e.stopPropagation();
          focus(r - 1, lastEditableCol);
        }
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (r > 0) {
          focus(r - 1, c);
        } else {
          const prevField = propGetFieldBefore ? propGetFieldBefore() : getFieldBeforeTable(tableRef.current);
          if (prevField) {
            prevField.focus();
            try { (prevField as HTMLInputElement).select?.(); } catch {}
          }
        }
        return;
      }
    }

    // Skip Enter/Space on the expand column (let it toggle components)
    if ((e.key === "Enter" || e.key === " ") && expandable && c === columns.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (r < rows.length - 1) {
        focus(r + 1, c);
      } else {
        const currRow = rows[r];
        const hasData = currRow && Object.values(currRow).some(v => v !== "" && v !== null && v !== undefined && v !== 0 && v !== "0");
        if (hasData && onChange && emptyRow && editable) {
          const newRows = [...rows, { ...emptyRow }];
          onChange(newRows);
          setTimeout(() => focus(r + 1, c), 30);
        } else if (hasData && onAdd && editable) {
          onAdd();
          setTimeout(() => focus(r + 1, c), 30);
        } else if (r < count - 1) {
          focus(r + 1, c);
        } else {
          // At the last visible row: keep the caret INSIDE the grid and grow it by one
          // empty row (Busy-style), rather than jumping to the next field. Leaving the
          // grid for Narration etc. is done with Tab, never with the arrow keys.
          setExtraRows((x) => x + 1);
          setTimeout(() => focus(r + 1, c), 30);
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (r > 0) {
        focus(r - 1, c);
      } else {
        // At top row (r === 0): navigate to previous form field above table
        const prevField = propGetFieldBefore ? propGetFieldBefore() : getFieldBeforeTable(tableRef.current);
        if (prevField) {
          prevField.focus();
          try { (prevField as HTMLInputElement).select?.(); } catch {}
        }
      }
    } else if (e.key === "ArrowRight") {
      if (tgt instanceof HTMLInputElement && !isInputAtRightBoundary(tgt)) {
        return; // Allow cursor movement within input text
      }
      e.preventDefault();
      e.stopPropagation();

      // If at or past the last editable column and onNavigateRight is given, cross over to sibling table
      if (c >= lastEditableCol && propOnNavigateRight) {
        const handled = propOnNavigateRight(r, c);
        if (handled !== false) return;
      }

      if (c < colCount - 1) {
        focus(r, c + 1);
      } else if (r < rows.length - 1) {
        focus(r + 1, 0);
      } else {
        // At bottom right: add new row, jump to sibling table, or move to next section
        if (onChange && emptyRow && editable) {
          const newRows = [...rows, { ...emptyRow }];
          onChange(newRows);
          setTimeout(() => focus(r + 1, 0), 30);
        } else if (onAdd && editable) {
          onAdd();
          setTimeout(() => focus(r + 1, 0), 30);
        } else if (propOnNavigateRight && propOnNavigateRight(r, c) !== false) {
          return;
        } else {
          const nextField = propGetFieldAfter ? propGetFieldAfter() : getFieldAfterTable(tableRef.current);
          if (nextField) nextField.focus();
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (tgt instanceof HTMLInputElement && !isInputAtLeftBoundary(tgt)) {
        return; // Allow cursor movement within input text
      }
      e.preventDefault();
      e.stopPropagation();

      // If at column 0 and onNavigateLeft is given, cross over to sibling table
      if (c === 0 && propOnNavigateLeft) {
        const handled = propOnNavigateLeft(r, c);
        if (handled !== false) return;
      }

      if (c > 0) {
        focus(r, c - 1);
      } else if (r > 0) {
        focus(r - 1, lastEditableCol);
      } else {
        // At top left: navigate to previous form field before table
        const prevField = propGetFieldBefore ? propGetFieldBefore() : getFieldBeforeTable(tableRef.current);
        if (prevField) {
          prevField.focus();
          try { (prevField as HTMLInputElement).select?.(); } catch {}
        }
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (c < lastEditableCol) {
        focus(r, c + 1);
      } else if (r < rows.length - 1) {
        focus(r + 1, 0);
      } else {
        if (onChange && emptyRow && editable) {
          const newRows = [...rows, { ...emptyRow }];
          onChange(newRows);
          setTimeout(() => focus(r + 1, 0), 30);
        } else if (onAdd && editable) {
          onAdd();
          setTimeout(() => focus(r + 1, 0), 30);
        } else if (propOnNavigateRight && propOnNavigateRight(r, c) !== false) {
          return;
        } else {
          const nextField = propGetFieldAfter ? propGetFieldAfter() : getFieldAfterTable(tableRef.current);
          if (nextField) nextField.focus();
        }
      }
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (c < lastEditableCol) {
        focus(r, c + 1);
      } else if (propOnNavigateRight && propOnNavigateRight(r, c) !== false) {
        return;
      } else if (r < rows.length - 1) {
        focus(r + 1, 0);
      } else {
        if (onChange && emptyRow && editable) {
          const newRows = [...rows, { ...emptyRow }];
          onChange(newRows);
          setTimeout(() => focus(r + 1, 0), 30);
        } else if (onAdd && editable) {
          onAdd();
          setTimeout(() => focus(r + 1, 0), 30);
        } else {
          const nextField = propGetFieldAfter ? propGetFieldAfter() : getFieldAfterTable(tableRef.current);
          if (nextField) nextField.focus();
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (c === 0 && propOnNavigateLeft && propOnNavigateLeft(r, c) !== false) {
        return;
      }
      if (c > 0) {
        focus(r, c - 1);
      } else if (r > 0) {
        focus(r - 1, lastEditableCol);
      } else {
        const prevField = propGetFieldBefore ? propGetFieldBefore() : getFieldBeforeTable(tableRef.current);
        if (prevField) {
          prevField.focus();
          try { (prevField as HTMLInputElement).select?.(); } catch {}
        }
      }
    }
  }, [rows, colCount, focus, onChange, emptyRow, onAdd, columns.length, lastEditableCol, expandable, propGetFieldBefore, propGetFieldAfter, propOnNavigateRight, propOnNavigateLeft]);

  return (
    <div className={className}>
      <div ref={tableRef} data-busy-table="true" onKeyDownCapture={onKey} style={{ border: B2, borderRadius: "0.75rem", overflow: "hidden" }}>

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
                  style={{ display: "grid", gridTemplateColumns: grid, height: ROW, borderBottom: B, cursor: real ? "default" : "pointer" }}
                >
                  {/* S.N. */}
                  <div
                    style={{ ...cellStyle, justifyContent: "center", color: "var(--color-ink-subtle)", fontWeight: 500 }}
                    onClick={() => {
                      if (!real) {
                        if (onChange && emptyRow) {
                          const newRows = [...rows];
                          while (newRows.length <= i) {
                            newRows.push({ ...emptyRow });
                          }
                          onChange(newRows);
                          setTimeout(() => focus(i, 0), 30);
                        } else if (onAdd) {
                          onAdd();
                          setTimeout(() => focus(i, 0), 30);
                        }
                      }
                    }}
                  >{i + 1}</div>

                  {/* Cells */}
                  {columns.map((col, ci) => (
                    <div
                      key={col.key} data-r={i} data-c={ci} tabIndex={real ? -1 : 0}
                      {...(i === 0 && ci === 0 ? { "data-busy-first": "true", "data-nav": "true" } : {})}
                      style={{ ...cellStyle, justifyContent: col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start", outline: "none", position: "relative" }}
                      onClick={() => {
                        if (!real) {
                          if (onChange && emptyRow) {
                            const newRows = [...rows];
                            while (newRows.length <= i) {
                              newRows.push({ ...emptyRow });
                            }
                            onChange(newRows);
                            setTimeout(() => focus(i, ci), 30);
                          } else if (onAdd) {
                            onAdd();
                            setTimeout(() => focus(i, ci), 30);
                          }
                        }
                      }}
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
                      {real && rows.length > 1 && (
                        <DeleteButton
                          onClick={() => doRemove(i)}
                          disabled={isRowDeletable ? !isRowDeletable(row, i) : Boolean((row as any)?.isLocked)}
                          disabledMessage={
                            (isRowDeletable ? !isRowDeletable(row, i) : Boolean((row as any)?.isLocked))
                              ? (typeof rowDeleteDisabledMessage === "function"
                                  ? rowDeleteDisabledMessage(row, i)
                                  : rowDeleteDisabledMessage || (row as any)?.lockReason || "Cannot delete: This order is assigned to Daily Production Plan")
                              : undefined
                          }
                        />
                      )}
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
                  {options.map(o => (
                    <option
                      key={o.value}
                      value={o.value}
                      disabled={o.value !== r.type && usedTypes.has(o.value)}
                      style={{ background: "var(--color-card, #1e293b)", color: "var(--color-ink, #f1f5f9)" }}
                    >
                      {o.label}
                    </option>
                  ))}
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
