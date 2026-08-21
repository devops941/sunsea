import React, { useState, useEffect } from "react";
import { FaBoxes, FaPlus, FaTimes, FaTrash, FaEraser, FaSave } from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService, type PurchaseReturn } from "../../../../services/returnService";
import { supplierService } from "../../../../services/supplierService";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import { grnInvoiceService } from "../../../../services/grnInvoiceService";
import { storeService } from "../../../../services/storeService";
import { useAppSelector } from "../../../../hooks/reduxHooks";

import DataTable from "../../../../components/ui/table/DataTable";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import CustomButton from "../../../../components/ui/Button/Button";
import CommonModal from "../../../../components/ui/Modal/CommonModal";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../../components/form/TextInput/TextInput";

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

const ITEMS_PER_PAGE = 10;

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
  const [currentPage, setCurrentPage] = useState<number>(1);

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

  const totalPages = Math.ceil(filteredReturns.length / ITEMS_PER_PAGE) || 1;
  const paginatedReturns = filteredReturns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-card rounded-xl shadow-xs border border-line-soft p-4 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Purchase Returns (Debit Note)</h1>
          <p className="text-sm text-ink-subtle mt-1">
            Manage supplier purchase returns, stock deductions, and debit notes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search returns..."
          />
          <CustomButton
            text="Process Purchase Return"
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
        emptyMessage="No purchase return records found."
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
                className="font-mono font-bold text-amber-600 hover:underline text-left"
                title="Click to view PO Return Details"
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
            header: "SUPPLIER",
            render: (item) => item.supplier?.legalName || "-",
          },
          {
            header: "GRN INVOICE",
            render: (item) => item.grnInvoice?.invoiceNo || (item.grnInvoiceId ? `GRN #${item.grnInvoiceId}` : "-"),
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
            render: (item) => <span className="text-ink-subtle max-w-xs truncate block">{item.reason || "-"}</span>,
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

      <CommonModal
        show={showModal}
        onHide={() => setShowModal(false)}
        title="New Purchase Return (Debit Note)"
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
              label="SUPPLIER"
              name="supplierId"
              value={supplierId}
              required
              defaultOptionLabel="Select Supplier"
              searchable
              options={suppliers.map((s) => ({
                label: `${s.supplierCode} - ${s.legalName}`,
                value: String(s.id),
              }))}
              onChange={(e) => setSupplierId(e.target.value)}
            />

            <SelectInput
              label="ORIGINAL GRN INVOICE"
              name="selectedGrnId"
              value={selectedGrnId}
              disabled={!supplierId}
              defaultOptionLabel="-- Direct Return (No GRN Link) --"
              searchable
              options={supplierInvoices.map((grn) => ({
                label: `${grn.invoiceNo || grn.grnNumber} (₹${Number(grn.netAmount || grn.subtotal || grn.grandTotal || 0).toFixed(2)}) - ${new Date(grn.receiveDate || grn.createdAt).toLocaleDateString("en-IN")}`,
                value: String(grn.id),
              }))}
              onChange={(e) => setSelectedGrnId(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectInput
              label="STORE / WAREHOUSE"
              name="selectedStoreId"
              value={selectedStoreId}
              required={!selectedGrnId}
              defaultOptionLabel="Select Store"
              options={stores.map((st) => ({
                label: `${st.storeCode ? `${st.storeCode} - ` : ""}${st.storeName || st.name}`,
                value: String(st.storeId || st.id),
              }))}
              onChange={(e) => setSelectedStoreId(e.target.value)}
            />

            <SelectInput
              label="REFUND / SETTLEMENT MODE"
              name="refundMode"
              value={refundMode}
              required
              options={[
                { label: "Debit Note (Adjust against supplier ledger)", value: "CREDIT_NOTE" },
                { label: "Cash Refund (Receive Cash-in-Hand)", value: "CASH" },
                { label: "Bank Refund (Receive in Bank Account)", value: "BANK" },
              ]}
              onChange={(e) => setRefundMode(e.target.value as any)}
            />
          </div>

          <TextInput
            label="REASON FOR RETURN"
            name="reason"
            value={reason}
            required
            placeholder="e.g. Damaged material / Substandard quality"
            onChange={(e) => setReason(e.target.value)}
          />

          {/* Items Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-xs font-semibold text-ink uppercase">Return Raw Materials</label>
                {selectedGrnId && (
                  <p className="text-[11px] text-amber-700 font-medium">
                    Showing purchased items from selected GRN/PO. Only purchased items can be returned.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {fetchingGrn && <span className="text-xs text-blue-600 animate-pulse font-medium">Fetching GRN items...</span>}
                {!selectedGrnId && (
                  <CustomButton
                    text="Add Item Row"
                    icon={FaPlus}
                    onClick={handleAddManualRow}
                    type="button"
                  />
                )}
              </div>
            </div>

            {returnRows.length === 0 ? (
              <div className="p-4 border border-dashed border-line-soft rounded-lg text-center text-xs text-ink-subtle">
                {selectedGrnId ? "No returnable items found for this GRN." : "Select a GRN Invoice or click '+ Add Item Row' to select raw materials."}
              </div>
            ) : (
              <div className="border border-line-soft rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs text-ink">
                  <thead className="bg-card-2 uppercase font-semibold text-ink-muted border-b border-line-soft">
                    <tr>
                      <th className="px-3 py-2">Raw Material</th>
                      <th className="px-3 py-2 w-28 text-center">Return Qty</th>
                      <th className="px-3 py-2 w-32 text-right">Unit Price (₹)</th>
                      <th className="px-3 py-2 w-32 text-right">Line Total (₹)</th>
                      {!selectedGrnId && <th className="px-3 py-2 w-10 text-center"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft bg-card">
                    {returnRows.map((row, idx) => {
                      const lineTot = row.quantity * row.unitPrice;
                      return (
                        <tr key={idx} className="hover:bg-card-2/50">
                          <td className="px-3 py-2">
                            {row.isGrnLinked ? (
                              <div>
                                <div className="font-bold text-ink text-xs">
                                  {row.materialName}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-ink-subtle mt-0.5 font-mono">
                                  <span>Purchased Qty: <strong className="text-ink-muted">{row.purchasedQty}</strong></span>
                                  {row.alreadyReturnedQty > 0 && (
                                    <span>| Already Returned: <strong className="text-amber-700">{row.alreadyReturnedQty}</strong></span>
                                  )}
                                  <span>| Max Returnable: <strong className="text-emerald-700">{row.maxReturnable}</strong></span>
                                </div>
                              </div>
                            ) : (
                              <select
                                value={row.rawMaterialId}
                                onChange={(e) => handleRowMaterialChange(idx, e.target.value)}
                                className="w-full px-2 py-1 border border-line-soft rounded text-xs font-medium bg-card-2 text-ink focus:outline-none focus:border-blue-500"
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
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max={row.maxReturnable}
                              step="0.01"
                              value={row.quantity || ""}
                              placeholder="0"
                              disabled={row.maxReturnable <= 0}
                              onChange={(e) => handleRowQuantityChange(idx, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-line-soft rounded text-center font-bold text-blue-600 bg-card-2 focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.unitPrice || ""}
                              disabled={row.isGrnLinked}
                              onChange={(e) => handleRowPriceChange(idx, parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border border-line-soft rounded text-right font-mono bg-card-2 text-ink focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-ink">
                            ₹{lineTot.toFixed(2)}
                          </td>
                          {!selectedGrnId && (
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(idx)}
                                className="text-ink-subtle hover:text-rose-600 p-1"
                                title="Remove item"
                              >
                                <FaTrash size={12} />
                              </button>
                            </td>
                          )}
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
            <div className="bg-card-2 p-3 rounded-lg border border-line-soft flex flex-col items-end space-y-1 text-xs">
              <div className="flex justify-between w-48 font-bold text-ink text-sm">
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
      {/* PO Return Detail Modal */}
      {selectedViewReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card rounded-xl shadow-xl border border-line-soft w-full max-w-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-line-soft bg-amber-500/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Purchase Return Detail</span>
                <h3 className="text-xl font-bold text-ink font-mono flex items-center gap-2 mt-0.5">
                  {selectedViewReturn.returnNo}
                </h3>
              </div>
              <button
                onClick={() => setSelectedViewReturn(null)}
                className="text-ink-subtle hover:text-ink p-1.5 rounded-lg hover:bg-card-2 transition"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-sm">
              {/* Key Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-card-2 p-4 rounded-xl border border-line-soft">
                <div>
                  <div className="text-xs text-ink-subtle font-medium">Return Date</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {new Date(selectedViewReturn.returnDate).toLocaleDateString("en-IN")}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-ink-subtle font-medium">Supplier</div>
                  <div className="font-semibold text-ink mt-0.5">
                    {selectedViewReturn.supplier?.legalName || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-ink-subtle font-medium">GRN Invoice Ref</div>
                  <div className="font-semibold text-ink mt-0.5 font-mono text-xs">
                    {selectedViewReturn.grnInvoice?.invoiceNo || (selectedViewReturn.grnInvoiceId ? `GRN #${selectedViewReturn.grnInvoiceId}` : "Direct Return")}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-ink-subtle font-medium">Status</div>
                  <div className="mt-0.5">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {selectedViewReturn.status}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-ink-subtle font-medium">Grand Total</div>
                  <div className="font-bold text-amber-700 mt-0.5 font-mono">
                    ₹{Number(selectedViewReturn.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-ink-subtle font-medium">Reason</div>
                  <div className="font-medium text-ink-muted mt-0.5 truncate">
                    {selectedViewReturn.reason || "-"}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-semibold text-ink mb-3 flex items-center justify-between">
                  <span>Returned Raw Materials</span>
                  <span className="text-xs font-normal text-ink-subtle">Items: {selectedViewReturn.items?.length || 0}</span>
                </h4>
                <div className="border border-line-soft rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs text-ink">
                    <thead className="bg-card-2 uppercase font-semibold text-ink-muted border-b border-line-soft">
                      <tr>
                        <th className="px-3 py-2.5">Material ID</th>
                        <th className="px-3 py-2.5">Material Name</th>
                        <th className="px-3 py-2.5 text-center">Returned Qty</th>
                        <th className="px-3 py-2.5 text-right">Unit Price (₹)</th>
                        <th className="px-3 py-2.5 text-right">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft bg-card">
                      {selectedViewReturn.items && selectedViewReturn.items.length > 0 ? (
                        selectedViewReturn.items.map((item, i) => (
                          <tr key={item.id || i} className="hover:bg-card-2/50">
                            <td className="px-3 py-2.5 font-mono text-amber-700 font-medium">
                              {item.rawMaterialId}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-ink">
                              {item.rawMaterial?.materialName || item.rawMaterial?.name || item.rawMaterialId}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-ink">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">
                              ₹{Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink">
                              ₹{(Number(item.lineTotal) || Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-ink-subtle">
                            No item details found for this return.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedViewReturn.narration && (
                <div className="bg-card-2 p-3.5 rounded-lg border border-line-soft text-xs">
                  <span className="font-semibold text-ink block mb-1">Narration / Notes:</span>
                  <p className="text-ink-muted leading-relaxed">{selectedViewReturn.narration}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-line-soft bg-card-2 flex justify-end">
              <button
                onClick={() => setSelectedViewReturn(null)}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium text-sm transition shadow-sm"
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
