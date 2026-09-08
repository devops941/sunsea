import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import convert from "convert-units";
import { convertUomQty, parseBaseUom } from "../../../utils/uomConversion";
import { productionOrderService } from "../../../services/productionOrderService";
import { storeService } from "../../../services/storeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import CustomButton from "../../../components/ui/Button/Button";
import AutocompleteInput from "../../../components/form/AutocompleteInput/AutocompleteInput";
import { dailyPlanService } from "../../../services/dailyPlanService";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import BusyItemsTable, { type BusyColumn } from "../../../components/form/OrderItemsTable/BusyItemsTable";

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
    const tableContainerRef = useRef<HTMLDivElement>(null);
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
        rawMaterialService.fetchAll({ limit: 1000 }).then((res: any) => {
            const list = Array.isArray(res) ? res : Array.isArray(res?.rawMaterials) ? res.rawMaterials : [];
            setAllRawMaterials(list);
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

    // Auto-focus first cell only when the modal first opens (not on every row add)
    const didAutoFocusRef = useRef(false);
    useEffect(() => {
        if (!show) { didAutoFocusRef.current = false; return; }
        if (didAutoFocusRef.current || issueItems.length === 0) return;
        didAutoFocusRef.current = true;
        const t = setTimeout(() => {
            const cell = tableContainerRef.current?.querySelector<HTMLElement>(
                '[data-r="0"][data-c="0"] input:not([disabled]), [data-r="0"][data-c="0"] [tabindex]:not([tabindex="-1"])'
            );
            cell?.focus();
        }, 120);
        return () => clearTimeout(t);
    }, [show, issueItems.length]);

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
            copy[idx].uom = newUom;
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
        const rm = allRawMaterials.find((r: any) => String(r.rawMaterialId) === String(rmId));
        const stockRm = rawMaterialsMap.get(rmId) || rawMaterialsMap.get(String(rmId));
        const onHand = Number(stockRm?.onHandQty ?? rm?.onHandQty ?? 0);
        const reserved = Number(stockRm?.reservedQty ?? rm?.reservedQty ?? 0);
        const availableStock = Math.max(0, onHand - reserved);

        // storeId can be top-level or nested under rm.store
        const autoStoreId = stockRm?.storeId
            || (rm as any)?.storeId
            || (rm as any)?.store?.storeId
            || defaultStoreId
            || "";

        setIssueItems((prev) => {
            const copy = [...prev];
            copy[idx].rawMaterialId = rmId;
            copy[idx].rmError = "";
            copy[idx].materialName = rm?.materialName || rmId;
            copy[idx].availableStock = availableStock;
            let uom = (rm as any)?.baseUom?.split(',')[0] || stockRm?.baseUom?.split(',')[0] || "kg";
            if (uom.toLowerCase() === 'ea' || uom.toLowerCase() === 'each') uom = 'pcs';
            const rawBase = stockRm?.baseUom || (rm as any)?.baseUom || (rm as any)?.uom || stockRm?.uom || uom;
            copy[idx].uom = uom;
            copy[idx].primaryUom = uom;
            copy[idx].baseUom = getUomOptions(rawBase).join(", ");
            if (autoStoreId) {
                copy[idx].storeId = String(autoStoreId);
                copy[idx].storeError = "";
            }
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

    const columns: BusyColumn<any>[] = [
        {
            key: "rawMaterialId",
            header: "Raw Material",
            width: "200px",
            render: (item: any, idx: number) => (
                item.isExtra ? (
                    <AutocompleteInput
                        inline
                        name={`rm-${idx}`}
                        value={item.rawMaterialId}
                        options={allRawMaterials
                            .filter((rm: any) => {
                                const alreadyAdded = issueItems.some((it, i) => i !== idx && String(it.rawMaterialId) === String(rm.rawMaterialId));
                                return !alreadyAdded;
                            })
                            .map((rm: any) => ({ value: rm.rawMaterialId, label: rm.materialName }))}
                        placeholder="Select Raw Material"
                        error={item.rmError || undefined}
                        onChange={(v) => handleExtraRmChange(idx, v)}
                    />
                ) : (
                    <div className="flex flex-col gap-0 px-1 leading-tight" tabIndex={0}>
                        <span className="font-bold text-ink text-[13px] truncate">{item.materialName}</span>
                        <span className="text-[10px] text-ink-subtle">{item.rawMaterialId}</span>
                        {item.reusedQtyInfo && (
                            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1 rounded mt-0.5 truncate">
                                {item.reusedQtyInfo}
                            </span>
                        )}
                    </div>
                )
            )
        },
        {
            key: "storeId",
            header: "Store Location",
            width: "160px",
            render: (item: any, idx: number) => (
                <AutocompleteInput
                    inline
                    name={`store-${idx}`}
                    value={item.storeId}
                    options={stores.map((s) => ({ value: s.storeId, label: s.storeName }))}
                    placeholder="Select Store"
                    error={item.storeError || undefined}
                    onChange={(v) => handleStoreChange(idx, v)}
                />
            )
        },
        {
            key: "reservedQty",
            header: "Req. Qty",
            width: "95px",
            align: "right",
            render: (item: any) => (
                <span className="text-[13px] font-semibold text-ink pr-1">{item.reservedQty.toFixed(2)} {item.primaryUom || item.uom}</span>
            )
        },
        {
            key: "availableStock",
            header: "Avail. Stock",
            width: "105px",
            align: "right",
            render: (item: any) => (
                <span className="text-[13px] font-semibold text-ink pr-1">{item.availableStock.toFixed(2)} {item.primaryUom || item.uom}</span>
            )
        },
        {
            key: "qty",
            header: "Issue Qty",
            width: "140px",
            render: (item: any, idx: number) => {
                const uomList = getUomOptions(item.baseUom || item.uom || "kg");
                return (
                    <div className={`flex items-center w-full h-full ${item.qtyError ? "border-b-2 border-red-500" : ""}`} title={item.qtyError || undefined}>
                        <input
                            type="number"
                            value={item.qty > 0 ? String(item.qty) : ""}
                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                            step="0.001"
                            disabled={issuing}
                            data-nav
                            placeholder="0.00"
                            className="flex-1 min-w-0 bg-transparent text-[13px] text-ink outline-none border-none h-full px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-ink-subtle/60"
                        />
                        {uomList.length > 1 ? (
                            <select
                                value={item.uom}
                                onChange={(e) => handleUomChange(idx, e.target.value)}
                                disabled={issuing}
                                className="text-xs text-ink bg-transparent border-l border-line-soft h-full px-1 focus:outline-none min-w-[42px] cursor-pointer"
                            >
                                {uomList.map(u => (
                                    <option key={u} value={u} className="bg-card text-ink">{u}</option>
                                ))}
                            </select>
                        ) : (
                            <span className="text-xs text-ink-muted px-1 h-full flex items-center border-l border-line-soft min-w-[42px]">{item.uom}</span>
                        )}
                    </div>
                );
            }
        },
        {
            key: "remarks",
            header: "Remarks *",
            width: "1fr",
            render: (item: any, idx: number) => (
                <div className={`w-full h-full flex items-center ${item.remarkErrors ? "border-b-2 border-red-500" : ""}`} title={item.remarkErrors || undefined}>
                    <input
                        type="text"
                        value={item.remarks}
                        placeholder="e.g. Batch #1 issue"
                        onChange={(e) => handleRemarksChange(idx, e.target.value)}
                        disabled={issuing}
                        data-nav
                        className="w-full bg-transparent text-[13px] text-ink outline-none border-none h-full px-1 placeholder:text-ink-subtle/60"
                    />
                </div>
            )
        },
        {
            key: "delete",
            header: "",
            width: "36px",
            align: "center",
            render: (item: any, idx: number) => (
                item.isExtra ? (
                    <DeleteButton onClick={() => removeRow(idx)} disabled={issuing} />
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
            <div ref={tableContainerRef}>
                <BusyItemsTable
                    columns={columns}
                    rows={issueItems}
                    onChange={(rows) => setIssueItems(rows)}
                    onAdd={() => addRow(issueItems.length - 1)}
                    emptyRow={{
                        rawMaterialId: "", materialName: "", reservedQty: 0, qty: 0, availableStock: 0,
                        storeId: "", remarks: "", uom: "kg", baseUom: "kg, g, pcs", primaryUom: "kg",
                        remarkErrors: "", storeError: "", rmError: "", qtyError: "", isExtra: true,
                    }}
                    rowHeight={40}
                    visibleRows={8}
                    editable={false}
                />
            </div>

            {/* Error summary */}
            {issueItems.some(item => item.storeError || item.rmError || item.qtyError || item.remarkErrors) && (
                <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 space-y-1">
                    {issueItems.flatMap((item, idx) => {
                        const errs: { row: number; msg: string }[] = [];
                        if (item.rmError) errs.push({ row: idx + 1, msg: `Raw Material: ${item.rmError}` });
                        if (item.storeError) errs.push({ row: idx + 1, msg: `Store: ${item.storeError}` });
                        if (item.qtyError) errs.push({ row: idx + 1, msg: `Issue Qty: ${item.qtyError}` });
                        if (item.remarkErrors) errs.push({ row: idx + 1, msg: `Remarks: ${item.remarkErrors}` });
                        return errs;
                    }).map((e, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-red-400 font-semibold">
                            <span className="shrink-0 bg-red-500/20 text-red-400 rounded px-1.5 py-0.5 text-[10px] font-bold">Row {e.row}</span>
                            <span>{e.msg}</span>
                        </div>
                    ))}
                </div>
            )}
        </CommonModal>
    );
};
