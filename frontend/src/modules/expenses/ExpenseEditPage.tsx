import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaCoins } from "react-icons/fa";
import { toast } from "react-toastify";
import { expenseService, displayExpenseNo, type Expense } from "../../services/expenseService";
import { accountService, type AccountLedger } from "../../services/accountService";
import LedgerSearchInput, { isBankOrCashLedger } from "../../components/form/LedgerSearchInput/LedgerSearchInput";
import DatePickerCalendar from "../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useListCache, upsertInListCacheByPrefix } from "../../hooks/useListCache";
import { useDetailCache, updateDetailCache, getDetailFromCache } from "../../hooks/useDetailCache";
import { useFormShortcuts } from "../../hooks/useFormShortcuts";

const ACTIVE_CELL = "focus:bg-slate-900 focus:text-white focus:font-semibold";

const ExpenseEditPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // F2 = save + auto-focus Date on mount (centralised via useFormShortcuts).
  useFormShortcuts({ autoFocusField: "date" });

  // Zero-loading: router state → detail cache → SWR fetch.
  const preloaded = (location.state as { expense?: Expense } | null)?.expense || null;
  const cacheKey = `expense-${id}`;

  useEffect(() => {
    if (preloaded && id) updateDetailCache<Expense>(cacheKey, preloaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloaded, cacheKey]);

  const expenseFetcher = useCallback(
    async (_signal: AbortSignal): Promise<Expense> => {
      if (!id) throw new Error("Missing id");
      const e = await expenseService.fetchById(id);
      if (!e) throw new Error("Expense not found");
      return e;
    },
    [id]
  );

  const { data: cachedExpense, loading: detailLoading } = useDetailCache<Expense>({
    cacheKey,
    socketModule: "expense",
    socketMatchId: id,
    fetcher: expenseFetcher,
    enabled: !!id,
  });

  const effective = preloaded || cachedExpense || getDetailFromCache<Expense>(cacheKey);

  const [submitting, setSubmitting] = useState(false);
  const [expense, setExpense] = useState<Expense | null>(effective);
  const [date, setDate] = useState<string>(() =>
    effective?.date ? String(effective.date).split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [expenseLedgerId, setExpenseLedgerId] = useState<string>(
    effective?.debitLedgerId != null ? String(effective.debitLedgerId) : ""
  );
  const [sourceLedgerId, setSourceLedgerId] = useState<string>(
    effective?.creditLedgerId != null ? String(effective.creditLedgerId) : ""
  );
  const [amount, setAmount] = useState<string>(effective ? String(effective.amount) : "");
  const [description, setDescription] = useState<string>(effective?.description || "");

  const lastAppliedIdRef = useRef<string | null>(effective?.id ?? null);
  useEffect(() => {
    if (!cachedExpense) return;
    if (lastAppliedIdRef.current === cachedExpense.id && expense) return;
    setExpense(cachedExpense);
    setDate(cachedExpense.date ? String(cachedExpense.date).split("T")[0] : new Date().toISOString().split("T")[0]);
    setExpenseLedgerId(cachedExpense.debitLedgerId != null ? String(cachedExpense.debitLedgerId) : "");
    setSourceLedgerId(cachedExpense.creditLedgerId != null ? String(cachedExpense.creditLedgerId) : "");
    setAmount(String(cachedExpense.amount));
    setDescription(cachedExpense.description || "");
    lastAppliedIdRef.current = cachedExpense.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedExpense]);

  useEffect(() => {
    if (!id) {
      toast.error("Invalid expense id");
      navigate("/expenses");
    }
  }, [id, navigate]);

  const loading = !effective && detailLoading;

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

  const expenseFilter = useCallback((l: AccountLedger) => l.type === "EXPENSE", []);
  const sourceFilter = useCallback((l: AccountLedger) => isBankOrCashLedger(l), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!expenseLedgerId || !sourceLedgerId || !(parseFloat(amount) > 0)) {
      toast.error("Expense Account, Source Account and Amount are required");
      return;
    }
    if (expenseLedgerId === sourceLedgerId) {
      toast.error("Expense and Source must be different accounts");
      return;
    }
    const expenseLedger = ledgers.find((l) => String(l.id) === expenseLedgerId);
    const sourceLedger = ledgers.find((l) => String(l.id) === sourceLedgerId);

    setSubmitting(true);
    try {
      const updated = await expenseService.update(id, {
        date,
        amount: parseFloat(amount),
        description: description || undefined,
        expense: description || expenseLedger?.name || "Expense",
        expenseCategory: expenseLedger?.group || "General",
        paymentMethod: sourceLedger?.name || "Cash",
        debitLedgerId: parseInt(expenseLedgerId, 10),
        creditLedgerId: parseInt(sourceLedgerId, 10),
      });
      if (updated?.id) {
        upsertInListCacheByPrefix<Expense>("expenses:", (e) => e.id === updated.id, updated);
        updateDetailCache<Expense>(`expense-${updated.id}`, updated);
      }
      toast.success("Expense updated");
      navigate(-1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-xs text-ink-subtle">Loading expense...</div>;
  }

  return (
    <div className="p-3">
      <div className="w-full lg:w-4xl max-w-full">
        <form onSubmit={handleSubmit} className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
          <div className="text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line bg-amber-500/90">
            Modify Expense
          </div>

          <div className="px-3 py-2 border-b border-line grid grid-cols-12 gap-x-3 gap-y-1.5 text-[11px] items-center">
            <label className="col-span-2 text-ink-subtle font-semibold">Date</label>
            <div className="col-span-4">
              <DatePickerCalendar name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <label className="col-span-2 text-ink-subtle font-semibold">Vch No.</label>
            <div className="col-span-4 text-ink font-mono font-bold text-[12px]">
              {expense ? displayExpenseNo(expense.expenseNumber) : "..."}
            </div>
          </div>

          <div className="px-3 py-1 border-b border-line bg-amber-500/10 text-[10px] text-ink-muted italic">
            Golden Rule → <b className="text-ink not-italic">Dr</b> Expense Account · <b className="text-ink not-italic">Cr</b> Source Account
          </div>

          <div className="px-3 py-3 grid grid-cols-12 gap-x-3 gap-y-2 text-[11px] items-center">
            <label className="col-span-3 text-ink-subtle font-semibold">Expense Account (Debit)</label>
            <div className="col-span-9">
              <LedgerSearchInput
                value={expenseLedgerId}
                ledgers={ledgers}
                onChange={setExpenseLedgerId}
                placeholder="Type expense name..."
                filterFn={expenseFilter}
                accentColor="amber-500"
                required
              />
            </div>

            <label className="col-span-3 text-ink-subtle font-semibold">Paid From (Credit)</label>
            <div className="col-span-9">
              <LedgerSearchInput
                value={sourceLedgerId}
                ledgers={ledgers}
                onChange={setSourceLedgerId}
                placeholder="Petty Cash / Bank / Cash..."
                filterFn={sourceFilter}
                accentColor="amber-500"
                required
              />
            </div>

            <label className="col-span-3 text-ink-subtle font-semibold">Amount (₹)</label>
            <div className="col-span-9">
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                required
                className={`w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink text-right font-mono focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none ${ACTIVE_CELL}`}
              />
            </div>

            <label className="col-span-3 text-ink-subtle font-semibold">Description</label>
            <div className="col-span-9">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                className={`w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none ${ACTIVE_CELL}`}
              />
            </div>
          </div>

          <div className="px-3 py-2 flex items-center justify-between bg-card-2/40 border-t border-line">
            <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
              <FaCoins className="text-amber-500" />
              <span>Modify existing expense — auto-posted voucher will be re-posted on save</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
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

export default ExpenseEditPage;
