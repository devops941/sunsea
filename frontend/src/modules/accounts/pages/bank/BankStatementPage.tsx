import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaUniversity, FaArrowLeft, FaSync, FaFilter, FaPrint } from "react-icons/fa";
import { toast } from "react-toastify";
import { accountService, type LedgerStatementResult } from "../../../../services/accountService";
import { displayVoucherNo } from "../../../../services/voucherService";
import { useListCache, invalidateCache } from "../../../../hooks/useListCache";
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts";
import { useSocketSync } from "../../../../hooks/useSocketSync";
import { useTableCellNav } from "../../../../hooks/useTableCellNav";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import { formatDateDMY } from "../../../../utils/dateUtils";
import { formatAmount } from "../../../../utils/pricingUtils";

// Busy-style pre-list filter for the bank/cash statement. Dynamic — works
// for every ledger the operator drills into (Cash, Main Bank, Petty Cash,
// user-created banks). Panel opens first, OK → statement view.
interface FilterOptions {
  startDate: string;
  endDate: string;
  showType: boolean;
  showNarration: boolean;
  showBalance: boolean;
}

const isoDate = (d: Date) => d.toISOString().split("T")[0];

const defaultFilters = (): FilterOptions => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    startDate: isoDate(monthStart),
    endDate: isoDate(today),
    showType: true,
    showNarration: true,
    showBalance: true,
  };
};

const BankStatementPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [applied, setApplied] = useState<FilterOptions>(() => defaultFilters());
  const [pending, setPending] = useState<FilterOptions>(() => defaultFilters());
  // Modal-as-page persistence — one key per bank account so switching
  // between bank statements doesn't cross-contaminate views.
  const VIEW_KEY = `sunsea:bank-statement:${id || "none"}:view`;
  const [panelOpen, setPanelOpen] = useState<boolean>(() => {
    try { return sessionStorage.getItem(VIEW_KEY) !== "table"; } catch { return true; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(VIEW_KEY, panelOpen ? "panel" : "table"); } catch { /* ignore */ }
  }, [VIEW_KEY, panelOpen]);

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
      // Table view Esc → walk back one page in history.
      // Filter panel open → close it (returns to table view; next Esc walks back).
      if (panelOpenRef.current) {
        setPanelOpen(false);
      } else {
        navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applied, navigate]);

  // Cache key MUST match the prefetch key fired from BankAccountsPage
  // (`accounts:bank-statement-${id}::`) so opening the detail page hits a
  // warm cache and renders with ZERO loading flash. Date range is applied
  // client-side further down so the network fetch happens once per ledger,
  // not once per (ledger + date range) combination.
  const cacheKey = `accounts:bank-statement-${id || "none"}::`;

  const fetcher = useCallback(
    async (_signal: AbortSignal) => {
      if (!id) return { data: [], total: 0 };
      try {
        // Fetch the FULL statement (no date filter) — client-side filter
        // trims to the applied range. One network trip covers every date
        // range the operator might pick.
        const result = await accountService.fetchStatement(parseInt(id, 10), {});
        return { data: result ? [result] : [], total: result?.entries?.length || 0 };
      } catch (err: any) {
        toast.error(err?.message || "Failed to load statement");
        throw err;
      }
    },
    [id]
  );

  const { data: statementList, loading, refreshing, refresh } = useListCache<LedgerStatementResult>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
    enabled: !!id,
  });
