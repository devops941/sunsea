import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SHORTCUTS } from "../config/shortcuts";
import { usePermission } from "./usePermission";

// ── Custom event names fired by F-keys ───────────────────────────────────────
// Any component can listen:  window.addEventListener('fkey-save', handler)
export const FKEY_EVENTS = {
  SAVE:       "fkey-save",       // F2  — forms listen → submit
  OPEN:       "fkey-open",       // F4  — selects/dropdowns listen → open
  REFRESH:    "fkey-refresh",    // F5  — list pages listen → reload data
  NEXT_FIELD: "fkey-next-field", // F6  — focus next focusable element
  DELETE:     "fkey-delete",     // F8  — forms/lists listen → delete
  SUBMIT:     "fkey-submit",     // F9  — forms listen → confirm submit
  NEW:        "fkey-new",        // Ins — list pages listen → open create form
  EXPORT:     "fkey-export",     // Ctrl+Shift+E — list/report pages listen → export
} as const;

/** Dispatch a named fkey event on window */
export const dispatchFKey = (name: string) =>
  window.dispatchEvent(new CustomEvent(name));

interface UseGlobalShortcutsOptions {
  onTogglePanel: () => void;
  onOpenCalculator: () => void;
  onToggleSidebar?: () => void;
}

/**
 * Global keyboard shortcut handler for Sunsea ERP.
 *
 * Priority:
 *  1. F1–F12  → Tally-style function keys
 *  2. Ctrl+Home → dashboard
 *  3. Ctrl+key  → any shortcut with ctrl:true (create + ctrl categories)
 *  4. ESC       → smart back navigation
 *  5. Plain letter → reports shortcuts (B, T, A, L, S, P)
 *
 * Guard: skips when focus is inside input / textarea / select / contenteditable.
 */
