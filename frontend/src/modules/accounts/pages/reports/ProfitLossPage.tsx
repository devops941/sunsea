import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { FaSync, FaDownload, FaArrowUp, FaArrowDown } from "react-icons/fa";
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
    data.incomeAccounts.forEach((a) => lines.push([a.code, a.name, a.group, a.netAmount.toFixed(2)]));
    lines.push(["", "Total Income", "", data.totalIncome.toFixed(2)]);
    lines.push([]);
    lines.push(["EXPENSES"]);
    lines.push(["Code", "Name", "Group", "Amount"]);
    data.expenseAccounts.forEach((a) => lines.push([a.code, a.name, a.group, a.netAmount.toFixed(2)]));
    lines.push(["", "Total Expenses", "", data.totalExpense.toFixed(2)]);
    lines.push([]);
    lines.push(["", data.isProfit ? "Net Profit" : "Net Loss", "", Math.abs(data.netProfit).toFixed(2)]);

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
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">Profit & Loss Statement</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <DatePickerCalendar
            label="From"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Start date"
          />
          <DatePickerCalendar
            label="To"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="End date"
          />
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
            Apply
          </button>
          <button
            onClick={exportCSV}
            disabled={!data}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
          >
            <FaDownload />
            Export CSV
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-500">Loading statement...</div>
      )}

      {!loading && data && (
        <div className="space-y-6">
          {/* Income Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-green-50 px-4 py-3 border-b border-green-100">
              <h3 className="font-semibold text-green-800 flex items-center gap-2">
                <FaArrowUp className="text-green-600" />
                Income
              </h3>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Group</th>
                  <th className="px-4 py-2 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.incomeAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                      No income entries
                    </td>
                  </tr>
                ) : (
                  data.incomeAccounts.map((a) => (
                    <tr key={a.ledgerId} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{a.code}</td>
                      <td className="px-4 py-2 text-slate-700">{a.name}</td>
                      <td className="px-4 py-2 text-slate-500">{a.group}</td>
                      <td className="px-4 py-2 text-right font-mono text-green-700">
                        {fmt(a.netAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-green-50 font-bold border-t border-green-200">
                  <td colSpan={3} className="px-4 py-3 text-green-800">Total Income</td>
                  <td className="px-4 py-3 text-right font-mono text-green-800">
                    ₹{fmt(data.totalIncome)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Expense Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-red-50 px-4 py-3 border-b border-red-100">
              <h3 className="font-semibold text-red-800 flex items-center gap-2">
                <FaArrowDown className="text-red-600" />
                Expenses
              </h3>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Group</th>
                  <th className="px-4 py-2 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.expenseAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                      No expense entries
                    </td>
                  </tr>
                ) : (
                  data.expenseAccounts.map((a) => (
                    <tr key={a.ledgerId} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{a.code}</td>
                      <td className="px-4 py-2 text-slate-700">{a.name}</td>
                      <td className="px-4 py-2 text-slate-500">{a.group}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-700">
                        {fmt(a.netAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-red-50 font-bold border-t border-red-200">
                  <td colSpan={3} className="px-4 py-3 text-red-800">Total Expenses</td>
                  <td className="px-4 py-3 text-right font-mono text-red-800">
                    ₹{fmt(data.totalExpense)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Net Profit / Loss */}
          <div
            className={`rounded-xl border-2 p-6 text-center ${
              data.isProfit
                ? "border-green-400 bg-green-50"
                : "border-red-400 bg-red-50"
            }`}
          >
            <p className="text-sm font-medium text-slate-600 mb-1">
              {data.isProfit ? "Net Profit" : "Net Loss"}
            </p>
            <p
              className={`text-3xl font-bold ${
                data.isProfit ? "text-green-700" : "text-red-700"
              }`}
            >
              {data.isProfit ? "+" : "-"}₹{fmt(Math.abs(data.netProfit))}
            </p>
            {(data.startDate || data.endDate) && (
              <p className="text-xs text-slate-500 mt-2">
                Period: {data.startDate || "Beginning"} to {data.endDate || "Today"}
              </p>
            )}
          </div>
        </div>
      )}

      {!loading && !data && (
        <div className="text-center py-12 text-slate-400">No data available</div>
      )}
    </div>
  );
};

export default ProfitLossPage;
