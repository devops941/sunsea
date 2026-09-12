import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useTableCellNav — Excel-style grid navigation for accounts list/report tables.
 *
 * Manages a `(rowIdx, colIdx)` pair driven by arrow keys, Home/End, PageUp/Down,
 * Enter and E. Meant for read-only tables where the operator navigates cells
 * without an <input> in every cell (that pattern still uses per-cell focus refs
 * like ContraVoucherAddPage's `focusCell`).
 *
 * Key behaviour matches Excel:
 *   ↑ / ↓        → previous / next row (same column)
 *   ← / →        → previous / next column (same row)
 *   Home / End   → first / last column of the current row
 *   Ctrl+Home    → first cell of the table
 *   Ctrl+End     → last cell of the table
 *   PageUp / Dn  → jump `pageSize` rows (default 10)
 *   Enter        → onEnter(rowIdx, colIdx) — typical use: drill into the row
 *   E            → onEdit(rowIdx) — typical use: open the row for edit
 *
 * The listener is registered on `window` (with capture: false) so it fires
 * whenever no INPUT/TEXTAREA/SELECT owns focus. Any dropdown portal open (a
 * `[data-select-portal]` node) suppresses the handler so the portal's own
 * key handling wins. contenteditable focus is also skipped.
 *
 * Backwards compatible with pages that only care about row nav — pass
 * `colCount: 1` and read `rowIdx`, ignore `colIdx`.
 *
 * Usage:
 *   const cols = 1 + (options.showType ? 1 : 0) + (options.showMobile ? 1 : 0) + 2;
 *   const { rowIdx, colIdx, setCell } = useTableCellNav({
 *     rowCount: rows.length,
 *     colCount: cols,
 *     onEnter: (r) => navigate(`/accounts/payable/${rows[r].supplierId}`),
 *     disabled: showOptionsDialog,
 *   });
 *   // In each cell:
 *   const isActive = rowIdx === i && colIdx === thisCellCol;
 *   const cls = `${rowIdx === i ? "bg-black text-white" : ""} ${isActive ? "ring-2 ring-yellow-400 ring-inset" : ""}`;
 */
interface UseTableCellNavOptions {
  /** Total row count. When it changes, indices are clamped in-range. */
  rowCount: number;
  /** Total column count — can vary as conditional columns toggle. */
  colCount: number;
  /** Fired on Enter. First arg is the row index, second is the column. */
  onEnter?: (rowIdx: number, colIdx: number) => void;
  /** Fired on E key. */
  onEdit?: (rowIdx: number) => void;
  /** When true, the keydown listener is a no-op. Set this while a modal
   *  overlay owns the page so the modal's own handlers can win. */
  disabled?: boolean;
  /** Rows to jump on PageUp / PageDown. Default 10. */
  pageSize?: number;
}

export function useTableCellNav({
  rowCount,
  colCount,
  onEnter,
  onEdit,
  disabled = false,
  pageSize = 10,
}: UseTableCellNavOptions) {
  const [rowIdx, setRowIdx] = useState(0);
  const [colIdx, setColIdx] = useState(0);

  // Stable snapshot of state so the window listener is registered ONCE and
  // never captures stale values. Refs are the standard pattern here.
  const stateRef = useRef({ rowIdx, colIdx, rowCount, colCount, disabled });
  useEffect(() => {
    stateRef.current = { rowIdx, colIdx, rowCount, colCount, disabled };
  }, [rowIdx, colIdx, rowCount, colCount, disabled]);

  const onEnterRef = useRef(onEnter);
  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  const onEditRef = useRef(onEdit);
  useEffect(() => {
    onEditRef.current = onEdit;
  }, [onEdit]);

  // Clamp when the dataset shrinks (filter, page turn, column toggle off).
  useEffect(() => {
    if (rowCount > 0 && rowIdx > rowCount - 1) setRowIdx(rowCount - 1);
    if (colCount > 0 && colIdx > colCount - 1) setColIdx(colCount - 1);
  }, [rowCount, colCount, rowIdx, colIdx]);

  const setCell = useCallback(
    (r: number, c: number) => {
      setRowIdx(Math.max(0, Math.min(r, Math.max(0, rowCount - 1))));
      setColIdx(Math.max(0, Math.min(c, Math.max(0, colCount - 1))));
    },
    [rowCount, colCount]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.disabled) return;
      if (s.rowCount === 0 || s.colCount === 0) return;

      // If focus is inside a form control, let it own the arrow keys
      // (search boxes, selects, edits). This matches existing page handlers
      // in accounts/payable + accounts/receivable — do NOT change convention.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // If any portal is open (dropdown, popover), let it handle keys.
      if (document.querySelector("[data-select-portal]")) return;

      // Skip when a contenteditable owns focus (rich text editors etc.).
      const active = document.activeElement as HTMLElement | null;
      if (active?.isContentEditable) return;

      const rowMax = s.rowCount - 1;
      const colMax = s.colCount - 1;
      const r = s.rowIdx;
      const c = s.colIdx;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setRowIdx(Math.min(r + 1, rowMax));
          break;
        case "ArrowUp":
          e.preventDefault();
          setRowIdx(Math.max(r - 1, 0));
          break;
        case "ArrowRight":
          e.preventDefault();
          setColIdx(Math.min(c + 1, colMax));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setColIdx(Math.max(c - 1, 0));
          break;
        case "Home":
          // Excel convention: Home = first column of current row;
          //                   Ctrl+Home = first cell of table.
          e.preventDefault();
          if (e.ctrlKey) setRowIdx(0);
          setColIdx(0);
          break;
        case "End":
          e.preventDefault();
          if (e.ctrlKey) setRowIdx(rowMax);
          setColIdx(colMax);
          break;
        case "PageDown":
          e.preventDefault();
          setRowIdx(Math.min(r + pageSize, rowMax));
          break;
        case "PageUp":
          e.preventDefault();
          setRowIdx(Math.max(r - pageSize, 0));
          break;
        case "Enter":
          if (onEnterRef.current) {
            e.preventDefault();
            onEnterRef.current(r, c);
          }
          break;
        case "e":
        case "E":
          if (onEditRef.current) {
            e.preventDefault();
            onEditRef.current(r);
          }
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageSize]);

  return { rowIdx, colIdx, setCell, setRowIdx, setColIdx };
}
