import React, { useState, useCallback, useRef } from "react";
import { useFormShortcuts } from "../../../../hooks/useFormShortcuts";
import { useNavigate } from "react-router-dom";
import { FaBookOpen, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, type Voucher } from "../../../../services/voucherService";
import { accountService, type AccountLedger } from "../../../../services/accountService";
import LedgerSearchInput from "../../../../components/form/LedgerSearchInput/LedgerSearchInput";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useListCache, prependToListCacheByPrefix } from "../../../../hooks/useListCache";
import { formatAmount, formatAmountOnBlur } from "../../../../utils/pricingUtils";

// Journal = free-form debit/credit entries. Unlike Payment/Receipt there is
// no fixed "Mode" account; every row picks its own ledger AND its own side
// (D or C). Trial balance closes only when Σ Debit == Σ Credit.
interface JournalRow {
  id: number;
  dc: "D" | "C";
  ledgerId: string;
  amount: string;
  narration: string;
}

let rowCounter = 1;
const INITIAL_ROW_COUNT = 17;

// Alternating D/C for the seed rows matches Busy's convention (first row
// defaults to Debit; the operator commonly flips subsequent rows to C).
const makeEmptyRow = (idx: number): JournalRow => ({
  id: rowCounter++,
  dc: idx === 0 ? "D" : "C",
  ledgerId: "",
  amount: "",
  narration: "",
});

const JournalEntryAddPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [mainNarration, setMainNarration] = useState("");
  const [rows, setRows] = useState<JournalRow[]>(() =>
    Array.from({ length: INITIAL_ROW_COUNT }, (_, i) => makeEmptyRow(i))
  );

  // F2 = save + auto-focus Date on mount (centralised via useFormShortcuts).
  useFormShortcuts({ autoFocusField: "date" });

  // Busy quirk: Journal doesn't preview the next Vch No in the entry screen
  // (unlike Payment / Receipt). The number is assigned server-side on save.

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

  // Keyboard nav — DC → account → amount → narration → next row account
  const tableRef = useRef<HTMLDivElement>(null);

  const focusCell = (rowIdx: number, field: "dc" | "account" | "amount" | "narration") => {
    if (!tableRef.current) return;
    const wrap = tableRef.current.querySelector<HTMLElement>(`[data-cell="${rowIdx}-${field}"]`);
    if (!wrap) return;
    const el =
      wrap.tagName === "INPUT" || wrap.tagName === "SELECT"
        ? (wrap as HTMLInputElement)
        : wrap.querySelector("input");
    if (el) {
      el.focus();
      if ((el as HTMLInputElement).select) (el as HTMLInputElement).select();
    }
  };

  const addRow = () => {
    setRows((prev) => [...prev, makeEmptyRow(prev.length)]);
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusCell(rowIdx, "narration");
    }
  };

  const handleNarrationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (rowIdx === rows.length - 1) {
        addRow();
        setTimeout(() => focusCell(rowIdx + 1, "dc"), 0);
      } else {
        focusCell(rowIdx + 1, "dc");
      }
    }
  };

  const updateRow = (id: number, field: keyof JournalRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const totalDebit = rows.reduce(
    (sum, r) => sum + (r.dc === "D" ? parseFloat(r.amount) || 0 : 0),
    0
  );
  const totalCredit = rows.reduce(
    (sum, r) => sum + (r.dc === "C" ? parseFloat(r.amount) || 0 : 0),
    0
  );
  const diff = totalDebit - totalCredit;
  const isBalanced = Math.abs(diff) < 0.01;
  const hasAnyAmount = totalDebit > 0 || totalCredit > 0;
  const validCount = rows.filter((r) => r.ledgerId && parseFloat(r.amount) > 0).length;

  const isRowComplete = (r: JournalRow) => !!r.ledgerId && parseFloat(r.amount) > 0;
  const isRowUnlocked = (idx: number): boolean => {
    for (let i = 0; i < idx; i++) {
      if (!isRowComplete(rows[i])) return false;
    }
    return true;
  };

  // Busy behaviour: after save, wipe the entry rows so the operator can key
  // the next Journal voucher without leaving the page. Date is preserved.
  const resetFormForNext = () => {
    setMainNarration("");
    setRows(Array.from({ length: INITIAL_ROW_COUNT }, (_, i) => makeEmptyRow(i)));
    setTimeout(() => focusCell(0, "dc"), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validRows = rows.filter((r) => r.ledgerId && parseFloat(r.amount) > 0);
    if (validRows.length < 2) {
      toast.error("Need at least 2 entries (one debit, one credit)");
      return;
    }
    // Busy-style popup wording so the operator sees the exact same message
    // they know from Busy's "Invalid Data!" dialog on unbalanced entries.
    if (!isBalanced) {
      toast.error("Debit & Credit amounts should be equal.");
      return;
    }

    const items = validRows.map((r) => {
      const amt = parseFloat(r.amount);
      const isDebit = r.dc === "D";
      return {
        debitLedgerId: isDebit ? parseInt(r.ledgerId, 10) : null,
        creditLedgerId: !isDebit ? parseInt(r.ledgerId, 10) : null,
        debitAmount: isDebit ? amt : 0,
        creditAmount: !isDebit ? amt : 0,
        narration: r.narration || mainNarration || "Journal Entry",
      };
    });

    setSubmitting(true);
    try {
      const created = await voucherService.createVoucher({
        type: "JOURNAL",
        date,
        narration: mainNarration || "Journal Entry",
        items,
      });
      // Optimistic list update — Journal Register cache gets the new voucher.
      if (created?.id) {
        prependToListCacheByPrefix<Voucher>("accounts:journal-vouchers:", created);
      }
      toast.success("Journal entry saved successfully");
      resetFormForNext();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3">
      <div className="w-full lg:w-7xl max-w-full">
        <form onSubmit={handleSubmit} className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
          {/* Title bar — Journal uses purple accent */}
          <div className="bg-purple-600/90 text-white text-[13px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
            Add Journal Voucher
          </div>

          {/* Top meta grid — Journal has NO Mode field (unlike Payment/Receipt).
             Labels are col-span-1 and right-aligned so they sit close to the
             input instead of leaving big empty gaps on a wide (7xl) container. */}
          <div className="px-3 py-2 border-b border-line grid grid-cols-12 gap-x-2 gap-y-1.5 text-[13px] items-center">
            <label className="col-span-1 text-ink-subtle font-semibold text-right">Date</label>
            <div className="col-span-4">
              <DatePickerCalendar name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <label className="col-span-1 text-ink-subtle font-semibold text-right">Vch No.</label>
            <div className="col-span-6 text-ink-subtle font-mono text-[13px] italic">
              (auto)
            </div>

            <label className="col-span-1 text-ink-subtle font-semibold text-right">Narration</label>
            <div className="col-span-11">
              <input
                type="text"
                placeholder=""
                value={mainNarration}
                onChange={(e) => setMainNarration(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusCell(0, "dc");
                  }
                }}
                className="w-full px-2 py-1 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Spreadsheet items grid — with D/C column + separate Dr/Cr */}
          <div className="border-b border-line" ref={tableRef}>
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="bg-card-2 text-ink font-bold border-b border-line">
                  <th className="w-10 px-2 py-1 text-center border-r border-line">S.No</th>
                  <th className="w-12 px-2 py-1 text-center border-r border-line">D/C</th>
                  <th className="px-2 py-1 text-left border-r border-line">Account</th>
                  <th className="w-28 px-2 py-1 text-right border-r border-line">Debit (Rs.)</th>
                  <th className="w-28 px-2 py-1 text-right border-r border-line">Credit (Rs.)</th>
                  <th className="px-2 py-1 text-left">Short Narration</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const unlocked = isRowUnlocked(idx);
                  const isDebit = row.dc === "D";
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-line-soft last:border-b-0 ${unlocked ? "" : "bg-card-2/10"}`}
                    >
                      <td className={`w-10 px-2 py-0 text-center border-r border-line font-mono text-[13px] ${unlocked ? "text-ink-subtle bg-card-2/40" : "text-ink-subtle/40 bg-card-2/20"}`}>
                        {idx + 1}
                      </td>
                      <td className="w-12 px-0 py-0 border-r border-line text-center">
                        <select
                          data-cell={`${idx}-dc`}
                          value={row.dc}
                          onChange={(e) => updateRow(row.id, "dc", e.target.value)}
                          disabled={!unlocked}
                          className={`w-full px-1 py-1 bg-transparent border-0 text-[13px] font-bold font-mono text-center text-ink focus:outline-none focus:bg-card-2/60 ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
                        >
                          <option value="D">D</option>
                          <option value="C">C</option>
                        </select>
                      </td>
                      <td className="px-0 py-0 border-r border-line">
                        <div data-cell={`${idx}-account`}>
                          <LedgerSearchInput
                            value={row.ledgerId}
                            ledgers={ledgers}
                            onChange={(val) => updateRow(row.id, "ledgerId", val)}
                            placeholder=""
                            accentColor="purple-500"
                            variant="cell"
                            onSelected={() => focusCell(idx, "amount")}
                            disabled={!unlocked}
                          />
                        </div>
                      </td>
                      {/* Debit column — filled only when D/C = D */}
                      <td className="w-28 px-0 py-0 border-r border-line">
                        {isDebit ? (
                          <input
                            data-cell={`${idx}-amount`}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder=""
                            value={row.amount}
                            onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                            onBlur={formatAmountOnBlur((val) => updateRow(row.id, "amount", val))}
                            onKeyDown={(e) => handleAmountKeyDown(e, idx)}
                            disabled={!unlocked}
                            className={`w-full px-2 py-1 bg-transparent border-0 text-[13px] text-ink text-right font-mono focus:outline-none focus:bg-card-2/60 ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
                          />
                        ) : (
                          <div className="w-full px-2 py-1 text-right text-ink-subtle/30 font-mono">-</div>
                        )}
                      </td>
                      {/* Credit column — filled only when D/C = C */}
                      <td className="w-28 px-0 py-0 border-r border-line">
                        {!isDebit ? (
                          <input
                            data-cell={`${idx}-amount`}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder=""
                            value={row.amount}
                            onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                            onBlur={formatAmountOnBlur((val) => updateRow(row.id, "amount", val))}
                            onKeyDown={(e) => handleAmountKeyDown(e, idx)}
                            disabled={!unlocked}
                            className={`w-full px-2 py-1 bg-transparent border-0 text-[13px] text-ink text-right font-mono focus:outline-none focus:bg-card-2/60 ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
                          />
                        ) : (
                          <div className="w-full px-2 py-1 text-right text-ink-subtle/30 font-mono">-</div>
                        )}
                      </td>
                      <td className="px-0 py-0">
                        <input
                          data-cell={`${idx}-narration`}
                          type="text"
                          placeholder=""
                          value={row.narration}
                          onChange={(e) => updateRow(row.id, "narration", e.target.value)}
                          onKeyDown={(e) => handleNarrationKeyDown(e, idx)}
                          disabled={!unlocked}
                          className={`w-full px-2 py-1 bg-transparent border-0 text-[13px] text-ink focus:outline-none focus:bg-card-2/60 ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-card-2 border-t border-line">
                  <td className="px-2 py-1 text-left" colSpan={3}>
                    <button
                      type="button"
                      onClick={addRow}
                      className="flex items-center gap-1 text-[13px] font-semibold text-purple-500 hover:text-purple-600 cursor-pointer"
                    >
                      <FaPlus className="w-2 h-2" /> Add Row
                    </button>
                  </td>
                  <td className="w-28 px-2 py-1 text-right font-mono font-bold text-emerald-600 border-l border-line">
                    {formatAmount(totalDebit)}
                  </td>
                  <td className="w-28 px-2 py-1 text-right font-mono font-bold text-red-500 border-l border-line">
                    {formatAmount(totalCredit)}
                  </td>
                  <td className="px-2 py-1 text-[13px] italic">
                    {hasAnyAmount ? (
                      isBalanced ? (
                        <span className="text-emerald-600 font-semibold">Balanced · {validCount} entries</span>
                      ) : (
                        <span className="text-red-500 font-semibold">
                          Diff: {formatAmount(Math.abs(diff))} {diff > 0 ? "(Cr short)" : "(Dr short)"}
                        </span>
                      )
                    ) : (
                      <span className="text-ink-subtle">{validCount} valid entries</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bottom action bar */}
          <div className="px-3 py-2 flex items-center justify-between bg-card-2/40">
            <div className="flex items-center gap-2 text-[13px] text-ink-subtle">
              <FaBookOpen className="text-purple-500" />
              <span>
                <kbd className="px-1 border border-line rounded bg-card text-[13px]">D</kbd> /
                {" "}<kbd className="px-1 border border-line rounded bg-card text-[13px]">C</kbd> in D/C column •
                {" "}<kbd className="px-1 border border-line rounded bg-card text-[13px]">Enter</kbd> to move forward
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate("/accounts/journal-entry")}
                className="px-4 py-1 text-ink bg-card-2 hover:bg-card border border-line rounded font-semibold text-[13px] transition cursor-pointer"
              >
                Quit
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-[13px] transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JournalEntryAddPage;
