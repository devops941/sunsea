import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  FaChartLine,
  FaSync,
  FaPrint,
  FaDownload,
  FaPlay,
} from "react-icons/fa";
import apiClient from "../../../../api/apiClient";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { formatAmount } from "../../../../utils/pricingUtils";
import { useDetailCache } from "../../../../hooks/useDetailCache";

// ─── Backend response shape ─────────────────────────────────────────
interface PLAccount {
  ledgerId: number;
  code: string;
  name: string;
  group: string;
  totalDebit: number;
  totalCredit: number;
  netAmount: number;
}
interface PLData {
  startDate: string | null;
  endDate: string | null;
  incomeAccounts: PLAccount[];
  expenseAccounts: PLAccount[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  isProfit: boolean;
}

// ─── Options (Busy filter parity — only the toggles that actually do something) ──
type Options = {
  showSecondLevelGroups: boolean;
  groupsAndAmountsInColumns: boolean;
  showZeroBalance: boolean;
  scaleFactor: 1 | 10 | 100 | 1000 | 10000 | 100000 | 10000000;
};

const OPTIONS_KEY = "sunsea:profit-loss:options:v1";

const isoDate = (d: Date) => d.toISOString().split("T")[0];
const today = new Date();
const fyStartYear = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
const DEFAULT_START = isoDate(new Date(fyStartYear, 3, 1));
const DEFAULT_END = isoDate(today);

const DEFAULT_OPTIONS: Options = {
  showSecondLevelGroups: true,
  groupsAndAmountsInColumns: true,
  showZeroBalance: false,
  scaleFactor: 1,
};

const loadSavedOptions = (): Partial<Options> | null => {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const saveOptions = (opts: Options) => {
  try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts)); } catch { /* ignore */ }
};

