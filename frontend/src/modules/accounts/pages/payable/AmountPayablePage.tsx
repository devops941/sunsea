import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaTruck,
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
import type { SupplierPayableSummary } from "../../../../services/payableService";
import { formatAmount } from "../../../../utils/pricingUtils";

// ─── Options ────────────────────────────────────────────────────────
type ShownBy = "name" | "code";
type Options = {
  shownBy: ShownBy;
  showZeroBalance: boolean;
  showOverdueOnly: boolean;
  showType: boolean;
  showOverdueColumns: boolean;
};

const OPTIONS_KEY = "sunsea:payable:options:v1";
const DEFAULT_OPTIONS: Options = {
  shownBy: "name",
  showZeroBalance: false,
  showOverdueOnly: false,
  showType: true,
  showOverdueColumns: true,
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

// Backend returns payable summaries either as a bare array OR as
// { data, total, page, totalPages }. Normalise here so the rest of the
// page can treat it as a flat array.
type PayableResponse = SupplierPayableSummary[] | { data: SupplierPayableSummary[] };
const asList = (r: PayableResponse): SupplierPayableSummary[] =>
  Array.isArray(r) ? r : (r?.data ?? []);

const AmountPayablePage: React.FC = () => {
  const navigate = useNavigate();

  const [asOnDate, setAsOnDate] = useState<string>(isoToday());
  const [options, setOptions] = useState<Options>(() => {
    const saved = loadSaved();
    return saved ? { ...DEFAULT_OPTIONS, ...saved } : DEFAULT_OPTIONS;
  });
  useEffect(() => { save(options); }, [options]);

  // ─── Options dialog — persisted view (see BalanceSheetPage for docs).
  // Re-entering after a previous commit lands on the table, not a fresh
  // modal. Esc walks table → options → close (if data) or navigate back.
  const VIEW_KEY = "sunsea:payable:view";
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

  // Inline row search + Columns popover — table-level "change filter"
  // controls so the operator can re-narrow rows / toggle columns without
  // re-opening the whole Options dialog (Busy convention).
  const [rowSearch, setRowSearch] = useState<string>("");
  const [showColumnsMenu, setShowColumnsMenu] = useState<boolean>(false);
  const rowSearchRef = useRef<HTMLInputElement>(null);
  const columnsMenuRef = useRef<HTMLDivElement>(null);
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
      document.querySelector<HTMLInputElement>('input[name="apAsOnDate"]')?.focus();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOptionsDialog]);

  // ─── Fetch ─────────────────────────────────────────────────────
  const cacheKey = `accounts:payable:${asOnDate}`;
  const fetcher = useCallback(async (signal: AbortSignal): Promise<SupplierPayableSummary[]> => {
    const res = await apiClient.get("/accounts/payable", { params: { asOnDate }, signal });
    const raw = res.data?.data ?? res.data ?? [];
    return asList(raw as PayableResponse);
  }, [asOnDate]);
  const { data, loading, refreshing, refresh } = useDetailCache<SupplierPayableSummary[]>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
  });
