import { formatDate } from "../../../utils/dateUtils";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useLocation, useParams } from "react-router-dom";
import { 
    FaInfoCircle,
    FaIndustry,
    FaTruck,
    FaWarehouse,
    FaCheckCircle,
} from "react-icons/fa";
import { productionOrderService } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { stockAdjustmentService } from "../../../services/stockAdjustmentService";
import { dailyPlanService } from "../../../services/dailyPlanService";
import BackButton from "../../../components/ui/BackButton/BackButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import apiClient from "../../../api/apiClient";
import config from "../../../api/config";
import { useSocketSync } from "../../../hooks/useSocketSync";

const PRODUCTION_STARTED_STATUSES = [
    "WEEKLY_SCHEDULED", "DAILY_PLANNED", "IN_PROGRESS", "IN_PRODUCTION",
    "POST_PRODUCTION", "READY_FOR_DISPATCH", "PARTIAL_COMPLETED",
    "COMPLETED_WITH_SHORTFALL", "DISPATCHED", "CLOSED", "CANCELLED",
];

const formatDateTime = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-IN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
};

const normalizeUom = (uom?: string) => {
    const u = (uom || "").toLowerCase();
    return u === "ea" || u === "each" ? "pcs" : uom || "KG";
};

// ── Main page ─────────────────────────────────────────────────────────────────

