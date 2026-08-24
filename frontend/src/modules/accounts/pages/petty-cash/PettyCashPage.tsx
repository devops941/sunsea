import React, { useState, useEffect } from "react";
import {
  FaCoins,
  FaArrowDown,
  FaArrowUp,
  FaPlus,
  FaTimes,
  FaFilter,
  FaCalendarAlt,
  FaEraser,
  FaSave,
  FaWallet
} from "react-icons/fa";
import { toast } from "react-toastify";
import { pettyCashService, type PettyCashEntry, type PettyCashSummary } from "../../../../services/pettyCashService";
import { useAppSelector } from "../../../../hooks/reduxHooks";

import DataTable from "../../../../components/ui/table/DataTable";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import CustomButton from "../../../../components/ui/Button/Button";
import CommonModal from "../../../../components/ui/Modal/CommonModal";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../../components/form/TextInput/TextInput";
import { useSocketSync } from "../../../../hooks/useSocketSync";

const ITEMS_PER_PAGE = 10;

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
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

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
      toast.success("Petty Cash entry recorded successfully!");
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create entry");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setType("OUT");
    setCategory("Office Expenses");
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

  const totalPages = Math.ceil(filteredEntries.length / ITEMS_PER_PAGE) || 1;
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-line p-6 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Petty Cash Register</h1>
          <p className="text-sm text-ink-muted mt-1">
            Manage daily cash disbursements, replenishments, and petty expenses audit log.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search entries..."
          />
          <CustomButton
            text="Record Cash Entry"
            icon={FaPlus}
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Total Cash IN</span>
            <div className="text-2xl font-extrabold text-emerald-500 font-mono mt-1">
              ₹{summary.totalIn.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-xl shadow-xs">
            <FaArrowDown className="text-lg" />
          </div>
        </div>

        <div className="bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Total Cash OUT</span>
            <div className="text-2xl font-extrabold text-rose-500 font-mono mt-1">
              ₹{summary.totalOut.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 bg-rose-500/20 text-rose-500 rounded-xl shadow-xs">
            <FaArrowUp className="text-lg" />
          </div>
        </div>

        <div className="bg-primary/10 p-4 rounded-xl border border-primary/20 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Cash Balance on Hand</span>
            <div className="text-2xl font-extrabold text-primary font-mono mt-1">
              ₹{summary.currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 bg-primary/20 text-primary rounded-xl shadow-xs">
            <FaWallet className="text-lg" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-card-2 p-3 rounded-xl border border-line flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-64">
          <SelectInput
            label=""
            name="typeFilter"
            value={typeFilter}
            hideLabel
            options={[
              { label: "All Entry Types", value: "ALL" },
              { label: "Cash IN (Receipts)", value: "IN" },
              { label: "Cash OUT (Expenses)", value: "OUT" },
            ]}
            onChange={(e) => {
              setTypeFilter(e.target.value as any);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
            <FaCalendarAlt className="text-ink-subtle" />
            <span>Date Range:</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 border border-line rounded-lg text-xs bg-card text-ink focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-ink-subtle">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 border border-line rounded-lg text-xs bg-card text-ink focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        data={paginatedEntries}
        rowKey={(item) => item.id}
        loading={loading}
        emptyMessage="No petty cash transactions found."
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (page) => setCurrentPage(page),
        }}
        columns={[
          {
            header: "#",
            width: "60px",
            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
          },
          {
            header: "ENTRY NO",
            render: (item) => (
              <span className="font-mono font-bold text-ink">
                {item.entryNo}
              </span>
            ),
          },
          {
            header: "DATE",
            render: (item) => new Date(item.entryDate).toLocaleDateString("en-IN"),
          },
          {
            header: "TYPE",
            render: (item) => (
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  item.type === "IN"
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                }`}
              >
                {item.type === "IN" ? "CASH IN" : "CASH OUT"}
              </span>
            ),
          },
          {
            header: "CATEGORY",
            render: (item) => <span className="font-medium text-ink">{item.category}</span>,
          },
          {
            header: "DESCRIPTION",
            render: (item) => <span className="text-ink-muted max-w-xs truncate block">{item.description}</span>,
          },
          {
            header: "PAID TO / FROM",
            render: (item) => <span className="text-ink-subtle">{item.paidTo || "-"}</span>,
          },
          {
            header: "AMOUNT",
            align: "right",
            render: (item) => (
              <span
                className={`font-mono font-bold ${
                  item.type === "IN" ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {item.type === "IN" ? "+" : "-"}₹
                {Number(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            ),
          },
        ]}
      />

      {/* Record Cash Entry Modal */}
      <CommonModal
        show={showModal}
        onHide={() => setShowModal(false)}
        title="New Petty Cash Entry"
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <CustomButton
              text="Clear"
              icon={FaEraser}
              onClick={resetForm}
              disabled={submitting}
              type="button"
            />
            <CustomButton
              type="submit"
              text={submitting ? "Saving..." : "Save Petty Cash Entry"}
              icon={FaSave}
              variant="primary"
              disabled={submitting}
              onClick={handleSubmit}
            />
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput
              label="TRANSACTION TYPE"
              name="type"
              value={type}
              required
              options={[
                { label: "CASH OUT (Expense)", value: "OUT" },
                { label: "CASH IN (Cash Replenishment)", value: "IN" },
              ]}
              onChange={(e) => setType(e.target.value as "IN" | "OUT")}
            />

            <TextInput
              label="ENTRY DATE"
              name="entryDate"
              type="date"
              value={entryDate}
              required
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>

          <SelectInput
            label="CATEGORY"
            name="category"
            value={category}
            required
            options={[
              { label: "Office Expenses", value: "Office Expenses" },
              { label: "Tea & Refreshments", value: "Tea & Refreshments" },
              { label: "Local Conveyance", value: "Local Conveyance" },
              { label: "Stationery & Printing", value: "Stationery & Printing" },
              { label: "Maintenance & Repair", value: "Maintenance & Repair" },
              { label: "Cash Deposit / Replenishment", value: "Cash Deposit / Replenishment" },
            ]}
            onChange={(e) => setCategory(e.target.value)}
          />

          <TextInput
            label="AMOUNT (₹)"
            name="amount"
            type="number"
            step="0.01"
            value={amount}
            required
            placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
          />

          <TextInput
            label="DESCRIPTION"
            name="description"
            value={description}
            required
            placeholder="e.g. Purchased office stationery"
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput
              label="PAID TO / FROM"
              name="paidTo"
              value={paidTo}
              placeholder="e.g. Local Vendor / John"
              onChange={(e) => setPaidTo(e.target.value)}
            />

            <TextInput
              label="RECEIPT NO"
              name="receiptNo"
              value={receiptNo}
              placeholder="e.g. REC-102"
              onChange={(e) => setReceiptNo(e.target.value)}
            />
          </div>
        </form>
      </CommonModal>
    </div>
  );
};

export default PettyCashPage;
