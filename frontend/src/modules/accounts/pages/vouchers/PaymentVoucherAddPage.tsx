import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaMoneyBillWave, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, displayVoucherNo, type Voucher } from "../../../../services/voucherService";
import { accountService, type AccountLedger } from "../../../../services/accountService";
import LedgerSearchInput, { isBankOrCashLedger } from "../../../../components/form/LedgerSearchInput/LedgerSearchInput";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useListCache, prependToListCacheByPrefix } from "../../../../hooks/useListCache";

interface PaymentRow {
  id: number;
  debitLedgerId: string;
  amount: string;
  narration: string;
}

let rowCounter = 1;

// Busy-style: 17 empty rows pre-visible so the data-entry operator can tab
// through them without clicking "Add Row" per transaction.
const INITIAL_ROW_COUNT = 17;

const makeEmptyRow = (): PaymentRow => ({
  id: rowCounter++,
  debitLedgerId: "",
  amount: "",
  narration: "",
});

const PaymentVoucherAddPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [creditLedgerId, setCreditLedgerId] = useState("");
  const [mainNarration, setMainNarration] = useState("");
  const [nextVoucherNo, setNextVoucherNo] = useState<string>("");

  // Fetch the next sequential voucher number so it can be shown Busy-style
  // ("Vch No. 5"). We re-fetch after a save happens (see handleSubmit) so
  // the operator sees the next number ready for another entry.
  useEffect(() => {
    let cancelled = false;
    voucherService
      .fetchNextVoucherNo("PAYMENT")
      .then((no) => {
        if (!cancelled) setNextVoucherNo(no);
      })
      .catch(() => {
        if (!cancelled) setNextVoucherNo("");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [rows, setRows] = useState<PaymentRow[]>(() =>
    Array.from({ length: INITIAL_ROW_COUNT }, makeEmptyRow)
  );

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

  const paidFromLedger = ledgers.find((l) => String(l.id) === creditLedgerId);

  // Cur.Bal for the selected Payment Mode account, as of the entry date.
  // Fetched from the ledger statement (closingBalance up to that date).
  // For an ASSET ledger (bank/cash), positive = Dr (money in hand),
  // negative = Cr (overdraft). Busy shows "0.08 Dr" / "999.92 Cr".
  const [paidFromBalance, setPaidFromBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  useEffect(() => {
    if (!creditLedgerId) {
      setPaidFromBalance(null);
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    accountService
      .fetchStatement(parseInt(creditLedgerId, 10), { endDate: date })
      .then((res) => {
        if (!cancelled) setPaidFromBalance(res.closingBalance ?? 0);
      })
      .catch(() => {
        if (!cancelled) setPaidFromBalance(null);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [creditLedgerId, date]);

  const formatBalance = (bal: number) => {
    const abs = Math.abs(bal).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${abs} ${bal >= 0 ? "Dr" : "Cr"}`;
  };

  // Busy-style keyboard navigation. Every editable cell is tagged with
  // data-cell="rowIdx-field". focusCell() queries the container and focuses
  // the input inside. LedgerSearchInput cells are wrapped in a div, so we
  // pick the underlying <input>.
  const tableRef = useRef<HTMLDivElement>(null);

  const focusCell = (rowIdx: number, field: "account" | "amount" | "narration") => {
    if (!tableRef.current) return;
    const wrap = tableRef.current.querySelector<HTMLElement>(
      `[data-cell="${rowIdx}-${field}"]`
    );
    if (!wrap) return;
    const el =
      wrap.tagName === "INPUT" ? (wrap as HTMLInputElement) : wrap.querySelector("input");
    if (el) {
      el.focus();
      if (el.select) el.select();
    }
  };

  const addRow = () => {
    setRows((prev) => [...prev, makeEmptyRow()]);
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
      // Last row → add a new one, then focus its account
      if (rowIdx === rows.length - 1) {
        addRow();
        // Wait for React to render the new row before focusing
        setTimeout(() => focusCell(rowIdx + 1, "account"), 0);
      } else {
        focusCell(rowIdx + 1, "account");
      }
    }
  };

  const updateRow = (id: number, field: keyof PaymentRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // Busy behaviour: after save, wipe the entry rows so the operator can key
  // the next voucher without leaving the page. Date + Payment Mode are kept
  // (batch data-entry keeps the same bank / same day). Vch No is re-fetched
  // so the top shows the next sequential number ready to go.
  const resetFormForNext = () => {
    setMainNarration("");
    setRows(Array.from({ length: INITIAL_ROW_COUNT }, makeEmptyRow));
    voucherService
      .fetchNextVoucherNo("PAYMENT")
      .then(setNextVoucherNo)
      .catch(() => setNextVoucherNo(""));
    setTimeout(() => focusCell(0, "account"), 0);
  };

  const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const validCount = rows.filter((r) => r.debitLedgerId && parseFloat(r.amount) > 0).length;

  // Busy rule: row N is editable only if all rows 0..N-1 have account+amount.
  // The first "unlocked" row is the current data-entry frontier.
  const isRowComplete = (r: PaymentRow) => !!r.debitLedgerId && parseFloat(r.amount) > 0;
  const isRowUnlocked = (idx: number): boolean => {
    for (let i = 0; i < idx; i++) {
      if (!isRowComplete(rows[i])) return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!creditLedgerId) {
      toast.error("Select 'Payment Mode' (Bank / Cash) account");
      return;
    }

    const validRows = rows.filter((r) => r.debitLedgerId && parseFloat(r.amount) > 0);
    if (validRows.length === 0) {
      toast.error("Add at least one payment entry with account and amount");
      return;
    }

    for (const r of validRows) {
      if (r.debitLedgerId === creditLedgerId) {
        toast.error("'Paid To' and 'Payment Mode' cannot be the same account");
        return;
      }
    }

    // Busy-style negative-balance guard: if the total we are about to pay
    // out exceeds the current Payment Mode balance, ask the user to confirm.
    // (Non-blocking — user can proceed, matching Busy's Yes/No dialog.)
    const total = validRows.reduce((s, r) => s + parseFloat(r.amount), 0);
    if (paidFromBalance !== null && total > paidFromBalance) {
      const shortfall = total - paidFromBalance;
      const shortfallStr = shortfall.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const proceed = window.confirm(
        `Cash / Bank balance is going negative ( Rs. -${shortfallStr} ).\n\nWould you like to continue?`
      );
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      const created = await voucherService.createVoucher({
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
      // Optimistic list update — the Payment Register cache gets the new
      // voucher immediately, so navigating back shows it with no reload.
      if (created?.id) {
        prependToListCacheByPrefix<Voucher>("accounts:payment-vouchers:", created);
      }
      toast.success("Payment voucher saved successfully");
      resetFormForNext();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3">
      <div className="w-full lg:w-5xl max-w-full">
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-line rounded-md overflow-hidden shadow-sm"
        >
          {/* Title bar — Busy-style red header */}
          <div className="text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
            Add Payment Voucher
          </div>

          {/* Top meta section — Busy layout: compact labels + inline values */}
          <div className="px-3 py-2 border-b border-line grid grid-cols-12 gap-x-3 gap-y-1.5 text-[11px] items-center">
            {/* Voucher Series (readonly)
            <label className="col-span-2 text-ink-subtle font-semibold">Voucher Series</label>
            <div className="col-span-4 text-ink font-semibold">Main</div> */}

            <label className="col-span-2 text-ink-subtle font-semibold">Date</label>
            <div className="col-span-4">
              <DatePickerCalendar name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <label className="col-span-2 text-ink-subtle font-semibold">Vch No.</label>
            <div className="col-span-4 text-ink font-mono font-bold text-[12px]">
              {nextVoucherNo ? displayVoucherNo(nextVoucherNo) : "…"}
            </div>

            {/* Payment Mode (bank/cash) */}
            <label className="col-span-2 text-ink-subtle font-semibold">Payment Mode</label>
            <div className="col-span-4">
              <LedgerSearchInput
                value={creditLedgerId}
                ledgers={ledgers}
                onChange={setCreditLedgerId}
                placeholder="Search bank / cash..."
                required
                filterFn={isBankOrCashLedger}
                accentColor="red-500"
                onSelected={() => focusCell(0, "account")}
              />
            </div>

            <label className="col-span-2 text-ink-subtle font-semibold">Narration</label>
            <div className="col-span-4">
              <input
                type="text"
                placeholder=""
                value={mainNarration}
                onChange={(e) => setMainNarration(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusCell(0, "account");
                  }
                }}
                className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
              />
            </div>

            {paidFromLedger && (
              <div className="col-span-12 text-[10px] pt-0.5 flex items-center gap-3">
                <span className="text-ink-subtle italic">
                  ({paidFromLedger.name} — {paidFromLedger.group})
                </span>
                {balanceLoading ? (
                  <span className="text-ink-subtle">Cur. Bal. = ...</span>
                ) : paidFromBalance !== null ? (
                  <span
                    className={`font-mono font-semibold ${
                      paidFromBalance < 0 ? "text-red-500" : "text-emerald-500"
                    }`}
                  >
                    Cur. Bal. = {formatBalance(paidFromBalance)}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* Spreadsheet-style items grid */}
          <div className="border-b border-line" ref={tableRef}>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-card-2 text-ink font-bold border-b border-line">
                  <th className="w-10 px-2 py-1 text-center border-r border-line">S.No</th>
                  <th className="px-2 py-1 text-left border-r border-line">Account</th>
                  <th className="w-32 px-2 py-1 text-right border-r border-line">Amount (Rs.)</th>
                  <th className="px-2 py-1 text-left">Short Narration</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const unlocked = isRowUnlocked(idx);
                  return (
                  <tr
                    key={row.id}
                    className={`border-b border-line-soft last:border-b-0 ${unlocked ? "" : "bg-card-2/10"}`}
                  >
                    <td className={`w-10 px-2 py-0 text-center border-r border-line font-mono text-[11px] ${unlocked ? "text-ink-subtle bg-card-2/40" : "text-ink-subtle/40 bg-card-2/20"}`}>
                      {idx + 1}
                    </td>
                    <td className="px-0 py-0 border-r border-line">
                      <div data-cell={`${idx}-account`}>
                        <LedgerSearchInput
                          value={row.debitLedgerId}
                          ledgers={ledgers}
                          onChange={(val) => updateRow(row.id, "debitLedgerId", val)}
                          placeholder=""
                          filterFn={(l) => !isBankOrCashLedger(l)}
                          accentColor="red-500"
                          variant="cell"
                          onSelected={() => focusCell(idx, "amount")}
                          disabled={!unlocked}
                        />
                      </div>
                    </td>
                    <td className="w-32 px-0 py-0 border-r border-line">
                      <input
                        data-cell={`${idx}-amount`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder=""
                        value={row.amount}
                        onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                        onKeyDown={(e) => handleAmountKeyDown(e, idx)}
                        disabled={!unlocked}
                        className={`w-full px-2 py-1 bg-transparent border-0 text-[11px] text-ink text-right font-mono focus:outline-none focus:bg-card-2/60 ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
                      />
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
                        className={`w-full px-2 py-1 bg-transparent border-0 text-[11px] text-ink focus:outline-none focus:bg-card-2/60 ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
                      />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-card-2 border-t border-line">
                  <td className="px-2 py-1 text-left" colSpan={2}>
                    <button
                      type="button"
                      onClick={addRow}
                      className="flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-600 cursor-pointer"
                    >
                      <FaPlus className="w-2 h-2" /> Add Row
                    </button>
                  </td>
                  <td className="w-32 px-2 py-1 text-right font-mono font-bold text-ink border-l border-line">
                    {totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1 text-[10px] text-ink-subtle italic">
                    {validCount} valid entries
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bottom action bar */}
          <div className="px-3 py-2 flex items-center justify-between bg-card-2/40">
            <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
              <FaMoneyBillWave className="text-red-500" />
              <span>
                <kbd className="px-1 border border-line rounded bg-card text-[10px]">Enter</kbd> /
                {" "}<kbd className="px-1 border border-line rounded bg-card text-[10px]">Tab</kbd> to move forward •
                {" "}<kbd className="px-1 border border-line rounded bg-card text-[10px]">↑↓</kbd> in dropdown
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate("/accounts/payment-voucher")}
                className="px-4 py-1 text-ink bg-card-2 hover:bg-card border border-line rounded font-semibold text-[11px] transition cursor-pointer"
              >
                Quit
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-[11px] transition disabled:opacity-50 cursor-pointer"
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

export default PaymentVoucherAddPage;
