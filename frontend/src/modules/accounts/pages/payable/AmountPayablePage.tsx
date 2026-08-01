import React, { useState, useEffect, useMemo } from "react";
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

export const AmountPayablePage: React.FC = () => {
  const navigate = useNavigate();

  // Applied filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [asOnDate, setAsOnDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Draft filter state for Apply / Clear All
  const [draftStartDate, setDraftStartDate] = useState<string>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<string>(endDate);
  const [dateRangePreset, setDateRangePreset] = useState<string>("custom");
  const [draftSupplierId, setDraftSupplierId] = useState<string>(supplierId);
  const [draftSearch, setDraftSearch] = useState<string>(search);

  // Data & Loading state
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [payables, setPayables] = useState<SupplierPayableSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Columns & Column Toggle
  const DEFAULT_COLUMNS = [
    "#",
    "CODE",
    "SUPPLIER",
    "INVOICED",
    "PAID",
    "DEBIT",
    "CREDIT",
    "NET BALANCE",
    "ACTION"
  ];

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("amountPayableVisibleColumns");
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
    localStorage.setItem("amountPayableVisibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Load suppliers list for filter dropdown
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const res = await supplierService.fetchAll({ limit: 1000 });
        const list = Array.isArray(res) ? res : (res?.suppliers || []);
        setSuppliersList(list);
      } catch (err) {
        console.error("Failed to load suppliers dropdown", err);
      }
    };
    loadSuppliers();
  }, []);

  // Fetch report data
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await payableService.getPayableSummaries({
        asOnDate,
        startDate,
        endDate,
        supplierId,
        search,
      });
      setPayables(data || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load supplier payables");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [asOnDate, startDate, endDate, supplierId, search]);

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
    setSupplierId(draftSupplierId);
    setSearch(draftSearch);
  };

  const handleClearFilters = () => {
    setDraftStartDate("");
    setDraftEndDate("");
    setDateRangePreset("custom");
    setDraftSupplierId("");
    setDraftSearch("");

    setStartDate("");
    setEndDate("");
    setSupplierId("");
    setSearch("");
  };

  const filteredSuppliers = useMemo(() => {
    return Array.isArray(payables) ? payables : [];
  }, [payables]);

  // Dashboard Totals
  const totals = useMemo(() => {
    return filteredSuppliers.reduce(
      (acc, curr) => {
        const d = curr.debit !== undefined ? curr.debit : (curr.totalPaid || 0) + (curr.totalReturned || 0);
        const c = curr.credit !== undefined ? curr.credit : (curr.openingBalance || 0) + (curr.totalBilled || 0);
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

  // Table Columns
  const tableColumns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "50px",
      render: (_item, index) => index + 1,
    },
    {
      header: "CODE",
      render: (item: any) => <span className="font-mono font-medium text-slate-700">{item.supplierCode}</span>,
    },
    {
      header: "SUPPLIER",
      render: (item: any) => (
        <div>
          <div className="font-bold text-slate-900">{item.legalName}</div>
          {item.gstin && <div className="text-[10px] text-slate-400 font-mono">GST: {item.gstin}</div>}
        </div>
      ),
    },
    {
      header: "INVOICED",
      render: (item: any) => (
        <div className="text-right font-mono text-slate-700">
          ₹{(item.totalBilled || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "PAID",
      render: (item: any) => (
        <div className="text-right font-mono text-slate-700">
          ₹{(item.totalPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "DEBIT",
      render: (item: any) => (
        <div className="text-right font-mono text-slate-700">
          ₹{(item.debit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "CREDIT",
      render: (item: any) => (
        <div className="text-right font-mono font-bold text-amber-800">
          ₹{(item.credit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "NET BALANCE",
      render: (item: any) => (
        <div className="text-right font-mono font-bold text-slate-900">
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
          onClick={() => navigate(`/accounts/payable/${item.supplierId}`)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs transition-colors border border-blue-200 shadow-sm"
        >
          View Breakdown <FaChevronRight size={10} />
        </button>
      ),
    },
  ];

  return (
    <div className="w-full p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      {/* HEADER SECTION MATCHING REPORTS CENTER */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wider border border-blue-200">
                Accounts Payable
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mt-1 flex items-center gap-2">
              <FaBuilding className="text-blue-600 text-xl" /> Amount Payable Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Outstanding Supplier Ledger Statements & Accounts Payable Breakdown
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-all border border-slate-300"
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
          </div>
        </div>

        {/* DASHBOARD CARDS (PRESERVED AS REQUESTED) */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Amount Payable</span>
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <FaMoneyBillWave size={18} />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                ₹ {totals.totalNetBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Across <strong className="text-slate-700">{filteredSuppliers.length}</strong> active suppliers
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Suppliers</span>
                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <FaBuilding size={18} />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{payables.length}</div>
              <div className="text-xs text-slate-500 mt-1">Registered Vendor Accounts</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overdue Accounts</span>
                <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                  <FaExclamationTriangle size={18} />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-600 mt-2">{totals.overdueCount}</div>
              <div className="text-xs text-amber-700/80 mt-1 font-medium">Exceeding payment terms</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Credit</span>
                <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <FaCheckCircle size={18} />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                ₹ {totals.totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-500 mt-1">Opening + Cumulative Purchases</div>
            </div>
          </div>
        </div>

        {/* REPORT FILTERS CONTROL PANEL (MATCHING SALES REPORT STYLE) */}
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Date Range</label>
              <SelectInput
                name="dateRangePreset"
                value={dateRangePreset}
                options={DATE_RANGE_OPTIONS}
                hideLabel={true}
                onChange={(e) => handleDateRangeChange(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Start Date</label>
              <DatePickerCalendar
                name="draftStartDate"
                value={draftStartDate}
                onChange={(e) => { setDraftStartDate(e.target.value); setDateRangePreset("custom"); }}
              />
            </div>

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">End Date</label>
              <DatePickerCalendar
                name="draftEndDate"
                value={draftEndDate}
                onChange={(e) => { setDraftEndDate(e.target.value); setDateRangePreset("custom"); }}
              />
            </div>

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Search</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Search Code / Name..."
              />
            </div>

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Supplier</label>
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
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
            <div>
              <ColumnToggle
                columns={tableColumns}
                visibleColumns={visibleColumns}
                setVisibleColumns={setVisibleColumns}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
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

        {/* DATA TABLE */}
        <DataTable
          columns={tableColumns.filter(c => typeof c.header === 'string' && visibleColumns.includes(c.header))}
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
