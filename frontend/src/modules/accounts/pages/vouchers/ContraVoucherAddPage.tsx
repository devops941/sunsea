import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaExchangeAlt, FaArrowLeft } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService } from "../../../../services/voucherService";
import { accountService, type AccountLedger } from "../../../../services/accountService";
import LedgerSearchInput, { isBankOrCashLedger } from "../../../../components/form/LedgerSearchInput/LedgerSearchInput";
import { useListCache } from "../../../../hooks/useListCache";

const ContraVoucherAddPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [debitLedgerId, setDebitLedgerId] = useState("");
  const [creditLedgerId, setCreditLedgerId] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");

  const ledgersFetcher = useCallback(async (_signal: AbortSignal) => {
    const res = await accountService.fetchLedgers({ limit: 1000 });
    const list = res.ledgers || [];
    return { data: list, total: list.length };
  }, []);

  const { data: ledgers } = useListCache<AccountLedger>({
    cacheKey: "accounts:ledgers:all",
    socketModule: "accountLedger",
    fetcher: ledgersFetcher,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debitLedgerId || !creditLedgerId || !amount || parseFloat(amount) <= 0) {
      toast.error("Fill all required fields"); return;
    }
    if (debitLedgerId === creditLedgerId) { toast.error("Transfer To and From must be different"); return; }

    setSubmitting(true);
    try {
      await voucherService.createVoucher({
        type: "CONTRA", date, narration: narration || "Bank / Cash Transfer",
        items: [{
          debitLedgerId: parseInt(debitLedgerId, 10), creditLedgerId: parseInt(creditLedgerId, 10),
          debitAmount: parseFloat(amount), creditAmount: parseFloat(amount),
          narration: narration || "Bank / Cash Transfer",
        }],
      });
      toast.success("Contra entry saved successfully");
      navigate("/accounts/contra-entry");
    } catch (err: any) { toast.error(err?.response?.data?.message || err?.message || "Failed to save"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="p-3 space-y-3 min-h-screen">
      {/* Compact Header */}
      <div className="bg-card rounded-lg border border-line flex items-center justify-between gap-2 px-3 py-2">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2">
          <FaExchangeAlt className="text-amber-500 text-sm" /> New Contra Entry
        </h1>
        <button
          onClick={() => navigate("/accounts/contra-entry")}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-card border border-line text-ink rounded text-xs font-semibold transition cursor-pointer"
        >
          <FaArrowLeft className="text-[10px]" /> Back
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-amber-600/10 flex items-center gap-2">
          <FaExchangeAlt className="text-amber-500 text-xs" />
          <h2 className="text-xs font-bold text-ink">Contra Details</h2>
        </div>

        <div className="p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block mb-0.5 text-[10px] font-semibold text-ink-subtle uppercase tracking-wide">
                Date <span className="text-amber-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block mb-0.5 text-[10px] font-semibold text-ink-subtle uppercase tracking-wide">
                Amount (₹) <span className="text-amber-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink text-right font-mono font-semibold focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <LedgerSearchInput
                label="Transfer From (Source)"
                value={creditLedgerId}
                ledgers={ledgers}
                onChange={setCreditLedgerId}
                placeholder="Search source bank / cash..."
                required
                filterFn={isBankOrCashLedger}
                accentColor="amber-500"
              />
            </div>
            <div>
              <LedgerSearchInput
                label="Transfer To (Destination)"
                value={debitLedgerId}
                ledgers={ledgers}
                onChange={setDebitLedgerId}
                placeholder="Search destination bank / cash..."
                required
                filterFn={isBankOrCashLedger}
                accentColor="amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block mb-0.5 text-[10px] font-semibold text-ink-subtle uppercase tracking-wide">Narration / Remarks</label>
            <input
              type="text"
              placeholder="e.g. Cash deposit to HDFC Bank"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-line">
            <div className="text-xs text-ink-muted">
              {amount && parseFloat(amount) > 0 && (
                <>
                  <span className="text-[10px] text-ink-subtle uppercase tracking-wide">Transfer:</span>
                  <span className="ml-2 text-sm font-mono font-bold text-ink">
                    ₹{parseFloat(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate("/accounts/contra-entry")}
                className="px-3 py-1.5 text-ink-muted bg-card-2 hover:bg-card border border-line rounded font-semibold text-xs transition cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold text-xs transition disabled:opacity-50 cursor-pointer">
                {submitting ? "Saving..." : "Save Contra Entry"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ContraVoucherAddPage;
