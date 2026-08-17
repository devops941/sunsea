import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaFileInvoiceDollar,
  FaSearch,
  FaFileDownload,
  FaCalendarAlt,
  FaEye,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaBuilding,
  FaReceipt,
  FaInfoCircle,
  FaSync
} from "react-icons/fa";
import { toast } from "react-toastify";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../../components/ui/ExportCSVButton/ExportCSVButton";
import { DATE_RANGE_OPTIONS } from "../../../../constants/selectOption";
import { voucherService, type Voucher, type VoucherType } from "../../../../services/voucherService";

import { useSocketSync } from "../../../../hooks/useSocketSync";

export const VoucherListPage: React.FC = () => {
  const navigate = useNavigate();

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Draft filter state for Apply / Clear All
  const [draftStartDate, setDraftStartDate] = useState<string>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<string>(endDate);
  const [dateRangePreset, setDateRangePreset] = useState<string>("custom");
  const [draftSearchTerm, setDraftSearchTerm] = useState<string>(searchTerm);

  // Modal State for View Details
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const res = await voucherService.fetchVouchers({
        type: typeFilter === "ALL" ? undefined : (typeFilter as VoucherType),
        search: searchTerm || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: pageSize,
      });
      setVouchers(res.vouchers || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load vouchers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVouchers();
  }, [typeFilter, startDate, endDate, searchTerm, page]);

  useSocketSync("voucher", undefined, loadVouchers);
  useSocketSync("payment", undefined, loadVouchers);
  useSocketSync("grnInvoice", undefined, loadVouchers);
  useSocketSync("salesInvoice", undefined, loadVouchers);

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
    setSearchTerm(draftSearchTerm);
    setPage(1);
  };

  const handleClearFilters = () => {
    setDraftStartDate("");
    setDraftEndDate("");
    setDateRangePreset("custom");
    setDraftSearchTerm("");

    setStartDate("");
    setEndDate("");
    setSearchTerm("");
    setPage(1);
  };

  const handleTypeChange = (t: string) => {
    setTypeFilter(t);
    setPage(1);
  };

  const openViewModal = (v: Voucher) => {
    setSelectedVoucher(v);
    setIsModalOpen(true);
  };

  const closeViewModal = () => {
    setSelectedVoucher(null);
    setIsModalOpen(false);
  };

  const renderStatusBadge = (statusStr?: string) => {
    const s = (statusStr || "POSTED").toUpperCase();
    if (s === "POSTED" || s === "CLOSED") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          POSTED
        </span>
      );
    }
    if (s === "DRAFT") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          DRAFT
        </span>
      );
    }
    if (s === "CANCELLED" || s === "VOID") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          CANCELLED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
        {s}
      </span>
    );
  };

  const getPartyName = (v: Voucher) => {
    if (v.refDoc?.supplierName && v.refDoc.supplierName !== "-") return v.refDoc.supplierName;
    if (v.refDoc?.customerName && v.refDoc.customerName !== "-") return v.refDoc.customerName;

    const debitParty = v.items.find(
      (i) => i.debitLedger && (i.debitLedger.group?.name === "Sundry Debtors" || i.debitLedger.group?.name === "Sundry Creditors")
    )?.debitLedger?.name;
    if (debitParty) return debitParty;

    const creditParty = v.items.find(
      (i) => i.creditLedger && (i.creditLedger.group?.name === "Sundry Debtors" || i.creditLedger.group?.name === "Sundry Creditors")
    )?.creditLedger?.name;
    if (creditParty) return creditParty;

    const firstDebit = v.items.find((i) => i.debitLedger)?.debitLedger?.name;
    const firstCredit = v.items.find((i) => i.creditLedger)?.creditLedger?.name;
    return firstDebit || firstCredit || "-";
  };

  const getGrnRef = (v: Voucher) => {
    if (v.refDoc?.grnNumber && v.refDoc.grnNumber !== "-") return v.refDoc.grnNumber;
    if (v.refDoc?.poNumber && v.refDoc.poNumber !== "-") return v.refDoc.poNumber;

    if (v.narration) {
      const match = v.narration.match(/(?:GRN|PO|SO)[-\w]+/i);
      if (match && match[0]) return match[0];
    }

    if (v.refDocId && (/^[0-9a-f-]{30,}$/i.test(v.refDocId) || v.refDocId.includes("_rcpt_") || v.refDocId.includes("_pay_"))) {
      return "-";
    }

    return v.refDocId || "-";
  };

  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Voucher No", accessor: (v: Voucher) => v.voucherNo },
      { header: "Type", accessor: (v: Voucher) => v.type },
      { header: "Date", accessor: (v: Voucher) => new Date(v.date).toLocaleDateString("en-IN") },
      { header: "Invoice No", accessor: (v: Voucher) => v.refDoc?.invoiceNo || "-" },
      { header: "GRN/PO Ref", accessor: (v: Voucher) => getGrnRef(v) },
      { header: "Supplier/Customer", accessor: (v: Voucher) => getPartyName(v) },
      {
        header: "Amount (₹)",
        accessor: (v: Voucher) =>
          Math.max(...v.items.map((i) => Math.max(Number(i.debitAmount || 0), Number(i.creditAmount || 0)))),
      },
      { header: "Status", accessor: (v: Voucher) => v.status || "POSTED" },
      { header: "Narration", accessor: (v: Voucher) => v.narration || "-" },
    ];

    return {
      csvData: vouchers,
      csvColumns: columns,
      csvFilename: `Accounting_Vouchers_${new Date().toISOString().split("T")[0]}.csv`,
    };
  }, [vouchers]);

  return (
    <div className="w-full p-4 md:p-6 bg-card-2 min-h-screen font-sans text-ink space-y-6">
      {/* UNIFIED HEADER CONTAINER WITH TABS & FILTERS */}
      <div className="bg-card rounded-2xl shadow-sm border border-line">
        {/* Header Title Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 border-b border-line rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wider border border-blue-200">
                General Ledger
              </span>
            </div>
            <h2 className="text-2xl font-bold text-ink mt-2 flex items-center gap-2">
              <FaFileInvoiceDollar className="text-blue-600 text-xl" /> Accounting Vouchers
            </h2>
            <p className="text-xs text-ink-subtle mt-1">
              General ledger transactions, purchase & sales vouchers, payments and receipts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <button
              onClick={loadVouchers}
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

        {/* Voucher Type Tabs Header Row */}
        <div className="px-6 py-3 bg-card-2/50 flex items-center gap-2 overflow-x-auto border-b border-line-soft">
          {["ALL", "PURCHASE", "SALES", "PAYMENT", "RECEIPT", "JOURNAL", "CONTRA"].map((t) => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${typeFilter === t
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-card text-ink-muted hover:bg-card-2 border border-line"
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Integrated Filters Panel Directly In Header */}
        <div className="p-2 bg-card">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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

            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Search</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full border border-line rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                  value={draftSearchTerm}
                  onChange={(e) => setDraftSearchTerm(e.target.value)}
                  placeholder="Search voucher no or narration..."
                />
                <FaSearch className="absolute left-3 top-3 text-ink-subtle text-xs" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-line-soft">
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

      {/* Table */}
      <div className="bg-card rounded-xl border border-line shadow-sm overflow-hidden">
        <div className="p-4 border-b border-line bg-card-2 flex items-center justify-between">
          <h2 className="font-semibold text-ink">
            {typeFilter === "ALL" ? "All Registered Vouchers" : `${typeFilter} Vouchers`}
          </h2>
          <span className="text-xs text-ink-subtle font-mono">Total Count: {total}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-ink-subtle">Loading vouchers...</div>
        ) : vouchers.length === 0 ? (
          <div className="p-12 text-center text-ink-subtle">No vouchers matching your filter criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink-muted">
              <thead className="bg-card-2 text-ink-muted uppercase font-semibold text-xs border-b border-line">
                <tr>
                  <th className="px-4 py-3">Voucher No</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Debit Ledger</th>
                  <th className="px-4 py-3">Credit Ledger</th>
                  <th className="px-4 py-3 text-right">Amount (₹)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Narration</th>
                  {typeFilter !== "PAYMENT" && <th className="px-4 py-3 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {vouchers.map((v) => {
                  const debitItem = v.items.find((i) => i.debitLedger) || v.items.find((i) => Number(i.debitAmount) > 0) || v.items[0];
                  const creditItem = v.items.find((i) => i.creditLedger) || v.items.find((i) => Number(i.creditAmount) > 0) || v.items[1] || v.items[0];

                  const debitLedgerName = debitItem?.debitLedger?.name || debitItem?.creditLedger?.name || "-";
                  const creditLedgerName = creditItem?.creditLedger?.name || creditItem?.debitLedger?.name || "-";

                  const amount = Math.max(
                    ...v.items.map((i) => Math.max(Number(i.debitAmount || 0), Number(i.creditAmount || 0)))
                  );

                  return (
                    <tr key={v.id} className="hover:bg-card-2 transition">
                      {/* Clickable Voucher No */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openViewModal(v)}
                          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline transition"
                          title="Click to view voucher details"
                        >
                          {v.voucherNo}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-card-2 text-ink">
                          {v.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {new Date(v.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{debitLedgerName}</td>
                      <td className="px-4 py-3 text-ink-muted">{creditLedgerName}</td>
                      {/* Formatted Amount */}
                      <td className="px-4 py-3 text-right font-bold text-ink whitespace-nowrap">
                        ₹
                        {(amount || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      {/* Status Column */}
                      <td className="px-4 py-3 text-center">
                        {renderStatusBadge(v.status)}
                      </td>
                      <td className="px-4 py-3 text-ink-subtle max-w-xs truncate" title={v.narration || ""}>
                        {v.narration || "-"}
                      </td>
                      {/* Actions Column */}
                      {typeFilter !== "PAYMENT" && (
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {v.type === "PURCHASE" ? (
                            <button
                              onClick={() => {
                                const targetId = v.refDoc?.id || v.refDoc?.grnId || (v.refDocId && v.refDocId.includes("_pay_") ? v.refDocId.split("_pay_")[0] : v.refDocId);
                                if (targetId) {
                                  navigate(`/invoice/details/${targetId}`);
                                } else {
                                  openViewModal(v);
                                }
                              }}
                              className="p-1.5 text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 border border-blue-200 rounded-md transition inline-flex items-center justify-center gap-1 text-xs font-semibold"
                              title="View GRN / Purchase Invoice Detail"
                            >
                              <FaEye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                          ) : v.type === "SALES" ? (
                            <button
                              onClick={() => {
                                const targetId = v.refDoc?.id || (v.refDocId && v.refDocId.includes("_rcpt_") ? v.refDocId.split("_rcpt_")[0] : v.refDocId);
                                if (targetId) {
                                  navigate(`/sales-invoices/details/${targetId}`);
                                } else {
                                  openViewModal(v);
                                }
                              }}
                              className="p-1.5 text-emerald-600 hover:text-white hover:bg-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md transition inline-flex items-center justify-center gap-1 text-xs font-semibold"
                              title="View Sales Invoice Detail"
                            >
                              <FaEye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                          ) : (
                            <span className="text-ink-subtle text-xs">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-line bg-card-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-ink-subtle font-medium">
              Showing <span className="font-semibold text-ink">{(page - 1) * pageSize + 1}</span> to{" "}
              <span className="font-semibold text-ink">{Math.min(page * pageSize, total)}</span> of{" "}
              <span className="font-semibold text-ink">{total}</span> vouchers
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="p-2 border border-line rounded-lg text-ink-muted hover:bg-card-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <FaChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-semibold text-ink-muted">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="p-2 border border-line rounded-lg text-ink-muted hover:bg-card-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <FaChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal - View Voucher Details */}
      {isModalOpen && selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card rounded-2xl border border-line shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold font-mono">{selectedVoucher.voucherNo}</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {selectedVoucher.type}
                  </span>
                  {renderStatusBadge(selectedVoucher.status)}
                </div>
                <p className="text-xs text-ink-subtle mt-1">
                  Voucher Date: {new Date(selectedVoucher.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
              <button
                onClick={closeViewModal}
                className="p-2 text-ink-subtle hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Ref Document Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-card-2 p-4 rounded-xl border border-line">
                <div>
                  <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider block">Invoice Number</span>
                  <span className="font-bold text-ink">{selectedVoucher.refDoc?.invoiceNo || "-"}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider block">GRN / PO Ref</span>
                  <span className="font-mono font-medium text-ink">{getGrnRef(selectedVoucher)}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider block">Supplier / Customer</span>
                  <span className="font-bold text-blue-900 flex items-center gap-1 mt-0.5">
                    <FaBuilding className="text-ink-subtle text-xs" />
                    {getPartyName(selectedVoucher)}
                  </span>
                </div>
              </div>

              {/* Items Detail Table (If GRN/Invoice items exist) */}
              {selectedVoucher.refDoc?.items && selectedVoucher.refDoc.items.length > 0 && (
                <div>
                  <h3 className="font-semibold text-ink mb-2 flex items-center gap-2">
                    <FaReceipt className="text-blue-600" /> Item Description & Quantities
                  </h3>
                  <div className="border border-line rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-card-2 text-ink-muted font-semibold uppercase">
                        <tr>
                          <th className="px-3 py-2">Item Description</th>
                          <th className="px-3 py-2 text-center">UOM</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Unit Price (₹)</th>
                          <th className="px-3 py-2 text-right">Tax (%)</th>
                          <th className="px-3 py-2 text-right">Line Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-ink-muted">
                        {selectedVoucher.refDoc.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-card-2">
                            <td className="px-3 py-2 font-medium text-ink">{item.description}</td>
                            <td className="px-3 py-2 text-center">{item.uom || "-"}</td>
                            <td className="px-3 py-2 text-right font-bold text-ink">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">₹{item.unitPrice.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{item.tax || 0}%</td>
                            <td className="px-3 py-2 text-right font-bold text-ink">
                              ₹{item.lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Journal Double-Entry Ledger Details */}
              <div>
                <h3 className="font-semibold text-ink mb-2 flex items-center gap-2">
                  <FaInfoCircle className="text-ink-subtle" /> Journal Postings (Debit / Credit Ledgers)
                </h3>
                <div className="border border-line rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-card-2 text-ink-muted font-semibold uppercase">
                      <tr>
                        <th className="px-3 py-2">Debit Ledger</th>
                        <th className="px-3 py-2">Credit Ledger</th>
                        <th className="px-3 py-2 text-right">Debit (₹)</th>
                        <th className="px-3 py-2 text-right">Credit (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-ink-muted">
                      {selectedVoucher.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-card-2">
                          <td className="px-3 py-2 font-medium text-ink">
                            {item.debitLedger?.name ? `${item.debitLedger.name} (${item.debitLedger.code})` : "-"}
                          </td>
                          <td className="px-3 py-2 font-medium text-ink">
                            {item.creditLedger?.name ? `${item.creditLedger.name} (${item.creditLedger.code})` : "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-ink">
                            {Number(item.debitAmount) > 0
                              ? `₹${Number(item.debitAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                              : "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-ink">
                            {Number(item.creditAmount) > 0
                              ? `₹${Number(item.creditAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Narration Note */}
              {selectedVoucher.narration && (
                <div className="bg-card-2 p-4 rounded-xl border border-line">
                  <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider block mb-1">Narration</span>
                  <p className="text-ink-muted italic">{selectedVoucher.narration}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-card-2 border-t border-line flex justify-end">
              <button
                onClick={closeViewModal}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherListPage;
