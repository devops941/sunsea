import React, { useState, useMemo, useCallback } from "react";
import {
  FaBalanceScale,
  FaSync,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPrint,
  FaDownload,
  FaChevronRight,
  FaChevronDown,
  FaFolderOpen,
  FaListUl,
  FaColumns,
  FaTh,
  FaFileAlt,
  FaSitemap,
} from "react-icons/fa";
import apiClient from "../../../../api/apiClient";
import { useDetailCache } from "../../../../hooks/useDetailCache";

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

type BSVariant =
  | "horizontal-summary"
  | "horizontal-detailed"
  | "vertical-summary"
  | "vertical-detailed"
  | "grouped-hierarchical"
  | "flat-alphabetical";

const VARIANT_MAP: Record<BSVariant, { label: string; layout: "horizontal" | "vertical" | "hierarchical" | "flat"; detailed: boolean }> = {
  "horizontal-summary": { label: "Horizontal · Summary", layout: "horizontal", detailed: false },
  "horizontal-detailed": { label: "Horizontal · Detailed", layout: "horizontal", detailed: true },
  "vertical-summary": { label: "Vertical · Summary", layout: "vertical", detailed: false },
  "vertical-detailed": { label: "Vertical · Detailed", layout: "vertical", detailed: true },
  "grouped-hierarchical": { label: "Hierarchical · Grouped", layout: "hierarchical", detailed: true },
  "flat-alphabetical": { label: "Flat · Alphabetical", layout: "flat", detailed: true },
};

