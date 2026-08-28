import React, { useState, useMemo, useCallback } from "react";
import {
  FaSync,
  FaDownload,
  FaCheckCircle,
  FaExclamationTriangle,
  FaBalanceScale,
  FaPrint,
  FaChevronRight,
  FaChevronDown,
  FaFileAlt,
  FaFolderOpen,
  FaListUl,
  FaSitemap,
  FaSortAlphaDown,
} from "react-icons/fa";
import apiClient from "../../../../api/apiClient";
import { useDetailCache } from "../../../../hooks/useDetailCache";

interface TrialBalanceRow {
  ledgerId: number;
  code: string;
  name: string;
  type: string;
  group: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  debitBalance: number;
  creditBalance: number;
}

interface TrialBalanceData {
  rows: TrialBalanceRow[];
  totalDebitBalance: number;
  totalCreditBalance: number;
  isBalanced: boolean;
}

type ReportVariant =
  | "closing-alpha-balances"
  | "closing-alpha-detailed"
  | "closing-grouped-balances"
  | "closing-grouped-detailed"
  | "closing-hierarchical-balances"
  | "closing-hierarchical-detailed"
  | "opening-alpha"
  | "opening-grouped"
  | "opening-hierarchical";

const fmt = (n: number) =>
  n > 0 ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

const fmtSigned = (n: number) =>
  Math.abs(n) < 0.01 ? "" : Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const VARIANT_MAP: Record<ReportVariant, {
  label: string;
  category: "closing" | "opening";
  layout: "alpha" | "grouped" | "hierarchical";
  detailed: boolean;
}> = {
  "closing-alpha-balances": { label: "Alphabetical · Balances", category: "closing", layout: "alpha", detailed: false },
  "closing-alpha-detailed": { label: "Alphabetical · Detailed", category: "closing", layout: "alpha", detailed: true },
  "closing-grouped-balances": { label: "Grouped · Balances", category: "closing", layout: "grouped", detailed: false },
  "closing-grouped-detailed": { label: "Grouped · Detailed", category: "closing", layout: "grouped", detailed: true },
  "closing-hierarchical-balances": { label: "Hierarchical · Balances", category: "closing", layout: "hierarchical", detailed: false },
  "closing-hierarchical-detailed": { label: "Hierarchical · Detailed", category: "closing", layout: "hierarchical", detailed: true },
  "opening-alpha": { label: "Alphabetical", category: "opening", layout: "alpha", detailed: false },
  "opening-grouped": { label: "Grouped", category: "opening", layout: "grouped", detailed: false },
  "opening-hierarchical": { label: "Hierarchical", category: "opening", layout: "hierarchical", detailed: false },
};

const getFYStartDate = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 3, 1).toISOString().split("T")[0];
};

