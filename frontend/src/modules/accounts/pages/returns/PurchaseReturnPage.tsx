import React, { useState, useEffect } from "react";
import { FaBoxes, FaPlus, FaTimes, FaTrash, FaSearch, FaEye } from "react-icons/fa";
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
  purchasedQty: number;
  alreadyReturnedQty: number;
  maxReturnable: number;
  unitPrice: number;
  reason?: string;
  isGrnLinked?: boolean;
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
  const [selectedViewReturn, setSelectedViewReturn] = useState<PurchaseReturn | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>("");

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
        supplierService.fetchAll({ limit: 1000 }),
        rawMaterialService.fetchAll(),
        storeService.fetchAll({ storeCategory: "RAW_MATERIAL", limit: 100 }),
      ]);
      setReturns(rData || []);
      const sList = Array.isArray(sRes) ? sRes : sRes?.suppliers || [];
      setSuppliers(sList);
      const mList = Array.isArray(mRes) ? mRes : (mRes?.rawMaterials ?? []);
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
  useSocketSync("rawMaterial", undefined, loadData);

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

  // When GRN Invoice changes, fetch line items & calculate remaining returnable quantities
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

        // Calculate already returned quantities for this GRN
        const previousReturns = returns.filter(
          (r) => String(r.grnInvoiceId) === String(selectedGrnId) && r.status !== "CANCELLED"
        );
        const alreadyReturnedMap = new Map<string, number>();
        previousReturns.forEach((ret) => {
          (ret.items || []).forEach((ritem: any) => {
            const rmId = String(ritem.rawMaterialId);
            alreadyReturnedMap.set(rmId, (alreadyReturnedMap.get(rmId) || 0) + Number(ritem.quantity));
          });
        });

        if (grn && Array.isArray(grn.items)) {
          const initialRows: FormReturnRow[] = grn.items.map((item: any) => {
            const rmId = String(item.productId || item.rawMaterialId || item.id);
            const matchedMat = materials.find((m) => String(m.rawMaterialId || m.id) === rmId);
            const nameDisplay = matchedMat?.materialName || item.description || `Material #${rmId}`;
            const purchasedQty = Number(item.quantity) || 0;
            const alreadyReturnedQty = alreadyReturnedMap.get(rmId) || 0;
            const maxReturnable = Math.max(0, purchasedQty - alreadyReturnedQty);

            return {
              rawMaterialId: rmId,
              materialName: nameDisplay,
              quantity: 0,
              purchasedQty,
              alreadyReturnedQty,
              maxReturnable,
              unitPrice: Number(item.unitPrice),
              reason: "",
              isGrnLinked: true,
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
  }, [selectedGrnId, materials, returns]);

  const handleAddManualRow = () => {
    if (materials.length === 0) return;
    const first = materials[0];
    const rmId = String(first.rawMaterialId || first.id);
    setReturnRows((prev) => [
      ...prev,
      {
        rawMaterialId: rmId,
        materialName: first.materialName || first.name || `Material #${rmId}`,
        quantity: 1,
        purchasedQty: 0,
        alreadyReturnedQty: 0,
        maxReturnable: 99999,
        unitPrice: Number(first.unitPrice || 0),
        reason: "",
        isGrnLinked: false,
      },
    ]);
  };

  const handleRowMaterialChange = (index: number, rmId: string) => {
    const matchedMat = materials.find((m) => String(m.rawMaterialId || m.id) === rmId);
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
      if (qtyVal > max) {
        toast.warning(`Maximum returnable quantity for ${updated[index].materialName} is ${max}`);
      }
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

  const filteredReturns = returns.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.returnNo?.toLowerCase().includes(term) ||
      r.supplier?.legalName?.toLowerCase().includes(term) ||
      r.grnInvoice?.invoiceNo?.toLowerCase().includes(term) ||
      r.reason?.toLowerCase().includes(term)
    );
  });

  const paginatedReturns = filteredReturns;

  return (
    <div className="p-3 space-y-3 bg-card-2 min-h-screen">
      {/* Compact Header + Filters */}
      <div className="bg-card rounded-lg border border-line">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line">
          <h1 className="text-sm font-bold text-ink flex items-center gap-2">
            <FaBoxes className="text-orange-500 text-sm" /> Purchase Returns (Debit Note)
          </h1>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-semibold transition cursor-pointer"
          >
            <FaPlus className="text-[10px]" /> Process Purchase Return
          </button>
        </div>

        <div className="px-3 py-2 bg-card-2 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Return no, supplier, GRN, reason..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                }}
                className="w-full pl-7 pr-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500 focus:outline-none"
              />
              <FaSearch className="absolute left-2.5 top-2.5 text-ink-subtle text-[10px]" />
            </div>
          </div>
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
              }}
              className="px-2.5 py-1.5 text-xs text-ink-muted hover:text-ink border border-line rounded cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-line overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-card-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-ink">Purchase Returns</h2>
          <span className="text-[11px] text-ink-subtle font-mono">Total: {filteredReturns.length}</span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-xs text-ink-muted">Loading...</div>
        ) : paginatedReturns.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-subtle">No purchase return records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink-muted">
              <thead className="bg-head text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                <tr>
                  <th className="px-3 py-2 w-10">#</th>
                  <th className="px-3 py-2">Return No</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">GRN Invoice</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Grand Total (₹)</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {paginatedReturns.map((item, index) => (
                  <tr key={item.id} className="hover:bg-card-2 transition-colors">
                    <td className="px-3 py-1.5 text-ink-subtle font-mono text-[11px]">
                      {index + 1}
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => setSelectedViewReturn(item)}
                        className="font-mono font-semibold text-orange-500 hover:underline cursor-pointer"
                        title="Click to view PO Return Details"
                      >
                        {item.returnNo}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px]">
                      {new Date(item.returnDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-3 py-1.5 font-semibold text-ink">{item.supplier?.legalName || "-"}</td>
                    <td className="px-3 py-1.5 text-ink-muted font-mono text-[11px]">
                      {item.grnInvoice?.invoiceNo || (item.grnInvoiceId ? `GRN #${item.grnInvoiceId}` : "-")}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold text-orange-500 whitespace-nowrap">
                      ₹{Number(item.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-1.5 text-ink-subtle max-w-xs truncate">{item.reason || "-"}</td>
                    <td className="px-3 py-1.5 text-center">
                      <button
                        onClick={() => setSelectedViewReturn(item)}
                        className="p-1 text-orange-500 hover:text-white hover:bg-orange-500 border border-orange-200 rounded transition cursor-pointer"
                        title="View"
                      >
                        <FaEye className="w-2.5 h-2.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line bg-card-2">
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-right text-[10px] font-bold text-ink uppercase tracking-wide">
                    Page Total ({paginatedReturns.length}):
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-sm text-orange-500 font-mono">
                    ₹{paginatedReturns.reduce((s, r) => s + Number(r.grandTotal || 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Compact Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 overflow-y-auto">
          <div className="bg-card rounded-lg border border-line w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-3 py-2 border-b border-line bg-card-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <FaBoxes className="text-orange-500 text-sm" /> New Purchase Return (Debit Note)
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-ink-subtle hover:text-ink hover:bg-card rounded cursor-pointer"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-3 space-y-2 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={supplierId}
                    required
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.supplierCode} - {s.legalName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                    Original GRN Invoice
                  </label>
                  <select
                    value={selectedGrnId}
                    disabled={!supplierId}
                    onChange={(e) => setSelectedGrnId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">-- Direct Return (No GRN Link) --</option>
                    {supplierInvoices.map((grn) => (
                      <option key={grn.id} value={String(grn.id)}>
                        {grn.invoiceNo || grn.grnNumber} (₹{Number(grn.netAmount || grn.subtotal || grn.grandTotal || 0).toFixed(2)}) - {new Date(grn.receiveDate || grn.createdAt).toLocaleDateString("en-IN")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                    Store / Warehouse {!selectedGrnId && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={selectedStoreId}
                    required={!selectedGrnId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Select Store</option>
                    {stores.map((st) => (
                      <option key={String(st.storeId || st.id)} value={String(st.storeId || st.id)}>
                        {st.storeCode ? `${st.storeCode} - ` : ""}{st.storeName || st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                    Refund / Settlement Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={refundMode}
                    required
                    onChange={(e) => setRefundMode(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="CREDIT_NOTE">Debit Note (Adjust against supplier ledger)</option>
                    <option value="CASH">Cash Refund (Receive Cash-in-Hand)</option>
                    <option value="BANK">Bank Refund (Receive in Bank Account)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                  Reason for Return <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  required
                  placeholder="e.g. Damaged material / Substandard quality"
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Items Section */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-ink uppercase tracking-wide">Return Raw Materials</label>
                  <div className="flex items-center gap-2">
                    {fetchingGrn && <span className="text-[11px] text-orange-500 animate-pulse font-medium">Fetching GRN items...</span>}
                    {!selectedGrnId && (
                      <button
                        type="button"
                        onClick={handleAddManualRow}
                        className="flex items-center gap-1 text-[11px] font-semibold text-orange-500 hover:text-orange-600 cursor-pointer"
                      >
                        <FaPlus className="w-2.5 h-2.5" /> Add Row
                      </button>
                    )}
                  </div>
                </div>

                {returnRows.length === 0 ? (
                  <div className="p-3 border border-dashed border-line rounded text-center text-[11px] text-ink-subtle">
                    {selectedGrnId ? "No returnable items found for this GRN." : "Select a GRN Invoice or click Add Row to select raw materials."}
                  </div>
                ) : (
                  <div className="border border-line rounded overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-card-2 text-ink uppercase text-[10px] tracking-wide font-bold border-b border-line">
                        <tr>
                          <th className="px-2 py-1.5">Raw Material</th>
                          <th className="px-2 py-1.5 w-24 text-center">Qty</th>
                          <th className="px-2 py-1.5 w-28 text-right">Unit Price (₹)</th>
                          <th className="px-2 py-1.5 w-28 text-right">Line Total (₹)</th>
                          {!selectedGrnId && <th className="px-2 py-1.5 w-8 text-center"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-soft">
                        {returnRows.map((row, idx) => {
                          const lineTot = row.quantity * row.unitPrice;
                          return (
                            <tr key={idx} className="hover:bg-card-2/50">
                              <td className="px-2 py-1.5">
                                {row.isGrnLinked ? (
                                  <div>
                                    <div className="font-semibold text-ink text-xs">{row.materialName}</div>
                                    <div className="flex items-center gap-2 text-[10px] text-ink-subtle mt-0.5 font-mono">
                                      <span>Purchased: <strong className="text-ink-muted">{row.purchasedQty}</strong></span>
                                      {row.alreadyReturnedQty > 0 && (
                                        <span>| Returned: <strong className="text-orange-500">{row.alreadyReturnedQty}</strong></span>
                                      )}
                                      <span>| Max: <strong className="text-emerald-500">{row.maxReturnable}</strong></span>
                                    </div>
                                  </div>
                                ) : (
                                  <select
                                    value={row.rawMaterialId}
                                    onChange={(e) => handleRowMaterialChange(idx, e.target.value)}
                                    className="w-full px-2 py-1 border border-line rounded text-xs bg-card text-ink focus:outline-none focus:border-orange-500"
                                  >
                                    {materials.map((m) => {
                                      const rmId = String(m.rawMaterialId || m.id);
                                      const matName = m.materialName || m.name || m.materialCode || rmId;
                                      return (
                                        <option key={rmId} value={rmId}>
                                          {rmId} - {matName}
                                        </option>
                                      );
                                    })}
                                  </select>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max={row.maxReturnable}
                                  step="0.01"
                                  value={row.quantity || ""}
                                  placeholder="0"
                                  disabled={row.maxReturnable <= 0}
                                  onChange={(e) => handleRowQuantityChange(idx, parseFloat(e.target.value) || 0)}
                                  className="w-full px-2 py-1 border border-line rounded text-center font-mono font-semibold text-orange-500 bg-card focus:outline-none focus:border-orange-500 disabled:opacity-60"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.unitPrice || ""}
                                  disabled={row.isGrnLinked}
                                  onChange={(e) => handleRowPriceChange(idx, parseFloat(e.target.value) || 0)}
                                  className="w-full px-2 py-1 border border-line rounded text-right font-mono bg-card text-ink focus:outline-none focus:border-orange-500 disabled:opacity-60"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono font-semibold text-ink whitespace-nowrap">
                                ₹{lineTot.toFixed(2)}
                              </td>
                              {!selectedGrnId && (
                                <td className="px-2 py-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRow(idx)}
                                    className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                  >
                                    <FaTrash className="w-2.5 h-2.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-line bg-card-2">
                        <tr>
                          <td colSpan={3} className="px-2 py-1.5 text-right text-[10px] font-bold text-ink uppercase tracking-wide">
                            Grand Total:
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold text-sm text-orange-500 font-mono">
                            ₹{grandTotal.toFixed(2)}
                          </td>
                          {!selectedGrnId && <td></td>}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <label className="block mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle font-semibold">
                  Narration / Internal Notes
                </label>
                <textarea
                  value={narration}
                  rows={2}
                  placeholder="Additional accounting notes..."
                  onChange={(e) => setNarration(e.target.value)}
                  className="w-full px-2 py-1.5 border border-line bg-card rounded text-xs text-ink focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="px-3 py-1.5 text-ink-muted bg-card-2 hover:bg-card border border-line rounded font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded font-semibold text-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Processing..." : "Submit Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Return Detail Modal - compact */}
      {selectedViewReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 overflow-y-auto">
          <div className="bg-card rounded-lg border border-line w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-3 py-2 border-b border-line bg-card-2 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide">Purchase Return Detail</span>
                <h3 className="text-sm font-bold text-ink font-mono flex items-center gap-2 mt-0.5">
                  {selectedViewReturn.returnNo}
                </h3>
              </div>
              <button
                onClick={() => setSelectedViewReturn(null)}
                className="p-1 text-ink-subtle hover:text-ink hover:bg-card rounded cursor-pointer"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>

            <div className="p-3 space-y-3 overflow-y-auto flex-1 text-xs">
              {/* Key Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-card-2 p-2 rounded border border-line">
                <div>
                  <div className="text-[10px] text-ink-subtle font-semibold uppercase tracking-wide">Return Date</div>
                  <div className="font-semibold text-ink mt-0.5 text-xs">
                    {new Date(selectedViewReturn.returnDate).toLocaleDateString("en-IN")}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-subtle font-semibold uppercase tracking-wide">Supplier</div>
                  <div className="font-semibold text-ink mt-0.5 text-xs">
                    {selectedViewReturn.supplier?.legalName || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-subtle font-semibold uppercase tracking-wide">GRN Invoice Ref</div>
                  <div className="font-semibold text-ink mt-0.5 font-mono text-[11px]">
                    {selectedViewReturn.grnInvoice?.invoiceNo || (selectedViewReturn.grnInvoiceId ? `GRN #${selectedViewReturn.grnInvoiceId}` : "Direct Return")}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-subtle font-semibold uppercase tracking-wide">Status</div>
                  <div className="mt-0.5">
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      {selectedViewReturn.status}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-subtle font-semibold uppercase tracking-wide">Grand Total</div>
                  <div className="font-bold text-orange-500 mt-0.5 font-mono text-xs">
                    ₹{Number(selectedViewReturn.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-subtle font-semibold uppercase tracking-wide">Reason</div>
                  <div className="font-medium text-ink-muted mt-0.5 truncate text-xs">
                    {selectedViewReturn.reason || "-"}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-semibold text-ink mb-1.5 flex items-center justify-between">
                  <span>Returned Raw Materials</span>
                  <span className="text-[11px] font-normal text-ink-subtle">Items: {selectedViewReturn.items?.length || 0}</span>
                </h4>
                <div className="border border-line rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-head text-ink uppercase font-bold text-[10px] tracking-wide border-b border-line">
                      <tr>
                        <th className="px-3 py-1.5">Material ID</th>
                        <th className="px-3 py-1.5">Material Name</th>
                        <th className="px-3 py-1.5 text-center">Returned Qty</th>
                        <th className="px-3 py-1.5 text-right">Unit Price (₹)</th>
                        <th className="px-3 py-1.5 text-right">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft text-ink-muted">
                      {selectedViewReturn.items && selectedViewReturn.items.length > 0 ? (
                        selectedViewReturn.items.map((item, i) => (
                          <tr key={item.id || i} className="hover:bg-card-2/50">
                            <td className="px-3 py-1.5 font-mono text-orange-500 font-medium">
                              {item.rawMaterialId}
                            </td>
                            <td className="px-3 py-1.5 font-medium text-ink">
                              {item.rawMaterial?.materialName || item.rawMaterial?.name || item.rawMaterialId}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono font-semibold text-ink">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              ₹{Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono font-semibold text-ink">
                              ₹{(Number(item.lineTotal) || Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-ink-subtle text-xs">
                            No item details found for this return.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedViewReturn.narration && (
                <div className="bg-card-2 p-2 rounded border border-line text-xs">
                  <span className="font-semibold text-ink block mb-0.5 text-[10px] uppercase tracking-wide">Narration / Notes</span>
                  <p className="text-ink-muted leading-relaxed">{selectedViewReturn.narration}</p>
                </div>
              )}
            </div>

            <div className="px-3 py-2 border-t border-line bg-card-2 flex justify-end">
              <button
                onClick={() => setSelectedViewReturn(null)}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded font-semibold text-xs transition cursor-pointer"
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
