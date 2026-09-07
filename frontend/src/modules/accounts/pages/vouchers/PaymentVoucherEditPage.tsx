import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaMoneyBillWave, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, displayVoucherNo, type Voucher } from "../../../../services/voucherService";
import { accountService, type AccountLedger } from "../../../../services/accountService";
import LedgerSearchInput, { isBankOrCashLedger } from "../../../../components/form/LedgerSearchInput/LedgerSearchInput";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useListCache, upsertInListCacheByPrefix } from "../../../../hooks/useListCache";
import { useDetailCache, updateDetailCache, getDetailFromCache } from "../../../../hooks/useDetailCache";

// Same shape as the Add page — one row per party being paid, with a
// per-row Payment Mode (bank/cash) column.
interface PaymentRow {
  id: number;
  debitLedgerId: string;
  paymentModeId: string;
  amount: string;
  narration: string;
}

let rowCounter = 1;
const INITIAL_ROW_COUNT = 17;

const makeEmptyRow = (): PaymentRow => ({
  id: rowCounter++,
  debitLedgerId: "",
  paymentModeId: "",
  amount: "",
  narration: "",
});

const ACTIVE_CELL = "focus:bg-slate-900 focus:text-white focus:font-semibold";

const PaymentVoucherEditPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams<{ id: string }>();
  const id = routeId ? parseInt(routeId, 10) : NaN;

  // Zero-loading strategy (three layers, fastest → slowest):
  //   1. Router-state preload from list-page navigate() — instant
  //   2. useDetailCache hit (memory → sessionStorage) — instant on second visit
  //      or when opened from Day Book / another entrypoint after any prior fetch
  //   3. Network fetch via useDetailCache's SWR — only when both above miss
  const preloaded = (location.state as { voucher?: Voucher } | null)?.voucher || null;
  const cacheKey = `voucher-${id}`;

  // Seed the detail cache with router-state preloaded data so other
  // components on the page and future revisits benefit immediately.
  useEffect(() => {
    if (preloaded && id && !isNaN(id)) updateDetailCache<Voucher>(cacheKey, preloaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloaded, cacheKey]);

  const voucherFetcher = useCallback(
    async (_signal: AbortSignal): Promise<Voucher> => {
      const v = await voucherService.fetchVoucherById(id);
      if (!v) throw new Error("Voucher not found");
      return v;
    },
    [id]
  );

  const { data: cachedVoucher, loading: detailLoading } = useDetailCache<Voucher>({
    cacheKey,
    socketModule: "voucher",
    socketMatchId: id,
    fetcher: voucherFetcher,
    enabled: !!id && !isNaN(id),
  });

  const effective = preloaded || cachedVoucher || getDetailFromCache<Voucher>(cacheKey);

  const hydrateFromVoucher = (v: Voucher): PaymentRow[] => {
    const populated: PaymentRow[] = (v.items || []).map((it) => ({
      id: rowCounter++,
      debitLedgerId: it.debitLedgerId != null ? String(it.debitLedgerId) : "",
      paymentModeId: it.creditLedgerId != null ? String(it.creditLedgerId) : "",
      amount: String(Number(it.debitAmount || it.creditAmount || 0)),
      narration: it.narration || "",
    }));
    while (populated.length < INITIAL_ROW_COUNT) populated.push(makeEmptyRow());
    return populated;
  };

  const [submitting, setSubmitting] = useState(false);
  const [voucher, setVoucher] = useState<Voucher | null>(effective);
  const [date, setDate] = useState(() => (effective?.date || "").split("T")[0]);
  const [mainNarration, setMainNarration] = useState(effective?.narration || "");
  const [rows, setRows] = useState<PaymentRow[]>(() =>
    effective ? hydrateFromVoucher(effective) : []
  );

  // Sync local editable state when cache lands or refreshes with a new
  // voucher (different id) — but don't clobber user edits mid-session.
  const lastAppliedIdRef = useRef<number | null>(effective?.id ?? null);
  useEffect(() => {
    if (!cachedVoucher) return;
    if (lastAppliedIdRef.current === cachedVoucher.id && voucher) return;
    setVoucher(cachedVoucher);
    setDate((cachedVoucher.date || "").split("T")[0]);
    setMainNarration(cachedVoucher.narration || "");
    setRows(hydrateFromVoucher(cachedVoucher));
    lastAppliedIdRef.current = cachedVoucher.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedVoucher]);

  // Guard: invalid id → back to list.
  useEffect(() => {
    if (!id || isNaN(id)) {
      toast.error("Invalid voucher id");
      navigate("/accounts/payment-voucher");
    }
  }, [id, navigate]);

  // Loading flag — true ONLY when nothing available (no preload, no cache,
  // and useDetailCache is fetching for the first time).
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

  const tableRef = useRef<HTMLDivElement>(null);

  const focusCell = (rowIdx: number, field: "account" | "paymentMode" | "amount" | "narration") => {
    if (!tableRef.current) return;
    const wrap = tableRef.current.querySelector<HTMLElement>(`[data-cell="${rowIdx}-${field}"]`);
    if (!wrap) return;
    const el = wrap.tagName === "INPUT" ? (wrap as HTMLInputElement) : wrap.querySelector("input");
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
        if (field === "debitLedgerId" && !value) {
          next.paymentModeId = "";
          next.amount = "";
          next.narration = "";
        }
        return next;
      })
    );
  };

  const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const validCount = rows.filter(
    (r) => r.debitLedgerId && r.paymentModeId && parseFloat(r.amount) > 0
  ).length;

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
      const updated = await voucherService.updateVoucher(id, {
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
      // Cache sync — reflect the edit in both list cache and detail cache
      // so any subsequent open (list, Day Book, direct URL) is instant and
      // shows the latest values.
      if (updated?.id) {
        upsertInListCacheByPrefix<Voucher>(
          "accounts:payment-vouchers:",
          (v) => v.id === updated.id,
          updated
        );
        updateDetailCache<Voucher>(`voucher-${updated.id}`, updated);
      }
      toast.success("Payment voucher updated");
      navigate("/accounts/payment-voucher");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-xs text-ink-subtle">Loading voucher…</div>;
  }

  return (
    <div className="p-3">
      <div className="w-full lg:w-6xl max-w-full">
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-line rounded-md overflow-hidden shadow-sm"
        >
          <div className="text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line bg-red-600/90">
            Modify Payment Voucher
          </div>

          <div className="px-3 py-2 border-b border-line grid grid-cols-12 gap-x-3 gap-y-1.5 text-[11px] items-center">
            <label className="col-span-2 text-ink-subtle font-semibold">Date</label>
            <div className="col-span-4">
              <DatePickerCalendar name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <label className="col-span-2 text-ink-subtle font-semibold">Vch No.</label>
            <div className="col-span-4 text-ink font-mono font-bold text-[12px]">
              {voucher ? displayVoucherNo(voucher.voucherNo) : "…"}
            </div>

            <label className="col-span-2 text-ink-subtle font-semibold">Narration</label>
            <div className="col-span-4">
              <input
                type="text"
                value={mainNarration}
                onChange={(e) => setMainNarration(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusCell(0, "account");
                  }
                }}
                className={`w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none ${ACTIVE_CELL}`}
              />
            </div>
            <div className="col-span-6" />
          </div>

          <div className="border-b border-line" ref={tableRef}>
            <table className="w-full text-[11px] border-collapse">
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
                            onSelected={() => focusCell(idx, "paymentMode")}
                            disabled={!unlocked}
                          />
                        </div>
                      </td>
                      <td className="w-48 px-0 py-0 border-r border-line">
                        <div data-cell={`${idx}-paymentMode`}>
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
                          value={row.amount}
                          onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                          onKeyDown={(e) => handleAmountKeyDown(e, idx)}
                          // Select existing value on focus so typing replaces it
                          // (matches Busy — click any pre-filled amount and the
                          // first digit you type overwrites the old value).
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={!unlocked}
                          className={`w-full px-2 py-1 bg-transparent border-0 text-[11px] text-ink text-right font-mono focus:outline-none appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 ${ACTIVE_CELL} ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
                        />
                      </td>
                      <td className="px-0 py-0">
                        <input
                          data-cell={`${idx}-narration`}
                          type="text"
                          value={row.narration}
                          onChange={(e) => updateRow(row.id, "narration", e.target.value)}
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

          <div className="px-3 py-2 flex items-center justify-between bg-card-2/40">
            <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
              <FaMoneyBillWave className="text-red-500" />
              <span>Modify existing voucher — items will be fully replaced on save</span>
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

export default PaymentVoucherEditPage;
