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

import { useSocketSync } from "../../../../hooks/useSocketSync";

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

  // 10-item Pagination state per tab
  const [invoicePage, setInvoicePage] = useState<number>(1);
  const [paymentPage, setPaymentPage] = useState<number>(1);
  const [statementPage, setStatementPage] = useState<number>(1);
  const breakdownPageSize = 10;

  useEffect(() => {
    setInvoicePage(1);
    setPaymentPage(1);
    setStatementPage(1);
  }, [startDate, endDate, activeTab]);

  const invoices = supplierDetail?.invoices || [];
  const invoiceTotalPages = Math.ceil(invoices.length / breakdownPageSize) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (invoicePage - 1) * breakdownPageSize;
    return invoices.slice(start, start + breakdownPageSize);
  }, [invoices, invoicePage]);

  const payments = supplierDetail?.paymentHistory || [];
  const paymentTotalPages = Math.ceil(payments.length / breakdownPageSize) || 1;
  const paginatedPayments = useMemo(() => {
    const start = (paymentPage - 1) * breakdownPageSize;
    return payments.slice(start, start + breakdownPageSize);
  }, [payments, paymentPage]);

  const statements = supplierDetail?.statementEntries || [];
  const statementTotalPages = Math.ceil(statements.length / breakdownPageSize) || 1;
  const paginatedStatements = useMemo(() => {
    const start = (statementPage - 1) * breakdownPageSize;
    return statements.slice(start, start + breakdownPageSize);
  }, [statements, statementPage]);

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
        <div className="text-right font-mono font-semibold text-ink">
          ₹ {item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "PAID AMOUNT",
      render: (item: any) => (
        <div className="text-right font-mono font-semibold text-emerald-600">
          ₹ {item.paidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "OUTSTANDING",
      render: (item: any) => (
        <div className="text-right font-mono font-semibold text-orange-600">
          ₹ {item.balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "STATUS",
      render: (item: any) => (
        <div className="text-center">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
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
      render: (item: any) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-ink">{item.voucherNo}</span>
          {item.postedToLedger === false && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
              Not posted
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
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-card-2 text-ink-muted border border-line">
          {item.paymentMode || "General"}
        </span>
      ),
    },
    {
      header: "AMOUNT PAID",
      render: (item: any) => (
        <div className="text-right font-mono font-semibold text-emerald-600">
          ₹ {item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "REFERENCE NO",
      render: (item: any) => <span className="text-ink-muted font-mono text-[11px]">{item.referenceNo || "-"}</span>,
    },
    {
      header: "NARRATION",
      render: (item: any) => <span className="text-ink-muted text-[11px]">{item.narration || "-"}</span>,
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
      render: (item: any) => <span className="text-ink text-[11px] font-medium">{item.particulars}</span>,
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
        <div className="text-right font-mono font-semibold text-orange-600">
          ₹ {item.runningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
  ];

  return (
    <div className="p-3 space-y-3 bg-card-2 min-h-screen font-sans text-ink">
      {/* COMPACT HEADER + FILTERS */}
      <div className="bg-card rounded-lg border border-line">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate("/accounts/payable")}
              className="inline-flex items-center gap-1 px-2 py-1 bg-card-2 hover:bg-line text-ink-muted font-semibold rounded text-[11px] transition-colors border border-line shrink-0"
            >
              <FaArrowLeft size={9} /> Back
            </button>
            <h1 className="text-sm font-bold text-ink flex items-center gap-2 min-w-0 truncate">
              <FaBuilding className="text-orange-600 text-sm shrink-0" />
              <span className="truncate">{supplierDetail?.supplier.legalName || "Supplier Breakdown"}</span>
            </h1>
            {supplierDetail?.supplier.supplierCode && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded font-mono uppercase tracking-wide shrink-0">
                {supplierDetail.supplier.supplierCode}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-card-2 hover:bg-line text-ink-muted rounded text-xs font-semibold transition-all border border-line"
              title="Refresh"
            >
              <FaSync className={loading ? "animate-spin text-orange-600" : ""} /> Refresh
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

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            {activeTab === "invoices" && (
              <ColumnToggle
                columns={invoiceColumns}
                visibleColumns={visibleColumns}
                setVisibleColumns={setVisibleColumns}
              />
            )}
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
      {supplierDetail && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-card border border-line rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Opening</span>
              <FaMoneyBillWave className="text-ink-muted text-xs" />
            </div>
            <div className="text-lg font-mono font-bold text-ink mt-1">
              ₹ {supplierDetail.summary.openingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-ink-subtle mt-0.5">Starting liability</div>
          </div>

          <div className="bg-card border border-line rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Invoiced</span>
              <FaBuilding className="text-orange-600 text-xs" />
            </div>
            <div className="text-lg font-mono font-bold text-ink mt-1">
              ₹ {supplierDetail.summary.totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-ink-subtle mt-0.5">GRN bills posted</div>
          </div>

          <div className="bg-card border border-line rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Paid</span>
              <FaCheckCircle className="text-emerald-600 text-xs" />
            </div>
            <div className="text-lg font-mono font-bold text-emerald-600 mt-1">
              ₹ {supplierDetail.summary.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-ink-subtle mt-0.5">Payments settled</div>
          </div>

          <div className="bg-card border border-line rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Outstanding</span>
              <FaExclamationTriangle className="text-amber-600 text-xs" />
            </div>
            <div className="text-lg font-mono font-bold text-orange-600 mt-1">
              ₹ {supplierDetail.summary.closingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-ink-subtle mt-0.5">Net balance due</div>
          </div>
        </div>
      )}

      {/* TABS & TABLE */}
      <div className="bg-card rounded-lg border border-line overflow-hidden">
        <div className="flex items-center gap-1 border-b border-line bg-card-2 px-2">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`flex items-center gap-1.5 px-3 py-2 font-semibold text-xs border-b-2 transition-colors ${
              activeTab === "invoices"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-ink-subtle hover:text-ink"
            }`}
          >
            <FaFileInvoice className="text-[10px]" /> Invoices ({supplierDetail?.invoices?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`flex items-center gap-1.5 px-3 py-2 font-semibold text-xs border-b-2 transition-colors ${
              activeTab === "payments"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-ink-subtle hover:text-ink"
            }`}
          >
            <FaHistory className="text-[10px]" /> Payments ({supplierDetail?.paymentHistory?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("statement")}
            className={`flex items-center gap-1.5 px-3 py-2 font-semibold text-xs border-b-2 transition-colors ${
              activeTab === "statement"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-ink-subtle hover:text-ink"
            }`}
          >
            <FaList className="text-[10px]" /> Ledger ({supplierDetail?.statementEntries?.length || 0})
          </button>
        </div>

        {activeTab === "invoices" && (
          <DataTable
            columns={invoiceColumns.filter(c => typeof c.header === 'string' && visibleColumns.includes(c.header))}
            data={paginatedInvoices}
            rowKey={(item: any) => item.id}
            loading={loading}
            emptyMessage="No purchase invoices recorded for this supplier."
            pagination={{
              currentPage: invoicePage,
              totalPages: invoiceTotalPages,
              onPageChange: setInvoicePage,
            }}
          />
        )}

        {activeTab === "payments" && (
          <DataTable
            columns={paymentColumns}
            data={paginatedPayments}
            rowKey={(item: any) => item.id}
            loading={loading}
            emptyMessage="No payment vouchers recorded for this supplier."
            pagination={{
              currentPage: paymentPage,
              totalPages: paymentTotalPages,
              onPageChange: setPaymentPage,
            }}
          />
        )}

        {activeTab === "statement" && (
          <DataTable
            columns={statementColumns}
            data={paginatedStatements}
            rowKey={(item: any) => item.id}
            loading={loading}
            emptyMessage="No ledger statement entries recorded for this supplier."
            pagination={{
              currentPage: statementPage,
              totalPages: statementTotalPages,
              onPageChange: setStatementPage,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default SupplierBreakdownPage;
