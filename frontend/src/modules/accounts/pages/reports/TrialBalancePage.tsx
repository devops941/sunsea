import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  FaSync,
  FaDownload,
  FaCheckCircle,
  FaExclamationTriangle,
  FaBalanceScale,
  FaPrint,
} from "react-icons/fa";
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

  const handlePrint = () => window.print();

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
    <div className="p-3 space-y-3 bg-card-2 min-h-screen font-sans text-ink">
      {/* Merged Header + Filter Container */}
      <div className="bg-card rounded-lg border border-line">
        {/* Header Row */}
        <div className="px-3 py-2 border-b border-line flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <FaBalanceScale className="text-indigo-500 text-sm" /> Trial Balance
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
              <FaSync className={loading ? "animate-spin text-indigo-500" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* KPI Row */}
        {data && (
          <div className="px-3 py-2 bg-card-2 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[160px] bg-card border border-line rounded p-3">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                Total Debit (Dr)
              </div>
              <div className="text-lg font-mono font-bold text-ink">
                ₹{fmt(data.totalDebitBalance)}
              </div>
            </div>
            <div className="flex-1 min-w-[160px] bg-card border border-line rounded p-3">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                Total Credit (Cr)
              </div>
              <div className="text-lg font-mono font-bold text-ink">
                ₹{fmt(data.totalCreditBalance)}
              </div>
            </div>
            <div className="flex-1 min-w-[160px] bg-card border border-line rounded p-3">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                Status
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {data.isBalanced ? (
                  <>
                    <FaCheckCircle className="text-emerald-500 text-xs" />
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Balanced
                    </span>
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle className="text-red-500 text-xs" />
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
                      Diff ₹{fmt(Math.abs(data.totalDebitBalance - data.totalCreditBalance))}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report Body */}
      <div className="bg-card border border-line rounded-lg overflow-hidden">
        {loading && !data && (
          <div className="p-8 text-center text-xs text-ink-subtle">
            <FaSync className="animate-spin text-indigo-500 text-lg mx-auto mb-1" />
            Loading trial balance...
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
                  <th className="px-3 py-1.5 text-xs">Code</th>
                  <th className="px-3 py-1.5 text-xs">Ledger Name</th>
                  <th className="px-3 py-1.5 text-xs">Group</th>
                  <th className="px-3 py-1.5 text-xs">Type</th>
                  <th className="px-3 py-1.5 text-xs text-right">Debit (Dr)</th>
                  <th className="px-3 py-1.5 text-xs text-right">Credit (Cr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-ink-subtle">
                      No ledger entries found.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row) => (
                    <tr key={row.ledgerId} className="hover:bg-card-2 transition-colors">
                      <td className="px-3 py-1.5 text-xs font-mono text-ink-subtle">{row.code}</td>
                      <td className="px-3 py-1.5 text-xs font-semibold text-ink">{row.name}</td>
                      <td className="px-3 py-1.5 text-xs text-ink-muted">{row.group}</td>
                      <td className="px-3 py-1.5 text-xs">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            row.type === "ASSET"
                              ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                              : row.type === "LIABILITY"
                              ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                              : row.type === "INCOME"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : "bg-red-500/10 text-red-500 border border-red-500/20"
                          }`}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-right font-mono text-ink">
                        {row.debitBalance > 0 ? `₹${fmt(row.debitBalance)}` : "-"}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-right font-mono text-ink">
                        {row.creditBalance > 0 ? `₹${fmt(row.creditBalance)}` : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-card-2 border-t-2 border-line font-bold text-sm font-mono">
                  <td colSpan={4} className="px-3 py-1.5 text-xs uppercase tracking-wide text-ink">
                    Total
                  </td>
                  <td className="px-3 py-1.5 text-right text-ink">
                    ₹{fmt(data.totalDebitBalance)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-ink">
                    ₹{fmt(data.totalCreditBalance)}
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

export default TrialBalancePage;