// F5 = refresh (centralised via usePageShortcuts).  usePageShortcuts({ onRefresh: refresh });

  // Balances shift on activity in many other modules too. Wire the extra
  // listeners so the bank statement stays live without needing a manual
  // refresh — matches the pattern on BankAccountsPage.
  const refreshOnEvent = useCallback(() => {
    invalidateCache(cacheKey);
    refresh();
  }, [cacheKey, refresh]);
  useSocketSync("accountLedger", undefined, refreshOnEvent);
  useSocketSync("journalItem", undefined, refreshOnEvent);
  useSocketSync("payment", undefined, refreshOnEvent);
  useSocketSync("pettyCashEntry", undefined, refreshOnEvent);
  useSocketSync("expense", undefined, refreshOnEvent);

  const rawData: LedgerStatementResult | null = statementList[0] || null;

  // ── Client-side filter — trims entries to the applied date range,
  //   recomputes opening + closing from the raw entries so the summary
  //   cards match what's rendered in the table.
  const data = useMemo<LedgerStatementResult | null>(() => {
    if (!rawData) return null;
    const start = applied.startDate ? new Date(applied.startDate).getTime() : null;
    // Include the WHOLE ending day so end date = 2026-09-03 covers
    // any timestamp on that date.
    const end = applied.endDate ? new Date(applied.endDate + "T23:59:59.999").getTime() : null;

    const all = [...(rawData.entries || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Opening for the range = running balance JUST BEFORE the first
    // entry inside the range. If nothing precedes the range, fall back
    // to the server's opening balance.
    let opening = rawData.openingBalance || 0;
    if (start != null) {
      const beforeStart = all.filter((e) => new Date(e.date).getTime() < start);
      if (beforeStart.length > 0) {
        opening = Number(beforeStart[beforeStart.length - 1].runningBalance || 0);
      }
    }

    const filteredEntries = all.filter((e) => {
      const t = new Date(e.date).getTime();
      if (start != null && t < start) return false;
      if (end != null && t > end) return false;
      return true;
    });

    // Closing = running balance of the last row inside the range.
    // If range is empty, closing = opening (nothing moved).
    const closing = filteredEntries.length > 0
      ? Number(filteredEntries[filteredEntries.length - 1].runningBalance || 0)
      : opening;

    return {
      ...rawData,
      openingBalance: opening,
      closingBalance: closing,
      entries: filteredEntries,
    };
  }, [rawData, applied.startDate, applied.endDate]);

  // Cell-level nav for the statement table. Columns are:
  //   0=Date, 1=Vch No, [Type if showType], Particulars, [Narration if showNarration],
  //   Debit, Credit, [Balance if showBalance]. Compute count from active flags.
  const stmtColCount = 5 // Date, Vch, Particulars, Debit, Credit (always)
    + (applied.showType ? 1 : 0)
    + (applied.showNarration ? 1 : 0)
    + (applied.showBalance ? 1 : 0);
  const { rowIdx: stmtRowIdx, colIdx: stmtColIdx, setCell: setStmtCell } = useTableCellNav({
    rowCount: data?.entries?.length ?? 0,
    colCount: stmtColCount,
    disabled: panelOpen,
  });

  // CSV export dataset — uses the FILTERED entries so the download always
  // matches what's on screen. Filename encodes ledger + date range.
  // Dates use the `="dd-mm-yyyy"` Excel-text prefix so Excel keeps the value
  // as text (dd-mm-yyyy) instead of auto-formatting to `########` in a
  // narrow numeric-date column.
  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Date", accessor: (e: any) => `="${formatDateDMY(e.date)}"` },
      { header: "Voucher No", accessor: (e: any) => displayVoucherNo(e.voucherNo) },
      { header: "Type", accessor: (e: any) => e.voucherType || "" },
      { header: "Particulars", accessor: (e: any) => e.particulars || "" },
      { header: "Narration", accessor: (e: any) => e.narration || "" },
      // Standard accounting: Debit = money in, Credit = money out. Matches
      // Customer/Supplier ledgers so the same voucher appears on OPPOSITE
      // sides in the two ledgers involved (proper double-entry visibility).
      { header: "Debit (₹)", accessor: (e: any) => e.debit || 0 },
      { header: "Credit (₹)", accessor: (e: any) => e.credit || 0 },
      { header: "Balance (₹)", accessor: (e: any) => e.runningBalance || 0 },
    ];
    const ledgerCode = data?.ledger?.code || "ledger";
    const range = `${applied.startDate || "all"}_to_${applied.endDate || "date"}`;
    return {
      csvData: data?.entries || [],
      csvColumns: columns,
      csvFilename: `Bank_Statement_${ledgerCode}_${range}.csv`,
    };
  }, [data, applied.startDate, applied.endDate]);

  // Print by opening a NEW WINDOW with clean HTML built from the current
  // filtered data. Reliable across browsers — bypasses the dark theme's CSS
  // variables that render as invisible ink on white paper. Also sets its own
  // <title> so the browser print header shows a meaningful name instead of
  // "SUNSEA - ERP" from the parent tab.
  const handlePrint = useCallback(() => {
    if (!data) return;
    const escape = (s: any) => String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const fmt = (n: number) => formatAmount(Number(n || 0));
    const ledgerName = data.ledger?.name || "Bank Statement";
    const rangeStr = applied.startDate || applied.endDate
      ? `${formatDateDMY(applied.startDate) || "…"} to ${formatDateDMY(applied.endDate) || "…"}`
      : "All transactions";

    const rows = (data.entries || []).map((e: any) => {
      const d = formatDateDMY(e.date);
      // Standard accounting: Debit column = money IN, Credit column = money OUT.
      const debit = e.debit > 0 ? fmt(e.debit) : "-";
      const credit = e.credit > 0 ? fmt(e.credit) : "-";
      const bal = Math.abs(Number(e.runningBalance || 0));
      const side = Number(e.runningBalance || 0) >= 0 ? "Dr" : "Cr";
      return `
        <tr>
          <td>${escape(d)}</td>
          <td>${escape(displayVoucherNo(e.voucherNo))}</td>
          <td>${escape(e.voucherType || "")}</td>
          <td>${escape(e.particulars || e.narration || "-")}</td>
          <td class="r">${escape(e.narration || "")}</td>
          <td class="r dr">${debit}</td>
          <td class="r cr">${credit}</td>
          <td class="r bal">₹ ${fmt(bal)} <span class="tiny">${side}</span></td>
        </tr>`;
    }).join("");

    // Minimal print — only what the user asked for:
    //   1. Account name  2. Period  3. Table
    // No summary cards, no "Printed on" footer, no extra chrome.
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escape(ledgerName)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 12px; color: #000; background: #fff; }
    h1 { font-size: 16px; margin: 0 0 3px; }
    .period { font-size: 11px; color: #333; margin-bottom: 10px; }
    .period b { color: #000; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead th { background: #eee; padding: 5px 6px; border: 1px solid #999; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    tbody td { padding: 4px 6px; border: 1px solid #999; }
    .r { text-align: right; font-family: monospace; }
    .dr { color: #047857; }
    .cr { color: #b91c1c; }
    .bal { font-weight: bold; color: #000; }
    .tiny { font-size: 9px; font-weight: normal; color: #555; margin-left: 2px; }
    .empty { text-align: center; padding: 24px; color: #666; font-style: italic; }
  </style>
</head>
<body>
  <h1>${escape(ledgerName)}</h1>
  <div class="period">Period: <b>${escape(rangeStr)}</b></div>
  ${data.entries.length === 0 ? `<div class="empty">No transactions in this period.</div>` : `
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Voucher No</th>
        <th>Type</th>
        <th>Particulars</th>
        <th>Narration</th>
        <th class="r">Debit (₹)</th>
        <th class="r">Credit (₹)</th>
        <th class="r">Balance (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`}
</body>
</html>`;

    // Blob URL avoids the deprecated document.write API and gives the new
    // window its own document context — CSS is fully isolated from the
    // parent tab's dark theme.
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "width=1100,height=800");
    if (!w) {
      URL.revokeObjectURL(url);
      toast.error("Print blocked — please allow popups for this site");
      return;
    }
    // Wait for the new window's HTML to fully load before triggering print.
    // Fallback timer in case `load` doesn't fire on some browsers.
    const trigger = () => {
      try { w.focus(); w.print(); } catch { /* ignore */ }
      setTimeout(() => {
        try { w.close(); } catch { /* ignore */ }
        URL.revokeObjectURL(url);
      }, 800);
    };
    w.addEventListener("load", trigger, { once: true });
    setTimeout(trigger, 1200);
  }, [data, applied.startDate, applied.endDate]);

  // ────── Busy-style pre-list filter dialog ──────
  // `data-escape-guarded` opts out of the global Esc→back shortcut.
  if (panelOpen) {
    return (
      <div data-escape-guarded className="p-3">
        <div className="w-full lg:w-[420px]">
          <div className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
            <div className="bg-blue-600/90 text-white text-[13px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
              Bank / Cash Statement Filter
            </div>
            <div className="p-4 space-y-2.5 text-[13px]">
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
                label="Show Type Column?"
                value={pending.showType}
                onChange={(v) => setPending({ ...pending, showType: v })}
              />
              <ToggleRow
                label="Show Narration?"
                value={pending.showNarration}
                onChange={(v) => setPending({ ...pending, showNarration: v })}
              />
              <ToggleRow
                label="Show Running Balance?"
                value={pending.showBalance}
                onChange={(v) => setPending({ ...pending, showBalance: v })}
              />

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setApplied(pending);
                    setPanelOpen(false);
                  }}
                  className="px-6 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-[13px] transition cursor-pointer"
                >
                  OK (F2)
                </button>
              </div>
              <div className="text-center text-[13px] text-ink-subtle italic pt-1">
                <kbd className="px-1 border border-line rounded bg-card text-[13px]">Esc</kbd> to quit ·
                {" "}<kbd className="px-1 border border-line rounded bg-card text-[13px]">F2</kbd> to submit
              </div>
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => navigate("/accounts/bank-accounts")}
                  className="text-[13px] text-ink-subtle hover:text-blue-600 underline"
                >
                  ← Back to Bank & Cash Accounts
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ────── Statement View ──────
  return (
    <div data-escape-guarded className="p-3 space-y-2 min-h-screen">
      {/* Header — title + applied filter breadcrumb + actions */}
      <div className="bg-card rounded-md border border-line shadow-sm px-3 py-1.5 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaUniversity className="text-blue-600 text-sm" />
          {data?.ledger?.name || "Bank Statement"}
          {data?.ledger && (
            <span className="text-[13px] uppercase tracking-wide font-mono text-ink-subtle">
              · {data.ledger.code} · {data.ledger.group}
            </span>
          )}
          {refreshing && <FaSync className="animate-spin text-blue-600 text-[13px]" />}
        </h2>
        <span className="text-[13px] text-ink-subtle italic">
          {applied.startDate || applied.endDate ? (
            <>
              From <b className="text-ink">{formatDateDMY(applied.startDate) || "…"}</b> to{" "}
              <b className="text-ink">{formatDateDMY(applied.endDate) || "…"}</b>
            </>
          ) : (
            <b className="text-ink">All transactions</b>
          )}
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
            <FaFilter className="text-[13px]" /> Change Filters
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line"
          >
            <FaSync className={refreshing ? "animate-spin text-blue-600" : ""} /> Refresh
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line cursor-pointer"
            title="Print current filtered view"
          >
            <FaPrint className="text-[13px]" /> Print
          </button>
          <ExportCSVButton
            data={csvData}
            columns={csvColumns}
            filename={csvFilename}
            text="Export"
          />
          <button
            onClick={() => navigate("/accounts/bank-accounts")}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold transition-all border border-line cursor-pointer"
          >
            <FaArrowLeft className="text-[13px]" /> Back
          </button>
        </div>
      </div>

      {/* Statement Table - compact */}
      <div className="bg-card rounded-md border border-line overflow-hidden shadow-sm">
        <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between gap-3 flex-wrap">
          {/* LEFT: table title + transactions count */}
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-ink">Transaction Statement</h2>
            <span className="text-[13px] text-ink-subtle font-mono">
              · {data?.entries.length || 0} entries
            </span>
          </div>
          {/* RIGHT: opening + closing balances inline */}
          {data && (
            <div className="flex items-center gap-4 text-[13px]">
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] uppercase tracking-wide font-semibold text-ink-subtle">Opening</span>
                <span className=" font-bold text-ink">
                  ₹{formatAmount(Math.abs(data.openingBalance))}
                  <span className="ml-1 text-[13px] text-ink-subtle">
                    {data.openingBalance >= 0 ? "Dr" : "Cr"}
                  </span>
                </span>
              </span>
              <span className="text-ink-subtle">|</span>
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] uppercase tracking-wide font-semibold text-ink-subtle">Closing</span>
                <span className={` font-bold ${data.closingBalance >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  ₹{formatAmount(Math.abs(data.closingBalance))}
                  <span className="ml-1 text-[13px]">
                    {data.closingBalance >= 0 ? "Dr" : "Cr"}
                  </span>
                </span>
              </span>
            </div>
          )}
        </div>

        {!data && loading ? (
          <div className="p-8 text-center text-xs text-ink-subtle">
            <span className="inline-flex items-center gap-2">
              <FaSync className="animate-spin text-blue-600 text-[13px]" />
              Loading statement…
            </span>
          </div>
        ) : !data || data.entries.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-subtle">No transactions found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink-muted border-collapse">
              <thead className="bg-head text-ink text-[13px] uppercase font-bold tracking-wide border-b border-line">
                <tr>
                  <th className="px-3 py-1.5 text-xs">Date</th>
                  <th className="px-3 py-1.5 text-xs">Voucher No</th>
                  {applied.showType && <th className="px-3 py-1.5 text-xs">Type</th>}
                  <th className="px-3 py-1.5 text-xs">Particulars</th>
                  {applied.showNarration && <th className="px-3 py-1.5 text-xs">Narration</th>}
                  <th className="px-3 py-1.5 text-xs text-right">Debit (₹)</th>
                  <th className="px-3 py-1.5 text-xs text-right">Credit (₹)</th>
                  {applied.showBalance && <th className="px-3 py-1.5 text-xs text-right">Balance (₹)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {data.entries.map((entry, idx) => {
                  // Column indices are dynamic based on which optional cols are shown.
                  let cursor = 0;
                  const dateCol = cursor++;
                  const vchCol = cursor++;
                  const typeCol = applied.showType ? cursor++ : -1;
                  const partCol = cursor++;
                  const narCol = applied.showNarration ? cursor++ : -1;
                  const drCol = cursor++;
                  const crCol = cursor++;
                  const balCol = applied.showBalance ? cursor++ : -1;
                  const isActiveRow = stmtRowIdx === idx;
                  const ringFor = (col: number) =>
                    isActiveRow && col >= 0 && stmtColIdx === col
                      ? " ring-2 ring-yellow-400 ring-inset"
                      : "";
                  const clickFor = (col: number) => (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (col >= 0) setStmtCell(idx, col);
                  };
                  return (
                    <tr
                      key={entry.id || idx}
                      className={`hover:bg-card-2 transition-colors ${isActiveRow ? "bg-card-2/60" : ""}`}
                    >
                      <td onClick={clickFor(dateCol)} className={`px-3 py-1.5 text-xs whitespace-nowrap font-mono${ringFor(dateCol)}`}>
                        {formatDateDMY(entry.date)}
                      </td>
                      <td onClick={clickFor(vchCol)} className={`px-3 py-1.5 text-xs font-mono font-medium text-blue-500${ringFor(vchCol)}`}>
                        {displayVoucherNo(entry.voucherNo)}
                      </td>
                      {applied.showType && (
                        <td onClick={clickFor(typeCol)} className={`px-3 py-1.5 text-xs${ringFor(typeCol)}`}>
                          <span className={`px-1.5 py-0.5 rounded text-[13px] font-bold uppercase ${
                            entry.voucherType === "RECEIPT" ? "bg-emerald-500/10 text-emerald-500" :
                            entry.voucherType === "PAYMENT" ? "bg-red-500/10 text-red-500" :
                            entry.voucherType === "CONTRA" ? "bg-purple-500/10 text-purple-500" :
                            entry.voucherType === "OPENING" ? "bg-amber-500/10 text-amber-500" :
                            "bg-blue-500/10 text-blue-500"
                          }`}>
                            {entry.voucherType}
                          </span>
                        </td>
                      )}
                      <td onClick={clickFor(partCol)} className={`px-3 py-1.5 text-xs text-ink max-w-xs truncate${ringFor(partCol)}`}>
                        {entry.particulars || entry.narration || "-"}
                      </td>
                      {applied.showNarration && (
                        <td onClick={clickFor(narCol)} className={`px-3 py-1.5 text-xs text-ink-subtle max-w-xs truncate${ringFor(narCol)}`}>
                          {entry.narration || "-"}
                        </td>
                      )}
                      {/* Standard accounting convention: Debit column shows
                          money IN (receipts, contra in) and Credit shows money
                          OUT (payments, contra out) — same as every other
                          ledger page. Keeps display consistent with double-entry
                          so the same transaction appears on OPPOSITE sides in
                          the two ledgers involved (e.g. Receipt shows Dr in
                          Bank Statement AND Cr in Customer Ledger). */}
                      <td onClick={clickFor(drCol)} className={`px-3 py-1.5 text-xs text-right font-mono${ringFor(drCol)}`}>
                        {entry.debit > 0 ? (
                          <span className="text-emerald-500 font-semibold">
                            {formatAmount(entry.debit)}
                          </span>
                        ) : "-"}
                      </td>
                      <td onClick={clickFor(crCol)} className={`px-3 py-1.5 text-xs text-right font-mono${ringFor(crCol)}`}>
                        {entry.credit > 0 ? (
                          <span className="text-red-500 font-semibold">
                            {formatAmount(entry.credit)}
                          </span>
                        ) : "-"}
                      </td>
                      {applied.showBalance && (
                        <td onClick={clickFor(balCol)} className={`px-3 py-1.5 text-xs text-right font-mono font-bold text-ink${ringFor(balCol)}`}>
                          ₹{formatAmount(Math.abs(entry.runningBalance))}
                          {/* Bank/Cash is an ASSET — natural side is Dr. Negative
                              running balance means the ledger sits on Cr (overdraft /
                              cash shortage). Show "Cr" so the sign matches accounting
                              convention. */}
                          {entry.runningBalance < 0 && <span className="text-[13px] text-red-500 ml-1">Cr</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Small presentational helpers for the filter panel ──
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
        className={`px-3 py-0.5 rounded text-[13px] font-mono font-bold border cursor-pointer ${
          value
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-card text-ink-muted border-line hover:bg-card-2"
        }`}
      >
        Y
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-0.5 rounded text-[13px] font-mono font-bold border cursor-pointer ${
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

export default BankStatementPage;
