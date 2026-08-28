import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBookOpen, FaPlus, FaSearch, FaSync } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, type Voucher } from "../../../../services/voucherService";
import { useListCache } from "../../../../hooks/useListCache";

const JournalEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterDate, setFilterDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const cacheKey = `accounts:journal-vouchers:${filterDate}:${searchTerm}`;

  const fetcher = useCallback(
    async (_signal: AbortSignal) => {
      try {
        const res = await voucherService.fetchVouchers({
          type: "JOURNAL",
          startDate: filterDate || undefined,
          endDate: filterDate || undefined,
          search: searchTerm || undefined,
          page: 1,
          limit: 10000,
        });
        return { data: res.vouchers || [], total: res.total || res.vouchers?.length || 0 };
      } catch (err: any) {
        toast.error(err?.message || "Failed to load journal entries");
        throw err;
      }
    },
    [filterDate, searchTerm]
  );

  const { data: vouchers, total, loading, refreshing, refresh } = useListCache<Voucher>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
  });

  return (
    <div className="p-3 space-y-3 min-h-screen">
      {/* Single-row Header + Filters (Busy-style compact) */}
      <div className="bg-card rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-2">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaBookOpen className="text-purple-500 text-sm" /> Journal Entry
          {refreshing && <FaSync className="animate-spin text-purple-500 text-[10px]" />}
        </h1>

        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Date</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-[130px] px-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div className="relative w-full max-w-[320px]">
          <input
            type="text"
            placeholder="Search voucher no or narration..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500 focus:outline-none"
          />
          <FaSearch className="absolute left-2 top-2 text-ink-subtle text-[10px]" />
        </div>

        {(filterDate || searchTerm) && (
          <button
            onClick={() => { setFilterDate(""); setSearchTerm(""); }}
            className="px-2 py-1 text-xs text-ink-muted hover:text-ink border border-line rounded cursor-pointer"
          >
            Clear
          </button>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={refresh}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line"
          >
            <FaSync className={refreshing ? "animate-spin text-purple-500" : ""} /> Refresh
          </button>
          <button
            onClick={() => navigate("/accounts/journal-entry/add")}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            <FaPlus className="text-[10px]" /> New Journal
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-ink">Journal Vouchers</h2>
          <span className="text-[11px] text-ink-subtle font-mono">Total: {total}</span>
        </div>
        {vouchers.length === 0 ? (
          loading ? null : <div className="p-8 text-center text-xs text-ink-subtle">No journal entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink-muted">
              <thead className="bg-head text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                <tr>
                  <th className="px-3 py-2">Voucher No</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Debit Account(s)</th>
                  <th className="px-3 py-2">Credit Account(s)</th>
                  <th className="px-3 py-2 text-right">Amount (₹)</th>
                  <th className="px-3 py-2">Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {vouchers.map((v) => {
                  const drTotal = v.items.reduce((s, i) => s + Number(i.debitAmount || 0), 0);
                  const debitNames = v.items.filter((i) => Number(i.debitAmount) > 0).map((i) => i.debitLedger?.name).filter(Boolean).join(", ");
                  const creditNames = v.items.filter((i) => Number(i.creditAmount) > 0).map((i) => i.creditLedger?.name).filter(Boolean).join(", ");
                  return (
                    <tr key={v.id} className="hover:bg-card-2 transition-colors">
                      <td className="px-3 py-1.5 font-mono font-semibold text-purple-500">{v.voucherNo}</td>
                      <td className="px-3 py-1.5 font-mono text-[11px]">{new Date(v.date).toLocaleDateString("en-IN")}</td>
                      <td className="px-3 py-1.5 font-semibold text-ink">{debitNames || "-"}</td>
                      <td className="px-3 py-1.5 text-ink-muted">{creditNames || "-"}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-ink">
                        ₹{drTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-1.5 text-ink-subtle max-w-xs truncate">{v.narration || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
              {vouchers.length > 0 && (
                <tfoot className="border-t-2 border-line bg-card-2">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right text-[10px] font-bold text-ink uppercase tracking-wide">
                      Page Total ({vouchers.length})
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-sm text-ink font-mono">
                      ₹{vouchers.reduce((s, v) => s + v.items.reduce((si, i) => si + Number(i.debitAmount || 0), 0), 0)
                        .toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default JournalEntryPage;