export function useGlobalShortcuts({
  onTogglePanel,
  onOpenCalculator,
  onToggleSidebar,
}: UseGlobalShortcutsOptions) {
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { can, isSuperAdmin } = usePermission();

  // Only keep shortcuts the current user is allowed to use.
  // Shortcuts without a permission field are always available.
  const allowedShortcuts = useMemo(
    () => SHORTCUTS.filter((s) => !s.permission || isSuperAdmin || can(s.permission)),
    [can, isSuperAdmin]
  );

  const flash = useCallback((label: string) => {
    setActiveKey(label);
    setTimeout(() => setActiveKey(null), 350);
  }, []);

  useEffect(() => {
    // Attempt to lock reserved browser keys if supported (e.g. Chrome full-screen / PWA)
    const lockKeys = async () => {
      try {
        if ("keyboard" in navigator && (navigator as any).keyboard?.lock) {
          await (navigator as any).keyboard.lock(["KeyT", "KeyW", "KeyN", "KeyA", "KeyD"]);
        }
      } catch (_) {}
    };
    lockKeys();
    window.addEventListener("click", lockKeys, { once: true });
    return () => {
      window.removeEventListener("click", lockKeys);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      const key = e.key;
      const lowerKey = key ? key.toLowerCase() : "";
      const isCtrl      = e.ctrlKey && !e.altKey && !e.shiftKey;
      const isCtrlShift = e.ctrlKey && !e.altKey && e.shiftKey;
      const isAlt       = e.altKey  && !e.ctrlKey && !e.shiftKey;

      // ── Alt+C Calculator (Tally-style — works even inside form fields) ────
      if (isAlt && (lowerKey === "c" || e.code === "KeyC")) {
        e.preventDefault();
        e.stopPropagation();
        flash("Alt+C");
        onOpenCalculator();
        return;
      }

      // ── Alt+N Add Account / Chart of Accounts (works even inside form fields) ──
      if (isAlt && (lowerKey === "n" || e.code === "KeyN")) {
        e.preventDefault();
        e.stopPropagation();
        flash("Alt+N");
        navigate("/accounts/chart-of-accounts");
        return;
      }

      // ── Ctrl+Shift+E Export (works even inside form fields) ─────────────────
      if (isCtrlShift && (lowerKey === "e" || e.code === "KeyE")) {
        e.preventDefault();
        e.stopPropagation();
        flash("Ctrl+Shift+E");
        dispatchFKey(FKEY_EVENTS.EXPORT);
        return;
      }

      // ── Alt+H / Ctrl+H / Ctrl+Home Dashboard (works even inside form fields) ──
      if (
        (isAlt && (lowerKey === "h" || e.code === "KeyH")) ||
        (isCtrl && (lowerKey === "h" || key === "Home"))
      ) {
        e.preventDefault();
        e.stopPropagation();
        flash("Dashboard");
        navigate("/dashboard");
        return;
      }

      // ── Insert key — New Record (works even inside fields) ──────────────
      if (key === "Insert") {
        e.preventDefault();
        e.stopPropagation();
        flash("Ins");
        dispatchFKey(FKEY_EVENTS.NEW);
        return;
      }

      // ── F1–F11  (Tally-style — allowed even inside fields; F12 left to browser) ─
      if (key.startsWith("F") && key.length <= 3) {
        const fNum = parseInt(key.slice(1), 10);
        if (fNum >= 1 && fNum <= 11) {
          e.preventDefault();
          flash(key);

          switch (key) {
            // F1  Toggle Sidebar / Shortcut Panel Open & Close
            case "F1":
              if (onToggleSidebar) {
                onToggleSidebar();
              } else {
                onTogglePanel();
              }
              break;

            // F2  Save — tell any active form to save
            case "F2":
              dispatchFKey(FKEY_EVENTS.SAVE);
              break;

            // F3  Search / Find — focus the search input on the current page
            case "F3": {
              const searchEl = document.querySelector<HTMLElement>(
                "[data-search-input], input[placeholder*='earch'], input[placeholder*='ind']"
              );
              searchEl?.focus();
              break;
            }

            // F4  Open / Select — open focused dropdown or trigger its click
            case "F4": {
              dispatchFKey(FKEY_EVENTS.OPEN);
              // Also try clicking the focused element if it's a select/button
              const focused = document.activeElement as HTMLElement | null;
              if (
                focused &&
                (focused.tagName === "SELECT" ||
                  focused.getAttribute("role") === "combobox" ||
                  focused.getAttribute("role") === "listbox" ||
                  focused.getAttribute("data-open-trigger"))
              ) {
                focused.click();
              }
              break;
            }

            // F5  Refresh — reload page data (no browser refresh)
            case "F5":
              dispatchFKey(FKEY_EVENTS.REFRESH);
              break;

            // F6  Next field — focus next focusable element
            case "F6": {
              dispatchFKey(FKEY_EVENTS.NEXT_FIELD);
              const focusable = Array.from(
                document.querySelectorAll<HTMLElement>(
                  "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])"
                )
              ).filter((el) => el.offsetParent !== null);
              const idx = focusable.indexOf(document.activeElement as HTMLElement);
              focusable[idx + 1]?.focus();
              break;
            }

            // F7  Reports
            case "F7":
              navigate("/reports/sales");
              break;

            // F8  Delete / Remove
            case "F8":
              dispatchFKey(FKEY_EVENTS.DELETE);
              break;

            // F9  Submit / Confirm
            case "F9":
              dispatchFKey(FKEY_EVENTS.SUBMIT);
              break;

            // F10  Print
            case "F10":
              window.print();
              break;

            // F11  Full Screen toggle
            case "F11":
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
              break;
          }
          return;
        }
      }

      // ── Top Navigation Menu Shortcuts (Ctrl+ / Alt+ / Shift+ / works globally) ──
      // Transactions (Alt+T / Ctrl+T / Shift+T)
      if (
        ((isCtrl || isAlt) && (lowerKey === "t" || e.code === "KeyT")) ||
        (e.shiftKey && !e.ctrlKey && !e.altKey && !inField && (lowerKey === "t" || e.code === "KeyT"))
      ) {
        e.preventDefault();
        e.stopPropagation();
        flash(isCtrl ? "Ctrl+T" : isAlt ? "Alt+T" : "Shift+T");
        window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Transactions" } }));
        return;
      }

      if (isCtrl || isAlt) {
        // Administration (Ctrl+A / Alt+A)
        if (lowerKey === "a" || e.code === "KeyA") {
          // Inside form fields, allow standard Ctrl+A text selection
          if (inField && isCtrl) {
            // let browser select all text
          } else {
            e.preventDefault();
            e.stopPropagation();
            flash(isCtrl ? "Ctrl+A" : "Alt+A");
            window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Administration" } }));
            return;
          }
        }

        // Display Menu (Alt+D / Ctrl+D)
        if (lowerKey === "d" || e.code === "KeyD") {
          e.preventDefault();
          e.stopPropagation();
          flash(isAlt ? "Alt+D" : "Ctrl+D");
          window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Display" } }));
          return;
        }

        // Payroll (Ctrl+Y / Ctrl+P / Alt+P / Alt+Y)
        if (lowerKey === "y" || e.code === "KeyY" || (lowerKey === "p" && isAlt)) {
          e.preventDefault();
          e.stopPropagation();
          flash(isCtrl ? "Ctrl+Y" : "Alt+P");
          window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Payroll" } }));
          return;
        }
      }

      // Guard: skip plain/ctrl shortcuts when inside form fields
      if (inField) return;

      // ── Plain single letter shortcuts (Tally/Busy style) ───────────────
      // Single key 'D' / 'd' -> Direct Dashboard navigation
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && (lowerKey === "d" || e.code === "KeyD")) {
        e.preventDefault();
        e.stopPropagation();
        flash("D");
        navigate("/dashboard");
        return;
      }

      // ── Other Alt+ or Ctrl+ or Ctrl+Shift+ combinations ───────────────
      if (isCtrl || isAlt || isCtrlShift) {
        const match =
          allowedShortcuts.find(
            (s) =>
              (s.ctrl && !s.shift && isCtrl      && (s.key === lowerKey || s.key === key)) ||
              (s.alt  &&            isAlt         && (s.key === lowerKey || s.key === key)) ||
              (s.ctrl && s.shift  && isCtrlShift  && (s.key === lowerKey || s.key === key))
          );

        if (match?.route) {
          e.preventDefault();
          e.stopPropagation();
          flash(match.keyLabel);
          navigate(match.route);
          return;
        }
        return;
      }

      if (e.altKey || e.metaKey) return;

      // ── ESC  smart back ────────────────────────────────────────────────
      if (key === "Escape") {
        const openDialog = document.querySelector<HTMLElement>(
          "[role='dialog']:not([aria-hidden='true']), [data-radix-popper-content-wrapper]"
        );
        if (openDialog) return;
        flash("Esc");
        navigate(-1);
        return;
      }

      // ── Plain letter  reports shortcuts ────────────────────────────────
      const letterMatch = allowedShortcuts.find(
        (s) => !s.ctrl && s.key === key.toLowerCase() && s.category === "reports"
      );
      if (letterMatch?.route) {
        e.preventDefault();
        e.stopPropagation();
        flash(letterMatch.keyLabel);
        navigate(letterMatch.route);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [navigate, onTogglePanel, onOpenCalculator, flash, allowedShortcuts]);

  return { activeKey };
}
