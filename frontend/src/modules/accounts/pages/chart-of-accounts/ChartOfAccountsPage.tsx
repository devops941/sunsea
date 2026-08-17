import React, { useState, useEffect, useMemo } from "react";
import {
  FaSearch,
  FaPlus,
  FaSitemap,
  FaSync,
  FaCheckCircle,
  FaTimesCircle,
  FaTimes,
  FaFolder
} from "react-icons/fa";
import { toast } from "react-toastify";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import type { DataTableColumn } from "../../../../components/ui/table/DataTable";
import DataTable from "../../../../components/ui/table/DataTable";
import { accountService, type AccountLedger } from "../../../../services/accountService";

import { useSocketSync } from "../../../../hooks/useSocketSync";

export const ChartOfAccountsPage: React.FC = () => {
  const [ledgers, setLedgers] = useState<AccountLedger[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Applied Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Draft Filter state for Apply / Clear All
  const [draftSearchTerm, setDraftSearchTerm] = useState<string>(searchTerm);
  const [draftSelectedType, setDraftSelectedType] = useState<string>(selectedType);

  const [showModal, setShowModal] = useState<boolean>(false);

  // New Ledger Form State
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "ASSET" as "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY",
    group: "",
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadLedgers = async () => {
    setLoading(true);
    try {
      const res = await accountService.fetchLedgers({ page: 1, limit: 1000 });
      setLedgers(res.ledgers || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load Chart of Accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedgers();
  }, []);

  useSocketSync("accountLedger", undefined, loadLedgers);

  const handleApplyFilters = () => {
    setSearchTerm(draftSearchTerm);
    setSelectedType(draftSelectedType);
  };

  const handleClearFilters = () => {
    setDraftSearchTerm("");
    setDraftSelectedType("ALL");
    setSearchTerm("");
    setSelectedType("ALL");
  };

  const filteredLedgers = useMemo(() => {
    return ledgers.filter((item) => {
      const matchesSearch =
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.group.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = selectedType === "ALL" || item.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [ledgers, searchTerm, selectedType]);

  const handleCreateLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name || !formData.group) {
      toast.error("Please fill all required fields");
      return;
    }

    setSubmitting(true);
    try {
      await accountService.createLedger({
        code: formData.code,
        name: formData.name,
        type: formData.type,
        group: formData.group,
        isActive: true,
      });
      toast.success("Account ledger created successfully");
      setShowModal(false);
      setFormData({ code: "", name: "", type: "ASSET", group: "" });
      loadLedgers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create ledger");
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "ASSET":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "LIABILITY":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "INCOME":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "EXPENSE":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "EQUITY":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-card-2 text-ink-muted border-line";
    }
  };

  // CSV Export Configuration
  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Code", accessor: (item: AccountLedger) => item.code },
      { header: "Account Name", accessor: (item: AccountLedger) => item.name },
      { header: "Account Type", accessor: (item: AccountLedger) => item.type },
      { header: "Group Category", accessor: (item: AccountLedger) => item.group },
      {
        header: "Linked Party / System",
        accessor: (item: AccountLedger) =>
          item.customer
            ? `Customer: ${item.customer.firmName} (${item.customer.customerCode})`
            : item.supplier
            ? `Supplier: ${item.supplier.legalName} (${item.supplier.supplierCode})`
            : "General System Ledger",
      },
      { header: "Status", accessor: (item: AccountLedger) => (item.isActive ? "Active" : "Inactive") },
    ];

    return {
      csvData: filteredLedgers,
      csvColumns: columns,
      csvFilename: `Chart_of_Accounts_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }, [filteredLedgers]);

  // Table Columns for DataTable
  const tableColumns: DataTableColumn<AccountLedger>[] = [
    {
      header: "#",
      width: "50px",
      render: (_item, index) => index + 1,
    },
    {
      header: "CODE",
      render: (item) => <span className="font-mono font-bold text-ink">{item.code}</span>,
    },
    {
      header: "ACCOUNT NAME",
      render: (item) => <span className="font-bold text-ink">{item.name}</span>,
    },
    {
      header: "ACCOUNT TYPE",
      render: (item) => (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getTypeBadgeClass(item.type)}`}>
          {item.type}
        </span>
      ),
    },
    {
      header: "GROUP CATEGORY",
      render: (item) => (
        <span className="flex items-center gap-1.5 text-ink-muted">
          <FaFolder className="text-blue-500 text-xs" /> {item.group}
        </span>
      ),
    },
    {
      header: "LINKED PARTY / SYSTEM",
      render: (item) => (
        <div className="text-xs">
          {item.customer ? (
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Customer: {item.customer.firmName} ({item.customer.customerCode})
            </span>
          ) : item.supplier ? (
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              Supplier: {item.supplier.legalName} ({item.supplier.supplierCode})
            </span>
          ) : (
            <span className="text-ink-subtle italic">General System Ledger</span>
          )}
        </div>
      ),
    },
    {
      header: "STATUS",
      render: (item) => (
        <div className="text-center">
          {item.isActive ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <FaCheckCircle className="text-emerald-500" /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-subtle bg-card-2 px-2 py-0.5 rounded-full border border-line">
              <FaTimesCircle className="text-ink-subtle" /> Inactive
            </span>
          )}
        </div>
      ),
    },
  ];

  // Pagination state (10 items per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType]);

  const totalPages = Math.ceil(filteredLedgers.length / pageSize) || 1;
  const paginatedLedgers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLedgers.slice(start, start + pageSize);
  }, [filteredLedgers, currentPage]);

  return (
    <div className="w-full p-4 md:p-6 bg-card-2 font-sans text-ink">
      {/* HEADER SECTION */}
      <div className="bg-card rounded-2xl shadow-sm border border-line mb-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wider border border-blue-200">
                Chart of Accounts
              </span>
            </div>
            <h2 className="text-2xl font-bold text-ink mt-1 flex items-center gap-2">
              <FaSitemap className="text-blue-600 text-xl" /> General Ledger Structure
            </h2>
            <p className="text-xs text-ink-subtle mt-1">
              Double-entry account categories, asset/liability grouping & system ledgers
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <button
              onClick={loadLedgers}
              className="flex items-center gap-2 px-3.5 py-2 bg-card-2 hover:bg-line text-ink-muted rounded-lg text-sm font-semibold transition-all border border-line"
              title="Refresh Data"
            >
              <FaSync className={loading ? "animate-spin text-blue-600" : ""} /> Refresh
            </button>
            <ExportCSVButton
              data={csvData}
              columns={csvColumns}
              filename={csvFilename}
              text="Export CSV"
            />
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <FaPlus /> New Ledger
            </button>
          </div>
        </div>

        {/* REPORT FILTERS CONTROL PANEL */}
        <div className="p-6 border-b border-line bg-card-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Search Ledger</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full border border-line rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                  value={draftSearchTerm}
                  onChange={(e) => setDraftSearchTerm(e.target.value)}
                  placeholder="Search code, name, group..."
                />
                <FaSearch className="absolute left-3 top-3 text-ink-subtle text-xs" />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Account Type</label>
              <SelectInput
                name="draftSelectedType"
                value={draftSelectedType}
                options={[
                  { label: "All Account Types", value: "ALL" },
                  { label: "Asset Accounts", value: "ASSET" },
                  { label: "Liability Accounts", value: "LIABILITY" },
                  { label: "Income Accounts", value: "INCOME" },
                  { label: "Expense Accounts", value: "EXPENSE" },
                ]}
                hideLabel={true}
                onChange={(e) => setDraftSelectedType(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-line">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink hover:bg-card-2 rounded-md transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* DATA TABLE WITH 10 ITEMS PAGINATION */}
      <DataTable
        columns={tableColumns}
        data={paginatedLedgers}
        rowKey={(item: AccountLedger) => item.id}
        loading={loading}
        emptyMessage="No account ledgers found matching criteria."
        pagination={{
          currentPage,
          totalPages,
          onPageChange: setCurrentPage,
        }}
      />

      {/* CREATE LEDGER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-line">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FaSitemap className="text-blue-400" /> New Account Ledger
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-ink-subtle hover:text-white transition-colors"
              >
                <FaTimes size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLedger} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                  Ledger Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. ACC-1001"
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Office Stationery Expenses"
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                  Ledger Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="INCOME">INCOME</option>
                  <option value="EXPENSE">EXPENSE</option>
                  <option value="EQUITY">EQUITY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={formData.group}
                  onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                  placeholder="e.g. Administrative Expenses, Bank Accounts"
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-card-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartOfAccountsPage;
