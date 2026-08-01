import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaFileInvoice,
  FaHistory,
  FaList,
  FaSync,
  FaBuilding,
  FaMoneyBillWave,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCalendarAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import ColumnToggle from "../../../../components/ui/ColumnToggle/ColumnToggle";
import type { DataTableColumn } from "../../../../components/ui/table/DataTable";
import DataTable from "../../../../components/ui/table/DataTable";
import { DATE_RANGE_OPTIONS } from "../../../../constants/selectOption";
import { payableService, type SupplierPayableDetail } from "../../../../services/payableService";

export const SupplierBreakdownPage: React.FC = () => {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();

  // Applied filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Draft filter state for Apply / Clear All
  const [draftStartDate, setDraftStartDate] = useState<string>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<string>(endDate);
  const [dateRangePreset, setDateRangePreset] = useState<string>("custom");

  const [supplierDetail, setSupplierDetail] = useState<SupplierPayableDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "statement">("invoices");

  // Columns & Column Toggle for Invoices tab
  const DEFAULT_INVOICE_COLUMNS = [
    "#",
    "INVOICE NO",
    "DATE",
    "DUE DATE",
    "INVOICE AMOUNT",
    "PAID AMOUNT",
    "OUTSTANDING",
    "STATUS"
  ];

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("supplierBreakdownVisibleColumns");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_INVOICE_COLUMNS;
      }
    }
    return DEFAULT_INVOICE_COLUMNS;
  });

  useEffect(() => {
    localStorage.setItem("supplierBreakdownVisibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const loadData = async () => {
    if (!supplierId) return;
    setLoading(true);
    try {
      const data = await payableService.getSupplierPayableDetail(parseInt(supplierId, 10), {
        startDate,
        endDate,
      });
      setSupplierDetail(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load supplier breakdown statement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supplierId, startDate, endDate]);

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
  };

  const handleClearFilters = () => {
    setDraftStartDate("");
    setDraftEndDate("");
    setDateRangePreset("custom");
    setStartDate("");
    setEndDate("");
  };

  // CSV Export Configuration based on active tab
  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    if (!supplierDetail) return { csvData: [], csvColumns: [], csvFilename: "Supplier_Statement.csv" };

    const legalName = supplierDetail.supplier?.legalName || "Supplier";

    if (activeTab === "invoices") {
      return {
        csvData: supplierDetail.invoices || [],
        csvColumns: [
          { header: "Invoice No", accessor: (item: any) => item.invoiceNo },
          { header: "Date", accessor: (item: any) => item.date },
          { header: "Due Date", accessor: (item: any) => item.dueDate || "-" },
          { header: "Invoice Amount", accessor: (item: any) => item.amount },
          { header: "Paid Amount", accessor: (item: any) => item.paidAmount },
          { header: "Outstanding", accessor: (item: any) => item.balance },
          { header: "Status", accessor: (item: any) => item.status },
        ],
        csvFilename: `${legalName}_Invoices_${new Date().toISOString().split("T")[0]}.csv`,
      };
    } else if (activeTab === "payments") {
      return {
        csvData: supplierDetail.paymentHistory || [],
        csvColumns: [
          { header: "Voucher No", accessor: (item: any) => item.voucherNo },
          { header: "Date", accessor: (item: any) => item.date },
          { header: "Payment Mode", accessor: (item: any) => item.paymentMode || "General" },
          { header: "Amount Paid", accessor: (item: any) => item.amount },
          { header: "Reference No", accessor: (item: any) => item.referenceNo || "-" },
          { header: "Narration", accessor: (item: any) => item.narration || "-" },
        ],
        csvFilename: `${legalName}_Payments_${new Date().toISOString().split("T")[0]}.csv`,
      };
    } else {
      return {
        csvData: supplierDetail.statementEntries || [],
        csvColumns: [
          { header: "Date", accessor: (item: any) => item.date },
          { header: "Voucher No", accessor: (item: any) => item.voucherNo },
          { header: "Particulars", accessor: (item: any) => item.particulars },
          { header: "Debit (Dr)", accessor: (item: any) => item.debit },
          { header: "Credit (Cr)", accessor: (item: any) => item.credit },
          { header: "Running Balance", accessor: (item: any) => item.runningBalance },
        ],
        csvFilename: `${legalName}_Ledger_Statement_${new Date().toISOString().split("T")[0]}.csv`,
      };
    }
  }, [supplierDetail, activeTab]);

  // Invoice Table Columns
  const invoiceColumns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "50px",
      render: (_item, index) => index + 1,
    },
    {
      header: "INVOICE NO",
      render: (item: any) => <span className="font-mono font-bold text-slate-900">{item.invoiceNo}</span>,
    },
    {
      header: "DATE",
      render: (item: any) => <span className="text-slate-600 font-mono">{item.date}</span>,
    },
    {
      header: "DUE DATE",
      render: (item: any) => <span className="text-slate-500 font-mono">{item.dueDate || "-"}</span>,
    },
    {
      header: "INVOICE AMOUNT",
      render: (item: any) => (
        <div className="text-right font-mono font-bold text-slate-900">
          ₹ {item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "PAID AMOUNT",
      render: (item: any) => (
        <div className="text-right font-mono font-bold text-emerald-600">
          ₹ {item.paidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "OUTSTANDING",
      render: (item: any) => (
        <div className="text-right font-mono font-bold text-blue-600">
          ₹ {item.balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "STATUS",
      render: (item: any) => (
        <div className="text-center">
          <span
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              item.status === "PAID"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : item.status === "PARTIAL"
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : "bg-red-100 text-red-800 border border-red-300"
            }`}
          >
            {item.status}
          </span>
        </div>
      ),
    },
  ];

  // Payment Table Columns
  const paymentColumns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "50px",
      render: (_item, index) => index + 1,
    },
    {
      header: "VOUCHER / REF NO",
      render: (item: any) => <span className="font-mono font-bold text-slate-900">{item.voucherNo}</span>,
    },
    {
      header: "DATE",
      render: (item: any) => <span className="text-slate-600 font-mono">{item.date}</span>,
    },
    {
      header: "PAYMENT MODE",
      render: (item: any) => (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {item.paymentMode || "General"}
        </span>
      ),
    },
    {
      header: "AMOUNT PAID",
      render: (item: any) => (
        <div className="text-right font-mono font-bold text-emerald-600">
          ₹ {item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "NARRATION",
      render: (item: any) => <span className="text-slate-600 text-xs">{item.narration || "-"}</span>,
    },
  ];

  // Statement Table Columns
  const statementColumns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "50px",
      render: (_item, index) => index + 1,
    },
    {
      header: "DATE",
      render: (item: any) => <span className="text-slate-600 font-mono">{item.date}</span>,
    },
    {
      header: "VOUCHER NO",
      render: (item: any) => <span className="font-mono font-bold text-slate-900">{item.voucherNo}</span>,
    },
    {
      header: "PARTICULARS",
      render: (item: any) => <span className="text-slate-800 text-xs font-medium">{item.particulars}</span>,
    },
    {
      header: "DEBIT (DR)",
      render: (item: any) => (
        <div className="text-right font-mono text-slate-700">
          {item.debit > 0 ? `₹ ${item.debit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
        </div>
      ),
    },
    {
      header: "CREDIT (CR)",
      render: (item: any) => (
        <div className="text-right font-mono text-slate-700">
          {item.credit > 0 ? `₹ ${item.credit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
        </div>
      ),
    },
    {
      header: "RUNNING BALANCE",
      render: (item: any) => (
        <div className="text-right font-mono font-bold text-blue-600">
          ₹ {item.runningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      {/* HEADER SECTION MATCHING AMOUNT PAYABLE PAGE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/accounts/payable")}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors border border-slate-300 shadow-sm"
              >
                <FaArrowLeft size={10} /> Back to Amount Payable
              </button>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wider border border-blue-200">
                Supplier Statement
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mt-2 flex items-center gap-2">
              <FaBuilding className="text-blue-600 text-xl" />
              {supplierDetail?.supplier.legalName || "Supplier Breakdown"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Supplier Code: <strong className="font-mono text-slate-700">{supplierDetail?.supplier.supplierCode || "-"}</strong>
              {supplierDetail?.supplier.gstin && (
                <> | GSTIN: <strong className="font-mono text-slate-700">{supplierDetail.supplier.gstin}</strong></>
              )}
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

        {/* KPI METRIC CARDS */}
        {supplierDetail && (
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Opening Balance</span>
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                    <FaMoneyBillWave size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  ₹ {supplierDetail.summary.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 mt-1">Starting Account Liability</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Invoiced</span>
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <FaBuilding size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  ₹ {supplierDetail.summary.totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 mt-1">Total GRN Bills Posted</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Paid</span>
                  <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <FaCheckCircle size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                  ₹ {supplierDetail.summary.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 mt-1">Payments Settled to Date</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Closing Outstanding</span>
                  <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                    <FaExclamationTriangle size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-blue-600 mt-2 font-mono">
                  ₹ {supplierDetail.summary.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-500 mt-1">Net Balance Outstanding</div>
              </div>
            </div>
          </div>
        )}

        {/* REPORT FILTERS CONTROL PANEL */}
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
            <div>
              {activeTab === "invoices" && (
                <ColumnToggle
                  columns={invoiceColumns}
                  visibleColumns={visibleColumns}
                  setVisibleColumns={setVisibleColumns}
                />
              )}
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

        {/* TABS & DATA TABLE SECTION */}
        <div className="p-6 space-y-6">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200">
            <button
              onClick={() => setActiveTab("invoices")}
              className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-colors ${
                activeTab === "invoices"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FaFileInvoice /> Invoice Breakdown ({supplierDetail?.invoices?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-colors ${
                activeTab === "payments"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FaHistory /> Payment History ({supplierDetail?.paymentHistory?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("statement")}
              className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-colors ${
                activeTab === "statement"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FaList /> Account Ledger Statement ({supplierDetail?.statementEntries?.length || 0})
            </button>
          </div>

          {/* TAB 1: INVOICES BREAKDOWN */}
          {activeTab === "invoices" && (
            <DataTable
              columns={invoiceColumns.filter(c => typeof c.header === 'string' && visibleColumns.includes(c.header))}
              data={supplierDetail?.invoices || []}
              rowKey={(item: any) => item.id}
              loading={loading}
              emptyMessage="No purchase invoices recorded for this supplier."
            />
          )}

          {/* TAB 2: PAYMENT HISTORY */}
          {activeTab === "payments" && (
            <DataTable
              columns={paymentColumns}
              data={supplierDetail?.paymentHistory || []}
              rowKey={(item: any) => item.id}
              loading={loading}
              emptyMessage="No payment vouchers recorded for this supplier."
            />
          )}

          {/* TAB 3: ACCOUNT LEDGER STATEMENT */}
          {activeTab === "statement" && (
            <DataTable
              columns={statementColumns}
              data={supplierDetail?.statementEntries || []}
              rowKey={(item: any) => item.id}
              loading={loading}
              emptyMessage="No ledger statement entries recorded for this supplier."
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierBreakdownPage;
