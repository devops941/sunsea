import React, { useState, useEffect } from "react";
import { FaBoxes, FaPlus, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService, type PurchaseReturn } from "../../../../services/returnService";
import { supplierService } from "../../../../services/supplierService";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import { useAppSelector } from "../../../../hooks/reduxHooks";

export const PurchaseReturnPage: React.FC = () => {
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { data: company } = useAppSelector((state) => state.company);

  const [supplierId, setSupplierId] = useState<string>("");
  const [rawMaterialId, setRawMaterialId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, sRes, mRes] = await Promise.all([
        returnService.fetchPurchaseReturns(),
        supplierService.fetchAll({ page: 1, limit: 100 }),
        rawMaterialService.fetchAll(),
      ]);
      setReturns(rData || []);
      const sList = Array.isArray(sRes) ? sRes : sRes?.suppliers || [];
      setSuppliers(sList);
      const mList = Array.isArray(mRes) ? mRes : [];
      setMaterials(mList);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load purchase returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !rawMaterialId || !quantity || !unitPrice || !company?.id) {
      toast.error("Please fill in required fields and ensure company context is active");
      return;
    }

    setSubmitting(true);
    try {
      await returnService.createPurchaseReturn({
        supplierId: parseInt(supplierId, 10),
        reason: reason || "Purchase Return",
        companyId: company.id,
        items: [
          {
            rawMaterialId,
            quantity: parseFloat(quantity),
            unitPrice: parseFloat(unitPrice),
            reason,
          },
        ],
      });
      toast.success("Purchase Return processed & auto-posted to accounts!");
      setShowModal(false);
      setSupplierId("");
      setRawMaterialId("");
      setReason("");
      setQuantity("");
      setUnitPrice("");
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create Purchase Return");
    } finally {
      setSubmitting(false);
    }
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
          onClick={() => setShowModal(true)}
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
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Grand Total (₹)</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono font-medium text-amber-600">{r.returnNo}</td>
                    <td className="px-4 py-3">{new Date(r.returnDate).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.supplier?.legalName || "-"}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FaBoxes className="text-amber-600" /> New Purchase Return
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Supplier</label>
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
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Raw Material</label>
                <select
                  value={rawMaterialId}
                  onChange={(e) => setRawMaterialId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                >
                  <option value="">Select Raw Material</option>
                  {materials.map((m) => (
                    <option key={m.rawMaterialId || m.id} value={m.rawMaterialId || m.id}>
                      {m.rawMaterialId} - {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Reason for Return</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Substandard raw material quality"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
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
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Submit Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
