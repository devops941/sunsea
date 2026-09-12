import { formatDate } from "../../utils/dateUtils";
import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaCoins, FaPlus, FaSync, FaFilter } from "react-icons/fa";
import { toast } from "react-toastify";
import { expenseService, displayExpenseNo, type Expense } from "../../services/expenseService";
import { useListCache } from "../../hooks/useListCache";
import { usePageShortcuts } from "../../hooks/usePageShortcuts";
import DatePickerCalendar from "../../components/ui/DatePickerCalendar/DatePickerCalendar";

// Busy-style filter panel that opens BEFORE the list — same shape as the
// voucher list pages (PaymentVoucherPage / ReceiptVoucherPage / etc.).
interface FilterOptions {
  startDate: string;
  endDate: string;
  showDescription: boolean;
}

const todayIso = () => new Date().toISOString().split("T")[0];

const defaultFilters = (): FilterOptions => ({
  startDate: todayIso(),
  endDate: todayIso(),
  showDescription: true,
});

const ExpenseListPage: React.FC = () => {
  const navigate = useNavigate();

  const [applied, setApplied] = useState<FilterOptions>(() => defaultFilters());
  const [pending, setPending] = useState<FilterOptions>(() => defaultFilters());
  // Filter panel is a proper "screen step" like the Ledger Statement flow.
  // Every fresh visit (Dashboard → Expenses, or Edit → back → Expenses) lands
  // on the panel, then Enter/OK moves to the table. Previous versions cached
  // this in sessionStorage, but that broke the Esc-walk-back chain when the
  // operator came back from an Edit page — they'd land on the table view and
  // Esc would loop back to the same Edit page. Panel-as-first-screen means
  // Esc always has a distinct step to unwind to before leaving the page.
  const [panelOpen, setPanelOpen] = useState<boolean>(true);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  // Modal nav stack — Esc walks: table → panel → navigate away.
  const panelOpenRef = useRef(panelOpen);
  const pendingRef = useRef(pending);
  useEffect(() => { panelOpenRef.current = panelOpen; }, [panelOpen]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2" && panelOpenRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setApplied(pendingRef.current);
        setPanelOpen(false);
        return;
      }
      if (e.key !== "Escape") return;
      // Esc chain (matches Ledger Statement's reverse-nav):
      //   Table view  → open the filter panel with current filters pre-loaded
      //                 (the panel is the previous "step" in the flow).
      //   Panel view  → navigate(-1) back to whichever page came before
      //                 Expenses (usually the Dashboard).
      //
      // Runs regardless of which control has focus. Earlier revisions
      // returned early when the target was INPUT/TEXTAREA/SELECT, but the
      // panel auto-focuses the Starting Date input on open, so that guard
      // trapped Esc and left the operator stranded on the panel.
      e.preventDefault();
      e.stopPropagation();
      if (panelOpenRef.current) {
        navigate(-1);
      } else {
        setPending(applied);
        setPanelOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applied, navigate]);

  // Auto-focus + select the first field when the filter panel opens so the
  // operator can immediately type a new starting date without reaching for
  // the mouse. Runs on every panel-open (not just mount) — reopening from
  // the "Change Filters" button also re-focuses the date input.
  useEffect(() => {
    if (!panelOpen) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('input[name="startDate"]');
      if (el) {
        el.focus();
        el.select?.();
      }
    }, 30);
    return () => clearTimeout(t);
  }, [panelOpen]);

  const cacheKey = `expenses:${applied.startDate}:${applied.endDate}`;

  const fetcher = useCallback(
    async (_signal: AbortSignal) => {
      try {
        const res = await expenseService.fetchAll({
          page: 1,
          limit: 10000,
          startDate: applied.startDate || undefined,
          endDate: applied.endDate || undefined,
        });
        return { data: res.data || [], total: res.total || 0 };
      } catch (err: any) {
        toast.error(err?.message || "Failed to load expenses");
        throw err;
      }
    },
    [applied.startDate, applied.endDate]
  );

  const { data: expenses, total, loading, refreshing, refresh } = useListCache<Expense>({
    cacheKey,
    socketModule: "expense",
    fetcher,
  });
