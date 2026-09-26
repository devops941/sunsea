import { formatDate } from "../../../utils/dateUtils";
import { formatQtyValue } from "../../../utils/uomConversion";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useLocation, useParams } from "react-router-dom";
import { 
    FaInfoCircle,
    FaIndustry,
    FaTruck,
    FaWarehouse,
    FaCheckCircle,
    FaExclamationTriangle,
    FaStopCircle,
    FaBoxes,
    FaCalendarAlt,
    FaCogs,
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
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";

const PRODUCTION_STARTED_STATUSES = [
    "WEEKLY_SCHEDULED", "DAILY_PLANNED", "IN_PROGRESS", "IN_PRODUCTION",
    "POST_PRODUCTION", "READY_FOR_DISPATCH", "PARTIAL_COMPLETED",
    "COMPLETED_WITH_SHORTFALL", "DISPATCHED", "CLOSED", "CANCELLED",
];

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
    const displayOrder = useMemo(() => fullOrder || passedOrder || {}, [fullOrder, passedOrder]);
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
        const isPOClosedOrStopped = ["COMPLETED_WITH_SHORTFALL", "CLOSED", "READY_FOR_DISPATCH", "DISPATCHED", "STOPPED", "CANCELLED"].includes(fullOrder?.status);
        return [...fullOrder.dailyProductionPlans]
            .filter((plan: any) => {
                if (isPOClosedOrStopped) {
                    const hps = plan.hourlyProductions || [];
                    const directGross = Number(plan.producedQty || plan.totalProducedQty || 0);
                    let sumGross = directGross;
                    hps.forEach((hp: any) => {
                        sumGross += Number(hp.totalQtyProduced !== undefined ? hp.totalQtyProduced : hp.qtyProduced || 0);
                    });
                    const isUnstarted = ["DRAFT", "PLANNED", "APPROVED"].includes(plan.status);
                    if (isUnstarted && sumGross === 0 && hps.length === 0) return false;
                }
                return true;
            })
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

                if (hps.length > 0) {
                    hps.forEach((hp: any) => {
                        // In Prisma model HourlyProduction, fields are totalQtyProduced, totalRejectQty, totalScrapQty
                        const gross = Number(hp.totalQtyProduced !== undefined ? hp.totalQtyProduced : hp.qtyProduced || 0);
                        const rej = Number(hp.totalRejectQty !== undefined ? hp.totalRejectQty : hp.rejectQty || 0);
                        
                        shiftGrossProduced += gross;
                        shiftReject += rej;
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

                const isPlanStopped = displayStatus === "COMPLETED_WITH_SHORTFALL" || displayStatus === "STOPPED" || displayStatus === "SHORT_CLOSED";

                // Extract stop reason from remarks only if this shift was stopped
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
                // Fall back to order remarks only for the stopped shift
                if (isPlanStopped && !stopReason && isPermanentStop && fullOrder?.remarks) {
                    const orderRemarks = fullOrder.remarks.split("|");
                    const oPart = orderRemarks[orderRemarks.length - 1] || "";
                    const oCleaned = oPart
                        .replace(/Permanently Stopped:/i, "")
                        .replace(/Short Closed:/i, "")
                        .replace(/Stopped:/i, "")
                        .replace(/Cancelled:/i, "")
                        .trim();
                    if (oCleaned) stopReason = oCleaned;
                }

                // If this plan completed normally, it was not stopped
                if (!isPlanStopped) {
                    stopReason = null;
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

    // Pre-compute dispatch status per shift in a single pass
    const plansWithDispatch = useMemo(() => {
        const result = [];
        let runningTotal = 0;
        for (let i = 0; i < plans.length; i++) {
            const plan = plans[i];
            const hasProduction = plan.producedQty > 0;
            const isFinalized = (plan.status === "COMPLETED" || plan.status === "COMPLETED_WITH_SHORTFALL") && hasProduction;
            if (isFinalized) {
                runningTotal += plan.producedQty;
            }

            let dispatchStatus: string;
            if (!hasProduction) {
                dispatchStatus = "no_production";
            } else if (isFinalized && totalDispatchedQty > 0 && runningTotal <= totalDispatchedQty + 0.001) {
                dispatchStatus = "dispatched";
            } else if (isFinalized) {
                dispatchStatus = "ready";
            } else {
                dispatchStatus = "not_dispatched";
            }

            result.push({ ...plan, dispatchStatus });
        }
        return result;
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
    const shiftColumns: DataTableColumn<any>[] = useMemo(() => [
        {
            header: "#",
            width: "50px",
            align: "center",
            render: (_plan, idx) => <span className="text-xs font-semibold text-ink-subtle">{idx + 1}</span>,
        },
        {
            header: "DATE",
            width: "110px",
            render: (plan) => <span className="font-medium text-ink text-xs">{plan.date}</span>,
        },
        {
            header: "SHIFT",
            width: "120px",
            render: (plan) => <span className="text-ink-muted text-xs font-medium">{plan.shiftName}</span>,
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
            render: (plan) => <span className="font-semibold text-ink-muted text-xs">{Number(plan.plannedQty || 0).toLocaleString("en-IN")}</span>,
        },
        {
            header: "PRODUCED QTY",
            align: "right",
            width: "120px",
            render: (plan) => <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">{Number(plan.producedQty || 0).toLocaleString("en-IN")}</span>,
        },
        {
            header: "PRODUCTION STATUS",
            width: "240px",
            align: "center",
            render: (plan) => {
                const isCompleted = (plan.status === "COMPLETED" || (Number(plan.producedQty || 0) >= Number(plan.plannedQty || 0) && Number(plan.plannedQty || 0) > 0)) && plan.status !== "COMPLETED_WITH_SHORTFALL" && plan.status !== "STOPPED";
                const statusDisplay = isCompleted ? "COMPLETED" : (plan.status || "PENDING");
                const showStopPill = (plan.status === "COMPLETED_WITH_SHORTFALL" || plan.status === "STOPPED" || plan.status === "SHORT_CLOSED") && Boolean(plan.stopReason);
                return (
                    <div className="flex items-center justify-center gap-2 py-0.5 whitespace-nowrap">
                        <StatusBadge status={statusDisplay} />
                        {showStopPill && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/25 dark:border-amber-500/30 max-w-[150px]" title={`Stop Reason: ${plan.stopReason}`}>
                                <FaStopCircle className="text-[10px] shrink-0 text-amber-600 dark:text-amber-400" />
                                <span className="truncate">{plan.stopReason}</span>
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            header: "DISPATCH STATUS",
            align: "center",
            width: "160px",
            render: (plan) => {
                const ds = plan.dispatchStatus || plan._dispatchStatus;
                if (ds === "dispatched" || ds === "DISPATCHED") {
                    return <StatusBadge status="DISPATCHED" />;
                }
                if (ds === "ready" || ds === "READY_FOR_DISPATCH") {
                    return <StatusBadge status="READY_FOR_DISPATCH" />;
                }
                if (ds === "no_production") {
                    return <StatusBadge status="CLOSED" customText="No Production" />;
                }
                return <StatusBadge status="PENDING" customText="Not Dispatched" />;
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
    ], [handleOpenHourlyModal]);

    // Group shift plans by machine, preserving order
    const machineShiftGroups = useMemo(() => {
        if (plansWithDispatch.length === 0) return [];

        const groups: { machineKey: string; machineName: string; plans: any[] }[] = [];
        const seenKeys = new Map<string, { machineKey: string; machineName: string; plans: any[] }>();

        plansWithDispatch.forEach((plan) => {
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
    }, [plansWithDispatch]);

    // ── Dispatch history columns ──────────────────────────────────────────────
    const dispatchColumns: DataTableColumn<any>[] = useMemo(() => [
        {
            header: "#",
            width: "50px",
            align: "center",
            render: (_item, idx) => <span className="text-xs font-semibold text-ink-subtle">{idx + 1}</span>,
        },
        {
            header: "DISPATCH NO",
            width: "140px",
            render: (item) => <span className="font-semibold text-ink text-xs">{item.dispatch?.dispatchNumber || "-"}</span>,
        },
        {
            header: "DC NO",
            width: "130px",
            render: (item) => {
                const dc = item.dispatch?.dcNumber || item.dcNumber;
                return (
                    <span className="font-semibold text-ink text-xs font-mono">
                        {dc || "-"}
                    </span>
                );
            },
        },
        {
            header: "DATE",
            width: "110px",
            render: (item) => (
                <span className="text-ink-muted text-xs">
                    {item.dispatch?.dispatchDate ? formatDate(item.dispatch.dispatchDate) : "-"}
                </span>
            ),
        },
        {
            header: "PRODUCT",
            render: (item) => {
                const prodName = item.product?.productName || item.productItem?.productName || fullOrder?.productItem?.productName || fullOrder?.products?.[0]?.productName || "-";
                const prodCode = item.product?.productCode || item.productItem?.productCode || fullOrder?.productItem?.productCode || fullOrder?.products?.[0]?.productCode;
                return (
                    <div>
                        <span className="font-semibold text-ink text-xs block">{prodName}</span>
                        {prodCode && (
                            <span className="text-[11px] text-ink-subtle font-mono">{prodCode}</span>
                        )}
                    </div>
                );
            },
        },
        {
            header: "DISPATCHED QTY",
            align: "right",
            width: "140px",
            render: (item) => (
                <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                    {Number(item.dispatchQty || 0).toLocaleString("en-IN")} <span className="text-[10px] font-normal text-ink-subtle">{normalizeUom(item.uom || item.product?.uom || fullOrder?.productItem?.uom)}</span>
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
            align: "center",
            render: (item) => <StatusBadge status={item.dispatch?.status || "DISPATCHED"} />,
        },
    ], [fullOrder]);

    // ── RM Issues table columns ───────────────────────────────────────────────
    const rmColumns: DataTableColumn<any>[] = useMemo(() => [
        {
            header: "RAW MATERIAL",
            render: (item) => (
                <div>
                    <div className="font-semibold text-xs text-ink">{item.rawMaterialName}</div>
                    {item.rawMaterialCode && item.rawMaterialCode !== "-" && (
                        <div className="text-[11px] text-ink-subtle font-mono">{item.rawMaterialCode}</div>
                    )}
                </div>
            ),
        },
        {
            header: "STORE",
            width: "140px",
            render: (item) => <span className="text-ink-muted text-xs">{item.store}</span>,
        },
        {
            header: "BEFORE",
            align: "right",
            width: "120px",
            render: (item) => (
                <span className="text-ink-muted text-xs tabular-nums">
                    {formatQtyValue(item.currentQty, item.uom)} {item.uom}
                </span>
            ),
        },
        {
            header: "AFTER",
            align: "right",
            width: "120px",
            render: (item) => (
                <span className="text-ink-muted text-xs tabular-nums">
                    {formatQtyValue(item.adjustedQty, item.uom)} {item.uom}
                </span>
            ),
        },
        {
            header: "ISSUED QTY",
            align: "right",
            width: "130px",
            render: (item) => {
                const diff = Number(item.difference || 0);
                const sign = diff < 0 ? "-" : diff > 0 ? "+" : "";
                return (
                    <span className={`text-xs tabular-nums font-bold whitespace-nowrap ${diff < 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {sign}{formatQtyValue(Math.abs(diff), item.uom)} {item.uom}
                    </span>
                );
            },
        },
        {
            header: "REMARKS",
            render: (item) => (
                <span className="text-ink-subtle text-xs truncate max-w-[200px] inline-block" title={item.remarks}>
                    {item.remarks || "-"}
                </span>
            ),
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
                return <span className="font-bold text-emerald-600 dark:text-emerald-400">{net.toLocaleString("en-IN")} pcs</span>;
            },
        },
        {
            header: "REJECT QTY",
            align: "right",
            width: "110px",
            render: (h) => (
                <span className={`font-semibold ${Number(h.rejectQty) > 0 ? "text-red-500 dark:text-red-400 font-bold" : "text-ink-subtle"}`}>
                    {Number(h.rejectQty || 0).toLocaleString("en-IN")}
                </span>
            ),
        },
        {
            header: "SCRAP QTY",
            align: "right",
            width: "110px",
            render: (h) => (
                <span className={`font-semibold ${Number(h.scrapQty) > 0 ? "text-amber-500 dark:text-amber-400 font-bold" : "text-ink-subtle"}`}>
                    {Number(h.scrapQty || 0).toLocaleString("en-IN")}
                </span>
            ),
        },
        {
            header: "DOWNTIME",
            align: "right",
            width: "120px",
            render: (h) => (
                <span className={`font-semibold ${Number(h.downtime) > 0 ? "text-amber-600 dark:text-amber-400" : "text-ink-subtle"}`}>
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

    // ── Flattened rows for continuous keyboard navigation across tabs ─────────
    const flattenedShiftPlans = useMemo(() => {
        return machineShiftGroups.flatMap((g) => g.plans);
    }, [machineShiftGroups]);

    const shiftGlobalIndexMap = useMemo(() => {
        const map = new Map<string | number, number>();
        flattenedShiftPlans.forEach((p, idx) => {
            map.set(p.id || `shift-${idx}`, idx);
        });
        return map;
    }, [flattenedShiftPlans]);

    const flattenedRmItems = useMemo(() => {
        return rmIssues.flatMap((adj, adjIdx) =>
            adj.items.map((item: any, itemIdx: number) => ({
                ...item,
                adjId: adj.adjId,
                adjustmentNumber: adj.adjustmentNumber,
                adjDate: adj.date,
                globalIdx: `${adjIdx}-${itemIdx}`,
            }))
        );
    }, [rmIssues]);

    const rmGlobalIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        flattenedRmItems.forEach((item, idx) => {
            map.set(item.globalIdx, idx);
        });
        return map;
    }, [flattenedRmItems]);

    const activeTabCount = useMemo(() => {
        if (activeTab === "shifts") return flattenedShiftPlans.length;
        if (activeTab === "dispatch") return (fullOrder?.goodsDispatchItems || []).length;
        if (activeTab === "rm_issues") return flattenedRmItems.length;
        return 0;
    }, [activeTab, flattenedShiftPlans, fullOrder?.goodsDispatchItems, flattenedRmItems]);

    const tableRef = useRef<HTMLDivElement>(null);

    const handleEnter = useCallback((index: number) => {
        if (activeTab === "shifts") {
            const plan = flattenedShiftPlans[index];
            if (plan) handleOpenHourlyModal(plan);
        }
    }, [activeTab, flattenedShiftPlans, handleOpenHourlyModal]);

    const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
        count: activeTabCount,
        onEnter: handleEnter,
        containerRef: tableRef,
    });

    usePageShortcuts({
        onRefresh: () => {
            if (passedOrder) fetchOrderDetails(passedOrder);
            else if (id) fetchOrderDetails({ id });
            fetchRmIssues();
        },
    });

    const handleTabChange = useCallback((tab: "shifts" | "dispatch" | "rm_issues") => {
        setActiveTab(tab);
        setFocusedIndex(0);
        setTimeout(() => {
            tableRef.current?.focus({ preventScroll: true });
        }, 50);
    }, [setFocusedIndex]);

    // ── Render ────────────────────────────────────────────────────────────────
    const totalProductsCount = fullOrder?.products?.length || 0;
    const totalShiftsCount = plansWithDispatch.length;
    const totalDispatchesCount = fullOrder?.goodsDispatchItems?.length || 0;
    const totalRmIssuesCount = rmIssues.length;

    const completionPercent = targetVal > 0 ? Math.min(100, Math.round((producedVal / targetVal) * 100)) : 0;
    const dispatchPercent = targetVal > 0 ? Math.min(100, Math.round((totalDispatchedQty / targetVal) * 100)) : 0;

    const isStoppedOrder = ["COMPLETED_WITH_SHORTFALL", "STOPPED", "CANCELLED"].includes(fullOrder?.status || displayOrder?.status);
    const orderStopReason = useMemo(() => {
        // 1. From order remarks
        const remarks = fullOrder?.remarks || displayOrder?.remarks || "";
        if (remarks) {
            const parts = remarks.split("|");
            for (const p of [...parts].reverse()) {
                const cleaned = p
                    .replace(/Permanently Stopped:/i, "")
                    .replace(/Short Closed:/i, "")
                    .replace(/Stopped:/i, "")
                    .replace(/Cancelled:/i, "")
                    .trim();
                if (cleaned) return cleaned;
            }
        }
        // 2. From production order history
        const stopHist = (fullOrder?.productionOrderHistories || []).find((h: any) =>
            h.action === "PERMANENT_STOP" || h.toStatus === "COMPLETED_WITH_SHORTFALL" || h.toStatus === "STOPPED"
        );
        if (stopHist?.metadata?.stopReason) return stopHist.metadata.stopReason;
        if (stopHist?.remarks) {
            const cleaned = stopHist.remarks
                .replace(/Permanently Stopped:/i, "")
                .replace(/Production force-stopped \(Permanent Stop\)\.?/i, "")
                .trim();
            if (cleaned) return cleaned;
        }
        // 3. From any plan stopReason
        const planWithReason = plans.find((p) => p.stopReason);
        if (planWithReason?.stopReason) return planWithReason.stopReason;
        return null;
    }, [fullOrder, displayOrder, plans]);

    return (
        <div className="w-full flex-1 flex flex-col min-h-[calc(100vh-theme(spacing.24))] pb-6">
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden flex-1 flex flex-col">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
                    <div>
                        <h3 className="text-lg font-bold text-ink flex items-center flex-wrap gap-2">
                            <span>Production Order Details</span>
                            <span className="text-primary text-sm font-bold font-mono">*{id || displayOrder?.productionOrderId}</span>
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
                    <div className="m-5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-5 py-3 rounded-xl flex items-center gap-3 text-sm font-medium">
                        <FaInfoCircle className="text-lg flex-shrink-0" />
                        <span>One or more required raw materials have insufficient stock. Please create a Raw Material Order before proceeding to Weekly Machine Assignment.</span>
                    </div>
                )}

                {/* Permanently Stopped alert */}
                {isStoppedOrder && (
                    <div className="mx-5 mb-0 mt-4 rounded-xl border border-amber-500/25 dark:border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
                        <div className="flex items-start sm:items-center gap-3.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <FaExclamationTriangle className="text-sm" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="text-sm font-bold text-ink">
                                        Production Order Permanently Stopped
                                    </span>
                                    <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 dark:border-amber-500/30">
                                        Shortfall
                                    </span>
                                    <span className="text-xs text-ink-subtle hidden sm:inline">•</span>
                                    <span className="text-xs font-medium text-ink-muted">
                                        Remaining shifts cancelled
                                    </span>
                                </div>
                                <div className="text-xs mt-1 text-ink-subtle leading-relaxed">
                                    Produced <span className="font-semibold text-ink">{producedVal.toLocaleString("en-IN")}</span> of <span className="font-semibold text-ink">{targetVal.toLocaleString("en-IN")} pcs</span> target · Shortfall: <span className="font-semibold text-amber-600 dark:text-amber-400">{Math.max(0, targetVal - producedVal).toLocaleString("en-IN")} pcs ({targetVal > 0 ? Math.round(((targetVal - producedVal) / targetVal) * 100) : 0}%)</span>
                                </div>
                            </div>
                        </div>

                        {orderStopReason && (
                            <div className="flex items-center gap-2 shrink-0 bg-card border border-line px-3.5 py-1.5 rounded-xl shadow-xs self-start md:self-auto">
                                <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">
                                    Stop Reason:
                                </span>
                                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/25 dark:border-amber-500/30 px-2.5 py-0.5 rounded-md font-mono">
                                    {orderStopReason}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="flex-1 py-20 flex justify-center items-center">
                        <CommonLoader text="Loading order details..." fullScreen={false} />
                    </div>
                ) : (
                    <div className="p-5 flex-1 flex flex-col gap-6">
                        {/* Summary KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                            {/* Card 1: Order Dates */}
                            <div className="bg-white dark:bg-card-2 border border-slate-200/90 dark:border-line rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all hover:border-purple-300 dark:hover:border-line-soft">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-ink-subtle uppercase tracking-wider">
                                        Order Dates
                                    </span>
                                    <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                        <FaCalendarAlt size={12} />
                                    </span>
                                </div>
                                <div className="text-base font-black text-slate-900 dark:text-ink mt-0.5">
                                    {formatDate(displayOrder?.orderDate)}
                                </div>
                                <span className="text-[11px] text-slate-500 dark:text-ink-subtle mt-1 font-medium">
                                    Due: <strong className="text-slate-700 dark:text-ink font-semibold">{formatDate(displayOrder?.dueDate)}</strong>
                                </span>
                            </div>

                            {/* Card 2: Target Qty */}
                            <div className="bg-white dark:bg-card-2 border border-slate-200/90 dark:border-line rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all hover:border-blue-300 dark:hover:border-line-soft">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-ink-subtle uppercase tracking-wider">
                                        Target Qty
                                    </span>
                                    <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                        <FaBoxes size={12} />
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-xl font-black text-slate-900 dark:text-ink">{targetVal.toLocaleString("en-IN")}</span>
                                    <span className="text-xs font-semibold text-slate-500 dark:text-ink-subtle">pcs</span>
                                </div>
                                <span className="text-[11px] text-slate-500 dark:text-ink-subtle mt-1 font-medium">
                                    {totalProductsCount} Product{totalProductsCount !== 1 ? "s" : ""}
                                </span>
                            </div>

                            {/* Card 3: Produced Qty */}
                            <div className="bg-white dark:bg-card-2 border border-slate-200/90 dark:border-line rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all hover:border-emerald-300 dark:hover:border-line-soft">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-ink-subtle uppercase tracking-wider">
                                        Produced Qty
                                    </span>
                                    <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                        <FaCheckCircle size={12} />
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-1.5 mt-0.5">
                                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{producedVal.toLocaleString("en-IN")}</span>
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">({completionPercent}%)</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-200/60 dark:border-slate-700">
                                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${completionPercent}%` }} />
                                </div>
                            </div>

                            {/* Card 4: Dispatched Qty */}
                            <div className="bg-white dark:bg-card-2 border border-slate-200/90 dark:border-line rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all hover:border-sky-300 dark:hover:border-line-soft">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-ink-subtle uppercase tracking-wider">
                                        Dispatched Qty
                                    </span>
                                    <span className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                                        <FaTruck size={12} />
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-1.5 mt-0.5">
                                    <span className="text-xl font-black text-sky-600 dark:text-sky-400">{totalDispatchedQty.toLocaleString("en-IN")}</span>
                                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">({dispatchPercent}%)</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-200/60 dark:border-slate-700">
                                    <div className="bg-sky-500 h-full rounded-full transition-all duration-500" style={{ width: `${dispatchPercent}%` }} />
                                </div>
                            </div>

                            {/* Card 5: Shift Plans */}
                            <div className="bg-white dark:bg-card-2 border border-slate-200/90 dark:border-line rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all hover:border-indigo-300 dark:hover:border-line-soft">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[11px] font-bold text-slate-500 dark:text-ink-subtle uppercase tracking-wider">
                                        Shift Plans
                                    </span>
                                    <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                        <FaCogs size={12} />
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-xl font-black text-slate-900 dark:text-ink">{plans.length}</span>
                                    <span className="text-xs font-semibold text-slate-500 dark:text-ink-subtle">shifts</span>
                                </div>
                                <span className="text-[11px] text-slate-500 dark:text-ink-subtle mt-1 font-medium">
                                    {plans.filter(p => ["COMPLETED", "COMPLETED_WITH_SHORTFALL"].includes(p.status)).length} completed
                                </span>
                            </div>
                        </div>

                        {/* Clean Seamless Tab Navigation */}
                        <div className="flex items-center gap-6 border-b border-line overflow-x-auto no-scrollbar pt-1">
                            <button
                                type="button"
                                onClick={() => handleTabChange("shifts")}
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
                                onClick={() => handleTabChange("dispatch")}
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
                                onClick={() => handleTabChange("rm_issues")}
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

                        {/* Tab Contents with Table Nav container */}
                        <div
                            ref={tableRef}
                            tabIndex={0}
                            data-table-nav
                            className="flex-1 flex flex-col outline-none focus:outline-none"
                        >
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

                                                    <DataTable
                                                        columns={shiftColumns}
                                                        data={group.plans}
                                                        rowKey={(plan) => plan.id || `${plan.date}-${plan.shiftName}`}
                                                        density="compact"
                                                        minHeightClassName="min-h-0"
                                                        className="border-0 rounded-none"
                                                        rowClassName={(plan, idx) => {
                                                            const gIdx = shiftGlobalIndexMap.get(plan.id || `shift-${idx}`) ?? idx;
                                                            return gIdx === focusedIndex ? "bg-primary/8 font-medium" : "";
                                                        }}
                                                        onRowClick={(plan, idx) => {
                                                            const gIdx = shiftGlobalIndexMap.get(plan.id || `shift-${idx}`) ?? idx;
                                                            setFocusedIndex(gIdx);
                                                            tableRef.current?.focus({ preventScroll: true });
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── TAB 2: DISPATCH HISTORY ── */}
                            {activeTab === "dispatch" && (
                                <div>
                                    <DataTable
                                        columns={dispatchColumns}
                                        data={fullOrder?.goodsDispatchItems || []}
                                        rowKey={(item) => item.dispatchItemId || item.id || `${item.dispatch?.dispatchNumber}-${item.productId}`}
                                        emptyMessage="No dispatches recorded for this order yet."
                                        density="compact"
                                        minHeightClassName="min-h-0"
                                        rowClassName={(_, idx) => (idx === focusedIndex ? "bg-primary/8 font-medium" : "")}
                                        onRowClick={(_, idx) => {
                                            setFocusedIndex(idx);
                                            tableRef.current?.focus({ preventScroll: true });
                                        }}
                                    />
                                </div>
                            )}

                            {/* ── TAB 3: RAW MATERIAL ISSUES ── */}
                            {activeTab === "rm_issues" && (
                                <div>
                                    {rmIssues.length > 0 ? (
                                        <div className="space-y-4">
                                            {rmIssues.map((adj, adjIdx) => (
                                                <div key={adj.adjId || adj.adjustmentNumber || adjIdx} className="border border-line rounded-xl overflow-hidden bg-card shadow-xs">
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

                                                    <DataTable
                                                        columns={rmColumns}
                                                        data={adj.items}
                                                        rowKey={(item: any) => item.id || item.rawMaterialId || item.rawMaterialCode || String(Math.random())}
                                                        density="compact"
                                                        minHeightClassName="min-h-0"
                                                        className="border-0 rounded-none"
                                                        rowClassName={(_, itemIdx) => {
                                                            const gIdx = rmGlobalIndexMap.get(`${adjIdx}-${itemIdx}`) ?? itemIdx;
                                                            return gIdx === focusedIndex ? "bg-primary/8 font-medium" : "";
                                                        }}
                                                        onRowClick={(_, itemIdx) => {
                                                            const gIdx = rmGlobalIndexMap.get(`${adjIdx}-${itemIdx}`) ?? itemIdx;
                                                            setFocusedIndex(gIdx);
                                                            tableRef.current?.focus({ preventScroll: true });
                                                        }}
                                                    />
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
                                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
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
                                    <FaCheckCircle className="text-emerald-500 dark:text-emerald-400" />
                                    <span>{hourlyDetails.length} hourly log entries recorded</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-ink">
                                        Total Produced: <strong className="text-emerald-600 dark:text-emerald-400">
                                            {hourlyDetails.reduce((sum, h) => {
                                                const gross = Number(h.qtyProduced ?? 0);
                                                const rej = Number(h.rejectQty ?? 0);
                                                const net = Number(h.netProducedQty !== undefined ? h.netProducedQty : Math.max(0, gross - rej));
                                                return sum + net;
                                            }, 0).toLocaleString("en-IN")} pcs
                                        </strong>
                                    </span>
                                    <span className="text-ink">
                                        Rejects: <strong className="text-red-500 dark:text-red-400">
                                            {hourlyDetails.reduce((sum, h) => sum + Number(h.rejectQty || 0), 0).toLocaleString("en-IN")}
                                        </strong>
                                    </span>
                                    <span className="text-ink">
                                        Scrap: <strong className="text-amber-500 dark:text-amber-400">
                                            {hourlyDetails.reduce((sum, h) => sum + Number(h.scrapQty || 0), 0).toLocaleString("en-IN")}
                                        </strong>
                                    </span>
                                    <span className="text-ink">
                                        Downtime: <strong className="text-amber-600 dark:text-amber-400">
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
