import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaReceipt, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, displayVoucherNo, type Voucher } from "../../../../services/voucherService";
import { accountService, type AccountLedger } from "../../../../services/accountService";
import LedgerSearchInput, { isBankOrCashLedger } from "../../../../components/form/LedgerSearchInput/LedgerSearchInput";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useListCache, upsertInListCacheByPrefix } from "../../../../hooks/useListCache";
import { useDetailCache, updateDetailCache, getDetailFromCache } from "../../../../hooks/useDetailCache";
import { formatAmount, formatAmountOnBlur } from "../../../../utils/pricingUtils";
import { useFormShortcuts } from "../../../../hooks/useFormShortcuts";
import { handleGridArrow } from "../../../../hooks/useFormGridNav";

// Excel-style arrow-key nav uses this field order for ← / → within a row.
const CELL_FIELDS = ["account", "receiptMode", "amount", "narration"] as const;

// Same shape as the Add page — one row per payer, with a per-row Receipt
// Mode (bank/cash) column.
interface ReceiptRow {
  id: number;
  creditLedgerId: string;   // Payer (customer)
  receiptModeId: string;    // Bank/cash where the money landed
  amount: string;
  narration: string;
}

let rowCounter = 1;
const INITIAL_ROW_COUNT = 17;

const makeEmptyRow = (): ReceiptRow => ({
  id: rowCounter++,
  creditLedgerId: "",
  receiptModeId: "",
  amount: "",
  narration: "",
});

const ACTIVE_CELL = "focus:bg-slate-900 focus:text-white focus:font-semibold";

const ReceiptVoucherEditPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams<{ id: string }>();
  const id = routeId ? parseInt(routeId, 10) : NaN;

  // F2 = save + auto-focus Date on mount (centralised via useFormShortcuts).
  useFormShortcuts({ autoFocusField: "date" });

  // Zero-loading strategy (three layers, fastest → slowest):
  //   1. Router-state preload from list-page navigate() — instant, no cache hit needed
  //   2. useDetailCache hit (memory → sessionStorage) — instant on second visit,
  //      also works when coming from Day Book or a direct URL after any prior fetch
  //   3. Network fetch via useDetailCache's SWR — only when both above miss
  const preloaded = (location.state as { voucher?: Voucher } | null)?.voucher || null;
  const cacheKey = `voucher-${id}`;

  // Seed the detail cache with router-state preloaded data so socket sync
  // and other components can read it immediately.
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

  // useDetailCache reads sync from cache first (memory/sessionStorage), then
  // background-refreshes via socket sync. `loading` is true ONLY when there's
  // no cached data AND no preloaded state — i.e. genuine first-time fetch.
  const { data: cachedVoucher, loading: detailLoading } = useDetailCache<Voucher>({
    cacheKey,
    socketModule: "voucher",
    socketMatchId: id,
    fetcher: voucherFetcher,
    enabled: !!id && !isNaN(id),
  });

  // The effective voucher — pick router-state first (freshest), else cache.
  const effective = preloaded || cachedVoucher || getDetailFromCache<Voucher>(cacheKey);

  const hydrateFromVoucher = (v: Voucher): ReceiptRow[] => {
    const populated: ReceiptRow[] = (v.items || []).map((it) => ({
      id: rowCounter++,
      // In Receipt: creditLedger = payer, debitLedger = bank/cash receiving.
      creditLedgerId: it.creditLedgerId != null ? String(it.creditLedgerId) : "",
      receiptModeId: it.debitLedgerId != null ? String(it.debitLedgerId) : "",
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
  const [rows, setRows] = useState<ReceiptRow[]>(() =>
    effective ? hydrateFromVoucher(effective) : []
  );

  // When cache lands (or refreshes), keep local editable state in sync only
  // if the user hasn't started editing. We track "user touched" implicitly
  // by comparing the currently-loaded voucher id to prevent overwrites.
  const lastAppliedIdRef = useRef<number | null>(effective?.id ?? null);
  useEffect(() => {
    if (!cachedVoucher) return;
    // Only apply if this is a different voucher OR we haven't hydrated yet
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
      navigate("/accounts/receipt-voucher");
    }
  }, [id, navigate]);

  // Loading flag — true ONLY when we have nothing to show at all (no preload,
  // no cache, and useDetailCache is still fetching for the first time).
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

  const focusCell = (rowIdx: number, field: "account" | "receiptMode" | "amount" | "narration") => {
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

  const updateRow = (id: number, field: keyof ReceiptRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, [field]: value };
        return next;
      })
    );
  };

  const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const validCount = rows.filter(
    (r) => r.creditLedgerId && r.receiptModeId && parseFloat(r.amount) > 0
  ).length;

  const isRowComplete = (r: ReceiptRow) =>
    !!r.creditLedgerId && !!r.receiptModeId && parseFloat(r.amount) > 0;
  const isRowUnlocked = (idx: number): boolean => {
    for (let i = 0; i < idx; i++) {
      if (!isRowComplete(rows[i])) return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validRows = rows.filter(
      (r) => r.creditLedgerId && r.receiptModeId && parseFloat(r.amount) > 0
    );
    if (validRows.length === 0) {
      toast.error("Add at least one receipt entry with account + receipt mode + amount");
      return;
    }
    for (const r of validRows) {
      if (r.creditLedgerId === r.receiptModeId) {
        toast.error("'Received From' and 'Receipt Mode' cannot be the same account in a row");
        return;
      }
    }

    setSubmitting(true);
    try {
      const updated = await voucherService.updateVoucher(id, {
        date,
        narration: mainNarration || "Receipt Voucher",
        items: validRows.map((r) => ({
          debitLedgerId: parseInt(r.receiptModeId, 10),
          creditLedgerId: parseInt(r.creditLedgerId, 10),
          debitAmount: parseFloat(r.amount),
          creditAmount: parseFloat(r.amount),
          narration: r.narration || mainNarration || "Receipt",
        })),
      });
      if (updated?.id) {
        // 1. Update the list cache so Receipt Register reflects the edit
        //    without a network refetch.
        upsertInListCacheByPrefix<Voucher>(
          "accounts:receipt-vouchers:",
          (v) => v.id === updated.id,
          updated
        );
        // 2. Update the detail cache too — the next visit to this Edit
        //    page (from anywhere: list, Day Book, direct URL) will be
        //    instant and show the latest values.
        updateDetailCache<Voucher>(`voucher-${updated.id}`, updated);
      }
      toast.success("Receipt voucher updated");
      navigate(-1);
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
          <div className="text-white text-[13px] font-bold uppercase tracking-wide text-center py-1 border-b border-line bg-emerald-600/90">
            Modify Receipt Voucher
          </div>

          <div className="px-3 py-2 border-b border-line grid grid-cols-12 gap-x-3 gap-y-1.5 text-[13px] items-center">
            <label className="col-span-2 text-ink-subtle font-semibold">Date</label>
            <div className="col-span-4">
              <DatePickerCalendar name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <label className="col-span-2 text-ink-subtle font-semibold">Vch No.</label>
            <div className="col-span-4 text-ink font-mono font-bold text-[13px]">
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
                className={`w-full px-2 py-1 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500 focus:outline-none ${ACTIVE_CELL}`}
              />
            </div>
            <div className="col-span-6" />
          </div>

          <div className="border-b border-line" ref={tableRef}>
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="bg-card-2 text-ink font-bold border-b border-line">
                  <th className="w-10 px-2 py-1 text-center border-r border-line">S.No</th>
                  <th className="px-2 py-1 text-left border-r border-line">Account (Received From)</th>
                  <th className="w-48 px-2 py-1 text-left border-r border-line">Receipt Mode (Bank / Cash)</th>
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
                        <div
                          data-cell={`${idx}-account`}
                          onKeyDown={(e) => handleGridArrow(e, { rowIdx: idx, field: "account", fields: CELL_FIELDS, rowsLength: rows.length, focusCell })}
                        >
                          <LedgerSearchInput
                            value={row.creditLedgerId}
                            ledgers={ledgers}
                            onChange={(val) => updateRow(row.id, "creditLedgerId", val)}
                            placeholder=""
                            filterFn={(l) => !isBankOrCashLedger(l)}
                            accentColor="emerald-500"
                            variant="cell"
                            onSelected={() => focusCell(idx, "receiptMode")}
                            disabled={!unlocked}
                          />
                        </div>
                      </td>
                      <td className="w-48 px-0 py-0 border-r border-line">
                        <div
                          data-cell={`${idx}-receiptMode`}
                          onKeyDown={(e) => handleGridArrow(e, { rowIdx: idx, field: "receiptMode", fields: CELL_FIELDS, rowsLength: rows.length, focusCell })}
                        >
                          <LedgerSearchInput
                            value={row.receiptModeId}
                            ledgers={ledgers}
                            onChange={(val) => updateRow(row.id, "receiptModeId", val)}
                            placeholder=""
                            filterFn={isBankOrCashLedger}
                            accentColor="emerald-500"
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
                          onBlur={formatAmountOnBlur((val) => updateRow(row.id, "amount", val))}
                          onKeyDown={(e) => {
                            handleGridArrow(e, { rowIdx: idx, field: "amount", fields: CELL_FIELDS, rowsLength: rows.length, focusCell });
                            if (!e.defaultPrevented) handleAmountKeyDown(e, idx);
                          }}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={!unlocked}
                          className={`w-full px-2 py-1 bg-transparent border-0 text-[13px] text-ink text-right font-mono focus:outline-none appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 ${ACTIVE_CELL} ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
                        />
                      </td>
                      <td className="px-0 py-0">
                        <input
                          data-cell={`${idx}-narration`}
                          type="text"
                          value={row.narration}
                          onChange={(e) => updateRow(row.id, "narration", e.target.value)}
                          onKeyDown={(e) => {
                            handleGridArrow(e, { rowIdx: idx, field: "narration", fields: CELL_FIELDS, rowsLength: rows.length, focusCell });
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
                      className="flex items-center gap-1 text-[13px] font-semibold text-emerald-500 hover:text-emerald-600 cursor-pointer"
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

          <div className="px-3 py-2 flex items-center justify-between bg-card-2/40">
            <div className="flex items-center gap-2 text-[13px] text-ink-subtle">
              <FaReceipt className="text-emerald-500" />
              <span>Modify existing voucher — items will be fully replaced on save</span>
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
                className="px-5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[13px] transition disabled:opacity-50 cursor-pointer"
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

export default ReceiptVoucherEditPage;
