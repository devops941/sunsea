import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaBookOpen, FaPlus, FaSync, FaFilter } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, displayVoucherNo, type Voucher } from "../../../../services/voucherService";
import { useListCache } from "../../../../hooks/useListCache";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";

// Busy-style filter — Journal defaults: Voucher Series = <<-ALL->>, all
// display toggles = N (matches Busy's "List of Journal Vouchers" screen).
interface FilterOptions {
  voucherSeries: string;
  startDate: string;
  endDate: string;
  accountShownBy: "Name" | "Alias" | "Code";
  showNarration: boolean;
}

const todayIso = () => new Date().toISOString().split("T")[0];

const defaultFilters = (): FilterOptions => ({
  voucherSeries: "<<-ALL->>",
  startDate: todayIso(),
  endDate: todayIso(),
  accountShownBy: "Name",
  showNarration: false,
});

const JournalEntryPage: React.FC = () => {
  const navigate = useNavigate();

  const [applied, setApplied] = useState<FilterOptions>(() => defaultFilters());
  const [pending, setPending] = useState<FilterOptions>(() => defaultFilters());
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

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

  const cacheKey = `accounts:journal-vouchers:${applied.startDate}:${applied.endDate}`;

  const fetcher = useCallback(
    async (_signal: AbortSignal) => {
      try {
        const res = await voucherService.fetchVouchers({
          type: "JOURNAL",
          startDate: applied.startDate || undefined,
          endDate: applied.endDate || undefined,
          page: 1,
          limit: 10000,
        });
        return { data: res.vouchers || [], total: res.total || res.vouchers?.length || 0 };
      } catch (err: any) {
        toast.error(err?.message || "Failed to load journal entries");
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

  // Journal list shows ONE ROW PER JOURNAL ITEM (Busy convention), not one
  // row per voucher. So flatten items with a reference back to the voucher
  // and mark first item so Date + Vch No only render once per voucher.
  const flatRows = useMemo(() => {
    const out: Array<{
      voucher: Voucher;
      item: Voucher["items"][number];
      itemIdx: number;
      isFirst: boolean;
    }> = [];
    for (const v of vouchers) {
      v.items.forEach((it, idx) => {
        out.push({ voucher: v, item: it, itemIdx: idx, isFirst: idx === 0 });
      });
    }
    return out;
  }, [vouchers]);

  const { totalDebit, totalCredit } = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const v of vouchers) {
      for (const it of v.items) {
        d += Number(it.debitAmount || 0);
        c += Number(it.creditAmount || 0);
      }
    }
    return { totalDebit: d, totalCredit: c };
  }, [vouchers]);

  // ────── Busy-style pre-list filter dialog ──────
  if (panelOpen) {
    return (
      <div className="p-3">
        <div className="w-full lg:w-[420px]">
          <div className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
            <div className="bg-purple-600/90 text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
              List of Journal Vouchers
            </div>
            <div className="p-4 space-y-2.5 text-[11px]">
              <FilterRow label="Voucher Series">
                <select
                  value={pending.voucherSeries}
                  onChange={(e) => setPending({ ...pending, voucherSeries: e.target.value })}
                  className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500 focus:outline-none"
                >
                  <option value="<<-ALL->>">{"<<-ALL->>"}</option>
                  <option value="Main">Main</option>
                </select>
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
                  onChange={(e) =>
                    setPending({ ...pending, accountShownBy: e.target.value as "Name" | "Alias" | "Code" })
                  }
                  className="w-full px-2 py-1 border border-line bg-card rounded text-[11px] text-ink focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500 focus:outline-none"
                >
                  <option value="Name">Name</option>
                  <option value="Alias">Alias</option>
                  <option value="Code">Code</option>
                </select>
              </FilterRow>

              <ToggleRow
                label="Show Short Narration?"
                value={pending.showNarration}
                onChange={(v) => setPending({ ...pending, showNarration: v })}
              />

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setApplied(pending);
                    setPanelOpen(false);
                  }}
                  className="px-6 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-[11px] transition cursor-pointer"
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

  // ────── Journal Register (list) — Busy spreadsheet, one row per item ──────
  return (
    <div className="p-3 space-y-2 w-full max-w-7xl">
      {/* Header bar */}
      <div className="bg-card rounded-md border border-line px-3 py-1.5 flex flex-wrap items-center gap-2 shadow-sm">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaBookOpen className="text-purple-500 text-sm" /> List of Journal Vouchers
          {refreshing && <FaSync className="animate-spin text-purple-500 text-[10px]" />}
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
            <FaSync className={refreshing ? "animate-spin text-purple-500" : ""} /> Refresh
          </button>
          <button
            onClick={() => navigate("/accounts/journal-entry/add")}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            <FaPlus className="text-[10px]" /> New Journal
          </button>
        </div>
      </div>

      {/* Spreadsheet-style table */}
      <div
        className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
        style={{ height: "calc(100vh - 240px)" }}
      >
        {flatRows.length === 0 && !loading ? (
          <div className="p-8 text-center text-xs text-ink-subtle">
            No journal vouchers found in this date range.
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-[11px] text-ink-muted border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-card-2 text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                  <th className="px-2 py-1.5 border-r border-line w-28">Date</th>
                  <th className="px-2 py-1.5 border-r border-line w-24 text-center">Vch/Bill No</th>
                  <th className="px-2 py-1.5 border-r border-line">Account</th>
                  <th className="px-2 py-1.5 border-r border-line w-32 text-right">Debit</th>
                  <th className="px-2 py-1.5 border-r border-line w-32 text-right">Credit</th>
                  {applied.showNarration && <th className="px-2 py-1.5">Narration</th>}
                </tr>
              </thead>
              <tbody>
                {flatRows.map(({ voucher, item, itemIdx, isFirst }, rowIdx) => {
                  const ledger = item.debitLedger || item.creditLedger;
                  const accountLabel =
                    applied.accountShownBy === "Code"
                      ? ledger?.code
                      : ledger?.name;
                  const dr = Number(item.debitAmount || 0);
                  const cr = Number(item.creditAmount || 0);
                  const isSelected = selectedRow === voucher.id;
                  return (
                    <tr
                      key={`${voucher.id}-${itemIdx}`}
                      onClick={() => setSelectedRow(voucher.id)}
                      className={`border-b border-line-soft cursor-pointer ${
                        isSelected
                          ? "bg-purple-600/20 text-ink"
                          : rowIdx % 2 === 0
                            ? "hover:bg-card-2/70"
                            : "bg-card-2/20 hover:bg-card-2/70"
                      }`}
                    >
                      {/* Date + Vch No only appear on the first item of each voucher */}
                      <td className="px-2 py-1 border-r border-line-soft font-mono text-[11px]">
                        {isFirst ? new Date(voucher.date).toLocaleDateString("en-GB") : ""}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft font-mono font-semibold text-purple-500 text-center">
                        {isFirst ? displayVoucherNo(voucher.voucherNo) : ""}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft font-semibold text-ink uppercase">
                        {accountLabel || "-"}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft text-right font-mono font-semibold text-emerald-600">
                        {dr > 0
                          ? dr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : ""}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft text-right font-mono font-semibold text-red-500">
                        {cr > 0
                          ? cr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : ""}
                      </td>
                      {applied.showNarration && (
                        <td className="px-2 py-1 text-ink-subtle max-w-xs truncate">
                          {item.narration || "-"}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {/* Busy-style empty filler rows — 25 per user preference */}
                {Array.from({ length: Math.max(0, 25 - flatRows.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-line-soft">
                    <td className="px-2 py-1 border-r border-line-soft">&nbsp;</td>
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    {applied.showNarration && <td className="px-2 py-1"></td>}
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-card-2 border-t-2 border-line">
                <tr>
                  <td colSpan={3} className="px-2 py-1.5 text-right text-[10px] font-bold text-ink uppercase tracking-wide border-r border-line">
                    Page Total ({vouchers.length} vouchers · {flatRows.length} entries)
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-sm text-emerald-600 font-mono border-r border-line">
                    {totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-sm text-red-500 font-mono border-r border-line">
                    {totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {applied.showNarration && <td></td>}
                </tr>
              </tfoot>
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
                {selectedRow
                  ? flatRows.findIndex((r) => r.voucher.id === selectedRow) + 1
                  : (flatRows.length > 0 ? 1 : 0)}
                {" / "}{flatRows.length}
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
            ? "bg-purple-600 text-white border-purple-600"
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

export default JournalEntryPage;
