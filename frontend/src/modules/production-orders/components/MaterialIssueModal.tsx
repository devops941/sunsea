import React, { useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import { productionOrderService } from "../../../services/productionOrderService";
import { storeService } from "../../../services/storeService";

interface MaterialIssueModalProps {
    show: boolean;
    onHide: () => void;
    productionOrderId: string;
    rawMaterials: Array<{
        rawMaterialId: string;
        materialName?: string;
        requiredQty: number;
    }>;
    rawMaterialsMap: Map<string, any>;
    defaultStoreId?: string | null;
    onSuccess: () => void;
}

export const MaterialIssueModal: React.FC<MaterialIssueModalProps> = ({
    show,
    onHide,
    productionOrderId,
    rawMaterials,
    rawMaterialsMap,
    defaultStoreId,
    onSuccess
}) => {
    const [issuing, setIssuing] = useState(false);
    const [stores, setStores] = useState<any[]>([]);
    const [issueItems, setIssueItems] = useState<Array<{
        rawMaterialId: string;
        materialName: string;
        reservedQty: number;
        qty: number;
        storeId: string;
        remarks: string;
    }>>([]);

    useEffect(() => {
        storeService.fetchAll()
            .then((res) => {
                const data = Array.isArray(res?.stores) ? res.stores : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                setStores(data);
            })
            .catch((err) => console.error("Failed to fetch stores", err));
    }, []);

    useEffect(() => {
        if (show && rawMaterials) {
            const items = rawMaterials.map((rm) => {
                const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                const reservedQty = Number(rm.requiredQty || 0);
                const storeId = stockRm?.storeId || defaultStoreId || "";
                return {
                    rawMaterialId: rm.rawMaterialId,
                    materialName: rm.materialName || stockRm?.materialName || rm.rawMaterialId,
                    reservedQty,
                    qty: reservedQty,
                    storeId: storeId ? String(storeId) : "",
                    remarks: ""
                };
            });
            setIssueItems(items);
        }
    }, [show, rawMaterials, rawMaterialsMap, defaultStoreId]);

    const handleQtyChange = (idx: number, val: string) => {
        const value = val === "" ? 0 : Number(val);
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].qty = value;
            return copy;
        });
    };

    const handleStoreChange = (idx: number, storeId: string) => {
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].storeId = storeId;
            return copy;
        });
    };

    const handleRemarksChange = (idx: number, remarks: string) => {
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].remarks = remarks;
            return copy;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validations
        for (const item of issueItems) {
            if (!item.storeId) {
                toast.error(`Please select a store for raw material ${item.materialName}`);
                return;
            }
            if (item.qty <= 0) {
                toast.error(`Issue quantity for ${item.materialName} must be greater than 0`);
                return;
            }
        }

        setIssuing(true);
        try {
            await productionOrderService.issueMaterials(productionOrderId, {
                items: issueItems.map(i => ({
                    rawMaterialId: i.rawMaterialId,
                    storeId: i.storeId,
                    qty: i.qty,
                    remarks: i.remarks || undefined
                }))
            });
            toast.success("Materials issued successfully!");
            onSuccess();
            onHide();
        } catch (err: any) {
            console.error("Failed to issue materials", err);
            toast.error(err.response?.data?.message || "Failed to issue materials");
        } finally {
            setIssuing(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col h-full m-0">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                        <h3 className="text-xl font-bold text-gray-800 m-0">Issue Raw Materials (PO: {productionOrderId})</h3>
                        {!issuing && (
                            <button
                                type="button"
                                onClick={onHide}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-md hover:bg-gray-200"
                            >
                                <FaTimes />
                            </button>
                        )}
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto flex-1">
                        <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-lg p-4 mb-6 text-sm">
                            Please review and confirm the quantity of raw materials you are taking from the store.
                            This will automatically update the Physical Stock (on hand) and log an approved Stock Adjustment.
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3">Raw Material</th>
                                        <th className="px-4 py-3 w-32">Reserved Qty</th>
                                        <th className="px-4 py-3 w-36">Issue Qty</th>
                                        <th className="px-4 py-3 w-48">Store Location</th>
                                        <th className="px-4 py-3">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {issueItems.map((item, idx) => (
                                        <tr key={item.rawMaterialId} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-800">{item.materialName}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{item.rawMaterialId}</div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-700">
                                                {item.reservedQty.toFixed(2)} KG
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    min="0.001"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-slate-100"
                                                    value={item.qty || ""}
                                                    onChange={(e) => handleQtyChange(idx, e.target.value)}
                                                    required
                                                    disabled={issuing}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-slate-100"
                                                    value={item.storeId}
                                                    onChange={(e) => handleStoreChange(idx, e.target.value)}
                                                    required
                                                    disabled={issuing}
                                                >
                                                    <option value="">-- Select Store --</option>
                                                    {stores.map((s) => (
                                                        <option key={s.storeId} value={s.storeId}>
                                                            {s.storeName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Batch #1 issue"
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-slate-100"
                                                    value={item.remarks}
                                                    onChange={(e) => handleRemarksChange(idx, e.target.value)}
                                                    disabled={issuing}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                        <button
                            type="button"
                            onClick={onHide}
                            disabled={issuing}
                            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 font-medium disabled:opacity-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={issuing}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center disabled:opacity-70"
                        >
                            {issuing ? (
                                <>
                                    <div className="animate-spin rounded-full border-b-2 border-white h-4 w-4 mr-2"></div>
                                    Issuing...
                                </>
                            ) : (
                                "Confirm Material Issue"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
