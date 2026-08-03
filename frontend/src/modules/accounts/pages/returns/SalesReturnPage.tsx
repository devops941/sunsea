import React, { useState, useEffect } from "react";
import { FaUndo, FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService, type SalesReturn } from "../../../../services/returnService";
import { customerService } from "../../../../services/customerService";
import { salesInvoiceService } from "../../../../services/salesInvoiceService";
import { useAppSelector } from "../../../../hooks/reduxHooks";

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

import { useSocketSync } from "../../../../hooks/useSocketSync";

export const SalesReturnPage: React.FC = () => {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

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
        reason: reason || "Sales Return",
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

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toUpperCase()) {
      case "APPROVED":
      case "POSTED":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "DRAFT":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "CANCELLED":
        return "bg-rose-100 text-rose-800 border-rose-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <span>Accounts</span>
            <span>/</span>
            <span className="text-slate-900 font-medium">Sales Returns</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FaUndo className="text-orange-600" /> Sales Return
          </h1>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition shadow-sm"
        >
          <FaPlus /> Process Sales Return
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Sales Return Records</h2>
          <span className="text-xs text-slate-500 font-mono">Count: {returns.length}</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading sales returns...</div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No sales return records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Return No</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Invoice No</th>
                  <th className="px-4 py-3">Refund Mode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Grand Total (₹)</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono font-medium text-orange-600">{r.returnNo}</td>
                    <td className="px-4 py-3">{new Date(r.returnDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.customer?.firmName || "-"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {r.salesInvoiceId ? r.returnNo.replace("SRT", "INV") : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {r.refundMode || "CREDIT_NOTE"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      ₹{Number(r.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FaUndo className="text-orange-600" /> New Sales Return
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Customer *</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customerCode} - {c.firmName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Original Sales Invoice</label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    disabled={!customerId}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="">-- Direct Return (No Invoice Link) --</option>
                    {customerInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNo} (₹{Number(inv.grandTotal).toFixed(2)}) - {new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString("en-IN")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Refund Mode *</label>
                  <select
                    value={refundMode}
                    onChange={(e) => setRefundMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="CREDIT_NOTE">Credit Note (Adjust against ledger)</option>
                    <option value="CASH">Cash Refund (Pay Cash-in-Hand)</option>
                    <option value="BANK">Bank Refund (Pay Bank Account)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Reason for Return</label>
                  <input
                    type="text"
                    placeholder="e.g. Defective goods / Customer return"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Return Line Items</label>
                  {fetchingInvoice && <span className="text-xs text-orange-600 animate-pulse font-medium">Fetching invoice items...</span>}
                </div>

                {returnRows.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500">
                    Select a Customer and Sales Invoice to load line items.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 uppercase font-semibold text-slate-600 border-b border-slate-200">
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
                                  className="w-20 px-2 py-1 border border-slate-300 rounded text-center font-bold text-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
                    <span className="font-mono text-orange-600">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Narration / Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional accounting notes..."
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 shadow-sm"
                >
                  {submitting ? "Processing Return..." : "Submit Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
