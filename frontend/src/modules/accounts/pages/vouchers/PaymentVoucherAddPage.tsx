import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaMoneyBillWave, FaPlus, FaTrash, FaArrowLeft } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService } from "../../../../services/voucherService";
import { accountService, type AccountLedger } from "../../../../services/accountService";
import LedgerSearchInput from "../../../../components/form/LedgerSearchInput/LedgerSearchInput";

interface PaymentRow {
  id: number;
  debitLedgerId: string;
  amount: string;
  narration: string;
}

let rowCounter = 1;

const PaymentVoucherAddPage: React.FC = () => {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [creditLedgerId, setCreditLedgerId] = useState("");
  const [mainNarration, setMainNarration] = useState("");
  const [rows, setRows] = useState<PaymentRow[]>([
    { id: rowCounter++, debitLedgerId: "", amount: "", narration: "" },
  ]);

  useEffect(() => {
    accountService.fetchLedgers({ limit: 1000 }).then((res) => {
      setLedgers(res.ledgers || []);
      setLoading(false);
    }).catch(() => {
      toast.error("Failed to load accounts");
      setLoading(false);
    });
  }, []);

  const addRow = () => {
    setRows((prev) => [...prev, { id: rowCounter++, debitLedgerId: "", amount: "", narration: "" }]);
  };

  const removeRow = (id: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: number, field: keyof PaymentRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!creditLedgerId) {
      toast.error("Select 'Paid From' (Bank / Cash) account");
      return;
    }

    const validRows = rows.filter((r) => r.debitLedgerId && parseFloat(r.amount) > 0);
    if (validRows.length === 0) {
      toast.error("Add at least one payment entry with account and amount");
      return;
    }

    for (const r of validRows) {
      if (r.debitLedgerId === creditLedgerId) {
        toast.error("'Paid To' and 'Paid From' cannot be the same account");
        return;
      }
    }

    setSubmitting(true);
    try {
      await voucherService.createVoucher({
        type: "PAYMENT",
        date,
        narration: mainNarration || "Payment Voucher",
        items: validRows.map((r) => ({
          debitLedgerId: parseInt(r.debitLedgerId, 10),
          creditLedgerId: parseInt(creditLedgerId, 10),
          debitAmount: parseFloat(r.amount),
          creditAmount: parseFloat(r.amount),
          narration: r.narration || mainNarration || "Payment",
        })),
      });
      toast.success("Payment voucher saved successfully");
      navigate("/accounts/payment-voucher");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-xs text-ink-muted">Loading accounts...</div>;

  return (
    <div className="p-3 space-y-3 bg-card-2 min-h-screen">
      {/* Compact Header */}
      <div className="bg-card rounded-lg border border-line flex items-center justify-between gap-2 px-3 py-2">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2">
          <FaMoneyBillWave className="text-red-500 text-sm" /> New Payment Entry
        </h1>
        <button
          onClick={() => navigate("/accounts/payment-voucher")}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-card border border-line text-ink rounded text-xs font-semibold transition cursor-pointer"
        >
          <FaArrowLeft className="text-[10px]" /> Back
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-red-600/10 flex items-center gap-2">
          <FaMoneyBillWave className="text-red-500 text-xs" />
          <h2 className="text-xs font-bold text-ink">Payment Details</h2>
        </div>

        <div className="p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="block mb-0.5 text-[10px] font-semibold text-ink-subtle uppercase tracking-wide">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <LedgerSearchInput
                label="Paid From (Bank / Cash)"
                value={creditLedgerId}
                ledgers={ledgers}
                onChange={setCreditLedgerId}
                placeholder="Search bank / cash account..."
                required
                accentColor="red-500"
              />
            </div>
            <div>
              <label className="block mb-0.5 text-[10px] font-semibold text-ink-subtle uppercase tracking-wide">Narration / Remarks</label>
              <input
                type="text"
                placeholder="e.g. Daily payments"
                value={mainNarration}
                onChange={(e) => setMainNarration(e.target.value)}
                className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="border border-line rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-card-2 text-ink uppercase text-[10px] tracking-wide font-bold border-b border-line">
                <tr>
                  <th className="px-2 py-1.5 text-left w-8">#</th>
                  <th className="px-2 py-1.5 text-left">Paid To (Account)</th>
                  <th className="px-2 py-1.5 text-right w-36">Amount (₹)</th>
                  <th className="px-2 py-1.5 text-left">Narration</th>
                  <th className="px-2 py-1.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-card-2/50">
                    <td className="px-2 py-1.5 text-ink-subtle font-mono text-[11px]">{idx + 1}</td>
                    <td className="px-2 py-1.5">
                      <LedgerSearchInput
                        value={row.debitLedgerId}
                        ledgers={ledgers}
                        onChange={(val) => updateRow(row.id, "debitLedgerId", val)}
                        placeholder="Search account..."
                        accentColor="red-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={row.amount}
                        onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                        className="w-full px-2 py-1 border border-line bg-card rounded text-xs text-ink text-right font-mono font-semibold focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" placeholder="Details..." value={row.narration}
                        onChange={(e) => updateRow(row.id, "narration", e.target.value)}
                        className="w-full px-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {rows.length > 1 && (
                        <button type="button" onClick={() => removeRow(row.id)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer">
                          <FaTrash className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line bg-card-2">
                <tr>
                  <td colSpan={2} className="px-2 py-1.5">
                    <button type="button" onClick={addRow}
                      className="flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 cursor-pointer">
                      <FaPlus className="w-2.5 h-2.5" /> Add Row
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span className="text-[10px] text-ink-subtle uppercase tracking-wide">Total:</span>
                    <span className="ml-2 text-sm font-mono font-bold text-ink">
                      ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-line">
            <div className="text-xs text-ink-muted">
              {rows.filter((r) => r.debitLedgerId && parseFloat(r.amount) > 0).length} entries |{" "}
              <span className="font-bold text-ink font-mono">Total: ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate("/accounts/payment-voucher")}
                className="px-3 py-1.5 text-ink-muted bg-card-2 hover:bg-card border border-line rounded font-semibold text-xs transition cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-xs transition disabled:opacity-50 cursor-pointer">
                {submitting ? "Saving..." : "Save Payment Voucher"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PaymentVoucherAddPage;
