import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaMoneyBillWave, FaPlus, FaSync, FaFilter } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, displayVoucherNo, type Voucher } from "../../../../services/voucherService";
import { useListCache } from "../../../../hooks/useListCache";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { formatAmount } from "../../../../utils/pricingUtils";

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
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

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

  // Busy-style auto-select the first row so Enter immediately opens the
  // Modify page even without a click. Keeps the selection valid on refresh.
  useEffect(() => {
    if (panelOpen) return;
    if (vouchers.length === 0) {
      setSelectedRow(null);
      return;
    }
    if (selectedRow == null || !vouchers.some((v) => v.id === selectedRow)) {
      setSelectedRow(vouchers[0].id);
    }
  }, [vouchers, panelOpen, selectedRow]);

  // Keep the highlighted row visible — minimum scroll, no smooth animation.
  useEffect(() => {
    if (selectedRow == null) return;
    const el = document.querySelector<HTMLElement>(`[data-pay-row="${selectedRow}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedRow]);

  // Keyboard navigation on the list:
  //   ↑ / ↓         move selection between vouchers
  //   Home / End    jump to first / last voucher
  //   PgUp / PgDn   jump 10 rows
  //   Enter         open Modify page (with router-state preload)
  useEffect(() => {
    if (panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (vouchers.length === 0) return;
      const idx = selectedRow != null ? vouchers.findIndex((v) => v.id === selectedRow) : -1;

      if (e.key === "Enter" && selectedRow != null) {
        e.preventDefault();
        const v = vouchers.find((x) => x.id === selectedRow);
        navigate(`/accounts/payment-voucher/edit/${selectedRow}`, { state: { voucher: v } });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = vouchers[Math.min(idx + 1, vouchers.length - 1)];
        if (next) setSelectedRow(next.id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = vouchers[Math.max(idx - 1, 0)];
        if (prev) setSelectedRow(prev.id);
      } else if (e.key === "Home") {
        e.preventDefault();
        setSelectedRow(vouchers[0].id);
      } else if (e.key === "End") {
        e.preventDefault();
        setSelectedRow(vouchers[vouchers.length - 1].id);
      } else if (e.key === "PageDown") {
        e.preventDefault();
        const start = idx < 0 ? 0 : idx;
        setSelectedRow(vouchers[Math.min(start + 10, vouchers.length - 1)].id);
      } else if (e.key === "PageUp") {
        e.preventDefault();
        const start = idx < 0 ? 0 : idx;
        setSelectedRow(vouchers[Math.max(start - 10, 0)].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, selectedRow, vouchers, navigate]);

  // Sum of all voucher totals — memoised to avoid re-summing on unrelated
  // renders. MUST live above the early return below so hook order is stable
  // between the "filter panel" and "list" branches.
  const grandTotal = useMemo(
    () =>
      vouchers.reduce(
        (s, v) => s + v.items.reduce((si, i) => si + Number(i.debitAmount || 0), 0),
        0
      ),
    [vouchers]
  );

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

  // ────── Payment Register (list) — Busy spreadsheet style ──────
  // Column count for footer colSpan (Date + Vch + Mode? + Account = 3 or 4)
  const preAmountCols = 2 + (applied.showPaidFrom ? 1 : 0) + 1;

  return (
    <div className="p-3 space-y-2 w-full max-w-7xl">
      {/* Header bar */}
      <div className="bg-card rounded-md border border-line px-3 py-1.5 flex flex-wrap items-center gap-2 shadow-sm">
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
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line cursor-pointer"
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

      {/* Spreadsheet-style table — Busy layout: fixed header/footer, only body
         scrolls, empty filler rows fill the visible area when data is sparse. */}
      <div
        className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
        style={{ height: "calc(100vh - 240px)" }}
      >
        {vouchers.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-subtle">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <FaSync className="animate-spin text-red-500 text-[10px]" />
                Loading payment vouchers…
              </span>
            ) : (
              "No payment vouchers found in this date range."
            )}
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-[11px] text-ink-muted border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-card-2 text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                  <th className="px-2 py-1.5 border-r border-line w-28">Date</th>
                  <th className="px-2 py-1.5 border-r border-line w-24 text-center">Vch/Bill No</th>
                  {applied.showPaidFrom && (
                    <th className="px-2 py-1.5 border-r border-line w-48">Mode</th>
                  )}
                  <th className="px-2 py-1.5 border-r border-line">Account</th>
                  {applied.showAmount && (
                    <th className="px-2 py-1.5 border-r border-line w-32 text-right">Amount (₹)</th>
                  )}
                  {applied.showNarration && <th className="px-2 py-1.5">Narration</th>}
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v, rowIdx) => {
                  const voucherTotal = v.items.reduce(
                    (s, i) => s + Number(i.debitAmount || 0),
                    0
                  );
                  const debitLabel = v.items
                    .map((i) =>
                      applied.accountShownBy === "Code"
                        ? i.debitLedger?.code
                        : i.debitLedger?.name
                    )
                    .filter(Boolean)
                    .join(", ");
                  const creditLabel =
                    applied.accountShownBy === "Code"
                      ? v.items[0]?.creditLedger?.code
                      : v.items[0]?.creditLedger?.name;
                  const isSelected = selectedRow === v.id;
                  return (
                    <tr
                      key={v.id}
                      data-pay-row={v.id}
                      onClick={() => setSelectedRow(v.id)}
                      onDoubleClick={() =>
                        navigate(`/accounts/payment-voucher/edit/${v.id}`, {
                          state: { voucher: v },
                        })
                      }
                      title="Double-click (or Enter with row selected) to modify"
                      className={`border-b border-line-soft cursor-pointer ${
                        isSelected
                          ? "bg-red-600/25 text-ink ring-1 ring-red-500/40"
                          : rowIdx % 2 === 0
                            ? "hover:bg-card-2/70"
                            : "bg-card-2/20 hover:bg-card-2/70"
                      }`}
                    >
                      <td className="px-2 py-1 border-r border-line-soft font-mono text-[11px]">
                        {new Date(v.date).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft font-mono font-semibold text-red-500 text-center">
                        {displayVoucherNo(v.voucherNo)}
                      </td>
                      {applied.showPaidFrom && (
                        <td className="px-2 py-1 border-r border-line-soft text-ink-muted uppercase">
                          {creditLabel || "-"}
                        </td>
                      )}
                      <td className="px-2 py-1 border-r border-line-soft font-semibold text-ink uppercase">
                        {debitLabel || "-"}
                      </td>
                      {applied.showAmount && (
                        <td className="px-2 py-1 border-r border-line-soft text-right font-mono font-semibold text-ink">
                          {formatAmount(voucherTotal)}
                        </td>
                      )}
                      {applied.showNarration && (
                        <td className="px-2 py-1 text-ink-subtle max-w-xs truncate">
                          {/* "Short Narration" = per-item narration (Busy
                              convention). Join across items so a multi-row
                              payment shows all short narrations, not the
                              voucher-level main narration. Falls back to
                              main narration only when items have none. */}
                          {(() => {
                            const shorts = (v.items || [])
                              .map((i) => (i.narration || "").trim())
                              .filter(Boolean);
                            if (shorts.length > 0) return shorts.join(", ");
                            return v.narration || "-";
                          })()}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {/* Busy-style empty filler rows so the grid always looks full.
                   Number chosen to comfortably fill a typical viewport; if real
                   data exceeds this, the tbody just scrolls further. */}
                {Array.from({ length: Math.max(0, 25 - vouchers.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-line-soft">
                    <td className="px-2 py-1 border-r border-line-soft">&nbsp;</td>
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    {applied.showPaidFrom && (
                      <td className="px-2 py-1 border-r border-line-soft"></td>
                    )}
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    {applied.showAmount && (
                      <td className="px-2 py-1 border-r border-line-soft"></td>
                    )}
                    {applied.showNarration && <td className="px-2 py-1"></td>}
                  </tr>
                ))}
              </tbody>
              {applied.showAmount && (
                <tfoot className="sticky bottom-0 z-10 bg-card-2 border-t-2 border-line">
                  <tr>
                    <td
                      colSpan={preAmountCols}
                      className="px-2 py-1.5 text-right text-[10px] font-bold text-ink uppercase tracking-wide border-r border-line"
                    >
                      Page Total ({vouchers.length})
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-sm text-ink font-mono border-r border-line">
                      {formatAmount(grandTotal)}
                    </td>
                    {applied.showNarration && <td></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Busy-style status bar */}
        <div className="border-t border-line bg-card-2/60 px-3 py-1 flex items-center justify-between text-[10px] font-mono text-ink-subtle">
          <div className="flex gap-4">
            <span>
              Entry No: <b className="text-ink">{vouchers.length > 0 ? 1 : 0} / {vouchers.length}</b>
            </span>
            <span>
              Row No: <b className="text-ink">
                {selectedRow ? vouchers.findIndex((v) => v.id === selectedRow) + 1 : (vouchers.length > 0 ? 1 : 0)}
                {" / "}{vouchers.length}
              </b>
            </span>
          </div>
          <div className="flex gap-3 uppercase tracking-wide">
            <span>Total: <b className="text-ink">{total}</b></span>
          </div>
        </div>
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
