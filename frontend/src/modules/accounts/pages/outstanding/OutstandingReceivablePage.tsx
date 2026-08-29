import React, { useState, useCallback } from "react";
import { FaChevronDown, FaChevronRight, FaSync, FaHandHoldingUsd, FaDownload } from "react-icons/fa";
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

const OutstandingReceivablePage: React.FC = () => {
  const today = new Date().toISOString().split("T")[0];
  const [asOnDate, setAsOnDate] = useState(today);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const data = await outstandingService.getReceivable(asOnDate);
    return { data: [data], total: 1 };
  }, [asOnDate]);

  const { data: reportList, refreshing, refresh } = useListCache<OutstandingReport>({
    cacheKey: `accounts:outstanding-receivable:${asOnDate}`,
    socketModule: "salesInvoice",
    fetcher,
  });

  const report = reportList[0] || null;

  const togglePartyExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    if (!report) return;
    const rows: string[][] = [];
    rows.push(["Code", "Customer", "Invoice No", "Invoice Date", "Due Date", "Bill Amount", "Paid", "Balance", "Age Days", "Bucket"]);
    for (const p of report.parties) {
      for (const b of p.bills) {
        rows.push([
          p.partyCode, p.partyName, b.invoiceNo, b.invoiceDate, b.dueDate || "-",
          fmt(b.billAmount), fmt(b.paidAmount), fmt(b.balance),
          String(b.ageDays), BUCKET_LABEL[b.bucket],
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Outstanding_Receivable_${asOnDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-3 space-y-3 min-h-screen font-sans text-ink ">
      {/* Header */}
      <div className="bg-card rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-2">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaHandHoldingUsd className="text-amber-500 text-sm" /> Outstanding Receivable
          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded uppercase tracking-wide">
            Bill-wise
          </span>
          {refreshing && <FaSync className="animate-spin text-amber-500 text-[10px]" />}
        </h1>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">As on</label>
          <input
            type="date"
            value={asOnDate}
            onChange={(e) => setAsOnDate(e.target.value)}
            className="w-[140px] px-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={refresh}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line">
            <FaSync className={refreshing ? "animate-spin text-amber-500" : ""} /> Refresh
          </button>
          <button onClick={exportCSV} disabled={!report || report.parties.length === 0}
            className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold disabled:opacity-50">
            <FaDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Aging Bucket Summary */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {BUCKET_ORDER.map((b) => (
            <div key={b} className="bg-card border border-line rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">{BUCKET_LABEL[b]}</div>
              <div className={`text-base font-mono font-bold mt-1 ${BUCKET_COLOR[b]}`}>
                ₹{fmt(report.grandBucketTotals[b])}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      {report && (
        <div className="bg-card border border-line rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide font-bold text-ink-subtle">
            Grand Total ({report.parties.length} customers · {report.parties.reduce((s, p) => s + p.bills.length, 0)} bills)
          </span>
          <span className="text-lg font-mono font-bold text-ink">₹{fmt(report.grandTotal)}</span>
        </div>
      )}

      {/* Party Table */}
      <div className="bg-card border border-line rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-head text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
              <tr>
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Phone</th>
                {BUCKET_ORDER.map((b) => (
                  <th key={b} className="px-3 py-2 text-right text-[10px]">{BUCKET_LABEL[b]}</th>
                ))}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {!report || report.parties.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-xs text-ink-subtle">
                  {refreshing ? null : "No outstanding receivables. All customers are settled."}
                </td></tr>
              ) : (
                report.parties.map((p) => {
                  const key = String(p.partyId);
                  const isOpen = expanded.has(key);
                  return (
                    <React.Fragment key={key}>
                      <tr className="hover:bg-card-2 transition-colors cursor-pointer"
                          onClick={() => togglePartyExpand(key)}>
                        <td className="px-3 py-1.5 text-center text-ink-subtle">
                          {isOpen ? <FaChevronDown className="text-[9px] inline" /> : <FaChevronRight className="text-[9px] inline" />}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-ink-muted">{p.partyCode}</td>
                        <td className="px-3 py-1.5 font-semibold text-ink">
                          {p.partyName}
                          {p.gstin && <div className="text-[10px] text-ink-subtle font-mono">GST: {p.gstin}</div>}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-ink-muted">{p.phone || "-"}</td>
                        {BUCKET_ORDER.map((b) => (
                          <td key={b} className={`px-3 py-1.5 text-right font-mono ${p.bucketTotals[b] > 0 ? BUCKET_COLOR[b] : "text-ink-subtle"}`}>
                            {p.bucketTotals[b] > 0 ? fmt(p.bucketTotals[b]) : "-"}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-ink">
                          ₹{fmt(p.totalOutstanding)}
                        </td>
                      </tr>
                      {isOpen && p.bills.map((b) => (
                        <tr key={b.id} className="bg-card-2/40">
                          <td colSpan={2}></td>
                          <td className="pl-6 pr-3 py-1 font-mono text-[11px] text-blue-500">{b.invoiceNo}</td>
                          <td className="px-3 py-1 text-[11px] text-ink-muted">
                            {b.invoiceDate}{b.dueDate ? ` → due ${b.dueDate}` : ""}
                            <span className={`ml-2 text-[10px] font-bold ${BUCKET_COLOR[b.bucket]}`}>
                              {b.ageDays > 0 ? `${b.ageDays}d overdue` : "not due"}
                            </span>
                          </td>
                          <td colSpan={5} className="px-3 py-1 text-right text-[11px] text-ink-muted">
                            <span>Bill ₹{fmt(b.billAmount)}</span>
                            <span className="mx-2 text-ink-subtle">·</span>
                            <span className="text-emerald-500">Paid ₹{fmt(b.paidAmount)}</span>
                          </td>
                          <td className="px-3 py-1 text-right font-mono font-semibold text-ink">
                            ₹{fmt(b.balance)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OutstandingReceivablePage;
