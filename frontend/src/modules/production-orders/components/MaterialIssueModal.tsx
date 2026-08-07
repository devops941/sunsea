import React, { useState, useEffect } from "react";
import { FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { productionOrderService } from "../../../services/productionOrderService";
import { storeService } from "../../../services/storeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import { dailyPlanService } from "../../../services/dailyPlanService";
import CommonModal from "../../../components/ui/Modal/CommonModal";

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
        baseUom?: string;
        primaryUom?: string;
        remarkErrors: string;
        storeError: string;
        rmError: string;
        qtyError: string;
        isExtra: boolean;
        reusedQtyInfo?: string;
    }>>([]);

    useEffect(() => {
        storeService.fetchAll({ storeCategory: "RAW_MATERIAL" })
            .then((res) => {
                const data = Array.isArray(res?.stores) ? res.stores : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                setStores(data);
            })
            .catch((err) => console.error("Failed to fetch stores", err));
        rawMaterialService.fetchAll({}).then((res: any) => {
            const list = Array.isArray(res) ? res : [];
            const rmOnly = list.filter((rm: any) =>
                rm.itemType !== "WASTAGE" &&
                rm.store?.storeCategory !== "WASTAGE" &&
                !rm.store?.storeName?.toLowerCase().includes("wastage") &&
                !rm.category?.categoryName?.toLowerCase().includes("wastage") &&
                !rm.materialName?.toLowerCase().startsWith("wastage")
            );
            setAllRawMaterials(rmOnly);
        }).catch(() => { });
    }, []);

    useEffect(() => {
        if (show && rawMaterials) {
            dailyPlanService.getAll({ productionOrderId })
                .then((res: any) => {
                    const plans = Array.isArray(res?.dailyPlans) ? res.dailyPlans : Array.isArray(res) ? res : [];
                    const finishedStatuses = ["COMPLETED", "SHORT_CLOSED", "STOPPED", "POST_PRODUCTION", "PARTIAL_COMPLETED", "COMPLETED_WITH_SHORTFALL"];
                    const pastPlans = plans.filter((p: any) => finishedStatuses.includes(p.status));

                    let totalUnusedPlannedQty = 0;
                    pastPlans.forEach((p: any) => {
                        const planned = Number(p.plannedQty || 0);
                        const produced = Array.isArray(p.hourlyProductions)
                            ? p.hourlyProductions.reduce((s: number, h: any) => s + Number(h.qtyProduced || 0), 0)
                            : 0;
                        if (planned > produced) totalUnusedPlannedQty += (planned - produced);
                    });

                    const items = rawMaterials.map((rm) => {
                        const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                        const totalPOQty = Number(rm.requiredQty || 0);
                        const targetQty = Number(totalTargetQty || 0);
                        const factor = targetQty > 0 ? (totalPOQty / targetQty) : 0;

                        const unusedMaterialQty = totalUnusedPlannedQty * factor;
                        const newPlannedRequiredMaterial = (dailyPlanQty || 0) * factor;
                        const finalIssueQty = parseFloat(Math.max(0, newPlannedRequiredMaterial - unusedMaterialQty).toFixed(3));

                        const storeId = stockRm?.storeId || defaultStoreId || "";
                        const totalReserved = Number(stockRm?.reservedQty || 0);
                        const onHand = Number(stockRm?.onHandQty || 0);
                        const reservedForOther = Math.max(0, totalReserved - newPlannedRequiredMaterial);
                        const availableStock = stockRm
                            ? Math.max(0, onHand - reservedForOther)
                            : Number((rm as any).availableStock || 0);

                        let displayUom = stockRm?.baseUom?.split(',')[0] || (rm as any).uom || stockRm?.uom || "KG";
                        if (displayUom.toLowerCase() === 'ea' || displayUom.toLowerCase() === 'each') displayUom = 'pcs';

                        let rawBase = stockRm?.baseUom || (rm as any)?.baseUom || (rm as any)?.uom || stockRm?.uom || displayUom;
                        let uomList = String(rawBase).split(",").map((u: string) => u.trim()).filter(Boolean);
                        if (uomList.length <= 1) {
                            const firstLower = (uomList[0] || displayUom).toLowerCase();
                            if (firstLower === "kg" || firstLower === "g") uomList = ["kg", "g"];
                            else if (firstLower === "pcs" || firstLower === "ea" || firstLower === "each") uomList = ["pcs", "box"];
                            else if (firstLower === "m" || firstLower === "meter" || firstLower === "cm") uomList = ["m", "cm"];
                            else uomList = [displayUom];
                        }
                        const baseUomStr = uomList.join(", ");

                        let reusedQtyInfo = "";
                        if (unusedMaterialQty > 0) {
                            reusedQtyInfo = `${unusedMaterialQty.toFixed(2)} ${displayUom} unused from previous shift, issuing ${finalIssueQty.toFixed(2)} ${displayUom} (instead of ${newPlannedRequiredMaterial.toFixed(2)} ${displayUom})`;
                        }

                        return {
                            rawMaterialId: rm.rawMaterialId,
                            materialName: rm.materialName || stockRm?.materialName || rm.rawMaterialId,
                            reservedQty: newPlannedRequiredMaterial,
                            qty: finalIssueQty,
                            availableStock,
                            storeId: storeId ? String(storeId) : "",
                            remarks: unusedMaterialQty > 0 ? `Unused balance of ${unusedMaterialQty.toFixed(2)} ${displayUom} from past shift adjusted.` : "",
                            uom: displayUom,
                            baseUom: baseUomStr,
                            primaryUom: displayUom,
                            remarkErrors: "",
                            storeError: "",
                            rmError: "",
                            qtyError: "",
                            isExtra: false,
                            reusedQtyInfo,
                        };
                    });
                    setIssueItems(items);
                })
                .catch(() => {
                    const items = rawMaterials.map((rm) => {
                        const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                        let calculatedRequiredQty = Number(rm.requiredQty || 0);
                        if (dailyPlanQty && totalTargetQty && totalTargetQty > 0) {
                            calculatedRequiredQty = (calculatedRequiredQty / totalTargetQty) * dailyPlanQty;
                        }
                        const reservedQty = Number(calculatedRequiredQty);
                        const storeId = stockRm?.storeId || defaultStoreId || "";
                        const totalReserved = Number(stockRm?.reservedQty || 0);
                        const onHand = Number(stockRm?.onHandQty || 0);
                        const reservedForOther = Math.max(0, totalReserved - reservedQty);
                        const availableStock = stockRm ? Math.max(0, onHand - reservedForOther) : Number((rm as any).availableStock || 0);
                        let displayUom = stockRm?.baseUom?.split(',')[0] || (rm as any).uom || stockRm?.uom || "KG";
                        if (displayUom.toLowerCase() === 'ea' || displayUom.toLowerCase() === 'each') displayUom = 'pcs';

                        let rawBase = stockRm?.baseUom || (rm as any)?.baseUom || (rm as any)?.uom || stockRm?.uom || displayUom;
                        let uomList = String(rawBase).split(",").map((u: string) => u.trim()).filter(Boolean);
                        if (uomList.length <= 1) {
                            const firstLower = (uomList[0] || displayUom).toLowerCase();
                            if (firstLower === "kg" || firstLower === "g") uomList = ["kg", "g"];
                            else if (firstLower === "pcs" || firstLower === "ea" || firstLower === "each") uomList = ["pcs", "box"];
                            else if (firstLower === "m" || firstLower === "meter" || firstLower === "cm") uomList = ["m", "cm"];
                            else uomList = [displayUom];
                        }
                        const baseUomStr = uomList.join(", ");

                        return {
                            rawMaterialId: rm.rawMaterialId,
                            materialName: rm.materialName || stockRm?.materialName || rm.rawMaterialId,
                            reservedQty,
                            qty: reservedQty,
                            availableStock,
                            storeId: storeId ? String(storeId) : "",
                            remarks: "",
                            uom: displayUom,
                            baseUom: baseUomStr,
                            primaryUom: displayUom,
                            remarkErrors: "",
                            storeError: "",
                            rmError: "",
                            qtyError: "",
                            isExtra: false,
                        };
                    });
                    setIssueItems(items);
                });
        }
    }, [show, rawMaterials, rawMaterialsMap, defaultStoreId, dailyPlanQty, totalTargetQty, productionOrderId]);

    const convertToBaseQty = (qty: number, selectedUom: string, primaryBaseUom: string): number => {
        if (!selectedUom || !primaryBaseUom || qty === 0) return qty;
        const sel = selectedUom.toLowerCase().trim();
        const primary = primaryBaseUom.toLowerCase().split(',')[0].trim();

        if (sel === primary) return qty;

        // Weight/Mass conversions (Primary is KG)
        if ((primary === "kg" || primary === "kilogram") && sel === "g") return qty / 1000;
        if ((primary === "kg" || primary === "kilogram") && (sel === "ton" || sel === "t")) return qty * 1000;
        if ((primary === "g" || primary === "gram") && sel === "kg") return qty * 1000;

        // Liquid/Volume conversions (Primary is L)
        if ((primary === "l" || primary === "litre" || primary === "liter") && sel === "ml") return qty / 1000;
        if ((primary === "ml") && (sel === "l" || sel === "litre" || sel === "liter")) return qty * 1000;

        // Length conversions (Primary is M)
        if ((primary === "m" || primary === "meter") && sel === "cm") return qty / 100;
        if ((primary === "m" || primary === "meter") && sel === "mm") return qty / 1000;
        if (primary === "cm" && sel === "m") return qty * 100;
        if (primary === "mm" && sel === "m") return qty * 1000;

        return qty;
    };

    const convertQtyForUomChange = (qty: number, oldUom: string, newUom: string): number => {
        if (!qty || !oldUom || !newUom || oldUom.toLowerCase() === newUom.toLowerCase()) return qty;
        const oldU = oldUom.toLowerCase().trim();
        const newU = newUom.toLowerCase().trim();

        // Weight
        if (oldU === "kg" && newU === "g") return qty * 1000;
        if (oldU === "g" && newU === "kg") return qty / 1000;

        // Liquid
        if (oldU === "l" && newU === "ml") return qty * 1000;
        if (oldU === "ml" && newU === "l") return qty / 1000;

        // Length
        if (oldU === "m" && newU === "cm") return qty * 100;
        if (oldU === "cm" && newU === "m") return qty / 100;

        return qty;
    };

    const handleQtyChange = (idx: number, val: string, newUom?: string) => {
        const value = val === "" ? 0 : Number(val);
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].qty = value;
            if (newUom) copy[idx].uom = newUom;
            copy[idx].qtyError = "";
            return copy;
        });
    };

    const handleUomChange = (idx: number, newUom: string) => {
        setIssueItems((prev) => {
            const copy = [...prev];
            const oldUom = copy[idx].uom || "kg";
            const currentQty = copy[idx].qty;
            const convertedQty = convertQtyForUomChange(currentQty, oldUom, newUom);
            copy[idx].uom = newUom;
            copy[idx].qty = parseFloat(convertedQty.toFixed(3));
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
                uom: "kg",
                baseUom: "kg, g, pcs",
                primaryUom: "kg",
                remarkErrors: "",
                storeError: "",
                rmError: "",
                qtyError: "",
                isExtra: true,
            });
            return copy;
        });
    };

    const removeRow = (idx: number) => {
        setIssueItems((prev) => {
            const copy = [...prev];
            copy.splice(idx, 1);
            return copy;
        });
    };

    const handleExtraRmChange = (idx: number, rmId: string) => {
        const rm = allRawMaterials.find(r => r.rawMaterialId === rmId);
        const stockRm = rawMaterialsMap.get(rmId);
        const availableStock = stockRm
            ? (Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0))
            : (rm ? (Number((rm as any).onHandQty || 0) - Number((rm as any).reservedQty || 0)) : 0);
        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].rawMaterialId = rmId;
            copy[idx].rmError = "";
            copy[idx].materialName = rm?.materialName || rmId;
            copy[idx].availableStock = availableStock;
            let uom = rm?.baseUom?.split(',')[0] || stockRm?.baseUom?.split(',')[0] || "KG";
            if (uom.toLowerCase() === 'ea' || uom.toLowerCase() === 'each') uom = 'pcs';

            let rawBase = stockRm?.baseUom || (rm as any)?.baseUom || (rm as any)?.uom || stockRm?.uom || uom;
            let uomList = String(rawBase).split(",").map((u: string) => u.trim()).filter(Boolean);
            if (uomList.length <= 1) {
                const firstLower = (uomList[0] || uom).toLowerCase();
                if (firstLower === "kg" || firstLower === "g") uomList = ["kg", "g"];
                else if (firstLower === "pcs" || firstLower === "ea" || firstLower === "each") uomList = ["pcs", "box"];
                else if (firstLower === "m" || firstLower === "meter" || firstLower === "cm") uomList = ["m", "cm"];
                else uomList = [uom];
            }
            copy[idx].uom = uom;
            copy[idx].primaryUom = uom;
            copy[idx].baseUom = uomList.join(", ");
            return copy;
        });
    };

    const doSubmit = async () => {
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

            const primaryUom = item.primaryUom || "KG";
            const baseQtyToDeduct = convertToBaseQty(item.qty, item.uom, primaryUom);
            if (baseQtyToDeduct > item.availableStock) {
                updated[i].qtyError = `Insufficient stock (Available: ${item.availableStock.toFixed(2)} ${primaryUom})`;
                hasError = true;
            }
            const qtyChanged = item.reservedQty > 0 && Math.abs(baseQtyToDeduct - item.reservedQty) > 0.0001;
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
                items: issueItems.map(i => {
                    const primaryUom = i.primaryUom || "KG";
                    const baseQty = parseFloat(convertToBaseQty(i.qty, i.uom, primaryUom).toFixed(4));
                    const isDifferentUnit = i.uom.toLowerCase() !== primaryUom.toLowerCase();
                    const note = isDifferentUnit ? `Issued ${i.qty} ${i.uom} (= ${baseQty} ${primaryUom})` : undefined;
                    const remarks = i.remarks ? (isDifferentUnit ? `${i.remarks} (${note})` : i.remarks) : note;
                    return {
                        rawMaterialId: i.rawMaterialId,
                        storeId: i.storeId,
                        qty: baseQty,
                        remarks: remarks || undefined
                    };
                })
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

    return (
        <CommonModal
            show={show}
            onHide={issuing ? () => {} : onHide}
            title={`Issue Raw Materials (PO: ${productionOrderId})`}
            maxWidth="7xl"
            footer={
                <>
                    <CustomButton
                        type="button"
                        onClick={onHide}
                        disabled={issuing}
                        text="Cancel"
                        variant="secondary"
                    />
                    <CustomButton
                        type="button"
                        onClick={doSubmit}
                        disabled={issuing}
                        text={issuing ? "Issuing..." : "Confirm Material Issue"}
                        variant="primary"
                    />
                </>
            }
        >
            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-lg p-4 mb-4 text-sm">
                Please review and confirm the quantity of raw materials you are taking from the store.
                This will automatically update the Physical Stock (on hand) and log an approved Stock Adjustment.
            </div>

            {/* Daily plan qty */}
            {dailyPlanQty !== undefined && dailyPlanQty !== null && (
                <div className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-4 mb-6 flex justify-between items-center text-sm font-semibold">
                    <span className="text-slate-600 font-medium">Daily Plan Production Quantity:</span>
                    <span className="text-lg text-primary font-bold">
                        {dailyPlanQty} pcs {totalTargetQty ? `/ ${totalTargetQty}` : ''}
                    </span>
                </div>
            )}

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full min-w-[800px] text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <tr>
                            <th className="px-4 py-3 w-36">Store Location</th>
                            <th className="px-4 py-3">Raw Material</th>
                            <th className="px-4 py-3 w-24">Req. Qty</th>
                            <th className="px-4 py-3 w-28">Available Stock</th>
                            <th className="px-4 py-3 min-w-[200px]">Issue Qty</th>
                            <th className="px-4 py-3">
                                Remarks <span className="text-red-500 font-bold">*</span>
                            </th>
                            <th className="px-4 py-3 w-12 text-center"></th>
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
                                            options={allRawMaterials
                                                 .filter((rm: any) => {
                                                     if (rm.itemType === "WASTAGE") return false;
                                                     if (rm.store?.storeCategory === "WASTAGE") return false;
                                                     if (rm.store?.storeName?.toLowerCase().includes("wastage")) return false;
                                                     if (rm.category?.categoryName?.toLowerCase().includes("wastage")) return false;
                                                     if (rm.materialName?.toLowerCase().startsWith("wastage")) return false;
                                                     if (item.storeId && rm.storeId && String(rm.storeId) !== String(item.storeId)) return false;
                                                     return true;
                                                 })
                                                 .map((rm: any) => ({
                                                     value: rm.rawMaterialId,
                                                     label: `${rm.materialName} (${rm.rawMaterialId})`,
                                                 }))}
                                        />
                                    ) : (
                                        <>
                                            <div className="font-bold text-slate-800">{item.materialName}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{item.rawMaterialId}</div>
                                            {item.reusedQtyInfo && (
                                                <div className="text-xs text-emerald-600 font-medium mt-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                                    {item.reusedQtyInfo}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-700">
                                    {item.reservedQty.toFixed(2)} {item.uom}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-700">
                                    {item.availableStock.toFixed(2)} {item.uom}
                                </td>
                                <td className="px-4 py-3 min-w-[200px]">
                                    <QuantityInput
                                        name={`qty-${idx}`}
                                        value={item.qty > 0 ? String(item.qty) : ""}
                                        baseUoms={item.baseUom || item.uom || "kg, g"}
                                        uom={item.uom}
                                        onChange={(e: any) => handleQtyChange(idx, e.target.value, e.target.uom)}
                                        onUomChange={(newUom: string) => handleUomChange(idx, newUom)}
                                        disabled={issuing}
                                        hideLabel
                                        step="0.001"
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
                                <td className="px-4 py-3 text-center">
                                    {item.isExtra && (
                                        <button
                                            type="button"
                                            onClick={() => removeRow(idx)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors focus:outline-none"
                                            title="Remove Row"
                                        >
                                            <FaTrash size={14} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
                    <CustomButton
                        type="button"
                        text="+ Add Row"
                        variant="secondary"
                        onClick={() => addRow(issueItems.length - 1)}
                    />
                </div>
            </div>
        </CommonModal>
    );
};
