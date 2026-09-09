import { useEffect, useRef } from "react";
import { FKEY_EVENTS } from "./useGlobalShortcuts";

interface FormShortcutOptions {
  /** F2 / F9 — called when user presses Save or Submit.
   *  If omitted, the hook auto-clicks the first [type="submit"] button in the DOM. */
  onSave?: () => void;
  /** F8 — called when user presses Delete/Remove. */
  onDelete?: () => void;
  /**
   * Auto-focus the input with this `name=""` attribute on mount. Matches the
   * Busy "cursor is always ready" convention so operators can start typing
   * immediately (e.g. `autoFocusField: "date"` on voucher Add pages).
   *
   * All accounts Add/Edit pages should pass this so first-field focus is
   * centralised — future tweaks (delay tuning, retry-until-mounted, etc.)
   * live in ONE place instead of dozens of per-page useEffects.
   */
  autoFocusField?: string;
}

/**
 * useFormShortcuts
 *
 * Drop this into ANY Create / Edit form page. It listens for the window-level
 * CustomEvents fired by useGlobalShortcuts and routes them to the form's own
 * handlers.
 *
 * Usage (minimum):
 *   useFormShortcuts({});          // F2 auto-clicks the submit button
 *
 * Usage (with delete):
 *   useFormShortcuts({ onDelete: () => setShowDeleteModal(true) });
 *
 * Usage (with custom save):
 *   useFormShortcuts({ onSave: handleSave });
 */
export function useFormShortcuts({ onSave, onDelete, autoFocusField }: FormShortcutOptions = {}) {
  // Keep stable refs so event listeners never become stale
  const onSaveRef   = useRef(onSave);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => { onSaveRef.current   = onSave;   }, [onSave]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

  // Auto-focus the first field on mount. Uses two rAFs so date-picker /
  // select components that mount their inner <input> a beat late (after
  // their own initial render commit) still get focused correctly. Ignored
  // if the caller didn't ask for it — pages keep total control.
  useEffect(() => {
    if (!autoFocusField) return;
    let cancelled = false;
    const focus = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLInputElement>(
        `input[name="${autoFocusField}"]:not([disabled])`
      );
      if (el) {
        el.focus();
        // Select existing text so the operator can overwrite immediately.
        try { el.select(); } catch { /* not a text input */ }
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(focus));
    return () => { cancelled = true; };
  }, [autoFocusField]);

  useEffect(() => {
    // F2 / F9 → Save / Submit
    const handleSave = () => {
      if (onSaveRef.current) {
        onSaveRef.current();
      } else {
        // Fallback: click the first visible submit button on the page
        const btn = document.querySelector<HTMLButtonElement>(
          "button[type='submit']:not([disabled]), [data-submit-btn]:not([disabled])"
        );
        btn?.click();
      }
    };

    // F8 → Delete
    const handleDelete = () => {
      onDeleteRef.current?.();
    };

    window.addEventListener(FKEY_EVENTS.SAVE,   handleSave);
    window.addEventListener(FKEY_EVENTS.SUBMIT, handleSave);   // F9 = same as F2 on forms
    window.addEventListener(FKEY_EVENTS.DELETE, handleDelete);

    return () => {
      window.removeEventListener(FKEY_EVENTS.SAVE,   handleSave);
      window.removeEventListener(FKEY_EVENTS.SUBMIT, handleSave);
      window.removeEventListener(FKEY_EVENTS.DELETE, handleDelete);
    };
  }, []); // empty — refs are always current
}
