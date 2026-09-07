import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaCoins, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { expenseService, type Expense } from "../../services/expenseService";
import { accountService, type AccountLedger } from "../../services/accountService";
import LedgerSearchInput, { isBankOrCashLedger } from "../../components/form/LedgerSearchInput/LedgerSearchInput";
import DatePickerCalendar from "../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useFormShortcuts } from "../../hooks/useFormShortcuts";
import { useListCache, prependToListCacheByPrefix } from "../../hooks/useListCache";

// One editable row = one Expense to be saved. Save iterates and POSTs each
// row so a single "session" can capture multiple expenses in one flow.
interface ExpenseRow {
  id: number;
  expenseLedgerId: string;   // Debit — nominal expense account (Fuel, Tea, …)
  sourceLedgerId: string;    // Credit — real bank/cash source (PettyCash / Bank / Cash)
  amount: string;
  description: string;
}

let rowCounter = 1;
const INITIAL_ROW_COUNT = 12;

const makeEmptyRow = (): ExpenseRow => ({
  id: rowCounter++,
  expenseLedgerId: "",
  sourceLedgerId: "",
  amount: "",
  description: "",
});

// Busy-style active-cell highlight — currently focused cell inverts to
// slate-900/white bold so the operator always knows where keystrokes land.
const ACTIVE_CELL = "focus:bg-slate-900 focus:text-white focus:font-semibold";

