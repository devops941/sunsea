import type React from "react";

/**
 * handleGridArrow — Excel-style grid navigation for FORM cells that contain
 * an <input> or <select>.
 *
 * Add/Edit voucher pages render a spreadsheet-style grid where each cell owns
 * an input (D/C select, LedgerSearchInput, amount input, narration input).
 * The existing `focusCell(rowIdx, field)` already jumps between cells on
 * Enter/Tab. This helper adds arrow-key navigation ON TOP:
 *
 *   ↑ / ↓            → previous / next row, same column (always, even mid-value)
 *   ← (cursor at 0)  → previous column of the same row
 *   → (cursor at end)→ next column of the same row
 *   ← / → otherwise  → let the browser move the cursor within the value
 *
 * The cursor-position guard means the operator can still edit text with
 * ← / → keys — the nav only kicks in when they've reached the edge.
 *
 * SELECT elements report `selectionStart` as null; we treat them as if the
 * cursor is at both start AND end, so ← / → always jump cells for those.
 * (Browser default of ArrowUp/Down cycling select options is overridden here
 * so the operator gets consistent row-nav across every cell type. They can
 * still change select value via letter keys, Space, or click.)
 *
 * Usage:
 *   const FIELDS = ["dc", "account", "amount", "narration"] as const;
 *   <input
 *     onKeyDown={(e) => {
 *       handleGridArrow(e, {
 *         rowIdx: idx,
 *         field: "amount",
 *         fields: FIELDS,
 *         rowsLength: rows.length,
 *         focusCell,
 *       });
 *       // (existing Enter handler continues to run because we don't stop propagation)
 *     }}
 *   />
 *
 * Safe to combine with an existing onKeyDown that handles Enter — this helper
 * only calls preventDefault() when it consumes an arrow key.
 */
export interface GridArrowCtx<F extends string = string> {
  /** Current row index (0-based). */
  rowIdx: number;
  /** Current column / field key. */
  field: F;
  /** Ordered list of column / field keys — determines ← / → order. */
  fields: readonly F[];
  /** Total row count in the grid. */
  rowsLength: number;
  /** Page's own focusCell(row, field) helper. */
  focusCell: (rowIdx: number, field: F) => void;
}

export function handleGridArrow<F extends string>(
  e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ctx: GridArrowCtx<F>
): boolean {
  const key = e.key;
  if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight") {
    return false;
  }

  // ArrowLeft/Right cursor-edge detection. Select elements report null
  // selectionStart — treat them as at both edges so arrows always nav.
  const target = e.currentTarget as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  const isInputLike = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
  let pos = 0;
  let len = 0;
  if (isInputLike) {
    const el = target as HTMLInputElement | HTMLTextAreaElement;
    pos = el.selectionStart ?? 0;
    len = (el.value ?? "").length;
  }
  // For select, pos=0 and len=0, so ← / → will always jump — good.

  const fieldIdx = ctx.fields.indexOf(ctx.field);
  if (fieldIdx < 0) return false;

  if (key === "ArrowUp") {
    if (ctx.rowIdx > 0) {
      e.preventDefault();
      ctx.focusCell(ctx.rowIdx - 1, ctx.field);
      return true;
    }
    return false;
  }
  if (key === "ArrowDown") {
    if (ctx.rowIdx < ctx.rowsLength - 1) {
      e.preventDefault();
      ctx.focusCell(ctx.rowIdx + 1, ctx.field);
      return true;
    }
    return false;
  }
  if (key === "ArrowLeft") {
    // Only jump left when cursor is at start of value; otherwise let the
    // browser move the cursor inside the text.
    if (pos === 0 && fieldIdx > 0) {
      e.preventDefault();
      ctx.focusCell(ctx.rowIdx, ctx.fields[fieldIdx - 1]);
      return true;
    }
    return false;
  }
  if (key === "ArrowRight") {
    if (pos === len && fieldIdx < ctx.fields.length - 1) {
      e.preventDefault();
      ctx.focusCell(ctx.rowIdx, ctx.fields[fieldIdx + 1]);
      return true;
    }
    return false;
  }
  return false;
}
