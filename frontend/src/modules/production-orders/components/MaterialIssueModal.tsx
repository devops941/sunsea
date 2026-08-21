import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import convert from "convert-units";
import { convertUomQty, parseBaseUom } from "../../../utils/uomConversion";
import { productionOrderService } from "../../../services/productionOrderService";
import { storeService } from "../../../services/storeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import { dailyPlanService } from "../../../services/dailyPlanService";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";

/**
 * Custom (non-library) UOM peer groups for count-based units that
 * convert-units doesn't know about.
 */
const CUSTOM_UOM_PEERS: Record<string, string[]> = {
    pcs: ["pcs", "dz", "box"],
    ea: ["pcs", "dz", "box"],
    each: ["pcs", "dz", "box"],
    dz: ["dz", "pcs"],
    box: ["box", "pcs"],
};

/** Preferred standard units we want to surface (avoids lb, oz, fl-oz, etc.) */
const PREFERRED_UNITS = new Set(["g", "kg", "t", "ml", "l", "mm", "cm", "m", "km"]);

/**
 * Derives the list of selectable UOM options for a raw material dynamically:
 * - If baseUomStr already has multiple comma-separated units, use them as-is.
 * - For standard SI units, use convert-units' possibilities() filtered to PREFERRED_UNITS.
 * - For custom count units (pcs/dz/box), fall back to CUSTOM_UOM_PEERS.
 */
