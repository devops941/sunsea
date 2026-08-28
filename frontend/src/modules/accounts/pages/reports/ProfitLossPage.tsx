import React, { useState, useCallback, useMemo } from "react";
import {
  FaSync,
  FaDownload,
  FaArrowUp,
  FaArrowDown,
  FaChartLine,
  FaPrint,
  FaChevronRight,
  FaChevronDown,
  FaFolderOpen,
  FaListUl,
  FaSortAlphaDown,
  FaSitemap,
  FaFileAlt,
  FaCalendarAlt,
} from "react-icons/fa";
import apiClient from "../../../../api/apiClient";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useDetailCache } from "../../../../hooks/useDetailCache";

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

interface PLPeriodAccount {
  ledgerId: number;
  code: string;
  name: string;
  group: string;
  perPeriod: number[];
  total: number;
}

interface PLPeriodData {
  groupBy: "month" | "quarter";
  startDate: string;
  endDate: string;
  periods: Array<{ key: string; label: string }>;
  incomeAccounts: PLPeriodAccount[];
  expenseAccounts: PLPeriodAccount[];
  totalIncomePerPeriod: number[];
  totalExpensePerPeriod: number[];
  netPerPeriod: number[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  isProfit: boolean;
}

type PLVariant =
  | "alpha-summary"
  | "alpha-detailed"
  | "grouped-summary"
  | "grouped-detailed"
  | "hierarchical"
  | "monthly"
  | "quarterly";

const VARIANT_MAP: Record<PLVariant, { label: string; layout: "alpha" | "grouped" | "hierarchical" | "monthly" | "quarterly"; detailed: boolean }> = {
  "alpha-summary": { label: "Alphabetical · Summary", layout: "alpha", detailed: false },
  "alpha-detailed": { label: "Alphabetical · Detailed", layout: "alpha", detailed: true },
  "grouped-summary": { label: "Grouped · Summary", layout: "grouped", detailed: false },
  "grouped-detailed": { label: "Grouped · Detailed", layout: "grouped", detailed: true },
  "hierarchical": { label: "Hierarchical", layout: "hierarchical", detailed: true },
  "monthly": { label: "Monthly Trend", layout: "monthly", detailed: false },
  "quarterly": { label: "Quarterly Trend", layout: "quarterly", detailed: false },
};

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ProfitLossPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const fyStart = `${currentYear}-04-01`;
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState<string>(fyStart);
  const [endDate, setEndDate] = useState<string>(today);
  const [showZeroBalance, setShowZeroBalance] = useState<boolean>(false);
  const [variant, setVariant] = useState<PLVariant>("grouped-summary");
  const [expandSection, setExpandSection] = useState(true);
  const activeConfig = VARIANT_MAP[variant];