const fmt = (n: number) =>
  Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BalanceSheetPage: React.FC = () => {
  const today = new Date().toISOString().split("T")[0];
  const [asOnDate, setAsOnDate] = useState<string>(today);
  const [showZeroBalance, setShowZeroBalance] = useState<boolean>(false);
  const [variant, setVariant] = useState<BSVariant>("horizontal-summary");
  const [expandSection, setExpandSection] = useState(true);
  const activeConfig = VARIANT_MAP[variant];

  const groupByCategoryParam = activeConfig.layout !== "flat";
  const cacheKey = `accounts:balance-sheet:${asOnDate}:${showZeroBalance}:${groupByCategoryParam}`;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<BalanceSheetData> => {
      const params = new URLSearchParams({
        ...(asOnDate ? { asOnDate } : {}),
        showZeroBalance: String(showZeroBalance),
        groupByCategory: String(groupByCategoryParam),
      });
      const res = await apiClient.get(`/accounts/balance-sheet?${params.toString()}`, { signal });
      return res.data.data as BalanceSheetData;
    },
    [asOnDate, showZeroBalance, groupByCategoryParam]
  );

  const { data, loading, refreshing, refresh } = useDetailCache<BalanceSheetData>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
  });

  const handleVariantClick = (v: BSVariant) => setVariant(v);

  const filterItems = (items: BSItem[]) =>
    showZeroBalance ? items : items.filter((i) => Math.abs(i.balance) > 0.01);

  const view = useMemo(() => {
    if (!data) return null;
    const assets = filterItems(data.assets);
    const liabilities = filterItems(data.liabilities);
    const equity = filterItems(data.equity);
    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
    const totalEquity = equity.reduce((s, e) => s + e.balance, 0);
    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  }, [data, showZeroBalance]);

  const groupItems = (items: BSItem[]): Record<string, BSItem[]> => {
    const buckets: Record<string, BSItem[]> = {};
    items.forEach((it) => {
      const g = it.group || "Others";
      if (!buckets[g]) buckets[g] = [];
      buckets[g].push(it);
    });
    return buckets;
  };

  const handlePrint = () => window.print();

  const exportCSV = () => {
    if (!view) return;
    const lines: string[][] = [];
    lines.push(["Balance Sheet - " + activeConfig.label]);
    lines.push(["As on:", asOnDate]);
    lines.push([]);
    ["Assets", "Liabilities", "Equity"].forEach((section) => {
      const items = section === "Assets" ? view.assets : section === "Liabilities" ? view.liabilities : view.equity;
      const total = section === "Assets" ? view.totalAssets : section === "Liabilities" ? view.totalLiabilities : view.totalEquity;
      lines.push([section.toUpperCase()]);
      lines.push(["Name", "Group", "Amount"]);
      items.forEach((it) => lines.push([it.name, it.group, it.balance.toFixed(2)]));
      lines.push(["", `Total ${section}`, total.toFixed(2)]);
      lines.push([]);
    });
    lines.push(["", "Total Liabilities + Equity", view.totalLiabilitiesAndEquity.toFixed(2)]);
    const csv = lines.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-sheet-${variant}-${asOnDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const menuItem = (v: BSVariant, icon: React.ReactNode) => (
    <button
      key={v}
      onClick={() => handleVariantClick(v)}
      className={`w-full text-left px-2 py-1 text-[11px] flex items-center gap-2 rounded transition-colors ${
        variant === v ? "bg-teal-500/15 text-teal-400 font-semibold" : "text-ink-muted hover:bg-card-2/60"
      }`}
    >
      <span className="text-[9px] opacity-70">{icon}</span>
      {VARIANT_MAP[v].label}
    </button>
  );

  const renderSectionTable = (title: string, items: BSItem[], total: number, accentColor: string) => {
    if (activeConfig.detailed) {
      const groups = groupItems(items);
      return (
        <div className="bg-card border border-line rounded-lg overflow-hidden">
          <div className={`px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between`}>
            <h3 className={`text-xs font-bold uppercase tracking-wide ${accentColor}`}>{title}</h3>
            <span className={`text-sm font-mono font-bold ${accentColor}`}>₹{fmt(total)}</span>
          </div>
          {items.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-subtle">No entries</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-head text-ink text-[10px] uppercase tracking-wide font-bold border-b border-line">
                <tr>
                  <th className="px-3 py-1.5">Account</th>
                  <th className="px-3 py-1.5 text-right w-[140px]">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([gname, gitems]) => {
                  const gtotal = gitems.reduce((s, i) => s + i.balance, 0);
                  // Profit & Loss row: green if profit (positive), red if loss (negative)
                  const isPnlGroup = /profit.*loss|net profit/i.test(gname);
                  const gtotalClass = isPnlGroup
                    ? (gtotal >= 0 ? "text-emerald-500" : "text-red-500")
                    : "text-ink";
                  return (
                    <React.Fragment key={gname}>
                      {activeConfig.layout === "hierarchical" && (
                        <tr className="bg-card-2/60">
                          <td className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${isPnlGroup ? gtotalClass : "text-ink"}`}>{gname}</td>
                          <td className={`px-3 py-1 text-right text-[11px] font-mono font-bold ${gtotalClass}`}>
                            {isPnlGroup && gtotal < 0 ? "-" : ""}₹{fmt(Math.abs(gtotal))}
                          </td>
                        </tr>
                      )}
                      {gitems.map((it) => {
                        const isPnlItem = /net profit|profit.*loss/i.test(it.name || "") || it.code === "NET-PNL";
                        const itClass = isPnlItem
                          ? (it.balance >= 0 ? "text-emerald-500" : "text-red-500")
                          : "text-ink";
                        return (
                          <tr key={it.code} className="hover:bg-card-2 transition-colors">
                            <td className={`py-1 text-xs ${itClass} ${activeConfig.layout === "hierarchical" ? "pl-6 pr-3" : "px-3"}`}>
                              {isPnlItem ? (it.balance >= 0 ? "Net Profit" : "Net Loss") : it.name}
                            </td>
                            <td className={`px-3 py-1 text-right text-xs font-mono ${itClass}`}>
                              {isPnlItem && it.balance < 0 ? "-" : ""}₹{fmt(Math.abs(it.balance))}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-card-2 border-t-2 border-line font-bold">
                  <td className="px-3 py-1.5 text-xs uppercase tracking-wide text-ink">Total {title}</td>
                  <td className={`px-3 py-1.5 text-right text-sm font-mono ${accentColor}`}>₹{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      );
    }

    // Summary mode — only show group totals (not individual accounts)
    const groups = groupItems(items);
    return (
      <div className="bg-card border border-line rounded-lg overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between">
          <h3 className={`text-xs font-bold uppercase tracking-wide ${accentColor}`}>{title}</h3>
          <span className={`text-sm font-mono font-bold ${accentColor}`}>₹{fmt(total)}</span>
        </div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-xs text-ink-subtle">No entries</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <tbody className="divide-y divide-line-soft">
              {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([gname, gitems]) => {
                const gtotal = gitems.reduce((s, i) => s + i.balance, 0);
                // Profit & Loss row: green if profit, red if loss
                const isPnl = /profit.*loss|net profit/i.test(gname);
                const cls = isPnl
                  ? (gtotal >= 0 ? "text-emerald-500 font-bold" : "text-red-500 font-bold")
                  : "text-ink";
                const label = isPnl ? (gtotal >= 0 ? "Profit & Loss (Net Profit)" : "Profit & Loss (Net Loss)") : gname;
                return (
                  <tr key={gname} className="hover:bg-card-2 transition-colors">
                    <td className={`px-3 py-1.5 text-xs font-semibold ${cls}`}>{label}</td>
                    <td className={`px-3 py-1.5 text-right text-xs font-mono ${cls}`}>
                      {isPnl && gtotal < 0 ? "-" : ""}₹{fmt(Math.abs(gtotal))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-card-2 border-t-2 border-line font-bold">
                <td className="px-3 py-1.5 text-xs uppercase tracking-wide text-ink">Total {title}</td>
                <td className={`px-3 py-1.5 text-right text-sm font-mono ${accentColor}`}>₹{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    );
  };

  const renderFlatAlphabetical = (v: NonNullable<typeof view>) => {
    const all = [
      ...v.assets.map((i) => ({ ...i, section: "Asset" })),
      ...v.liabilities.map((i) => ({ ...i, section: "Liability" })),
      ...v.equity.map((i) => ({ ...i, section: "Equity" })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div className="bg-card border border-line rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 200px)" }}>
        <div className="px-3 py-1.5 border-b border-line bg-card-2/50 text-[11px] shrink-0 flex items-center justify-between">
          <span className="text-ink-subtle">Flat alphabetical view · {all.length} accounts</span>
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-head text-ink text-[10px] uppercase tracking-wide font-bold border-b-2 border-line sticky top-0 z-10">
              <tr>
                <th className="px-3 py-1.5 bg-head">Account</th>
                <th className="px-3 py-1.5 bg-head">Section</th>
                <th className="px-3 py-1.5 bg-head">Group</th>
                <th className="px-3 py-1.5 bg-head text-right w-[140px]">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {all.map((it) => {
                const isPnl = /net profit|profit.*loss/i.test(it.name || "") || it.code === "NET-PNL";
                const cls = isPnl
                  ? (it.balance >= 0 ? "text-emerald-500 font-bold" : "text-red-500 font-bold")
                  : "text-ink";
                return (
                  <tr key={`${it.section}-${it.code}`} className="hover:bg-card-2/50 border-b border-line-soft">
                    <td className={`px-3 py-1 text-xs ${cls}`}>
                      {isPnl ? (it.balance >= 0 ? "Net Profit" : "Net Loss") : it.name}
                    </td>
                    <td className="px-3 py-1 text-[11px]">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        it.section === "Asset" ? "bg-blue-500/10 text-blue-500" :
                        it.section === "Liability" ? "bg-red-500/10 text-red-500" :
                        "bg-purple-500/10 text-purple-500"
                      }`}>{it.section}</span>
                    </td>
                    <td className="px-3 py-1 text-[11px] text-ink-muted">{it.group}</td>
                    <td className={`px-3 py-1 text-right text-xs font-mono ${cls}`}>
                      {isPnl && it.balance < 0 ? "-" : ""}₹{fmt(Math.abs(it.balance))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 font-sans text-ink flex gap-3" style={{ minHeight: "calc(100vh - 100px)" }}>
      {/* LEFT SIDEBAR */}
      <aside className="w-[240px] shrink-0 bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-2 border-b border-line bg-card-2 flex items-center gap-2">
          <FaBalanceScale className="text-teal-500 text-xs" />
          <h2 className="text-xs font-bold text-ink">Balance Sheet</h2>
        </div>
        <div className="p-2 space-y-2 text-xs overflow-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>
          <div>
            <button
              onClick={() => setExpandSection((x) => !x)}
              className="w-full flex items-center gap-1.5 text-[11px] font-bold text-ink px-1 py-1 hover:bg-card-2/60 rounded"
            >
              {expandSection ? <FaChevronDown className="text-[9px] text-ink-subtle" /> : <FaChevronRight className="text-[9px] text-ink-subtle" />}
              <FaFolderOpen className="text-[10px] text-teal-400" />
              Report Variants
            </button>
            {expandSection && (
              <div className="ml-2 mt-1 space-y-0.5 border-l border-line-soft pl-2">
                {menuItem("horizontal-summary", <FaColumns />)}
                {menuItem("horizontal-detailed", <FaListUl />)}
                {menuItem("vertical-summary", <FaTh />)}
                {menuItem("vertical-detailed", <FaListUl />)}
                {menuItem("grouped-hierarchical", <FaSitemap />)}
                {menuItem("flat-alphabetical", <FaFileAlt />)}
              </div>
            )}
          </div>

          <div className="border-t border-line-soft my-2"></div>

          <div className="text-[10px] text-ink-subtle italic px-1">
            <FaFileAlt className="inline mr-1" /> Click a variant to switch layout
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Options bar */}
        <div className="bg-card rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-3 sticky top-0 z-20">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
            <FaBalanceScale className="text-teal-500 text-sm" /> Balance Sheet
            <span className="text-[10px] font-medium text-ink-subtle uppercase tracking-wide">
              · {activeConfig.label}
            </span>
          </h3>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">As on Date</label>
            <input
              type="date"
              value={asOnDate}
              onChange={(e) => setAsOnDate(e.target.value)}
              className="w-[130px] px-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showZeroBalance} onChange={(e) => setShowZeroBalance(e.target.checked)}
              className="w-3.5 h-3.5 accent-teal-500" />
            <span className="text-xs text-ink-muted">Show Zero Balance</span>
          </label>

          {refreshing && (
            <span className="flex items-center gap-1 text-[10px] text-teal-400">
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
              <FaSync className={refreshing ? "animate-spin text-teal-500" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Report body — cache-first render (no loading blocker). */}
        {!view && !loading && (
          <div className="bg-card border border-line rounded-lg p-12 text-center text-xs text-ink-subtle">
            <FaBalanceScale className="text-teal-500/40 text-3xl mx-auto mb-2" />
            <div className="text-sm text-ink-muted font-semibold mb-1">No data for the selected variant</div>
            <div className="text-[11px]">Selected: <b>{activeConfig.label}</b></div>
          </div>
        )}

        {view && (
          <>
            {/* Meta banner */}
            <div className="text-[11px] text-ink-muted px-1">
              As on <b className="text-ink">{new Date(asOnDate).toLocaleDateString("en-IN")}</b> · <b className="text-ink">{activeConfig.label}</b>
            </div>

            {/* Body renders based on layout */}
            {activeConfig.layout === "flat" ? (
              renderFlatAlphabetical(view)
            ) : activeConfig.layout === "vertical" ? (
              <div className="space-y-3">
                {renderSectionTable("Assets", view.assets, view.totalAssets, "text-blue-500")}
                {renderSectionTable("Liabilities", view.liabilities, view.totalLiabilities, "text-red-500")}
                {renderSectionTable("Equity", view.equity, view.totalEquity, "text-purple-500")}
                <div className="bg-card border border-line rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-ink">Total Liabilities + Equity</span>
                  <span className="text-sm font-mono font-bold text-ink">₹{fmt(view.totalLiabilitiesAndEquity)}</span>
                </div>
              </div>
            ) : (
              // horizontal or hierarchical
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="space-y-3">
                  {renderSectionTable("Assets", view.assets, view.totalAssets, "text-blue-500")}
                </div>
                <div className="space-y-3">
                  {renderSectionTable("Liabilities", view.liabilities, view.totalLiabilities, "text-red-500")}
                  {renderSectionTable("Equity", view.equity, view.totalEquity, "text-purple-500")}
                  <div className="bg-card border border-line rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-ink">Total Liabilities + Equity</span>
                    <span className="text-sm font-mono font-bold text-ink">₹{fmt(view.totalLiabilitiesAndEquity)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Balance status footer */}
            <div className="bg-card border border-line rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">Balance Check</span>
              {view.isBalanced ? (
                <span className="flex items-center gap-1.5 text-[11px] text-teal-500 font-semibold">
                  <FaCheckCircle /> Balanced — Assets = Liabilities + Equity (₹{fmt(view.totalAssets)})
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] text-red-500 font-semibold">
                  <FaExclamationTriangle /> Not balanced · Diff: ₹{fmt(Math.abs(view.totalAssets - view.totalLiabilitiesAndEquity))}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right sidebar — Summary. Amounts render on their own row so
         crores-scale values never squeeze the label or overflow the card. */}
      {view && (
        <aside className="w-[220px] shrink-0 bg-card border border-line rounded-md shadow-sm overflow-hidden self-start">
          <div className="px-3 py-1.5 bg-card-2 border-b border-line text-[11px] font-bold uppercase tracking-wide text-ink flex items-center gap-1.5">
            <FaBalanceScale className="text-teal-500 text-xs" /> Summary
          </div>
          <div className="divide-y divide-line-soft">
            <div className="px-3 py-2">
              <div className="text-[11px] font-semibold text-ink-muted mb-1">Total Assets</div>
              <div className="text-sm font-mono font-bold text-blue-500 break-all leading-tight">
                ₹{fmt(view.totalAssets)}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[11px] font-semibold text-ink-muted mb-1">Total Liabilities</div>
              <div className="text-sm font-mono font-bold text-red-500 break-all leading-tight">
                ₹{fmt(view.totalLiabilities)}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[11px] font-semibold text-ink-muted mb-1">Total Equity</div>
              <div className="text-sm font-mono font-bold text-purple-500 break-all leading-tight">
                ₹{fmt(view.totalEquity)}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[11px] font-semibold text-ink-muted mb-1">Liabilities + Equity</div>
              <div className="text-sm font-mono font-bold text-ink break-all leading-tight">
                ₹{fmt(view.totalLiabilitiesAndEquity)}
              </div>
            </div>
            <div className={`px-3 py-2 ${view.isBalanced ? "bg-teal-500/5" : "bg-red-500/5"}`}>
              <div className="text-[11px] font-semibold text-ink-muted mb-1">Balance Check</div>
              {view.isBalanced ? (
                <div className="text-[12px] font-semibold text-teal-500 flex items-center gap-1">
                  <FaCheckCircle className="text-[10px]" /> Balanced
                </div>
              ) : (
                <>
                  <div className="text-[12px] font-semibold text-red-500 flex items-center gap-1 mb-1">
                    <FaExclamationTriangle className="text-[10px]" /> Not balanced
                  </div>
                  <div className="text-[11px] font-mono font-bold text-red-500 break-all leading-tight">
                    ₹{fmt(Math.abs(view.totalAssets - view.totalLiabilitiesAndEquity))}
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default BalanceSheetPage;