const getUomOptions = (baseUomStr: string): string[] => {
    const { list } = parseBaseUom(baseUomStr);
    if (list.length > 1) return list;          // already explicit, trust it

    const primary = (list[0] || "kg").toLowerCase().trim();
    if (CUSTOM_UOM_PEERS[primary]) return CUSTOM_UOM_PEERS[primary];

    try {
        const all = (convert() as any).from(primary).possibilities() as string[];
        const peers = [primary, ...all.filter((u: string) => u !== primary && PREFERRED_UNITS.has(u))];
        return peers.length > 1 ? peers : [primary];
    } catch {
        return [primary];
    }
};

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

                        let displayUom = stockRm?.baseUom?.split(',')[0] || (rm as any).uom || stockRm?.uom || "kg";
                        if (displayUom.toLowerCase() === 'ea' || displayUom.toLowerCase() === 'each') displayUom = 'pcs';

                        const rawBase = stockRm?.baseUom || (rm as any)?.baseUom || (rm as any)?.uom || stockRm?.uom || displayUom;
                        const baseUomStr = getUomOptions(rawBase).join(", ");

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
                        let displayUom = stockRm?.baseUom?.split(',')[0] || (rm as any).uom || stockRm?.uom || "kg";
                        if (displayUom.toLowerCase() === 'ea' || displayUom.toLowerCase() === 'each') displayUom = 'pcs';

                        const rawBase = stockRm?.baseUom || (rm as any)?.baseUom || (rm as any)?.uom || stockRm?.uom || displayUom;
                        const baseUomStr = getUomOptions(rawBase).join(", ");

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
            // Dynamically convert using convert-units (falls back to raw qty on failure)
            const convertedQty = convertUomQty(currentQty, oldUom, newUom);
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
            let uom = rm?.baseUom?.split(',')[0] || stockRm?.baseUom?.split(',')[0] || "kg";
            if (uom.toLowerCase() === 'ea' || uom.toLowerCase() === 'each') uom = 'pcs';

            const rawBase = stockRm?.baseUom || (rm as any)?.baseUom || (rm as any)?.uom || stockRm?.uom || uom;
            copy[idx].uom = uom;
            copy[idx].primaryUom = uom;
            copy[idx].baseUom = getUomOptions(rawBase).join(", ");
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

            const primaryUom = item.primaryUom || "kg";
            const baseQtyToDeduct = convertUomQty(item.qty, item.uom, primaryUom);
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
                    const primaryUom = i.primaryUom || "kg";
                    const selectedUom = i.uom || primaryUom;
                    const isDifferentUnit = selectedUom.toLowerCase().trim() !== primaryUom.toLowerCase().trim();
                    const baseQtyForNote = parseFloat(convertUomQty(i.qty, selectedUom, primaryUom).toFixed(4));
                    const note = isDifferentUnit ? `Issued ${i.qty} ${selectedUom} (= ${baseQtyForNote} ${primaryUom})` : undefined;
                    const remarks = i.remarks ? (isDifferentUnit ? `${i.remarks} (${note})` : i.remarks) : note;
                    return {
                        rawMaterialId: i.rawMaterialId,
                        storeId: i.storeId,
                        // Send raw user-entered quantity + selectedUom; backend does the conversion.
                        qty: i.qty,
                        selectedUom,
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

    const columns: DataTableColumn<any>[] = [
        {
            header: "Store Location",
            width: "160px",
            render: (item: any, idx: number) => (
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
            )
        },
        {
            header: "Raw Material",
            width: "180px",
            render: (item: any, idx: number) => (
                item.isExtra ? (
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
                    <div className="flex flex-col gap-0.5">
                        <div className="font-extrabold text-ink">{item.materialName}</div>
                        <div className="text-xs text-ink-subtle font-medium">{item.rawMaterialId}</div>
                        {item.reusedQtyInfo && (
                            <div className="text-xs text-emerald-400 font-semibold mt-1 bg-emerald-500/15 px-2 py-1 rounded border border-emerald-500/30">
                                {item.reusedQtyInfo}
                            </div>
                        )}
                    </div>
                )
            )
        },
        {
            header: "Req. Qty",
            width: "100px",
            render: (item: any) => (
                <span className="font-bold text-ink">{item.reservedQty.toFixed(2)} {item.primaryUom || item.uom}</span>
            )
        },
        {
            header: "Available Stock",
            width: "110px",
            render: (item: any) => (
                <span className="font-bold text-ink">{item.availableStock.toFixed(2)} {item.primaryUom || item.uom}</span>
            )
        },
        {
            header: "Issue Qty",
            width: "170px",
            render: (item: any, idx: number) => (
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
            )
        },
        {
            header: "Remarks *",
            width: "1fr",
            render: (item: any, idx: number) => (
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
            )
        },
        {
            header: "",
            width: "48px",
            align: "center",
            render: (item: any, idx: number) => (
                item.isExtra ? (
                    <DeleteButton
                        onClick={() => removeRow(idx)}
                        disabled={issuing}
                    />
                ) : null
            )
        }
    ];

    return (
        <CommonModal
            show={show}
            onHide={issuing ? () => { } : onHide}
            title={`Issue Raw Materials (PO: ${productionOrderId})`}
            maxWidth="full"
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
            <div className="bg-blue-500/15 border border-blue-500/30 text-blue-300 rounded-xl p-4 mb-4 text-sm font-semibold">
                Please review and confirm the quantity of raw materials you are taking from the store.
                This will automatically update the Physical Stock (on hand) and log an approved Stock Adjustment.
            </div>

            {/* Daily plan qty */}
            {dailyPlanQty !== undefined && dailyPlanQty !== null && (
                <div className="bg-card-2 border border-line-soft text-ink rounded-xl p-4 mb-6 flex justify-between items-center text-sm font-bold">
                    <span className="text-ink-subtle font-semibold">Daily Plan Production Quantity:</span>
                    <span className="text-lg text-primary font-extrabold">
                        {dailyPlanQty} pcs {totalTargetQty ? `/ ${totalTargetQty}` : ''}
                    </span>
                </div>
            )}

            {/* Table */}
            <div className="border border-line-soft rounded-xl overflow-hidden bg-card shadow-xs">
                <DataTable
                    columns={columns}
                    data={issueItems}
                    rowKey={(item: any) => `${item.rawMaterialId || "new"}-${item.storeId || ""}`}
                    minHeightClassName="min-h-0"
                    maxHeightClassName="max-h-none"
                    density="compact"
                />
                <div className="px-4 py-3 border-t border-line-soft bg-card-2 flex justify-end">
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
