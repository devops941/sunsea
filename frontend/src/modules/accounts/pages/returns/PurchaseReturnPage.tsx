import React, { useState, useEffect } from "react";
import { FaBoxes, FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService, type PurchaseReturn } from "../../../../services/returnService";
import { supplierService } from "../../../../services/supplierService";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import { grnInvoiceService } from "../../../../services/grnInvoiceService";
import { storeService } from "../../../../services/storeService";
import { useAppSelector } from "../../../../hooks/reduxHooks";

interface FormReturnRow {
  rawMaterialId: string;
  materialName: string;
  quantity: number;
  maxReturnable: number;
  unitPrice: number;
  reason?: string;
}

import { useSocketSync } from "../../../../hooks/useSocketSync";

export const PurchaseReturnPage: React.FC = () => {
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { data: company } = useAppSelector((state) => state.company);

  // Form state
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);
  const [selectedGrnId, setSelectedGrnId] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [fetchingGrn, setFetchingGrn] = useState<boolean>(false);

  const [refundMode, setRefundMode] = useState<"CREDIT_NOTE" | "CASH" | "BANK">("CREDIT_NOTE");
  const [reason, setReason] = useState<string>("");
  const [narration, setNarration] = useState<string>("");
  const [returnRows, setReturnRows] = useState<FormReturnRow[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, sRes, mRes, stRes] = await Promise.all([
        returnService.fetchPurchaseReturns(),
        supplierService.fetchAll({ page: 1, limit: 10 }),
        rawMaterialService.fetchAll(),
        storeService.fetchAll({ limit: 10 }),
      ]);
      setReturns(rData || []);
      const sList = Array.isArray(sRes) ? sRes : sRes?.suppliers || [];
      setSuppliers(sList);
      const mList = Array.isArray(mRes) ? mRes : [];
      setMaterials(mList);
      const stList = Array.isArray(stRes) ? stRes : stRes?.stores || stRes?.data || [];
      setStores(stList);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load purchase returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useSocketSync("purchaseReturn", undefined, loadData);
  useSocketSync("grnInvoice", undefined, loadData);
  useSocketSync("supplier", undefined, loadData);

  // When Supplier changes, fetch GRN Invoices
  useEffect(() => {
    if (!supplierId) {
      setSupplierInvoices([]);
      setSelectedGrnId("");
      setReturnRows([]);
      return;
    }

    const fetchGrns = async () => {
      try {
        const res = await grnInvoiceService.fetchAll({ supplierId: Number(supplierId), limit: 100 });
        const list = Array.isArray(res) ? res : res?.grnInvoices || res?.data || [];
        setSupplierInvoices(list);
      } catch (err) {
        console.error("Failed to fetch GRN invoices", err);
      }
    };

    fetchGrns();
  }, [supplierId]);

  // When GRN Invoice changes, fetch line items
  useEffect(() => {
    if (!selectedGrnId) {
      setReturnRows([]);
      return;
    }

    const fetchGrnDetails = async () => {
      setFetchingGrn(true);
      try {
        const grn = await grnInvoiceService.fetchById(selectedGrnId);
        if (grn?.storeId) {
          setSelectedStoreId(grn.storeId);
        }

        if (grn && Array.isArray(grn.items)) {
          const initialRows: FormReturnRow[] = grn.items.map((item: any) => {
            const rmId = item.rawMaterialId || item.productId || item.id;
            const matchedMat = materials.find((m) => m.rawMaterialId === rmId || m.id === rmId);
            const nameDisplay = matchedMat?.materialName || item.description || `Material #${rmId}`;
            return {
              rawMaterialId: rmId,
              materialName: nameDisplay,
              quantity: 0,
              maxReturnable: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              reason: "",
            };
          });
          setReturnRows(initialRows);
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to load GRN invoice items");
      } finally {
        setFetchingGrn(false);
      }
    };

    fetchGrnDetails();
  }, [selectedGrnId, materials]);

  const handleAddManualRow = () => {
    if (materials.length === 0) return;
    const first = materials[0];
    const rmId = first.rawMaterialId || first.id;
    setReturnRows((prev) => [
      ...prev,
      {
        rawMaterialId: rmId,
        materialName: first.materialName || first.name || `Material #${rmId}`,
        quantity: 1,
        maxReturnable: 99999,
        unitPrice: Number(first.unitPrice || 0),
        reason: "",
      },
    ]);
  };

  const [selectedViewReturn, setSelectedViewReturn] = useState<PurchaseReturn | null>(null);

  const handleRowMaterialChange = (index: number, rmId: string) => {
    const matchedMat = materials.find((m) => (m.rawMaterialId || m.id) === rmId);
    setReturnRows((prev) => {
      const updated = [...prev];
      updated[index].rawMaterialId = rmId;
      updated[index].materialName = matchedMat?.materialName || matchedMat?.name || `Material #${rmId}`;
      updated[index].unitPrice = Number(matchedMat?.unitPrice || updated[index].unitPrice || 0);
      return updated;
    });
  };

  const handleRowQuantityChange = (index: number, qtyVal: number) => {
    setReturnRows((prev) => {
      const updated = [...prev];
      const max = updated[index].maxReturnable;
      const validQty = Math.max(0, Math.min(qtyVal, max));
      updated[index].quantity = validQty;
      return updated;
    });
  };

  const handleRowPriceChange = (index: number, priceVal: number) => {
    setReturnRows((prev) => {
      const updated = [...prev];
      updated[index].unitPrice = Math.max(0, priceVal);
      return updated;
    });
  };

  const handleRemoveRow = (index: number) => {
    setReturnRows((prev) => prev.filter((_, i) => i !== index));
  };

  const grandTotal = returnRows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !company?.id) {
      toast.error("Please select a supplier and ensure company context is active");
      return;
    }

    if (!selectedGrnId && !selectedStoreId) {
      toast.error("Please select a Store/Warehouse when no GRN Invoice is linked");
      return;
    }

    if (!reason.trim()) {
      toast.error("Reason for Return is required for audit trail");
      return;
    }

    const activeReturnItems = returnRows.filter((r) => r.quantity > 0);
    if (activeReturnItems.length === 0) {
      toast.error("Please enter a return quantity greater than 0 for at least one raw material");
      return;
    }

    setSubmitting(true);
    try {
      await returnService.createPurchaseReturn({
        supplierId: parseInt(supplierId, 10),
        grnInvoiceId: selectedGrnId || undefined,
        storeId: selectedStoreId || undefined,
        refundMode,
        reason: reason.trim(),
        narration,
        companyId: company.id,
        items: activeReturnItems.map((r) => ({
          rawMaterialId: r.rawMaterialId,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          reason: r.reason || reason,
        })),
      });

      toast.success("Purchase Return processed & stock deducted!");
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create Purchase Return");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSupplierId("");
    setSupplierInvoices([]);
    setSelectedGrnId("");
    setSelectedStoreId("");
    setReturnRows([]);
    setRefundMode("CREDIT_NOTE");
    setReason("");
    setNarration("");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <span>Accounts</span>
            <span>/</span>
            <span className="text-slate-900 font-medium">Purchase Returns</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FaBoxes className="text-amber-600" /> Purchase Return (Debit Note)
          </h1>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition shadow-sm"
        >
          <FaPlus /> Process Purchase Return
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Purchase Return Records</h2>
          <span className="text-xs text-slate-500 font-mono">Count: {returns.length}</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading purchase returns...</div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No purchase return records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Return No</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">GRN Invoice</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Grand Total (₹)</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono font-medium text-amber-600">
                      <button
                        onClick={() => setSelectedViewReturn(r)}
                        className="hover:underline text-left font-bold"
                        title="Click to view PO Return Details"
                      >
                        {r.returnNo}
                      </button>
                    </td>
                    <td className="px-4 py-3">{new Date(r.returnDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.supplier?.legalName || "-"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {r.grnInvoice?.invoiceNo || (r.grnInvoiceId ? `GRN #${r.grnInvoiceId}` : "-")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
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
                <FaBoxes className="text-amber-600" /> New Purchase Return (Debit Note)
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Supplier *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplierCode} - {s.legalName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Original GRN Invoice</label>
                  <select
                    value={selectedGrnId}
                    onChange={(e) => setSelectedGrnId(e.target.value)}
                    disabled={!supplierId}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="">-- Direct Return (No GRN Link) --</option>
                    {supplierInvoices.map((grn) => (
                      <option key={grn.id} value={grn.id}>
                        {grn.invoiceNo || grn.grnNumber} (₹{Number(grn.netAmount || grn.subtotal || grn.grandTotal || 0).toFixed(2)}) - {new Date(grn.receiveDate || grn.createdAt).toLocaleDateString("en-IN")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Store / Warehouse {!selectedGrnId && "*"}
                  </label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required={!selectedGrnId}
                  >
                    <option value="">Select Store</option>
                    {stores.map((st) => (
                      <option key={st.storeId || st.id} value={st.storeId || st.id}>
                        {st.storeCode ? `${st.storeCode} - ` : ""}{st.storeName || st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Refund / Settlement Mode *</label>
                  <select
                    value={refundMode}
                    onChange={(e) => setRefundMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="CREDIT_NOTE">Debit Note (Adjust against supplier ledger)</option>
                    <option value="CASH">Cash Refund (Receive Cash-in-Hand)</option>
                    <option value="BANK">Bank Refund (Receive in Bank Account)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Reason for Return *</label>
                <input
                  type="text"
                  placeholder="e.g. Damaged material / Substandard quality"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              {/* Items Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Return Raw Materials</label>
                  <div className="flex items-center gap-3">
                    {fetchingGrn && <span className="text-xs text-amber-600 animate-pulse font-medium">Fetching GRN items...</span>}
                    <button
                      type="button"
                      onClick={handleAddManualRow}
                      className="text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200"
                    >
                      + Add Item Row
                    </button>
                  </div>
                </div>

                {returnRows.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500">
                    Select a GRN Invoice or click "+ Add Item Row" to select raw materials to return.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 uppercase font-semibold text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Raw Material</th>
                          <th className="px-3 py-2 w-28 text-center">Return Qty</th>
                          <th className="px-3 py-2 w-32 text-right">Unit Price (₹)</th>
                          <th className="px-3 py-2 w-32 text-right">Line Total (₹)</th>
                          <th className="px-3 py-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {returnRows.map((row, idx) => {
                          const lineTot = row.quantity * row.unitPrice;
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-2">
                                <select
                                  value={row.rawMaterialId}
                                  onChange={(e) => handleRowMaterialChange(idx, e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                                >
                                  {materials.map((m) => {
                                    const rmId = m.rawMaterialId || m.id;
                                    const matName = m.materialName || m.name || m.materialCode || rmId;
                                    return (
                                      <option key={rmId} value={rmId}>
                                        {rmId} - {matName}
                                      </option>
                                    );
                                  })}
                                </select>
                                {row.maxReturnable < 99999 && (
                                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                    GRN Qty: {row.maxReturnable} (Max Returnable: {row.maxReturnable})
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={row.maxReturnable}
                                  step="0.01"
                                  value={row.quantity || ""}
                                  onChange={(e) => handleRowQuantityChange(idx, parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-slate-300 rounded text-center font-bold text-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.unitPrice || ""}
                                  onChange={(e) => handleRowPriceChange(idx, parseFloat(e.target.value) || 0)}
                                  className="w-24 px-2 py-1 border border-slate-300 rounded text-right font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </td>
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
                  <div className="flex justify-between w-48 font-bold text-slate-900 text-sm">
                    <span>Grand Total:</span>
                    <span className="font-mono text-amber-700">₹{grandTotal.toFixed(2)}</span>
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 shadow-sm"
                >
                  {submitting ? "Processing Return..." : "Submit Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* PO Return Detail Modal */}
      {selectedViewReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-200 bg-amber-50/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Purchase Return Detail</span>
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
                  <div className="text-xs text-slate-500 font-medium">Supplier</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedViewReturn.supplier?.legalName || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 font-medium">GRN Invoice Ref</div>
                  <div className="font-semibold text-slate-800 mt-0.5 font-mono text-xs">
                    {selectedViewReturn.grnInvoice?.invoiceNo || (selectedViewReturn.grnInvoiceId ? `GRN #${selectedViewReturn.grnInvoiceId}` : "Direct Return")}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 font-medium">Status</div>
                  <div className="mt-0.5">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {selectedViewReturn.status}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 font-medium">Grand Total</div>
                  <div className="font-bold text-amber-700 mt-0.5 font-mono">
                    ₹{Number(selectedViewReturn.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 font-medium">Reason</div>
                  <div className="font-medium text-slate-700 mt-0.5 truncate">
                    {selectedViewReturn.reason || "-"}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center justify-between">
                  <span>Returned Raw Materials</span>
                  <span className="text-xs font-normal text-slate-500">Items: {selectedViewReturn.items?.length || 0}</span>
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 uppercase font-semibold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">Material ID</th>
                        <th className="px-3 py-2.5">Material Name</th>
                        <th className="px-3 py-2.5 text-center">Returned Qty</th>
                        <th className="px-3 py-2.5 text-right">Unit Price (₹)</th>
                        <th className="px-3 py-2.5 text-right">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {selectedViewReturn.items && selectedViewReturn.items.length > 0 ? (
                        selectedViewReturn.items.map((item, i) => (
                          <tr key={item.id || i} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-mono text-amber-700 font-medium">
                              {item.rawMaterialId}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-900">
                              {item.rawMaterial?.materialName || item.rawMaterial?.name || item.rawMaterialId}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-slate-800">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">
                              ₹{Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900">
                              ₹{(Number(item.lineTotal) || Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
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
