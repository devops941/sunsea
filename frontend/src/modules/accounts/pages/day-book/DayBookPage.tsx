import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaBook, FaSync, FaFilter } from "react-icons/fa";
import { toast } from "react-toastify";
import { accountService, type DayBookResult, type DayBookRow } from "../../../../services/accountService";
import { useListCache } from "../../../../hooks/useListCache";
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts";
import { prefetchDetail } from "../../../../hooks/useDetailCache";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { formatDateDMY } from "../../../../utils/dateUtils";
import { displayVoucherNo, voucherService, type Voucher } from "../../../../services/voucherService";
import { formatAmount } from "../../../../utils/pricingUtils";

// Busy-style Day Book — two-column cashbook: Dr side | Cr side.
// Each side has: Particulars | Type | Cash Amount | Amount.
//
// Cash column = rows whose ledger is Cash/Bank/Petty Cash (Real Account, Rule 2).
// Amount column = rows whose ledger is anything else (Personal / Nominal).
//
// Golden-Rule invariants surfaced here:
//   • Every voucher's Σ Dr = Σ Cr (double-entry) — so debitRows total = creditRows total.
//   • Cash reconciliation: Opening + Σ Dr(cash) − Σ Cr(cash) = Closing.
//     Rendered as: LEFT grand = Opening + cashDr; RIGHT grand = cashCr + Closing.

interface FilterOptions {
  startDate: string;
  endDate: string;
  accountShownBy: "Name" | "Code";
  showVchNo: boolean;
  showCashBalances: boolean;
}

const todayIso = () => new Date().toISOString().split("T")[0];

const defaultFilters = (): FilterOptions => ({
  startDate: todayIso(),
  endDate: todayIso(),
  accountShownBy: "Name",
  showVchNo: false,
  showCashBalances: true,
});

// Voucher-type → edit-page route. Only Payment and Receipt currently have
// dedicated Edit pages in this app. Others fall through with a toast.
const editRouteForVoucherType = (type: string, voucherId: number): string | null => {
  switch (type) {
    case "PAYMENT": return `/accounts/payment-voucher/edit/${voucherId}`;
    case "RECEIPT": return `/accounts/receipt-voucher/edit/${voucherId}`;
    default: return null;
  }
};

const DayBookPage: React.FC = () => {
  const navigate = useNavigate();
  const [applied, setApplied] = useState<FilterOptions>(() => defaultFilters());
  const [pending, setPending] = useState<FilterOptions>(() => defaultFilters());
  // Modal-as-page persistence.
  const VIEW_KEY = "sunsea:day-book:view";
  const [panelOpen, setPanelOpen] = useState<boolean>(() => {
    try { return sessionStorage.getItem(VIEW_KEY) !== "table"; } catch { return true; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(VIEW_KEY, panelOpen ? "panel" : "table"); } catch { /* ignore */ }
  }, [panelOpen]);
  // Row selection — { side, idx-within-that-side }. Auto-selected to first
  // Dr row when data lands, then user can arrow around.
  const [selected, setSelected] = useState<{ side: "Dr" | "Cr"; idx: number } | null>(null);
  const [modalRow, setModalRow] = useState<DayBookRow | null>(null);

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
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      e.stopPropagation();
      if (!panelOpenRef.current) {
        setPending(applied);
        setPanelOpen(true);
      } else {
        navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applied, navigate]);

  const cacheKey = `accounts:day-book:${applied.startDate}:${applied.endDate}`;

  const fetcher = useCallback(
    async (_signal: AbortSignal) => {
      try {
        const res = await accountService.fetchDayBook({
          startDate: applied.startDate,
          endDate: applied.endDate,
        });
        // useListCache expects `{ data, total }` — wrap the single result in
        // a one-item array so the hook stores it and we can pull it back out.
        return { data: [res as DayBookResult], total: 1 };
      } catch (err: any) {
        toast.error(err?.message || "Failed to load day book");
        throw err;
      }
    },
    [applied.startDate, applied.endDate]
  );

  const { data: results, loading, refreshing, refresh } = useListCache<DayBookResult>({
    cacheKey,
    // Any voucher create/update/delete invalidates → real-time.
    socketModule: "voucher",
    fetcher,
  });