  const isPeriodMode = activeConfig.layout === "monthly" || activeConfig.layout === "quarterly";
  const cacheKey = isPeriodMode
    ? `accounts:profit-loss:period:${startDate}:${endDate}:${activeConfig.layout}`
    : `accounts:profit-loss:${startDate}:${endDate}:${showZeroBalance}`;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PLData | PLPeriodData> => {
      if (isPeriodMode) {
        const params = new URLSearchParams();
        params.set("startDate", startDate);
        params.set("endDate", endDate);
        params.set("groupBy", activeConfig.layout === "monthly" ? "month" : "quarter");
        const res = await apiClient.get(`/accounts/profit-loss/by-period?${params.toString()}`, { signal });
        return res.data.data as PLPeriodData;
      }
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("showZeroBalance", String(showZeroBalance));
      const res = await apiClient.get(`/accounts/profit-loss?${params.toString()}`, { signal });
      return res.data.data as PLData;
    },
    [isPeriodMode, startDate, endDate, showZeroBalance, activeConfig.layout]
  );

  const { data: cached, loading, refreshing, refresh } = useDetailCache<PLData | PLPeriodData>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
  });

  const data = !isPeriodMode ? (cached as PLData | null) : null;
  const periodData = isPeriodMode ? (cached as PLPeriodData | null) : null;

  const handleVariantClick = (v: PLVariant) => setVariant(v);

  const filteredData = useMemo(() => {
    if (!data) return null;
    let income = showZeroBalance ? data.incomeAccounts : data.incomeAccounts.filter((a) => Math.abs(a.netAmount) > 0.01);
    let expense = showZeroBalance ? data.expenseAccounts : data.expenseAccounts.filter((a) => Math.abs(a.netAmount) > 0.01);
    if (activeConfig.layout === "alpha") {
      income = [...income].sort((a, b) => a.name.localeCompare(b.name));
      expense = [...expense].sort((a, b) => a.name.localeCompare(b.name));
    }
    return { ...data, incomeAccounts: income, expenseAccounts: expense };
  }, [data, showZeroBalance, activeConfig.layout]);

  const groupItems = (items: PLAccount[]): Array<[string, PLAccount[]]> => {
    const buckets: Record<string, PLAccount[]> = {};
    items.forEach((it) => {
      const g = it.group || "Others";
      if (!buckets[g]) buckets[g] = [];
      buckets[g].push(it);
    });
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
  };

  const handlePrint = () => window.print();

  const exportCSV = () => {
    if (!filteredData) return;
    const lines: string[][] = [];
    lines.push(["Profit & Loss Statement - " + activeConfig.label]);
    lines.push([`Period: ${startDate} to ${endDate}`]);
    lines.push([]);
    lines.push(["INCOME"]);
    lines.push(["Code", "Name", "Group", "Amount"]);
    filteredData.incomeAccounts.forEach((a) =>
      lines.push([a.code, a.name, a.group, a.netAmount.toFixed(2)])
    );
    lines.push(["", "Total Income", "", filteredData.totalIncome.toFixed(2)]);
    lines.push([]);
    lines.push(["EXPENSES"]);
    lines.push(["Code", "Name", "Group", "Amount"]);
    filteredData.expenseAccounts.forEach((a) =>
      lines.push([a.code, a.name, a.group, a.netAmount.toFixed(2)])
    );
    lines.push(["", "Total Expenses", "", filteredData.totalExpense.toFixed(2)]);
    lines.push([]);
    lines.push([
      "",
      filteredData.isProfit ? "Net Profit" : "Net Loss",
      "",
      Math.abs(filteredData.netProfit).toFixed(2),
    ]);

    const csv = lines.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-loss-${variant}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const menuItem = (v: PLVariant, icon: React.ReactNode) => (
    <button
      key={v}
      onClick={() => handleVariantClick(v)}
      className={`w-full text-left px-2 py-1 text-[11px] flex items-center gap-2 rounded transition-colors ${
        variant === v ? "bg-emerald-500/15 text-emerald-400 font-semibold" : "text-ink-muted hover:bg-card-2/60"
      }`}
    >
      <span className="text-[9px] opacity-70">{icon}</span>
      {VARIANT_MAP[v].label}
    </button>
  );

  const renderRow = (a: PLAccount, isIncome: boolean, indent = false) => (
    <tr key={`${isIncome ? "inc" : "exp"}-${a.ledgerId}`} className="hover:bg-card-2 border-b border-line-soft">
      {activeConfig.detailed && (
        <td className="px-3 py-1 text-[11px] font-mono text-ink-subtle">{a.code}</td>
      )}
      <td className={`px-3 py-1 text-xs text-ink ${indent ? "pl-6" : ""}`}>{a.name}</td>
      {activeConfig.detailed && (
        <td className="px-3 py-1 text-[11px] text-ink-muted">{a.group}</td>
      )}
      <td className={`px-3 py-1 text-right text-xs font-mono ${isIncome ? "text-emerald-500" : "text-red-500"}`}>
        {fmt(a.netAmount)}
      </td>
    </tr>
  );

  const renderSection = (items: PLAccount[], isIncome: boolean) => {
    const groups = activeConfig.layout === "grouped" || activeConfig.layout === "hierarchical" ? groupItems(items) : null;
    if (!groups) {
      // Alphabetical / flat rendering
      return items.map((a) => renderRow(a, isIncome, false));
    }
    return groups.flatMap(([gname, gitems]) => {
      const gtotal = gitems.reduce((s, i) => s + i.netAmount, 0);
      return [
        <tr key={`grp-${isIncome ? "i" : "e"}-${gname}`} className="bg-card-2/60">
          <td colSpan={activeConfig.detailed ? 3 : 1} className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink">
            {activeConfig.layout === "hierarchical" && <FaSitemap className="inline mr-1 text-[9px]" />}
            {gname}
          </td>
          <td className="px-3 py-1 text-right text-[11px] font-mono font-bold text-ink">
            {fmt(gtotal)}
          </td>
        </tr>,
        ...gitems.map((a) => renderRow(a, isIncome, true)),
      ];
    });
  };

  return (
    <div className="p-3 font-sans text-ink flex gap-3" style={{ minHeight: "calc(100vh - 100px)" }}>
      {/* LEFT SIDEBAR */}
      <aside className="w-[240px] shrink-0 bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-2 border-b border-line bg-card-2 flex items-center gap-2">
          <FaChartLine className="text-emerald-500 text-xs" />
          <h2 className="text-xs font-bold text-ink">Profit & Loss</h2>
        </div>
        <div className="p-2 space-y-2 text-xs overflow-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>
          <div>
            <button
              onClick={() => setExpandSection((x) => !x)}
              className="w-full flex items-center gap-1.5 text-[11px] font-bold text-ink px-1 py-1 hover:bg-card-2/60 rounded"
            >
              {expandSection ? <FaChevronDown className="text-[9px] text-ink-subtle" /> : <FaChevronRight className="text-[9px] text-ink-subtle" />}
              <FaFolderOpen className="text-[10px] text-emerald-400" />
              Report Variants
            </button>
            {expandSection && (
              <div className="ml-2 mt-1 space-y-0.5 border-l border-line-soft pl-2">
                {menuItem("alpha-summary", <FaSortAlphaDown />)}
                {menuItem("alpha-detailed", <FaListUl />)}
                {menuItem("grouped-summary", <FaFolderOpen />)}
                {menuItem("grouped-detailed", <FaListUl />)}
                {menuItem("hierarchical", <FaSitemap />)}
                <div className="pt-1 border-t border-line-soft mt-1"></div>
                {menuItem("monthly", <FaCalendarAlt />)}
                {menuItem("quarterly", <FaCalendarAlt />)}
              </div>
            )}
          </div>

          <div className="border-t border-line-soft my-2"></div>

          <div className="text-[10px] text-ink-subtle italic px-1">
            <FaFileAlt className="inline mr-1" /> Click a variant to load
          </div>
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Options bar */}
        <div className="bg-card rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-3 sticky top-0 z-20">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
            <FaChartLine className="text-emerald-500 text-sm" /> P&amp;L
            <span className="text-[10px] font-medium text-ink-subtle uppercase tracking-wide">
              · {activeConfig.label}
            </span>
          </h3>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">From</label>
            <div className="w-[130px]">
              <DatePickerCalendar
                name="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">To</label>
            <div className="w-[130px]">
              <DatePickerCalendar
                name="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End"
              />
            </div>
          </div>

          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showZeroBalance} onChange={(e) => setShowZeroBalance(e.target.checked)}
              className="w-3.5 h-3.5 accent-emerald-500" />
            <span className="text-xs text-ink-muted">Show Zero Balance</span>
          </label>

          {refreshing && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <FaSync className="animate-spin" /> Syncing…
            </span>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={handlePrint} disabled={!cached}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line disabled:opacity-50">
              <FaPrint /> Print
            </button>
            <button onClick={exportCSV} disabled={!cached}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line disabled:opacity-50">
              <FaDownload /> Export
            </button>
            <button onClick={refresh} disabled={refreshing}
              className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line disabled:opacity-50">
              <FaSync className={refreshing ? "animate-spin text-emerald-500" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Body */}
        {loading && (
          <div className="bg-card border border-line rounded-lg p-8 text-center text-xs text-ink-subtle">
            <FaSync className="animate-spin text-emerald-500 text-lg mx-auto mb-1" />
            Loading P&amp;L statement...
          </div>
        )}

        {!loading && !filteredData && (
          <div className="bg-card border border-line rounded-lg p-12 text-center text-xs text-ink-subtle">
            <FaChartLine className="text-emerald-500/40 text-3xl mx-auto mb-2" />
            <div className="text-sm text-ink-muted font-semibold mb-1">Choose a variant from the sidebar</div>
            <div className="text-[11px]">Selected: <b>{activeConfig.label}</b> · {startDate} to {endDate}</div>
          </div>
        )}

        {!loading && (activeConfig.layout === "monthly" || activeConfig.layout === "quarterly") && periodData && (
          <>
            <div className="text-[11px] text-ink-muted px-1">
              Period: <b className="text-ink">{startDate}</b> to <b className="text-ink">{endDate}</b> · <b className="text-ink">{activeConfig.label}</b> · {periodData.periods.length} periods
            </div>

            <div className="bg-card border border-line rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 200px)" }}>
              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-head text-ink text-[10px] uppercase tracking-wide font-bold border-b-2 border-line sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-1.5 bg-head sticky left-0 z-20 min-w-[200px]">Account</th>
                      {periodData.periods.map((p) => (
                        <th key={p.key} className="px-2 py-1.5 bg-head text-right min-w-[100px]">{p.label}</th>
                      ))}
                      <th className="px-3 py-1.5 bg-head text-right min-w-[120px] font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Income section */}
                    <tr className="bg-card-2">
                      <td colSpan={periodData.periods.length + 2} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-500">
                        <FaArrowUp className="inline mr-1.5 text-[10px]" /> Revenue / Income
                      </td>
                    </tr>
                    {periodData.incomeAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={periodData.periods.length + 2} className="p-4 text-center text-[11px] text-ink-subtle">No income</td>
                      </tr>
                    ) : (
                      periodData.incomeAccounts.map((a) => (
                        <tr key={`inc-${a.ledgerId}`} className="hover:bg-card-2/50 border-b border-line-soft">
                          <td className="px-3 py-1 text-ink sticky left-0 bg-card">{a.name}</td>
                          {a.perPeriod.map((v, i) => (
                            <td key={i} className="px-2 py-1 text-right font-mono text-emerald-500">
                              {Math.abs(v) < 0.01 ? "" : fmt(v)}
                            </td>
                          ))}
                          <td className="px-3 py-1 text-right font-mono font-semibold text-emerald-500">
                            {fmt(a.total)}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-card-2 font-semibold border-t border-line">
                      <td className="px-3 py-1.5 text-emerald-500 uppercase tracking-wide text-xs sticky left-0 bg-card-2">
                        Total Revenue
                      </td>
                      {periodData.totalIncomePerPeriod.map((v, i) => (
                        <td key={i} className="px-2 py-1.5 text-right font-mono text-emerald-500 text-xs">
                          {Math.abs(v) < 0.01 ? "" : fmt(v)}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-500 text-sm">
                        ₹{fmt(periodData.totalIncome)}
                      </td>
                    </tr>

                    {/* Expense section */}
                    <tr className="bg-card-2">
                      <td colSpan={periodData.periods.length + 2} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-red-500">
                        <FaArrowDown className="inline mr-1.5 text-[10px]" /> Expenses
                      </td>
                    </tr>
                    {periodData.expenseAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={periodData.periods.length + 2} className="p-4 text-center text-[11px] text-ink-subtle">No expenses</td>
                      </tr>
                    ) : (
                      periodData.expenseAccounts.map((a) => (
                        <tr key={`exp-${a.ledgerId}`} className="hover:bg-card-2/50 border-b border-line-soft">
                          <td className="px-3 py-1 text-ink sticky left-0 bg-card">{a.name}</td>
                          {a.perPeriod.map((v, i) => (
                            <td key={i} className="px-2 py-1 text-right font-mono text-red-400">
                              {Math.abs(v) < 0.01 ? "" : fmt(v)}
                            </td>
                          ))}
                          <td className="px-3 py-1 text-right font-mono font-semibold text-red-500">
                            {fmt(a.total)}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-card-2 font-semibold border-t border-line">
                      <td className="px-3 py-1.5 text-red-500 uppercase tracking-wide text-xs sticky left-0 bg-card-2">
                        Total Expenses
                      </td>
                      {periodData.totalExpensePerPeriod.map((v, i) => (
                        <td key={i} className="px-2 py-1.5 text-right font-mono text-red-500 text-xs">
                          {Math.abs(v) < 0.01 ? "" : fmt(v)}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-red-500 text-sm">
                        ₹{fmt(periodData.totalExpense)}
                      </td>
                    </tr>

                    {/* Net P&L per period */}
                    <tr className="bg-card-2 border-t-2 border-line font-bold">
                      <td className="px-3 py-2 uppercase tracking-wide text-xs sticky left-0 bg-card-2 text-ink">
                        Net Profit / (Loss)
                      </td>
                      {periodData.netPerPeriod.map((v, i) => (
                        <td key={i} className={`px-2 py-2 text-right font-mono text-xs ${v >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {Math.abs(v) < 0.01 ? "" : `${v >= 0 ? "+" : "-"}${fmt(Math.abs(v))}`}
                        </td>
                      ))}
                      <td className={`px-3 py-2 text-right font-mono text-sm ${periodData.isProfit ? "text-emerald-500" : "text-red-500"}`}>
                        {periodData.isProfit ? "+" : "-"}₹{fmt(Math.abs(periodData.netProfit))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!loading && (activeConfig.layout === "monthly" || activeConfig.layout === "quarterly") && !periodData && (
          <div className="bg-card border border-line rounded-lg p-12 text-center text-xs text-ink-subtle">
            <FaCalendarAlt className="text-emerald-500/40 text-3xl mx-auto mb-2" />
            <div className="text-sm text-ink-muted font-semibold mb-1">Click "Show Report" to load {activeConfig.label}</div>
            <div className="text-[11px]">Period: {startDate} to {endDate}</div>
          </div>
        )}

        {!loading && filteredData && (activeConfig.layout !== "monthly" && activeConfig.layout !== "quarterly") && (
          <>
            <div className="text-[11px] text-ink-muted px-1">
              Period: <b className="text-ink">{startDate}</b> to <b className="text-ink">{endDate}</b> · <b className="text-ink">{activeConfig.label}</b>
            </div>

            <div className="bg-card border border-line rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 200px)" }}>
              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-head text-ink text-[10px] uppercase tracking-wide font-bold border-b-2 border-line sticky top-0 z-10">
                    <tr>
                      {activeConfig.detailed && <th className="px-3 py-1.5 bg-head w-[80px]">Code</th>}
                      <th className="px-3 py-1.5 bg-head">Account</th>
                      {activeConfig.detailed && <th className="px-3 py-1.5 bg-head">Group</th>}
                      <th className="px-3 py-1.5 bg-head text-right w-[140px]">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Revenue */}
                    <tr className="bg-card-2">
                      <td colSpan={activeConfig.detailed ? 4 : 2} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-500">
                        <FaArrowUp className="inline mr-1.5 text-[10px]" /> Revenue / Income
                      </td>
                    </tr>
                    {filteredData.incomeAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={activeConfig.detailed ? 4 : 2} className="p-4 text-center text-xs text-ink-subtle">No income entries</td>
                      </tr>
                    ) : (
                      renderSection(filteredData.incomeAccounts, true)
                    )}
                    <tr className="bg-card-2 font-semibold border-t border-line">
                      <td colSpan={activeConfig.detailed ? 3 : 1} className="px-3 py-1.5 text-emerald-500 uppercase tracking-wide text-xs">
                        Total Revenue
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-emerald-500 text-sm">
                        ₹{fmt(filteredData.totalIncome)}
                      </td>
                    </tr>

                    {/* Expenses */}
                    <tr className="bg-card-2">
                      <td colSpan={activeConfig.detailed ? 4 : 2} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-500">
                        <FaArrowDown className="inline mr-1.5 text-[10px]" /> Expenses
                      </td>
                    </tr>
                    {filteredData.expenseAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={activeConfig.detailed ? 4 : 2} className="p-4 text-center text-xs text-ink-subtle">No expense entries</td>
                      </tr>
                    ) : (
                      renderSection(filteredData.expenseAccounts, false)
                    )}
                    <tr className="bg-card-2 font-semibold border-t border-line">
                      <td colSpan={activeConfig.detailed ? 3 : 1} className="px-3 py-1.5 text-red-500 uppercase tracking-wide text-xs">
                        Total Expenses
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-red-500 text-sm">
                        ₹{fmt(filteredData.totalExpense)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sticky footer */}
              <div className="shrink-0 border-t-2 border-line bg-card-2 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-ink">
                  {filteredData.isProfit ? "Net Profit" : "Net Loss"}
                  <span className="ml-2 text-[10px] font-normal text-ink-subtle normal-case tracking-normal">
                    ({startDate} to {endDate})
                  </span>
                </span>
                <span className={`text-sm font-mono font-bold ${filteredData.isProfit ? "text-emerald-500" : "text-red-500"}`}>
                  {filteredData.isProfit ? "+" : "-"}₹{fmt(Math.abs(filteredData.netProfit))}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfitLossPage;
