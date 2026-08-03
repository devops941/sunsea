import React, { useState, useEffect } from "react";
import {
  FaCoins,
  FaArrowDown,
  FaArrowUp,
  FaPlus,
  FaTimes,
  FaFilter,
  FaCalendarAlt
} from "react-icons/fa";
import { toast } from "react-toastify";
import { pettyCashService, type PettyCashEntry, type PettyCashSummary } from "../../../../services/pettyCashService";
import { useAppSelector } from "../../../../hooks/reduxHooks";

import { useSocketSync } from "../../../../hooks/useSocketSync";

export const PettyCashPage: React.FC = () => {
  const [entries, setEntries] = useState<PettyCashEntry[]>([]);
  const [summary, setSummary] = useState<PettyCashSummary>({
    totalIn: 0,
    totalOut: 0,
    currentBalance: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { data: company } = useAppSelector((state) => state.company);

  // Filters
  const [typeFilter, setTypeFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Form State
  const [type, setType] = useState<"IN" | "OUT">("OUT");
  const [category, setCategory] = useState<string>("Office Expenses");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [paidTo, setPaidTo] = useState<string>("");
  const [receiptNo, setReceiptNo] = useState<string>("");
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await pettyCashService.fetchEntries({
        companyId: company?.id,
        type: typeFilter === "ALL" ? undefined : typeFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setEntries(res.entries || []);
      setSummary(res.summary || { totalIn: 0, totalOut: 0, currentBalance: 0 });
    } catch (err: any) {
      toast.error(err?.message || "Failed to load petty cash entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [typeFilter, startDate, endDate, company?.id]);

  useSocketSync("pettyCash", undefined, loadData);

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
      toast.success("Petty Cash entry recorded!");
      setShowModal(false);
      setAmount("");
      setDescription("");
      setPaidTo("");
      setReceiptNo("");
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create entry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <span>Accounts</span>
            <span>/</span>
            <span className="text-slate-900 font-medium">Petty Cash</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FaCoins className="text-amber-500" /> Petty Cash Register
          </h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition shadow-sm"
        >
          <FaPlus /> Record Cash Entry
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Cash IN</span>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              ₹{summary.totalIn.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <FaArrowDown className="text-xl" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Cash OUT</span>
            <div className="text-2xl font-extrabold text-red-600 mt-1">
              ₹{summary.totalOut.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 bg-red-100 text-red-600 rounded-xl">
            <FaArrowUp className="text-xl" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash Balance on Hand</span>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">
              ₹{summary.currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
            <FaCoins className="text-xl" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FaFilter className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase">Filter Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <option value="ALL">All Entries</option>
            <option value="IN">Cash IN (Receipts)</option>
            <option value="OUT">Cash OUT (Expenses)</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <FaCalendarAlt className="text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded-lg text-xs"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Petty Cash Transactions</h2>
          <span className="text-xs text-slate-500 font-mono">Total Records: {entries.length}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading petty cash register...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No petty cash transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Entry No</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Paid To / From</th>
                  <th className="px-4 py-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono font-medium text-amber-600">{e.entryNo}</td>
                    <td className="px-4 py-3">{new Date(e.entryDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          e.type === "IN"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {e.type === "IN" ? "CASH IN" : "CASH OUT"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{e.category}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{e.description}</td>
                    <td className="px-4 py-3 text-slate-500">{e.paidTo || "-"}</td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${
                        e.type === "IN" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {e.type === "IN" ? "+" : "-"}₹
                      {Number(e.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FaCoins className="text-amber-500" /> New Petty Cash Entry
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Transaction Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "IN" | "OUT")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="OUT">CASH OUT (Expense)</option>
                    <option value="IN">CASH IN (Cash Replenishment)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Office Expenses">Office Expenses</option>
                  <option value="Tea & Refreshments">Tea & Refreshments</option>
                  <option value="Local Conveyance">Local Conveyance</option>
                  <option value="Stationery & Printing">Stationery & Printing</option>
                  <option value="Maintenance & Repair">Maintenance & Repair</option>
                  <option value="Cash Deposit / Replenishment">Cash Deposit / Replenishment</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Purchased office stationery"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Paid To / From</label>
                  <input
                    type="text"
                    placeholder="e.g. Local Vendor / John"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Receipt No</label>
                  <input
                    type="text"
                    placeholder="e.g. REC-102"
                    value={receiptNo}
                    onChange={(e) => setReceiptNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Petty Cash Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