// F5 = refresh (centralised via usePageShortcuts).  usePageShortcuts({ onRefresh: refresh });

  const dayBook: DayBookResult | null = results[0] || null;

  // Shared row-count target for BOTH Dr and Cr sides so TOTAL / Closing
  // Balance / GRAND TOTAL rows line up horizontally like Busy. We pick the
  // larger of (Dr content, Cr content, 22-row minimum). Both sides then pad
  // their filler count to hit this target.
  const targetContentRows = useMemo(() => {
    if (!dayBook) return 22;
    const countContentRows = (rows: DayBookRow[]) => {
      // Date-group headers: one per distinct date
      const dateHeaderCount = new Set(rows.map((r) => r.date)).size;
      // Opening-balance row: rendered on BOTH sides (Cr side gets an
      // empty placeholder) so it counts equally toward both totals.
      const openingBalanceRow = applied.showCashBalances ? 1 : 0;
      return dateHeaderCount + rows.length + openingBalanceRow;
    };
    const drCount = countContentRows(dayBook.debitRows);
    const crCount = countContentRows(dayBook.creditRows);
    return Math.max(22, drCount, crCount);
  }, [dayBook, applied.showCashBalances]);

  // Auto-select first Dr row when data lands, or reset if the current
  // selection is out of bounds (e.g. after filter change).
  useEffect(() => {
    if (panelOpen || !dayBook) return;
    const drLen = dayBook.debitRows.length;
    const crLen = dayBook.creditRows.length;
    if (drLen === 0 && crLen === 0) {
      setSelected(null);
      return;
    }
    if (
      !selected ||
      (selected.side === "Dr" && selected.idx >= drLen) ||
      (selected.side === "Cr" && selected.idx >= crLen)
    ) {
      setSelected(drLen > 0 ? { side: "Dr", idx: 0 } : { side: "Cr", idx: 0 });
    }
  }, [dayBook, panelOpen, selected]);

  // Open the "View Options" modal AND pre-warm the voucher into the detail
  // cache so the Edit page has zero loading when the user hits OK. This is
  // the key to making Day Book → Edit feel instant: by the time the user
  // reads the modal and clicks OK (~1s), the fetch is usually already done
  // and `useDetailCache` on the Edit page serves it synchronously.
  const openViewModal = useCallback((row: DayBookRow) => {
    setModalRow(row);
    // Fire-and-forget prefetch. `prefetchDetail` no-ops if cache is already
    // fresh (within 60s TTL), so repeatedly opening the same row is cheap.
    prefetchDetail<Voucher>(
      `voucher-${row.voucherId}`,
      async (_signal) => {
        const v = await voucherService.fetchVoucherById(row.voucherId);
        if (!v) throw new Error("Voucher not found");
        return v;
      }
    );
  }, []);

  // ↑ / ↓ moves selection · ← / → switches side · Enter opens View modal.
  // Skips when the filter panel is open (F2/Esc live there instead) or when
  // typing in an input.
  useEffect(() => {
    if (panelOpen || !dayBook) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (modalRow) return; // modal handles its own keys

      const drLen = dayBook.debitRows.length;
      const crLen = dayBook.creditRows.length;
      const sel = selected;
      if (!sel) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const max = sel.side === "Dr" ? drLen : crLen;
        setSelected({ side: sel.side, idx: Math.min(sel.idx + 1, max - 1) });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected({ side: sel.side, idx: Math.max(sel.idx - 1, 0) });
      } else if (e.key === "ArrowLeft" && sel.side === "Cr" && drLen > 0) {
        e.preventDefault();
        setSelected({ side: "Dr", idx: Math.min(sel.idx, drLen - 1) });
      } else if (e.key === "ArrowRight" && sel.side === "Dr" && crLen > 0) {
        e.preventDefault();
        setSelected({ side: "Cr", idx: Math.min(sel.idx, crLen - 1) });
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = sel.side === "Dr" ? dayBook.debitRows[sel.idx] : dayBook.creditRows[sel.idx];
        if (row) openViewModal(row);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, dayBook, selected, modalRow, openViewModal]);

  // ────── Busy-style pre-list filter dialog ──────
  // `data-escape-guarded` opts out of the global Esc→back shortcut.
  if (panelOpen) {
    return (
      <div data-escape-guarded className="p-3">
        <div className="w-full lg:w-[420px]">
          <div className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
            <div className="bg-indigo-600/90 text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
              Day Book
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

              <FilterRow label="Account shown by">
                <select
                  value={pending.accountShownBy}
                  onChange={(e) =>
                    setPending({ ...pending, accountShownBy: e.target.value as "Name" | "Code" })
                  }
                  className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Name">Name</option>
                  <option value="Code">Code</option>
                </select>
              </FilterRow>

              <ToggleRow
                label="Show Vch/Bill No?"
                value={pending.showVchNo}
                onChange={(v) => setPending({ ...pending, showVchNo: v })}
              />
              <ToggleRow
                label="Show Cash Balances?"
                value={pending.showCashBalances}
                onChange={(v) => setPending({ ...pending, showCashBalances: v })}
              />

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setApplied(pending);
                    setPanelOpen(false);
                  }}
                  className="px-6 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-[11px] transition cursor-pointer"
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

  // ────── Day Book (list) ──────
  return (
    <div data-escape-guarded className="p-3 space-y-2 w-full max-w-[1400px]">
      {/* Header bar */}
      <div className="bg-card rounded-md border border-line px-3 py-1.5 flex flex-wrap items-center gap-2 shadow-sm">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaBook className="text-indigo-500 text-sm" /> Day Book
          {refreshing && <FaSync className="animate-spin text-indigo-500 text-[10px]" />}
        </h1>
        <span className="text-[10px] text-ink-subtle italic">
          From <b className="text-ink">{formatDateDMY(applied.startDate)}</b> to{" "}
          <b className="text-ink">{formatDateDMY(applied.endDate)}</b>
          {dayBook && (
            <>
              {" "}· <b className="text-ink">{dayBook.voucherCount}</b> vouchers
            </>
          )}
        </span>

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => {
              setPending(applied);
              setPanelOpen(true);
            }}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line cursor-pointer"
          >
            <FaFilter className="text-[10px]" /> Change Filters
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line cursor-pointer"
          >
            <FaSync className={refreshing ? "animate-spin text-indigo-500" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Two-column cashbook. Fixed viewport-sized container so only the
          content inside scrolls — page frame / header / reconciliation banner
          stay put. Both Dr and Cr sides scroll together (they represent the
          same day / period, users compare across them visually). */}
      <div
        className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
        style={{ height: "calc(100vh - 240px)" }}
      >
        {loading && !dayBook ? (
          <div className="p-8 text-center text-xs text-ink-subtle">
            <FaSync className="inline animate-spin text-indigo-500 text-[10px] mr-2" />
            Loading day book…
          </div>
        ) : !dayBook || (dayBook.debitRows.length === 0 && dayBook.creditRows.length === 0) ? (
          <div className="p-8 text-center text-xs text-ink-subtle">
            No transactions in this period.
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <div className="grid grid-cols-2 min-w-[900px]">
              <DayBookSide
                side="Dr"
                rows={dayBook.debitRows}
                cashTotal={dayBook.totals.cashDrTotal}
                amountTotal={dayBook.totals.amountDrTotal}
                openingCash={dayBook.openingCashBalance}
                closingCash={null}
                grandCash={dayBook.totals.grandCashDr}
                grandAmount={dayBook.totals.grandAmountDr}
                applied={applied}
                selected={selected}
                onSelect={(s, i) => setSelected({ side: s, idx: i })}
                onOpen={openViewModal}
                targetContentRows={targetContentRows}
              />
              <DayBookSide
                side="Cr"
                rows={dayBook.creditRows}
                cashTotal={dayBook.totals.cashCrTotal}
                amountTotal={dayBook.totals.amountCrTotal}
                openingCash={null}
                closingCash={dayBook.closingCashBalance}
                grandCash={dayBook.totals.grandCashCr}
                grandAmount={dayBook.totals.grandAmountCr}
                applied={applied}
                selected={selected}
                onSelect={(s, i) => setSelected({ side: s, idx: i })}
                onOpen={openViewModal}
                targetContentRows={targetContentRows}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cash reconciliation banner — validates the Real-Account rule invariant. */}
      {dayBook && applied.showCashBalances && (
        <div className="bg-card-2/40 border border-line rounded-md px-3 py-1.5 text-[10px] font-mono text-ink-subtle flex flex-wrap items-center gap-x-4 gap-y-0.5">
          <span>
            Opening Cash: <b className="text-ink">{fmt(dayBook.openingCashBalance)}</b>
          </span>
          <span>+ Cash In (Dr): <b className="text-emerald-500">{fmt(dayBook.totals.cashDrTotal)}</b></span>
          <span>− Cash Out (Cr): <b className="text-red-500">{fmt(dayBook.totals.cashCrTotal)}</b></span>
          <span>= Closing Cash: <b className="text-ink">{fmt(dayBook.closingCashBalance)}</b></span>
          <span className="ml-auto italic">
            Cash reconciliation ({fmt(dayBook.totals.grandCashDr)} = {fmt(dayBook.totals.grandCashCr)}
            {Math.abs(dayBook.totals.grandCashDr - dayBook.totals.grandCashCr) < 0.01 ? " ✓" : " ⚠ mismatch"})
          </span>
        </div>
      )}

      {/* Busy-style "View Options" modal — opens on Enter or double-click.
          Shows the selected row's voucher summary + OK to navigate to the
          voucher edit page (Payment/Receipt only for now — others toast). */}
      {modalRow && (
        <ViewOptionsModal
          row={modalRow}
          onClose={() => setModalRow(null)}
          onConfirm={() => {
            const route = editRouteForVoucherType(modalRow.voucherType, modalRow.voucherId);
            if (route) {
              navigate(route);
            } else {
              toast.info(
                `Modify from Day Book is not yet supported for ${modalRow.voucherType} vouchers. Open it from its own module.`
              );
            }
            setModalRow(null);
          }}
        />
      )}
    </div>
  );
};

