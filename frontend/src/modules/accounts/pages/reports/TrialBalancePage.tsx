import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { FaSync, FaDownload, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import apiClient from "../../../../api/apiClient";

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

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const TrialBalancePage: React.FC = () => {
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/accounts/trial-balance");
      setData(res.data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Code", "Name", "Group", "Type", "Debit Balance", "Credit Balance"];
    const rows = data.rows.map((r) => [
      r.code,
      r.name,
      r.group,
      r.type,
      r.debitBalance.toFixed(2),
      r.creditBalance.toFixed(2),
    ]);
    rows.push([
      "",
      "TOTAL",
      "",
      "",
      data.totalDebitBalance.toFixed(2),
      data.totalCreditBalance.toFixed(2),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-800">Trial Balance</h2>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
            Refresh
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

      {data && (
        <div
          className={`flex items-center gap-2 mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
            data.isBalanced
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {data.isBalanced ? <FaCheckCircle /> : <FaExclamationTriangle />}
          {data.isBalanced
            ? "Trial Balance is balanced"
            : `Unbalanced — Difference: ₹${fmt(Math.abs(data.totalDebitBalance - data.totalCreditBalance))}`}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-500">Loading trial balance...</div>
      )}

      {!loading && data && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 uppercase text-xs">
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Ledger Name</th>
                <th className="px-4 py-3 text-left">Group</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Debit (Dr)</th>
                <th className="px-4 py-3 text-right">Credit (Cr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row) => (
                <tr key={row.ledgerId} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.group}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        row.type === "ASSET"
                          ? "bg-blue-100 text-blue-700"
                          : row.type === "LIABILITY"
                          ? "bg-orange-100 text-orange-700"
                          : row.type === "INCOME"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {row.debitBalance > 0 ? `₹${fmt(row.debitBalance)}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {row.creditBalance > 0 ? `₹${fmt(row.creditBalance)}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                <td colSpan={4} className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3 text-right font-mono">₹{fmt(data.totalDebitBalance)}</td>
                <td className="px-4 py-3 text-right font-mono">₹{fmt(data.totalCreditBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && !data && (
        <div className="text-center py-12 text-slate-400">No data available</div>
      )}
    </div>
  );
};

export default TrialBalancePage;