// F5 = refresh (centralised via usePageShortcuts).  usePageShortcuts({ onRefresh: refresh });

  const rows = useMemo<SupplierPayableSummary[]>(() => {
    let list = data ?? [];
    if (!options.showZeroBalance) list = list.filter((r) => Math.abs(r.balanceAsOnDate) > 0.01);
    if (options.showOverdueOnly) list = list.filter((r) => r.isOverdue);
    const q = rowSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        (r.legalName || "").toLowerCase().includes(q) ||
        (r.supplierCode || "").toLowerCase().includes(q) ||
        (r.vendorType || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) =>
      options.shownBy === "code"
        ? (a.supplierCode || "").localeCompare(b.supplierCode || "")
        : (a.legalName || "").localeCompare(b.legalName || "")
    );
  }, [data, options.showZeroBalance, options.showOverdueOnly, options.shownBy, rowSearch]);

  const totals = useMemo(() => {
    // For payables, positive balanceAsOnDate = we owe supplier (credit).
    // Split into Debit / Credit columns the way Busy shows them.
    const credit = rows.reduce((s, r) => s + Math.max(r.balanceAsOnDate, 0), 0);
    const debit = rows.reduce((s, r) => s + Math.max(-r.balanceAsOnDate, 0), 0);
    const overdue = rows.reduce((s, r) => s + (r.overdueAmount || 0), 0);
    return { debit, credit, overdue };
  }, [rows]);

  const commitOptions = useCallback(() => {
    setAsOnDate(draftAsOnDate);
    setOptions(draftOptions);
    setShowOptionsDialog(false);
  }, [draftAsOnDate, draftOptions]);

  // Modal nav stack — Esc walks: table → options → navigate away.
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

  const [rowIdx, setRowIdx] = useState<number>(-1);
  const rowIdxRef = useRef(rowIdx);
  useEffect(() => { rowIdxRef.current = rowIdx; }, [rowIdx]);
  useEffect(() => {
    if (showOptionsDialog) return;
    if (rowIdx < 0 && rows.length > 0) setRowIdx(0);
  }, [showOptionsDialog, rows.length, rowIdx]);
  useEffect(() => {
    if (rowIdx < 0) return;
    document.querySelector<HTMLElement>(`[data-ap-row="${rowIdx}"]`)?.scrollIntoView({ block: "nearest" });
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
        navigate(`/accounts/payable/${rows[cur].supplierId}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOptionsDialog, rows, navigate]);

  const handlePrint = () => window.print();
  const exportCSV = () => {
    if (!rows.length) return;
    const lines: string[][] = [];
    lines.push(["Amount Payable"]);
    lines.push(["As On:", displayDate(asOnDate)]);
    lines.push([]);
    const header = ["Supplier"];
    if (options.showType) header.push("Type");
    header.push("Debit", "Credit", "Net Balance");
    if (options.showOverdueColumns) header.push("Overdue", "Days");
    lines.push(header);
    for (const r of rows) {
      const line: string[] = [options.shownBy === "code" ? r.supplierCode : r.legalName];
      if (options.showType) line.push(r.vendorType || "");
      line.push(fmt(Math.max(-r.balanceAsOnDate, 0)), fmt(Math.max(r.balanceAsOnDate, 0)), fmt(r.balanceAsOnDate));
      if (options.showOverdueColumns) line.push(fmt(r.overdueAmount || 0), r.isOverdue && r.dueDays !== null ? String(r.dueDays) : "");
      lines.push(line);
    }
    lines.push([]);
    const totalLine: string[] = ["TOTAL"];
    if (options.showType) totalLine.push("");
    totalLine.push(fmt(totals.debit), fmt(totals.credit), fmt(totals.credit - totals.debit));
    if (options.showOverdueColumns) totalLine.push(fmt(totals.overdue), "");
    lines.push(totalLine);
    const csv = lines.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amount-payable-${asOnDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    // `data-escape-guarded` opts out of the global Esc→back shortcut so
    // our own handler owns the local modal-stack nav.
    <div data-escape-guarded className="p-2 font-sans text-ink" style={{ minHeight: "calc(100vh - 100px)" }}>
      {!showOptionsDialog && (
      <div className="bg-card rounded border border-line px-3 py-1.5 mb-2 flex items-center gap-3">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaTruck className="text-red-500 text-sm" /> Amount Payable
        </h3>
        <span className="text-[13px] text-ink-muted">
          As On <b className="text-ink">{displayDate(asOnDate)}</b>
          <span className="text-ink-subtle"> · </span>
          <b className="text-ink">{rows.length} supplier{rows.length === 1 ? "" : "s"}</b>
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
                  { key: "showOverdueColumns", label: "Overdue / Days" },
                ] as { key: "showType" | "showOverdueColumns"; label: string }[]).map((c) => {
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
              <FaTruck className="text-red-500/40 text-3xl mx-auto mb-2" />
              No suppliers with outstanding balances.
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
                  {options.showOverdueOnly ? "Overdue Only" : "All Payables"}
                </span>
              </div>

              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-head border-b-2 border-line">
                      <th className="px-3 py-1 text-[13px] font-bold text-ink border-r border-line bg-head w-[36%]">
                        {options.shownBy === "code" ? "Code / Supplier" : "Supplier"}
                      </th>
                      {options.showType && (
                        <th className="px-3 py-1 text-[13px] font-bold text-ink border-r border-line bg-head w-[14%]">Type</th>
                      )}
                      <th className="px-3 py-1 text-[13px] font-bold text-right text-ink border-r border-line bg-head w-[12%]">Debit</th>
                      <th className="px-3 py-1 text-[13px] font-bold text-right text-ink border-r border-line bg-head w-[12%]">Credit</th>
                      <th className="px-3 py-1 text-[13px] font-bold text-right text-ink border-r border-line bg-head w-[14%]">Net Balance</th>
                      {options.showOverdueColumns && (
                        <>
                          <th className="px-3 py-1 text-[13px] font-bold text-right text-ink border-r border-line bg-head w-[10%]">Overdue</th>
                          <th className="px-3 py-1 text-[13px] font-bold text-right text-ink bg-head w-[8%]">Days</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const isHl = rowIdx === i;
                      const cls = isHl ? "bg-black text-white" : "";
                      const debit = Math.max(-r.balanceAsOnDate, 0);
                      const credit = Math.max(r.balanceAsOnDate, 0);
                      return (
                        <tr
                          key={r.supplierId}
                          data-ap-row={i}
                          onClick={() => setRowIdx(i)}
                          onDoubleClick={() => navigate(`/accounts/payable/${r.supplierId}`)}
                          className="border-b border-line-soft/60 hover:bg-card-2/40 cursor-pointer"
                          title="Double-click (or Enter) to drill into supplier breakdown"
                        >
                          <td className={`px-3 py-0.5 text-[13px] border-r border-line-soft/50 uppercase ${cls}`}>
                            {options.shownBy === "code" ? (
                              <>
                                <span className="font-mono text-[13px] text-ink-subtle mr-2">{r.supplierCode}</span>
                                {r.legalName}
                              </>
                            ) : (
                              r.legalName
                            )}
                          </td>
                          {options.showType && (
                            <td className={`px-3 py-0.5 text-[13px] border-r border-line-soft/50 uppercase text-ink-muted ${cls}`}>
                              {r.vendorType || ""}
                            </td>
                          )}
                          <td className={`px-3 py-0.5 text-[13px] text-right font-mono border-r border-line-soft/50 ${cls}`}>
                            {fmt(debit)}
                          </td>
                          <td className={`px-3 py-0.5 text-[13px] text-right font-mono border-r border-line-soft/50 ${cls}`}>
                            {fmt(credit)}
                          </td>
                          <td className={`px-3 py-0.5 text-[13px] text-right font-mono font-semibold border-r border-line-soft/50 ${
                            !isHl && r.balanceAsOnDate > 0 ? "text-red-600" :
                            !isHl && r.balanceAsOnDate < 0 ? "text-emerald-600" :
                            ""
                          } ${cls}`}>
                            {fmt(Math.abs(r.balanceAsOnDate))}
                          </td>
                          {options.showOverdueColumns && (
                            <>
                              <td className={`px-3 py-0.5 text-[13px] text-right font-mono border-r border-line-soft/50 ${
                                !isHl && (r.overdueAmount || 0) > 0 ? "text-red-600" : ""
                              } ${cls}`}>
                                {fmt(r.overdueAmount || 0)}
                              </td>
                              <td className={`px-3 py-0.5 text-[13px] text-right font-mono ${
                                !isHl && r.isOverdue ? "text-red-600 font-semibold" : "text-ink-subtle"
                              } ${cls}`}>
                                {r.isOverdue && r.dueDays !== null ? r.dueDays : ""}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {Array.from({ length: Math.max(0, 25 - rows.length) }).map((_, i) => (
                      <tr key={`ap-empty-${i}`} className="border-b border-line-soft/60">
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        {options.showType && <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>}
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                        {options.showOverdueColumns && (
                          <>
                            <td className="px-3 py-0.5 border-r border-line-soft/50">&nbsp;</td>
                            <td className="px-3 py-0.5">&nbsp;</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10">
                    <tr className="bg-card-2 border-t-2 border-line">
                      <td className="px-3 py-1 text-[13px] font-bold uppercase text-ink border-r border-line bg-card-2">TOTAL</td>
                      {options.showType && <td className="px-3 py-1 border-r border-line bg-card-2">&nbsp;</td>}
                      <td className="px-3 py-1 text-[13px] text-right font-mono font-bold text-ink border-r border-line bg-card-2">{fmt(totals.debit)}</td>
                      <td className="px-3 py-1 text-[13px] text-right font-mono font-bold text-ink border-r border-line bg-card-2">{fmt(totals.credit)}</td>
                      <td className="px-3 py-1 text-[13px] text-right font-mono font-bold text-ink border-r border-line bg-card-2">{fmt(totals.credit - totals.debit)}</td>
                      {options.showOverdueColumns && (
                        <>
                          <td className="px-3 py-1 text-[13px] text-right font-mono font-bold text-red-600 border-r border-line bg-card-2">{fmt(totals.overdue)}</td>
                          <td className="px-3 py-1 bg-card-2">&nbsp;</td>
                        </>
                      )}
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
              Amount Payable
            </div>

            <div className="px-3 py-2 overflow-auto grid grid-cols-12 gap-x-2 gap-y-1 text-[13px] items-center">
              <label className="col-span-6 text-ink-subtle font-semibold">Report Date</label>
              <div className="col-span-6">
                <DatePickerCalendar
                  name="apAsOnDate"
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
                type Row = { key: "showZeroBalance" | "showOverdueOnly" | "showType" | "showOverdueColumns"; label: string };
                const rows: Row[] = [
                  { key: "showZeroBalance", label: "Show Zero Balance Suppliers ?" },
                  { key: "showOverdueOnly", label: "Show Only Overdue ?" },
                  { key: "showType", label: "Show Type Column ?" },
                  { key: "showOverdueColumns", label: "Show Overdue Columns ?" },
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

export default AmountPayablePage;
