import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { expenseService, type Expense } from "../../services/expenseService";
import DatePickerCalendar from "../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useListCache } from "../../hooks/useListCache";

// Busy-style "Select Expense To Modify" picker. Operator enters Vch No
// and/or Date → OK finds the expense and navigates to the Modify page.
const ExpenseModifyPickerPage: React.FC = () => {
  const navigate = useNavigate();
  const todayIso = new Date().toISOString().split("T")[0];

  const [voucherSeries] = useState("Main");
  const [expenseNo, setExpenseNo] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayIso);
  const [submitting, setSubmitting] = useState(false);

  const fetcher = useCallback(async () => {
    const res = await expenseService.fetchAll({ page: 1, limit: 10000 });
    return { data: res.data || [], total: res.total || 0 };
  }, []);

  const { data: cachedExpenses } = useListCache<Expense>({
    cacheKey: `expenses:modify-picker`,
    socketModule: "expense",
    fetcher,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const noRaw = expenseNo.trim();
    const dateStr = expenseDate.trim();

    if (!noRaw && !dateStr) {
      toast.error("Enter Expense Number OR Expense Date");
      return;
    }

    setSubmitting(true);
    try {
      if (noRaw) {
        // Normalise "3" or "E-3" → "EXP-003" so operators can type the short form.
        let normalized = noRaw.toUpperCase();
        if (/^\d+$/.test(noRaw)) {
          normalized = `EXP-${noRaw.padStart(3, "0")}`;
        } else if (/^E-\d+$/.test(normalized)) {
          const n = normalized.replace(/^E-/, "");
          normalized = `EXP-${n.padStart(3, "0")}`;
        }

        const cacheHit = cachedExpenses.find((x) => x.expenseNumber === normalized);
        if (cacheHit) {
          navigate(`/expenses/edit/${cacheHit.id}`, { state: { expense: cacheHit } });
          return;
        }

        const res = await expenseService.fetchAll({ search: normalized, page: 1, limit: 10 });
        const found = (res.data || []).find((x) => x.expenseNumber === normalized);
        if (!found) {
          toast.error(`Expense "${noRaw}" not found`);
          return;
        }
        navigate(`/expenses/edit/${found.id}`, { state: { expense: found } });
        return;
      }

      // No Vch No → open the most recent expense on-or-before the picked date.
      const sortByDateDescIdDesc = (a: Expense, b: Expense) => {
        const dc = (String(b.date) || "").localeCompare(String(a.date) || "");
        return dc !== 0 ? dc : String(b.id).localeCompare(String(a.id));
      };
      const onOrBefore = (v: Expense) => String(v.date || "").slice(0, 10) <= dateStr;

      const sameDay = cachedExpenses.filter((v) => String(v.date || "").startsWith(dateStr));
      let candidate = sameDay.slice().sort(sortByDateDescIdDesc)[0];

      if (!candidate) {
        candidate = cachedExpenses.filter(onOrBefore).sort(sortByDateDescIdDesc)[0];
      }

      if (!candidate) {
        const res = await expenseService.fetchAll({ endDate: dateStr, page: 1, limit: 100 });
        candidate = (res.data || []).filter(onOrBefore).sort(sortByDateDescIdDesc)[0];
      }

      if (!candidate) {
        toast.error(`No expenses found on or before ${dateStr}`);
        return;
      }
      navigate(`/expenses/edit/${candidate.id}`, { state: { expense: candidate } });
    } catch (err: any) {
      toast.error(err?.message || "Failed to locate expense");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        (document.getElementById("modify-picker-form") as HTMLFormElement | null)?.requestSubmit();
      } else if (e.key === "Escape") {
        navigate("/expenses");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="p-3">
      <div className="w-full lg:w-[420px]">
        <div className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
          <div className="bg-amber-500/90 text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
            Select Expense To Modify
          </div>
          <form id="modify-picker-form" onSubmit={handleSubmit} className="p-4 space-y-2.5 text-[11px]">
            <div className="grid grid-cols-12 gap-3 items-center">
              <label className="col-span-5 text-ink-subtle font-semibold">Voucher Series</label>
              <div className="col-span-7 text-ink font-semibold">{voucherSeries}</div>
            </div>

            <div className="grid grid-cols-12 gap-3 items-center">
              <label className="col-span-5 text-ink-subtle font-semibold">Expense No.</label>
              <div className="col-span-7">
                <input
                  autoFocus
                  type="text"
                  value={expenseNo}
                  onChange={(e) => setExpenseNo(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="e.g. 3"
                  className="w-full px-2 py-1 border border-line bg-slate-900 text-white rounded text-[11px] font-mono font-semibold focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3 items-center">
              <label className="col-span-5 text-ink-subtle font-semibold">Expense Date</label>
              <div className="col-span-7">
                <DatePickerCalendar
                  name="expenseDate"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-semibold text-[11px] transition cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Locating..." : "OK (F2)"}
              </button>
            </div>
            <div className="text-center text-[10px] text-ink-subtle italic pt-1">
              <kbd className="px-1 border border-line rounded bg-card text-[10px]">Esc</kbd> to quit ·
              {" "}<kbd className="px-1 border border-line rounded bg-card text-[10px]">F2</kbd> to submit
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExpenseModifyPickerPage;
