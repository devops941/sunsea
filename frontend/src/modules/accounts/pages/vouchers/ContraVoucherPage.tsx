import { formatDate } from "../../../../utils/dateUtils";
import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaExchangeAlt, FaPlus, FaSync, FaFilter, FaTrash, FaCheckSquare, FaSquare } from "react-icons/fa";
import { toast } from "react-toastify";
import { voucherService, displayVoucherNo, type Voucher } from "../../../../services/voucherService";
import { useListCache, invalidateCache } from "../../../../hooks/useListCache";
import { usePageShortcuts } from "../../../../hooks/usePageShortcuts";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { formatAmount } from "../../../../utils/pricingUtils";

// Contra filter — same defaults as Journal per Busy's convention:
// Voucher Series = <<-ALL->>, all display toggles = N.
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

const ContraVoucherPage: React.FC = () => {
  const navigate = useNavigate();

  const [applied, setApplied] = useState<FilterOptions>(() => defaultFilters());
  const [pending, setPending] = useState<FilterOptions>(() => defaultFilters());
  // Modal-as-page persistence.
  const VIEW_KEY = "sunsea:contra-voucher:view";
  const [panelOpen, setPanelOpen] = useState<boolean>(() => {
    try { return sessionStorage.getItem(VIEW_KEY) !== "table"; } catch { return true; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(VIEW_KEY, panelOpen ? "panel" : "table"); } catch { /* ignore */ }
  }, [panelOpen]);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Modal nav stack — Esc walks: table → panel → navigate away.
  const panelOpenRef = useRef(panelOpen);
  const pendingRef = useRef(pending);
  useEffect(() => { panelOpenRef.current = panelOpen; }, [panelOpen]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2" && panelOpenRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setApplied(pendingRef.current);
        setPanelOpen(false);
        return;
      }
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      e.stopPropagation();
      if (!panelOpenRef.current) {
        setPending(applied);
        setPanelOpen(true);
      } else {
        navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applied, navigate]);

  const cacheKey = `accounts:contra-vouchers:${applied.startDate}:${applied.endDate}`;

  const fetcher = useCallback(
    async (_signal: AbortSignal) => {
      try {
        const res = await voucherService.fetchVouchers({
          type: "CONTRA",
          startDate: applied.startDate || undefined,
          endDate: applied.endDate || undefined,
          page: 1,
          limit: 10000,
        });
        return { data: res.vouchers || [], total: res.total || res.vouchers?.length || 0 };
      } catch (err: any) {
        toast.error(err?.message || "Failed to load contra entries");
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
// F5 = refresh (centralised via usePageShortcuts).  usePageShortcuts({ onRefresh: refresh });

  const openVoucherEdit = useCallback(
    (v: Voucher) => {
      navigate(`/accounts/contra-entry/edit/${v.id}`, { state: { voucher: v } });
    },
    [navigate]
  );

  // Busy-style auto-select the first voucher so Enter opens Modify without
  // any prior click. Preserves current selection if it still exists.
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

  // List keyboard shortcuts (only when the filter panel is closed).
  //   ↑ / ↓         move selection between vouchers
  //   Home / End    jump to first / last voucher
  //   Enter         open Modify page for the selected voucher
  useEffect(() => {
    if (panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (vouchers.length === 0) return;
      const idx = selectedRow != null ? vouchers.findIndex((v) => v.id === selectedRow) : -1;

      if (e.key === "Enter" && selectedRow != null) {
        const v = vouchers.find((x) => x.id === selectedRow);
        if (v) {
          e.preventDefault();
          openVoucherEdit(v);
        }
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
  }, [panelOpen, selectedRow, vouchers, openVoucherEdit]);

  // Keep the highlighted row in view — minimal scroll (no smooth animation).
  useEffect(() => {
    if (selectedRow == null) return;
    const el = document.querySelector<HTMLElement>(`[data-ctr-row="${selectedRow}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedRow]);

  const allVoucherIds = useMemo(() => vouchers.map((v) => v.id), [vouchers]);
  const allSelected = allVoucherIds.length > 0 && allVoucherIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleVoucher = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allVoucherIds));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.size} selected contra voucher(s)? This cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    let failed = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        await voucherService.deleteVoucher(id);
      } catch {
        failed++;
      }
    }
    setDeleting(false);
    setSelectedIds(new Set());
    invalidateCache(cacheKey);
    refresh();
    if (failed === 0) {
      toast.success(`Deleted ${selectedIds.size} voucher(s) successfully`);
    } else {
      toast.warning(`Deleted with ${failed} error(s)`);
    }
  };

  // Contra list — one row per journal item (matches Busy's flat register).
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
  // `data-escape-guarded` opts out of the global Esc→back shortcut.
  if (panelOpen) {
    return (
      <div data-escape-guarded className="p-3">
        <div className="w-full lg:w-[420px]">
          <div className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
            <div className="bg-rose-600/90 text-white text-[13px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
              List of Contra Vouchers
            </div>
            <div className="p-4 space-y-2.5 text-[13px]">
              <FilterRow label="Voucher Series">
                <select
                  value={pending.voucherSeries}
                  onChange={(e) => setPending({ ...pending, voucherSeries: e.target.value })}
                  className="w-full px-2 py-1 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-rose-500/40 focus:border-rose-500 focus:outline-none"
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
                  className="w-full px-2 py-1 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-rose-500/40 focus:border-rose-500 focus:outline-none"
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
                  className="px-6 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold text-[13px] transition cursor-pointer"
                >
                  OK (F2)
                </button>
              </div>
              <div className="text-center text-[13px] text-ink-subtle italic pt-1">
                <kbd className="px-1 border border-line rounded bg-card text-[13px]">Esc</kbd> to quit ·
                {" "}<kbd className="px-1 border border-line rounded bg-card text-[13px]">F2</kbd> to submit
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ────── Contra Register (list) — one row per item ──────
  return (
    <div data-escape-guarded className="p-3 space-y-2 w-full max-w-7xl">
      {/* Header bar */}
      <div className="bg-card rounded-md border border-line px-3 py-1.5 flex flex-wrap items-center gap-2 shadow-sm">
        <h1 className="text-[13px] font-bold text-ink flex items-center gap-2 mr-2">
          <FaExchangeAlt className="text-rose-500 text-[13px]" /> List of Contra Vouchers
          {refreshing && <FaSync className="animate-spin text-rose-500 text-[13px]" />}
        </h1>
        <span className="text-[13px] text-ink-subtle italic">
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
            <FaFilter className="text-[13px]" /> Change Filters
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line cursor-pointer"
          >
            <FaSync className={refreshing ? "animate-spin text-rose-500" : ""} /> Refresh
          </button>
          {someSelected && (
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold border border-red-700 disabled:opacity-50 cursor-pointer"
            >
              <FaTrash className="text-[13px]" />
              {deleting ? "Deleting..." : `Delete (${selectedIds.size})`}
            </button>
          )}
          <button
            onClick={() => navigate("/accounts/contra-entry/add")}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            <FaPlus className="text-[13px]" /> New Contra
          </button>
        </div>
      </div>

      {/* Spreadsheet-style table */}
      <div
        className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
        style={{ height: "calc(100vh - 240px)" }}
      >
        {flatRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-subtle">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <FaSync className="animate-spin text-teal-500 text-[13px]" />
                Loading contra vouchers…
              </span>
            ) : (
              "No contra vouchers found in this date range."
            )}
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-[13px] text-ink-muted border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-card-2 text-ink uppercase font-bold text-[13px] tracking-wide border-b border-line">
                  <th className="px-2 py-1.5 border-r border-line w-8 text-center">
                    <button type="button" onClick={toggleAll} className="text-ink-subtle hover:text-rose-500">
                      {allSelected ? <FaCheckSquare className="text-rose-500" /> : <FaSquare />}
                    </button>
                  </th>
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
                    applied.accountShownBy === "Code" ? ledger?.code : ledger?.name;
                  const dr = Number(item.debitAmount || 0);
                  const cr = Number(item.creditAmount || 0);
                  const isChecked = selectedIds.has(voucher.id);
                  return (
                    <tr
                      key={`${voucher.id}-${itemIdx}`}
                      data-ctr-row={voucher.id}
                      onClick={() => {
                        setSelectedRow(voucher.id);
                        toggleVoucher(voucher.id);
                      }}
                      onDoubleClick={() => openVoucherEdit(voucher)}
                      title="Double-click or press Enter to modify"
                      className={`border-b border-line-soft cursor-pointer ${
                        isChecked
                          ? "bg-rose-600/20 text-ink"
                          : selectedRow === voucher.id
                            ? "bg-rose-500/20 text-ink ring-1 ring-rose-500/40"
                            : rowIdx % 2 === 0
                              ? "hover:bg-card-2/70"
                              : "bg-card-2/20 hover:bg-card-2/70"
                      }`}
                    >
                      <td className="px-2 py-1 border-r border-line-soft text-center" onClick={(e) => e.stopPropagation()}>
                        {isFirst && (
                          <button type="button" onClick={() => toggleVoucher(voucher.id)} className="text-ink-subtle hover:text-rose-500">
                            {isChecked ? <FaCheckSquare className="text-rose-500" /> : <FaSquare />}
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft font-mono text-[13px]">
                        {isFirst ? formatDate(voucher.date) : ""}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft font-mono font-semibold text-rose-500 text-center">
                        {isFirst ? displayVoucherNo(voucher.voucherNo) : ""}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft font-semibold text-ink uppercase">
                        {accountLabel || "-"}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft text-right font-mono font-semibold text-ink">
                        {dr > 0
                          ? formatAmount(dr)
                          : ""}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft text-right font-mono font-semibold text-ink">
                        {cr > 0
                          ? formatAmount(cr)
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
                    <td className="px-2 py-1 border-r border-line-soft"></td>
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
                  <td colSpan={4} className="px-2 py-1.5 text-right text-[13px] font-bold text-ink uppercase tracking-wide border-r border-line">
                    Page Total ({vouchers.length} vouchers · {flatRows.length} entries)
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-[13px] text-ink font-mono border-r border-line">
                    {formatAmount(totalDebit)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-[13px] text-ink font-mono border-r border-line">
                    {formatAmount(totalCredit)}
                  </td>
                  {applied.showNarration && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Busy-style status bar */}
        <div className="border-t border-line bg-card-2/60 px-3 py-1 flex items-center justify-between text-[13px] font-mono text-ink-subtle">
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
        className={`px-3 py-0.5 rounded text-[13px] font-mono font-bold border cursor-pointer ${
          value
            ? "bg-rose-600 text-white border-rose-600"
            : "bg-card text-ink-muted border-line hover:bg-card-2"
        }`}
      >
        Y
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-0.5 rounded text-[13px] font-mono font-bold border cursor-pointer ${
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

export default ContraVoucherPage;
