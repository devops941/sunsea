import React, { useState, useEffect } from "react";
import { FaTimes, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { productionOrderService } from "../../../services/productionOrderService";
import { storeService } from "../../../services/storeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";

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
    dailyPlanQty?: number | null;
    totalTargetQty?: number | null;
    onSuccess: () => void;
}

export const MaterialIssueModal: React.FC<MaterialIssueModalProps> = ({
    show,
    onHide,
    productionOrderId,
    rawMaterials,
    rawMaterialsMap,
    defaultStoreId,
    dailyPlanQty,
    totalTargetQty,
    onSuccess
}) => {
    const [issuing, setIssuing] = useState(false);
    const [stores, setStores] = useState<any[]>([]);
    const [allRawMaterials, setAllRawMaterials] = useState<any[]>([]);
    const [issueItems, setIssueItems] = useState<Array<{
        rawMaterialId: string;
        materialName: string;
        reservedQty: number;
        qty: number;
        availableStock: number;
        storeId: string;
        remarks: string;
        uom: string;
        remarkErrors: string;
        storeError: string;
        rmError: string;
        qtyError: string;
        isExtra: boolean;
    }>>([]);

    useEffect(() => {
        storeService.fetchAll()
            .then((res) => {
                const data = Array.isArray(res?.stores) ? res.stores : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                setStores(data);
            })
            .catch((err) => console.error("Failed to fetch stores", err));
        rawMaterialService.fetchAll({}).then((res: any) => {
            const list = Array.isArray(res) ? res : [];
            setAllRawMaterials(list);
        }).catch(() => { });
    }, []);

    useEffect(() => {
        if (show && rawMaterials) {
            const items = rawMaterials.map((rm) => {
                const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());

                // Calculate proportionate qty based on daily plan
                let calculatedRequiredQty = Number(rm.requiredQty || 0);
                if (dailyPlanQty && totalTargetQty && totalTargetQty > 0) {
                    calculatedRequiredQty = (calculatedRequiredQty / totalTargetQty) * dailyPlanQty;
                }
                const reservedQty = Number(calculatedRequiredQty);
                const storeId = stockRm?.storeId || defaultStoreId || "";
                const availableStock = stockRm ? (Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0)) : Number((rm as any).availableStock || 0);

                let displayUom = stockRm?.baseUom?.split(',')[0] || (rm as any).uom || stockRm?.uom || "KG";
                if (displayUom.toLowerCase() === 'ea' || displayUom.toLowerCase() === 'each') {
                    displayUom = 'pcs';
                }

                return {
                    rawMaterialId: rm.rawMaterialId,
                    materialName: rm.materialName || stockRm?.materialName || rm.rawMaterialId,
                    reservedQty,
                    qty: reservedQty,
                    availableStock,
                    storeId: storeId ? String(storeId) : "",
                    remarks: "",
                    uom: displayUom,
                    remarkErrors: "",
                    storeError: "",
                    rmError: "",
                    qtyError: "",
                    isExtra: false,
                };
            });
            setIssueItems(items);
        }
    }, [show, rawMaterials, rawMaterialsMap, defaultStoreId, dailyPlanQty, totalTargetQty]);

    const handleQtyChange = (idx: number, val: string) => {
        const value = val === "" ? 0 : Number(val);
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].qty = value;
            copy[idx].qtyError = "";
            return copy;
        });
    };

    const handleStoreChange = (idx: number, storeId: string) => {
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].storeId = storeId;
            copy[idx].storeError = "";
            return copy;
        });
    };

    const handleRemarksChange = (idx: number, remarks: string) => {
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].remarks = remarks;
            copy[idx].remarkErrors = "";
            return copy;
        });
    };

    const addRow = (afterIdx: number) => {
        setIssueItems((prev) => {
            const copy = [...prev];
            copy.splice(afterIdx + 1, 0, {
                rawMaterialId: "",
                materialName: "",
                reservedQty: 0,
                qty: 0,
                availableStock: 0,
                storeId: "",
                remarks: "",
                uom: "KG",
                remarkErrors: "",
                storeError: "",
                rmError: "",
                qtyError: "",
                isExtra: true,
            });
            return copy;
        });
    };

    const handleExtraRmChange = (idx: number, rmId: string) => {
        const rm = allRawMaterials.find(r => r.rawMaterialId === rmId);
        const stockRm = rawMaterialsMap.get(rmId);
        const availableStock = stockRm ? (Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0)) : (rm ? (Number((rm as any).onHandQty || 0) - Number((rm as any).reservedQty || 0)) : 0);
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].rawMaterialId = rmId;
            copy[idx].rmError = "";
            copy[idx].materialName = rm?.materialName || rmId;
            copy[idx].availableStock = availableStock;
            let uom = rm?.baseUom?.split(',')[0] || stockRm?.baseUom?.split(',')[0] || "KG";
            if (uom.toLowerCase() === 'ea' || uom.toLowerCase() === 'each') uom = 'pcs';
            copy[idx].uom = uom;
            return copy;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validations
        let hasError = false;
        const updated = [...issueItems];
        for (let i = 0; i < updated.length; i++) {
            const item = updated[i];
            updated[i].remarkErrors = "";
            updated[i].storeError = "";
            updated[i].rmError = "";
            updated[i].qtyError = "";
            if (item.isExtra && !item.rawMaterialId) {
                updated[i].rmError = "Please select a raw material";
                hasError = true;
            }
            if (!item.storeId) {
                updated[i].storeError = "Store is required";
                hasError = true;
            }
            if (item.qty <= 0) {
                updated[i].qtyError = "Quantity must be greater than 0";
                hasError = true;
            }
            if (item.qty > item.availableStock) {
                updated[i].qtyError = `Insufficient stock (Available: ${item.availableStock.toFixed(2)} ${item.uom})`;
                hasError = true;
            }
            // Remark is mandatory when:
            // - It's an Add Row (isExtra = true) — always required
            // - OR the qty was changed from the original reserved qty
            const qtyChanged = item.reservedQty > 0 && Math.abs(item.qty - item.reservedQty) > 0.0001;
            if ((item.isExtra || qtyChanged) && !item.remarks?.trim()) {
                updated[i].remarkErrors = "Remark is required";
                hasError = true;
            }
        }
        setIssueItems(updated);
        if (hasError) return;

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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden">
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
                        <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-lg p-4 mb-4 text-sm">
                            Please review and confirm the quantity of raw materials you are taking from the store.
                            This will automatically update the Physical Stock (on hand) and log an approved Stock Adjustment.
                        </div>

                        {dailyPlanQty !== undefined && dailyPlanQty !== null && (
                            <div className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-4 mb-6 flex justify-between items-center text-sm font-semibold">
                                <span className="text-slate-600 font-medium">Daily Plan Production Quantity:</span>
                                <span className="text-lg text-primary font-bold">
                                    {dailyPlanQty} pcs {totalTargetQty ? `/ ${totalTargetQty}` : ''}
                                </span>
                            </div>
                        )}

                        <div className="border border-slate-200 rounded-xl overflow-visible shadow-sm">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 w-36">Store Location</th>
                                        <th className="px-4 py-3">Raw Material</th>
                                        <th className="px-4 py-3 w-24">Req. Qty</th>
                                        <th className="px-4 py-3 w-28">Available Stock</th>
                                        <th className="px-4 py-3 w-28">Issue Qty</th>
                                        <th className="px-4 py-3">
                                            Remarks <span className="text-red-500 font-bold">*</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {issueItems.map((item, idx) => (
                                        <tr key={`${item.rawMaterialId || "new"}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <SelectInput
                                                    name={`store-${idx}`}
                                                    value={item.storeId}
                                                    onChange={(e) => handleStoreChange(idx, e.target.value)}
                                                    required
                                                    hideLabel
                                                    noMargin
                                                    error={item.storeError || undefined}
                                                    defaultOptionLabel="-- Select Store --"
                                                    options={stores.map((s) => ({
                                                        value: s.storeId,
                                                        label: s.storeName,
                                                    }))}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.isExtra ? (
                                                    <SelectInput
                                                        name={`rm-${idx}`}
                                                        value={item.rawMaterialId}
                                                        onChange={(e) => handleExtraRmChange(idx, e.target.value)}
                                                        required
                                                        hideLabel
                                                        noMargin
                                                        error={item.rmError || undefined}
                                                        defaultOptionLabel="-- Select Raw Material --"
                                                        options={allRawMaterials.map((rm: any) => ({
                                                            value: rm.rawMaterialId,
                                                            label: `${rm.materialName} (${rm.rawMaterialId})`,
                                                        }))}
                                                    />
                                                ) : (
                                                    <>
                                                        <div className="font-bold text-slate-800">{item.materialName}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">{item.rawMaterialId}</div>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-700">
                                                {item.reservedQty.toFixed(2)} {item.uom}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-700">
                                                {item.availableStock.toFixed(2)} {item.uom}
                                            </td>
                                            <td className="px-4 py-3">
                                                <TextInput
                                                    name={`qty-${idx}`}
                                                    type="number"
                                                    step="0.001"
                                                    value={item.qty > 0 ? String(item.qty) : ""}
                                                    onChange={(e) => handleQtyChange(idx, e.target.value)}
                                                    required
                                                    bottom
                                                    error={item.qtyError || undefined}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <TextInput
                                                    name={`remarks-${idx}`}
                                                    value={item.remarks}
                                                    placeholder="Required — e.g. Batch #1 issue"
                                                    onChange={(e) => handleRemarksChange(idx, e.target.value)}
                                                    error={item.remarkErrors || undefined}
                                                    disabled={issuing}
                                                    required
                                                    bottom
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
                                <CustomButton text="+ Add Row" variant="secondary" onClick={() => addRow(issueItems.length - 1)} />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                        <CustomButton
                            type="button"
                            onClick={onHide}
                            disabled={issuing}
                            text="Cancel"
                            variant="secondary"
                        />
                        <CustomButton
                            type="submit"
                            disabled={issuing}
                            text={issuing ? "Issuing..." : "Confirm Material Issue"}
                            variant="primary"
                        />
                    </div>
                </form>
            </div>
        </div>
    );
};