const ProductionOrderHistoryView: React.FC = () => {
    const location = useLocation();
    const { id } = useParams<{ id: string }>();

    const [passedOrder] = useState<any>(location.state?.order || null);
    const [fullOrder, setFullOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());
    const [rmIssues, setRmIssues] = useState<any[]>([]);

    // State for Shift Hourly Production Modal
    const [selectedShiftForHourly, setSelectedShiftForHourly] = useState<any | null>(null);
    const [hourlyDetailsLoading, setHourlyDetailsLoading] = useState(false);
    const [hourlyDetails, setHourlyDetails] = useState<any[]>([]);

    // ── Load raw materials map ────────────────────────────────────────────────
    useEffect(() => {
        rawMaterialService.fetchAll()
            .then((data) => {
                const arr = Array.isArray(data) ? data : ((data as any)?.rawMaterials ?? []);
                const map = new Map<string, any>();
                arr.forEach((rm: any) => map.set(rm.rawMaterialId?.toString(), rm));
                setRawMaterialsMap(map);
            })
            .catch(() => {});
    }, []);

    // ── Fetch RM issues (stock adjustments) for this PO ──────────────────────
    const fetchRmIssues = useCallback(() => {
        if (!id) return;
        stockAdjustmentService.fetchAll({ productionOrderId: id, pageSize: 200 })
            .then((res: any) => {
                const list: any[] = Array.isArray(res) ? res : (res?.data ?? res?.adjustments ?? []);
                // Group by adjustment — each entry is one adjustment with its items
                const groups = list.map((adj: any) => ({
                    adjId: adj.id,
                    adjustmentNumber: adj.adjustmentNumber,
                    date: adj.adjustmentDate,
                    reason: adj.reason || "-",
                    items: (adj.items || []).map((item: any) => ({
                        rawMaterialName: item.rawMaterial?.materialName || item.product?.productName || "-",
                        rawMaterialCode: item.rawMaterial?.rawMaterialId || item.product?.productCode || "-",
                        store: item.store?.storeName || "-",
                        currentQty: Number(item.currentQty ?? 0),
                        adjustedQty: Number(item.adjustedQty ?? 0),
                        difference: Number(item.difference ?? 0),
                        uom: normalizeUom(item.rawMaterial?.baseUom?.split(",")[0] || item.uom || "KG"),
                        remarks: item.remarks || "-",
                    })),
                }));
                setRmIssues(groups);
            })
            .catch(() => {});
    }, [id]);

    // ── Fetch order details ───────────────────────────────────────────────────
    const fetchOrderDetails = useCallback(async (orderToFetch: any) => {
        setLoading(true);
        try {
            const rawId = orderToFetch.productionOrderId || orderToFetch.id || id;
            let childPOs = orderToFetch.children || orderToFetch.items || [];

            if (!childPOs || childPOs.length === 0) {
                try {
                    const single = await productionOrderService.getById(rawId);
                    if (single) childPOs = [single];
                } catch {
                    // Try finding children with baseId
                    const allRes = await productionOrderService.fetchAll({ pageSize: 1000, search: rawId });
                    const list = (allRes as any)?.data || (Array.isArray(allRes) ? allRes : []);
                    const matched = list.filter((p: any) => p.productionOrderId === rawId || p.productionOrderId?.startsWith(`${rawId}-`));
                    if (matched.length > 0) childPOs = matched;
                }
            }

            if (!childPOs || childPOs.length === 0) {
                setFullOrder(null);
                return;
            }

            // Fetch complete details for each child PO
            const dataArray = await Promise.all(
                childPOs.map((c: any) => productionOrderService.getById(c.productionOrderId || c.id || rawId).catch(() => c))
            );

            const validData = dataArray.filter(Boolean);
            if (validData.length === 0) { setFullOrder(null); return; }

            const merged: any = { ...validData[0] };
            merged.products = validData.map((d: any) => ({
                productName: d.productItem?.productName || d.productName || "Unknown",
                productCode: d.productItem?.productCode || d.productCode || "Unknown",
                quantity: d.targetQty || 0,
                uom: d.uom || d.productItem?.uom || "pcs",
                weightPerPieceUsed: d.productItem?.weightPerPiece || 0,
                rawMaterials: d.draftRawMaterials || d.rawMaterials || [],
                productionOrderId: d.productionOrderId,
                status: d.status,
            }));
            merged.dailyProductionPlans = validData.flatMap((d: any) => d.dailyProductionPlans || []);
            merged.goodsDispatchItems = validData.flatMap((d: any) => d.goodsDispatchItems || []);
            merged.productionOrderId = rawId;
            merged.targetQty = validData.reduce((sum: number, d: any) => sum + Number(d.targetQty || 0), 0);
            merged.producedQty = validData.reduce((sum: number, d: any) => sum + Number(d.producedQty || 0), 0);
            setFullOrder(merged);
        } catch (err) {
            console.error("Failed to load Production Order Details:", err);
            toast.error("Failed to load production order details");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (passedOrder) fetchOrderDetails(passedOrder);
        else if (id) fetchOrderDetails({ id });
    }, [passedOrder, id, fetchOrderDetails]);

    useEffect(() => { fetchRmIssues(); }, [fetchRmIssues]);

    useSocketSync("productionOrder", undefined, () => {
        if (passedOrder) fetchOrderDetails(passedOrder);
        else if (id) fetchOrderDetails({ id });
    });

    // ── Derived values ────────────────────────────────────────────────────────
    const displayOrder = fullOrder || passedOrder || {};
    const productionHasStarted = PRODUCTION_STARTED_STATUSES.includes(fullOrder?.status);

    const hasInsufficientStock = !productionHasStarted && fullOrder?.products?.some((p: any) =>
        p.rawMaterials?.some((rm: any) => {
            const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
            const required = Number(rm.requiredQty || 0);
            let available = stockRm
                ? Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0)
                : Number(rm.availableStock || 0);
            if (["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULED"].includes(fullOrder?.status) && stockRm) {
                available += required;
            }
            return rm.status ? rm.status === "INSUFFICIENT" : available < required;
        })
    );

    // ── Plans (shift-wise) ────────────────────────────────────────────────────
    const plans: any[] = useMemo(() => {
        if (!fullOrder?.dailyProductionPlans?.length) return [];
        return [...fullOrder.dailyProductionPlans]
            .sort((a: any, b: any) => {
                const dA = new Date(a.productionDate || 0).getTime();
                const dB = new Date(b.productionDate || 0).getTime();
                if (dA !== dB) return dA - dB;
                return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            })
            .map((plan: any) => {
                // Calculate net good produced quantity for this shift plan (Gross Produced minus Rejections)
                const hps = plan.hourlyProductions || [];
                let shiftGrossProduced = 0;
                let shiftReject = 0;
                let shiftScrap = 0;

                if (hps.length > 0) {
                    hps.forEach((hp: any) => {
                        // In Prisma model HourlyProduction, fields are totalQtyProduced, totalRejectQty, totalScrapQty
                        const gross = Number(hp.totalQtyProduced !== undefined ? hp.totalQtyProduced : hp.qtyProduced || 0);
                        const rej = Number(hp.totalRejectQty !== undefined ? hp.totalRejectQty : hp.rejectQty || 0);
                        const scrap = Number(hp.totalScrapQty !== undefined ? hp.totalScrapQty : hp.scrapQty || 0);
                        
                        shiftGrossProduced += gross;
                        shiftReject += rej;
                        shiftScrap += scrap;
                    });
                }

                // If dailyPlan itself has direct producedQty recorded
                const directGross = Number(plan.producedQty || plan.totalProducedQty || 0);
                const directRej = Number(plan.rejectQty || 0);
                if (shiftGrossProduced === 0 && directGross > 0) {
                    shiftGrossProduced = directGross;
                    shiftReject = directRej;
                }

                // Net Good Produced Quantity = Gross Produced - Rejections
                const hourlyNetGood = Math.max(0, shiftGrossProduced - shiftReject);

                const isPermanentStop = (fullOrder?.status === "COMPLETED_WITH_SHORTFALL") || (plan.productionOrder?.status === "COMPLETED_WITH_SHORTFALL");
                // Extract stop reason from remarks (format: "Short Closed: reason | Stopped: reason")
                const rawRemarks = plan.remarks || "";
                let stopReason: string | null = null;
                if (rawRemarks) {
                    const parts = rawRemarks.split("|");
                    const reasonPart = parts[parts.length - 1] || "";
                    const cleaned = reasonPart
                        .replace(/Permanently Stopped:/i, "")
                        .replace(/Short Closed:/i, "")
                        .replace(/Stopped:/i, "")
                        .replace(/Cancelled:/i, "")
                        .trim();
                    if (cleaned) stopReason = cleaned;
                }
                const plannedQty = Number(plan.plannedQty || 0);

                // Use actual net good produced quantity if production occurred; fallback to planned only if COMPLETED with zero production logs
                const producedQty = shiftGrossProduced > 0 
                    ? hourlyNetGood 
                    : (plan.status === "COMPLETED" && !isPermanentStop ? plannedQty : 0);

                // A COMPLETED plan that produced less than planned was stopped early → show shortfall status
                let displayStatus = plan.status || "PLANNED";
                if (displayStatus === "COMPLETED" && plannedQty > 0 && producedQty > 0 && producedQty < plannedQty) {
                    displayStatus = "COMPLETED_WITH_SHORTFALL";
                }

                const matchingProd = fullOrder?.products?.find((p: any) => p.productionOrderId === (plan.productionOrderId || plan.productionOrder?.productionOrderId));
                const productName = matchingProd?.productName
                    || plan.productionOrder?.productItem?.productName 
                    || plan.productionOrder?.productName 
                    || plan.productItem?.productName 
                    || fullOrder?.productItem?.productName 
                    || fullOrder?.productName 
                    || (fullOrder?.products && fullOrder.products.length === 1 ? fullOrder.products[0].productName : "-");

                const productCode = matchingProd?.productCode
                    || plan.productionOrder?.productItem?.productCode 
                    || plan.productionOrder?.productCode 
                    || plan.productItem?.productCode 
                    || fullOrder?.productItem?.productCode 
                    || fullOrder?.productCode 
                    || (fullOrder?.products && fullOrder.products.length === 1 ? fullOrder.products[0].productCode : "");

                return {
                    id: plan.dailyPlanId,
                    date: plan.productionDate ? formatDate(plan.productionDate) : "-",
                    shiftName: plan.shift?.shiftName || plan.shiftId || "-",
                    machineName: plan.machine?.machineName || plan.machineId || fullOrder?.Machine?.machineName || "-",
                    productName,
                    productCode,
                    plannedQty,
                    producedQty,
                    status: displayStatus,
                    stopReason,
                    rawPlan: plan,
                    hourlyProductions: plan.hourlyProductions || [],
                };
            });
    }, [fullOrder]);

    const totalDispatchedQty = useMemo(() =>
        fullOrder?.goodsDispatchItems?.reduce((sum: number, item: any) => sum + Number(item.dispatchQty || 0), 0) ?? 0,
        [fullOrder]
    );

    // Pre-compute dispatch status per shift in a single pass (fixes mutable closure bug)
    const plansWithDispatch = useMemo(() => {
        let cumulative = 0;
        return plans.map((plan) => {
            const hasProduction = plan.producedQty > 0;
            const isFinalized = (plan.status === "COMPLETED" || plan.status === "COMPLETED_WITH_SHORTFALL") && hasProduction;
            if (isFinalized) cumulative += plan.producedQty;

            let dispatchStatus: string;
            if (!hasProduction) {
                dispatchStatus = "no_production";
            } else if (isFinalized && totalDispatchedQty > 0 && cumulative <= totalDispatchedQty + 0.001) {
                dispatchStatus = "dispatched";
            } else if (isFinalized) {
                dispatchStatus = "ready";
            } else {
                dispatchStatus = "not_dispatched";
            }

            return { ...plan, dispatchStatus };
        });
    }, [plans, totalDispatchedQty]);

    const targetVal = Number(fullOrder?.targetQty || displayOrder?.targetQty || 0);
    const producedVal = useMemo(() => {
        if (plans.length > 0) {
            return plans.reduce((total: number, plan: any) => total + Number(plan.producedQty || 0), 0);
        }
        return Number(fullOrder?.producedQty || displayOrder?.producedQty || 0);
    }, [plans, fullOrder, displayOrder]);

    const extractHourlyEntriesFromRecords = useCallback((records: any[]): any[] => {
        const entries: any[] = [];
        if (!Array.isArray(records)) return entries;

        records.forEach((hp: any) => {
            if (!hp) return;
            let subEntries = hp.hourlyEntries;
            if (typeof subEntries === "string") {
                try {
                    subEntries = JSON.parse(subEntries);
                } catch {
                    subEntries = [];
                }
            }

            if (Array.isArray(subEntries) && subEntries.length > 0) {
                subEntries.forEach((e: any, idx: number) => {
                    const hourIdx = Number(e.hourIndex ?? (idx + 1));
                    const timeSlotLabel = e.timeSlot || (hourIdx ? `Hour ${hourIdx}` : `Slot ${idx + 1}`);
                    const produced = Number(e.qtyProduced ?? 0);
                    const reject = Number(e.rejectQty ?? 0);
                    const scrap = Number(e.scrapQty ?? 0);
                    const downtime = Number(e.downtime ?? 0);
                    const netProduced = Math.max(0, produced - reject);

                    entries.push({
                        id: `${hp.hourlyProductionId || hp.id || "hp"}-${hourIdx}-${idx}`,
                        hourIndex: hourIdx,
                        timeSlot: timeSlotLabel,
                        qtyProduced: produced,
                        netProducedQty: netProduced,
                        rejectQty: reject,
                        scrapQty: scrap,
                        downtime: downtime,
                        downtimeReason: e.downtimeReason || e.reasonDescription || hp.downtimeReason || "-",
                        operatorName: e.operatorName || hp.operatorName || hp.Operator?.fullName || hp.Operator?.name || "-",
                        remarks: e.remarks || hp.remarks || "-",
                        status: e.status || hp.status || "-",
                    });
                });
            } else if (hp.hourIndex !== undefined || hp.timeSlot || hp.qtyProduced !== undefined || hp.totalQtyProduced !== undefined) {
                const hourIdx = Number(hp.hourIndex || 1);
                const produced = Number(hp.totalQtyProduced !== undefined ? hp.totalQtyProduced : hp.qtyProduced || 0);
                const reject = Number(hp.totalRejectQty !== undefined ? hp.totalRejectQty : hp.rejectQty || 0);
                const scrap = Number(hp.totalScrapQty !== undefined ? hp.totalScrapQty : hp.scrapQty || 0);
                const downtime = Number(hp.downtime || hp.totalDowntime || 0);
                const netProduced = Math.max(0, produced - reject);

                entries.push({
                    id: `${hp.hourlyProductionId || hp.id || "hp"}-${hourIdx}`,
                    hourIndex: hourIdx,
                    timeSlot: hp.timeSlot || (hp.hourIndex ? `Hour ${hp.hourIndex}` : "Shift Summary"),
                    qtyProduced: produced,
                    netProducedQty: netProduced,
                    rejectQty: reject,
                    scrapQty: scrap,
                    downtime: downtime,
                    downtimeReason: hp.downtimeReason || hp.reasonDescription || "-",
                    operatorName: hp.operatorName || hp.Operator?.fullName || hp.Operator?.name || "-",
                    remarks: hp.remarks || "-",
                    status: hp.status || "-",
                });
            }
        });

        entries.sort((a, b) => Number(a.hourIndex || 0) - Number(b.hourIndex || 0));
        return entries;
    }, []);

    const handleOpenHourlyModal = useCallback(async (plan: any) => {
        setSelectedShiftForHourly(plan);

        // Try extracting immediate hourly records from plan
        const initialRaw = plan.hourlyProductions || plan.rawPlan?.hourlyProductions || [];
        const extracted = extractHourlyEntriesFromRecords(initialRaw);
        if (extracted.length > 0) {
            setHourlyDetails(extracted);
        } else if (Number(plan.producedQty || 0) > 0 || Number(plan.plannedQty || 0) > 0) {
            const planNet = Number(plan.producedQty || 0);
            const planRej = Number(plan.rawPlan?.rejectQty || plan.rejectQty || 0);
            const planGross = planNet + planRej;
            setHourlyDetails([
                {
                    id: `shift-total-${plan.id || "1"}`,
                    hourIndex: 1,
                    timeSlot: "Shift Production Output",
                    qtyProduced: planGross,
                    netProducedQty: planNet,
                    rejectQty: planRej,
                    scrapQty: Number(plan.rawPlan?.scrapQty || plan.scrapQty || 0),
                    downtime: Number(plan.rawPlan?.downtime || plan.downtime || 0),
                    downtimeReason: plan.rawPlan?.downtimeReason || plan.downtimeReason || "-",
                    operatorName: plan.rawPlan?.operatorName || plan.operatorName || plan.rawPlan?.Operator?.fullName || "-",
                    remarks: plan.rawPlan?.remarks || plan.remarks || "Shift production summary",
                    status: plan.status || "COMPLETED",
                }
            ]);
        } else {
            setHourlyDetails([]);
        }

        setHourlyDetailsLoading(true);
        try {
            const rawPlan = plan.rawPlan || plan;
            const targetPoId = rawPlan.productionOrderId || fullOrder?.productionOrderId || id;
            const targetMachineId = rawPlan.machineId || rawPlan.machineMachineId || plan.machineId;
            const targetShiftId = rawPlan.shiftId || plan.shiftId;
            const targetDate = rawPlan.productionDate ? rawPlan.productionDate.split("T")[0] : (plan.date || undefined);

            const promises: Promise<any>[] = [];

            // 1. Fetch daily plan by ID if available
            if (plan.id && plan.id !== "fallback") {
                promises.push(
                    dailyPlanService.getById(plan.id).catch((err) => {
                        console.warn("Failed fetching daily plan by ID:", err);
                        return null;
                    })
                );
            } else {
                promises.push(Promise.resolve(null));
            }

            // 2. Fetch hourly productions for this specific shift & date & PO
            promises.push(
                apiClient.get(config.hourlyProduction.base, {
                    params: {
                        machineId: targetMachineId,
                        shiftId: targetShiftId,
                        productionDate: targetDate,
                        productionOrderId: targetPoId,
                    }
                }).catch((err) => {
                    console.warn("Failed fetching hourly productions by params:", err);
                    return null;
                })
            );

            const [dailyPlanRes, hourlyRes] = await Promise.all(promises);

            const combinedRawRecords: any[] = [];

            // From dailyPlan
            const fetchedDaily = dailyPlanRes?.data || dailyPlanRes;
            if (fetchedDaily?.hourlyProductions && Array.isArray(fetchedDaily.hourlyProductions)) {
                combinedRawRecords.push(...fetchedDaily.hourlyProductions);
            }

            // From hourlyProduction endpoint
            const hourlyList = hourlyRes?.data?.data || hourlyRes?.data || [];
            if (Array.isArray(hourlyList)) {
                combinedRawRecords.push(...hourlyList);
            }

            const freshExtracted = extractHourlyEntriesFromRecords(combinedRawRecords);

            if (freshExtracted.length > 0) {
                // Deduplicate by hourIndex & timeSlot
                const dedupMap = new Map<string, any>();
                freshExtracted.forEach((entry) => {
                    const key = `${entry.hourIndex}_${entry.timeSlot}`;
                    if (!dedupMap.has(key)) {
                        dedupMap.set(key, entry);
                    }
                });
                setHourlyDetails(Array.from(dedupMap.values()).sort((a, b) => Number(a.hourIndex || 0) - Number(b.hourIndex || 0)));
            } else if (Number(plan.producedQty || 0) > 0 || Number(plan.plannedQty || 0) > 0) {
                // Fallback shift total row so the modal is never empty when production occurred
                const planNet = Number(plan.producedQty || 0);
                const planRej = Number(rawPlan?.rejectQty || plan.rejectQty || 0);
                const planGross = planNet + planRej;
                setHourlyDetails([
                    {
                        id: `shift-total-${plan.id || "1"}`,
                        hourIndex: 1,
                        timeSlot: "Shift Production Output",
                        qtyProduced: planGross,
                        netProducedQty: planNet,
                        rejectQty: planRej,
                        scrapQty: Number(rawPlan?.scrapQty || plan.scrapQty || 0),
                        downtime: Number(rawPlan?.downtime || plan.downtime || 0),
                        downtimeReason: rawPlan?.downtimeReason || plan.downtimeReason || "-",
                        operatorName: rawPlan?.operatorName || plan.operatorName || rawPlan?.Operator?.fullName || "-",
                        remarks: rawPlan?.remarks || plan.remarks || "Shift production summary",
                        status: plan.status || "COMPLETED",
                    }
                ]);
            }
        } catch (err) {
            console.error("Failed to fetch fresh hourly logs:", err);
        } finally {
            setHourlyDetailsLoading(false);
        }
    }, [extractHourlyEntriesFromRecords, fullOrder, id]);

    // ── Shift table columns ───────────────────────────────────────────────────
    const shiftColumns: DataTableColumn<any>[] = useMemo(() => {
        return [
            {
                header: "#",
                width: "50px",
                align: "center",
                render: (_plan, idx) => <span className="text-xs font-semibold text-ink-subtle">{idx + 1}</span>,
            },
            {
                header: "DATE",
                width: "110px",
                render: (plan) => <span className="font-medium text-ink">{plan.date}</span>,
            },
            {
                header: "SHIFT",
                width: "120px",
                render: (plan) => <span className="text-ink-muted">{plan.shiftName}</span>,
            },
            {
                header: "PRODUCT",
                render: (plan) => (
                    <div>
                        <span className="font-semibold text-ink text-xs block">{plan.productName || "-"}</span>
                        {plan.productCode && (
                            <span className="text-[11px] text-ink-subtle font-mono">{plan.productCode}</span>
                        )}
                    </div>
                ),
            },
            {
                header: "PLANNED QTY",
                align: "right",
                width: "120px",
                render: (plan) => <span className="font-semibold text-ink-muted">{Number(plan.plannedQty || 0).toLocaleString("en-IN")}</span>,
            },
            {
                header: "PRODUCED QTY",
                align: "right",
                width: "120px",
                render: (plan) => <span className="font-bold text-green-600">{Number(plan.producedQty || 0).toLocaleString("en-IN")}</span>,
            },
            {
                header: "PRODUCTION STATUS",
                width: "180px",
                render: (plan) => (
                    <div className="flex items-center gap-1.5">
                        <StatusBadge status={plan.status} />
                        {plan.stopReason && plan.status !== "COMPLETED" && (
                            <div className="group relative flex items-center cursor-pointer">
                                <FaInfoCircle className="text-rose-400 text-[13px]" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 shadow-xl pointer-events-none">
                                    <span className="font-bold text-amber-400 block mb-1">Stop Reason:</span>
                                    <div className="leading-relaxed">{plan.stopReason}</div>
                                </div>
                            </div>
                        )}
                    </div>
                ),
            },
            {
                header: "DISPATCH STATUS",
                align: "center",
                width: "150px",
                render: (plan) => {
                    if (plan.dispatchStatus === "no_production") {
                        return <span className="inline-flex items-center px-2.5 py-1 bg-card-2 text-ink-subtle rounded-full text-xs font-semibold whitespace-nowrap">No Production</span>;
                    }
                    if (plan.dispatchStatus === "dispatched") {
                        return <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-800 border border-green-200 rounded-full text-xs font-semibold whitespace-nowrap">Dispatched</span>;
                    }
                    if (plan.dispatchStatus === "ready") {
                        return <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-full text-xs font-semibold whitespace-nowrap">Ready for Dispatch</span>;
                    }
                    return <span className="inline-flex items-center px-2.5 py-1 bg-card-2 text-ink-muted rounded-full text-xs font-semibold whitespace-nowrap">Not Dispatched</span>;
                },
            },
            {
                header: "ACTIONS",
                align: "center",
                width: "90px",
                render: (plan) => (
                    <div className="flex items-center justify-center">
                        <ViewButton
                            onClick={() => handleOpenHourlyModal(plan)}
                        />
                    </div>
                ),
            },
        ];
    }, [handleOpenHourlyModal]);

    // Fallback single-row for when no shift plans exist yet
    const fallbackShiftData = useMemo(() => {
        if (plans.length > 0) return [];
        const dispatchStatus = displayOrder?.status === "DISPATCHED"
            ? "dispatched"
            : displayOrder?.status === "READY_FOR_DISPATCH" || displayOrder?.status === "COMPLETED"
                ? "ready"
                : "none";
        return [{
            id: "fallback",
            date: displayOrder?.orderDate ? formatDate(displayOrder.orderDate) : "-",
            shiftName: "General Shift",
            machineName: fullOrder?.Machine?.machineName || fullOrder?.machineMachineId || "-",
            productName: fullOrder?.productItem?.productName || displayOrder?.productName || fullOrder?.products?.[0]?.productName || "-",
            productCode: fullOrder?.productItem?.productCode || displayOrder?.productCode || fullOrder?.products?.[0]?.productCode || "",
            plannedQty: Number(displayOrder?.targetQty || 0),
            producedQty: Number(displayOrder?.producedQty || 0),
            status: displayOrder?.status || "-",
            _dispatchStatus: dispatchStatus,
            hourlyProductions: [],
        }];
    }, [plans, displayOrder, fullOrder]);

    const fallbackShiftColumns: DataTableColumn<any>[] = useMemo(() => [
        {
            header: "#",
            width: "50px",
            align: "center",
            render: (_r, idx) => <span className="text-xs font-semibold text-ink-subtle">{idx + 1}</span>,
        },
        { header: "DATE", width: "110px", render: (r) => <span className="font-medium text-ink">{r.date}</span> },
        { header: "SHIFT", width: "120px", render: (r) => <span className="text-ink-muted">{r.shiftName}</span> },
        {
            header: "PRODUCT",
            render: (r) => (
                <div>
                    <span className="font-semibold text-ink text-xs block">{r.productName || "-"}</span>
                    {r.productCode && (
                        <span className="text-[11px] text-ink-subtle font-mono">{r.productCode}</span>
                    )}
                </div>
            ),
        },
        { header: "PLANNED QTY", align: "right", width: "110px", render: (r) => <span className="font-semibold text-ink-muted">{Number(r.plannedQty || 0).toLocaleString("en-IN")}</span> },
        { header: "PRODUCED QTY", align: "right", width: "120px", render: (r) => <span className="font-bold text-green-600">{Number(r.producedQty || 0).toLocaleString("en-IN")}</span> },
        { header: "PRODUCTION STATUS", width: "160px", render: (r) => <StatusBadge status={r.status} /> },
        {
            header: "DISPATCH STATUS",
            align: "center",
            width: "150px",
            render: (r) => {
                if (r._dispatchStatus === "dispatched") return <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-800 border border-green-200 rounded-full text-xs font-semibold whitespace-nowrap">Dispatched</span>;
                if (r._dispatchStatus === "ready") return <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-full text-xs font-semibold whitespace-nowrap">Ready for Dispatch</span>;
                return <span className="inline-flex items-center px-2.5 py-1 bg-card-2 text-ink-muted rounded-full text-xs font-semibold whitespace-nowrap">Not Dispatched</span>;
            },
        },
        {
            header: "ACTIONS",
            align: "center",
            width: "90px",
            render: (r) => (
                <div className="flex items-center justify-center">
                    <ViewButton onClick={() => handleOpenHourlyModal(r)} />
                </div>
            ),
        },
    ], [handleOpenHourlyModal]);

    // Group shift plans by machine, preserving order
    const machineShiftGroups = useMemo(() => {
        const dataSource = plansWithDispatch.length > 0 ? plansWithDispatch : fallbackShiftData;
        if (dataSource.length === 0) return [];

        const groups: { machineKey: string; machineName: string; plans: any[] }[] = [];
        const seenKeys = new Map<string, { machineKey: string; machineName: string; plans: any[] }>();

        dataSource.forEach((plan) => {
            const key = plan.rawPlan?.machineMachineId || plan.rawPlan?.machineId || plan.machineName || "unassigned";
            const name = (plan.machineName && plan.machineName !== "-")
                ? plan.machineName
                : (plan.rawPlan?.Machine?.machineName || "Unassigned Machine");
            if (!seenKeys.has(key)) {
                const group = { machineKey: key, machineName: name, plans: [] as any[] };
                seenKeys.set(key, group);
                groups.push(group);
            }
            seenKeys.get(key)!.plans.push(plan);
        });

        return groups;
    }, [plansWithDispatch, fallbackShiftData]);

    // ── Dispatch history columns ──────────────────────────────────────────────
    const dispatchColumns: DataTableColumn<any>[] = useMemo(() => [
        {
            header: "DISPATCH NO",
            width: "140px",
            render: (item) => <span className="font-semibold text-ink">{item.dispatch?.dispatchNumber || "-"}</span>,
        },
        {
            header: "DATE",
            width: "110px",
            render: (item) => <span className="text-ink-muted">
                {item.dispatch?.dispatchDate
                    ? formatDate(item.dispatch.dispatchDate)
                    : "-"}
            </span>,
        },
        {
            header: "PRODUCT",
            render: (item) => (
                <div>
                    <span className="font-medium text-ink block">{item.product?.productName || item.productItem?.productName || "-"}</span>
                    <span className="text-xs text-ink-subtle font-mono">{item.product?.productCode || item.productItem?.productCode || "-"}</span>
                </div>
            ),
        },
        {
            header: "DISPATCHED QTY",
            align: "right",
            width: "140px",
            render: (item) => (
                <span className="font-bold text-blue-600">
                    {Number(item.dispatchQty || 0).toLocaleString("en-IN")} <span className="text-xs font-normal text-ink-subtle">{normalizeUom(item.uom || item.product?.uom)}</span>
                </span>
            ),
        },
        {
            header: "VEHICLE NO",
            width: "130px",
            render: (item) => <span className="text-ink-muted font-mono text-xs">{item.dispatch?.vehicleNumber || "-"}</span>,
        },
        {
            header: "DRIVER NAME",
            width: "140px",
            render: (item) => <span className="text-ink-muted text-xs">{item.dispatch?.driverName || "-"}</span>,
        },
        {
            header: "STATUS",
            width: "130px",
            render: (item) => <StatusBadge status={item.dispatch?.status || "DISPATCHED"} />,
        },
    ], []);

    // ── Hourly Details Modal Columns ──────────────────────────────────────────
    const hourlyColumns: DataTableColumn<any>[] = useMemo(() => [
        {
            header: "#",
            width: "50px",
            align: "center",
            render: (_h, idx) => <span className="text-xs font-semibold text-ink-subtle">{idx + 1}</span>,
        },
        {
            header: "TIME / HOUR",
            width: "120px",
            render: (h) => (
                <span className="font-semibold text-ink text-xs">
                    {h.timeSlot || (h.hour !== undefined ? `Hour ${h.hour}` : "-")}
                </span>
            ),
        },
        {
            header: "PRODUCED QTY",
            align: "right",
            width: "130px",
            render: (h) => {
                const gross = Number(h.qtyProduced ?? 0);
                const rej = Number(h.rejectQty ?? 0);
                const net = Number(h.netProducedQty !== undefined ? h.netProducedQty : Math.max(0, gross - rej));
                return <span className="font-bold text-emerald-600">{net.toLocaleString("en-IN")} pcs</span>;
            },
        },
        {
            header: "REJECT QTY",
            align: "right",
            width: "110px",
            render: (h) => (
                <span className={`font-semibold ${Number(h.rejectQty) > 0 ? "text-red-500 font-bold" : "text-ink-subtle"}`}>
                    {Number(h.rejectQty || 0).toLocaleString("en-IN")}
                </span>
            ),
        },
        {
            header: "SCRAP QTY",
            align: "right",
            width: "110px",
            render: (h) => (
                <span className={`font-semibold ${Number(h.scrapQty) > 0 ? "text-amber-500 font-bold" : "text-ink-subtle"}`}>
                    {Number(h.scrapQty || 0).toLocaleString("en-IN")}
                </span>
            ),
        },
        {
            header: "DOWNTIME",
            align: "right",
            width: "120px",
            render: (h) => (
                <span className={`font-semibold ${Number(h.downtime) > 0 ? "text-amber-600" : "text-ink-subtle"}`}>
                    {Number(h.downtime || 0)} mins
                </span>
            ),
        },
        {
            header: "DOWNTIME REASON",
            render: (h) => (
                <span className="text-ink-muted text-xs">
                    {h.downtimeReason || h.reasonDescription || "-"}
                </span>
            ),
        },
        {
            header: "OPERATOR",
            render: (h) => (
                <span className="text-ink text-xs font-medium">
                    {h.operatorName || h.operator?.employeeName || h.operatorId || "-"}
                </span>
            ),
        },
        {
            header: "REMARKS",
            render: (h) => <span className="text-ink-subtle text-xs truncate max-w-[140px] inline-block">{h.remarks || "-"}</span>,
        },
    ], []);

    const [activeTab, setActiveTab] = useState<"shifts" | "dispatch" | "rm_issues">("shifts");

    // ── Render ────────────────────────────────────────────────────────────────
    const totalProductsCount = fullOrder?.products?.length || 0;
    const totalShiftsCount = plansWithDispatch.length || (fallbackShiftData.length > 0 ? 1 : 0);
    const totalDispatchesCount = fullOrder?.goodsDispatchItems?.length || 0;
    const totalRmIssuesCount = rmIssues.length;

    const completionPercent = targetVal > 0 ? Math.min(100, Math.round((producedVal / targetVal) * 100)) : 0;
    const dispatchPercent = targetVal > 0 ? Math.min(100, Math.round((totalDispatchedQty / targetVal) * 100)) : 0;

    return (
        <div className="w-full flex-1 flex flex-col min-h-[calc(100vh-theme(spacing.24))] pb-6">
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden flex-1 flex flex-col">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
                    <div>
                        <h3 className="text-lg font-bold text-ink flex items-start">
                            Production Order Details
                            <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{id || displayOrder?.productionOrderId}</span>
                        </h3>
                        <p className="text-xs text-ink-subtle mt-1">
                            {displayOrder?.orderDate ? `Order Date: ${formatDate(displayOrder.orderDate)}` : ""}
                            {displayOrder?.dueDate ? ` • Due: ${formatDate(displayOrder.dueDate)}` : ""}
                            {fullOrder?.productItem?.productName ? ` • ${fullOrder.productItem.productName}` : ""}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <BackButton text="Back" to={location.state?.from || "/production-orders"} />
                    </div>
                </div>

                {/* Insufficient stock alert */}
                {hasInsufficientStock && (
                    <div className="m-5 bg-red-500/10 border border-red-500/20 text-red-600 px-5 py-3 rounded-xl flex items-center gap-3 text-sm font-medium">
                        <FaInfoCircle className="text-lg flex-shrink-0" />
                        <span>One or more required raw materials have insufficient stock. Please create a Raw Material Order before proceeding to Weekly Machine Assignment.</span>
                    </div>
                )}

                {loading ? (
                    <div className="flex-1 py-20 flex justify-center items-center">
                        <CommonLoader text="Loading order details..." fullScreen={false} />
                    </div>
                ) : (
                    <div className="p-5 flex-1 flex flex-col gap-6">
                        {/* KPI & Summary Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                            {/* Order No & Dates */}
                            <div className="bg-card-2/60 p-4 rounded-xl border border-line flex flex-col justify-between">
                                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">Order Date</span>
                                <span className="text-sm font-bold text-ink mt-1">{formatDate(displayOrder?.orderDate)}</span>
                                <span className="text-[11px] text-ink-subtle mt-2">Due: <strong className="text-ink font-semibold">{formatDate(displayOrder?.dueDate)}</strong></span>
                            </div>

                            {/* Target Qty */}
                            <div className="bg-card-2/60 p-4 rounded-xl border border-line flex flex-col justify-between">
                                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">Target Qty</span>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-xl font-extrabold text-ink">{targetVal.toLocaleString("en-IN")}</span>
                                    <span className="text-xs text-ink-subtle">pcs</span>
                                </div>
                                <span className="text-[11px] text-ink-subtle mt-2">{totalProductsCount} Product{totalProductsCount !== 1 ? "s" : ""}</span>
                            </div>

                            {/* Produced Qty */}
                            <div className="bg-card-2/60 p-4 rounded-xl border border-line flex flex-col justify-between">
                                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">Produced Qty</span>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-xl font-extrabold text-emerald-600">{producedVal.toLocaleString("en-IN")}</span>
                                    <span className="text-xs text-emerald-600 font-semibold">({completionPercent}%)</span>
                                </div>
                                <div className="w-full bg-card h-1.5 rounded-full mt-2 overflow-hidden border border-line">
                                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${completionPercent}%` }} />
                                </div>
                            </div>

                            {/* Dispatched Qty */}
                            <div className="bg-card-2/60 p-4 rounded-xl border border-line flex flex-col justify-between">
                                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">Dispatched Qty</span>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-xl font-extrabold text-blue-600">{totalDispatchedQty.toLocaleString("en-IN")}</span>
                                    <span className="text-xs text-blue-600 font-semibold">({dispatchPercent}%)</span>
                                </div>
                                <div className="w-full bg-card h-1.5 rounded-full mt-2 overflow-hidden border border-line">
                                    <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${dispatchPercent}%` }} />
                                </div>
                            </div>

                            {/* Shifts Logged */}
                            <div className="bg-card-2/60 p-4 rounded-xl border border-line flex flex-col justify-between">
                                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">Shift Plans</span>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-xl font-extrabold text-ink">{plans.length}</span>
                                    <span className="text-xs text-ink-subtle">shifts</span>
                                </div>
                                <span className="text-[11px] text-ink-subtle mt-2">
                                    {plans.filter(p => p.status === "COMPLETED").length} completed
                                </span>
                            </div>
                        </div>

                        {/* Clean Seamless Tab Navigation */}
                        <div className="flex items-center gap-6 border-b border-line overflow-x-auto no-scrollbar pt-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab("shifts")}
                                className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                                    activeTab === "shifts"
                                        ? "text-primary border-primary"
                                        : "text-ink-muted hover:text-ink border-transparent"
                                }`}
                            >
                                <FaIndustry className={activeTab === "shifts" ? "text-primary" : "text-ink-subtle"} />
                                <span>Shift Production Logs</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    activeTab === "shifts" ? "bg-primary/15 text-primary" : "bg-card-2 text-ink-subtle border border-line"
                                }`}>
                                    {totalShiftsCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("dispatch")}
                                className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                                    activeTab === "dispatch"
                                        ? "text-primary border-primary"
                                        : "text-ink-muted hover:text-ink border-transparent"
                                }`}
                            >
                                <FaTruck className={activeTab === "dispatch" ? "text-primary" : "text-ink-subtle"} />
                                <span>Dispatch History</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    activeTab === "dispatch" ? "bg-primary/15 text-primary" : "bg-card-2 text-ink-subtle border border-line"
                                }`}>
                                    {totalDispatchesCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("rm_issues")}
                                className={`flex items-center gap-2 pb-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                                    activeTab === "rm_issues"
                                        ? "text-primary border-primary"
                                        : "text-ink-muted hover:text-ink border-transparent"
                                }`}
                            >
                                <FaWarehouse className={activeTab === "rm_issues" ? "text-primary" : "text-ink-subtle"} />
                                <span>Raw Material Issues</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    activeTab === "rm_issues" ? "bg-primary/15 text-primary" : "bg-card-2 text-ink-subtle border border-line"
                                }`}>
                                    {totalRmIssuesCount}
                                </span>
                            </button>
                        </div>

                        {/* Tab Contents */}
                        <div className="flex-1 flex flex-col">
                            {/* ── TAB 1: SHIFT PRODUCTION LOGS ── */}
                            {activeTab === "shifts" && (
                                <div className="space-y-6">
                                    {machineShiftGroups.length === 0 ? (
                                        <div className="border border-dashed border-line rounded-xl p-12 text-center text-ink-muted text-sm">
                                            No shift production plans recorded yet.
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-6">
                                            {machineShiftGroups.map((group) => (
                                                <div key={group.machineKey} className="border border-line rounded-xl overflow-hidden shadow-xs">
                                                    {/* Machine section header */}
                                                    <div className="px-4 py-2.5 bg-head border-b border-line flex items-center justify-between">
                                                        <h3 className="text-[13px] font-bold text-ink uppercase tracking-wide">
                                                            {group.machineName} — Shift Production Logs
                                                        </h3>
                                                        <span className="text-xs font-semibold text-ink-subtle">
                                                            {group.plans.length} shift log{group.plans.length !== 1 ? "s" : ""}
                                                        </span>
                                                    </div>

                                                    {/* Shift table */}
                                                    <table className="w-full text-left border-collapse text-sm">
                                                        <thead>
                                                            <tr className="bg-head/60 border-b border-line h-10">
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider w-12 text-center align-middle">
                                                                    #
                                                                </th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider align-middle">
                                                                    Date
                                                                </th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider align-middle">
                                                                    Shift
                                                                </th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider align-middle">
                                                                    Product
                                                                </th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider text-right align-middle">
                                                                    Planned Qty
                                                                </th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider text-right align-middle">
                                                                    Produced Qty
                                                                </th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider text-center align-middle">
                                                                    Production Status
                                                                </th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider text-center align-middle">
                                                                    Dispatch Status
                                                                </th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider w-24 text-center align-middle">
                                                                    Actions
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-line">
                                                            {group.plans.map((plan: any, idx: number) => {
                                                                const isCompleted = plan.status === "COMPLETED" || (Number(plan.producedQty || 0) >= Number(plan.plannedQty || 0) && Number(plan.plannedQty || 0) > 0);
                                                                const statusDisplay = isCompleted ? "COMPLETED" : (plan.status || "PENDING");

                                                                return (
                                                                    <tr
                                                                        key={plan.id || idx}
                                                                        className="bg-card hover:bg-card-2 transition-colors h-12"
                                                                    >
                                                                        <td className="px-4 py-2 text-ink-subtle text-xs text-center align-middle font-semibold">
                                                                            {idx + 1}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-ink font-medium text-xs align-middle">
                                                                            {plan.date}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-ink-muted text-xs align-middle font-medium">
                                                                            {plan.shiftName}
                                                                        </td>
                                                                        <td className="px-4 py-2 align-middle">
                                                                            <div className="font-semibold text-ink text-xs">{plan.productName || "-"}</div>
                                                                            {plan.productCode && (
                                                                                <div className="text-[11px] text-ink-subtle font-mono">{plan.productCode}</div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-right font-semibold text-ink-muted text-xs align-middle">
                                                                            {Number(plan.plannedQty || 0).toLocaleString("en-IN")}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-right font-bold text-emerald-600 text-xs align-middle">
                                                                            {Number(plan.producedQty || 0).toLocaleString("en-IN")}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-center align-middle">
                                                                            <StatusBadge status={statusDisplay} />
                                                                        </td>
                                                                        <td className="px-4 py-2 text-center align-middle">
                                                                            {plan.dispatchStatus === "dispatched" || plan._dispatchStatus === "dispatched" ? (
                                                                                <span className="inline-flex items-center px-2.5 py-1 bg-green-500/15 text-green-400 border border-green-500/30 rounded-full text-xs font-semibold whitespace-nowrap">
                                                                                    Dispatched
                                                                                </span>
                                                                            ) : plan.dispatchStatus === "ready" || plan._dispatchStatus === "ready" ? (
                                                                                <span className="inline-flex items-center px-2.5 py-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full text-xs font-semibold whitespace-nowrap">
                                                                                    Ready for Dispatch
                                                                                </span>
                                                                            ) : plan.dispatchStatus === "no_production" ? (
                                                                                <span className="inline-flex items-center px-2.5 py-1 bg-card-2 text-ink-subtle rounded-full text-xs font-semibold whitespace-nowrap">
                                                                                    No Production
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center px-2.5 py-1 bg-card-2 text-ink-muted rounded-full text-xs font-semibold whitespace-nowrap">
                                                                                    Not Dispatched
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-center align-middle">
                                                                            <div className="flex items-center justify-center">
                                                                                <ViewButton onClick={() => handleOpenHourlyModal(plan)} />
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── TAB 2: DISPATCH HISTORY ── */}
                            {activeTab === "dispatch" && (
                                <div>
                                    {fullOrder?.goodsDispatchItems && fullOrder.goodsDispatchItems.length > 0 ? (
                                        <div className="border border-line rounded-xl overflow-hidden shadow-xs">
                                            <table className="w-full text-left border-collapse text-sm">
                                                <thead>
                                                    <tr className="bg-head/60 border-b border-line h-10">
                                                        <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider w-12 text-center align-middle">#</th>
                                                        <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider align-middle">Dispatch No</th>
                                                        <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider align-middle">Date</th>
                                                        <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider align-middle">Product</th>
                                                        <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider text-right align-middle">Dispatched Qty</th>
                                                        <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider align-middle">Vehicle No</th>
                                                        <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider align-middle">Driver Name</th>
                                                        <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider text-center align-middle">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-line">
                                                    {fullOrder.goodsDispatchItems.map((item: any, idx: number) => (
                                                        <tr key={item.dispatchItemId || item.id || idx} className="bg-card hover:bg-card-2 transition-colors h-12">
                                                            <td className="px-4 py-2 text-ink-subtle text-xs text-center align-middle font-semibold">{idx + 1}</td>
                                                            <td className="px-4 py-2 font-semibold text-ink text-xs align-middle">{item.dispatch?.dispatchNumber || "-"}</td>
                                                            <td className="px-4 py-2 text-ink-muted text-xs align-middle">{item.dispatch?.dispatchDate ? formatDate(item.dispatch.dispatchDate) : "-"}</td>
                                                            <td className="px-4 py-2 align-middle">
                                                                <div className="font-semibold text-ink text-xs">{item.product?.productName || item.productItem?.productName || "-"}</div>
                                                                {(item.product?.productCode || item.productItem?.productCode) && (
                                                                    <div className="text-[11px] text-ink-subtle font-mono">{item.product?.productCode || item.productItem?.productCode}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-bold text-blue-600 text-xs align-middle">
                                                                {Number(item.dispatchQty || 0).toLocaleString("en-IN")} <span className="text-[10px] font-normal text-ink-subtle">{normalizeUom(item.uom || item.product?.uom)}</span>
                                                            </td>
                                                            <td className="px-4 py-2 text-ink-muted font-mono text-xs align-middle">{item.dispatch?.vehicleNumber || "-"}</td>
                                                            <td className="px-4 py-2 text-ink-muted text-xs align-middle">{item.dispatch?.driverName || "-"}</td>
                                                            <td className="px-4 py-2 text-center align-middle">
                                                                <StatusBadge status={item.dispatch?.status || "DISPATCHED"} />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-ink-muted text-sm border border-dashed border-line rounded-xl">
                                            No dispatches recorded for this order yet.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── TAB 3: RAW MATERIAL ISSUES ── */}
                            {activeTab === "rm_issues" && (
                                <div>
                                    {rmIssues.length > 0 ? (
                                        <div className="space-y-4">
                                            {rmIssues.map((adj) => (
                                                <div key={adj.adjustmentId} className="border border-line rounded-xl overflow-hidden bg-card shadow-xs">
                                                    {/* Adjustment Header Bar */}
                                                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-head border-b border-line">
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
                                                                {adj.adjustmentNumber}
                                                            </span>
                                                            <span className="text-xs font-medium text-ink">{formatDate(adj.date)}</span>
                                                            {adj.reason && adj.reason !== "-" && (
                                                                <span className="text-xs text-ink-subtle italic bg-card px-2 py-0.5 rounded border border-line">
                                                                    Reason: {adj.reason}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-ink-subtle font-medium">
                                                            {adj.items.length} material{adj.items.length !== 1 ? "s" : ""} adjusted
                                                        </span>
                                                    </div>

                                                    {/* Items Table */}
                                                    <table className="w-full text-left border-collapse text-sm">
                                                        <thead>
                                                            <tr className="bg-card-2/40 border-b border-line h-10">
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider align-middle">Raw Material</th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider align-middle">Store</th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider text-right align-middle">Before</th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider text-right align-middle">After</th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider text-right align-middle">Issued Qty</th>
                                                                <th className="px-4 py-2 text-[11px] font-semibold text-ink-subtle uppercase tracking-wider align-middle">Remarks</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-line">
                                                            {adj.items.map((item: any, idx: number) => (
                                                                <tr key={idx} className="bg-card hover:bg-card-2 transition-colors h-12">
                                                                    <td className="px-4 py-2 align-middle">
                                                                        <div className="font-semibold text-xs text-ink">{item.rawMaterialName}</div>
                                                                        {item.rawMaterialCode && item.rawMaterialCode !== "-" && (
                                                                            <div className="text-[11px] text-ink-subtle font-mono">{item.rawMaterialCode}</div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-ink-muted text-xs align-middle">{item.store}</td>
                                                                    <td className="px-4 py-2 text-right text-ink-muted text-xs tabular-nums align-middle">
                                                                        {item.currentQty.toFixed(3)} {item.uom}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-ink-muted text-xs tabular-nums align-middle">
                                                                        {item.adjustedQty.toFixed(3)} {item.uom}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-xs tabular-nums font-bold whitespace-nowrap align-middle">
                                                                        <span className={item.difference < 0 ? "text-red-500" : "text-emerald-600"}>
                                                                            {item.difference < 0 ? "" : "+"}{item.difference.toFixed(3)} {item.uom}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-ink-subtle text-xs truncate max-w-[200px] align-middle">{item.remarks || "-"}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-ink-muted text-sm border border-dashed border-line rounded-xl">
                                            No raw material issues logged for this order.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Shift Hourly Production Breakdown Modal ── */}
            {selectedShiftForHourly && (
                <CommonModal
                    show={Boolean(selectedShiftForHourly)}
                    onHide={() => {
                        setSelectedShiftForHourly(null);
                        setHourlyDetails([]);
                    }}
                    title={
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/15 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
                                <FaIndustry size={14} />
                            </div>
                            <div>
                                <div className="text-base font-bold text-ink leading-tight">
                                    Hourly Production Breakdown — {selectedShiftForHourly.shiftName}
                                </div>
                                <div className="text-xs text-ink-subtle mt-0.5">
                                    {selectedShiftForHourly.date} · {selectedShiftForHourly.machineName}
                                </div>
                            </div>
                        </div>
                    }
                    maxWidth="6xl"
                >
                    <div className="p-6 space-y-6">
                        {/* Summary Header Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-card-2 p-4 rounded-xl border border-line">
                            <div>
                                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider block">Shift &amp; Machine</span>
                                <span className="text-sm font-bold text-ink mt-1 block">
                                    {selectedShiftForHourly.shiftName}
                                </span>
                                <span className="text-xs text-ink-muted block mt-0.5">
                                    {selectedShiftForHourly.machineName}
                                </span>
                            </div>

                            <div>
                                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider block">Planned Target</span>
                                <span className="text-base font-extrabold text-ink mt-1 block">
                                    {Number(selectedShiftForHourly.plannedQty || 0).toLocaleString("en-IN")} pcs
                                </span>
                            </div>

                            <div>
                                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider block">Total Produced</span>
                                <span className="text-base font-extrabold text-emerald-600 mt-1 block">
                                    {Number(selectedShiftForHourly.producedQty || 0).toLocaleString("en-IN")} pcs
                                </span>
                            </div>

                            <div>
                                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider block">Shift Status</span>
                                <div className="mt-1">
                                    <StatusBadge status={selectedShiftForHourly.status} />
                                </div>
                            </div>
                        </div>

                        {/* Hourly Breakdown Table */}
                        {hourlyDetailsLoading ? (
                            <div className="py-12">
                                <CommonLoader text="Loading hourly production logs..." fullScreen={false} />
                            </div>
                        ) : (
                            <div className="border border-line rounded-xl overflow-hidden bg-card">
                                <DataTable
                                    columns={hourlyColumns}
                                    data={hourlyDetails}
                                    rowKey={(h) => h.id || h.hourId || h.hour || Math.random()}
                                    emptyMessage="No hourly logs recorded for this shift."
                                    minHeightClassName="min-h-0"
                                    density="compact"
                                />
                            </div>
                        )}

                        {/* Modal Footer Summary */}
                        {hourlyDetails.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card-2 rounded-xl border border-line text-xs font-semibold">
                                <div className="flex items-center gap-2 text-ink-muted">
                                    <FaCheckCircle className="text-emerald-500" />
                                    <span>{hourlyDetails.length} hourly log entries recorded</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-ink">
                                        Total Produced: <strong className="text-emerald-600">
                                            {hourlyDetails.reduce((sum, h) => {
                                                const gross = Number(h.qtyProduced ?? 0);
                                                const rej = Number(h.rejectQty ?? 0);
                                                const net = Number(h.netProducedQty !== undefined ? h.netProducedQty : Math.max(0, gross - rej));
                                                return sum + net;
                                            }, 0).toLocaleString("en-IN")} pcs
                                        </strong>
                                    </span>
                                    <span className="text-ink">
                                        Rejects: <strong className="text-red-500">
                                            {hourlyDetails.reduce((sum, h) => sum + Number(h.rejectQty || 0), 0).toLocaleString("en-IN")}
                                        </strong>
                                    </span>
                                    <span className="text-ink">
                                        Scrap: <strong className="text-amber-500">
                                            {hourlyDetails.reduce((sum, h) => sum + Number(h.scrapQty || 0), 0).toLocaleString("en-IN")}
                                        </strong>
                                    </span>
                                    <span className="text-ink">
                                        Downtime: <strong className="text-amber-600">
                                            {hourlyDetails.reduce((sum, h) => sum + Number(h.downtime || 0), 0)} mins
                                        </strong>
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </CommonModal>
            )}
        </div>
    );
};

export default ProductionOrderHistoryView;
