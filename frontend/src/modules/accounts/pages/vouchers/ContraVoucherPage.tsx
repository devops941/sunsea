import React, { useState, useEffect } from "react";
import { FaExchangeAlt, FaPlus, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, type Voucher } from "../../../../services/voucherService";
import { accountService, type AccountLedger } from "../../../../services/accountService";

export const ContraVoucherPage: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [debitLedgerId, setDebitLedgerId] = useState<string>("");
  const [creditLedgerId, setCreditLedgerId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [narration, setNarration] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [vRes, lRes] = await Promise.all([
        voucherService.fetchVouchers({ type: "CONTRA" }),
        accountService.fetchLedgers({ limit: 100 }),
      ]);
      setVouchers(vRes.vouchers || []);
      setLedgers(lRes.ledgers || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load contra vouchers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debitLedgerId || !creditLedgerId || !amount || parseFloat(amount) <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }
    const numAmount = parseFloat(amount);
    setSubmitting(true);
    try {
      await voucherService.createVoucher({
        type: "CONTRA",
        date,
        narration: narration || "Bank / Cash Transfer",
        items: [
          {
            debitLedgerId: parseInt(debitLedgerId, 10),
            creditLedgerId: parseInt(creditLedgerId, 10),
            debitAmount: numAmount,
            creditAmount: numAmount,
            narration: narration || "Bank / Cash Transfer",
          },
        ],
      });
      toast.success("Contra voucher created successfully");
      setShowModal(false);
      setDebitLedgerId("");
      setCreditLedgerId("");
      setAmount("");
      setNarration("");
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create voucher");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-line shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-ink-muted mb-1">
            <span>Accounts</span>
            <span>/</span>
            <span className="text-ink font-medium">Contra Entries</span>
          </div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            <FaExchangeAlt className="text-purple-500" /> Contra Entry (Bank/Cash Transfer)
          </h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition shadow-sm cursor-pointer"
        >
          <FaPlus /> New Contra Entry
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-line shadow-sm overflow-hidden">
        <div className="p-4 border-b border-line bg-card-2 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Contra Vouchers</h2>
          <span className="text-xs text-ink-subtle font-mono">Count: {vouchers.length}</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-ink-muted">Loading contra vouchers...</div>
        ) : vouchers.length === 0 ? (
          <div className="p-12 text-center text-ink-subtle">No contra vouchers recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink-muted">
              <thead className="bg-head text-ink uppercase font-semibold text-xs border-b border-line">
                <tr>
                  <th className="px-4 py-3">Voucher No</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Transfer To (Debit)</th>
                  <th className="px-4 py-3">Transfer From (Credit)</th>
                  <th className="px-4 py-3 text-right">Amount (₹)</th>
                  <th className="px-4 py-3">Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {vouchers.map((v) => {
                  const item = v.items[0];
                  return (
                    <tr key={v.id} className="hover:bg-card-2 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-purple-500">{v.voucherNo}</td>
                      <td className="px-4 py-3">{new Date(v.date).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3 font-medium text-ink">{item?.debitLedger?.name || "-"}</td>
                      <td className="px-4 py-3 text-ink-muted">{item?.creditLedger?.name || "-"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">
                        ₹{(item?.debitAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-ink-subtle max-w-xs truncate">{v.narration || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-xl border border-line w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-line bg-card-2 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <FaExchangeAlt className="text-purple-500" /> New Contra Entry
              </h3>
              <button onClick={() => setShowModal(false)} className="text-ink-subtle hover:text-ink p-1 cursor-pointer">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink uppercase mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-line bg-card rounded-lg text-sm text-ink focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink uppercase mb-1">Transfer To (Debit Bank/Cash)</label>
                <select
                  value={debitLedgerId}
                  onChange={(e) => setDebitLedgerId(e.target.value)}
                  className="w-full px-3 py-2 border border-line bg-card rounded-lg text-sm text-ink focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                >
                  <option value="">Select Destination Bank/Cash</option>
                  {ledgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} - {l.name} ({l.group})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink uppercase mb-1">Transfer From (Credit Bank/Cash)</label>
                <select
                  value={creditLedgerId}
                  onChange={(e) => setCreditLedgerId(e.target.value)}
                  className="w-full px-3 py-2 border border-line bg-card rounded-lg text-sm text-ink focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                >
                  <option value="">Select Source Bank/Cash</option>
                  {ledgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} - {l.name} ({l.group})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-line bg-card rounded-lg text-sm font-semibold text-ink focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink uppercase mb-1">Narration</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Cash deposit to HDFC Bank"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  className="w-full px-3 py-2 border border-line bg-card rounded-lg text-sm text-ink focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <div className="pt-4 border-t border-line flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-ink-muted bg-card-2 hover:bg-card border border-line rounded-lg font-medium text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Saving..." : "Save Contra Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContraVoucherPage;
