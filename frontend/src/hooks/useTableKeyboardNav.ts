import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * useTableKeyboardNav
 *
 * Keyboard navigation for list/table pages.
 *
 * - Auto-focuses the container when data first loads.
 * - ArrowDown / ArrowUp → move the highlighted row.
 * - Enter               → calls onEnter(focusedIndex).
 *
 * Uses a WINDOW-level keydown listener (not an onKeyDown prop) so arrow keys
 * work whenever ANY element inside the container has focus — including action
 * buttons, the container div itself, or anything else that becomes focused by
 * a click. This means you do NOT need to put onKeyDown on the wrapper div.
 *
 * Usage:
 *   const tableRef = useRef<HTMLDivElement>(null);
 *   const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
 *     count: customers.length,
 *     onEnter: (i) => handleView(customers[i]),
 *     containerRef: tableRef,
 *   });
 *   <div ref={tableRef} tabIndex={0} data-table-nav className="outline-none">
 *     <DataTable
 *       rowClassName={(_, i) => i === focusedIndex ? "ring-1 ring-inset ring-accent/40 bg-accent/5" : ""}
 *       onRowClick={(row, i) => { setFocusedIndex(i); tableRef.current?.focus({ preventScroll: true }); }}
 *       ...
 *     />
 *   </div>
 */
interface UseTableKeyboardNavOptions {
  count: number;
  /** Enter key → typically opens a View/detail action */
  onEnter: (index: number) => void;
  /** E key → typically opens the Edit action */
  onEdit?: (index: number) => void;
  containerRef: RefObject<HTMLElement | null>;
}

export function useTableKeyboardNav({
  count,
  onEnter,
  onEdit,
  containerRef,
}: UseTableKeyboardNavOptions) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Stable refs so the window listener never goes stale
  const focusedIndexRef = useRef(focusedIndex);
  useEffect(() => { focusedIndexRef.current = focusedIndex; }, [focusedIndex]);

  const countRef = useRef(count);
  useEffect(() => { countRef.current = count; }, [count]);

  const onEnterRef = useRef(onEnter);
  useEffect(() => { onEnterRef.current = onEnter; }, [onEnter]);

  const onEditRef = useRef(onEdit);
  useEffect(() => { onEditRef.current = onEdit; }, [onEdit]);

  // Reset to first row when dataset changes (search, filter, page turn)
  useEffect(() => {
    setFocusedIndex(0);
  }, [count]);

  // Auto-focus the container when data loads so arrow keys work immediately
  useEffect(() => {
    if (count === 0) return;
    const timer = setTimeout(() => {
      containerRef.current?.focus({ preventScroll: true });
    }, 250);
    return () => clearTimeout(timer);
  }, [count, containerRef]);

  // Scroll the highlighted row into view
  useEffect(() => {
    if (!containerRef.current || count === 0) return;
    const targetRow = containerRef.current.querySelector<HTMLElement>(`[data-nav-index="${focusedIndex}"]`);
    if (targetRow) {
      targetRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
    // DataTable: first [role="row"] is the header, data rows start at index 1
    const rows = containerRef.current.querySelectorAll<HTMLElement>('[role="row"]');
    rows[focusedIndex + 1]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIndex, count, containerRef]);

  // Window-level keydown listener.
  // Activates when focus is ON or INSIDE the container — so clicking any
  // child element (button, cell div, etc.) still enables arrow-key navigation.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      if (countRef.current === 0) return;
      if (!["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;

      // Only act when focus is within the table container
      // If a dropdown portal is open, let it handle arrow keys
      if (document.querySelector("[data-select-portal]")) return;

      const active = document.activeElement;
      const inside =
        active === containerRef.current ||
        containerRef.current.contains(active);
      if (!inside) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.key === "ArrowDown") {
        setFocusedIndex((prev) => Math.min(prev + 1, countRef.current - 1));
      } else if (e.key === "ArrowUp") {
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        onEnterRef.current(focusedIndexRef.current);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [containerRef]);

  return { focusedIndex, setFocusedIndex };
}