const fmt = (n: number, scale = 1) => {
  const v = n / scale;
  if (scale === 1) return formatAmount(Math.abs(v));
  return Math.abs(v).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const displayDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

// ─── Ledger → Trading vs P&L bucket rules ───────────────────────────
// Busy splits the P&L statement into two tiers:
//   • Trading A/c (top):  Opening Stock + Purchase + Direct Exp   →  Closing Stock + Sales + Direct Income
//                         balancing entry is Gross Profit (or Gross Loss on Cr).
//   • P&L A/c    (below): Indirect Exp  →  Gross Profit b/d + Indirect Income
//                         balancing entry is Nett Profit (or Nett Loss on Cr).
//
// Classification is done by the ledger's group name (case-insensitive
// substring match) so a fresh company with "Direct Expenses", "Purchase
// Accounts", etc. maps out of the box. Anything that doesn't match a
// Trading category falls through to Indirect — safe default.
const isTradingDr = (g: string) =>
  /opening.*stock|stock.*opening|purchase|direct.*expens/i.test(g);
const isTradingCr = (g: string) =>
  /closing.*stock|stock.*closing|(^|\W)sales?(\W|$)|direct.*incom/i.test(g);

// ─── Section groupings (Busy header labels) ─────────────────────────
// Assign a canonical section header per bucketed ledger, so items collapse
// under the standard labels the operator expects to see (PURCHASE,
// DIRECT EXPENSES, INDIRECT EXP, SALES, etc.) rather than the raw group
// names each ledger was created with.
const canonSection = (g: string): string => {
  const s = g || "Other";
  if (/opening.*stock|stock.*opening/i.test(s)) return "Opening Stock";
  if (/purchase/i.test(s)) return "PURCHASE";
  if (/direct.*expens/i.test(s)) return "DIRECT EXPENSES";
  if (/closing.*stock|stock.*closing/i.test(s)) return "Closing Stock";
  if (/direct.*incom/i.test(s)) return "DIRECT INCOME";
  if (/(^|\W)sales?(\W|$)/i.test(s)) return "SALES";
  return s;
};

const ProfitLossPage: React.FC = () => {
  // ─── Committed state ────────────────────────────────────────────
  const [startDate, setStartDate] = useState<string>(DEFAULT_START);
  const [endDate, setEndDate] = useState<string>(DEFAULT_END);
  const [options, setOptions] = useState<Options>(() => {
    const saved = loadSavedOptions();
    return saved ? { ...DEFAULT_OPTIONS, ...saved } : DEFAULT_OPTIONS;
  });
  useEffect(() => { saveOptions(options); }, [options]);

  // ─── Options dialog ─────────────────────────────────────────────
  const [showOptionsDialog, setShowOptionsDialog] = useState<boolean>(true);
  const [draftStartDate, setDraftStartDate] = useState<string>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<string>(endDate);
  const [draftOptions, setDraftOptions] = useState<Options>(options);
  const setOpt = <K extends keyof Options>(k: K, v: Options[K]) =>
    setDraftOptions((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!showOptionsDialog) return;
    setDraftStartDate(startDate);
    setDraftEndDate(endDate);
    setDraftOptions(options);
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('input[name="plStartDate"]')?.focus();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOptionsDialog]);

  // ─── Fetch — cached + socket-synced ─────────────────────────────
  const cacheKey = `accounts:profit-loss:${startDate}:${endDate}:${options.showZeroBalance}`;
  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PLData> => {
      const params = new URLSearchParams({
        startDate,
        endDate,
        showZeroBalance: String(options.showZeroBalance),
      });
      const res = await apiClient.get(`/accounts/profit-loss?${params.toString()}`, { signal });
      return res.data.data as PLData;
    },
    [startDate, endDate, options.showZeroBalance]
  );
  const { data, loading, refreshing, refresh } = useDetailCache<PLData>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
  });

  // ─── Commit / F2 / Esc ──────────────────────────────────────────
  const commitOptions = useCallback(() => {
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setOptions(draftOptions);
    setShowOptionsDialog(false);
  }, [draftStartDate, draftEndDate, draftOptions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2" && showOptionsDialog) {
        e.preventDefault();
        commitOptions();
      } else if (e.key === "Escape" && !showOptionsDialog) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setShowOptionsDialog(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOptionsDialog, commitOptions]);

  // ─── Derived view — Trading + P&L buckets ───────────────────────
  type Bucket = { section: string; items: PLAccount[]; total: number };
  const view = useMemo(() => {
    if (!data) return null;
    const bucketBy = (items: PLAccount[], keyOf: (g: string) => string) => {
      const map: Record<string, PLAccount[]> = {};
      for (const a of items) {
        const k = keyOf(a.group);
        if (!map[k]) map[k] = [];
        map[k].push(a);
      }
      return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([section, list]) => ({
          section,
          items: list.sort((a, b) => (a.name || "").localeCompare(b.name || "")),
          total: list.reduce((s, i) => s + i.netAmount, 0),
        })) as Bucket[];
    };

    // Split expense/income into Trading vs Indirect
    const tradingDrAccts = data.expenseAccounts.filter((a) => isTradingDr(a.group));
    const indirectExpAccts = data.expenseAccounts.filter((a) => !isTradingDr(a.group));
    const tradingCrAccts = data.incomeAccounts.filter((a) => isTradingCr(a.group));
    const indirectIncAccts = data.incomeAccounts.filter((a) => !isTradingCr(a.group));

    const tradingDrGroups = bucketBy(tradingDrAccts, canonSection);
    const tradingCrGroups = bucketBy(tradingCrAccts, canonSection);
    const indirectExpGroups = bucketBy(indirectExpAccts, (g) => (g || "INDIRECT EXP").toUpperCase());
    const indirectIncGroups = bucketBy(indirectIncAccts, (g) => (g || "INDIRECT INCOME").toUpperCase());

    const tradingDrTotal = tradingDrGroups.reduce((s, g) => s + g.total, 0);
    const tradingCrTotal = tradingCrGroups.reduce((s, g) => s + g.total, 0);
    const grossProfit = tradingCrTotal - tradingDrTotal; // Dr side balancing entry if > 0
    // If gross loss, Cr side gets the balancing entry instead.
    const tradingDrClosingTotal = tradingDrTotal + Math.max(grossProfit, 0);
    const tradingCrClosingTotal = tradingCrTotal + Math.max(-grossProfit, 0);

    const indirectExpTotal = indirectExpGroups.reduce((s, g) => s + g.total, 0);
    const indirectIncTotal = indirectIncGroups.reduce((s, g) => s + g.total, 0);
    // P&L side inputs: Cr side gets Gross Profit b/d (or "" if gross loss) +
    // Indirect Income; Dr side gets Indirect Exp + Nett Profit balancing.
    const grossProfitBd = Math.max(grossProfit, 0);
    const grossLossBd = Math.max(-grossProfit, 0);
    const pnlCrInput = grossProfitBd + indirectIncTotal;   // credits available
    const pnlDrInput = grossLossBd + indirectExpTotal;      // debits demanded
    const netProfit = pnlCrInput - pnlDrInput;              // Dr balancing if > 0 (profit)
    const pnlDrClosingTotal = pnlDrInput + Math.max(netProfit, 0);
    const pnlCrClosingTotal = pnlCrInput + Math.max(-netProfit, 0);

    return {
      tradingDrGroups,
      tradingCrGroups,
      grossProfit,       // > 0 → gross profit; < 0 → gross loss
      tradingDrClosingTotal,
      tradingCrClosingTotal,
      indirectExpGroups,
      indirectIncGroups,
      grossProfitBd,
      grossLossBd,
      netProfit,         // > 0 → net profit (dr side); < 0 → net loss (cr side)
      pnlDrClosingTotal,
      pnlCrClosingTotal,
    };
  }, [data]);

  // ─── Flat row nav (arrow keys + left/right toggle sides) ────────
  type Side = "L" | "R";
  const [nav, setNav] = useState<{ side: Side; idx: number }>({ side: "L", idx: -1 });
  const navRef = useRef(nav);
  useEffect(() => { navRef.current = nav; }, [nav]);

  type FlatRow = { kind: "section" | "item" | "total" | "sub"; name: string; balance: number; sign?: "dr" | "cr" };
  const { leftRows, rightRows } = useMemo(() => {
    if (!view) return { leftRows: [] as FlatRow[], rightRows: [] as FlatRow[] };

    const L: FlatRow[] = [];
    const R: FlatRow[] = [];

    const emitBucket = (arr: FlatRow[], groups: Bucket[]) => {
      for (const g of groups) {
        arr.push({ kind: "section", name: g.section, balance: g.total });
        if (options.showSecondLevelGroups) {
          for (const it of g.items) {
            arr.push({ kind: "item", name: it.name, balance: it.netAmount });
          }
        }
      }
    };

    // Trading tier — Dr side
    emitBucket(L, view.tradingDrGroups);
    if (view.grossProfit > 0) L.push({ kind: "sub", name: "Gross Profit", balance: view.grossProfit });

    // Trading tier — Cr side
    emitBucket(R, view.tradingCrGroups);
    if (view.grossProfit < 0) R.push({ kind: "sub", name: "Gross Loss", balance: -view.grossProfit });

    // Trading totals row on both sides
    L.push({ kind: "total", name: "Total", balance: view.tradingDrClosingTotal });
    R.push({ kind: "total", name: "Total", balance: view.tradingCrClosingTotal });

    // ── P&L tier ─────────────────────────────────────────────
    // Cr side inputs
    if (view.grossProfitBd > 0) R.push({ kind: "sub", name: "Gross Profit b/d", balance: view.grossProfitBd });
    if (view.grossLossBd > 0) L.push({ kind: "sub", name: "Gross Loss b/d", balance: view.grossLossBd });
    // Indirect groups
    emitBucket(L, view.indirectExpGroups);
    emitBucket(R, view.indirectIncGroups);
    // Balancing net profit / net loss
    if (view.netProfit > 0) L.push({ kind: "sub", name: "Nett Profit", balance: view.netProfit });
    if (view.netProfit < 0) R.push({ kind: "sub", name: "Nett Loss", balance: -view.netProfit });

    // Final totals
    L.push({ kind: "total", name: "Total", balance: view.pnlDrClosingTotal });
    R.push({ kind: "total", name: "Total", balance: view.pnlCrClosingTotal });

    return { leftRows: L, rightRows: R };
  }, [view, options.showSecondLevelGroups]);

  useEffect(() => {
    if (showOptionsDialog) return;
    if (nav.idx < 0 && (leftRows.length > 0 || rightRows.length > 0)) {
      setNav({ side: leftRows.length > 0 ? "L" : "R", idx: 0 });
    }
  }, [showOptionsDialog, leftRows.length, rightRows.length, nav.idx]);
  useEffect(() => {
    if (nav.idx < 0) return;
    const row = document.querySelector<HTMLElement>(`[data-pl-row="${nav.side}-${nav.idx}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [nav]);

  useEffect(() => {
    if (showOptionsDialog) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const cur = navRef.current;
      const sideRows = cur.side === "L" ? leftRows : rightRows;
      const maxIdx = sideRows.length - 1;
      if (e.key === "ArrowDown") { e.preventDefault(); setNav({ ...cur, idx: Math.min(cur.idx + 1, maxIdx) }); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setNav({ ...cur, idx: Math.max(cur.idx - 1, 0) }); }
      else if (e.key === "ArrowRight" && cur.side === "L") {
        e.preventDefault();
        setNav({ side: "R", idx: Math.min(cur.idx, rightRows.length - 1) });
      }
      else if (e.key === "ArrowLeft" && cur.side === "R") {
        e.preventDefault();
        setNav({ side: "L", idx: Math.min(cur.idx, leftRows.length - 1) });
      }
      else if (e.key === "Home") { e.preventDefault(); setNav({ ...cur, idx: 0 }); }
      else if (e.key === "End") { e.preventDefault(); setNav({ ...cur, idx: maxIdx }); }
      else if (e.key === "PageDown") { e.preventDefault(); setNav({ ...cur, idx: Math.min(cur.idx + 10, maxIdx) }); }
      else if (e.key === "PageUp") { e.preventDefault(); setNav({ ...cur, idx: Math.max(cur.idx - 10, 0) }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOptionsDialog, leftRows.length, rightRows.length]);

  // ─── Print / Export ─────────────────────────────────────────────
  const handlePrint = () => window.print();
  const exportCSV = () => {
    if (!view) return;
    const lines: string[][] = [];
    lines.push(["Profit & Loss A/c"]);
    lines.push(["For the period ending", displayDate(endDate)]);
    lines.push([]);
    lines.push(["DEBIT (Rs.)", "Amount", "CREDIT (Rs.)", "Amount"]);
    const maxLen = Math.max(leftRows.length, rightRows.length);
    for (let i = 0; i < maxLen; i++) {
      const L = leftRows[i];
      const R = rightRows[i];
      lines.push([
        L ? L.name : "",
        L ? formatAmount(L.balance / options.scaleFactor) : "",
        R ? R.name : "",
        R ? formatAmount(R.balance / options.scaleFactor) : "",
      ]);
    }
    const csv = lines.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-loss-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-2 font-sans text-ink" style={{ minHeight: "calc(100vh - 100px)" }}>
      {/* Top action bar — hidden while filter dialog is open. */}
      {!showOptionsDialog && (
      <div className="bg-card rounded border border-line px-3 py-1.5 mb-2 flex items-center gap-3">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaChartLine className="text-red-500 text-sm" /> Profit &amp; Loss A/c
        </h3>
        {view && (
          <span className="text-[11px] text-ink-muted">
            For the period ending <b className="text-ink">{displayDate(endDate)}</b>
            {options.scaleFactor > 1 && (
              <span className="ml-2 text-ink-subtle">· Scale × {options.scaleFactor.toLocaleString("en-IN")}</span>
            )}
          </span>
        )}
        {refreshing && (
          <span className="flex items-center gap-1 text-[10px] text-red-400">
            <FaSync className="animate-spin" /> Syncing…
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => setShowOptionsDialog(true)}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[11px] font-semibold border border-line"
            title="Change filters (Esc)"
          >
            Filters
          </button>
          <button onClick={handlePrint} disabled={!data}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[11px] font-semibold border border-line disabled:opacity-50">
            <FaPrint /> Print
          </button>
          <button onClick={exportCSV} disabled={!data}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[11px] font-semibold border border-line disabled:opacity-50">
            <FaDownload /> Export
          </button>
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[11px] font-semibold border border-line disabled:opacity-50">
            <FaSync className={refreshing ? "animate-spin text-red-500" : ""} /> Refresh
          </button>
        </div>
      </div>
      )}

      {/* ─── T-Format Table (Busy-style) ────────────────────────── */}
      {!showOptionsDialog && (
        <>
          {!view && loading && (
            <div className="bg-card border border-line rounded p-12 text-center text-xs text-ink-subtle">
              Loading…
            </div>
          )}
          {!view && !loading && (
            <div className="bg-card border border-line rounded p-12 text-center text-xs text-ink-subtle">
              <FaChartLine className="text-red-500/40 text-3xl mx-auto mb-2" />
              No data for the selected period.
            </div>
          )}
          {view && (
            <div
              className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
              style={{ height: "calc(100vh - 200px)" }}
            >
              {/* "For the period ending" strip */}
              <div className="px-3 py-1 border-b border-line text-[11px] text-ink-muted shrink-0">
                For the period ending <b className="text-ink">{displayDate(endDate)}</b>
              </div>

              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-head border-b-2 border-line">
                      <th className="px-3 py-1 text-[11px] font-bold uppercase text-blue-600 border-r border-line w-[38%] bg-head" style={{ letterSpacing: "0.15em" }}>D E B I T &nbsp;(Rs.)</th>
                      <th className="px-3 py-1 text-[11px] font-bold text-right text-ink border-r border-line w-[12%] bg-head">Amount ({options.scaleFactor === 1 ? "₹" : `₹ × ${options.scaleFactor}`})</th>
                      <th className="px-3 py-1 text-[11px] font-bold uppercase text-blue-600 border-r border-line w-[38%] bg-head" style={{ letterSpacing: "0.15em" }}>C R E D I T &nbsp;(Rs.)</th>
                      <th className="px-3 py-1 text-[11px] font-bold text-right text-ink w-[12%] bg-head">Amount ({options.scaleFactor === 1 ? "₹" : `₹ × ${options.scaleFactor}`})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const maxLen = Math.max(leftRows.length, rightRows.length);
                      const rows: React.ReactElement[] = [];
                      for (let i = 0; i < maxLen; i++) {
                        const L = leftRows[i];
                        const R = rightRows[i];
                        const lHl = nav.side === "L" && nav.idx === i;
                        const rHl = nav.side === "R" && nav.idx === i;

                        const rowClassL = (r?: FlatRow) => {
                          if (!r) return "text-ink-muted";
                          if (r.kind === "section") return "font-bold uppercase text-ink";
                          if (r.kind === "total") return "font-bold uppercase text-ink bg-card-2";
                          if (r.kind === "sub") return "font-bold text-emerald-600";
                          return "pl-6 text-ink-muted";
                        };
                        const amtClassL = (r?: FlatRow) => {
                          if (!r) return "text-ink-muted";
                          if (r.kind === "section") return "font-bold text-ink";
                          if (r.kind === "total") return "font-bold text-ink bg-card-2";
                          if (r.kind === "sub") return "font-bold text-emerald-600";
                          return "text-ink-muted";
                        };
                        const rowClassR = rowClassL;
                        const amtClassR = amtClassL;

                        rows.push(
                          <tr key={`plrow-${i}`} className="border-b border-line-soft/60 hover:bg-card-2/40">
                            {/* LEFT (Debit) */}
                            {L ? (
                              <>
                                <td
                                  data-pl-row={`L-${i}`}
                                  className={`px-3 py-0.5 text-[11px] border-r border-line-soft/50 ${rowClassL(L)} ${lHl ? "bg-black text-white" : ""}`}
                                >
                                  {L.name}
                                </td>
                                <td
                                  className={`px-3 py-0.5 text-[11px] text-right font-mono border-r border-line-soft/50 ${amtClassL(L)} ${lHl ? "bg-black text-white" : ""}`}
                                >
                                  {L.balance !== 0 && fmt(Math.abs(L.balance), options.scaleFactor)}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                                <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                              </>
                            )}
                            {/* RIGHT (Credit) */}
                            {R ? (
                              <>
                                <td
                                  data-pl-row={`R-${i}`}
                                  className={`px-3 py-0.5 text-[11px] border-r border-line-soft/50 ${rowClassR(R)} ${rHl ? "bg-black text-white" : ""}`}
                                >
                                  {R.name}
                                </td>
                                <td
                                  className={`px-3 py-0.5 text-[11px] text-right font-mono ${amtClassR(R)} ${rHl ? "bg-black text-white" : ""}`}
                                >
                                  {R.balance !== 0 && fmt(Math.abs(R.balance), options.scaleFactor)}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-0.5">&nbsp;</td>
                                <td className="px-3 py-0.5">&nbsp;</td>
                              </>
                            )}
                          </tr>
                        );
                      }
                      // Filler rows so the grid always looks full.
                      const need = Math.max(0, 25 - maxLen);
                      for (let i = 0; i < need; i++) {
                        rows.push(
                          <tr key={`plempty-${i}`} className="border-b border-line-soft/60">
                            <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                            <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                            <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                            <td className="px-3 py-0.5">&nbsp;</td>
                          </tr>
                        );
                      }
                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Footer strip */}
              <div className="px-3 py-1 text-[10px] text-ink-subtle italic border-t border-line bg-card-2/40 flex items-center gap-3 shrink-0">
                <span><kbd className="px-1 border border-line rounded bg-card">↑ ↓</kbd> nav</span>
                <span><kbd className="px-1 border border-line rounded bg-card">← →</kbd> switch</span>
                <span><kbd className="px-1 border border-line rounded bg-card">Home / End</kbd> jump</span>
                <span><kbd className="px-1 border border-line rounded bg-card">Esc</kbd> filters</span>
                <span className="ml-auto">
                  {view.netProfit >= 0 ? (
                    <span className="text-emerald-600 font-semibold">Nett Profit: ₹{fmt(Math.abs(view.netProfit), options.scaleFactor)}</span>
                  ) : (
                    <span className="text-red-600 font-semibold">Nett Loss: ₹{fmt(Math.abs(view.netProfit), options.scaleFactor)}</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Options Dialog (Busy-style) ────────────────────────── */}
      {showOptionsDialog && (
        <div className="fixed top-[80px] left-4 z-30 w-[420px] max-w-[95vw]">
          <div className="bg-card border border-line rounded-md shadow-2xl w-full overflow-hidden flex flex-col">
            <div className="text-white text-[11px] font-bold uppercase tracking-wide flex items-center justify-between px-2 py-1 border-b border-line bg-red-600/90 shrink-0">
              <span className="flex-1 text-center">Profit &amp; Loss A/c</span>
            </div>

            <div className="px-3 py-2 overflow-auto grid grid-cols-12 gap-x-2 gap-y-1 text-[11px] items-center">
              <label className="col-span-6 text-ink-subtle font-semibold">Starting Date</label>
              <div className="col-span-6">
                <DatePickerCalendar
                  name="plStartDate"
                  value={draftStartDate}
                  onChange={(e) => setDraftStartDate(e.target.value)}
                />
              </div>

              <label className="col-span-6 text-ink-subtle font-semibold">Ending Date</label>
              <div className="col-span-6">
                <DatePickerCalendar
                  name="plEndDate"
                  value={draftEndDate}
                  onChange={(e) => setDraftEndDate(e.target.value)}
                />
              </div>

              {(() => {
                type Row = { key: keyof Options; label: string };
                const rows: Row[] = [
                  { key: "showSecondLevelGroups", label: "Show Second Level Group Details" },
                  { key: "groupsAndAmountsInColumns", label: "Show Groups and Amounts in separate columns" },
                  { key: "showZeroBalance", label: "Show Zero Balance Masters During Drill Down" },
                ];
                return rows.map((r) => (
                  <React.Fragment key={r.key}>
                    <label className="col-span-9 font-semibold text-ink-subtle">{r.label}</label>
                    <div className="col-span-3">
                      <select
                        value={(draftOptions[r.key] as boolean) ? "Y" : "N"}
                        onChange={(e) => setOpt(r.key, (e.target.value === "Y") as any)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const tabbables = Array.from(
                              document.querySelectorAll<HTMLElement>(
                                'input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]'
                              )
                            ).filter((el) => el.getAttribute("tabindex") !== "-1");
                            const idx = tabbables.indexOf(e.currentTarget);
                            if (idx >= 0 && tabbables[idx + 1]) tabbables[idx + 1].focus();
                          }
                        }}
                        className="w-[50px] px-1 py-0.5 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                      >
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                  </React.Fragment>
                ));
              })()}

              <label className="col-span-6 text-ink-subtle font-semibold">Specify Scale Factor</label>
              <div className="col-span-6">
                <select
                  value={String(draftOptions.scaleFactor)}
                  onChange={(e) => setOpt("scaleFactor", Number(e.target.value) as Options["scaleFactor"])}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitOptions();
                    }
                  }}
                  className="w-[110px] px-1 py-0.5 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                >
                  <option value="1">1</option>
                  <option value="10">10</option>
                  <option value="100">100</option>
                  <option value="1000">1,000</option>
                  <option value="10000">10,000</option>
                  <option value="100000">1 Lakh</option>
                  <option value="10000000">1 Crore</option>
                </select>
              </div>
            </div>

            <div className="px-3 py-1.5 border-t border-line bg-card-2 flex items-center justify-between shrink-0 text-[10px]">
              <span className="text-ink-subtle italic">
                Press <b>F2</b> or click OK to load report · <b>Esc</b> to go back
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={commitOptions}
                  className="px-3 py-0.5 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded flex items-center gap-1"
                >
                  <FaPlay className="text-[9px]" /> OK (F2)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitLossPage;
