import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaBookOpen, FaPlus, FaTrash, FaArrowLeft } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService } from "../../../../services/voucherService";
import { accountService, type AccountLedger } from "../../../../services/accountService";
import LedgerSearchInput from "../../../../components/form/LedgerSearchInput/LedgerSearchInput";

interface JournalRow {
  id: number;
  ledgerId: string;
  debitAmount: string;
  creditAmount: string;
  narration: string;
}

let rowCounter = 1;

const JournalEntryAddPage: React.FC = () => {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [mainNarration, setMainNarration] = useState("");
  const [rows, setRows] = useState<JournalRow[]>([
    { id: rowCounter++, ledgerId: "", debitAmount: "", creditAmount: "", narration: "" },
    { id: rowCounter++, ledgerId: "", debitAmount: "", creditAmount: "", narration: "" },
  ]);

  useEffect(() => {
    accountService.fetchLedgers({ limit: 1000 }).then((res) => {
      setLedgers(res.ledgers || []);
      setLoading(false);
    }).catch(() => { toast.error("Failed to load accounts"); setLoading(false); });
  }, []);

  const addRow = () => {
    setRows((prev) => [...prev, { id: rowCounter++, ledgerId: "", debitAmount: "", creditAmount: "", narration: "" }]);
  };
  const removeRow = (id: number) => { if (rows.length <= 2) return; setRows((prev) => prev.filter((r) => r.id !== id)); };
  const updateRow = (id: number, field: keyof JournalRow, value: string) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === "debitAmount" && value) updated.creditAmount = "";
      if (field === "creditAmount" && value) updated.debitAmount = "";
      return updated;
    }));
  };

  const totalDebit = rows.reduce((sum, r) => sum + (parseFloat(r.debitAmount) || 0), 0);
  const totalCredit = rows.reduce((sum, r) => sum + (parseFloat(r.creditAmount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter((r) => r.ledgerId && (parseFloat(r.debitAmount) > 0 || parseFloat(r.creditAmount) > 0));
    if (validRows.length < 2) { toast.error("Need at least 2 entries (one debit, one credit)"); return; }
    if (!isBalanced) { toast.error(`Debit (₹${totalDebit.toFixed(2)}) and Credit (₹${totalCredit.toFixed(2)}) must be equal`); return; }

    const items = validRows.map((r) => {
      const dr = parseFloat(r.debitAmount) || 0;
      const cr = parseFloat(r.creditAmount) || 0;
      return {
        debitLedgerId: dr > 0 ? parseInt(r.ledgerId, 10) : null,
        creditLedgerId: cr > 0 ? parseInt(r.ledgerId, 10) : null,
        debitAmount: dr, creditAmount: cr,
        narration: r.narration || mainNarration || "Journal Entry",
      };
    });

    setSubmitting(true);
    try {
      await voucherService.createVoucher({ type: "JOURNAL", date, narration: mainNarration || "Journal Entry", items });
      toast.success("Journal entry saved successfully");
      navigate("/accounts/journal-entry");
    } catch (err: any) { toast.error(err?.response?.data?.message || err?.message || "Failed to save"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-6 text-center text-xs text-ink-muted">Loading accounts...</div>;

  return (
    <div className="p-3 space-y-3 bg-card-2 min-h-screen">
      {/* Compact Header */}
      <div className="bg-card rounded-lg border border-line flex items-center justify-between gap-2 px-3 py-2">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2">
          <FaBookOpen className="text-purple-500 text-sm" /> New Journal Entry
        </h1>
        <button
          onClick={() => navigate("/accounts/journal-entry")}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-card border border-line text-ink rounded text-xs font-semibold transition cursor-pointer"
        >
          <FaArrowLeft className="text-[10px]" /> Back
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-purple-600/10 flex items-center gap-2">
          <FaBookOpen className="text-purple-500 text-xs" />
          <h2 className="text-xs font-bold text-ink">Journal Details</h2>
        </div>

        <div className="p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block mb-0.5 text-[10px] font-semibold text-ink-subtle uppercase tracking-wide">
                Date <span className="text-purple-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block mb-0.5 text-[10px] font-semibold text-ink-subtle uppercase tracking-wide">Narration / Remarks</label>
              <input
                type="text"
                placeholder="e.g. Salary adjustment"
                value={mainNarration}
                onChange={(e) => setMainNarration(e.target.value)}
                className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="border border-line rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-card-2 text-ink uppercase text-[10px] tracking-wide font-bold border-b border-line">
                <tr>
                  <th className="px-2 py-1.5 text-left w-8">#</th>
                  <th className="px-2 py-1.5 text-left">Account</th>
                  <th className="px-2 py-1.5 text-right w-32">Debit (₹)</th>
                  <th className="px-2 py-1.5 text-right w-32">Credit (₹)</th>
                  <th className="px-2 py-1.5 text-left">Narration</th>
                  <th className="px-2 py-1.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-card-2/50">
                    <td className="px-2 py-1.5 text-ink-subtle font-mono text-[11px]">{idx + 1}</td>
                    <td className="px-2 py-1.5">
                      <LedgerSearchInput value={row.ledgerId} ledgers={ledgers}
                        onChange={(val) => updateRow(row.id, "ledgerId", val)} placeholder="Search account..." accentColor="purple-500" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={row.debitAmount}
                        onChange={(e) => updateRow(row.id, "debitAmount", e.target.value)}
                        className="w-full px-2 py-1 border border-line bg-card rounded text-xs text-ink text-right font-mono font-semibold focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500 focus:outline-none" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={row.creditAmount}
                        onChange={(e) => updateRow(row.id, "creditAmount", e.target.value)}
                        className="w-full px-2 py-1 border border-line bg-card rounded text-xs text-ink text-right font-mono font-semibold focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500 focus:outline-none" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" placeholder="Details..." value={row.narration}
                        onChange={(e) => updateRow(row.id, "narration", e.target.value)}
                        className="w-full px-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500 focus:outline-none" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {rows.length > 2 && (
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
                      className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-700 cursor-pointer">
                      <FaPlus className="w-2.5 h-2.5" /> Add Row
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span className="text-[10px] text-ink-subtle uppercase tracking-wide">Dr:</span>
                    <span className="ml-1 text-sm font-mono font-bold text-ink">₹{totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span className="text-[10px] text-ink-subtle uppercase tracking-wide">Cr:</span>
                    <span className="ml-1 text-sm font-mono font-bold text-ink">₹{totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </td>
                  <td colSpan={2} className="px-2 py-1.5">
                    {(totalDebit > 0 || totalCredit > 0) && (
                      isBalanced
                        ? <span className="text-[11px] font-bold text-emerald-600">Balanced</span>
                        : <span className="text-[11px] font-bold text-red-500">Diff: ₹{Math.abs(totalDebit - totalCredit).toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-line">
            <div className="text-xs">
              <span className={`font-bold font-mono ${isBalanced ? "text-emerald-600" : "text-red-500"}`}>
                Dr: ₹{totalDebit.toFixed(2)} | Cr: ₹{totalCredit.toFixed(2)}
              </span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate("/accounts/journal-entry")}
                className="px-3 py-1.5 text-ink-muted bg-card-2 hover:bg-card border border-line rounded font-semibold text-xs transition cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={submitting || !isBalanced}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-xs transition disabled:opacity-50 cursor-pointer">
                {submitting ? "Saving..." : "Save Journal Entry"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default JournalEntryAddPage;
