import React, { useState, useEffect } from "react";
import { FaUndo, FaPlus, FaTimes, FaTrash, FaEraser, FaSave } from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService, type SalesReturn } from "../../../../services/returnService";
import { customerService } from "../../../../services/customerService";
import { salesInvoiceService } from "../../../../services/salesInvoiceService";
import { useAppSelector } from "../../../../hooks/reduxHooks";

import DataTable from "../../../../components/ui/table/DataTable";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import CustomButton from "../../../../components/ui/Button/Button";
import CommonModal from "../../../../components/ui/Modal/CommonModal";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../../components/form/TextInput/TextInput";
import { useSocketSync } from "../../../../hooks/useSocketSync";

interface FormReturnRow {
  productId: number;
  salesInvoiceItemId?: string;
  description: string;
  quantity: number;
  maxReturnable: number;
  unitPrice: number;
  taxRate: number;
  reason?: string;
}

const ITEMS_PER_PAGE = 10;

export const SalesReturnPage: React.FC = () => {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedViewReturn, setSelectedViewReturn] = useState<SalesReturn | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const { data: company } = useAppSelector((state) => state.company);

  // Form states
  const [customerId, setCustomerId] = useState<string>("");
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [invoiceDetails, setInvoiceDetails] = useState<any>(null);
  const [fetchingInvoice, setFetchingInvoice] = useState<boolean>(false);

  const [refundMode, setRefundMode] = useState<"CREDIT_NOTE" | "CASH" | "BANK">("CREDIT_NOTE");
  const [reason, setReason] = useState<string>("");
  const [narration, setNarration] = useState<string>("");
  const [returnRows, setReturnRows] = useState<FormReturnRow[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, cRes] = await Promise.all([
        returnService.fetchSalesReturns(),
        customerService.fetchAll({ page: 1, limit: 10 }),
      ]);
      setReturns(rData || []);
      const cList = Array.isArray(cRes) ? cRes : cRes?.customers || [];
      setCustomers(cList);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load sales returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useSocketSync("salesReturn", undefined, loadData);
  useSocketSync("salesInvoice", undefined, loadData);
  useSocketSync("customer", undefined, loadData);

  // When Customer changes, fetch their Invoices
  useEffect(() => {
    if (!customerId) {
      setCustomerInvoices([]);
      setSelectedInvoiceId("");
      setInvoiceDetails(null);
      setReturnRows([]);
      return;
    }

    const fetchInvoices = async () => {
      try {
        const res = await salesInvoiceService.fetchAll({ customerId, limit: 100 });
        const list = Array.isArray(res) ? res : res?.invoices || res?.data || [];
        setCustomerInvoices(list);
      } catch (err) {
        console.error("Failed to fetch customer invoices", err);
      }
    };

    fetchInvoices();
  }, [customerId]);

  // When Sales Invoice changes, fetch line items and prepare return rows
  useEffect(() => {
    if (!selectedInvoiceId) {
      setInvoiceDetails(null);
      setReturnRows([]);
      return;
    }

    const fetchDetails = async () => {
      setFetchingInvoice(true);
      try {
        const inv = await salesInvoiceService.fetchById(selectedInvoiceId);
        setInvoiceDetails(inv);

        // Pre-fill rows from invoice line items
        if (inv && Array.isArray(inv.items)) {
          const initialRows: FormReturnRow[] = inv.items.map((item: any) => {
            const tax = Number(item.tax || item.cgstRate + item.sgstRate + item.igstRate || 0);
            return {
              productId: Number(item.productId),
              salesInvoiceItemId: item.id,
              description: item.description || item.product?.productName || `Product #${item.productId}`,
              quantity: 0, // default 0 to let user choose
              maxReturnable: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              taxRate: tax,
              reason: "",
            };
          });
          setReturnRows(initialRows);
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to load invoice line items");
      } finally {
        setFetchingInvoice(false);
      }
    };

    fetchDetails();
  }, [selectedInvoiceId]);

  const handleRowQuantityChange = (index: number, qtyVal: number) => {
    setReturnRows((prev) => {
      const updated = [...prev];
      const max = updated[index].maxReturnable;
      const validQty = Math.max(0, Math.min(qtyVal, max));
      updated[index].quantity = validQty;
      return updated;
    });
  };

  const handleRemoveRow = (index: number) => {
    setReturnRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate totals
  const subTotal = returnRows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
  const taxTotal = returnRows.reduce((sum, r) => sum + (r.quantity * r.unitPrice * r.taxRate) / 100, 0);
  const grandTotal = subTotal + taxTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !company?.id) {
      toast.error("Please select a customer and ensure company context is active");
      return;
    }

    if (!reason.trim()) {
      toast.error("Reason for Return is required for audit trail");
      return;
    }

    const activeReturnItems = returnRows.filter((r) => r.quantity > 0);
    if (activeReturnItems.length === 0) {
      toast.error("Please enter a return quantity greater than 0 for at least one item");
      return;
    }

    setSubmitting(true);
    try {
      await returnService.createSalesReturn({
        customerId,
        salesInvoiceId: selectedInvoiceId || undefined,
        refundMode,
        reason: reason.trim(),
        narration,
        companyId: company.id,
        items: activeReturnItems.map((r) => ({
          productId: r.productId,
          salesInvoiceItemId: r.salesInvoiceItemId,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          taxRate: r.taxRate,
          reason: r.reason || reason,
        })),
      });

      toast.success("Sales Return processed & auto-posted to inventory & accounting!");
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create Sales Return");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCustomerId("");
    setSelectedInvoiceId("");
    setCustomerInvoices([]);
    setInvoiceDetails(null);
    setReturnRows([]);
    setRefundMode("CREDIT_NOTE");
    setReason("");
    setNarration("");
  };

  const filteredReturns = returns.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.returnNo?.toLowerCase().includes(term) ||
      r.customer?.firmName?.toLowerCase().includes(term) ||
      r.reason?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredReturns.length / ITEMS_PER_PAGE) || 1;
  const paginatedReturns = filteredReturns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-100 p-4 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales Returns (Credit Note)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage customer sales returns, inventory auto-restock, and credit notes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search sales returns..."
          />
          <CustomButton
            text="Process Sales Return"
            icon={FaPlus}
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={paginatedReturns}
        rowKey={(item) => item.id}
        loading={loading}
        emptyMessage="No sales return records found."
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (page) => setCurrentPage(page),
        }}
        columns={[
          {
            header: "#",
            width: "60px",
            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
          },
          {
            header: "RETURN NO",
            render: (item) => (
              <button
                onClick={() => setSelectedViewReturn(item)}
                className="font-mono font-bold text-blue-600 hover:underline text-left"
                title="Click to view Sales Return Details"
              >
                {item.returnNo}
              </button>
            ),
          },
          {
            header: "DATE",
            render: (item) => new Date(item.returnDate).toLocaleDateString("en-IN"),
          },
          {
            header: "CUSTOMER",
            render: (item) => item.customer?.firmName || "-",
          },
          {
            header: "REFUND MODE",
            render: (item) => (
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {item.refundMode || "CREDIT_NOTE"}
              </span>
            ),
          },
          {
            header: "STATUS",
            render: (item) => (
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                {item.status}
              </span>
            ),
          },
          {
            header: "GRAND TOTAL",
            align: "right",
            render: (item) => (
              <span className="font-semibold text-blue-600">
                ₹{Number(item.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            ),
          },
          {
            header: "REASON",
            render: (item) => <span className="text-slate-500 max-w-xs truncate block">{item.reason || "-"}</span>,
          },
          {
            header: "ACTIONS",
            render: (item) => (
              <div className="flex items-center gap-2">
                <ViewButton onClick={() => setSelectedViewReturn(item)} />
              </div>
            ),
          },
        ]}
      />

      {/* New Sales Return Modal */}
      <CommonModal
        show={showModal}
        onHide={() => setShowModal(false)}
        title="New Sales Return (Credit Note)"
        maxWidth="3xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <CustomButton
              text="Clear"
              icon={FaEraser}
              onClick={resetForm}
              disabled={submitting}
              type="button"
            />
            <CustomButton
              type="submit"
              text={submitting ? "Processing Return..." : "Submit Return"}
              icon={FaSave}
              variant="primary"
              disabled={submitting}
              onClick={handleSubmit}
            />
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput
              label="CUSTOMER"
              name="customerId"
              value={customerId}
              required
              defaultOptionLabel="Select Customer"
              searchable
              options={customers.map((c) => ({
                label: `${c.customerCode ? `${c.customerCode} - ` : ""}${c.firmName}`,
                value: String(c.id),
              }))}
              onChange={(e) => setCustomerId(e.target.value)}
            />

            <SelectInput
              label="ORIGINAL SALES INVOICE"
              name="selectedInvoiceId"
              value={selectedInvoiceId}
              disabled={!customerId}
              defaultOptionLabel="-- Direct Return (No Invoice Link) --"
              searchable
              options={customerInvoices.map((inv) => ({
                label: `${inv.invoiceNo} (₹${Number(inv.grandTotal).toFixed(2)}) - ${new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString("en-IN")}`,
                value: String(inv.id),
              }))}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput
              label="REFUND / SETTLEMENT MODE"
              name="refundMode"
              value={refundMode}
              required
              options={[
                { label: "Credit Note (Adjust against ledger)", value: "CREDIT_NOTE" },
                { label: "Cash Refund (Pay Cash-in-Hand)", value: "CASH" },
                { label: "Bank Refund (Pay Bank Account)", value: "BANK" },
              ]}
              onChange={(e) => setRefundMode(e.target.value as any)}
            />

            <TextInput
              label="REASON FOR RETURN"
              name="reason"
              value={reason}
              required
              placeholder="e.g. Defective goods / Customer return"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Items Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase">Return Line Items</label>
              {fetchingInvoice && <span className="text-xs text-blue-600 animate-pulse font-medium">Fetching invoice items...</span>}
            </div>

            {returnRows.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
                Select a Customer and Sales Invoice to load line items.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 uppercase font-semibold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2 w-24 text-right">Invoiced Qty</th>
                      <th className="px-3 py-2 w-28 text-center">Return Qty</th>
                      <th className="px-3 py-2 w-28 text-right">Price (₹)</th>
                      <th className="px-3 py-2 w-20 text-right">Tax %</th>
                      <th className="px-3 py-2 w-28 text-right">Total (₹)</th>
                      <th className="px-3 py-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {returnRows.map((row, idx) => {
                      const lineSub = row.quantity * row.unitPrice;
                      const lineTax = (lineSub * row.taxRate) / 100;
                      const lineTot = lineSub + lineTax;
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium">{row.description}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500">{row.maxReturnable}</td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max={row.maxReturnable}
                              step="0.01"
                              value={row.quantity || ""}
                              onChange={(e) => handleRowQuantityChange(idx, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-slate-200 rounded text-center font-bold text-blue-600 focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono">₹{row.unitPrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500">{row.taxRate}%</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                            ₹{lineTot.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Remove item"
                            >
                              <FaTrash size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals Summary */}
          {returnRows.length > 0 && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col items-end space-y-1 text-xs">
              <div className="flex justify-between w-48 text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">₹{subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-48 text-slate-600">
                <span>Tax Total:</span>
                <span className="font-mono">₹{taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-48 font-bold text-slate-900 text-sm pt-1 border-t border-slate-300">
                <span>Grand Total:</span>
                <span className="font-mono text-blue-600">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <TextInput
            label="NARRATION / INTERNAL NOTES"
            name="narration"
            value={narration}
            as="textarea"
            rows={2}
            placeholder="Additional accounting notes..."
            onChange={(e) => setNarration(e.target.value)}
          />
        </form>
      </CommonModal>

      {/* Sales Return Detail Modal */}
      {selectedViewReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-200 bg-blue-50/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Sales Return Detail</span>
                <h3 className="text-xl font-bold text-slate-900 font-mono flex items-center gap-2 mt-0.5">
                  {selectedViewReturn.returnNo}
                </h3>
              </div>
              <button
                onClick={() => setSelectedViewReturn(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-sm">
              {/* Key Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Return Date</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {new Date(selectedViewReturn.returnDate).toLocaleDateString("en-IN")}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 font-medium">Customer</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedViewReturn.customer?.firmName || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 font-medium">Sales Invoice</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedViewReturn.salesInvoiceId ? `INV #${selectedViewReturn.salesInvoiceId}` : "Direct Return"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 font-medium">Refund Mode</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedViewReturn.refundMode || "CREDIT_NOTE"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 font-medium">Status</div>
                  <div className="font-semibold text-emerald-700 mt-0.5">
                    {selectedViewReturn.status}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 font-medium">Grand Total</div>
                  <div className="font-bold text-blue-600 font-mono mt-0.5">
                    ₹{Number(selectedViewReturn.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-3 text-xs uppercase tracking-wider">
                  Returned Items List
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 font-semibold text-slate-600 border-b border-slate-200 uppercase">
                      <tr>
                        <th className="px-3 py-2.5">Product ID / Item</th>
                        <th className="px-3 py-2.5 text-center">Qty</th>
                        <th className="px-3 py-2.5 text-right">Unit Price (₹)</th>
                        <th className="px-3 py-2.5 text-right">Tax Rate</th>
                        <th className="px-3 py-2.5 text-right">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {selectedViewReturn.items && selectedViewReturn.items.length > 0 ? (
                        selectedViewReturn.items.map((item, i) => (
                          <tr key={item.id || i} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-medium text-slate-900">
                              {item.product?.productName || item.description || `Product #${item.productId}`}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-slate-800">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">
                              ₹{Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                              {item.taxRate || 0}%
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900">
                              ₹{Number(item.lineTotal).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                            No item details found for this return.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedViewReturn.narration && (
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700 block mb-1">Narration / Notes:</span>
                  <p className="text-slate-600 leading-relaxed">{selectedViewReturn.narration}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedViewReturn(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium text-sm transition shadow-sm"
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
