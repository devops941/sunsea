import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUserFriends,
  FaSync,
  FaPrint,
  FaDownload,
  FaPlay,
  FaSearch,
  FaColumns,
  FaTimes,
} from "react-icons/fa";
import apiClient from "../../../../api/apiClient";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useDetailCache } from "../../../../hooks/useDetailCache";
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts";
import type { CustomerReceivableSummary } from "../../../../services/receivableService";
import { formatAmount } from "../../../../utils/pricingUtils";

// ─── Options ────────────────────────────────────────────────────────
type ShownBy = "name" | "code";
type Options = {
  shownBy: ShownBy;
  showZeroBalance: boolean;
  showOverdueOnly: boolean;
  showType: boolean;
  /** When true, adds a "Mobile" column populated from Customer.mobile
   * (primary phone number extracted server-side). */
  showMobile: boolean;
};

// v2 key — v1 stored `showOverdueColumns` which no longer exists.
const OPTIONS_KEY = "sunsea:receivable:options:v2";
const DEFAULT_OPTIONS: Options = {
  shownBy: "name",
  showZeroBalance: false,
  showOverdueOnly: false,
  showType: true,
  showMobile: false,
};

const loadSaved = (): Partial<Options> | null => {
  try { const raw = localStorage.getItem(OPTIONS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const save = (o: Options) => { try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(o)); } catch { /* ignore */ } };

const fmt = (n: number) =>
  Math.abs(n) < 0.01 ? "" : formatAmount(Math.abs(n));
const displayDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};
const isoToday = () => new Date().toISOString().split("T")[0];

const AmountReceivablePage: React.FC = () => {
  const navigate = useNavigate();

  // ─── Committed state ───────────────────────────────────────────
  const [asOnDate, setAsOnDate] = useState<string>(isoToday());
  const [options, setOptions] = useState<Options>(() => {
    const saved = loadSaved();
    return saved ? { ...DEFAULT_OPTIONS, ...saved } : DEFAULT_OPTIONS;
  });
  useEffect(() => { save(options); }, [options]);

  // ─── Options dialog — persisted view (see BalanceSheetPage for docs).
  // Re-entering after a previous commit lands on the table, not a fresh
  // modal. Esc walks table → options → close (if data) or navigate back.
  const VIEW_KEY = "sunsea:receivable:view";
  const [showOptionsDialog, setShowOptionsDialog] = useState<boolean>(() => {
    try { return sessionStorage.getItem(VIEW_KEY) !== "table"; } catch { return true; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(VIEW_KEY, showOptionsDialog ? "options" : "table"); } catch { /* ignore */ }
  }, [showOptionsDialog]);
  const [draftAsOnDate, setDraftAsOnDate] = useState<string>(asOnDate);
  const [draftOptions, setDraftOptions] = useState<Options>(options);
  const setOpt = <K extends keyof Options>(k: K, v: Options[K]) =>
    setDraftOptions((prev) => ({ ...prev, [k]: v }));

  // ─── Inline row-search + Columns popover (table view only) ─────
  // These are the "change filter" controls Busy shows in the table
  // toolbar so the operator can re-narrow rows or toggle columns
  // without re-opening the whole Options dialog.
  const [rowSearch, setRowSearch] = useState<string>("");
  const [showColumnsMenu, setShowColumnsMenu] = useState<boolean>(false);
  const rowSearchRef = useRef<HTMLInputElement>(null);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  // Click-to-sort on Customer / Net Balance headers.
  // See AmountPayablePage for the rationale — mirrored here for symmetry.
  const SORT_KEY = "sunsea:receivable:sort:v1";
  type SortKey = "name" | "balance";
  type SortDir = "asc" | "desc";
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>(() => {
    try {
      const raw = sessionStorage.getItem(SORT_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if ((p.key === "name" || p.key === "balance") && (p.dir === "asc" || p.dir === "desc")) return p;
      }
    } catch { /* ignore */ }
    return { key: "name" as SortKey, dir: "asc" as SortDir };
  });
  useEffect(() => {
    try { sessionStorage.setItem(SORT_KEY, JSON.stringify(sort)); } catch { /* ignore */ }
  }, [sort]);
  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: key === "balance" ? "desc" : "asc" };
    });
  }, []);

  useEffect(() => {
    if (!showColumnsMenu) return;
    const onClick = (e: MouseEvent) => {
      if (!columnsMenuRef.current?.contains(e.target as Node)) setShowColumnsMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showColumnsMenu]);

  useEffect(() => {
    if (!showOptionsDialog) return;
    setDraftAsOnDate(asOnDate);
    setDraftOptions(options);
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('input[name="arAsOnDate"]')?.focus();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOptionsDialog]);

  // ─── Fetch (cached + socket-synced) ────────────────────────────
  const cacheKey = `accounts:receivable:${asOnDate}`;
  const fetcher = useCallback(async (signal: AbortSignal): Promise<CustomerReceivableSummary[]> => {
    const res = await apiClient.get("/accounts/receivable", { params: { asOnDate }, signal });
    const list = res.data?.data ?? res.data ?? [];
    return Array.isArray(list) ? list : (list.data ?? []);
  }, [asOnDate]);
  const { data, loading, refreshing, refresh } = useDetailCache<CustomerReceivableSummary[]>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
  });
