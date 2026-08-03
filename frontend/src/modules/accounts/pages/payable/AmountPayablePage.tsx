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

import { useSocketSync } from "../../../../hooks/useSocketSync";

export const AmountPayablePage: React.FC = () => {
  const navigate = useNavigate();
  const requestIdRef = React.useRef(0);

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
  const [payables, setPayables] = useState<SupplierPayableSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
        const res = await supplierService.fetchAll({ limit: 10 });
        const list = Array.isArray(res) ? res : (res?.suppliers || []);
        setSuppliersList(list);
      } catch (err) {
        console.error("Failed to load suppliers dropdown", err);
      }
    };
    loadSuppliers();
  }, []);

  const loadData = async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = await payableService.getPayableSummaries({
        asOnDate,
        startDate,
        endDate,
        supplierId,
        search,
        limit: 10,
      });
      if (reqId === requestIdRef.current) {
        const list = Array.isArray(res) ? res : res.data || [];
        setPayables(list);
      }
    } catch (err: any) {
      if (reqId === requestIdRef.current) {
        toast.error(err?.message || "Failed to load supplier payables");
      }
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [asOnDate, startDate, endDate, supplierId, search]);

  useSocketSync("voucher", undefined, loadData);
  useSocketSync("grnInvoice", undefined, loadData);
  useSocketSync("purchaseReturn", undefined, loadData);
  useSocketSync("supplier", undefined, loadData);

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

  const filteredSuppliers = useMemo(() => {
    return Array.isArray(payables) ? payables : [];
  }, [payables]);

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
      render: (item: any) => <span className="font-mono font-medium text-slate-700">{item.supplierCode}</span>,
    },
    {
      id: "supplier",
      header: "SUPPLIER",
      render: (item: any) => (
        <div>
          <div className="font-bold text-slate-900">{item.legalName}</div>
          {item.gstin && <div className="text-[10px] text-slate-400 font-mono">GST: {item.gstin}</div>}
        </div>
      ),
    },
    {
      id: "invoiced",
      header: "INVOICED",
      render: (item: any) => (
        <div className="text-right font-mono text-slate-700">
          ₹{(item.totalBilled || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: "paid",
      header: "PAID",
      render: (item: any) => (
        <div className="text-right font-mono text-slate-700">
          ₹{(item.totalPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: "debit",
      header: "DEBIT",
      render: (item: any) => (
        <div className="text-right font-mono text-slate-700">
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
        <div className="text-right font-mono font-bold text-slate-900">
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
        <div className="text-center font-mono text-xs text-slate-600">
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
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs transition-colors border border-blue-200 shadow-sm"
        >
          View Breakdown <FaChevronRight size={10} />
        </button>
      ),
    },
  ];

  // Pagination state (10 items per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Reset to page 1 when filters or data change
  useEffect(() => {
    setCurrentPage(1);
  }, [asOnDate, startDate, endDate, supplierId, search]);

  const totalPages = Math.ceil(filteredSuppliers.length / pageSize) || 1;
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSuppliers.slice(start, start + pageSize);
  }, [filteredSuppliers, currentPage]);

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

        {/* DASHBOARD CARDS */}
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
              <div className="text-xs text-slate-500 mt-1">Cumulative Purchases</div>
            </div>
          </div>
        </div>

        {/* REPORT FILTERS CONTROL PANEL */}
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">As On Date</label>
              <DatePickerCalendar
                name="draftAsOnDate"
                value={draftAsOnDate}
                onChange={(e) => setDraftAsOnDate(e.target.value)}
              />
            </div>

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

        {/* DATA TABLE WITH 10 ITEMS PAGINATION */}
        <DataTable
          columns={tableColumns.filter(c => visibleColumns.includes(c.id))}
          data={paginatedSuppliers}
          rowKey={(item: any) => item.supplierId}
          loading={loading}
          emptyMessage="No supplier payables matching the selected filter criteria."
          pagination={{
            currentPage,
            totalPages,
            onPageChange: setCurrentPage,
          }}
        />
      </div>
    </div>
  );
};

export default AmountPayablePage;
