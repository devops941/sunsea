import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaFileInvoice,
  FaHistory,
  FaList,
  FaSync,
  FaUserFriends,
  FaMoneyBillWave,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import { toast } from "react-toastify";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import ColumnToggle from "../../../../components/ui/ColumnToggle/ColumnToggle";
import type { DataTableColumn } from "../../../../components/ui/table/DataTable";
import DataTable from "../../../../components/ui/table/DataTable";
import { DATE_RANGE_OPTIONS } from "../../../../constants/selectOption";
import { receivableService, type CustomerReceivableDetail } from "../../../../services/receivableService";

import { useSocketSync } from "../../../../hooks/useSocketSync";

export const CustomerBreakdownPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  // Applied filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Draft filter state for Apply / Clear All
  const [draftStartDate, setDraftStartDate] = useState<string>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<string>(endDate);
  const [dateRangePreset, setDateRangePreset] = useState<string>("custom");

  const [customerDetail, setCustomerDetail] = useState<CustomerReceivableDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"invoices" | "collections" | "statement">("invoices");

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
    const saved = localStorage.getItem("customerBreakdownVisibleColumns");
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
    localStorage.setItem("customerBreakdownVisibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const loadData = async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const data = await receivableService.getCustomerDetail(customerId, {
        startDate,
        endDate,
      });
      setCustomerDetail(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load customer breakdown statement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [customerId, startDate, endDate]);

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
    if (!customerDetail) return { csvData: [], csvColumns: [], csvFilename: "Customer_Statement.csv" };

    const firmName = customerDetail.customer?.firmName || "Customer";

    if (activeTab === "invoices") {
      return {
        csvData: customerDetail.invoices || [],
        csvColumns: [
          { header: "Invoice No", accessor: (item: any) => item.invoiceNo },
          { header: "Date", accessor: (item: any) => item.date },
          { header: "Due Date", accessor: (item: any) => item.dueDate || "-" },
          { header: "Invoice Amount", accessor: (item: any) => item.amount },
          { header: "Paid Amount", accessor: (item: any) => item.paidAmount },
          { header: "Outstanding", accessor: (item: any) => item.balance },
          { header: "Status", accessor: (item: any) => item.status },
        ],
        csvFilename: `${firmName}_Invoices_${new Date().toISOString().split("T")[0]}.csv`,
      };
    } else if (activeTab === "collections") {
      return {
        csvData: customerDetail.collectionHistory || [],
        csvColumns: [
          { header: "Voucher No", accessor: (item: any) => item.voucherNo },
          { header: "Date", accessor: (item: any) => item.date },
          { header: "Payment Mode", accessor: (item: any) => item.paymentMode || "General" },
          { header: "Amount Received", accessor: (item: any) => item.amount },
          { header: "Reference No", accessor: (item: any) => item.referenceNo || "-" },
          { header: "Narration", accessor: (item: any) => item.narration || "-" },
        ],
        csvFilename: `${firmName}_Collections_${new Date().toISOString().split("T")[0]}.csv`,
      };
    } else {
      return {
        csvData: customerDetail.statementEntries || [],
        csvColumns: [
          { header: "Date", accessor: (item: any) => item.date },
          { header: "Voucher No", accessor: (item: any) => item.voucherNo },
          { header: "Particulars", accessor: (item: any) => item.particulars },
          { header: "Debit (Dr)", accessor: (item: any) => item.debit },
          { header: "Credit (Cr)", accessor: (item: any) => item.credit },
          { header: "Running Balance", accessor: (item: any) => item.runningBalance },
        ],
        csvFilename: `${firmName}_Ledger_Statement_${new Date().toISOString().split("T")[0]}.csv`,
      };
    }
  }, [customerDetail, activeTab]);

  // Invoice Table Columns
  const invoiceColumns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "50px",
      render: (_item, index) => index + 1,
    },
    {
      header: "INVOICE NO",
      render: (item: any) => <span className="font-mono font-bold text-ink">{item.invoiceNo}</span>,
    },
    {
      header: "DATE",
      render: (item: any) => <span className="text-ink-muted font-mono">{item.date}</span>,
    },
    {
      header: "DUE DATE",
      render: (item: any) => <span className="text-ink-subtle font-mono">{item.dueDate || "-"}</span>,
    },
    {
      header: "INVOICE AMOUNT",
      render: (item: any) => (
        <div className="text-right font-mono font-bold text-ink">
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

  // Collection Table Columns
  const collectionColumns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "50px",
      render: (_item, index) => index + 1,
    },
    {
      header: "VOUCHER / REF NO",
      render: (item: any) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-ink">{item.voucherNo}</span>
          {item.postedToLedger === false && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
              Not posted to ledger
            </span>
          )}
        </div>
      ),
    },
    {
      header: "DATE",
      render: (item: any) => <span className="text-ink-muted font-mono">{item.date}</span>,
    },
    {
      header: "PAYMENT MODE",
      render: (item: any) => (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-card-2 text-ink-muted border border-line">
          {item.paymentMode || "General"}
        </span>
      ),
    },
    {
      header: "AMOUNT RECEIVED",
      render: (item: any) => (
        <div className="text-right font-mono font-bold text-emerald-600">
          ₹ {item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "NARRATION",
      render: (item: any) => <span className="text-ink-muted text-xs">{item.narration || "-"}</span>,
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
      render: (item: any) => <span className="text-ink-muted font-mono">{item.date}</span>,
    },
    {
      header: "VOUCHER NO",
      render: (item: any) => <span className="font-mono font-bold text-ink">{item.voucherNo}</span>,
    },
    {
      header: "PARTICULARS",
      render: (item: any) => <span className="text-ink text-xs font-medium">{item.particulars}</span>,
    },
    {
      header: "DEBIT (DR)",
      render: (item: any) => (
        <div className="text-right font-mono text-ink-muted">
          {item.debit > 0 ? `₹ ${item.debit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
        </div>
      ),
    },
    {
      header: "CREDIT (CR)",
      render: (item: any) => (
        <div className="text-right font-mono text-ink-muted">
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
    <div className="w-full p-4 md:p-6 bg-card-2 font-sans text-ink">
      {/* HEADER SECTION MATCHING AMOUNT RECEIVABLE PAGE */}
      <div className="bg-card rounded-2xl shadow-sm border border-line mb-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/accounts/receivable")}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-card-2 hover:bg-line text-ink-muted font-semibold rounded-lg text-xs transition-colors border border-line shadow-sm"
              >
                <FaArrowLeft size={10} /> Back to Amount Receivable
              </button>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wider border border-blue-200">
                Customer Statement
              </span>
            </div>
            <h2 className="text-2xl font-bold text-ink mt-2 flex items-center gap-2">
              <FaUserFriends className="text-blue-600 text-xl" />
              {customerDetail?.customer.firmName || "Customer Breakdown"}
            </h2>
            <p className="text-xs text-ink-subtle mt-1">
              Customer Code: <strong className="font-mono text-ink-muted">{customerDetail?.customer.customerCode || "-"}</strong>
              {customerDetail?.customer.gstin && (
                <> | GSTIN: <strong className="font-mono text-ink-muted">{customerDetail.customer.gstin}</strong></>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <button
              onClick={loadData}
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
          </div>
        </div>

        {/* KPI METRIC CARDS */}
        {customerDetail && (
          <div className="p-6 border-b border-line bg-card-2/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-card border border-line rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-subtle uppercase tracking-wider">Opening Balance</span>
                  <div className="w-9 h-9 rounded-full bg-card-2 flex items-center justify-center text-ink-muted">
                    <FaMoneyBillWave size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-ink mt-2 font-mono">
                  ₹ {customerDetail.summary.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-ink-subtle mt-1">Starting Account Receivable</div>
              </div>

              <div className="bg-card border border-line rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-subtle uppercase tracking-wider">Total Invoiced</span>
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <FaUserFriends size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-ink mt-2 font-mono">
                  ₹ {customerDetail.summary.totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-ink-subtle mt-1">Total Sales Invoices Posted</div>
              </div>

              <div className="bg-card border border-line rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-subtle uppercase tracking-wider">Total Received</span>
                  <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <FaCheckCircle size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                  ₹ {customerDetail.summary.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-ink-subtle mt-1">Receipt Collections Settled</div>
              </div>

              <div className="bg-card border border-line rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-subtle uppercase tracking-wider">Total Returned</span>
                  <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                    <FaMoneyBillWave size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-rose-600 mt-2 font-mono">
                  ₹ {(customerDetail.summary.totalReturned || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-ink-subtle mt-1">Sales Returns Credit Notes</div>
              </div>

              <div className="bg-card border border-line rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-subtle uppercase tracking-wider">Closing Outstanding</span>
                  <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                    <FaExclamationTriangle size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black text-blue-600 mt-2 font-mono">
                  ₹ {customerDetail.summary.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-ink-subtle mt-1">Net Outstanding Balance</div>
              </div>
            </div>
          </div>
        )}

        {/* REPORT FILTERS CONTROL PANEL */}
        <div className="p-6 border-b border-line bg-card-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Date Range</label>
              <SelectInput
                name="dateRangePreset"
                value={dateRangePreset}
                options={DATE_RANGE_OPTIONS}
                hideLabel={true}
                onChange={(e) => handleDateRangeChange(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Start Date</label>
              <DatePickerCalendar
                name="draftStartDate"
                value={draftStartDate}
                onChange={(e) => { setDraftStartDate(e.target.value); setDateRangePreset("custom"); }}
              />
            </div>

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">End Date</label>
              <DatePickerCalendar
                name="draftEndDate"
                value={draftEndDate}
                onChange={(e) => { setDraftEndDate(e.target.value); setDateRangePreset("custom"); }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-line">
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

        {/* TABS & DATA TABLE SECTION */}
        <div className="p-6 space-y-6">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-line">
            <button
              onClick={() => setActiveTab("invoices")}
              className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-colors ${
                activeTab === "invoices"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-ink-subtle hover:text-ink"
              }`}
            >
              <FaFileInvoice /> Invoice Breakdown ({customerDetail?.invoices?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("collections")}
              className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-colors ${
                activeTab === "collections"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-ink-subtle hover:text-ink"
              }`}
            >
              <FaHistory /> Collection History ({customerDetail?.collectionHistory?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("statement")}
              className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-colors ${
                activeTab === "statement"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-ink-subtle hover:text-ink"
              }`}
            >
              <FaList /> Account Ledger Statement ({customerDetail?.statementEntries?.length || 0})
            </button>
          </div>

          {/* TAB 1: INVOICES BREAKDOWN */}
          {activeTab === "invoices" && (
            <DataTable
              columns={invoiceColumns.filter(c => typeof c.header === 'string' && visibleColumns.includes(c.header))}
              data={customerDetail?.invoices || []}
              rowKey={(item: any) => item.id}
              loading={loading}
              emptyMessage="No sales invoices recorded for this customer."
            />
          )}

          {/* TAB 2: COLLECTION HISTORY */}
          {activeTab === "collections" && (
            <DataTable
              columns={collectionColumns}
              data={customerDetail?.collectionHistory || []}
              rowKey={(item: any) => item.id}
              loading={loading}
              emptyMessage="No receipt collection vouchers recorded for this customer."
            />
          )}

          {/* TAB 3: ACCOUNT LEDGER STATEMENT */}
          {activeTab === "statement" && (
            <DataTable
              columns={statementColumns}
              data={customerDetail?.statementEntries || []}
              rowKey={(item: any) => item.id}
              loading={loading}
              emptyMessage="No ledger statement entries recorded for this customer."
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerBreakdownPage;
