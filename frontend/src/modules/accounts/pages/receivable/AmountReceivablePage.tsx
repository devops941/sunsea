import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUserFriends,
  FaSync,
  FaChevronRight,
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaCheckCircle,
} from "react-icons/fa";
import { toast } from "react-toastify";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import ColumnToggle from "../../../../components/ui/ColumnToggle/ColumnToggle";
import type { DataTableColumn } from "../../../../components/ui/table/DataTable";
import DataTable from "../../../../components/ui/table/DataTable";
import { DATE_RANGE_OPTIONS } from "../../../../constants/selectOption";
import { receivableService, type CustomerReceivableSummary } from "../../../../services/receivableService";
import { customerService } from "../../../../services/customerService";

import { useSocketSync } from "../../../../hooks/useSocketSync";

export const AmountReceivablePage: React.FC = () => {
  const navigate = useNavigate();

  // Applied filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [asOnDate, setAsOnDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Draft filter state for Apply / Clear All
  const [draftStartDate, setDraftStartDate] = useState<string>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<string>(endDate);
  const [dateRangePreset, setDateRangePreset] = useState<string>("custom");
  const [draftCustomerId, setDraftCustomerId] = useState<string>(customerId);
  const [draftSearch, setDraftSearch] = useState<string>(search);

  // Data & Loading state
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<CustomerReceivableSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Columns & Column Toggle
  const DEFAULT_COLUMNS = [
    "#",
    "CODE",
    "CUSTOMER",
    "INVOICED",
    "PAID",
    "DEBIT",
    "CREDIT",
    "NET BALANCE",
    "ACTION"
  ];

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("amountReceivableVisibleColumns");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_COLUMNS;
      }
    }
    return DEFAULT_COLUMNS;
  });

  useEffect(() => {
    localStorage.setItem("amountReceivableVisibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Load customers list for filter dropdown
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await customerService.fetchAll({ limit: 10 });
        const list = Array.isArray(res) ? res : (res?.customers || []);
        setCustomersList(list);
      } catch (err) {
        console.error("Failed to load customers dropdown", err);
      }
    };
    loadCustomers();
  }, []);

  // Fetch report data
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await receivableService.getReceivables({
        asOnDate,
        startDate,
        endDate,
        customerId,
        search,
        page: 1,
        limit: 10000,
      });
      setReceivables(data || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load customer receivables");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [asOnDate, startDate, endDate, customerId, search]);

  useSocketSync("voucher", undefined, loadData);
  useSocketSync("salesInvoice", undefined, loadData);
  useSocketSync("salesReturn", undefined, loadData);
  useSocketSync("customer", undefined, loadData);

  // Date range preset handler
  const handleDateRangeChange = (val: string) => {
    setDateRangePreset(val);
    if (val === "custom") return;

    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (val === "today") {
      // both today
    } else if (val === "yesterday") {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    } else if (val === "last_week") {
      start.setDate(today.getDate() - 7);
    } else if (val === "last_month") {
      start.setMonth(today.getMonth() - 1);
    } else if (val === "last_6_months") {
      start.setMonth(today.getMonth() - 6);
    } else if (val === "last_year") {
      start.setFullYear(today.getFullYear() - 1);
    }

    setDraftStartDate(start.toISOString().split("T")[0]);
    setDraftEndDate(end.toISOString().split("T")[0]);
  };

  const handleApplyFilters = () => {
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setCustomerId(draftCustomerId);
    setSearch(draftSearch);
  };

  const handleClearFilters = () => {
    setDraftStartDate("");
    setDraftEndDate("");
    setDateRangePreset("custom");
    setDraftCustomerId("");
    setDraftSearch("");

    setStartDate("");
    setEndDate("");
    setCustomerId("");
    setSearch("");
  };

  // Sort filter state
  const [sortBy, setSortBy] = useState<string>("activity"); // activity | balance | name | overdue

  const filteredCustomers = useMemo(() => {
    const list = Array.isArray(receivables) ? [...receivables] : [];
    if (sortBy === "activity") {
      // Customers with sales/receipts first, then by balance desc
      list.sort((a, b) => {
        const aAct = (a.totalBilled || 0) + (a.totalPaid || 0);
        const bAct = (b.totalBilled || 0) + (b.totalPaid || 0);
        if (aAct !== bAct) return bAct - aAct;
        return (b.balanceAsOnDate || 0) - (a.balanceAsOnDate || 0);
      });
    } else if (sortBy === "balance") {
      list.sort((a, b) => (b.balanceAsOnDate || 0) - (a.balanceAsOnDate || 0));
    } else if (sortBy === "overdue") {
      list.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return (b.overdueAmount || 0) - (a.overdueAmount || 0);
      });
    } else if (sortBy === "name") {
      list.sort((a, b) => (a.firmName || "").localeCompare(b.firmName || ""));
    }
    return list;
  }, [receivables, sortBy]);

  // Dashboard Totals
  const totals = useMemo(() => {
    return filteredCustomers.reduce(
      (acc, curr) => {
        const d = curr.debit !== undefined ? curr.debit : (curr.openingBalance || 0) + (curr.totalBilled || 0);
        const c = curr.credit !== undefined ? curr.credit : (curr.totalPaid || 0) + (curr.totalReturned || 0);
        acc.totalOpening += curr.openingBalance || 0;
        acc.totalBilled += curr.totalBilled || 0;
        acc.totalPaid += curr.totalPaid || 0;
        acc.totalDebit += d;
        acc.totalCredit += c;
        acc.totalNetBalance += curr.balanceAsOnDate || 0;
        if (curr.isOverdue) acc.overdueCount += 1;
        return acc;
      },
      { totalOpening: 0, totalBilled: 0, totalPaid: 0, totalDebit: 0, totalCredit: 0, totalNetBalance: 0, overdueCount: 0 }
    );
  }, [filteredCustomers]);

  // CSV Export dataset configuration
  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Customer Code", accessor: (item: any) => item.customerCode },
      { header: "Customer / Firm Name", accessor: (item: any) => item.firmName },
      { header: "Customer Type", accessor: (item: any) => item.customerType || "CUSTOMER" },
      { header: "GSTIN", accessor: (item: any) => item.gstin || "-" },
      { header: "Phone", accessor: (item: any) => item.phone || "-" },
      { header: "Opening Balance", accessor: (item: any) => item.openingBalance || 0 },
      { header: "Invoiced Amount", accessor: (item: any) => item.totalBilled || 0 },
      { header: "Paid / Received Amount", accessor: (item: any) => item.totalPaid || 0 },
      { header: "Returned Amount", accessor: (item: any) => item.totalReturned || 0 },
      { header: "Debit Amount", accessor: (item: any) => item.debit || 0 },
      { header: "Credit Amount", accessor: (item: any) => item.credit || 0 },
      { header: "Net Balance", accessor: (item: any) => item.balanceAsOnDate || 0 },
      { header: "Overdue Amount", accessor: (item: any) => item.overdueAmount || 0 },
      { header: "Is Overdue", accessor: (item: any) => (item.isOverdue ? "Yes" : "No") },
    ];

    return {
      csvData: filteredCustomers,
      csvColumns: columns,
      csvFilename: `Amount_Receivable_Report_${asOnDate}.csv`,
    };
  }, [filteredCustomers, asOnDate]);

  // Table Columns
  const tableColumns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "50px",
      render: (_item, index) => index + 1,
    },
    {
      header: "CODE",
      render: (item: any) => <span className="font-mono font-medium text-ink-muted">{item.customerCode}</span>,
    },
    {
      header: "CUSTOMER",
      render: (item: any) => (
        <div>
          <div className="font-bold text-ink">{item.firmName}</div>
          {item.gstin && <div className="text-[10px] text-ink-subtle font-mono">GST: {item.gstin}</div>}
        </div>
      ),
    },
    {
      header: "INVOICED",
      render: (item: any) => (
        <div className="text-right font-mono text-ink-muted">
          ₹{(item.totalBilled || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "PAID",
      render: (item: any) => (
        <div className="text-right font-mono text-ink-muted">
          ₹{(item.totalPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "DEBIT",
      render: (item: any) => (
        <div className="text-right font-mono font-semibold text-blue-700">
          ₹{(item.debit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "CREDIT",
      render: (item: any) => (
        <div className="text-right font-mono text-ink-muted">
          ₹{(item.credit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "NET BALANCE",
      render: (item: any) => (
        <div className="text-right font-mono font-semibold text-ink">
          ₹{item.balanceAsOnDate > 0
            ? item.balanceAsOnDate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "0.00"}
        </div>
      ),
    },
    {
      header: "ACTION",
      render: (item: any) => (
        <button
          onClick={() => navigate(`/accounts/receivable/${item.customerId}`)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded text-[11px] transition-colors border border-blue-200"
        >
          View <FaChevronRight size={8} />
        </button>
      ),
    },
  ];

  return (
    <div className="p-3 space-y-3 bg-card-2 min-h-screen font-sans text-ink">
      {/* COMPACT HEADER + FILTERS */}
      <div className="bg-card rounded-lg border border-line">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line">
          <h1 className="text-sm font-bold text-ink flex items-center gap-2">
            <FaUserFriends className="text-blue-600 text-sm" /> Amount Receivable
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded uppercase tracking-wide">
              A/R
            </span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold transition-all border border-line"
              title="Refresh"
            >
              <FaSync className={loading ? "animate-spin text-blue-600" : ""} /> Refresh
            </button>
            <ExportCSVButton
              data={csvData}
              columns={csvColumns}
              filename={csvFilename}
              text="Export"
            />
          </div>
        </div>

        {/* Filter Row - single compact row */}
        <div className="px-3 py-2 bg-card-2 flex flex-wrap items-end gap-2">
          <div className="w-[140px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Range</label>
            <SelectInput
              name="dateRangePreset"
              value={dateRangePreset}
              options={DATE_RANGE_OPTIONS}
              hideLabel={true}
              onChange={(e) => handleDateRangeChange(e.target.value)}
            />
          </div>

          <div className="w-[130px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">From</label>
            <DatePickerCalendar
              name="draftStartDate"
              value={draftStartDate}
              onChange={(e) => { setDraftStartDate(e.target.value); setDateRangePreset("custom"); }}
            />
          </div>

          <div className="w-[130px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">To</label>
            <DatePickerCalendar
              name="draftEndDate"
              value={draftEndDate}
              onChange={(e) => { setDraftEndDate(e.target.value); setDateRangePreset("custom"); }}
            />
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Search</label>
            <input
              type="text"
              className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 focus:outline-none"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              placeholder="Code / Name..."
            />
          </div>

          <div className="w-[160px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Customer</label>
            <SelectInput
              name="draftCustomerId"
              value={draftCustomerId}
              options={customersList.map(c => ({ label: c.firmName || c.displayName || c.customerCode, value: c.id }))}
              defaultOptionLabel="All Customers"
              hideLabel={true}
              searchable
              onChange={(e) => setDraftCustomerId(e.target.value)}
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
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* COMPACT KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-card border border-line rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Total Receivable</span>
            <FaMoneyBillWave className="text-blue-600 text-xs" />
          </div>
          <div className="text-lg font-mono font-bold text-ink mt-1">
            ₹ {totals.totalNetBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-ink-subtle mt-0.5">
            {filteredCustomers.length} customers
          </div>
        </div>

        <div className="bg-card border border-line rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Customers</span>
            <FaUserFriends className="text-indigo-600 text-xs" />
          </div>
          <div className="text-lg font-mono font-bold text-ink mt-1">{receivables.length}</div>
          <div className="text-[10px] text-ink-subtle mt-0.5">Registered accounts</div>
        </div>

        <div className="bg-card border border-line rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Overdue</span>
            <FaExclamationTriangle className="text-amber-600 text-xs" />
          </div>
          <div className="text-lg font-mono font-bold text-amber-600 mt-1">{totals.overdueCount}</div>
          <div className="text-[10px] text-ink-subtle mt-0.5">Exceeding terms</div>
        </div>

        <div className="bg-card border border-line rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Total Debit</span>
            <FaCheckCircle className="text-emerald-600 text-xs" />
          </div>
          <div className="text-lg font-mono font-bold text-ink mt-1">
            ₹ {totals.totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-ink-subtle mt-0.5">Opening + sales</div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-ink">Customer Receivables</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-1 border border-line rounded text-[11px] bg-card text-ink focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="activity">Recent Activity</option>
                <option value="balance">Highest Balance</option>
                <option value="overdue">Overdue First</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
            <ColumnToggle
              columns={tableColumns}
              visibleColumns={visibleColumns}
              setVisibleColumns={setVisibleColumns}
            />
            <span className="text-[11px] text-ink-subtle font-mono">Total: {filteredCustomers.length}</span>
          </div>
        </div>

        <DataTable
          columns={tableColumns.filter(c => typeof c.header === 'string' && visibleColumns.includes(c.header))}
          data={filteredCustomers}
          rowKey={(item: any) => item.customerId}
          loading={loading}
          emptyMessage="No customer receivables matching the selected filter criteria."
        />
      </div>
    </div>
  );
};

export default AmountReceivablePage;
