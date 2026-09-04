import { useEffect, useRef } from "react";
import { FKEY_EVENTS } from "./useGlobalShortcuts";

interface FormShortcutOptions {
  /** F2 / F9 — called when user presses Save or Submit.
   *  If omitted, the hook auto-clicks the first [type="submit"] button in the DOM. */
  onSave?: () => void;
  /** F8 — called when user presses Delete/Remove. */
  onDelete?: () => void;
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
export function useFormShortcuts({ onSave, onDelete }: FormShortcutOptions = {}) {
  // Keep stable refs so event listeners never become stale
  const onSaveRef   = useRef(onSave);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => { onSaveRef.current   = onSave;   }, [onSave]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

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
