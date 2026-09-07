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
    badge: "bg-transparent text-amber-700 dark:text-amber-400 border border-amber-400/80 dark:border-amber-500/60",
    header: "text-amber-700 dark:text-amber-400",
  },
  system:  {
    badge: "bg-transparent text-rose-700 dark:text-rose-400 border border-rose-400/80 dark:border-rose-500/60",
    header: "text-rose-700 dark:text-rose-400",
  },
  create:  {
    badge: "bg-transparent text-emerald-700 dark:text-emerald-400 border border-emerald-400/80 dark:border-emerald-500/60",
    header: "text-emerald-700 dark:text-emerald-400",
  },
  reports: {
    badge: "bg-transparent text-sky-700 dark:text-sky-400 border border-sky-400/80 dark:border-sky-500/60",
    header: "text-sky-700 dark:text-sky-400",
  },
  ctrl:    {
    badge: "bg-transparent text-violet-700 dark:text-violet-400 border border-violet-400/80 dark:border-violet-500/60",
    header: "text-violet-700 dark:text-violet-400",
  },
};

/* Single shortcut row — clean, readable & perfectly aligned */
const ShortcutRow = ({
  sc, globalIdx, focusedIndexRef, onClickFn,
}: {
  sc: (typeof SHORTCUTS)[number];
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
      onClick={(e) => {
        e.currentTarget.blur();
        onClickFn(sc);
      }}
      onFocus={() => { focusedIndexRef.current = globalIdx; }}
      className="w-full flex items-center gap-2 px-2 py-1 text-left cursor-pointer transition-colors duration-100 outline-none rounded-md hover:bg-slate-100/90 dark:hover:bg-white/[0.04] focus:outline-none"
    >
      <span className={`inline-flex items-center justify-center shrink-0 w-[84px] min-w-[84px] px-1 py-[3px] rounded-md text-[9.5px] font-bold font-mono tracking-tight text-center whitespace-nowrap transition-colors duration-100 ${accent.badge}`}>
        {sc.keyLabel}
      </span>
      <span className="text-[11.5px] leading-tight truncate flex-1 text-slate-800 dark:text-slate-200 font-semibold">
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
    if (sc.action === "edit")        { window.dispatchEvent(new CustomEvent("fkey-edit"));        return; }
    if (sc.action === "export")      { window.dispatchEvent(new CustomEvent("fkey-export"));      return; }
    if (sc.action === "search")      {
      document.querySelector<HTMLElement>("[data-search-input]")?.focus();
      return;
    }
    // Navigation menu actions (toggle open/close)
    if (sc.action === "open-admin")      { window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Administration" } })); return; }
    if (sc.action === "open-trans")      { window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Transactions" } }));   return; }
    if (sc.action === "open-production") { window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Production" } }));     return; }
    if (sc.action === "open-inventory")  { window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Inventory" } }));      return; }
    if (sc.action === "open-display")    { window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Display" } }));        return; }
    if (sc.action === "open-payroll")    { window.dispatchEvent(new CustomEvent("nav-open-menu", { detail: { menuTitle: "Payroll" } }));        return; }
  }, [navigate, onToggle, onOpenCalculator]);

  return (
    <div
      data-shortcut-panel
      className={`relative flex flex-row h-full shrink-0 transition-all duration-300 ease-in-out ${
        isOpen ? "w-[275px]" : "w-[28px]"
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
        style={{ minWidth: isOpen ? 232 : 0 }}
      >
        {/* Header */}
        <div className="px-2.5 py-1.5 border-b border-slate-200 dark:border-white/10 flex items-center gap-1.5 shrink-0 bg-slate-50 dark:bg-[#0f172a]">
          <FaKeyboard className="text-indigo-600 dark:text-indigo-400 text-[11px] shrink-0" />
          <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
            Shortcut Keys
          </span>
          <span className="ml-auto text-[9px] font-bold text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 bg-transparent rounded px-1.5 py-0.5">
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
                <div className="px-2 pt-1.5 pb-0.5 flex items-center justify-between">
                  <span className={`text-[9.5px] font-black uppercase tracking-wider ${accent.header}`}>
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-mono font-semibold">
                    {items.length}
                  </span>
                </div>

                <div className="flex flex-col gap-[2px]">
                  {items.map((sc) => {
                    const globalIdx = allItems.findIndex((x) => x.id === sc.id);
                    return (
                      <ShortcutRow
                        key={sc.id}
                        sc={sc}
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
          <div className="mt-auto pt-1.5 px-1 flex flex-col gap-1 pb-1">
            <button
              type="button"
              onClick={onOpenCalculator}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:border-slate-700/60 transition-colors cursor-pointer group shadow-2xs dark:shadow-none"
            >
              <div className="flex items-center gap-2">
                <FaCalculator className="text-[12px] text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="text-[11.5px] font-bold text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white">
                  Calculator
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-700 border border-amber-400/80 dark:text-amber-400 dark:border-amber-500/60 bg-transparent px-2 py-0.5 rounded-md font-mono">
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
