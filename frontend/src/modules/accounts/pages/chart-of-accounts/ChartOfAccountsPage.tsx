import React, { useState, useMemo, useCallback } from "react";
import {
  FaSearch,
  FaPlus,
  FaSitemap,
  FaSync,
  FaCheckCircle,
  FaTimesCircle,
  FaTimes,
  FaFolder,
} from "react-icons/fa";
import { toast } from "react-toastify";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import { accountService, type AccountLedger } from "../../../../services/accountService";
import { useListCache } from "../../../../hooks/useListCache";

export const ChartOfAccountsPage: React.FC = () => {
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

  const cacheKey = `accounts:chart-of-accounts`;

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    try {
      const res = await accountService.fetchLedgers({ page: 1, limit: 10000 });
      const list = res.ledgers || [];
      return { data: list, total: list.length };
    } catch (err: any) {
      toast.error(err?.message || "Failed to load Chart of Accounts");
      throw err;
    }
  }, []);

  const { data: ledgers, loading, refreshing, refresh } = useListCache<AccountLedger>({
    cacheKey,
    socketModule: "accountLedger",
    fetcher,
  });

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
      refresh();
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

  const paginatedLedgers = filteredLedgers;

  return (
    <div className="w-full p-3 space-y-3 min-h-screen font-sans text-ink">
      {/* COMPACT HEADER + FILTERS */}
      <div className="bg-card rounded-lg border border-line">
        {/* Title Bar */}
        <div className="px-3 py-2 border-b border-line flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <FaSitemap className="text-slate-500 text-sm" /> Chart of Accounts
            {refreshing && <FaSync className="animate-spin text-slate-500 text-[10px]" />}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold transition-all border border-line"
              title="Refresh"
            >
              <FaSync className={refreshing ? "animate-spin text-slate-500" : ""} /> Refresh
            </button>
            <ExportCSVButton
              data={csvData}
              columns={csvColumns}
              filename={csvFilename}
              text="Export"
            />
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-semibold transition-all"
            >
              <FaPlus className="text-[10px]" /> New Ledger
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="px-3 py-2 bg-card-2 flex flex-wrap items-end gap-2">
          <div className="w-full max-w-[320px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
              Search Ledger
            </label>
            <div className="relative">
              <input
                type="text"
                className="w-full border border-line bg-card rounded pl-7 pr-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-slate-500/40 focus:border-slate-500"
                value={draftSearchTerm}
                onChange={(e) => setDraftSearchTerm(e.target.value)}
                placeholder="Search code, name, group..."
              />
              <FaSearch className="absolute left-2.5 top-2.5 text-ink-subtle text-[10px]" />
            </div>
          </div>

          <div className="w-[180px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
              Account Type
            </label>
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

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClearFilters}
              className="px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-card rounded transition-colors border border-line"
            >
              Clear
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-800 rounded transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* COMPACT TABLE */}
      <div className="bg-card border border-line rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-head text-ink-muted text-[10px] uppercase font-bold tracking-wide border-b border-line">
              <tr>
                <th className="px-3 py-1.5 text-xs w-10">#</th>
                <th className="px-3 py-1.5 text-xs">Code</th>
                <th className="px-3 py-1.5 text-xs">Account Name</th>
                <th className="px-3 py-1.5 text-xs">Type</th>
                <th className="px-3 py-1.5 text-xs">Group</th>
                <th className="px-3 py-1.5 text-xs">Linked Party / System</th>
                <th className="px-3 py-1.5 text-xs text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-medium text-ink-muted">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-ink-subtle">
                    <FaSync className="animate-spin text-lg mx-auto mb-1 text-slate-500" />
                    Loading ledgers...
                  </td>
                </tr>
              ) : paginatedLedgers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-ink-subtle">
                    No account ledgers found matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedLedgers.map((item, index) => (
                  <tr key={item.id} className="hover:bg-card-2/50 transition-colors">
                    <td className="px-3 py-1.5 text-xs text-ink-subtle">
                      {index + 1}
                    </td>
                    <td className="px-3 py-1.5 text-xs font-mono font-bold text-ink whitespace-nowrap">
                      {item.code}
                    </td>
                    <td className="px-3 py-1.5 text-xs font-bold text-ink">{item.name}</td>
                    <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getTypeBadgeClass(item.type)}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      <span className="flex items-center gap-1 text-ink-muted text-[11px]">
                        <FaFolder className="text-slate-500 text-[10px]" /> {item.group}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      {item.customer ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Customer: {item.customer.firmName} ({item.customer.customerCode})
                        </span>
                      ) : item.supplier ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                          Supplier: {item.supplier.legalName} ({item.supplier.supplierCode})
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-subtle italic">General System Ledger</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-center">
                      {item.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <FaCheckCircle className="text-emerald-500 text-[10px]" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-subtle bg-card-2 px-1.5 py-0.5 rounded border border-line">
                          <FaTimesCircle className="text-ink-subtle text-[10px]" /> Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* CREATE LEDGER MODAL - compact */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-card rounded-lg shadow-2xl max-w-md w-full overflow-hidden border border-line">
            <div className="px-3 py-2 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FaSitemap className="text-slate-300 text-sm" /> New Account Ledger
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-ink-subtle hover:text-white transition-colors"
              >
                <FaTimes size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateLedger} className="p-3">
              <div className="mb-2">
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  Ledger Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. ACC-1001"
                  className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink font-mono focus:outline-none focus:ring-1 focus:ring-slate-500/40 focus:border-slate-500"
                  required
                />
              </div>

              <div className="mb-2">
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  Account Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Office Stationery Expenses"
                  className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:outline-none focus:ring-1 focus:ring-slate-500/40 focus:border-slate-500"
                  required
                />
              </div>

              <div className="mb-2">
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  Ledger Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as any })
                  }
                  className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:outline-none focus:ring-1 focus:ring-slate-500/40 focus:border-slate-500"
                >
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="INCOME">INCOME</option>
                  <option value="EXPENSE">EXPENSE</option>
                  <option value="EQUITY">EQUITY</option>
                </select>
              </div>

              <div className="mb-2">
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={formData.group}
                  onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                  placeholder="e.g. Administrative Expenses, Bank Accounts"
                  className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:outline-none focus:ring-1 focus:ring-slate-500/40 focus:border-slate-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 mt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-card-2 rounded border border-line transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-800 rounded transition-all disabled:opacity-50"
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
