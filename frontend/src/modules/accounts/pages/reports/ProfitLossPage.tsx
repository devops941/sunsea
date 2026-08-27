import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  FaSync,
  FaDownload,
  FaArrowUp,
  FaArrowDown,
  FaChartLine,
  FaPrint,
} from "react-icons/fa";
import apiClient from "../../../../api/apiClient";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";

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

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ProfitLossPage: React.FC = () => {
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await apiClient.get(`/accounts/profit-loss?${params.toString()}`);
      setData(res.data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load P&L statement");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrint = () => window.print();

  const exportCSV = () => {
    if (!data) return;
    const lines: string[][] = [];
    lines.push(["Profit & Loss Statement"]);
    if (data.startDate || data.endDate) {
      lines.push([`Period: ${data.startDate || "Beginning"} to ${data.endDate || "Today"}`]);
    }
    lines.push([]);
    lines.push(["INCOME"]);
    lines.push(["Code", "Name", "Group", "Amount"]);
    data.incomeAccounts.forEach((a) =>
      lines.push([a.code, a.name, a.group, a.netAmount.toFixed(2)])
    );
    lines.push(["", "Total Income", "", data.totalIncome.toFixed(2)]);
    lines.push([]);
    lines.push(["EXPENSES"]);
    lines.push(["Code", "Name", "Group", "Amount"]);
    data.expenseAccounts.forEach((a) =>
      lines.push([a.code, a.name, a.group, a.netAmount.toFixed(2)])
    );
    lines.push(["", "Total Expenses", "", data.totalExpense.toFixed(2)]);
    lines.push([]);
    lines.push([
      "",
      data.isProfit ? "Net Profit" : "Net Loss",
      "",
      Math.abs(data.netProfit).toFixed(2),
    ]);

    const csv = lines.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-loss-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-3 space-y-3 bg-card-2 min-h-screen font-sans text-ink">
      {/* Merged Header + Filter */}
      <div className="bg-card rounded-lg border border-line">
        {/* Header Row */}
        <div className="px-3 py-2 border-b border-line flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <FaChartLine className="text-emerald-500 text-sm" /> Profit &amp; Loss Statement
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={!data}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold transition-all border border-line disabled:opacity-50"
              title="Print"
            >
              <FaPrint /> Print
            </button>
            <button
              onClick={exportCSV}
              disabled={!data}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold transition-all border border-line disabled:opacity-50"
              title="Export"
            >
              <FaDownload /> Export
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold transition-all border border-line disabled:opacity-50"
              title="Refresh"
            >
              <FaSync className={loading ? "animate-spin text-emerald-500" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="px-3 py-2 bg-card-2 flex flex-wrap items-end gap-2">
          <div className="w-[140px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
              From
            </label>
            <DatePickerCalendar
              name="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start date"
            />
          </div>
          <div className="w-[140px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
              To
            </label>
            <DatePickerCalendar
              name="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End date"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors disabled:opacity-50"
            >
              Apply
            </button>
          </div>

          {/* KPI Cards inline */}
          {data && (
            <div className="flex flex-wrap gap-2 ml-auto">
              <div className="min-w-[130px] bg-card border border-line rounded p-3">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  Total Income
                </div>
                <div className="text-lg font-mono font-bold text-emerald-500">
                  ₹{fmt(data.totalIncome)}
                </div>
              </div>
              <div className="min-w-[130px] bg-card border border-line rounded p-3">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  Total Expenses
                </div>
                <div className="text-lg font-mono font-bold text-red-500">
                  ₹{fmt(data.totalExpense)}
                </div>
              </div>
              <div className="min-w-[130px] bg-card border border-line rounded p-3">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  {data.isProfit ? "Net Profit" : "Net Loss"}
                </div>
                <div
                  className={`text-lg font-mono font-bold ${
                    data.isProfit ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  {data.isProfit ? "+" : "-"}₹{fmt(Math.abs(data.netProfit))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Body */}
      <div className="bg-card border border-line rounded-lg overflow-hidden">
        {loading && !data && (
          <div className="p-8 text-center text-xs text-ink-subtle">
            <FaSync className="animate-spin text-emerald-500 text-lg mx-auto mb-1" />
            Loading statement...
          </div>
        )}

        {!loading && !data && (
          <div className="p-8 text-center text-xs text-ink-subtle">No data available</div>
        )}

        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-head text-ink text-[10px] uppercase tracking-wide font-bold border-b border-line">
                <tr>
                  <th className="px-3 py-1.5 text-xs w-24">Code</th>
                  <th className="px-3 py-1.5 text-xs">Account</th>
                  <th className="px-3 py-1.5 text-xs">Group</th>
                  <th className="px-3 py-1.5 text-xs text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {/* REVENUE Section */}
                <tr className="bg-card-2">
                  <td
                    colSpan={4}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-500 flex items-center gap-1.5"
                  >
                    <FaArrowUp className="text-[10px]" /> Revenue
                  </td>
                </tr>
                {data.incomeAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-ink-subtle">
                      No income entries
                    </td>
                  </tr>
                ) : (
                  data.incomeAccounts.map((a) => (
                    <tr key={`inc-${a.ledgerId}`} className="hover:bg-card-2 transition-colors">
                      <td className="px-3 py-1.5 text-xs font-mono text-ink-subtle">{a.code}</td>
                      <td className="px-3 py-1.5 text-xs text-ink">{a.name}</td>
                      <td className="px-3 py-1.5 text-xs text-ink-muted">{a.group}</td>
                      <td className="px-3 py-1.5 text-xs text-right font-mono text-emerald-500">
                        {fmt(a.netAmount)}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-card-2 font-semibold text-xs">
                  <td colSpan={3} className="px-3 py-1.5 text-emerald-500 uppercase tracking-wide">
                    Total Revenue
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-500">
                    ₹{fmt(data.totalIncome)}
                  </td>
                </tr>

                {/* EXPENSES Section */}
                <tr className="bg-card-2">
                  <td
                    colSpan={4}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-500 flex items-center gap-1.5"
                  >
                    <FaArrowDown className="text-[10px]" /> Expenses
                  </td>
                </tr>
                {data.expenseAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-ink-subtle">
                      No expense entries
                    </td>
                  </tr>
                ) : (
                  data.expenseAccounts.map((a) => (
                    <tr key={`exp-${a.ledgerId}`} className="hover:bg-card-2 transition-colors">
                      <td className="px-3 py-1.5 text-xs font-mono text-ink-subtle">{a.code}</td>
                      <td className="px-3 py-1.5 text-xs text-ink">{a.name}</td>
                      <td className="px-3 py-1.5 text-xs text-ink-muted">{a.group}</td>
                      <td className="px-3 py-1.5 text-xs text-right font-mono text-red-500">
                        {fmt(a.netAmount)}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-card-2 font-semibold text-xs">
                  <td colSpan={3} className="px-3 py-1.5 text-red-500 uppercase tracking-wide">
                    Total Expenses
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-red-500">
                    ₹{fmt(data.totalExpense)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-card-2 border-t-2 border-line font-bold text-sm font-mono">
                  <td
                    colSpan={3}
                    className="px-3 py-1.5 text-xs uppercase tracking-wide text-ink"
                  >
                    {data.isProfit ? "Net Profit" : "Net Loss"}
                    {(data.startDate || data.endDate) && (
                      <span className="ml-2 text-[10px] font-normal text-ink-subtle normal-case tracking-normal">
                        ({data.startDate || "Beginning"} to {data.endDate || "Today"})
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right ${
                      data.isProfit ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    {data.isProfit ? "+" : "-"}₹{fmt(Math.abs(data.netProfit))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfitLossPage;
