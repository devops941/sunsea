import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBuilding,
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
import { payableService, type SupplierPayableSummary } from "../../../../services/payableService";
import { supplierService } from "../../../../services/supplierService";
import { useListCache } from "../../../../hooks/useListCache";

export const AmountPayablePage: React.FC = () => {
  const navigate = useNavigate();

  // Applied filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [asOnDate, setAsOnDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Draft filter state for Apply / Clear All
  const [draftAsOnDate, setDraftAsOnDate] = useState<string>(asOnDate);
  const [draftStartDate, setDraftStartDate] = useState<string>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<string>(endDate);
  const [dateRangePreset, setDateRangePreset] = useState<string>("custom");
  const [draftSupplierId, setDraftSupplierId] = useState<string>(supplierId);
  const [draftSearch, setDraftSearch] = useState<string>(search);

  // Data & Loading state
  const [suppliersList, setSuppliersList] = useState<any[]>([]);

  // Columns & Column Toggle by stable IDs
  const ALL_COLUMN_IDS = [
    "index",
    "code",
    "supplier",
    "invoiced",
    "paid",
    "debit",
    "credit",
    "netBalance",
    "dueDays",
    "action"
  ];

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("amountPayableVisibleColumns_v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((id: string) => ALL_COLUMN_IDS.includes(id));
          if (valid.length > 0) return valid;
        }
      } catch (e) {
        return ALL_COLUMN_IDS;
      }
    }
    return ALL_COLUMN_IDS;
  });

  useEffect(() => {
    localStorage.setItem("amountPayableVisibleColumns_v2", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Load suppliers list for filter dropdown
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const res = await supplierService.fetchAll({ limit: 10000 });
        const list = Array.isArray(res) ? res : (res?.suppliers || []);
        setSuppliersList(list);
      } catch (err) {
        console.error("Failed to load suppliers dropdown", err);
      }
    };
    loadSuppliers();
  }, []);

  const cacheKey = `accounts:amount-payable:${asOnDate}:${startDate}:${endDate}:${supplierId}:${search}`;

  const fetcher = useCallback(
    async (_signal: AbortSignal) => {
      try {
        const res = await payableService.getPayableSummaries({
          asOnDate,
          startDate,
          endDate,
          supplierId,
          search,
          page: 1,
          limit: 10000,
        });
        const list = Array.isArray(res) ? res : res.data || [];
        return { data: list, total: list.length };
      } catch (err: any) {
        toast.error(err?.message || "Failed to load supplier payables");
        throw err;
      }
    },
    [asOnDate, startDate, endDate, supplierId, search]
  );

  const { data: payables, loading, refreshing, refresh } = useListCache<SupplierPayableSummary>({
    cacheKey,
    socketModule: "voucher",
    fetcher,
  });

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
    setAsOnDate(draftAsOnDate);
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setSupplierId(draftSupplierId);
    setSearch(draftSearch);
  };

  const handleClearFilters = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    setDraftAsOnDate(todayStr);
    setDraftStartDate("");
    setDraftEndDate("");
    setDateRangePreset("custom");
    setDraftSupplierId("");
    setDraftSearch("");

    setAsOnDate(todayStr);
    setStartDate("");
    setEndDate("");
    setSupplierId("");
    setSearch("");
  };

  const [sortBy, setSortBy] = useState<string>("activity");

  const filteredSuppliers = useMemo(() => {
    const list = Array.isArray(payables) ? [...payables] : [];
    if (sortBy === "activity") {
      list.sort((a: any, b: any) => {
        const aAct = (a.totalBilled || 0) + (a.totalPaid || 0);
        const bAct = (b.totalBilled || 0) + (b.totalPaid || 0);
        if (aAct !== bAct) return bAct - aAct;
        return (b.balanceAsOnDate || 0) - (a.balanceAsOnDate || 0);
      });
    } else if (sortBy === "balance") {
      list.sort((a: any, b: any) => (b.balanceAsOnDate || 0) - (a.balanceAsOnDate || 0));
    } else if (sortBy === "overdue") {
      list.sort((a: any, b: any) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return (b.overdueAmount || 0) - (a.overdueAmount || 0);
      });
    } else if (sortBy === "name") {
      list.sort((a: any, b: any) => (a.legalName || "").localeCompare(b.legalName || ""));
    }
    return list;
  }, [payables, sortBy]);

  // Dashboard Totals
  const totals = useMemo(() => {
    return filteredSuppliers.reduce(
      (acc, curr) => {
        const d = curr.debit !== undefined ? curr.debit : (curr.totalPaid || 0) + (curr.totalReturned || 0);
        const c = curr.credit !== undefined ? curr.credit : (curr.totalBilled || 0);
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
  }, [filteredSuppliers]);

  // CSV Export dataset configuration
  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Supplier Code", accessor: (item: any) => item.supplierCode },
      { header: "Supplier Name", accessor: (item: any) => item.legalName },
      { header: "GSTIN", accessor: (item: any) => item.gstin || "-" },
      { header: "Phone", accessor: (item: any) => item.phone || "-" },
      { header: "Opening Balance", accessor: (item: any) => item.openingBalance || 0 },
      { header: "Invoiced Amount", accessor: (item: any) => item.totalBilled || 0 },
      { header: "Paid Amount", accessor: (item: any) => item.totalPaid || 0 },
      { header: "Returned Amount", accessor: (item: any) => item.totalReturned || 0 },
      { header: "Debit Amount", accessor: (item: any) => item.debit || 0 },
      { header: "Credit Amount", accessor: (item: any) => item.credit || 0 },
      { header: "Net Balance", accessor: (item: any) => item.balanceAsOnDate || 0 },
      { header: "Overdue Amount", accessor: (item: any) => item.overdueAmount || 0 },
      { header: "Is Overdue", accessor: (item: any) => (item.isOverdue ? "Yes" : "No") },
    ];

    return {
      csvData: filteredSuppliers,
      csvColumns: columns,
      csvFilename: `Amount_Payable_Report_${asOnDate}.csv`,
    };
  }, [filteredSuppliers, asOnDate]);

  // Table Columns with stable IDs
  const tableColumns: (DataTableColumn<SupplierPayableSummary> & { id: string })[] = [
    {
      id: "index",
      header: "#",
      width: "50px",
      render: (_item, index) => index + 1,
    },
    {
      id: "code",
      header: "CODE",
      render: (item: any) => <span className="font-mono font-medium text-ink-muted">{item.supplierCode}</span>,
    },
    {
      id: "supplier",
      header: "SUPPLIER",
      render: (item: any) => (
        <div>
          <div className="font-bold text-ink">{item.legalName}</div>
          {item.gstin && <div className="text-[10px] text-ink-subtle font-mono">GST: {item.gstin}</div>}
        </div>
      ),
    },
    {
      id: "invoiced",
      header: "INVOICED",
      render: (item: any) => (
        <div className="text-right font-mono text-ink-muted">
          ₹{(item.totalBilled || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: "paid",
      header: "PAID",
      render: (item: any) => (
        <div className="text-right font-mono text-ink-muted">
          ₹{(item.totalPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: "debit",
      header: "DEBIT",
      render: (item: any) => (
        <div className="text-right font-mono text-ink-muted">
          ₹{(item.debit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: "credit",
      header: "CREDIT",
      render: (item: any) => (
        <div className="text-right font-mono font-bold text-amber-800">
          ₹{(item.credit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: "netBalance",
      header: "NET BALANCE",
      render: (item: any) => (
        <div className="text-right font-mono font-bold text-ink">
          ₹{item.balanceAsOnDate > 0
            ? item.balanceAsOnDate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "0.00"}
        </div>
      ),
    },
    {
      id: "dueDays",
      header: "DUE DAYS",
      render: (item: any) => (
        <div className="text-center font-mono text-xs text-ink-muted">
          {item.dueDays !== null && item.dueDays !== undefined ? `${item.dueDays} d` : "—"}
        </div>
      ),
    },
    {
      id: "action",
      header: "ACTION",
      render: (item: any) => (
        <button
          onClick={() => navigate(`/accounts/payable/${item.supplierId}`)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold rounded text-[11px] transition-colors border border-orange-200"
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
            <FaBuilding className="text-orange-600 text-sm" /> Amount Payable
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded uppercase tracking-wide">
              A/P
            </span>
            {refreshing && <FaSync className="animate-spin text-orange-600 text-[10px]" />}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold transition-all border border-line"
              title="Refresh"
            >
              <FaSync className={refreshing ? "animate-spin text-orange-600" : ""} /> Refresh
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
          <div className="w-[130px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">As On</label>
            <DatePickerCalendar
              name="draftAsOnDate"
              value={draftAsOnDate}
              onChange={(e) => setDraftAsOnDate(e.target.value)}
            />
          </div>

          <div className="w-[130px]">
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

          <div className="w-full max-w-[320px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Search</label>
            <input
              type="text"
              className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500 focus:outline-none"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              placeholder="Code / Name..."
            />
          </div>

          <div className="w-[160px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Supplier</label>
            <SelectInput
              name="draftSupplierId"
              value={draftSupplierId}
              options={suppliersList.map(s => ({ label: s.legalName || s.displayName || s.supplierCode, value: s.id }))}
              defaultOptionLabel="All Suppliers"
              hideLabel={true}
              searchable
              onChange={(e) => setDraftSupplierId(e.target.value)}
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
              className="px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded transition-colors"
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
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Total Payable</span>
            <FaMoneyBillWave className="text-orange-600 text-xs" />
          </div>
          <div className="text-lg font-mono font-bold text-ink mt-1">
            ₹ {totals.totalNetBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-ink-subtle mt-0.5">
            {filteredSuppliers.length} suppliers
          </div>
        </div>

        <div className="bg-card border border-line rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Suppliers</span>
            <FaBuilding className="text-indigo-600 text-xs" />
          </div>
          <div className="text-lg font-mono font-bold text-ink mt-1">{payables.length}</div>
          <div className="text-[10px] text-ink-subtle mt-0.5">Registered vendors</div>
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
            <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Total Credit</span>
            <FaCheckCircle className="text-emerald-600 text-xs" />
          </div>
          <div className="text-lg font-mono font-bold text-ink mt-1">
            ₹ {totals.totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-ink-subtle mt-0.5">Cumulative purchases</div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-ink">Supplier Payables</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 py-1 border border-line rounded text-[11px] bg-card text-ink focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
              >
                <option value="activity">Recent Activity</option>
                <option value="balance">Highest Balance</option>
                <option value="overdue">Overdue First</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
            <ColumnToggle
              columns={tableColumns.map(c => ({ ...c, header: c.header }))}
              visibleColumns={visibleColumns.map(id => {
                const col = tableColumns.find(c => c.id === id);
                return col ? col.header : id;
              })}
              setVisibleColumns={(newHeaders) => {
                const updatedIds = newHeaders.map(h => tableColumns.find(c => c.header === h)?.id || h);
                setVisibleColumns(updatedIds);
              }}
            />
            <span className="text-[11px] text-ink-subtle font-mono">Total: {filteredSuppliers.length}</span>
          </div>
        </div>

        <DataTable
          columns={tableColumns.filter(c => visibleColumns.includes(c.id))}
          data={filteredSuppliers}
          rowKey={(item: any) => item.supplierId}
          loading={loading}
          emptyMessage="No supplier payables matching the selected filter criteria."
        />
      </div>
    </div>
  );
};

export default AmountPayablePage;
