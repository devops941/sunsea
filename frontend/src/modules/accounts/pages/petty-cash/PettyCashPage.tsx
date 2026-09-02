import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  FaCoins,
  FaArrowDown,
  FaArrowUp,
  FaPlus,
  FaSearch,
  FaSync,
  FaWallet,
  FaTimes,
  FaFilter,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { pettyCashService, type PettyCashEntry, type PettyCashSummary } from "../../../../services/pettyCashService";
import { useAppSelector } from "../../../../hooks/reduxHooks";
import { useListCache, prependToListCacheByPrefix } from "../../../../hooks/useListCache";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";

// Busy-style filter options shown BEFORE the list opens.
interface FilterOptions {
  startDate: string;
  endDate: string;
  entryType: "ALL" | "IN" | "OUT";
  showCategory: boolean;
  showDescription: boolean;
  showReceiptNo: boolean;
  showBalance: boolean;
}

const todayIso = () => new Date().toISOString().split("T")[0];

const defaultFilters = (): FilterOptions => ({
  startDate: todayIso(),
  endDate: todayIso(),
  entryType: "ALL",
  showCategory: true,
  showDescription: true,
  showReceiptNo: true,
  showBalance: true,
});

export const PettyCashPage: React.FC = () => {
  const [summary, setSummary] = useState<PettyCashSummary>({
    totalIn: 0,
    totalOut: 0,
    currentBalance: 0,
  });
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedRow, setSelectedRow] = useState<string | number | null>(null);

  const { data: company } = useAppSelector((state) => state.company);

  // Applied filters drive the fetch; pending lives inside the panel until OK.
  const [applied, setApplied] = useState<FilterOptions>(() => defaultFilters());
  const [pending, setPending] = useState<FilterOptions>(() => defaultFilters());
  const [panelOpen, setPanelOpen] = useState<boolean>(true);

  // In-list search (kept inline, not part of the pre-list dialog).
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Form State (New Entry modal)
  const [type, setType] = useState<"IN" | "OUT">("OUT");
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [paidTo, setPaidTo] = useState<string>("");
  const [receiptNo, setReceiptNo] = useState<string>("");
  const [entryDate, setEntryDate] = useState<string>(todayIso());

  // F2 = OK, Esc = close panel (matches Busy shortcut on the other list pages).
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

  const cacheKey = `accounts:petty-cash-entries:${company?.id ?? ""}:${applied.entryType}:${applied.startDate}:${applied.endDate}`;

  const fetcher = useCallback(
    async (_signal: AbortSignal) => {
      try {
        const res = await pettyCashService.fetchEntries({
          companyId: company?.id,
          type: applied.entryType === "ALL" ? undefined : applied.entryType,
          startDate: applied.startDate || undefined,
          endDate: applied.endDate || undefined,
        });
        const list = res.entries || [];
        setSummary(res.summary || { totalIn: 0, totalOut: 0, currentBalance: 0 });
        return { data: list, total: list.length };
      } catch (err: any) {
        toast.error(err?.message || "Failed to load petty cash entries");
        throw err;
      }
    },
    [company?.id, applied.entryType, applied.startDate, applied.endDate]
  );

  const { data: entries, total, loading, refreshing, refresh } = useListCache<PettyCashEntry>({
    cacheKey,
    socketModule: "pettyCashEntry",
    fetcher,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0 || !description || !company?.id) {
      toast.error("Please fill in all required fields and ensure company context is active");
      return;
    }

    setSubmitting(true);
    try {
      const created = await pettyCashService.createEntry({
        companyId: company.id,
        type,
        category,
        amount: parseFloat(amount),
        description,
        paidTo: paidTo || undefined,
        receiptNo: receiptNo || undefined,
        entryDate,
      });
      // Optimistic list update — row appears in the table instantly. The
      // subsequent refresh() below still runs so `summary` (totalIn / totalOut
      // / currentBalance) recalculates from the server.
      if (created?.id) {
        prependToListCacheByPrefix<PettyCashEntry>("accounts:petty-cash-entries:", created);
      }
      toast.success("Petty Cash entry recorded successfully!");
      setShowModal(false);
      resetForm();
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create entry");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setType("OUT");
    setCategory("");
    setAmount("");
    setDescription("");
    setPaidTo("");
    setReceiptNo("");
    setEntryDate(new Date().toISOString().split("T")[0]);
  };

  const filteredEntries = useMemo(() => {
    if (!searchTerm) return entries;
    const term = searchTerm.toLowerCase();
    return entries.filter(
      (e) =>
        e.entryNo?.toLowerCase().includes(term) ||
        e.category?.toLowerCase().includes(term) ||
        e.description?.toLowerCase().includes(term) ||
        e.paidTo?.toLowerCase().includes(term) ||
        e.receiptNo?.toLowerCase().includes(term)
    );
  }, [entries, searchTerm]);

  // Running balance: chronological IN − OUT
  const runningBalances = useMemo(() => {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    const map = new Map<string | number, number>();
    let bal = 0;
    sorted.forEach((e) => {
      bal += e.type === "IN" ? Number(e.amount) : -Number(e.amount);
      map.set(e.id, bal);
    });
    return map;
  }, [entries]);

  // Column totals for the sticky footer
  const { totalInPage, totalOutPage } = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    for (const e of filteredEntries) {
      if (e.type === "IN") inSum += Number(e.amount);
      else outSum += Number(e.amount);
    }
    return { totalInPage: inSum, totalOutPage: outSum };
  }, [filteredEntries]);

  // ────── Busy-style pre-list filter dialog ──────
  if (panelOpen) {
    return (
      <div className="p-3">
        <div className="w-full lg:w-[420px]">
          <div className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
            <div className="bg-amber-500/90 text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
              List of Petty Cash Entries
            </div>
            <div className="p-4 space-y-2.5 text-[11px]">
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

              <FilterRow label="Entry Type">
                <SelectInput
                  label="Entry Type"
                  hideLabel
                  noMargin
                  searchable={false}
                  value={pending.entryType}
                  onChange={(e) =>
                    setPending({ ...pending, entryType: e.target.value as "ALL" | "IN" | "OUT" })
                  }
                  options={[
                    { value: "ALL", label: "All Entry Types" },
                    { value: "IN", label: "Cash IN (Receipts)" },
                    { value: "OUT", label: "Cash OUT (Expenses)" },
                  ]}
                />
              </FilterRow>

              <ToggleRow
                label="Show Category?"
                value={pending.showCategory}
                onChange={(v) => setPending({ ...pending, showCategory: v })}
              />
              <ToggleRow
                label="Show Description?"
                value={pending.showDescription}
                onChange={(v) => setPending({ ...pending, showDescription: v })}
              />
              <ToggleRow
                label="Show Receipt No?"
                value={pending.showReceiptNo}
                onChange={(v) => setPending({ ...pending, showReceiptNo: v })}
              />
              <ToggleRow
                label="Show Balance?"
                value={pending.showBalance}
                onChange={(v) => setPending({ ...pending, showBalance: v })}
              />

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setApplied(pending);
                    setPanelOpen(false);
                  }}
                  className="px-6 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-semibold text-[11px] transition cursor-pointer"
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

  return (
    <div className="p-3 flex gap-3 w-full items-start">
      <div className="flex-1 space-y-2 min-w-0 max-w-7xl">
      {/* Header — title + inline search + Change Filters + Refresh + Record */}
      <div className="bg-card rounded-md border border-line px-3 py-1.5 flex flex-wrap items-center gap-2 shrink-0 shadow-sm">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaCoins className="text-amber-500 text-sm" /> Petty Cash Register
          {refreshing && <FaSync className="animate-spin text-amber-500 text-[10px]" />}
        </h1>
        <span className="text-[10px] text-ink-subtle italic">
          From <b className="text-ink">{applied.startDate}</b> to{" "}
          <b className="text-ink">{applied.endDate}</b> · Type{" "}
          <b className="text-ink">{applied.entryType}</b>
        </span>

        <div className="relative w-full max-w-[280px] ml-2">
          <input
            type="text"
            placeholder="Search entry no, category, description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
          />
          <FaSearch className="absolute left-2 top-2 text-ink-subtle text-[10px]" />
        </div>

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
            <FaSync className={refreshing ? "animate-spin text-amber-500" : ""} /> Refresh
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            <FaPlus className="text-[10px]" /> Record Cash Entry
          </button>
        </div>
      </div>

      {/* Spreadsheet-style table (Busy density) */}
      <div
        className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
        style={{ height: "calc(100vh - 240px)" }}
      >
        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-subtle flex-1">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <FaSync className="animate-spin text-amber-500 text-[10px]" />
                Loading petty cash entries…
              </span>
            ) : (
              "No petty cash transactions found."
            )}
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-[11px] text-ink-muted border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-card-2 text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                  <th className="px-2 py-1.5 border-r border-line w-28">Date</th>
                  <th className="px-2 py-1.5 border-r border-line w-24 text-center">Entry No</th>
                  <th className="px-2 py-1.5 border-r border-line w-20 text-center">Type</th>
                  {applied.showCategory && (
                    <th className="px-2 py-1.5 border-r border-line w-40">Category</th>
                  )}
                  {applied.showDescription && (
                    <th className="px-2 py-1.5 border-r border-line">Description</th>
                  )}
                  <th className="px-2 py-1.5 border-r border-line w-40">Paid To / From</th>
                  {applied.showReceiptNo && (
                    <th className="px-2 py-1.5 border-r border-line w-24 text-center">Receipt No</th>
                  )}
                  <th className="px-2 py-1.5 border-r border-line w-28 text-right">Amount (₹)</th>
                  {applied.showBalance && (
                    <th className="px-2 py-1.5 w-28 text-right">Balance (₹)</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((item, rowIdx) => {
                  const isSelected = selectedRow === item.id;
                  const isIn = item.type === "IN";
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRow(item.id)}
                      className={`border-b border-line-soft cursor-pointer ${
                        isSelected
                          ? "bg-amber-500/20 text-ink"
                          : rowIdx % 2 === 0
                            ? "hover:bg-card-2/70"
                            : "bg-card-2/20 hover:bg-card-2/70"
                      }`}
                    >
                      <td className="px-2 py-1 border-r border-line-soft font-mono text-[11px]">
                        {new Date(item.entryDate).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft font-mono font-semibold text-amber-500 text-center">
                        {item.entryNo || "-"}
                      </td>
                      <td className="px-2 py-1 border-r border-line-soft text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isIn
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          }`}
                        >
                          {isIn ? "IN" : "OUT"}
                        </span>
                      </td>
                      {applied.showCategory && (
                        <td className="px-2 py-1 border-r border-line-soft font-semibold text-ink uppercase">
                          {item.category || "-"}
                        </td>
                      )}
                      {applied.showDescription && (
                        <td className="px-2 py-1 border-r border-line-soft text-ink-muted max-w-xs truncate">
                          {item.description || "-"}
                        </td>
                      )}
                      <td className="px-2 py-1 border-r border-line-soft text-ink-subtle uppercase">
                        {item.paidTo || "-"}
                      </td>
                      {applied.showReceiptNo && (
                        <td className="px-2 py-1 border-r border-line-soft font-mono text-[11px] text-ink-subtle text-center">
                          {item.receiptNo || "-"}
                        </td>
                      )}
                      <td className="px-2 py-1 border-r border-line-soft text-right font-mono font-semibold whitespace-nowrap">
                        <span className={isIn ? "text-emerald-500" : "text-rose-500"}>
                          {isIn ? "+" : "−"}
                          {Number(item.amount).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      {applied.showBalance && (
                        <td className="px-2 py-1 text-right font-mono font-semibold text-ink whitespace-nowrap">
                          {(runningBalances.get(item.id) || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {/* Busy-style empty filler rows */}
                {Array.from({ length: Math.max(0, 25 - filteredEntries.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-line-soft">
                    <td className="px-2 py-1 border-r border-line-soft">&nbsp;</td>
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    {applied.showCategory && <td className="px-2 py-1 border-r border-line-soft"></td>}
                    {applied.showDescription && <td className="px-2 py-1 border-r border-line-soft"></td>}
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    {applied.showReceiptNo && <td className="px-2 py-1 border-r border-line-soft"></td>}
                    <td className="px-2 py-1 border-r border-line-soft"></td>
                    {applied.showBalance && <td className="px-2 py-1"></td>}
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-card-2 border-t-2 border-line">
                <tr>
                  <td
                    colSpan={
                      3 /* Date + Entry No + Type */ +
                      (applied.showCategory ? 1 : 0) +
                      (applied.showDescription ? 1 : 0) +
                      1 /* Paid To/From */ +
                      (applied.showReceiptNo ? 1 : 0)
                    }
                    className="px-2 py-1.5 text-right text-[10px] font-bold text-ink uppercase tracking-wide border-r border-line"
                  >
                    Page Total ({filteredEntries.length})
                    <span className="ml-3 normal-case text-ink-subtle">
                      IN <b className="text-emerald-500">₹{totalInPage.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                      <span className="mx-2">·</span>
                      OUT <b className="text-rose-500">₹{totalOutPage.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-sm text-ink font-mono border-r border-line">
                    {(totalInPage - totalOutPage).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  {applied.showBalance && (
                    <td className="px-2 py-1.5 text-right font-bold text-sm text-amber-500 font-mono">
                      {summary.currentBalance.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Busy-style status bar */}
        <div className="border-t border-line bg-card-2/60 px-3 py-1 flex items-center justify-between text-[10px] font-mono text-ink-subtle shrink-0">
          <div className="flex gap-4">
            <span>
              Entry No: <b className="text-ink">{filteredEntries.length > 0 ? 1 : 0} / {filteredEntries.length}</b>
            </span>
            <span>
              Row No: <b className="text-ink">
                {selectedRow ? filteredEntries.findIndex((v) => v.id === selectedRow) + 1 : (filteredEntries.length > 0 ? 1 : 0)}
                {" / "}{filteredEntries.length}
              </b>
            </span>
          </div>
          <div className="flex gap-3 uppercase tracking-wide">
            <span>Total: <b className="text-ink">{total}</b></span>
            <span>Balance: <b className="text-amber-500">₹{summary.currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
          </div>
        </div>
      </div>
      </div>

      {/* Right sidebar — 3 summary stats. Amounts render on their own row so
         crores-scale values never squeeze the label or overflow the card. */}
      <aside className="w-[240px] shrink-0 bg-card border border-line rounded-md shadow-sm overflow-hidden">
        <div className="px-3 py-1.5 bg-card-2 border-b border-line text-[11px] font-bold uppercase tracking-wide text-ink flex items-center gap-1.5">
          <FaCoins className="text-amber-500 text-xs" /> Summary
        </div>
        <div className="divide-y divide-line-soft">
          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <FaArrowDown className="text-emerald-500 text-[10px]" />
              <span className="text-[11px] font-semibold text-ink-muted">Total Cash IN</span>
            </div>
            <div className="text-sm font-mono font-bold text-emerald-500 break-all leading-tight">
              ₹{summary.totalIn.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <FaArrowUp className="text-rose-500 text-[10px]" />
              <span className="text-[11px] font-semibold text-ink-muted">Total Cash OUT</span>
            </div>
            <div className="text-sm font-mono font-bold text-rose-500 break-all leading-tight">
              ₹{summary.totalOut.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="px-3 py-2 bg-amber-500/5">
            <div className="flex items-center gap-1.5 mb-1">
              <FaWallet className="text-amber-500 text-[10px]" />
              <span className="text-[11px] font-semibold text-ink-muted">Cash Balance on Hand</span>
            </div>
            <div className="text-sm font-mono font-bold text-amber-500 break-all leading-tight">
              ₹{summary.currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </aside>

      {/* Record Cash Entry Modal — Busy-compact */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
          <div className="bg-card rounded-md border border-line w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-3 py-1.5 border-b border-line bg-amber-500/90 text-white flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-2">
                <FaCoins className="text-xs" /> New Petty Cash Entry
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded cursor-pointer"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                    Transaction Type <span className="text-red-500">*</span>
                  </label>
                  <SelectInput
                    label="Transaction Type"
                    hideLabel
                    noMargin
                    required
                    searchable={false}
                    value={type}
                    onChange={(e) => setType(e.target.value as "IN" | "OUT")}
                    options={[
                      { value: "OUT", label: "CASH OUT (Expense)" },
                      { value: "IN", label: "CASH IN (Cash Replenishment)" },
                    ]}
                  />
                </div>

                <div>
                  <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                    Entry Date <span className="text-red-500">*</span>
                  </label>
                  <DatePickerCalendar
                    name="entryDate"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                  Category <span className="text-red-500">*</span>
                </label>
                <input
                  list="petty-cash-categories"
                  value={category}
                  required
                  placeholder="Type or select a category..."
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
                />
                <datalist id="petty-cash-categories">
                  {Array.from(new Set(entries.map((e) => e.category).filter(Boolean)))
                    .sort()
                    .map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                </datalist>
              </div>

              <div>
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  required
                  placeholder="0.00"
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink font-mono focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={description}
                  required
                  placeholder="e.g. Purchased office stationery"
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                    Paid To / From
                  </label>
                  <input
                    type="text"
                    value={paidTo}
                    placeholder="e.g. Local Vendor / John"
                    onChange={(e) => setPaidTo(e.target.value)}
                    className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                    Receipt No
                  </label>
                  <input
                    type="text"
                    value={receiptNo}
                    placeholder="e.g. REC-102"
                    onChange={(e) => setReceiptNo(e.target.value)}
                    className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="px-3 py-1.5 text-ink-muted bg-card-2 hover:bg-card border border-line rounded font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded font-semibold text-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
            ? "bg-amber-500 text-white border-amber-500"
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

export default PettyCashPage;
