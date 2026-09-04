import React, { useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  SHORTCUTS, CATEGORY_LABELS, CATEGORY_ORDER,
  type ShortcutCategory,
} from "../../../config/shortcuts";
import { usePermission } from "../../../hooks/usePermission";
import { FaKeyboard, FaChevronRight, FaChevronLeft, FaCalculator } from "react-icons/fa";

interface ShortcutPanelProps {
  activeKey: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onOpenCalculator: () => void;
}

const CATEGORY_ACCENT: Record<ShortcutCategory, { badge: string; header: string }> = {
  nav:     {
    badge: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/50",
    header: "text-amber-700 dark:text-amber-400",
  },
  system:  {
    badge: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700/50",
    header: "text-rose-700 dark:text-rose-400",
  },
  create:  {
    badge: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/50",
    header: "text-emerald-700 dark:text-emerald-400",
  },
  reports: {
    badge: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-700/50",
    header: "text-sky-700 dark:text-sky-400",
  },
  ctrl:    {
    badge: "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/70 dark:text-violet-300 dark:border-violet-700/50",
    header: "text-violet-700 dark:text-violet-400",
  },
};

/* Single shortcut row — ultra compact & perfectly aligned */
const ShortcutRow = ({
  sc, isActive, globalIdx, focusedIndexRef, onClickFn,
}: {
  sc: (typeof SHORTCUTS)[number];
  isActive: boolean;
  globalIdx: number;
  focusedIndexRef: { current: number };
  onClickFn: (sc: (typeof SHORTCUTS)[number]) => void;
}) => {
  const accent = CATEGORY_ACCENT[sc.category];
  return (
    <button
      data-shortcut-btn
      data-idx={globalIdx}
      type="button"
      onClick={() => onClickFn(sc)}
      onFocus={() => { focusedIndexRef.current = globalIdx; }}
      className={`
        w-full flex items-center gap-2 px-1.5 py-[3px] text-left
        cursor-pointer transition-all duration-100 outline-none rounded
        focus-visible:bg-indigo-100 dark:focus-visible:bg-indigo-900/40
        ${isActive
          ? "bg-indigo-100/80 text-indigo-900 dark:bg-indigo-500/25 dark:text-indigo-100"
          : "hover:bg-slate-100/90 dark:hover:bg-white/[0.04]"
        }
      `}
    >
      <span className={`
        inline-flex items-center justify-center shrink-0
        w-[64px] min-w-[64px] px-1 py-[2px] rounded text-[7.5px]
        font-extrabold font-mono tracking-tight border text-center whitespace-nowrap
        transition-all duration-100
        ${isActive
          ? "bg-indigo-600 text-white border-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)] scale-[1.02]"
          : accent.badge
        }
      `}>
        {sc.keyLabel}
      </span>
      <span className={`text-[10px] leading-tight truncate flex-1 ${
        isActive
          ? "text-indigo-900 dark:text-indigo-100 font-bold"
          : "text-slate-700 dark:text-slate-300 font-medium"
      }`}>
        {sc.label}
      </span>
    </button>
  );
};

