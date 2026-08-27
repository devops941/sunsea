import React, { useState, useEffect } from "react";
import {
  FaBalanceScale,
  FaSync,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPrint,
  FaDownload,
} from "react-icons/fa";
import { toast } from "react-toastify";
import apiClient from "../../../../api/apiClient";

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

const fmt = (n: number) =>
  Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BalanceSheetPage: React.FC = () => {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/accounts/balance-sheet");
      setData(res.data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load balance sheet");
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
    const lines: string[][] = [];
    lines.push(["Balance Sheet"]);
    lines.push([]);
    lines.push(["ASSETS"]);
    lines.push(["Code", "Name", "Group", "Amount"]);
    data.assets.forEach((a) => lines.push([a.code, a.name, a.group, a.balance.toFixed(2)]));
    lines.push(["", "Total Assets", "", data.totalAssets.toFixed(2)]);
    lines.push([]);
    lines.push(["LIABILITIES"]);
    lines.push(["Code", "Name", "Group", "Amount"]);
    data.liabilities.forEach((l) => lines.push([l.code, l.name, l.group, l.balance.toFixed(2)]));
    lines.push(["", "Total Liabilities", "", data.totalLiabilities.toFixed(2)]);
    lines.push([]);
    lines.push(["EQUITY"]);
    lines.push(["Code", "Name", "Group", "Amount"]);
    data.equity.forEach((e) => lines.push([e.code, e.name, e.group, e.balance.toFixed(2)]));
    lines.push(["", "Total Equity", "", data.totalEquity.toFixed(2)]);
    lines.push([]);
    lines.push([
      "",
      "Total Liabilities + Equity",
      "",
      data.totalLiabilitiesAndEquity.toFixed(2),
    ]);

    const csv = lines.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-sheet-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderSection = (title: string, items: BSItem[], total: number) => (
    <div className="bg-card border border-line rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-line bg-card-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink">{title}</h3>
        <span className="text-sm font-mono font-bold text-teal-500">₹{fmt(total)}</span>
      </div>
      {items.length === 0 ? (
        <div className="p-8 text-center text-xs text-ink-subtle">No entries</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-head text-ink text-[10px] uppercase tracking-wide font-bold border-b border-line">
              <tr>
                <th className="px-3 py-1.5 text-xs">Account</th>
                <th className="px-3 py-1.5 text-xs">Group</th>
                <th className="px-3 py-1.5 text-xs text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {items.map((item) => (
                <tr key={item.code} className="hover:bg-card-2 transition-colors">
                  <td className="px-3 py-1.5 text-xs font-semibold text-ink">{item.name}</td>
                  <td className="px-3 py-1.5 text-xs text-ink-muted">{item.group}</td>
                  <td className="px-3 py-1.5 text-xs text-right font-mono text-ink">
                    ₹{fmt(item.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-card-2 border-t-2 border-line font-bold text-sm font-mono">
                <td colSpan={2} className="px-3 py-1.5 text-xs uppercase tracking-wide text-ink">
                  Total {title}
                </td>
                <td className="px-3 py-1.5 text-right text-ink">₹{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-3 space-y-3 bg-card-2 min-h-screen font-sans text-ink">
      {/* Merged Header + KPI Container */}
      <div className="bg-card rounded-lg border border-line">
        {/* Header Row */}
        <div className="px-3 py-2 border-b border-line flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <FaBalanceScale className="text-teal-500 text-sm" /> Balance Sheet
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
              <FaSync className={loading ? "animate-spin text-teal-500" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* KPI Row */}
        {data && (
          <div className="px-3 py-2 bg-card-2 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[150px] bg-card border border-line rounded p-3">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                Total Assets
              </div>
              <div className="text-lg font-mono font-bold text-blue-500">
                ₹{fmt(data.totalAssets)}
              </div>
            </div>
            <div className="flex-1 min-w-[150px] bg-card border border-line rounded p-3">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                Total Liabilities
              </div>
              <div className="text-lg font-mono font-bold text-red-500">
                ₹{fmt(data.totalLiabilities)}
              </div>
            </div>
            <div className="flex-1 min-w-[150px] bg-card border border-line rounded p-3">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                Total Equity
              </div>
              <div className="text-lg font-mono font-bold text-purple-500">
                ₹{fmt(data.totalEquity)}
              </div>
            </div>
            <div className="flex-1 min-w-[170px] bg-card border border-line rounded p-3">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                Status
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {data.isBalanced ? (
                  <>
                    <FaCheckCircle className="text-teal-500 text-xs" />
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-teal-500/10 text-teal-500 border border-teal-500/20">
                      Balanced
                    </span>
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle className="text-red-500 text-xs" />
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
                      Diff ₹{fmt(Math.abs(data.totalAssets - data.totalLiabilitiesAndEquity))}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report Body */}
      {loading && !data && (
        <div className="bg-card border border-line rounded-lg p-8 text-center text-xs text-ink-subtle">
          <FaSync className="animate-spin text-teal-500 text-lg mx-auto mb-1" />
          Loading balance sheet...
        </div>
      )}

      {!loading && !data && (
        <div className="bg-card border border-line rounded-lg p-8 text-center text-xs text-ink-subtle">
          No data available
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Left: Assets */}
          <div className="space-y-3">
            {renderSection("Assets", data.assets, data.totalAssets)}
          </div>
          {/* Right: Liabilities + Equity */}
          <div className="space-y-3">
            {renderSection("Liabilities", data.liabilities, data.totalLiabilities)}
            {renderSection("Equity", data.equity, data.totalEquity)}
            {/* Combined Total */}
            <div className="bg-card border border-line rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-ink">
                Total Liabilities + Equity
              </span>
              <span className="text-sm font-mono font-bold text-ink">
                ₹{fmt(data.totalLiabilitiesAndEquity)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BalanceSheetPage;
