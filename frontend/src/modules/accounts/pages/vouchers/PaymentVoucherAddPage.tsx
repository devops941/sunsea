import React, { useState, useCallback, useRef, useEffect } from "react";
import { useFormShortcuts } from "../../../../hooks/useFormShortcuts";
import { useNavigate } from "react-router-dom";
import { FaMoneyBillWave, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, displayVoucherNo, type Voucher } from "../../../../services/voucherService";
import { accountService, type AccountLedger } from "../../../../services/accountService";
import LedgerSearchInput, { isBankOrCashLedger } from "../../../../components/form/LedgerSearchInput/LedgerSearchInput";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useListCache, prependToListCacheByPrefix } from "../../../../hooks/useListCache";
import { formatAmount, formatAmountOnBlur } from "../../../../utils/pricingUtils";
import { handleGridArrow } from "../../../../hooks/useFormGridNav";

// Excel-style arrow-key nav column order (↑/↓ = same column across rows,
// ←/→ = adjacent cell in the same row when the cursor is at the value edge).
// Enter continues to move forward via the existing per-cell handlers.
const CELL_FIELDS = ["account", "paymentMode", "amount", "narration"] as const;

interface PaymentRow {
  id: number;
  debitLedgerId: string;      // Party being paid (customer / supplier / expense)
  paymentModeId: string;      // Which bank / cash this row uses (per-row!)
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
  paymentModeId: "",
  amount: "",
  narration: "",
});

// Busy-style ACTIVE-CELL highlight — the currently focused input turns
// black with white text, so the operator always knows which cell is
// receiving keystrokes. Applied via a class shared across all editable
// cells. `focus-within` covers the LedgerSearchInput case where the
// visible <input> is wrapped in a div.
const ACTIVE_CELL = "focus:bg-slate-900 focus:text-white focus:font-semibold";

const PaymentVoucherAddPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [mainNarration, setMainNarration] = useState("");
  const [nextVoucherNo, setNextVoucherNo] = useState<string>("");

  // F2 = save + auto-focus Date on mount. Centralised in the hook so
  // future first-field tweaks live in ONE place instead of per-page copies.
  useFormShortcuts({ autoFocusField: "date" });

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

  // Busy-style keyboard navigation. Every editable cell is tagged with
  // data-cell="rowIdx-field".
  const tableRef = useRef<HTMLDivElement>(null);

  const focusCell = (rowIdx: number, field: "account" | "paymentMode" | "amount" | "narration") => {
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
      if (rowIdx === rows.length - 1) {
        addRow();
        setTimeout(() => focusCell(rowIdx + 1, "account"), 0);
      } else {
        focusCell(rowIdx + 1, "account");
      }
    }
  };

  const updateRow = (id: number, field: keyof PaymentRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, [field]: value };
        // If the operator clears the Account (first cell), reset the whole
        // row — leaving orphan amount / narration / payment-mode after a
        // deleted account was misleading ("0 valid entries" with 2,63,708
        // still visible in the total). Row now returns to a truly empty state.
        if (field === "debitLedgerId" && !value) {
          next.paymentModeId = "";
          next.amount = "";
          next.narration = "";
        }
        return next;
      })
    );
  };

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
  const validCount = rows.filter(
    (r) => r.debitLedgerId && r.paymentModeId && parseFloat(r.amount) > 0
  ).length;

  // Row N is editable only if all rows 0..N-1 have account + payment mode + amount.
  const isRowComplete = (r: PaymentRow) =>
    !!r.debitLedgerId && !!r.paymentModeId && parseFloat(r.amount) > 0;
  const isRowUnlocked = (idx: number): boolean => {
    for (let i = 0; i < idx; i++) {
      if (!isRowComplete(rows[i])) return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validRows = rows.filter(
      (r) => r.debitLedgerId && r.paymentModeId && parseFloat(r.amount) > 0
    );
    if (validRows.length === 0) {
      toast.error("Add at least one payment entry with account + payment mode + amount");
      return;
    }

    for (const r of validRows) {
      if (r.debitLedgerId === r.paymentModeId) {
        toast.error("'Paid To' and 'Payment Mode' cannot be the same account in a row");
        return;
      }
    }

    setSubmitting(true);
    try {
      const created = await voucherService.createVoucher({
        type: "PAYMENT",
        date,
        narration: mainNarration || "Payment Voucher",
        items: validRows.map((r) => ({
          debitLedgerId: parseInt(r.debitLedgerId, 10),
          creditLedgerId: parseInt(r.paymentModeId, 10),
          debitAmount: parseFloat(r.amount),
          creditAmount: parseFloat(r.amount),
          narration: r.narration || mainNarration || "Payment",
        })),
      });
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
      <div className="w-full lg:w-6xl max-w-full">
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-line rounded-md overflow-hidden shadow-sm"
        >
          {/* Title bar — Busy-style red header */}
          <div className="text-white text-[13px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
            Add Payment Voucher
          </div>

          {/* Top meta section */}
          <div className="px-3 py-2 border-b border-line grid grid-cols-12 gap-x-3 gap-y-1.5 text-[13px] items-center">
            <label className="col-span-2 text-ink-subtle font-semibold">Date</label>
            <div className="col-span-4">
              <DatePickerCalendar name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <label className="col-span-2 text-ink-subtle font-semibold">Vch No.</label>
            <div className="col-span-4 text-ink font-mono font-bold text-[13px]">
              {nextVoucherNo ? displayVoucherNo(nextVoucherNo) : "…"}
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
                className={`w-full px-2 py-1 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none ${ACTIVE_CELL}`}
              />
            </div>
            <div className="col-span-6" />
          </div>

          {/* Spreadsheet-style items grid */}
          <div className="border-b border-line" ref={tableRef}>
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="bg-card-2 text-ink font-bold border-b border-line">
                  <th className="w-10 px-2 py-1 text-center border-r border-line">S.No</th>
                  <th className="px-2 py-1 text-left border-r border-line">Account (Paid To)</th>
                  <th className="w-48 px-2 py-1 text-left border-r border-line">Payment Mode (Bank / Cash)</th>
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
                    <td className={`w-10 px-2 py-0 text-center border-r border-line font-mono text-[13px] ${unlocked ? "text-ink-subtle bg-card-2/40" : "text-ink-subtle/40 bg-card-2/20"}`}>
                      {idx + 1}
                    </td>
                    <td className="px-0 py-0 border-r border-line">
                      {/* LedgerSearchInput wraps its own <input>; the wrapper
                         div catches bubbled key events for arrow-nav. The
                         search dropdown's own arrow handling still runs first
                         and preventDefaults arrow keys when the dropdown is
                         open, so this only fires when the dropdown is closed. */}
                      <div
                        data-cell={`${idx}-account`}
                        onKeyDown={(e) =>
                          handleGridArrow(e, {
                            rowIdx: idx,
                            field: "account",
                            fields: CELL_FIELDS,
                            rowsLength: rows.length,
                            focusCell,
                          })
                        }
                      >
                        <LedgerSearchInput
                          value={row.debitLedgerId}
                          ledgers={ledgers}
                          onChange={(val) => updateRow(row.id, "debitLedgerId", val)}
                          placeholder=""
                          filterFn={(l) => !isBankOrCashLedger(l)}
                          accentColor="red-500"
                          variant="cell"
                          onSelected={() => focusCell(idx, "paymentMode")}
                          disabled={!unlocked}
                        />
                      </div>
                    </td>
                    <td className="w-48 px-0 py-0 border-r border-line">
                      <div
                        data-cell={`${idx}-paymentMode`}
                        onKeyDown={(e) =>
                          handleGridArrow(e, {
                            rowIdx: idx,
                            field: "paymentMode",
                            fields: CELL_FIELDS,
                            rowsLength: rows.length,
                            focusCell,
                          })
                        }
                      >
                        <LedgerSearchInput
                          value={row.paymentModeId}
                          ledgers={ledgers}
                          onChange={(val) => updateRow(row.id, "paymentModeId", val)}
                          placeholder=""
                          filterFn={isBankOrCashLedger}
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
                        onKeyDown={(e) => {
                          handleGridArrow(e, {
                            rowIdx: idx,
                            field: "amount",
                            fields: CELL_FIELDS,
                            rowsLength: rows.length,
                            focusCell,
                          });
                          if (!e.defaultPrevented) handleAmountKeyDown(e, idx);
                        }}
                        // Select existing value on focus so typing replaces
                        // it (Busy behaviour). Native spinner arrows hidden.
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={formatAmountOnBlur((val) => updateRow(row.id, "amount", val))}
                        disabled={!unlocked}
                        className={`w-full px-2 py-1 bg-transparent border-0 text-[13px] text-ink text-right font-mono focus:outline-none appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 ${ACTIVE_CELL} ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
                      />
                    </td>
                    <td className="px-0 py-0">
                      <input
                        data-cell={`${idx}-narration`}
                        type="text"
                        placeholder=""
                        value={row.narration}
                        onChange={(e) => updateRow(row.id, "narration", e.target.value)}
                        onKeyDown={(e) => {
                          handleGridArrow(e, {
                            rowIdx: idx,
                            field: "narration",
                            fields: CELL_FIELDS,
                            rowsLength: rows.length,
                            focusCell,
                          });
                          if (!e.defaultPrevented) handleNarrationKeyDown(e, idx);
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        disabled={!unlocked}
                        className={`w-full px-2 py-1 bg-transparent border-0 text-[13px] text-ink focus:outline-none ${ACTIVE_CELL} ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
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
                      className="flex items-center gap-1 text-[13px] font-semibold text-red-500 hover:text-red-600 cursor-pointer"
                    >
                      <FaPlus className="w-2 h-2" /> Add Row
                    </button>
                  </td>
                  <td className="w-32 px-2 py-1 text-right font-mono font-bold text-ink border-l border-line">
                    {formatAmount(totalAmount)}
                  </td>
                  <td className="px-2 py-1 text-[13px] text-ink-subtle italic">
                    {validCount} valid entries
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bottom action bar */}
          <div className="px-3 py-2 flex items-center justify-between bg-card-2/40">
            <div className="flex items-center gap-2 text-[13px] text-ink-subtle">
              <FaMoneyBillWave className="text-red-500" />
              <span>
                <kbd className="px-1 border border-line rounded bg-card text-[13px]">Enter</kbd> /
                {" "}<kbd className="px-1 border border-line rounded bg-card text-[13px]">Tab</kbd> to move forward •
                {" "}<kbd className="px-1 border border-line rounded bg-card text-[13px]">↑↓</kbd> in dropdown
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-1 text-ink bg-card-2 hover:bg-card border border-line rounded font-semibold text-[13px] transition cursor-pointer"
              >
                Quit
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-[13px] transition disabled:opacity-50 cursor-pointer"
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
