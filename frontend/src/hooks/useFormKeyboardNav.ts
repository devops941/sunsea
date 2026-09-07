import { useCallback, useEffect, type RefObject } from "react";

/**
 * useFormKeyboardNav
 *
 * Adds keyboard navigation to any form container.
 *
 * - Auto-focuses the first navigable field on mount.
 * - ArrowDown / ArrowUp  → move to the field directly below / above in the grid
 *   (position-aware: prefers same column, falls back to nearest).
 * - ArrowRight           → next field (also works at the end of a text input).
 * - ArrowLeft            → previous field (also works at the start of a text input).
 * - Enter                → next field across all inputs, date pickers, time pickers, and selects.
 *
 * Mark every focusable form-field trigger with the `data-nav` attribute so the
 * hook can discover them (TextInput, SelectInput, CreatableSelectInput, PhoneInput,
 * DatePickerCalendar, TimePickerInput, QuantityInput, etc.).
 *
 * Child components that manage their own arrow-key / enter behaviour (e.g. SelectInput
 * dropdown navigation, TimePicker popup, DatePicker calendar) call e.preventDefault()
 * or e.stopPropagation() before the event bubbles up to the form's onKeyDown, so
 * those keys are automatically handled by the open component.
 *
 * Usage:
 *   const formRef = useRef<HTMLFormElement>(null);
 *   const handleFormKeyDown = useFormKeyboardNav(formRef);
 *   <form ref={formRef} onKeyDown={handleFormKeyDown} ...>
 */
export function useFormKeyboardNav(
  containerRef: RefObject<HTMLElement | null>
): React.KeyboardEventHandler<HTMLElement> {
  // ── Auto-focus first field on mount ──────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const defaultEl = containerRef.current.querySelector<HTMLElement>(
        "[data-nav-default]:not([disabled]), [autofocus]:not([disabled])"
      );
      const first = defaultEl || containerRef.current.querySelector<HTMLElement>(
        "[data-nav]:not([disabled])"
      );
      first?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, [containerRef]);

  // ── Position-aware neighbour lookup ──────────────────────────────────────
  const getNeighbor = useCallback(
    (
      fields: HTMLElement[],
      currentIdx: number,
      dir: "up" | "down"
    ): number => {
      const current = fields[currentIdx];
      const rect = current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rowH = Math.max(rect.height, 32); // guard against zero height

      let bestIdx = -1;
      let bestScore = Infinity;

      fields.forEach((field, i) => {
        if (i === currentIdx) return;
        const r = field.getBoundingClientRect();
        const fx = r.left + r.width / 2;
        const fy = r.top + r.height / 2;

        // Must be strictly in the target direction
        if (dir === "down" && fy < cy + rowH * 0.5) return;
        if (dir === "up" && fy > cy - rowH * 0.5) return;

        // Weight horizontal distance heavily so same-column fields score best
        const xDist = Math.abs(fx - cx);
        const yDist = Math.abs(fy - cy);
        const score = xDist * 2.5 + yDist;

        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      });

      return bestIdx === -1 ? currentIdx : bestIdx;
    },
    []
  );

  // ── Keyboard handler (returned and attached to <form onKeyDown={...}>) ───
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // Child components (SelectInput, CreatableSelectInput, DatePicker, TimePicker, etc.)
      // call e.preventDefault() for their own key handling. When that has
      // already happened we leave the event alone.
      if (e.defaultPrevented) return;

      const { key } = e;

      if (
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(
          key
        )
      )
        return;

      if (!containerRef.current) return;

      const rawActive = document.activeElement as HTMLElement | null;
      if (!rawActive) return;

      // If active element is inside a table that manages its own keyboard navigation, ignore
      if (rawActive.closest("[data-r][data-c]") || rawActive.closest("[data-busy-table]")) {
        return;
      }

      const fields = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>("[data-nav], [data-busy-first='true']")
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          !(el as HTMLInputElement).disabled &&
          el.offsetParent !== null &&
          (!el.closest("[data-busy-table]") || Boolean(el.closest("[data-r='0'][data-c='0']")) || el.getAttribute("data-busy-first") === "true" || Boolean(el.closest("[data-busy-first='true']")))
      );

      // Find the navigable element matching or containing activeElement
      const active = (rawActive.closest("[data-nav]") as HTMLElement) || (rawActive.closest("[data-busy-first='true']") as HTMLElement) || rawActive;
      const idx = fields.indexOf(active);
      if (idx === -1) return;

      // For textarea: allow regular Enter or Shift+Enter for newlines unless explicitly desired
      if (active instanceof HTMLTextAreaElement && key === "Enter" && !e.ctrlKey) {
        return;
      }

      // For text-type inputs: let ArrowLeft / ArrowRight move the cursor
      // within the text unless the cursor is already at the boundary.
      if (
        (key === "ArrowLeft" || key === "ArrowRight") &&
        active instanceof HTMLInputElement &&
        active.type === "text"
      ) {
        const { selectionStart, selectionEnd, value } = active;
        // If there is a text selection, don't navigate — let browser collapse it
        if (selectionStart !== selectionEnd) return;
        if (key === "ArrowRight" && selectionStart !== value.length) return;
        if (key === "ArrowLeft" && selectionStart !== 0) return;
      }

      let nextIdx = idx;

      switch (key) {
        case "ArrowDown":
          nextIdx = getNeighbor(fields, idx, "down");
          // Fall back to simple next if no downward neighbour found
          if (nextIdx === idx) nextIdx = Math.min(idx + 1, fields.length - 1);
          break;
        case "ArrowUp":
          nextIdx = getNeighbor(fields, idx, "up");
          if (nextIdx === idx) nextIdx = Math.max(idx - 1, 0);
          break;
        case "ArrowRight":
          nextIdx = Math.min(idx + 1, fields.length - 1);
          break;
        case "ArrowLeft":
          nextIdx = Math.max(idx - 1, 0);
          break;
        case "Enter":
          // Move to next field on Enter across all navigable fields
          nextIdx = Math.min(idx + 1, fields.length - 1);
          break;
      }

      if (nextIdx !== idx) {
        e.preventDefault();
        const target = fields[nextIdx];
        if (target.hasAttribute("data-busy-first") || target.getAttribute("data-busy-first") === "true" || target.closest("[data-busy-first='true']") || target.closest("[data-busy-table]")) {
          const innerInput = target.querySelector("input:not([disabled]), [tabindex]:not([tabindex='-1'])") as HTMLElement | null;
          if (innerInput) {
            innerInput.focus();
            if (innerInput instanceof HTMLInputElement && innerInput.type !== "button") {
              setTimeout(() => {
                try { innerInput.select(); } catch {}
              }, 0);
            }
            return;
          }
          const table = target.closest("[data-busy-table]");
          const firstEditable = table?.querySelector('[data-r="0"] input:not([disabled]), [data-r="0"] [tabindex]:not([tabindex=\'-1\'])') as HTMLElement | null;
          if (firstEditable) {
            firstEditable.focus();
            if (firstEditable instanceof HTMLInputElement && firstEditable.type !== "button") {
              setTimeout(() => {
                try { firstEditable.select(); } catch {}
              }, 0);
            }
            return;
          }
        }
        target.focus();
        // Select existing text in text inputs so the user can overwrite it immediately
        if (target instanceof HTMLInputElement && target.type !== "button") {
          setTimeout(() => {
            try {
              target.select();
            } catch {}
          }, 0);
        }
      } else if (key === "Enter") {
        // Already at the last field — still prevent accidental form submit
        e.preventDefault();
      }
    },
    [containerRef, getNeighbor]
  );

  return handleKeyDown;
}

