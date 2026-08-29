import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaMoneyBillWave, FaPlus, FaSync, FaFilter } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, displayVoucherNo, type Voucher } from "../../../../services/voucherService";
import { useListCache } from "../../../../hooks/useListCache";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";

// Busy-style filter options shown BEFORE the list opens. Kept as its own
// piece of state so the operator can re-open the panel with "Change Filters".
interface FilterOptions {
  voucherSeries: string;
  startDate: string;
  endDate: string;
  accountShownBy: "Name" | "Code";
  showNarration: boolean;
  showAmount: boolean;
  showPaidFrom: boolean;
}

const todayIso = () => new Date().toISOString().split("T")[0];

// Busy behaviour: List of Payment Vouchers opens with both Starting and
// Ending Date pre-filled to today. Operator hits F2 to see just today's
// entries; they widen the range only if they need history.
const defaultFilters = (): FilterOptions => ({
  voucherSeries: "Main",
  startDate: todayIso(),
  endDate: todayIso(),
  accountShownBy: "Name",
  showNarration: true,
  showAmount: true,
  showPaidFrom: true,
});

const PaymentVoucherPage: React.FC = () => {
  const navigate = useNavigate();

  // Applied filters drive the actual data fetch; pending filters live inside
  // the panel until OK is pressed.
  const [applied, setApplied] = useState<FilterOptions>(() => defaultFilters());
  const [pending, setPending] = useState<FilterOptions>(() => defaultFilters());
  const [panelOpen, setPanelOpen] = useState(true);

  // F2 = OK inside the filter panel (matches Busy shortcut).
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setApplied(pending);
        setPanelOpen(false);
      } else if (e.key === "Escape") {
        setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, pending]);

  const cacheKey = `accounts:payment-vouchers:${applied.startDate}:${applied.endDate}`;

  const fetcher = useCallback(
    async (_signal: AbortSignal) => {
      try {
        const res = await voucherService.fetchVouchers({
          type: "PAYMENT",
          startDate: applied.startDate || undefined,
          endDate: applied.endDate || undefined,
          page: 1,
          limit: 10000,
        });
        return { data: res.vouchers || [], total: res.total || res.vouchers?.length || 0 };
      } catch (err: any) {
        toast.error(err?.message || "Failed to load payment vouchers");
        throw err;
      }
    },
    [applied.startDate, applied.endDate]
  );

  const { data: vouchers, total, loading, refreshing, refresh } = useListCache<Voucher>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
  });

  // ────── Busy-style pre-list filter dialog ──────
  if (panelOpen) {
    return (
      <div className="p-3">
        <div className="w-full lg:w-[420px]">
          <div className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
            <div className="bg-red-600/90 text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
              List of Payment Vouchers
            </div>
            <div className="p-4 space-y-2.5 text-[11px]">
              <FilterRow label="Voucher Series">
                <input
                  type="text"
                  value={pending.voucherSeries}
                  onChange={(e) => setPending({ ...pending, voucherSeries: e.target.value })}
                  className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                />
              </FilterRow>

              <FilterRow label="Starting Date">
                <DatePickerCalendar
                  name="startDate"
                  value={pending.startDate}
                  onChange={(e) => setPending({ ...pending, startDate: e.target.value })}
                />
              </FilterRow>

              <FilterRow label="Ending Date">
                <DatePickerCalendar
                  name="endDate"
                  value={pending.endDate}
                  onChange={(e) => setPending({ ...pending, endDate: e.target.value })}
                />
              </FilterRow>

              <FilterRow label="Account shown by">
                <select
                  value={pending.accountShownBy}
                  onChange={(e) => setPending({ ...pending, accountShownBy: e.target.value as "Name" | "Code" })}
                  className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                >
                  <option value="Name">Name</option>
                  <option value="Code">Code</option>
                </select>
              </FilterRow>

              <ToggleRow
                label="Show Paid From?"
                value={pending.showPaidFrom}
                onChange={(v) => setPending({ ...pending, showPaidFrom: v })}
              />
              <ToggleRow
                label="Show Short Narration?"
                value={pending.showNarration}
                onChange={(v) => setPending({ ...pending, showNarration: v })}
              />
              <ToggleRow
                label="Show Amount?"
                value={pending.showAmount}
                onChange={(v) => setPending({ ...pending, showAmount: v })}
              />

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setApplied(pending);
                    setPanelOpen(false);
                  }}
                  className="px-6 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-[11px] transition cursor-pointer"
                >
                  OK (F2)
                </button>
              </div>
              <div className="text-center text-[10px] text-ink-subtle italic pt-1">
                <kbd className="px-1 border border-line rounded bg-card text-[10px]">Esc</kbd> to quit ·
                {" "}<kbd className="px-1 border border-line rounded bg-card text-[10px]">F2</kbd> to submit
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ────── Payment Register (list) ──────
  return (
    <div className="p-3 space-y-3 min-h-screen">
      {/* Header bar */}
      <div className="bg-card rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-2">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaMoneyBillWave className="text-red-500 text-sm" /> Payment Register
          {refreshing && <FaSync className="animate-spin text-red-500 text-[10px]" />}
        </h1>
        <span className="text-[10px] text-ink-subtle italic">
          Series: <b className="text-ink">{applied.voucherSeries}</b> · From{" "}
          <b className="text-ink">{applied.startDate}</b> to <b className="text-ink">{applied.endDate}</b>
        </span>

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => {
              setPending(applied);
              setPanelOpen(true);
            }}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line cursor-pointer"
            title="Change filters"
          >
            <FaFilter className="text-[10px]" /> Change Filters
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line"
          >
            <FaSync className={refreshing ? "animate-spin text-red-500" : ""} /> Refresh
          </button>
          <button
            onClick={() => navigate("/accounts/payment-voucher/add")}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            <FaPlus className="text-[10px]" /> New Payment
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-ink">Payment Vouchers</h2>
          <span className="text-[11px] text-ink-subtle font-mono">Total: {total}</span>
        </div>
        {vouchers.length === 0 ? (
          loading ? null : <div className="p-8 text-center text-xs text-ink-subtle">No payment vouchers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink-muted">
              <thead className="bg-head text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Vch/Bill No</th>
                  {applied.showPaidFrom && <th className="px-3 py-2">Mode</th>}
                  <th className="px-3 py-2">Account</th>
                  {applied.showAmount && <th className="px-3 py-2 text-right">Amount (₹)</th>}
                  {applied.showNarration && <th className="px-3 py-2">Narration</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {vouchers.map((v) => {
                  const voucherTotal = v.items.reduce((s, i) => s + Number(i.debitAmount || 0), 0);
                  const debitLabel = v.items
                    .map((i) =>
                      applied.accountShownBy === "Code" ? i.debitLedger?.code : i.debitLedger?.name
                    )
                    .filter(Boolean)
                    .join(", ");
                  const creditLabel =
                    applied.accountShownBy === "Code"
                      ? v.items[0]?.creditLedger?.code
                      : v.items[0]?.creditLedger?.name;
                  return (
                    <tr key={v.id} className="hover:bg-card-2 transition-colors">
                      <td className="px-3 py-1.5 font-mono text-[11px]">
                        {new Date(v.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-3 py-1.5 font-mono font-semibold text-red-500">{displayVoucherNo(v.voucherNo)}</td>
                      {applied.showPaidFrom && (
                        <td className="px-3 py-1.5 text-ink-muted">{creditLabel || "-"}</td>
                      )}
                      <td className="px-3 py-1.5 font-semibold text-ink">{debitLabel || "-"}</td>
                      {applied.showAmount && (
                        <td className="px-3 py-1.5 text-right font-mono font-semibold text-ink">
                          ₹{voucherTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      {applied.showNarration && (
                        <td className="px-3 py-1.5 text-ink-subtle max-w-xs truncate">{v.narration || "-"}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {vouchers.length > 0 && applied.showAmount && (
                <tfoot className="border-t-2 border-line bg-card-2">
                  <tr>
                    <td
                      colSpan={applied.showPaidFrom ? 4 : 3}
                      className="px-3 py-2 text-right text-[10px] font-bold text-ink uppercase tracking-wide"
                    >
                      Page Total ({vouchers.length})
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-sm text-ink font-mono">
                      ₹
                      {vouchers
                        .reduce((s, v) => s + v.items.reduce((si, i) => si + Number(i.debitAmount || 0), 0), 0)
                        .toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    {applied.showNarration && <td></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Small presentational helpers for the filter panel ──
const FilterRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-12 gap-3 items-center">
    <label className="col-span-5 text-ink-subtle font-semibold">{label}</label>
    <div className="col-span-7">{children}</div>
  </div>
);

const ToggleRow: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div className="grid grid-cols-12 gap-3 items-center">
    <label className="col-span-5 text-ink-subtle font-semibold">{label}</label>
    <div className="col-span-7 flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer ${
          value
            ? "bg-red-600 text-white border-red-600"
            : "bg-card text-ink-muted border-line hover:bg-card-2"
        }`}
      >
        Y
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer ${
          !value
            ? "bg-card-2 text-ink border-line"
            : "bg-card text-ink-muted border-line hover:bg-card-2"
        }`}
      >
        N
      </button>
    </div>
  </div>
);

export default PaymentVoucherPage;