// F5 = refresh (centralised via usePageShortcuts).  usePageShortcuts({ onRefresh: refresh });

  const openExpenseEdit = useCallback(
    (exp: Expense) => {
      navigate(`/expenses/edit/${exp.id}`, { state: { expense: exp } });
    },
    [navigate]
  );

  // Busy-style auto-select first row so Enter immediately opens Modify.
  useEffect(() => {
    if (panelOpen) return;
    if (expenses.length === 0) {
      setSelectedRow(null);
      return;
    }
    if (selectedRow == null || !expenses.some((e) => e.id === selectedRow)) {
      setSelectedRow(expenses[0].id);
    }
  }, [expenses, panelOpen, selectedRow]);

  // Keyboard navigation on the list:
  //   ↑ / ↓ · Home / End · PgUp / PgDn — move highlight
  //   Enter — open Modify (edit) for the selected row
  useEffect(() => {
    if (panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (expenses.length === 0) return;
      const idx = selectedRow != null ? expenses.findIndex((e) => e.id === selectedRow) : -1;

      if (e.key === "Enter" && selectedRow != null) {
        const exp = expenses.find((x) => x.id === selectedRow);
        if (exp) {
          e.preventDefault();
          openExpenseEdit(exp);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = expenses[Math.min(idx + 1, expenses.length - 1)];
        if (next) setSelectedRow(next.id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = expenses[Math.max(idx - 1, 0)];
        if (prev) setSelectedRow(prev.id);
      } else if (e.key === "Home") {
        e.preventDefault();
        setSelectedRow(expenses[0].id);
      } else if (e.key === "End") {
        e.preventDefault();
        setSelectedRow(expenses[expenses.length - 1].id);
      } else if (e.key === "PageDown") {
        e.preventDefault();
        const start = idx < 0 ? 0 : idx;
        setSelectedRow(expenses[Math.min(start + 10, expenses.length - 1)].id);
      } else if (e.key === "PageUp") {
        e.preventDefault();
        const start = idx < 0 ? 0 : idx;
        setSelectedRow(expenses[Math.max(start - 10, 0)].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, selectedRow, expenses, openExpenseEdit]);

  // Keep highlighted row visible — minimum scroll.
  useEffect(() => {
    if (selectedRow == null) return;
    const el = document.querySelector<HTMLElement>(`[data-exp-row="${selectedRow}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedRow]);

  const grandTotal = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    [expenses]
  );

  // ────── Busy-style pre-list filter dialog ──────
  // `data-escape-guarded` opts out of the global Esc→back shortcut.
  //
  // Panel-scoped keyboard nav:
  //   ↑ / ↓         → jump between filter fields (startDate → endDate → Y/N → OK)
  //   Y / N         → set Show Description toggle regardless of focused field
  //   Enter         → advance to next field; on OK button submit the panel
  // The DatePickerCalendar owns its own arrow keys while the calendar
  // popover is open, so we only handle arrows when the popover is closed
  // (checked via aria-expanded on the trigger).
  // Ordered focus stops in the filter panel. Two are inputs (found via name);
  // the rest are buttons (found via data-filter-field).
  const filterFieldOrder: Array<{ selector: string; kind: "input" | "button" }> = [
    { selector: 'input[name="startDate"]', kind: "input" },
    { selector: 'input[name="endDate"]', kind: "input" },
    { selector: '[data-filter-field="showDescription-y"]', kind: "button" },
    { selector: '[data-filter-field="showDescription-n"]', kind: "button" },
    { selector: '[data-filter-field="ok-btn"]', kind: "button" },
  ];
  const currentFieldIdx = (): number => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return -1;
    return filterFieldOrder.findIndex((f) => active.matches(f.selector));
  };
  const onFilterKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key;
    // Skip nav while the DatePickerCalendar popover is open — it owns arrows.
    if (document.querySelector('[data-calendar-popover="true"]')) return;

    // Y / N always toggle Show Description — but ONLY when focus is on the
    // toggle itself or the OK button, so typing digits in a date input isn't
    // hijacked (native date input allows letters in DD-MM-YYYY editing).
    const activeEl = document.activeElement as HTMLElement | null;
    const onToggleRow =
      !!activeEl && !!activeEl.closest('[data-filter-row="showDescription"], [data-filter-field="ok-btn"]');
    if ((key === "y" || key === "Y") && onToggleRow) {
      e.preventDefault();
      setPending((p) => ({ ...p, showDescription: true }));
      return;
    }
    if ((key === "n" || key === "N") && onToggleRow) {
      e.preventDefault();
      setPending((p) => ({ ...p, showDescription: false }));
      return;
    }

    // Enter = advance to next field. On the LAST field (or when the
    // OK button already has focus) Enter submits the panel — matches the
    // "OK (F2)" hint and Tally-style forms where Enter walks the row and
    // fires the primary action at the end.
    //
    // Skip when DatePickerCalendar already handled Enter itself (it calls
    // preventDefault + focusNextTabbable), otherwise the child's advance
    // + our advance would DOUBLE-hop past one field. defaultPrevented is
    // the reliable signal since React bubbles the same event object.
    if (key === "Enter" && !e.defaultPrevented) {
      const idx = currentFieldIdx();
      if (idx < 0) return;
      e.preventDefault();
      // OK button → submit the panel.
      if (idx === filterFieldOrder.length - 1) {
        setApplied(pending);
        setPanelOpen(false);
        return;
      }
      // Y or N button → jump straight to OK, skipping the sibling toggle
      // button (otherwise Enter would land on the other Y/N first and the
      // operator has to press Enter 3× to reach OK).
      const activeEl2 = document.activeElement as HTMLElement | null;
      const onToggle = !!activeEl2?.closest('[data-filter-row="showDescription"]');
      const targetIdx = onToggle ? filterFieldOrder.length - 1 : idx + 1;
      const nextEl = document.querySelector<HTMLElement>(filterFieldOrder[targetIdx].selector);
      if (nextEl) {
        nextEl.focus();
        if (nextEl instanceof HTMLInputElement) nextEl.select?.();
      }
      return;
    }

    if (key !== "ArrowUp" && key !== "ArrowDown") return;
    const idx = currentFieldIdx();
    if (idx < 0) return;
    const nextIdx =
      key === "ArrowDown" ? Math.min(idx + 1, filterFieldOrder.length - 1) : Math.max(idx - 1, 0);
    if (nextIdx === idx) return;
    e.preventDefault();
    const nextEl = document.querySelector<HTMLElement>(filterFieldOrder[nextIdx].selector);
    if (nextEl) {
      nextEl.focus();
      if (nextEl instanceof HTMLInputElement) nextEl.select?.();
    }
  };

  if (panelOpen) {
    return (
      <div data-escape-guarded className="p-3" onKeyDown={onFilterKey}>
        <div className="w-full lg:w-[420px]">
          <div className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
            <div className="bg-amber-500/90 text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
              List of Expenses
            </div>
            <div className="p-4 space-y-2.5 text-[11px]">
              <FilterRow label="Starting Date">
                <DatePickerCalendar
                  name="startDate"
                  value={pending.startDate}
                  onChange={(e) => setPending({ ...pending, startDate: e.target.value })}
                />
              </FilterRow>

              <FilterRow label="Ending Date">
                <DatePickerCalendar
                  name="endDate"
                  value={pending.endDate}
                  onChange={(e) => setPending({ ...pending, endDate: e.target.value })}
                />
              </FilterRow>

              <ToggleRow
                label="Show Description?"
                value={pending.showDescription}
                onChange={(v) => setPending({ ...pending, showDescription: v })}
                dataFilterRow="showDescription"
              />

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  data-filter-field="ok-btn"
                  onClick={() => {
                    setApplied(pending);
                    setPanelOpen(false);
                  }}
                  className="px-6 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-semibold text-[11px] transition cursor-pointer"
                >
                  OK (F2)
                </button>
              </div>
              <div className="text-center text-[10px] text-ink-subtle italic pt-1">
                <kbd className="px-1 border border-line rounded bg-card text-[10px]">Esc</kbd> to quit ·
                {" "}<kbd className="px-1 border border-line rounded bg-card text-[10px]">F2</kbd> to submit
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-escape-guarded className="p-3 space-y-2 w-full max-w-7xl">
      {/* Header bar */}
      <div className="bg-card rounded-md border border-line px-3 py-1.5 flex flex-wrap items-center gap-2 shadow-sm">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaCoins className="text-amber-500 text-sm" /> Expense Register
          {refreshing && <FaSync className="animate-spin text-amber-500 text-[10px]" />}
        </h1>
        <span className="text-[10px] text-ink-subtle italic">
          From <b className="text-ink">{applied.startDate}</b> to <b className="text-ink">{applied.endDate}</b>
        </span>

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => {
              setPending(applied);
              setPanelOpen(true);
            }}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line cursor-pointer"
            title="Change filters"
          >
            <FaFilter className="text-[10px]" /> Change Filters
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line"
          >
            <FaSync className={refreshing ? "animate-spin text-amber-500" : ""} /> Refresh
          </button>
          <button
            onClick={() => navigate("/expenses/add")}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            <FaPlus className="text-[10px]" /> New Expense
          </button>
        </div>
      </div>

      {/* Spreadsheet-style table */}
      <div
        className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
        style={{ height: "calc(100vh - 240px)" }}
      >
        {expenses.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-subtle flex-1">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <FaSync className="animate-spin text-amber-500 text-[10px]" />
                Loading expenses…
              </span>
            ) : (
              "No expenses found in this date range."
            )}
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-[11px] text-ink-muted border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-card-2 text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                  <th className="px-2 py-1.5 border-r border-line w-28">Date</th>
                  <th className="px-2 py-1.5 border-r border-line w-24 text-center">Vch No</th>
                  <th className="px-2 py-1.5 border-r border-line">Expense Account (Dr)</th>
                  <th className="px-2 py-1.5 border-r border-line">Paid From (Cr)</th>
                  {applied.showDescription && (
                    <th className="px-2 py-1.5 border-r border-line">Description</th>
                  )}
                  <th className="px-2 py-1.5 w-32 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, rowIdx) => {
                  const isSelected = selectedRow === exp.id;
                  return (
                    <tr
                      key={exp.id}
                      data-exp-row={exp.id}
                      onClick={() => setSelectedRow(exp.id)}
                      onDoubleClick={() => openExpenseEdit(exp)}
                      title="Double-click or press Enter to modify"
                      className={`border-b border-line-soft cursor-pointer ${
                        isSelected
                          ? "bg-amber-500/25 text-ink ring-1 ring-amber-500/40"
                          : rowIdx % 2 === 0
                            ? "hover:bg-card-2/70"
                            : "bg-card-2/20 hover:bg-card-2/70"
                      }`}
                    >
                      <td className="px-2 py-1 border-r border-line-soft font-mono text-[11px]">
                        {formatDate(exp.date)}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft font-mono font-semibold text-amber-500 text-center">
                        {displayExpenseNo(exp.expenseNumber)}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft font-semibold text-ink uppercase">
                        {exp.debitLedger?.name || exp.expenseCategory || exp.expense || "-"}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft text-ink-muted uppercase">
                        {exp.creditLedger?.name || exp.paymentMethod || "-"}
                      </td>
                      {applied.showDescription && (
                        <td className="px-2 py-1 border-r border-line-soft text-ink-subtle max-w-xs truncate">
                          {exp.description || exp.expense || "-"}
                        </td>
                      )}
                      <td className="px-2 py-1 text-right font-mono font-semibold text-amber-500 whitespace-nowrap">
                        ₹ {Number(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
                {/* Busy-style filler rows */}
                {Array.from({ length: Math.max(0, 25 - expenses.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-line-soft">
                    <td className="px-2 py-1 border-r border-line-soft">&nbsp;</td>
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    {applied.showDescription && <td className="px-2 py-1 border-r border-line-soft"></td>}
                    <td className="px-2 py-1"></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-card-2 border-t-2 border-line">
                <tr>
                  <td
                    colSpan={4 + (applied.showDescription ? 1 : 0)}
                    className="px-2 py-1.5 text-right text-[10px] font-bold text-ink uppercase tracking-wide border-r border-line"
                  >
                    Page Total ({expenses.length})
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-sm text-amber-500 font-mono">
                    ₹ {grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Busy-style status bar */}
        <div className="border-t border-line bg-card-2/60 px-3 py-1 flex items-center justify-between text-[10px] font-mono text-ink-subtle shrink-0">
          <div className="flex gap-4">
            <span>
              Entry No: <b className="text-ink">{expenses.length > 0 ? 1 : 0} / {expenses.length}</b>
            </span>
            <span>
              Row No: <b className="text-ink">
                {selectedRow ? expenses.findIndex((e) => e.id === selectedRow) + 1 : (expenses.length > 0 ? 1 : 0)}
                {" / "}{expenses.length}
              </b>
            </span>
          </div>
          <div className="flex gap-3 uppercase tracking-wide">
            <span>Total: <b className="text-ink">{total}</b></span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Small presentational helpers ──
const FilterRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-12 gap-3 items-center">
    <label className="col-span-5 text-ink-subtle font-semibold">{label}</label>
    <div className="col-span-7">{children}</div>
  </div>
);

const ToggleRow: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  dataFilterRow?: string;
}> = ({ label, value, onChange, dataFilterRow }) => (
  <div
    className="grid grid-cols-12 gap-3 items-center"
    {...(dataFilterRow ? { "data-filter-row": dataFilterRow } : {})}
  >
    <label className="col-span-5 text-ink-subtle font-semibold">{label}</label>
    <div className="col-span-7 flex gap-2">
      <button
        type="button"
        data-filter-field={dataFilterRow ? `${dataFilterRow}-y` : undefined}
        onClick={() => onChange(true)}
        className={`px-3 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer ${
          value
            ? "bg-amber-500 text-white border-amber-500"
            : "bg-card text-ink-muted border-line hover:bg-card-2"
        }`}
      >
        Y
      </button>
      <button
        type="button"
        data-filter-field={dataFilterRow ? `${dataFilterRow}-n` : undefined}
        onClick={() => onChange(false)}
        className={`px-3 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer ${
          !value
            ? "bg-card-2 text-ink border-line"
            : "bg-card text-ink-muted border-line hover:bg-card-2"
        }`}
      >
        N
      </button>
    </div>
  </div>
);

export default ExpenseListPage;
