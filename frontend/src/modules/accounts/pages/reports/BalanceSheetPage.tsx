import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  FaBalanceScale,
  FaSync,
  FaPrint,
  FaDownload,
  FaPlay,
} from "react-icons/fa";
import apiClient from "../../../../api/apiClient";
import { useDetailCache } from "../../../../hooks/useDetailCache";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { formatAmount } from "../../../../utils/pricingUtils";

// ─── Types (backend response shape) ──────────────────────────────────
interface BSItem {
  code: string;
  name: string;
  group: string;
  balance: number;
}

interface BalanceSheetData {
  assets: BSItem[];
  liabilities: BSItem[];
  equity: BSItem[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

// ─── Options (Busy filter parity) ────────────────────────────────────
type Options = {
  showSecondLevelGroups: boolean;    // Show Second Level Group Details
  groupsAndAmountsInColumns: boolean;// Show Groups and Amounts in separate columns
  showZeroBalance: boolean;          // Show Zero Balance Masters During Drill Down
  skipPnlForPeriod: boolean;         // Skip 'P/L for the period' ?
  scaleFactor: 1 | 10 | 100 | 1000 | 10000 | 100000 | 10000000; // Specify Scale Factor
};

const OPTIONS_KEY = "sunsea:balance-sheet:options:v1";

const isoDate = (d: Date) => d.toISOString().split("T")[0];
const today = new Date();
const fyStartYear = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
const DEFAULT_START = isoDate(new Date(fyStartYear, 3, 1));
const DEFAULT_END = isoDate(today);

const DEFAULT_OPTIONS: Options = {
  showSecondLevelGroups: true,
  groupsAndAmountsInColumns: true,
  showZeroBalance: false,
  skipPnlForPeriod: false,
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

// Divide amount by scale factor for display; use formatAmount when scale=1,
// else round to whole units (Busy convention for scaled reports).
const fmt = (n: number, scale: number = 1) => {
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

const BalanceSheetPage: React.FC = () => {
  // ─── Committed state (drives the fetch + table render) ──────────────
  const [startDate, setStartDate] = useState<string>(DEFAULT_START);
  const [endDate, setEndDate] = useState<string>(DEFAULT_END);
  const [options, setOptions] = useState<Options>(() => {
    const saved = loadSavedOptions();
    return saved ? { ...DEFAULT_OPTIONS, ...saved } : DEFAULT_OPTIONS;
  });
  // Persist on every change so next open starts with the last-picked values.
  useEffect(() => { saveOptions(options); }, [options]);

  // ─── Options dialog (opens on mount, closes after F2/OK) ────────────
  const [showOptionsDialog, setShowOptionsDialog] = useState<boolean>(true);
  const [draftStartDate, setDraftStartDate] = useState<string>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<string>(endDate);
  const [draftOptions, setDraftOptions] = useState<Options>(options);
  const setOpt = <K extends keyof Options>(k: K, v: Options[K]) =>
    setDraftOptions((prev) => ({ ...prev, [k]: v }));

  // Focus first field (Starting Date) whenever the dialog opens.
  useEffect(() => {
    if (!showOptionsDialog) return;
    setDraftStartDate(startDate);
    setDraftEndDate(endDate);
    setDraftOptions(options);
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('input[name="bsStartDate"]')?.focus();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOptionsDialog]);

  // ─── Fetch — cached + socket-synced ─────────────────────────────────
  const groupByCategoryParam = options.groupsAndAmountsInColumns || options.showSecondLevelGroups;
  const cacheKey = `accounts:balance-sheet:${endDate}:${options.showZeroBalance}:${groupByCategoryParam}`;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<BalanceSheetData> => {
      const params = new URLSearchParams({
        asOnDate: endDate,
        showZeroBalance: String(options.showZeroBalance),
        groupByCategory: String(groupByCategoryParam),
      });
      const res = await apiClient.get(`/accounts/balance-sheet?${params.toString()}`, { signal });
      return res.data.data as BalanceSheetData;
    },
    [endDate, options.showZeroBalance, groupByCategoryParam]
  );

  const { data, loading, refreshing, refresh } = useDetailCache<BalanceSheetData>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
  });

  // ─── Commit / Apply (F2) ────────────────────────────────────────────
  const commitOptions = useCallback(() => {
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setOptions(draftOptions);
    setShowOptionsDialog(false);
  }, [draftStartDate, draftEndDate, draftOptions]);

  // F2 anywhere while dialog is open → submit; Esc while table is
  // visible → re-open dialog (Busy convention).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2" && showOptionsDialog) {
        e.preventDefault();
        commitOptions();
      } else if (e.key === "Escape" && !showOptionsDialog) {
        // Only reopen if focus isn't inside a text input consuming Esc
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setShowOptionsDialog(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOptionsDialog, commitOptions]);