// ── Busy-style "View Options" modal ──
// Shows the picked row's voucher info and asks the user to confirm. Esc closes,
// Enter confirms. Purely a click-through step so the user sees WHICH voucher
// they're about to open (some Day Book rows can look alike at a glance).
const ViewOptionsModal: React.FC<{
  row: DayBookRow;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ row, onClose, onConfirm }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "Enter") { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[380px] bg-card border border-line rounded-md overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-indigo-600/90 text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
          View Options
        </div>
        <div className="p-4 text-[11px] space-y-2">
          <div className="bg-indigo-600/10 border border-indigo-500/30 rounded px-3 py-2">
            <div className="text-ink font-semibold text-[12px] mb-0.5">
              View Voucher — {displayVoucherNo(row.voucherNo)}
            </div>
            <div className="text-ink-subtle text-[10px]">
              {row.typeShort} · {row.particulars}
              {" "}·{" "}
              <span className="font-mono">
                ₹{fmt(row.isCash ? row.cashAmount : row.amount)}
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              // `tabIndex={-1}` — Enter's focus-next-tabbable should skip
              // Cancel and land on OK so the operator can commit with a
              // single Enter after the last field.
              tabIndex={-1}
              className="px-4 py-1 text-ink bg-card-2 hover:bg-card border border-line rounded font-semibold text-[11px] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-6 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-[11px] transition cursor-pointer"
            >
              OK
            </button>
          </div>
          <div className="text-center text-[10px] text-ink-subtle italic pt-1">
            <kbd className="px-1 border border-line rounded bg-card text-[10px]">Esc</kbd> to cancel ·
            {" "}<kbd className="px-1 border border-line rounded bg-card text-[10px]">Enter</kbd> to confirm
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Single side (Dr or Cr) of the two-column layout ──
const DayBookSide: React.FC<{
  side: "Dr" | "Cr";
  rows: DayBookRow[];
  cashTotal: number;
  amountTotal: number;
  openingCash: number | null; // populated only on the Dr side
  closingCash: number | null; // populated only on the Cr side
  grandCash: number;
  grandAmount: number;
  applied: FilterOptions;
  selected: { side: "Dr" | "Cr"; idx: number } | null;
  onSelect: (side: "Dr" | "Cr", idx: number) => void;
  onOpen: (row: DayBookRow) => void;
  targetContentRows: number;
}> = ({ side, rows, cashTotal, amountTotal, openingCash, closingCash, grandCash, grandAmount, applied, selected, onSelect, onOpen, targetContentRows }) => {
  // Group consecutive rows by date so the same date shows once at the top (Busy convention).
  const grouped = useMemo(() => {
    const out: Array<{ date: string; rows: DayBookRow[] }> = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && last.date === r.date) last.rows.push(r);
      else out.push({ date: r.date, rows: [r] });
    }
    return out;
  }, [rows]);

  // Busy-style empty filler rows so the grid always looks full AND both
  // sides line up horizontally. `targetContentRows` comes from the parent
  // and is the max of (Dr content, Cr content, 22) so TOTAL / Closing /
  // GRAND TOTAL rows sit at the same y-position on both sides.
  const displayedContentRows =
    grouped.reduce((sum, g) => sum + 1 /* date header */ + g.rows.length, 0) +
    // Opening Balance row rendered on BOTH sides (Cr side gets an empty
    // placeholder), so both count it equally.
    (applied.showCashBalances ? 1 : 0);
  const fillerRowCount = Math.max(0, targetContentRows - displayedContentRows);

  const isSelected = (idx: number) => selected?.side === side && selected.idx === idx;

  // Precompute the flat row index at the start of each date-group so we can
  // map (groupIndex, rowInGroup) → position in the flat `rows` array (which
  // is what `selected.idx` refers to).
  const groupStartFlatIdx: number[] = [];
  {
    let acc = 0;
    for (const g of grouped) {
      groupStartFlatIdx.push(acc);
      acc += g.rows.length;
    }
  }

  const borderCls = side === "Dr" ? "border-r border-line" : "";

  return (
    <div className={`${borderCls} text-[11px]`}>
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-card-2">
          <tr className="text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
            <th className="px-2 py-1 text-left border-r border-line-soft bg-card-2">Particulars</th>
            <th className="px-2 py-1 text-left border-r border-line-soft w-12 bg-card-2">Type</th>
            {applied.showVchNo && (
              <th className="px-2 py-1 text-center border-r border-line-soft w-16 bg-card-2">Vch No</th>
            )}
            <th className="px-2 py-1 text-right border-r border-line-soft w-24 bg-card-2">Cash Amount</th>
            <th className="px-2 py-1 text-right w-24 bg-card-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {/* Fallback Opening Balance row — only rendered when there are
              NO date groups. Normally the Opening Balance sits BELOW the
              first date header (see block inside grouped.map below) to
              match Busy's layout: date at top, opening balance beneath. */}
          {grouped.length === 0 && applied.showCashBalances && (
            <tr className="bg-amber-500/5 border-b border-line-soft">
              <td className="px-2 py-1 font-semibold text-ink italic border-r border-line-soft">
                {side === "Dr" ? "Opening Balance" : (
                      // Invisible copy so the Cr row height matches the Dr row exactly.
                      // A single NBSP renders shorter than italic "Opening Balance" text
                      // and visibly misaligns the two columns.
                      <span className="invisible">Opening Balance</span>
                    )}
              </td>
              <td className="px-2 py-1 text-ink-subtle border-r border-line-soft">
                {side === "Dr" ? "—" : ""}
              </td>
              {applied.showVchNo && (
                <td className="px-2 py-1 border-r border-line-soft"></td>
              )}
              <td className="px-2 py-1 text-right font-mono text-ink font-semibold border-r border-line-soft">
                {side === "Dr" && openingCash !== null ? fmt(openingCash) : ""}
              </td>
              <td className="px-2 py-1"></td>
            </tr>
          )}

          {grouped.map((grp, gi) => (
            <React.Fragment key={`${grp.date}-${gi}`}>
              {/* Date header — at the TOP of each block. Busy convention:
                  first date row shows on both sides, then Opening Balance
                  (Dr value / Cr placeholder) sits directly beneath it. */}
              <tr className="bg-card-2/40 border-b border-line-soft">
                <td
                  colSpan={applied.showVchNo ? 5 : 4}
                  className="px-2 py-0.5 text-[10px] font-mono font-semibold text-indigo-500"
                >
                  {formatDateDMY(grp.date)}
                </td>
              </tr>
              {/* Opening Balance sits BELOW the first date header on both
                  sides (Dr owns the value, Cr shows an empty placeholder).
                  All cells use   (non-breaking space) so the row keeps
                  the exact same height as the Dr side — otherwise empty
                  cells collapse and misalign the whole right column. */}
              {gi === 0 && applied.showCashBalances && (
                <tr className="bg-amber-500/5 border-b border-line-soft">
                  <td className="px-2 py-1 font-semibold text-ink italic border-r border-line-soft">
                    {side === "Dr" ? "Opening Balance" : " "}
                  </td>
                  <td className="px-2 py-1 text-ink-subtle border-r border-line-soft">{" "}</td>
                  {applied.showVchNo && (
                    <td className="px-2 py-1 border-r border-line-soft">{" "}</td>
                  )}
                  <td className="px-2 py-1 text-right font-mono text-ink font-semibold border-r border-line-soft">
                    {side === "Dr" && openingCash !== null ? fmt(openingCash) : " "}
                  </td>
                  <td className="px-2 py-1">{" "}</td>
                </tr>
              )}
              {grp.rows.map((r, ri) => {
                const flatIdx = groupStartFlatIdx[gi] + ri;
                const rowSelected = isSelected(flatIdx);
                return (
                <React.Fragment key={`${gi}-${ri}`}>
                  <tr
                    onClick={() => onSelect(side, flatIdx)}
                    onDoubleClick={() => onOpen(r)}
                    title="Double-click (or Enter with row selected) to view voucher"
                    className={`border-b border-line-soft cursor-pointer ${
                      rowSelected ? "bg-indigo-600/25 text-ink" : "hover:bg-card-2/40"
                    }`}
                  >
                    <td className="px-2 py-0.5 text-ink uppercase border-r border-line-soft">
                      {applied.accountShownBy === "Code" && r.ledgerCode
                        ? `${r.ledgerCode} — ${r.particulars}`
                        : r.particulars}
                    </td>
                    <td className="px-2 py-0.5 text-ink-muted border-r border-line-soft">
                      {r.typeShort}
                    </td>
                    {applied.showVchNo && (
                      <td className="px-2 py-0.5 text-center font-mono text-indigo-500 border-r border-line-soft">
                        {displayVoucherNo(r.voucherNo)}
                      </td>
                    )}
                    <td className="px-2 py-0.5 text-right font-mono text-ink font-semibold border-r border-line-soft">
                      {r.isCash ? fmt(r.cashAmount) : ""}
                    </td>
                    <td className="px-2 py-0.5 text-right font-mono text-ink font-semibold">
                      {!r.isCash ? fmt(r.amount) : ""}
                    </td>
                  </tr>
                </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}

          {/* Empty filler rows so the grid always looks full even when the
              period has few transactions. Mirrors PaymentVoucherPage /
              ReceiptVoucherPage / BankStatementPage convention. */}
          {Array.from({ length: fillerRowCount }).map((_, i) => (
            <tr key={`empty-${i}`} className="border-b border-line-soft">
              <td className="px-2 py-1 border-r border-line-soft">&nbsp;</td>
              <td className="px-2 py-1 border-r border-line-soft"></td>
              {applied.showVchNo && (
                <td className="px-2 py-1 border-r border-line-soft"></td>
              )}
              <td className="px-2 py-1 border-r border-line-soft"></td>
              <td className="px-2 py-1"></td>
            </tr>
          ))}

          {/* Total row (cash + amount columns) */}
          <tr className="bg-card-2 border-t-2 border-line font-bold">
            <td
              colSpan={applied.showVchNo ? 3 : 2}
              className="px-2 py-1 text-right text-[10px] uppercase text-ink border-r border-line-soft"
            >
              Total
            </td>
            <td className="px-2 py-1 text-right font-mono text-ink border-r border-line-soft">
              {fmt(cashTotal)}
            </td>
            <td className="px-2 py-1 text-right font-mono text-ink">{fmt(amountTotal)}</td>
          </tr>

          {/* Closing Balance row — rendered on BOTH sides so GRAND TOTAL
              stays aligned. Cr side owns the value (Real Account rule:
              closing cash c/f sits on the Cr side conceptually); Dr side
              shows an empty placeholder. */}
          {applied.showCashBalances && (
            <tr className="bg-amber-500/5 border-b border-line-soft">
              <td className="px-2 py-1 font-semibold text-ink italic border-r border-line-soft">
                {side === "Cr" ? "Closing Balance" : (
                  // Invisible copy so the Dr placeholder row height matches the
                  // Cr row exactly (bare space renders shorter than italic text).
                  <span className="invisible">Closing Balance</span>
                )}
              </td>
              <td className="px-2 py-1 text-ink-subtle border-r border-line-soft">
                {side === "Cr" ? "—" : ""}
              </td>
              {applied.showVchNo && (
                <td className="px-2 py-1 border-r border-line-soft"></td>
              )}
              <td className="px-2 py-1 text-right font-mono text-ink font-semibold border-r border-line-soft">
                {side === "Cr" && closingCash !== null ? fmt(closingCash) : ""}
              </td>
              <td className="px-2 py-1"></td>
            </tr>
          )}

          {/* Grand Total row */}
          <tr className="bg-indigo-500/10 border-t-2 border-line font-bold">
            <td
              colSpan={applied.showVchNo ? 3 : 2}
              className="px-2 py-1 text-right text-[10px] uppercase text-ink border-r border-line-soft"
            >
              Grand Total
            </td>
            <td className="px-2 py-1 text-right font-mono text-ink border-r border-line-soft">
              {fmt(grandCash)}
            </td>
            <td className="px-2 py-1 text-right font-mono text-ink">{fmt(grandAmount)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// ── Small helpers ──
const fmt = (n: number) =>
  formatAmount(n);

const FilterRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-12 gap-3 items-center">
    <label className="col-span-5 text-ink-subtle font-semibold">{label}</label>
    <div className="col-span-7">{children}</div>
  </div>
);

const ToggleRow: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div className="grid grid-cols-12 gap-3 items-center">
    <label className="col-span-5 text-ink-subtle font-semibold">{label}</label>
    <div className="col-span-7 flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer ${
          value
            ? "bg-indigo-600 text-white border-indigo-600"
            : "bg-card text-ink-muted border-line hover:bg-card-2"
        }`}
      >
        Y
      </button>
      <button
        type="button"
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

export default DayBookPage;