// F5 = refresh (centralised via usePageShortcuts).  usePageShortcuts({ onRefresh: refresh });

  // ─── Filtered + sorted rows ────────────────────────────────────
  const rows = useMemo<CustomerReceivableSummary[]>(() => {
    let list = data ?? [];
    if (!options.showZeroBalance) list = list.filter((r) => Math.abs(r.netBalance) > 0.01);
    if (options.showOverdueOnly) list = list.filter((r) => r.isOverdue);
    const q = rowSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        (r.firmName || "").toLowerCase().includes(q) ||
        (r.customerCode || "").toLowerCase().includes(q) ||
        (r.customerType || "").toLowerCase().includes(q)
      );
    }
    // Click-to-sort — name (A→Z / Z→A) or balance (Highest / Lowest).
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sort.key === "balance") {
        cmp = (a.netBalance || 0) - (b.netBalance || 0);
      } else {
        const aStr = options.shownBy === "code" ? (a.customerCode || "") : (a.firmName || "");
        const bStr = options.shownBy === "code" ? (b.customerCode || "") : (b.firmName || "");
        cmp = aStr.localeCompare(bStr);
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [data, options.showZeroBalance, options.showOverdueOnly, options.shownBy, rowSearch, sort]);

  const totals = useMemo(() => {
    // Only signed Net Balance total is shown in the footer now — Debit /
    // Credit split columns were dropped per the simplified UI spec.
    // Overdue amount is still summed for the badge on the status line.
    const net = rows.reduce((s, r) => s + (r.netBalance || 0), 0);
    const overdue = rows.reduce((s, r) => s + (r.overdueAmount || 0), 0);
    return { net, overdue };
  }, [rows]);

  // ─── Commit + F2 + Esc ─────────────────────────────────────────
  const commitOptions = useCallback(() => {
    setAsOnDate(draftAsOnDate);
    setOptions(draftOptions);
    setShowOptionsDialog(false);
  }, [draftAsOnDate, draftOptions]);

  // Modal nav stack — Esc walks: table → options → navigate away.
  // Uses refs so the listener registers once and doesn't fight stale-state races.
  const showOptionsDialogRef = useRef(showOptionsDialog);
  const rowSearchValRef = useRef(rowSearch);
  useEffect(() => { showOptionsDialogRef.current = showOptionsDialog; }, [showOptionsDialog]);
  useEffect(() => { rowSearchValRef.current = rowSearch; }, [rowSearch]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2" && showOptionsDialogRef.current) {
        e.preventDefault();
        e.stopPropagation();
        commitOptions();
        return;
      }
      if (e.key === "F3" && !showOptionsDialogRef.current) {
        e.preventDefault();
        e.stopPropagation();
        rowSearchRef.current?.focus();
        rowSearchRef.current?.select();
        return;
      }
      if (e.key !== "Escape") return;
      // Esc inside the search input just clears + blurs.
      if (e.target === rowSearchRef.current) {
        e.preventDefault();
        e.stopPropagation();
        if (rowSearchValRef.current) setRowSearch("");
        else rowSearchRef.current?.blur();
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      e.stopPropagation();
      if (!showOptionsDialogRef.current) {
        setShowOptionsDialog(true);
      } else {
        navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commitOptions, navigate]);

  // ─── Row keyboard nav ──────────────────────────────────────────
  const [rowIdx, setRowIdx] = useState<number>(-1);
  const rowIdxRef = useRef(rowIdx);
  useEffect(() => { rowIdxRef.current = rowIdx; }, [rowIdx]);
  useEffect(() => {
    if (showOptionsDialog) return;
    if (rowIdx < 0 && rows.length > 0) setRowIdx(0);
  }, [showOptionsDialog, rows.length, rowIdx]);
  useEffect(() => {
    if (rowIdx < 0) return;
    document.querySelector<HTMLElement>(`[data-ar-row="${rowIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [rowIdx]);
  useEffect(() => {
    if (showOptionsDialog) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const max = rows.length - 1;
      const cur = rowIdxRef.current;
      if (e.key === "ArrowDown") { e.preventDefault(); setRowIdx(Math.min(cur + 1, max)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setRowIdx(Math.max(cur - 1, 0)); }
      else if (e.key === "Home") { e.preventDefault(); setRowIdx(0); }
      else if (e.key === "End") { e.preventDefault(); setRowIdx(max); }
      else if (e.key === "PageDown") { e.preventDefault(); setRowIdx(Math.min(cur + 10, max)); }
      else if (e.key === "PageUp") { e.preventDefault(); setRowIdx(Math.max(cur - 10, 0)); }
      else if (e.key === "Enter" && cur >= 0 && rows[cur]) {
        e.preventDefault();
        navigate(`/accounts/receivable/${rows[cur].customerId}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOptionsDialog, rows, navigate]);

  // ─── Print / Export ────────────────────────────────────────────
  const handlePrint = () => window.print();
  const exportCSV = () => {
    if (!rows.length) return;
    const lines: string[][] = [];
    lines.push(["Amount Receivable"]);
    lines.push(["As On:", displayDate(asOnDate)]);
    lines.push([]);
    const header = ["Customer"];
    if (options.showType) header.push("Type");
    if (options.showMobile) header.push("Mobile");
    header.push("Net Balance", "Last Transaction");
    lines.push(header);
    for (const r of rows) {
      const line: string[] = [options.shownBy === "code" ? r.customerCode : r.firmName];
      if (options.showType) line.push(r.customerType || "");
      if (options.showMobile) line.push(r.phone || "");
      line.push(fmt(r.netBalance), r.lastTransactionDate ? displayDate(r.lastTransactionDate) : "");
      lines.push(line);
    }
    lines.push([]);
    const totalLine: string[] = ["TOTAL"];
    if (options.showType) totalLine.push("");
    if (options.showMobile) totalLine.push("");
    totalLine.push(fmt(totals.net), "");
    lines.push(totalLine);
    const csv = lines.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amount-receivable-${asOnDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    // `data-escape-guarded` opts out of the global Esc→back shortcut so
    // our own handler owns the local modal-stack nav.
    <div data-escape-guarded className="p-2 font-sans text-ink" style={{ minHeight: "calc(100vh - 100px)" }}>
      {!showOptionsDialog && (
      <div className="bg-card rounded border border-line px-3 py-1.5 mb-2 flex items-center gap-3">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaUserFriends className="text-red-500 text-sm" /> Amount Receivable
        </h3>
        <span className="text-[13px] text-ink-muted">
          As On <b className="text-ink">{displayDate(asOnDate)}</b>
          <span className="text-ink-subtle"> · </span>
          <b className="text-ink">{rows.length} customer{rows.length === 1 ? "" : "s"}</b>
        </span>
        {refreshing && (
          <span className="flex items-center gap-1 text-[13px] text-red-400">
            <FaSync className="animate-spin" /> Syncing…
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Inline row search — F3 to focus, matches Busy's Search-F3. */}
          <div className="relative">
            <FaSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-ink-subtle" />
            <input
              ref={rowSearchRef}
              type="text"
              value={rowSearch}
              onChange={(e) => setRowSearch(e.target.value)}
              placeholder="Search name/code…"
              className="w-40 pl-6 pr-6 py-1 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
            />
            {rowSearch && (
              <button
                onClick={() => setRowSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink text-[13px]"
                title="Clear"
              >
                <FaTimes />
              </button>
            )}
          </div>

          {/* Columns — toggle column visibility inline. */}
          <div className="relative" ref={columnsMenuRef}>
            <button
              onClick={() => setShowColumnsMenu((s) => !s)}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[13px] font-semibold border border-line"
              title="Show / hide columns"
            >
              <FaColumns className="text-[13px]" /> Columns
            </button>
            {showColumnsMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-line rounded shadow-2xl z-30 py-1 text-[13px]">
                {([
                  { key: "showType", label: "Type" },
                  { key: "showMobile", label: "Mobile Number" },
                ] as { key: "showType" | "showMobile"; label: string }[]).map((c) => {
                  const on = options[c.key] as boolean;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setOptions((p) => ({ ...p, [c.key]: !on }))}
                      className={`w-full flex items-center gap-2 px-3 py-1 text-left hover:bg-card-2 ${
                        on ? "text-ink" : "text-ink-subtle"
                      }`}
                    >
                      <span className="w-3 text-center">{on ? "✓" : ""}</span>
                      <span>{c.label}</span>
                    </button>
                  );
                })}
                <div className="border-t border-line my-1"></div>
                {([
                  { key: "showZeroBalance", label: "Show Zero Balance" },
                  { key: "showOverdueOnly", label: "Show Only Overdue" },
                ] as { key: "showZeroBalance" | "showOverdueOnly"; label: string }[]).map((c) => {
                  const on = options[c.key] as boolean;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setOptions((p) => ({ ...p, [c.key]: !on }))}
                      className={`w-full flex items-center gap-2 px-3 py-1 text-left hover:bg-card-2 ${
                        on ? "text-ink" : "text-ink-subtle"
                      }`}
                    >
                      <span className="w-3 text-center">{on ? "✓" : ""}</span>
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowOptionsDialog(true)}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[13px] font-semibold border border-line"
            title="Change filters (Esc)"
          >
            Filters
          </button>
          <button onClick={handlePrint} disabled={!data}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[13px] font-semibold border border-line disabled:opacity-50">
            <FaPrint /> Print
          </button>
          <button onClick={exportCSV} disabled={!data}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[13px] font-semibold border border-line disabled:opacity-50">
            <FaDownload /> Export
          </button>
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-[13px] font-semibold border border-line disabled:opacity-50">
            <FaSync className={refreshing ? "animate-spin text-red-500" : ""} /> Refresh
          </button>
        </div>
      </div>
      )}

      {!showOptionsDialog && (
        <>
          {!data && loading && (
            <div className="bg-card border border-line rounded p-12 text-center text-xs text-ink-subtle">Loading…</div>
          )}
          {!data && !loading && (
            <div className="bg-card border border-line rounded p-12 text-center text-xs text-ink-subtle">
              <FaUserFriends className="text-red-500/40 text-3xl mx-auto mb-2" />
              No customers with outstanding balances.
            </div>
          )}
          {data && (
            <div
              className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
              style={{ height: "calc(100vh - 200px)" }}
            >
              <div className="px-3 py-1 border-b border-line text-[13px] text-ink-muted shrink-0 flex items-center justify-between">
                <span>As On : <b className="text-ink">{displayDate(asOnDate)}</b></span>
                <span className="text-ink font-semibold">
                  {options.showOverdueOnly ? "Overdue Only" : "All Receivables"}
                </span>
              </div>

              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-head border-b-2 border-line">
                      <th
                        onClick={() => toggleSort("name")}
                        title="Click to sort — A→Z / Z→A"
                        className="px-3 py-1 text-[13px] font-bold text-ink border-r border-line bg-head w-[38%] cursor-pointer select-none hover:bg-line/60"
                      >
                        {options.shownBy === "code" ? "Code / Customer" : "Customer"}
                        <span className="ml-1 text-[10px] text-ink-subtle">
                          {sort.key === "name" ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </th>
                      {options.showType && (
                        <th className="px-3 py-1 text-[13px] font-bold text-ink border-r border-line bg-head w-[14%]">Type</th>
                      )}
                      {options.showMobile && (
                        <th className="px-3 py-1 text-[13px] font-bold text-ink border-r border-line bg-head w-[18%]">Mobile</th>
                      )}
                      <th
                        onClick={() => toggleSort("balance")}
                        title="Click to sort — Highest / Lowest"
                        className="px-3 py-1 text-[13px] font-bold text-right text-ink border-r border-line bg-head w-[18%] cursor-pointer select-none hover:bg-line/60"
                      >
                        Net Balance
                        <span className="ml-1 text-[10px] text-ink-subtle">
                          {sort.key === "balance" ? (sort.dir === "desc" ? "▼" : "▲") : "⇅"}
                        </span>
                      </th>
                      {/* "Days" header preserved per spec — value below is the
                          date of the LAST transaction with this customer, not
                          an overdue-days count. */}
                      <th className="px-3 py-1 text-[13px] font-bold text-right text-ink bg-head w-[12%]">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const isHl = rowIdx === i;
                      const cls = isHl ? "bg-black text-white" : "";
                      return (
                        <tr
                          key={r.customerId}
                          data-ar-row={i}
                          onClick={() => setRowIdx(i)}
                          onDoubleClick={() => navigate(`/accounts/receivable/${r.customerId}`)}
                          className="border-b border-line-soft/60 hover:bg-card-2/40 cursor-pointer"
                          title="Double-click (or Enter) to drill into customer breakdown"
                        >
                          <td className={`px-3 py-0.5 text-[13px] border-r border-line-soft/50 uppercase ${cls}`}>
                            {options.shownBy === "code" ? (
                              <>
                                <span className="font-mono text-[13px] text-ink-subtle mr-2">{r.customerCode}</span>
                                {r.firmName}
                              </>
                            ) : (
                              r.firmName
                            )}
                          </td>
                          {options.showType && (
                            <td className={`px-3 py-0.5 text-[13px] border-r border-line-soft/50 uppercase text-ink-muted ${cls}`}>
                              {r.customerType || ""}
                            </td>
                          )}
                          {options.showMobile && (
                            <td className={`px-3 py-0.5 text-[13px] border-r border-line-soft/50 font-mono ${cls}`}>
                              {r.phone || ""}
                            </td>
                          )}
                          <td className={`px-3 py-0.5 text-[13px] text-right font-mono font-semibold border-r border-line-soft/50 ${
                            !isHl && r.netBalance > 0 ? "text-emerald-600" :
                            !isHl && r.netBalance < 0 ? "text-red-600" :
                            ""
                          } ${cls}`}>
                            {fmt(Math.abs(r.netBalance))}
                          </td>
                          <td className={`px-3 py-0.5 text-[13px] text-right font-mono ${
                            !isHl && r.isOverdue ? "text-red-600 font-semibold" : "text-ink-subtle"
                          } ${cls}`}>
                            {r.lastTransactionDate ? displayDate(r.lastTransactionDate) : ""}
                          </td>
                        </tr>
                      );
                    })}
                    {Array.from({ length: Math.max(0, 25 - rows.length) }).map((_, i) => (
                      <tr key={`ar-empty-${i}`} className="border-b border-line-soft/60">
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        {options.showType && <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>}
                        {options.showMobile && <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>}
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        <td className="px-3 py-0.5">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10">
                    <tr className="bg-card-2 border-t-2 border-line">
                      <td className="px-3 py-1 text-[13px] font-bold uppercase text-ink border-r border-line bg-card-2">TOTAL</td>
                      {options.showType && <td className="px-3 py-1 border-r border-line bg-card-2">&nbsp;</td>}
                      {options.showMobile && <td className="px-3 py-1 border-r border-line bg-card-2">&nbsp;</td>}
                      <td className="px-3 py-1 text-[13px] text-right font-mono font-bold text-ink border-r border-line bg-card-2">{fmt(Math.abs(totals.net))}</td>
                      <td className="px-3 py-1 bg-card-2">&nbsp;</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="px-3 py-1 text-[13px] border-t border-line bg-card-2/40 flex items-center gap-3 shrink-0 italic text-ink-subtle">
                <span><kbd className="px-1 border border-line rounded bg-card">↑ ↓</kbd> nav</span>
                <span><kbd className="px-1 border border-line rounded bg-card">Enter</kbd> drill</span>
                <span><kbd className="px-1 border border-line rounded bg-card">Esc</kbd> filters</span>
                <span className="ml-auto not-italic text-red-600 font-semibold">
                  Overdue: ₹{fmt(totals.overdue)}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Options Dialog ────────────────────────────────────── */}
      {showOptionsDialog && (
        <div className="fixed top-[80px] left-4 z-30 w-[420px] max-w-[95vw]">
          <div className="bg-card border border-line rounded-md shadow-2xl w-full overflow-hidden flex flex-col">
            <div className="text-white text-[13px] font-bold uppercase tracking-wide px-2 py-1 border-b border-line bg-red-600/90 text-center shrink-0">
              Amount Receivable
            </div>

            <div className="px-3 py-2 overflow-auto grid grid-cols-12 gap-x-2 gap-y-1 text-[13px] items-center">
              <label className="col-span-6 text-ink-subtle font-semibold">Report Date</label>
              <div className="col-span-6">
                <DatePickerCalendar
                  name="arAsOnDate"
                  value={draftAsOnDate}
                  onChange={(e) => setDraftAsOnDate(e.target.value)}
                />
              </div>

              <label className="col-span-9 text-ink-subtle font-semibold">Account to be shown by</label>
              <div className="col-span-3">
                <select
                  value={draftOptions.shownBy}
                  onChange={(e) => setOpt("shownBy", e.target.value as ShownBy)}
                  className="w-full px-1 py-0.5 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                >
                  <option value="name">Name</option>
                  <option value="code">Code</option>
                </select>
              </div>

              {(() => {
                type Row = { key: "showZeroBalance" | "showOverdueOnly" | "showType" | "showMobile"; label: string };
                const rows: Row[] = [
                  { key: "showZeroBalance", label: "Show Zero Balance Customers ?" },
                  { key: "showOverdueOnly", label: "Show Only Overdue ?" },
                  { key: "showType", label: "Show Type Column ?" },
                  { key: "showMobile", label: "Show Mobile Number ?" },
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
                        className="w-[50px] px-1 py-0.5 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                      >
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </div>
                  </React.Fragment>
                ));
              })()}
            </div>

            <div className="px-3 py-1.5 border-t border-line bg-card-2 flex items-center justify-between shrink-0 text-[13px]">
              <span className="text-ink-subtle italic">
                Press <b>F2</b> or click OK to load report · <b>Esc</b> to go back
              </span>
              <button
                onClick={commitOptions}
                className="px-3 py-0.5 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded flex items-center gap-1"
              >
                <FaPlay className="text-[9px]" /> OK (F2)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AmountReceivablePage;
