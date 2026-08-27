import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaMoneyBillWave, FaPlus, FaSearch } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, type Voucher } from "../../../../services/voucherService";

const PaymentVoucherPage: React.FC = () => {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [total, setTotal] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await voucherService.fetchVouchers({
        type: "PAYMENT",
        startDate: filterDate || undefined,
        endDate: filterDate || undefined,
        search: searchTerm || undefined,
        page: 1, limit: 10000,
      });
      setVouchers(res.vouchers || []);
      setTotal(res.total || res.vouchers?.length || 0);
    } catch (err: any) { toast.error(err?.message || "Failed to load"); }
    finally { setLoading(false); }
  }, [filterDate, searchTerm]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="p-3 space-y-3 bg-card-2 min-h-screen">
      {/* Compact Header + Filters */}
      <div className="bg-card rounded-lg border border-line">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line">
          <h1 className="text-sm font-bold text-ink flex items-center gap-2">
            <FaMoneyBillWave className="text-red-500 text-sm" /> Payment Voucher
          </h1>
          <button onClick={() => navigate("/accounts/payment-voucher/add")}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition cursor-pointer">
            <FaPlus className="text-[10px]" /> New Payment
          </button>
        </div>

        <div className="px-3 py-2 bg-card-2 flex flex-wrap items-end gap-2">
          <div className="w-[150px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Date</label>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Search</label>
            <div className="relative">
              <input type="text" placeholder="Voucher no or narration..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none" />
              <FaSearch className="absolute left-2.5 top-2.5 text-ink-subtle text-[10px]" />
            </div>
          </div>
          {(filterDate || searchTerm) && (
            <button onClick={() => { setFilterDate(""); setSearchTerm(""); }}
              className="px-2.5 py-1.5 text-xs text-ink-muted hover:text-ink border border-line rounded cursor-pointer">Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-ink">Payment Vouchers</h2>
          <span className="text-[11px] text-ink-subtle font-mono">Total: {total}</span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-xs text-ink-muted">Loading...</div>
        ) : vouchers.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-subtle">No payment vouchers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink-muted">
              <thead className="bg-head text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                <tr>
                  <th className="px-3 py-2">Voucher No</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Paid To</th>
                  <th className="px-3 py-2">Paid From</th>
                  <th className="px-3 py-2 text-right">Amount (₹)</th>
                  <th className="px-3 py-2">Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {vouchers.map((v) => {
                  const voucherTotal = v.items.reduce((s, i) => s + Number(i.debitAmount || 0), 0);
                  const debitNames = v.items.map((i) => i.debitLedger?.name).filter(Boolean).join(", ");
                  const creditName = v.items[0]?.creditLedger?.name || "-";
                  return (
                    <tr key={v.id} className="hover:bg-card-2 transition-colors">
                      <td className="px-3 py-1.5 font-mono font-semibold text-red-500">{v.voucherNo}</td>
                      <td className="px-3 py-1.5 font-mono text-[11px]">{new Date(v.date).toLocaleDateString("en-IN")}</td>
                      <td className="px-3 py-1.5 font-semibold text-ink">{debitNames || "-"}</td>
                      <td className="px-3 py-1.5 text-ink-muted">{creditName}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-ink">
                        ₹{voucherTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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

export default PaymentVoucherPage;