const ShortcutPanel: React.FC<ShortcutPanelProps> = ({
  activeKey, isOpen, onToggle, onOpenCalculator,
}) => {
  const navigate        = useNavigate();
  const panelRef        = useRef<HTMLDivElement>(null);
  const focusedIndexRef = useRef<number>(-1);
  const { can, isSuperAdmin } = usePermission();

  // Filter shortcuts by permission — hide entries the current user cannot access.
  // Shortcuts without a `permission` field are always visible (system / nav keys).
  const visibleShortcuts = useMemo(
    () => SHORTCUTS.filter((s) => !s.permission || isSuperAdmin || can(s.permission)),
    [can, isSuperAdmin]
  );

  const allItems = useMemo(
    () => CATEGORY_ORDER.flatMap((cat) => visibleShortcuts.filter((s) => s.category === cat)),
    [visibleShortcuts]
  );

  const handleClick = useCallback((sc: (typeof SHORTCUTS)[number]) => {
    if (sc.route)                     { navigate(sc.route);                                        return; }
    if (sc.action === "back")         { navigate(-1);                                              return; }
    if (sc.action === "dashboard")    { navigate("/dashboard");                                    return; }
    if (sc.action === "toggle-panel") { onToggle();                                                return; }
    if (sc.action === "calculator")   { onOpenCalculator();                                        return; }
    if (sc.action === "help")         { navigate("/help");                                         return; }
    if (sc.action === "reports")      { navigate("/reports/sales");                                return; }
    if (sc.action === "print")        { window.print();                                            return; }
    if (sc.action === "fullscreen")   {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen().catch(() => {});
      return;
    }
    // F-key events — dispatch so active form/page handles them
    if (sc.action === "save")        { window.dispatchEvent(new CustomEvent("fkey-save"));        return; }
    if (sc.action === "submit")      { window.dispatchEvent(new CustomEvent("fkey-submit"));      return; }
    if (sc.action === "delete")      { window.dispatchEvent(new CustomEvent("fkey-delete"));      return; }
    if (sc.action === "refresh")     { window.dispatchEvent(new CustomEvent("fkey-refresh"));     return; }
    if (sc.action === "new")         { window.dispatchEvent(new CustomEvent("fkey-new"));         return; }
    if (sc.action === "export")      { window.dispatchEvent(new CustomEvent("fkey-export"));      return; }
    if (sc.action === "search")      {
      document.querySelector<HTMLElement>("[data-search-input]")?.focus();
      return;
    }
    // Navigation menu actions
    if (sc.action === "open-admin")   { window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Administration" } })); return; }
    if (sc.action === "open-trans")   { window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Transactions" } }));   return; }
    if (sc.action === "open-display") { window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Display" } }));        return; }
    if (sc.action === "open-payroll") { window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Payroll" } }));        return; }
  }, [navigate, onToggle, onOpenCalculator]);

  return (
    <div
      className={`relative flex flex-row h-full shrink-0 transition-all duration-300 ease-in-out ${
        isOpen ? "w-[240px]" : "w-[28px]"
      }`}
      style={{ zIndex: 30 }}
    >
      {/* ── Pull-tab ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        title={isOpen ? "Close Shortcuts  F1" : "Open Shortcuts  F1"}
        className={`
          flex items-center justify-center w-[28px] shrink-0 h-full
          cursor-pointer select-none transition-all duration-200
          border-l border-slate-200 dark:border-line-soft
          bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900
          dark:bg-[#131b2e] dark:hover:bg-indigo-950/90 dark:text-indigo-300 dark:hover:text-white
        `}
      >
        <span className="flex flex-col items-center gap-1">
          <FaKeyboard className="text-[10px]" />
          <span
            className="text-[7px] font-extrabold uppercase"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: "0.12em" }}
          >
            Shortcuts
          </span>
          {isOpen
            ? <FaChevronRight className="text-[7px]" />
            : <FaChevronLeft  className="text-[7px]" />
          }
        </span>
      </button>

      {/* ── Panel body ───────────────────────────────────────── */}
      <div
        ref={panelRef}
        className={`
          flex-1 bg-white dark:bg-[#131b2e] border-l border-slate-200 dark:border-line-soft
          flex flex-col overflow-hidden shadow-xl dark:shadow-none
          transition-all duration-300 ease-in-out
          ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none w-0"}
        `}
        style={{ minWidth: isOpen ? 212 : 0 }}
      >
        {/* Header */}
        <div className="px-2.5 py-1.5 border-b border-slate-200 dark:border-white/10 flex items-center gap-1.5 shrink-0 bg-slate-50 dark:bg-[#0f172a]">
          <FaKeyboard className="text-indigo-600 dark:text-indigo-400 text-[11px] shrink-0" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
            Shortcut Keys
          </span>
          <span className="ml-auto text-[8px] font-bold text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-1">
            F1
          </span>
        </div>

        {/* Sections — scrollable but scrollbar hidden */}
        <div
          className="flex-1 flex flex-col min-h-0 overflow-y-auto px-1.5 py-1 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >

          {CATEGORY_ORDER.map((cat) => {
            const items  = visibleShortcuts.filter((s) => s.category === cat);
            if (!items.length) return null;
            const accent = CATEGORY_ACCENT[cat];

            return (
              <div key={cat} className="shrink-0 mb-1">
                {/* Section label */}
                <div className="px-1.5 pt-1.5 pb-0.5 flex items-center justify-between">
                  <span className={`text-[8px] font-black uppercase tracking-widest ${accent.header}`}>
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="text-[7.5px] text-slate-400 dark:text-slate-500 font-mono font-semibold">
                    {items.length}
                  </span>
                </div>

                <div className="flex flex-col gap-[1px]">
                  {items.map((sc) => {
                    const globalIdx = allItems.findIndex((x) => x.id === sc.id);
                    return (
                      <ShortcutRow
                        key={sc.id}
                        sc={sc}
                        isActive={activeKey === sc.keyLabel}
                        globalIdx={globalIdx}
                        focusedIndexRef={focusedIndexRef}
                        onClickFn={handleClick}
                      />
                    );
                  })}
                </div>

                {/* Thin divider */}
                <div className="mx-1 mt-1 border-t border-slate-100 dark:border-white/[0.05]" />
              </div>
            );
          })}

          {/* Footer: calculator button */}
          <div className="mt-auto pt-1 px-1 flex flex-col gap-1 pb-1">
            <button
              type="button"
              onClick={onOpenCalculator}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:border-slate-700/60 transition-colors cursor-pointer group shadow-2xs dark:shadow-none"
            >
              <div className="flex items-center gap-2">
                <FaCalculator className="text-[11px] text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="text-[11px] font-bold text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white">
                  Calculator
                </span>
              </div>
              <span className="text-[9px] font-black text-amber-800 bg-amber-100 border border-amber-300 dark:text-amber-400/90 dark:bg-amber-500/10 dark:border-amber-500/20 px-1.5 py-0.5 rounded font-mono">
                Alt+C
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShortcutPanel;