const ExpenseAddPage: React.FC = () => {
  const navigate = useNavigate();

  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<ExpenseRow[]>(() =>
    Array.from({ length: INITIAL_ROW_COUNT }, makeEmptyRow)
  );
  const [nextExpenseNo, setNextExpenseNo] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useFormShortcuts({});

  // Show operator the next auto-generated Expense No so they know what will
  // save (Busy convention — Vch No visible before Save).
  useEffect(() => {
    expenseService.fetchNextExpenseNo().then(setNextExpenseNo).catch(() => setNextExpenseNo(""));
  }, []);

  // Shared ledger cache (same key as Payment/Receipt forms so they warm each other).
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

  // Row picker filters:
  //   • Expense Account column → only EXPENSE ledgers (Nominal)
  //   • Source Account column  → only Bank / Cash ledgers (Real)
  //                              — includes Petty Cash Account (group "Cash in Hand")
  const expenseFilter = useCallback((l: AccountLedger) => l.type === "EXPENSE", []);
  const sourceFilter = useCallback((l: AccountLedger) => isBankOrCashLedger(l), []);

  const tableRef = useRef<HTMLDivElement>(null);
  const focusCell = (rowIdx: number, field: "expense" | "source" | "amount" | "narration") => {
    if (!tableRef.current) return;
    const wrap = tableRef.current.querySelector<HTMLElement>(`[data-cell="${rowIdx}-${field}"]`);
    if (!wrap) return;
    const el = wrap.tagName === "INPUT" ? (wrap as HTMLInputElement) : wrap.querySelector("input");
    if (el) {
      el.focus();
      if ((el as HTMLInputElement).select) (el as HTMLInputElement).select();
    }
  };

  const addRow = () => setRows((prev) => [...prev, makeEmptyRow()]);
  const updateRow = (id: number, field: keyof ExpenseRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, [field]: value };
        // Cascade-clear later fields when the operator wipes the expense pick.
        if (field === "expenseLedgerId" && !value) {
          next.sourceLedgerId = "";
          next.amount = "";
          next.description = "";
        }
        return next;
      })
    );
  };

  const isRowComplete = (r: ExpenseRow) =>
    !!r.expenseLedgerId && !!r.sourceLedgerId && parseFloat(r.amount) > 0;
  const isRowUnlocked = (idx: number) => rows.slice(0, idx).every(isRowComplete);

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
        setTimeout(() => focusCell(rowIdx + 1, "expense"), 0);
      } else {
        focusCell(rowIdx + 1, "expense");
      }
    }
  };

  const totalAmount = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const validCount = rows.filter(isRowComplete).length;

  const resetForm = () => {
    setRows(Array.from({ length: INITIAL_ROW_COUNT }, makeEmptyRow));
    expenseService.fetchNextExpenseNo().then(setNextExpenseNo).catch(() => setNextExpenseNo(""));
    setTimeout(() => focusCell(0, "expense"), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter(isRowComplete);
    if (validRows.length === 0) {
      toast.error("Add at least one row with Expense Account + Source + Amount");
      return;
    }
    for (const r of validRows) {
      if (r.expenseLedgerId === r.sourceLedgerId) {
        toast.error("Expense Account and Source Account cannot be the same in a row");
        return;
      }
    }

    setSubmitting(true);
    let ok = 0;
    let failed = 0;
    for (const r of validRows) {
      try {
        // Let backend auto-generate expenseNumber atomically per row. Previous
        // "fetch-then-post" pattern raced when multiple rows saved in the
        // same batch — both fetched the same "next" and one collided.
        const expenseLedger = ledgers.find((l) => String(l.id) === r.expenseLedgerId);
        const sourceLedger = ledgers.find((l) => String(l.id) === r.sourceLedgerId);
        const created = await expenseService.create({
          date,
          expense: r.description || expenseLedger?.name || "Expense",
          expenseCategory: expenseLedger?.group || "General",
          amount: parseFloat(r.amount),
          description: r.description || undefined,
          paymentMethod: sourceLedger?.name || "Cash",
          status: "Approved",
          debitLedgerId: parseInt(r.expenseLedgerId, 10),
          creditLedgerId: parseInt(r.sourceLedgerId, 10),
        });
        if (created?.id) {
          prependToListCacheByPrefix<Expense>("expenses:", created);
        }
        ok++;
      } catch (err: any) {
        console.error("[ExpenseAdd] row failed:", err);
        failed++;
      }
    }
    setSubmitting(false);

    if (ok > 0 && failed === 0) {
      toast.success(`Saved ${ok} expense ${ok === 1 ? "entry" : "entries"}`);
      resetForm();
    } else if (ok > 0 && failed > 0) {
      toast.warning(`Saved ${ok}, ${failed} failed`);
    } else {
      toast.error("All entries failed to save");
    }
  };

  return (
    <div className="p-3">
      <div className="w-full lg:w-7xl max-w-full">
        <form onSubmit={handleSubmit} className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
          <div className="text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line bg-amber-500/90">
            Add Expense
          </div>

          {/* Header meta: Date + auto Vch No */}
          <div className="px-3 py-2 border-b border-line grid grid-cols-12 gap-x-3 gap-y-1.5 text-[11px] items-center">
            <label className="col-span-2 text-ink-subtle font-semibold">Date</label>
            <div className="col-span-4">
              <DatePickerCalendar name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <label className="col-span-2 text-ink-subtle font-semibold">Next Vch No.</label>
            <div className="col-span-4 text-ink font-mono font-bold text-[12px]">
              {nextExpenseNo || "…"} <span className="text-ink-subtle text-[10px] italic ml-1">(auto per row)</span>
            </div>
          </div>

          {/* Golden Rule hint bar */}
          <div className="px-3 py-1 border-b border-line bg-amber-500/10 text-[10px] text-ink-muted italic">
            Golden Rule → <b className="text-ink not-italic">Dr</b> Expense Account (Nominal) · <b className="text-ink not-italic">Cr</b> Source Account (Bank / Cash / Petty Cash)
          </div>

          {/* Spreadsheet rows */}
          <div className="border-b border-line" ref={tableRef}>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-card-2 text-ink font-bold border-b border-line">
                  <th className="w-10 px-2 py-1 text-center border-r border-line">S.No</th>
                  <th className="px-2 py-1 text-left border-r border-line">Expense Account (Debit)</th>
                  <th className="w-48 px-2 py-1 text-left border-r border-line">Paid From (Credit)</th>
                  <th className="w-32 px-2 py-1 text-right border-r border-line">Amount (Rs.)</th>
                  <th className="px-2 py-1 text-left">Description</th>
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
                        <div data-cell={`${idx}-expense`}>
                          <LedgerSearchInput
                            value={row.expenseLedgerId}
                            ledgers={ledgers}
                            onChange={(val) => updateRow(row.id, "expenseLedgerId", val)}
                            placeholder=""
                            filterFn={expenseFilter}
                            accentColor="amber-500"
                            variant="cell"
                            onSelected={() => focusCell(idx, "source")}
                            disabled={!unlocked}
                          />
                        </div>
                      </td>
                      <td className="w-48 px-0 py-0 border-r border-line">
                        <div data-cell={`${idx}-source`}>
                          <LedgerSearchInput
                            value={row.sourceLedgerId}
                            ledgers={ledgers}
                            onChange={(val) => updateRow(row.id, "sourceLedgerId", val)}
                            placeholder=""
                            filterFn={sourceFilter}
                            accentColor="amber-500"
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
                          value={row.amount}
                          onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                          onKeyDown={(e) => handleAmountKeyDown(e, idx)}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={!unlocked}
                          className={`w-full px-2 py-1 bg-transparent border-0 text-[11px] text-ink text-right font-mono focus:outline-none appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 ${ACTIVE_CELL} ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
                        />
                      </td>
                      <td className="px-0 py-0">
                        <input
                          data-cell={`${idx}-narration`}
                          type="text"
                          value={row.description}
                          onChange={(e) => updateRow(row.id, "description", e.target.value)}
                          onKeyDown={(e) => handleNarrationKeyDown(e, idx)}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={!unlocked}
                          className={`w-full px-2 py-1 bg-transparent border-0 text-[11px] text-ink focus:outline-none ${ACTIVE_CELL} ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
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
                      className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 hover:text-amber-600 cursor-pointer"
                    >
                      <FaPlus className="w-2 h-2" /> Add Row
                    </button>
                  </td>
                  <td className="w-32 px-2 py-1 text-right font-mono font-bold text-ink border-l border-line">
                    {totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1 text-[10px] text-ink-subtle italic">
                    {validCount} valid {validCount === 1 ? "entry" : "entries"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bottom action bar */}
          <div className="px-3 py-2 flex items-center justify-between bg-card-2/40">
            <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
              <FaCoins className="text-amber-500" />
              <span>Each row saves as a separate expense with its own auto-posted voucher (Dr Expense · Cr Source).</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate("/expenses")}
                className="px-4 py-1 text-ink bg-card-2 hover:bg-card border border-line rounded font-semibold text-[11px] transition cursor-pointer"
              >
                Quit
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-semibold text-[11px] transition disabled:opacity-50 cursor-pointer"
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

export default ExpenseAddPage;