  // ─── Derived T-format view (LIABILITIES + EQUITY on left, ASSETS on right) ──
  const groupItems = (items: BSItem[]): Array<{ group: string; items: BSItem[]; groupTotal: number }> => {
    const buckets: Record<string, BSItem[]> = {};
    items.forEach((it) => {
      const g = it.group || "Others";
      if (!buckets[g]) buckets[g] = [];
      buckets[g].push(it);
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, gitems]) => ({
        group,
        items: gitems.sort((a, b) => (a.name || "").localeCompare(b.name || "")),
        groupTotal: gitems.reduce((s, i) => s + i.balance, 0),
      }));
  };

  const view = useMemo(() => {
    if (!data) return null;
    // Left side: liabilities + equity groups. Skip P/L for the period rows
    // when that toggle is on (Busy: hides "Profit for the period" row).
    let equityForLeft = data.equity;
    if (options.skipPnlForPeriod) {
      equityForLeft = data.equity.filter((it) =>
        !/profit.*loss|net profit|net loss/i.test(it.name || "") && it.code !== "NET-PNL"
      );
    }
    const leftGroups = [
      ...groupItems(data.liabilities),
      ...groupItems(equityForLeft),
    ].sort((a, b) => a.group.localeCompare(b.group));

    const rightGroups = groupItems(data.assets);

    const leftTotal = leftGroups.reduce((s, g) => s + g.groupTotal, 0);
    const rightTotal = rightGroups.reduce((s, g) => s + g.groupTotal, 0);

    return {
      leftGroups,
      rightGroups,
      leftTotal,
      rightTotal,
      isBalanced: Math.abs(leftTotal - rightTotal) < 0.01,
    };
  }, [data, options.skipPnlForPeriod]);

  // ─── Row navigation — column-aware ─────────────────────────────────
  // Down/Up walks WITHIN the current side; Left/Right jumps between the
  // LIABILITIES and ASSETS columns (matching Busy's T-format flow).
  //   nav.side  = "L" or "R"
  //   nav.idx   = row index within that side's flat rows
  type Side = "L" | "R";
  const [nav, setNav] = useState<{ side: Side; idx: number }>({ side: "L", idx: -1 });
  const navRef = useRef(nav);
  useEffect(() => { navRef.current = nav; }, [nav]);

  // Build the per-side flat row lists (used for both keyboard bounds AND for
  // rendering). Kept here (not inside the render) so length is available for
  // key handlers without re-computing.
  type FlatRow = { kind: "group" | "item"; name: string; balance: number; code?: string };
  const { leftRows, rightRows } = useMemo(() => {
    if (!view) return { leftRows: [] as FlatRow[], rightRows: [] as FlatRow[] };
    const expand = (g: { group: string; items: BSItem[]; groupTotal: number }): FlatRow[] => [
      { kind: "group", name: g.group, balance: g.groupTotal },
      ...(options.showSecondLevelGroups
        ? g.items.map((i) => ({ kind: "item" as const, name: i.name, balance: i.balance, code: i.code }))
        : []),
    ];
    return {
      leftRows: view.leftGroups.flatMap(expand),
      rightRows: view.rightGroups.flatMap(expand),
    };
  }, [view, options.showSecondLevelGroups]);

  // Auto-select first row when table becomes visible.
  useEffect(() => {
    if (showOptionsDialog) return;
    if (nav.idx < 0 && (leftRows.length > 0 || rightRows.length > 0)) {
      setNav({ side: leftRows.length > 0 ? "L" : "R", idx: 0 });
    }
  }, [showOptionsDialog, leftRows.length, rightRows.length, nav.idx]);
  // Scroll highlighted row into view (min-scroll pattern, same as ledger).
  useEffect(() => {
    if (nav.idx < 0) return;
    const row = document.querySelector<HTMLElement>(`[data-bs-row="${nav.side}-${nav.idx}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [nav]);

  // Table arrow-key handler — only active while the dialog is closed.
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

  // ─── Export / Print ─────────────────────────────────────────────────
  const handlePrint = () => window.print();
  const exportCSV = () => {
    if (!view) return;
    const lines: string[][] = [];
    lines.push(["Balance Sheet"]);
    lines.push(["At the end of:", displayDate(endDate)]);
    lines.push([]);
    lines.push(["LIABILITIES", "Amount", "ASSETS", "Amount"]);
    const maxRows = Math.max(view.leftGroups.length, view.rightGroups.length);
    for (let i = 0; i < maxRows; i++) {
      const l = view.leftGroups[i];
      const r = view.rightGroups[i];
      lines.push([
        l ? l.group : "",
        l ? formatAmount(l.groupTotal / options.scaleFactor) : "",
        r ? r.group : "",
        r ? formatAmount(r.groupTotal / options.scaleFactor) : "",
      ]);
    }
    lines.push([]);
    lines.push(["Total", formatAmount(view.leftTotal / options.scaleFactor), "Total", formatAmount(view.rightTotal / options.scaleFactor)]);
    const csv = lines.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-sheet-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="p-2 font-sans text-ink" style={{ minHeight: "calc(100vh - 100px)" }}>
      {/* Top action bar — hidden while the filter dialog is open so the
         background stays clean (matches Busy: opening the filter clears the
         screen and shows only the filter card). */}
      {!showOptionsDialog && (
      <div className="bg-card rounded border border-line px-3 py-1.5 mb-2 flex items-center gap-3">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaBalanceScale className="text-red-500 text-sm" /> Balance Sheet
        </h3>
        {view && (
          <span className="text-[11px] text-ink-muted">
            At the end of <b className="text-ink">{displayDate(endDate)}</b>
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

      {/* ─── T-Format Table (Busy-style) ─────────────────────────────── */}
      {!showOptionsDialog && (
        <>
          {!view && loading && (
            <div className="bg-card border border-line rounded p-12 text-center text-xs text-ink-subtle">
              Loading…
            </div>
          )}
          {!view && !loading && (
            <div className="bg-card border border-line rounded p-12 text-center text-xs text-ink-subtle">
              <FaBalanceScale className="text-red-500/40 text-3xl mx-auto mb-2" />
              No data for the selected period.
            </div>
          )}
          {view && (
            <div
              className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
              style={{ height: "calc(100vh - 200px)" }}
            >
              {/* "At the end of : date" strip */}
              <div className="px-3 py-1 border-b border-line text-[11px] text-ink-muted shrink-0">
                At the end of : <b className="text-ink">{displayDate(endDate)}</b>
              </div>

              {/* Scrollable body — sticky header + sticky footer keep totals
                 pinned as the operator arrow-keys through long ledgers. */}
              <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-head border-b-2 border-line">
                    <th className="px-3 py-1 text-[11px] font-bold uppercase text-blue-600 border-r border-line w-[38%] bg-head" style={{ letterSpacing: "0.15em" }}>L I A B I L I T I E S</th>
                    <th className="px-3 py-1 text-[11px] font-bold text-right text-ink border-r border-line w-[12%] bg-head">Amount ({options.scaleFactor === 1 ? "₹" : `₹ × ${options.scaleFactor}`})</th>
                    <th className="px-3 py-1 text-[11px] font-bold uppercase text-blue-600 border-r border-line w-[38%] bg-head" style={{ letterSpacing: "0.15em" }}>A S S E T S</th>
                    <th className="px-3 py-1 text-[11px] font-bold text-right text-ink w-[12%] bg-head">Amount ({options.scaleFactor === 1 ? "₹" : `₹ × ${options.scaleFactor}`})</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Zip left & right rows for the T layout. leftRows /
                    // rightRows are memoised at the component level (used by
                    // both the render and the keyboard nav handler).
                    const maxLen = Math.max(leftRows.length, rightRows.length);
                    const rows: React.ReactElement[] = [];
                    for (let i = 0; i < maxLen; i++) {
                      const L = leftRows[i];
                      const R = rightRows[i];
                      const lHl = nav.side === "L" && nav.idx === i;
                      const rHl = nav.side === "R" && nav.idx === i;

                      const isLPnl = L && /profit.*loss|net profit|net loss/i.test(L.name);
                      const lPnlClass = isLPnl
                        ? (L!.balance >= 0 ? "text-emerald-600" : "text-red-600")
                        : "text-ink";

                      rows.push(
                        <tr key={`row-${i}`} className="border-b border-line-soft/60 hover:bg-card-2/40">
                          {/* LEFT SIDE */}
                          {L ? (
                            <>
                              <td
                                data-bs-row={`L-${i}`}
                                className={`px-3 py-0.5 text-[11px] border-r border-line-soft/50 ${
                                  L.kind === "group"
                                    ? `font-bold uppercase ${isLPnl ? lPnlClass : "text-ink"}`
                                    : "pl-6 text-ink-muted"
                                } ${lHl ? "bg-black text-white" : ""}`}
                              >
                                {L.name}
                              </td>
                              <td
                                className={`px-3 py-0.5 text-[11px] text-right font-mono border-r border-line-soft/50 ${
                                  L.kind === "group" ? `font-bold ${lPnlClass}` : "text-ink-muted"
                                } ${lHl ? "bg-black text-white" : ""}`}
                              >
                                {L.balance !== 0 && (
                                  <>{L.balance < 0 && isLPnl ? "-" : ""}{fmt(Math.abs(L.balance), options.scaleFactor)}</>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                              <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                            </>
                          )}
                          {/* RIGHT SIDE */}
                          {R ? (
                            <>
                              <td
                                data-bs-row={`R-${i}`}
                                className={`px-3 py-0.5 text-[11px] border-r border-line-soft/50 ${
                                  R.kind === "group"
                                    ? "font-bold uppercase text-ink"
                                    : "pl-6 text-ink-muted"
                                } ${rHl ? "bg-black text-white" : ""}`}
                              >
                                {R.name}
                              </td>
                              <td
                                className={`px-3 py-0.5 text-[11px] text-right font-mono ${
                                  R.kind === "group" ? "font-bold text-ink" : "text-ink-muted"
                                } ${rHl ? "bg-black text-white" : ""}`}
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
                    return rows;
                  })()}
                  {/* Filler rows so the grid always looks full even when
                     the data is sparse — matches the Payment/Receipt list
                     pages' Busy-style layout. */}
                  {(() => {
                    const maxLen = Math.max(leftRows.length, rightRows.length);
                    const need = Math.max(0, 25 - maxLen);
                    return Array.from({ length: need }).map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-line-soft/60">
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        <td className="px-3 py-0.5">&nbsp;</td>
                      </tr>
                    ));
                  })()}
                </tbody>
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="bg-card-2 border-t-2 border-line">
                    <td className="px-3 py-1 text-[11px] font-bold uppercase text-ink border-r border-line bg-card-2">Total</td>
                    <td className={`px-3 py-1 text-[12px] text-right font-mono font-bold border-r border-line bg-card-2 ${view.isBalanced ? "text-ink" : "text-red-600"}`}>
                      {fmt(view.leftTotal, options.scaleFactor)}
                    </td>
                    <td className="px-3 py-1 text-[11px] font-bold uppercase text-ink border-r border-line bg-card-2">Total</td>
                    <td className={`px-3 py-1 text-[12px] text-right font-mono font-bold bg-card-2 ${view.isBalanced ? "text-ink" : "text-red-600"}`}>
                      {fmt(view.rightTotal, options.scaleFactor)}
                    </td>
                  </tr>
                  {!view.isBalanced && (
                    <tr className="bg-red-500/5">
                      <td colSpan={4} className="px-3 py-1 text-[11px] text-center text-red-600 font-semibold bg-red-500/5">
                        Not balanced · Difference: ₹{fmt(Math.abs(view.leftTotal - view.rightTotal), options.scaleFactor)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
              </div>

              <div className="px-3 py-1 text-[10px] text-ink-subtle italic border-t border-line bg-card-2/40 flex items-center gap-3 shrink-0">
                <span><kbd className="px-1 border border-line rounded bg-card">↑ ↓</kbd> nav</span>
                <span><kbd className="px-1 border border-line rounded bg-card">Home / End</kbd> jump</span>
                <span><kbd className="px-1 border border-line rounded bg-card">Esc</kbd> filters</span>
                <span className="ml-auto">[ Esc - Quit ] [ Enter - Details ]</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Options Dialog (Busy-style) ─────────────────────────────── */}
      {showOptionsDialog && (
        <div className="fixed top-[80px] left-4 z-30 w-[420px] max-w-[95vw]">
          <div className="bg-card border border-line rounded-md shadow-2xl w-full overflow-hidden flex flex-col">
            {/* Red header */}
            <div className="text-white text-[11px] font-bold uppercase tracking-wide flex items-center justify-between px-2 py-1 border-b border-line bg-red-600/90 shrink-0">
              <span className="flex-1 text-center">Balance Sheet</span>
            </div>

            {/* Body — 12-col grid, compact Busy density */}
            <div className="px-3 py-2 overflow-auto grid grid-cols-12 gap-x-2 gap-y-1 text-[11px] items-center">
              {/* Starting Date */}
              <label className="col-span-6 text-ink-subtle font-semibold">Starting Date</label>
              <div className="col-span-6">
                <DatePickerCalendar
                  name="bsStartDate"
                  value={draftStartDate}
                  onChange={(e) => setDraftStartDate(e.target.value)}
                />
              </div>

              {/* Ending Date */}
              <label className="col-span-6 text-ink-subtle font-semibold">Ending Date</label>
              <div className="col-span-6">
                <DatePickerCalendar
                  name="bsEndDate"
                  value={draftEndDate}
                  onChange={(e) => setDraftEndDate(e.target.value)}
                />
              </div>

              {/* Y/N toggles — Busy layout: label (col-9) + Y/N select (col-3). */}
              {(() => {
                type Row = { key: keyof Options; label: string };
                const rows: Row[] = [
                  { key: "showSecondLevelGroups", label: "Show Second Level Group Details" },
                  { key: "groupsAndAmountsInColumns", label: "Show Groups and Amounts in separate columns" },
                  { key: "showZeroBalance", label: "Show Zero Balance Masters During Drill Down" },
                  { key: "skipPnlForPeriod", label: "Skip 'P/L for the period' ?" },
                ];
                return rows.map((r) => (
                  <React.Fragment key={r.key}>
                    <label className="col-span-9 font-semibold text-ink-subtle">
                      {r.label}
                    </label>
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

              {/* Specify Scale Factor */}
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

              {/* Cur. String (Busy placeholder — grayed) */}
              <label className="col-span-6 text-ink-subtle/50 font-semibold italic">Cur. String</label>
              <div className="col-span-6 text-[10px] text-ink-subtle/50 italic">—</div>
            </div>

            {/* Footer — OK(F2) button + hint */}
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

export default BalanceSheetPage;