export const TrialBalancePage: React.FC = () => {
  const today = new Date().toISOString().split("T")[0];
  const [asOnDate, setAsOnDate] = useState<string>(today);
  const [showZeroBalance, setShowZeroBalance] = useState<boolean>(false);
  const [variant, setVariant] = useState<ReportVariant>("closing-grouped-balances");
  const [expandClosing, setExpandClosing] = useState(true);
  const [expandOpening, setExpandOpening] = useState(true);
  const activeConfig = VARIANT_MAP[variant];

  const dateParam = activeConfig.category === "opening" ? getFYStartDate() : asOnDate;
  const groupByCategoryParam = activeConfig.layout !== "alpha";
  const cacheKey = `accounts:trial-balance:${dateParam}:${showZeroBalance}:${groupByCategoryParam}`;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<TrialBalanceData> => {
      const params = new URLSearchParams({
        asOnDate: dateParam,
        showZeroBalance: String(showZeroBalance),
        sortBy: "name",
        groupByCategory: String(groupByCategoryParam),
      });
      const res = await apiClient.get(`/accounts/trial-balance?${params.toString()}`, { signal });
      return res.data.data as TrialBalanceData;
    },
    [dateParam, showZeroBalance, groupByCategoryParam]
  );

  const { data, loading, refreshing, refresh } = useDetailCache<TrialBalanceData>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
  });

  const handleVariantClick = (v: ReportVariant) => setVariant(v);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (!showZeroBalance) rows = rows.filter((r) => r.debitBalance > 0 || r.creditBalance > 0 || Math.abs(r.openingBalance) > 0.01);
    rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [data, showZeroBalance]);

  const grouped = useMemo(() => {
    if (activeConfig.layout === "alpha") return null;
    const buckets: Record<string, TrialBalanceRow[]> = {};
    for (const r of filteredRows) {
      const g = r.group || "Others";
      if (!buckets[g]) buckets[g] = [];
      buckets[g].push(r);
    }
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRows, activeConfig.layout]);

  const totals = useMemo(() => {
    const dr = filteredRows.reduce((s, r) => s + r.debitBalance, 0);
    const cr = filteredRows.reduce((s, r) => s + r.creditBalance, 0);
    return { dr, cr, isBalanced: Math.abs(dr - cr) < 0.01 };
  }, [filteredRows]);

  const handlePrint = () => window.print();

  const exportCSV = () => {
    if (!data) return;
    const cols = activeConfig.detailed
      ? ["Account/Group", "Group", "Opening Dr", "Opening Cr", "Debit", "Credit", "Closing Dr", "Closing Cr"]
      : ["Account/Group", "Debit Bal.", "Credit Bal."];
    const rowsArr: string[][] = [cols];
    filteredRows.forEach((r) => {
      if (activeConfig.detailed) {
        const opDr = r.openingBalance > 0 ? r.openingBalance : 0;
        const opCr = r.openingBalance < 0 ? -r.openingBalance : 0;
        rowsArr.push([
          r.name, r.group,
          fmtSigned(opDr), fmtSigned(opCr),
          fmtSigned(r.totalDebit), fmtSigned(r.totalCredit),
          fmt(r.debitBalance), fmt(r.creditBalance),
        ]);
      } else {
        rowsArr.push([r.name, fmt(r.debitBalance), fmt(r.creditBalance)]);
      }
    });
    const csv = rowsArr.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${variant}-${asOnDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const menuItem = (v: ReportVariant, icon: React.ReactNode) => (
    <button
      key={v}
      onClick={() => handleVariantClick(v)}
      className={`w-full text-left px-2 py-1 text-[11px] flex items-center gap-2 rounded transition-colors ${
        variant === v ? "bg-indigo-500/15 text-indigo-400 font-semibold" : "text-ink-muted hover:bg-card-2/60"
      }`}
    >
      <span className="text-[9px] opacity-70">{icon}</span>
      {VARIANT_MAP[v].label}
    </button>
  );

  return (
    <div className="p-3 font-sans text-ink flex gap-3" style={{ minHeight: "calc(100vh - 100px)" }}>
      {/* LEFT SIDEBAR — Busy-style report menu */}
      <aside className="w-[240px] shrink-0 bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-2 border-b border-line bg-card-2 flex items-center gap-2">
          <FaBalanceScale className="text-indigo-500 text-xs" />
          <h2 className="text-xs font-bold text-ink">Trial Balance</h2>
        </div>
        <div className="p-2 space-y-2 text-xs overflow-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>
          {/* Closing Trial group */}
          <div>
            <button
              onClick={() => setExpandClosing((x) => !x)}
              className="w-full flex items-center gap-1.5 text-[11px] font-bold text-ink px-1 py-1 hover:bg-card-2/60 rounded"
            >
              {expandClosing ? <FaChevronDown className="text-[9px] text-ink-subtle" /> : <FaChevronRight className="text-[9px] text-ink-subtle" />}
              <FaFolderOpen className="text-[10px] text-indigo-400" />
              Closing Trial
            </button>
            {expandClosing && (
              <div className="ml-2 mt-1 space-y-0.5 border-l border-line-soft pl-2">
                {menuItem("closing-alpha-balances", <FaSortAlphaDown />)}
                {menuItem("closing-alpha-detailed", <FaListUl />)}
                {menuItem("closing-grouped-balances", <FaFolderOpen />)}
                {menuItem("closing-grouped-detailed", <FaListUl />)}
                {menuItem("closing-hierarchical-balances", <FaSitemap />)}
                {menuItem("closing-hierarchical-detailed", <FaListUl />)}
              </div>
            )}
          </div>

          {/* Opening Trial group */}
          <div>
            <button
              onClick={() => setExpandOpening((x) => !x)}
              className="w-full flex items-center gap-1.5 text-[11px] font-bold text-ink px-1 py-1 hover:bg-card-2/60 rounded"
            >
              {expandOpening ? <FaChevronDown className="text-[9px] text-ink-subtle" /> : <FaChevronRight className="text-[9px] text-ink-subtle" />}
              <FaFolderOpen className="text-[10px] text-emerald-400" />
              Opening Trial
            </button>
            {expandOpening && (
              <div className="ml-2 mt-1 space-y-0.5 border-l border-line-soft pl-2">
                {menuItem("opening-alpha", <FaSortAlphaDown />)}
                {menuItem("opening-grouped", <FaFolderOpen />)}
                {menuItem("opening-hierarchical", <FaSitemap />)}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-line-soft my-2"></div>

          {/* Legend */}
          <div className="text-[10px] text-ink-subtle italic px-1">
            <FaFileAlt className="inline mr-1" /> Click a report to load
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL — options + report */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Options bar */}
        <div className="bg-card rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-3 sticky top-0 z-20">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
            {activeConfig.category === "opening" ? (
              <><FaFolderOpen className="text-emerald-500 text-sm" /> Opening Trial</>
            ) : (
              <><FaFolderOpen className="text-indigo-500 text-sm" /> Closing Trial</>
            )}
            <span className="text-[10px] font-medium text-ink-subtle uppercase tracking-wide">
              · {activeConfig.label}
            </span>
          </h3>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
              {activeConfig.category === "opening" ? "Fin. Year Start" : "As on Date"}
            </label>
            <input
              type="date"
              value={activeConfig.category === "opening" ? getFYStartDate() : asOnDate}
              onChange={(e) => setAsOnDate(e.target.value)}
              disabled={activeConfig.category === "opening"}
              className="w-[130px] px-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500 focus:outline-none disabled:opacity-70"
            />
          </div>

          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showZeroBalance} onChange={(e) => setShowZeroBalance(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-500" />
            <span className="text-xs text-ink-muted">Show Zero Balance</span>
          </label>

          {refreshing && (
            <span className="flex items-center gap-1 text-[10px] text-indigo-400">
              <FaSync className="animate-spin" /> Syncing…
            </span>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={handlePrint} disabled={!data}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line disabled:opacity-50">
              <FaPrint /> Print
            </button>
            <button onClick={exportCSV} disabled={!data}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line disabled:opacity-50">
              <FaDownload /> Export
            </button>
            <button onClick={refresh} disabled={refreshing}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line disabled:opacity-50">
              <FaSync className={refreshing ? "animate-spin text-indigo-500" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Body */}
        {loading && (
          <div className="bg-card border border-line rounded-lg p-8 text-center text-xs text-ink-subtle">
            <FaSync className="animate-spin text-indigo-500 text-lg mx-auto mb-1" />
            Loading trial balance...
          </div>
        )}

        {!loading && !data && (
          <div className="bg-card border border-line rounded-lg p-12 text-center text-xs text-ink-subtle">
            <FaBalanceScale className="text-indigo-500/40 text-3xl mx-auto mb-2" />
            <div className="text-sm text-ink-muted font-semibold mb-1">Choose a report variant from the sidebar</div>
            <div className="text-[11px]">Selected: <b>{activeConfig.label}</b></div>
          </div>
        )}

        {!loading && data && (
          <div className="bg-card border border-line rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 180px)" }}>
            {/* Meta bar */}
            <div className="px-3 py-1.5 border-b border-line bg-card-2/50 flex items-center justify-between text-[11px] shrink-0">
              <span className="text-ink-subtle">
                {activeConfig.category === "opening" ? "As On FY Start: " : "As On: "}
                <b className="text-ink">
                  {new Date(activeConfig.category === "opening" ? getFYStartDate() : asOnDate).toLocaleDateString("en-IN")}
                </b>
              </span>
              <span className="text-ink-subtle">{filteredRows.length} entries · {activeConfig.label}</span>
            </div>

            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-left border-collapse">
                <thead className="bg-head text-ink text-[11px] font-bold border-b-2 border-line sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 bg-head">Account / Group</th>
                    {activeConfig.detailed && (
                      <>
                        <th className="px-3 py-2 text-right w-[110px] bg-head text-[10px]">Opening Dr</th>
                        <th className="px-3 py-2 text-right w-[110px] bg-head text-[10px]">Opening Cr</th>
                        <th className="px-3 py-2 text-right w-[110px] bg-head text-[10px]">Debit</th>
                        <th className="px-3 py-2 text-right w-[110px] bg-head text-[10px]">Credit</th>
                      </>
                    )}
                    <th className="px-4 py-2 text-right w-[140px] bg-head">Closing Dr</th>
                    <th className="px-4 py-2 text-right w-[140px] bg-head">Closing Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={activeConfig.detailed ? 7 : 3} className="p-8 text-center text-xs text-ink-subtle">
                        No entries found.
                      </td>
                    </tr>
                  ) : activeConfig.layout !== "alpha" && grouped ? (
                    grouped.map(([gname, gitems]) => {
                      const gd = gitems.reduce((s, i) => s + i.debitBalance, 0);
                      const gc = gitems.reduce((s, i) => s + i.creditBalance, 0);
                      const gOpDr = gitems.reduce((s, i) => s + (i.openingBalance > 0 ? i.openingBalance : 0), 0);
                      const gOpCr = gitems.reduce((s, i) => s + (i.openingBalance < 0 ? -i.openingBalance : 0), 0);
                      const gDebit = gitems.reduce((s, i) => s + i.totalDebit, 0);
                      const gCredit = gitems.reduce((s, i) => s + i.totalCredit, 0);
                      return (
                        <React.Fragment key={gname}>
                          <tr className="bg-card-2 border-b border-line">
                            <td colSpan={activeConfig.detailed ? 7 : 3} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-400">
                              {activeConfig.layout === "hierarchical" ? <FaSitemap className="inline mr-1.5 text-[9px]" /> : null}
                              {gname}
                            </td>
                          </tr>
                          {gitems.map((row) => (
                            <tr key={row.ledgerId} className="hover:bg-card-2/50 border-b border-line-soft">
                              <td className="pl-8 pr-4 py-1 text-xs text-ink">{row.name}</td>
                              {activeConfig.detailed && (
                                <>
                                  <td className="px-3 py-1 text-right text-xs font-mono text-ink-muted">{fmtSigned(row.openingBalance > 0 ? row.openingBalance : 0)}</td>
                                  <td className="px-3 py-1 text-right text-xs font-mono text-ink-muted">{fmtSigned(row.openingBalance < 0 ? -row.openingBalance : 0)}</td>
                                  <td className="px-3 py-1 text-right text-xs font-mono text-emerald-500">{fmtSigned(row.totalDebit)}</td>
                                  <td className="px-3 py-1 text-right text-xs font-mono text-red-400">{fmtSigned(row.totalCredit)}</td>
                                </>
                              )}
                              <td className="px-4 py-1 text-right text-xs font-mono text-ink">{fmt(row.debitBalance)}</td>
                              <td className="px-4 py-1 text-right text-xs font-mono text-ink">{fmt(row.creditBalance)}</td>
                            </tr>
                          ))}
                          <tr className="bg-card-2/40 border-b border-line font-semibold">
                            <td className="pl-4 pr-4 py-1 text-[11px] italic text-ink-muted">Total {gname}</td>
                            {activeConfig.detailed && (
                              <>
                                <td className="px-3 py-1 text-right text-xs font-mono text-ink-muted">{fmtSigned(gOpDr)}</td>
                                <td className="px-3 py-1 text-right text-xs font-mono text-ink-muted">{fmtSigned(gOpCr)}</td>
                                <td className="px-3 py-1 text-right text-xs font-mono text-ink-muted">{fmtSigned(gDebit)}</td>
                                <td className="px-3 py-1 text-right text-xs font-mono text-ink-muted">{fmtSigned(gCredit)}</td>
                              </>
                            )}
                            <td className="px-4 py-1 text-right text-xs font-mono text-ink-muted">{fmt(gd)}</td>
                            <td className="px-4 py-1 text-right text-xs font-mono text-ink-muted">{fmt(gc)}</td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.ledgerId} className="hover:bg-card-2/50 border-b border-line-soft">
                        <td className="px-4 py-1 text-xs text-ink">{row.name}</td>
                        {activeConfig.detailed && (
                          <>
                            <td className="px-3 py-1 text-right text-xs font-mono text-ink-muted">{fmtSigned(row.openingBalance > 0 ? row.openingBalance : 0)}</td>
                            <td className="px-3 py-1 text-right text-xs font-mono text-ink-muted">{fmtSigned(row.openingBalance < 0 ? -row.openingBalance : 0)}</td>
                            <td className="px-3 py-1 text-right text-xs font-mono text-emerald-500">{fmtSigned(row.totalDebit)}</td>
                            <td className="px-3 py-1 text-right text-xs font-mono text-red-400">{fmtSigned(row.totalCredit)}</td>
                          </>
                        )}
                        <td className="px-4 py-1 text-right text-xs font-mono text-ink">{fmt(row.debitBalance)}</td>
                        <td className="px-4 py-1 text-right text-xs font-mono text-ink">{fmt(row.creditBalance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 border-t-2 border-line bg-card-2">
              <div className="flex items-center px-4 py-2">
                <span className="flex-1 text-xs font-bold uppercase tracking-wide text-ink">Grand Total</span>
                {activeConfig.detailed && (
                  <>
                    <span className="w-[110px] px-3 text-right text-xs font-mono text-ink-muted">
                      {fmtSigned(filteredRows.reduce((s, r) => s + (r.openingBalance > 0 ? r.openingBalance : 0), 0))}
                    </span>
                    <span className="w-[110px] px-3 text-right text-xs font-mono text-ink-muted">
                      {fmtSigned(filteredRows.reduce((s, r) => s + (r.openingBalance < 0 ? -r.openingBalance : 0), 0))}
                    </span>
                    <span className="w-[110px] px-3 text-right text-xs font-mono text-emerald-500">
                      {fmtSigned(filteredRows.reduce((s, r) => s + r.totalDebit, 0))}
                    </span>
                    <span className="w-[110px] px-3 text-right text-xs font-mono text-red-400">
                      {fmtSigned(filteredRows.reduce((s, r) => s + r.totalCredit, 0))}
                    </span>
                  </>
                )}
                <span className="w-[140px] text-right text-sm font-mono font-bold text-ink">
                  ₹ {totals.dr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="w-[140px] text-right text-sm font-mono font-bold text-ink">
                  ₹ {totals.cr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="px-4 py-1.5 border-t border-line-soft">
                {totals.isBalanced ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-semibold">
                    <FaCheckCircle /> Trial Balance is balanced (Dr = Cr)
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-red-500 font-semibold">
                    <FaExclamationTriangle /> Not balanced &middot; Difference: ₹ {Math.abs(totals.dr - totals.cr).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrialBalancePage;
