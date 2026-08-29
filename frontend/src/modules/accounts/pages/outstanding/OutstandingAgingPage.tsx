import React, { useState, useCallback } from "react";
import { FaSync, FaDownload, FaChartBar } from "react-icons/fa";
import { useListCache } from "../../../../hooks/useListCache";
import { outstandingService, type OutstandingReport, type AgingBucket } from "../../../../services/outstandingService";

const BUCKET_ORDER: AgingBucket[] = ["current", "0-30", "31-60", "61-90", "90+"];
const BUCKET_LABEL: Record<AgingBucket, string> = {
  current: "Current",
  "0-30": "0-30 days",
  "31-60": "31-60 days",
  "61-90": "61-90 days",
  "90+": "90+ days",
};
const BUCKET_COLOR: Record<AgingBucket, string> = {
  current: "text-emerald-500",
  "0-30": "text-blue-500",
  "31-60": "text-amber-500",
  "61-90": "text-orange-500",
  "90+": "text-rose-500",
};

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Mode = "receivable" | "payable";

const OutstandingAgingPage: React.FC = () => {
  const today = new Date().toISOString().split("T")[0];
  const [asOnDate, setAsOnDate] = useState(today);
  const [mode, setMode] = useState<Mode>("receivable");

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const data = mode === "receivable"
      ? await outstandingService.getReceivable(asOnDate)
      : await outstandingService.getPayable(asOnDate);
    return { data: [data], total: 1 };
  }, [asOnDate, mode]);

  const { data: reportList, refreshing, refresh } = useListCache<OutstandingReport>({
    cacheKey: `accounts:outstanding-aging:${mode}:${asOnDate}`,
    socketModule: mode === "receivable" ? "salesInvoice" : "grnInvoice",
    fetcher,
  });

  const report = reportList[0] || null;
  const accent = mode === "receivable" ? "amber" : "rose";
  const partyLabel = mode === "receivable" ? "Customer" : "Supplier";

  const exportCSV = () => {
    if (!report) return;
    const rows: string[][] = [];
    rows.push(["Code", partyLabel, ...BUCKET_ORDER.map((b) => BUCKET_LABEL[b]), "Total"]);
    for (const p of report.parties) {
      rows.push([
        p.partyCode, p.partyName,
        ...BUCKET_ORDER.map((b) => fmt(p.bucketTotals[b])),
        fmt(p.totalOutstanding),
      ]);
    }
    rows.push(["", "GRAND TOTAL", ...BUCKET_ORDER.map((b) => fmt(report.grandBucketTotals[b])), fmt(report.grandTotal)]);
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Aging_${mode}_${asOnDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-3 space-y-3 min-h-screen font-sans text-ink ">
      {/* Header */}
      <div className="bg-card rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-2">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaChartBar className={`text-${accent}-500 text-sm`} /> Aging Matrix
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 bg-${accent}-500/10 text-${accent}-500 border border-${accent}-500/30 rounded uppercase tracking-wide`}>
            {mode === "receivable" ? "A/R" : "A/P"}
          </span>
          {refreshing && <FaSync className={`animate-spin text-${accent}-500 text-[10px]`} />}
        </h1>

        {/* Mode toggle */}
        <div className="flex items-center border border-line rounded overflow-hidden">
          <button
            onClick={() => setMode("receivable")}
            className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
              mode === "receivable" ? "bg-amber-500 text-white" : "bg-card text-ink-muted hover:bg-card-2"
            }`}
          >
            Receivable
          </button>
          <button
            onClick={() => setMode("payable")}
            className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
              mode === "payable" ? "bg-rose-500 text-white" : "bg-card text-ink-muted hover:bg-card-2"
            }`}
          >
            Payable
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">As on</label>
          <input
            type="date"
            value={asOnDate}
            onChange={(e) => setAsOnDate(e.target.value)}
            className={`w-[140px] px-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-${accent}-500/40 focus:border-${accent}-500 focus:outline-none`}
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={refresh}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line">
            <FaSync className={refreshing ? `animate-spin text-${accent}-500` : ""} /> Refresh
          </button>
          <button onClick={exportCSV} disabled={!report || report.parties.length === 0}
            className={`flex items-center gap-1 px-2 py-1 bg-${accent}-600 hover:bg-${accent}-700 text-white rounded text-xs font-semibold disabled:opacity-50`}>
            <FaDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Bucket Summary Cards */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          {BUCKET_ORDER.map((b) => (
            <div key={b} className="bg-card border border-line rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">{BUCKET_LABEL[b]}</div>
              <div className={`text-base font-mono font-bold mt-1 ${BUCKET_COLOR[b]}`}>
                ₹{fmt(report.grandBucketTotals[b])}
              </div>
            </div>
          ))}
          <div className="bg-card border border-line rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Grand Total</div>
            <div className="text-base font-mono font-bold mt-1 text-ink">
              ₹{fmt(report.grandTotal)}
            </div>
          </div>
        </div>
      )}

      {/* Matrix Table — sticky first column + sticky header */}
      <div className="bg-card border border-line rounded-lg overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-head text-ink uppercase font-bold text-[10px] tracking-wide border-b-2 border-line sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 bg-head sticky left-0 z-20 min-w-[80px]">Code</th>
                <th className="px-3 py-2 bg-head sticky left-[80px] z-20 min-w-[200px]">{partyLabel}</th>
                {BUCKET_ORDER.map((b) => (
                  <th key={b} className="px-3 py-2 bg-head text-right min-w-[110px]">{BUCKET_LABEL[b]}</th>
                ))}
                <th className="px-3 py-2 bg-head text-right min-w-[130px] font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {!report || report.parties.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-xs text-ink-subtle">
                  {refreshing ? null : `No outstanding ${mode}. All ${partyLabel.toLowerCase()}s settled.`}
                </td></tr>
              ) : (
                report.parties.map((p) => (
                  <tr key={String(p.partyId)} className="hover:bg-card-2 transition-colors">
                    <td className="px-3 py-1.5 font-mono text-ink-muted bg-card sticky left-0">{p.partyCode}</td>
                    <td className="px-3 py-1.5 font-semibold text-ink bg-card sticky left-[80px]">
                      {p.partyName}
                      {p.gstin && <div className="text-[10px] text-ink-subtle font-mono">GST: {p.gstin}</div>}
                    </td>
                    {BUCKET_ORDER.map((b) => (
                      <td key={b} className={`px-3 py-1.5 text-right font-mono ${p.bucketTotals[b] > 0 ? BUCKET_COLOR[b] : "text-ink-subtle"}`}>
                        {p.bucketTotals[b] > 0 ? fmt(p.bucketTotals[b]) : "-"}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-mono font-bold text-ink">
                      ₹{fmt(p.totalOutstanding)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {report && report.parties.length > 0 && (
              <tfoot className="border-t-2 border-line bg-card-2 sticky bottom-0 z-10">
                <tr>
                  <td colSpan={2} className="px-3 py-2 font-bold text-[11px] uppercase tracking-wide text-ink bg-card-2 sticky left-0">
                    GRAND TOTAL ({report.parties.length} {partyLabel.toLowerCase()}s)
                  </td>
                  {BUCKET_ORDER.map((b) => (
                    <td key={b} className={`px-3 py-2 text-right font-mono font-bold ${BUCKET_COLOR[b]}`}>
                      ₹{fmt(report.grandBucketTotals[b])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-mono font-bold text-sm text-ink">
                    ₹{fmt(report.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default OutstandingAgingPage;
