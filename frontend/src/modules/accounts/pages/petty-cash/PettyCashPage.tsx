import React, { useState, useCallback } from "react";
import {
  FaCoins,
  FaArrowDown,
  FaArrowUp,
  FaPlus,
  FaSearch,
  FaSync,
  FaWallet,
  FaTimes,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { pettyCashService, type PettyCashEntry, type PettyCashSummary } from "../../../../services/pettyCashService";
import { useAppSelector } from "../../../../hooks/reduxHooks";
import { useListCache } from "../../../../hooks/useListCache";

export const PettyCashPage: React.FC = () => {
  const [summary, setSummary] = useState<PettyCashSummary>({
    totalIn: 0,
    totalOut: 0,
    currentBalance: 0,
  });
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { data: company } = useAppSelector((state) => state.company);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Form State
  const [type, setType] = useState<"IN" | "OUT">("OUT");
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [paidTo, setPaidTo] = useState<string>("");
  const [receiptNo, setReceiptNo] = useState<string>("");
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const cacheKey = `accounts:petty-cash-entries:${company?.id ?? ""}:${typeFilter}:${startDate}:${endDate}`;

  const fetcher = useCallback(
    async (_signal: AbortSignal) => {
      try {
        const res = await pettyCashService.fetchEntries({
          companyId: company?.id,
          type: typeFilter === "ALL" ? undefined : typeFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        const list = res.entries || [];
        setSummary(res.summary || { totalIn: 0, totalOut: 0, currentBalance: 0 });
        return { data: list, total: list.length };
      } catch (err: any) {
        toast.error(err?.message || "Failed to load petty cash entries");
        throw err;
      }
    },
    [company?.id, typeFilter, startDate, endDate]
  );

  const { data: entries, loading, refreshing, refresh } = useListCache<PettyCashEntry>({
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
      await pettyCashService.createEntry({
        companyId: company.id,
        type,
        category,
        amount: parseFloat(amount),
        description,
        paidTo: paidTo || undefined,
        receiptNo: receiptNo || undefined,
        entryDate,
      });
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

  const filteredEntries = entries.filter((e) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      e.entryNo?.toLowerCase().includes(term) ||
      e.category?.toLowerCase().includes(term) ||
      e.description?.toLowerCase().includes(term) ||
      e.paidTo?.toLowerCase().includes(term) ||
      e.receiptNo?.toLowerCase().includes(term)
    );
  });

  const paginatedEntries = filteredEntries;

  // Running balance calculation (based on IN - OUT chronologically)
  const runningBalances = React.useMemo(() => {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
    );
    const map = new Map<number | string, number>();
    let bal = 0;
    sorted.forEach((e) => {
      bal += e.type === "IN" ? Number(e.amount) : -Number(e.amount);
      map.set(e.id, bal);
    });
    return map;
  }, [entries]);

  return (
    <div className="p-3 gap-3 flex flex-col h-full min-h-0" style={{ height: "calc(100vh - 100px)" }}>
      {/* Compact KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 shrink-0">
        <div className="bg-card border border-line rounded-lg p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Total Cash IN</div>
            <div className="text-lg font-mono font-bold text-emerald-500 mt-0.5">
              ₹{summary.totalIn.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <FaArrowDown className="text-emerald-500 text-sm" />
        </div>

        <div className="bg-card border border-line rounded-lg p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide">Total Cash OUT</div>
            <div className="text-lg font-mono font-bold text-rose-500 mt-0.5">
              ₹{summary.totalOut.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <FaArrowUp className="text-rose-500 text-sm" />
        </div>

        <div className="bg-card border border-line rounded-lg p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Cash Balance on Hand</div>
            <div className="text-lg font-mono font-bold text-amber-500 mt-0.5">
              ₹{summary.currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <FaWallet className="text-amber-500 text-sm" />
        </div>
      </div>

      {/* Single-row Header + Filters (Busy-style compact) */}
      <div className="bg-card rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-2 shrink-0">
        <h1 className="text-sm font-bold text-ink flex items-center gap-2 mr-2">
          <FaCoins className="text-amber-500 text-sm" /> Petty Cash Register
          {refreshing && <FaSync className="animate-spin text-amber-500 text-[10px]" />}
        </h1>

        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="w-[150px] px-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
          >
            <option value="ALL">All Entry Types</option>
            <option value="IN">Cash IN (Receipts)</option>
            <option value="OUT">Cash OUT (Expenses)</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[130px] px-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[130px] px-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="relative w-full max-w-[320px]">
          <input
            type="text"
            placeholder="Search entry no, category, description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-2 py-1 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
          />
          <FaSearch className="absolute left-2 top-2 text-ink-subtle text-[10px]" />
        </div>

        {(searchTerm || startDate || endDate || typeFilter !== "ALL") && (
          <button
            onClick={() => {
              setSearchTerm("");
              setStartDate("");
              setEndDate("");
              setTypeFilter("ALL");
            }}
            className="px-2 py-1 text-xs text-ink-muted hover:text-ink border border-line rounded cursor-pointer"
          >
            Clear
          </button>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
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

      {/* Table */}
      <div className="bg-card rounded-lg border border-line overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between shrink-0">
          <h2 className="text-xs font-semibold text-ink">Petty Cash Transactions</h2>
          <span className="text-[11px] text-ink-subtle font-mono">Total: {filteredEntries.length}</span>
        </div>
        {paginatedEntries.length === 0 ? (
          loading ? <div className="flex-1" /> : <div className="p-8 text-center text-xs text-ink-subtle flex-1">No petty cash transactions found.</div>
        ) : (
          <>
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-left text-xs text-ink-muted">
                <thead className="bg-head text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 w-10 bg-head">#</th>
                    <th className="px-3 py-2 bg-head">Entry No</th>
                    <th className="px-3 py-2 bg-head">Date</th>
                    <th className="px-3 py-2 bg-head">Type</th>
                    <th className="px-3 py-2 bg-head">Category</th>
                    <th className="px-3 py-2 bg-head">Description</th>
                    <th className="px-3 py-2 bg-head">Paid To / From</th>
                    <th className="px-3 py-2 text-right bg-head">Amount (₹)</th>
                    <th className="px-3 py-2 text-right bg-head">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {paginatedEntries.map((item, index) => (
                    <tr key={item.id} className="hover:bg-card-2 transition-colors">
                      <td className="px-3 py-1.5 text-ink-subtle font-mono text-[11px]">
                        {index + 1}
                      </td>
                      <td className="px-3 py-1.5 font-mono font-semibold text-amber-500">{item.entryNo}</td>
                      <td className="px-3 py-1.5 font-mono text-[11px]">
                        {new Date(item.entryDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            item.type === "IN"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          }`}
                        >
                          {item.type === "IN" ? "CASH IN" : "CASH OUT"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-medium text-ink">{item.category}</td>
                      <td className="px-3 py-1.5 text-ink-muted max-w-xs truncate">{item.description}</td>
                      <td className="px-3 py-1.5 text-ink-subtle">{item.paidTo || "-"}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold whitespace-nowrap">
                        <span className={item.type === "IN" ? "text-emerald-500" : "text-rose-500"}>
                          {item.type === "IN" ? "+" : "-"}₹
                          {Number(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-ink whitespace-nowrap">
                        ₹{(runningBalances.get(item.id) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t-2 border-line bg-card-2 px-3 py-2 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-ink uppercase tracking-wide">
                Current Balance
              </span>
              <span className="text-right font-bold text-sm text-amber-500 font-mono">
                ₹{summary.currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </>
        )}

      </div>

      {/* Record Cash Entry Modal - compact */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
          <div className="bg-card rounded-lg border border-line w-full max-w-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-line bg-card-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <FaCoins className="text-amber-500 text-sm" /> New Petty Cash Entry
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-ink-subtle hover:text-ink hover:bg-card rounded cursor-pointer"
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
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "IN" | "OUT")}
                    className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
                    required
                  >
                    <option value="OUT">CASH OUT (Expense)</option>
                    <option value="IN">CASH IN (Cash Replenishment)</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                    Entry Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-none"
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

export default PettyCashPage;
