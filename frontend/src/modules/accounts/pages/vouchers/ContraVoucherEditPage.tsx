import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaExchangeAlt, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, displayVoucherNo, type Voucher } from "../../../../services/voucherService";
import { accountService, type AccountLedger } from "../../../../services/accountService";
import LedgerSearchInput, { isBankOrCashLedger } from "../../../../components/form/LedgerSearchInput/LedgerSearchInput";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useListCache, upsertInListCacheByPrefix } from "../../../../hooks/useListCache";
import { useDetailCache, updateDetailCache, getDetailFromCache } from "../../../../hooks/useDetailCache";
import { formatAmount, formatAmountOnBlur } from "../../../../utils/pricingUtils";

interface ContraRow {
  id: number;
  dc: "D" | "C";
  ledgerId: string;
  amount: string;
  narration: string;
}

let rowCounter = 1;
const INITIAL_ROW_COUNT = 17;

const makeEmptyRow = (idx: number): ContraRow => ({
  id: rowCounter++,
  dc: idx === 0 ? "D" : "C",
  ledgerId: "",
  amount: "",
  narration: "",
});

const ACTIVE_CELL = "focus:bg-slate-900 focus:text-white focus:font-semibold";

const ContraVoucherEditPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams<{ id: string }>();
  const id = routeId ? parseInt(routeId, 10) : NaN;

  const preloaded = (location.state as { voucher?: Voucher } | null)?.voucher || null;
  const cacheKey = `voucher-${id}`;

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

  const hydrateFromVoucher = (v: Voucher): ContraRow[] => {
    const populated: ContraRow[] = (v.items || []).map((it) => {
      const isDebit = it.debitLedgerId != null && Number(it.debitAmount || 0) > 0;
      return {
        id: rowCounter++,
        dc: isDebit ? "D" : "C",
        ledgerId: String(isDebit ? it.debitLedgerId : it.creditLedgerId),
        amount: String(Number(isDebit ? it.debitAmount : it.creditAmount) || 0),
        narration: it.narration || "",
      };
    });
    while (populated.length < INITIAL_ROW_COUNT) populated.push(makeEmptyRow(populated.length));
    return populated;
  };

  const [submitting, setSubmitting] = useState(false);
  const [voucher, setVoucher] = useState<Voucher | null>(effective);
  const [date, setDate] = useState(() => (effective?.date || "").split("T")[0]);
  const [mainNarration, setMainNarration] = useState(effective?.narration || "");
  const [rows, setRows] = useState<ContraRow[]>(() =>
    effective ? hydrateFromVoucher(effective) : []
  );

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

  useEffect(() => {
    if (!id || isNaN(id)) {
      toast.error("Invalid voucher id");
      navigate("/accounts/contra-entry");
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

  const updateRow = (id: number, field: keyof ContraRow, value: string) => {
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

  const isRowComplete = (r: ContraRow) => !!r.ledgerId && parseFloat(r.amount) > 0;
  const isRowUnlocked = (idx: number): boolean => {
    for (let i = 0; i < idx; i++) {
      if (!isRowComplete(rows[i])) return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validRows = rows.filter((r) => r.ledgerId && parseFloat(r.amount) > 0);
    if (validRows.length < 2) {
      toast.error("Need at least 2 entries (one debit, one credit)");
      return;
    }
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
        narration: r.narration || mainNarration || "Contra Entry",
      };
    });

    setSubmitting(true);
    try {
      const updated = await voucherService.updateVoucher(id, {
        date,
        narration: mainNarration || "Contra Entry",
        items,
      });
      if (updated?.id) {
        upsertInListCacheByPrefix<Voucher>(
          "accounts:contra-vouchers:",
          (v) => v.id === updated.id,
          updated
        );
        updateDetailCache<Voucher>(`voucher-${updated.id}`, updated);
      }
      toast.success("Contra voucher updated");
      navigate("/accounts/contra-entry");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-xs text-ink-subtle">Loading voucher...</div>;
  }

  return (
    <div className="p-3">
      <div className="w-full lg:w-7xl max-w-full">
        <form onSubmit={handleSubmit} className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
          <div className="bg-rose-600/90 text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
            Modify Contra Voucher
          </div>

          <div className="px-3 py-2 border-b border-line grid grid-cols-12 gap-x-2 gap-y-1.5 text-[11px] items-center">
            <label className="col-span-1 text-ink-subtle font-semibold text-right">Date</label>
            <div className="col-span-4">
              <DatePickerCalendar name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <label className="col-span-1 text-ink-subtle font-semibold text-right">Vch No.</label>
            <div className="col-span-6 text-ink font-mono font-bold text-[12px]">
              {voucher ? displayVoucherNo(voucher.voucherNo) : "..."}
            </div>

            <label className="col-span-1 text-ink-subtle font-semibold text-right">Narration</label>
            <div className="col-span-11">
              <input
                type="text"
                value={mainNarration}
                onChange={(e) => setMainNarration(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    focusCell(0, "dc");
                  }
                }}
                className={`w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-rose-500/40 focus:border-rose-500 focus:outline-none ${ACTIVE_CELL}`}
              />
            </div>
          </div>

          <div className="border-b border-line" ref={tableRef}>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-card-2 text-ink font-bold border-b border-line">
                  <th className="w-10 px-2 py-1 text-center border-r border-line">S.No</th>
                  <th className="w-20 px-2 py-1 text-center border-r border-line">
                    D / C
                    <div className="text-[9px] font-normal text-ink-subtle normal-case tracking-normal">
                      D=Out(↓) · C=In(↑)
                    </div>
                  </th>
                  <th className="px-2 py-1 text-left border-r border-line">Account (Cash / Bank)</th>
                  <th className="w-28 px-2 py-1 text-right border-r border-line text-red-400">Debit (Rs.)</th>
                  <th className="w-28 px-2 py-1 text-right border-r border-line text-emerald-500">Credit (Rs.)</th>
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
                      <td className={`w-10 px-2 py-0 text-center border-r border-line font-mono text-[11px] ${unlocked ? "text-ink-subtle bg-card-2/40" : "text-ink-subtle/40 bg-card-2/20"}`}>
                        {idx + 1}
                      </td>
                      <td className="w-20 px-0 py-0 border-r border-line text-center">
                        <select
                          data-cell={`${idx}-dc`}
                          value={row.dc}
                          onChange={(e) => updateRow(row.id, "dc", e.target.value)}
                          disabled={!unlocked}
                          className={`w-full px-1 py-1 bg-transparent border-0 text-[11px] font-bold font-mono text-center focus:outline-none ${
                            row.dc === "D" ? "text-red-400" : "text-emerald-500"
                          } ${ACTIVE_CELL} ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
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
                            filterFn={isBankOrCashLedger}
                            accentColor="rose-500"
                            variant="cell"
                            onSelected={() => focusCell(idx, "amount")}
                            disabled={!unlocked}
                          />
                        </div>
                      </td>
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
                            onFocus={(e) => e.currentTarget.select()}
                            disabled={!unlocked}
                            className={`w-full px-2 py-1 bg-transparent border-0 text-[11px] text-red-400 text-right font-mono focus:outline-none appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 ${ACTIVE_CELL} ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
                          />
                        ) : (
                          <div className="w-full px-2 py-1 text-right text-ink-subtle/30 font-mono">-</div>
                        )}
                      </td>
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
                            onFocus={(e) => e.currentTarget.select()}
                            disabled={!unlocked}
                            className={`w-full px-2 py-1 bg-transparent border-0 text-[11px] text-emerald-500 text-right font-mono focus:outline-none appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 ${ACTIVE_CELL} ${!unlocked ? "opacity-40 cursor-not-allowed" : ""}`}
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
                      className="flex items-center gap-1 text-[10px] font-semibold text-rose-500 hover:text-rose-600 cursor-pointer"
                    >
                      <FaPlus className="w-2 h-2" /> Add Row
                    </button>
                  </td>
                  <td className="w-28 px-2 py-1 text-right font-mono font-bold text-red-400 border-l border-line">
                    {formatAmount(totalDebit)}
                  </td>
                  <td className="w-28 px-2 py-1 text-right font-mono font-bold text-emerald-500 border-l border-line">
                    {formatAmount(totalCredit)}
                  </td>
                  <td className="px-2 py-1 text-[10px] italic">
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

          <div className="px-3 py-2 flex items-center justify-between bg-card-2/40">
            <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
              <FaExchangeAlt className="text-rose-500" />
              <span>Modify existing voucher — items will be fully replaced on save</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate("/accounts/contra-entry")}
                className="px-4 py-1 text-ink bg-card-2 hover:bg-card border border-line rounded font-semibold text-[11px] transition cursor-pointer"
              >
                Quit
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold text-[11px] transition disabled:opacity-50 cursor-pointer"
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

export default ContraVoucherEditPage;
