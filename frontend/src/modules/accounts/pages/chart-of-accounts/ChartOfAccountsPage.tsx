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
import { useListCache, prependToListCacheByPrefix } from "../../../../hooks/useListCache";

export const ChartOfAccountsPage: React.FC = () => {
  // Applied filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Draft filter state for Apply / Clear All
  const [draftSearchTerm, setDraftSearchTerm] = useState<string>(searchTerm);
  const [draftSelectedType, setDraftSelectedType] = useState<string>(selectedType);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

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
      const created = await accountService.createLedger({
        code: formData.code,
        name: formData.name,
        type: formData.type,
        group: formData.group,
        isActive: true,
      });
      // Optimistic list update — new ledger appears instantly.
      if (created?.id) {
        prependToListCacheByPrefix<AccountLedger>("accounts:chart-of-accounts", created);
      }
      toast.success("Account ledger created successfully");
      setShowModal(false);
      setFormData({ code: "", name: "", type: "ASSET", group: "" });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create ledger");
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "ASSET":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "LIABILITY":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "INCOME":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "EXPENSE":
        return "bg-rose-500/10 text-rose-600 border-rose-500/20";
      case "EQUITY":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
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

  // Sidebar summary counts (from FULL ledger list, not filtered — user wants
  // an at-a-glance picture of the whole chart of accounts).
  const summary = useMemo(() => {
    const s = {
      total: ledgers.length,
      active: 0,
      inactive: 0,
      groups: new Set<string>(),
      byType: { ASSET: 0, LIABILITY: 0, INCOME: 0, EXPENSE: 0, EQUITY: 0 } as Record<string, number>,
    };
    for (const l of ledgers) {
      if (l.isActive) s.active++; else s.inactive++;
      if (l.group) s.groups.add(l.group);
      if (s.byType[l.type] !== undefined) s.byType[l.type]++;
    }
    return {
      total: s.total,
      active: s.active,
      inactive: s.inactive,
      groupsCount: s.groups.size,
      byType: s.byType,
    };
  }, [ledgers]);

  return (
    <div className="flex gap-3 w-full items-start font-sans text-ink">
      <div className="flex-1 space-y-2 min-w-0 max-w-7xl">

        {/* Single-row header — filters + actions */}
        <div className="bg-card rounded-md border border-line shadow-sm px-3 py-2 flex flex-wrap items-end gap-2">
          <div className="w-[220px]">
            
            <div className="relative">
              <input
                type="text"
                className="w-full border border-line bg-card rounded pl-7 pr-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-slate-500/40 focus:border-slate-500"
                value={draftSearchTerm}
                onChange={(e) => setDraftSearchTerm(e.target.value)}
                placeholder="Code / name / group..."
              />
              <FaSearch className="absolute left-2.5 top-2.5 text-ink-subtle text-[10px]" />
            </div>
          </div>

          <div className="w-[180px]">
            
            <SelectInput
              name="draftSelectedType"
              value={draftSelectedType}
              options={[
                { label: "All Account Types", value: "ALL" },
                { label: "Asset Accounts", value: "ASSET" },
                { label: "Liability Accounts", value: "LIABILITY" },
                { label: "Income Accounts", value: "INCOME" },
                { label: "Expense Accounts", value: "EXPENSE" },
                { label: "Equity Accounts", value: "EQUITY" },
              ]}
              hideLabel
              searchable={false}
              onChange={(e) => setDraftSelectedType(e.target.value)}
            />
          </div>

          <button
            onClick={handleClearFilters}
            className="px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-card rounded border border-line"
          >
            Clear
          </button>
          <button
            onClick={handleApplyFilters}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-800 rounded"
          >
            Apply
          </button>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={refresh}
              className="flex items-center gap-1 px-2 py-1.5 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold border border-line"
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer"
            >
              <FaPlus className="text-[10px]" /> New Ledger
            </button>
          </div>
        </div>

        {/* Spreadsheet-style table (Busy density) */}
        <div
          className="bg-card border border-line rounded-md overflow-hidden shadow-sm flex flex-col"
          style={{ height: "calc(100vh - 200px)" }}
        >
          {/* Table toolbar */}
          <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between gap-2 shrink-0">
            <h2 className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <FaSitemap className="text-slate-500 text-xs" /> Chart of Accounts
              {refreshing && <FaSync className="animate-spin text-slate-500 text-[10px]" />}
            </h2>
            <span className="text-[11px] text-ink-subtle font-mono">
              Total: {filteredLedgers.length}
            </span>
          </div>

          {filteredLedgers.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-subtle flex-1">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <FaSync className="animate-spin text-slate-500 text-[10px]" />
                  Loading chart of accounts…
                </span>
              ) : (
                "No account ledgers found matching criteria."
              )}
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-[11px] text-ink-muted border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-card-2 text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                    <th className="px-2 py-1.5 border-r border-line w-10 text-center">#</th>
                    <th className="px-2 py-1.5 border-r border-line w-28">Code</th>
                    <th className="px-2 py-1.5 border-r border-line">Account Name</th>
                    <th className="px-2 py-1.5 border-r border-line w-24 text-center">Type</th>
                    <th className="px-2 py-1.5 border-r border-line w-52">Group</th>
                    <th className="px-2 py-1.5 border-r border-line">Linked Party / System</th>
                    <th className="px-2 py-1.5 w-20 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedgers.map((item, rowIdx) => {
                    const isSelected = selectedRow === item.id;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedRow(item.id)}
                        className={`border-b border-line-soft cursor-pointer ${
                          isSelected
                            ? "bg-slate-500/20 text-ink"
                            : rowIdx % 2 === 0
                              ? "hover:bg-card-2/70"
                              : "bg-card-2/20 hover:bg-card-2/70"
                        }`}
                      >
                        <td className="px-2 py-1 border-r border-line-soft text-center font-mono text-[11px] text-ink-subtle">
                          {rowIdx + 1}
                        </td>
                        <td className="px-2 py-1 border-r border-line-soft font-mono font-bold text-ink whitespace-nowrap">
                          {item.code}
                        </td>
                        <td className="px-2 py-1 border-r border-line-soft font-semibold text-ink">
                          {item.name}
                        </td>
                        <td className="px-2 py-1 border-r border-line-soft text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${getTypeBadgeClass(item.type)}`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-2 py-1 border-r border-line-soft">
                          <span className="flex items-center gap-1 text-ink-muted text-[11px]">
                            <FaFolder className="text-slate-500 text-[9px] shrink-0" /> {item.group}
                          </span>
                        </td>
                        <td className="px-2 py-1 border-r border-line-soft">
                          {item.customer ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              Customer: {item.customer.firmName} ({item.customer.customerCode})
                            </span>
                          ) : item.supplier ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              Supplier: {item.supplier.legalName} ({item.supplier.supplierCode})
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-subtle italic">General System Ledger</span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-center">
                          {item.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              <FaCheckCircle className="text-[9px]" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-subtle bg-card-2 px-1.5 py-0.5 rounded border border-line">
                              <FaTimesCircle className="text-[9px]" /> Inactive
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Busy-style empty filler rows */}
                  {Array.from({ length: Math.max(0, 25 - filteredLedgers.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-line-soft">
                      <td className="px-2 py-1 border-r border-line-soft">&nbsp;</td>
                      <td className="px-2 py-1 border-r border-line-soft"></td>
                      <td className="px-2 py-1 border-r border-line-soft"></td>
                      <td className="px-2 py-1 border-r border-line-soft"></td>
                      <td className="px-2 py-1 border-r border-line-soft"></td>
                      <td className="px-2 py-1 border-r border-line-soft"></td>
                      <td className="px-2 py-1"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Busy-style status bar */}
          <div className="border-t border-line bg-card-2/60 px-3 py-1 flex items-center justify-between text-[10px] font-mono text-ink-subtle shrink-0">
            <div className="flex gap-4">
              <span>
                Entry No: <b className="text-ink">{filteredLedgers.length > 0 ? 1 : 0} / {filteredLedgers.length}</b>
              </span>
              <span>
                Row No: <b className="text-ink">
                  {selectedRow
                    ? filteredLedgers.findIndex((v) => v.id === selectedRow) + 1
                    : (filteredLedgers.length > 0 ? 1 : 0)}
                  {" / "}{filteredLedgers.length}
                </b>
              </span>
            </div>
            <div className="flex gap-3 uppercase tracking-wide">
              <span>Ledgers: <b className="text-ink">{ledgers.length}</b></span>
              <span>Groups: <b className="text-ink">{summary.groupsCount}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar — Summary. Amounts render on their own row so
         crores-scale values never squeeze the label or overflow the card. */}
      <aside className="w-[220px] shrink-0 bg-card border border-line rounded-md shadow-sm overflow-hidden self-start">
        <div className="px-3 py-1.5 bg-card-2 border-b border-line text-[11px] font-bold uppercase tracking-wide text-ink flex items-center gap-1.5">
          <FaSitemap className="text-slate-500 text-xs" /> Summary
        </div>
        <div className="divide-y divide-line-soft">
          <div className="px-3 py-2 bg-slate-500/5">
            <div className="text-[11px] font-semibold text-ink-muted mb-1">Total Ledgers</div>
            <div className="text-sm font-mono font-bold text-ink break-all leading-tight">
              {summary.total}
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[11px] font-semibold text-ink-muted mb-1">Active</div>
            <div className="text-sm font-mono font-bold text-emerald-600 break-all leading-tight">
              {summary.active}
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[11px] font-semibold text-ink-muted mb-1">Inactive</div>
            <div className="text-sm font-mono font-bold text-ink-subtle break-all leading-tight">
              {summary.inactive}
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[11px] font-semibold text-ink-muted mb-1">Groups</div>
            <div className="text-sm font-mono font-bold text-ink break-all leading-tight">
              {summary.groupsCount}
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[11px] font-semibold text-ink-muted mb-2">By Type</div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-emerald-600 font-semibold">Assets</span>
                <span className="font-mono font-bold text-ink">{summary.byType.ASSET}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-600 font-semibold">Liabilities</span>
                <span className="font-mono font-bold text-ink">{summary.byType.LIABILITY}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-600 font-semibold">Income</span>
                <span className="font-mono font-bold text-ink">{summary.byType.INCOME}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-rose-600 font-semibold">Expenses</span>
                <span className="font-mono font-bold text-ink">{summary.byType.EXPENSE}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-purple-600 font-semibold">Equity</span>
                <span className="font-mono font-bold text-ink">{summary.byType.EQUITY}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* CREATE LEDGER MODAL — Busy-compact */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
          <div className="bg-card rounded-md border border-line w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-3 py-1.5 border-b border-line bg-slate-700 text-white flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-2">
                <FaSitemap className="text-xs" /> New Account Ledger
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded cursor-pointer"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>

            <form onSubmit={handleCreateLedger} className="p-3 space-y-2">
              <div>
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  Ledger Code <span className="text-red-500">*</span>
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

              <div>
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  Account Name <span className="text-red-500">*</span>
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

              <div>
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  Ledger Type <span className="text-red-500">*</span>
                </label>
                <SelectInput
                  label="Ledger Type"
                  hideLabel
                  noMargin
                  required
                  searchable={false}
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  options={[
                    { value: "ASSET", label: "ASSET" },
                    { value: "LIABILITY", label: "LIABILITY" },
                    { value: "INCOME", label: "INCOME" },
                    { value: "EXPENSE", label: "EXPENSE" },
                    { value: "EQUITY", label: "EQUITY" },
                  ]}
                />
              </div>

              <div>
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                  Group Name <span className="text-red-500">*</span>
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

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-card-2 rounded border border-line disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-800 rounded disabled:opacity-50"
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
