import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useLocation, useParams } from "react-router-dom";
import { FaInfoCircle } from "react-icons/fa";
import { productionOrderService } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { stockAdjustmentService } from "../../../services/stockAdjustmentService";
import BackButton from "../../../components/ui/BackButton/BackButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import { useSocketSync } from "../../../hooks/useSocketSync";

const PRODUCTION_STARTED_STATUSES = [
    "WEEKLY_SCHEDULED", "DAILY_PLANNED", "IN_PROGRESS", "IN_PRODUCTION",
    "POST_PRODUCTION", "READY_FOR_DISPATCH", "PARTIAL_COMPLETED",
    "COMPLETED_WITH_SHORTFALL", "DISPATCHED", "CLOSED", "CANCELLED",
];

const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

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

// ── Raw Materials sub-section ─────────────────────────────────────────────────

interface RmTableProps {
    rawMaterials: any[];
    rawMaterialsMap: Map<string, any>;
    orderStatus: string;
    productionHasStarted: boolean;
}

const RawMaterialsTable: React.FC<RmTableProps> = ({
    rawMaterials, rawMaterialsMap, orderStatus, productionHasStarted,
}) => {
    const isReservedStatus = ["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULED", "IN_PROGRESS", "IN PROGRESS"].includes(orderStatus);

    const columns: DataTableColumn<any>[] = useMemo(() => [
        {
            header: "RAW MATERIAL CODE",
            width: "160px",
            render: (rm) => <span className="font-semibold text-ink">{rm.rawMaterialId}</span>,
        },
        {
            header: "RAW MATERIAL NAME",
            render: (rm) => {
                const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                return <span className="text-ink-muted">{rm.materialName || stockRm?.materialName || rm.rawMaterialId}</span>;
            },
        },
        {
            header: "REQUIRED QTY",
            align: "right",
            width: "140px",
            render: (rm) => {
                const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                const required = Number(rm.requiredQty || 0);
                let displayUom = stockRm?.baseUom?.split(",")[0] || rm.uom || "KG";
                displayUom = normalizeUom(displayUom);
                return <span className="font-medium text-ink">{required.toFixed(2)} {displayUom}</span>;
            },
        },
        {
            header: "AVAILABLE STOCK",
            align: "right",
            width: "150px",
            render: (rm) => {
                const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                const required = Number(rm.requiredQty || 0);
                let available = stockRm
                    ? Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0)
                    : Number(rm.availableStock || 0);
                if (isReservedStatus && stockRm) available += required;
                let displayUom = stockRm?.baseUom?.split(",")[0] || rm.uom || "KG";
                displayUom = normalizeUom(displayUom);
                return <span className="text-ink-muted">{available.toFixed(2)} {displayUom}</span>;
            },
        },
        {
            header: "STOCK STATUS",
            align: "center",
            width: "130px",
            render: (rm) => {
                const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                const required = Number(rm.requiredQty || 0);
                let available = stockRm
                    ? Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0)
                    : Number(rm.availableStock || 0);
                if (isReservedStatus && stockRm) available += required;
                const isAvailable = productionHasStarted || (rm.status ? rm.status === "AVAILABLE" : available >= required);
                return <StatusBadge status={isAvailable ? "AVAILABLE" : "INSUFFICIENT"} />;
            },
        },
    ], [rawMaterialsMap, isReservedStatus, productionHasStarted]);

    return (
        <DataTable
            columns={columns}
            data={rawMaterials}
            rowKey={(rm) => rm.rawMaterialId}
            emptyMessage="No raw materials defined for this product."
            minHeightClassName="min-h-0"
            density="compact"
        />
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const ProductionOrderHistoryView: React.FC = () => {
    const location = useLocation();
    const { id } = useParams<{ id: string }>();

    const [passedOrder] = useState<any>(location.state?.order || null);
    const [fullOrder, setFullOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [rmIssues, setRmIssues] = useState<any[]>([]);

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

    // ── Fetch history ─────────────────────────────────────────────────────────
    const fetchHistory = useCallback(() => {
        if (!id) return;
        productionOrderService.getHistory(id)
            .then((data: any) => setHistoryRecords(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, [id]);

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
    const fetchOrderDetails = useCallback((orderToFetch: any) => {
        setLoading(true);
        const fetchIds: string[] =
            orderToFetch.items?.length > 0
                ? orderToFetch.items.map((i: any) => i.productionOrderId || i.id)
                : [orderToFetch.productionOrderId || orderToFetch.id || id];

        Promise.all(fetchIds.map((fid: string) => productionOrderService.getById(fid)))
            .then((dataArray) => {
                if (dataArray.length === 0) { setFullOrder(null); return; }
                const merged: any = { ...dataArray[0] };
                merged.products = dataArray.map((d: any) => ({
                    productName: d.productItem?.productName || "Unknown",
                    productCode: d.productItem?.productCode || "Unknown",
                    quantity: d.targetQty || 0,
                    uom: d.uom || d.productItem?.uom || "pcs",
                    weightPerPieceUsed: d.productItem?.weightPerPiece || 0,
                    rawMaterials: d.draftRawMaterials || d.rawMaterials || [],
                    productionOrderId: d.productionOrderId,
                    status: d.status,
                }));
                merged.productionOrderId = orderToFetch.productionOrderId || orderToFetch.id || id;
                setFullOrder(merged);
            })
            .catch(() => toast.error("Failed to load production order details"))
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        if (passedOrder) fetchOrderDetails(passedOrder);
        else if (id) fetchOrderDetails({ id });
    }, [passedOrder, id, fetchOrderDetails]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);
    useEffect(() => { fetchRmIssues(); }, [fetchRmIssues]);

    useSocketSync("productionOrder", undefined, () => {
        if (passedOrder) fetchOrderDetails(passedOrder);
        else if (id) fetchOrderDetails({ id });
        fetchHistory();
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
                const hourlySum = plan.hourlyProductions?.reduce(
                    (acc: number, h: any) => acc + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0) - Number(h.scrapQty || 0)), 0
                ) || 0;
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
                // If hourlySum = 0 and status is COMPLETED (not a permanent stop), assume full production
                const producedQty = hourlySum > 0 ? hourlySum : (plan.status === "COMPLETED" && !isPermanentStop ? plannedQty : 0);
                // A COMPLETED plan that produced less than planned was stopped early → show shortfall status
                let displayStatus = plan.status || "PLANNED";
                if (displayStatus === "COMPLETED" && plannedQty > 0 && producedQty > 0 && producedQty < plannedQty) {
                    displayStatus = "COMPLETED_WITH_SHORTFALL";
                }
                return {
                    id: plan.dailyPlanId,
                    date: plan.productionDate ? new Date(plan.productionDate).toLocaleDateString("en-IN") : "-",
                    shiftName: plan.shift?.shiftName || plan.shiftId || "-",
                    machineName: plan.machine?.machineName || plan.machineId || fullOrder?.Machine?.machineName || "-",
                    plannedQty,
                    producedQty,
                    status: displayStatus,
                    stopReason,
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
        if (fullOrder?.dailyProductionPlans?.length > 0) {
            return fullOrder.dailyProductionPlans.reduce(
                (total: number, plan: any) =>
                    total + (plan.hourlyProductions?.reduce(
                        (acc: number, h: any) => acc + Math.max(0, Number(h.qtyProduced || 0) - Number(h.rejectQty || 0) - Number(h.scrapQty || 0)), 0
                    ) || 0),
                0
            );
        }
        return Number(fullOrder?.producedQty || displayOrder?.producedQty || 0);
    }, [fullOrder, displayOrder]);

    // ── Shift table columns ───────────────────────────────────────────────────
    const shiftColumns: DataTableColumn<any>[] = useMemo(() => {
        return [
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
                header: "MACHINE",
                render: (plan) => <span className="text-ink-muted">{plan.machineName}</span>,
            },
            {
                header: "PLANNED QTY",
                align: "right",
                width: "110px",
                render: (plan) => <span className="font-semibold text-ink-muted">{plan.plannedQty}</span>,
            },
            {
                header: "PRODUCED QTY",
                align: "right",
                width: "120px",
                render: (plan) => <span className="font-bold text-green-600">{plan.producedQty}</span>,
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
        ];
    }, []);

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
            date: displayOrder?.orderDate ? new Date(displayOrder.orderDate).toLocaleDateString("en-IN") : "-",
            shiftName: "General Shift",
            machineName: fullOrder?.Machine?.machineName || fullOrder?.machineMachineId || "-",
            plannedQty: Number(displayOrder?.targetQty || 0),
            producedQty: Number(displayOrder?.producedQty || 0),
            status: displayOrder?.status || "-",
            _dispatchStatus: dispatchStatus,
        }];
    }, [plans, displayOrder, fullOrder]);

    const fallbackShiftColumns: DataTableColumn<any>[] = useMemo(() => [
        { header: "DATE", width: "110px", render: (r) => <span className="font-medium text-ink">{r.date}</span> },
        { header: "SHIFT", width: "120px", render: (r) => <span className="text-ink-muted">{r.shiftName}</span> },
        { header: "MACHINE", render: (r) => <span className="text-ink-muted">{r.machineName}</span> },
        { header: "PLANNED QTY", align: "right", width: "110px", render: (r) => <span className="font-semibold text-ink-muted">{r.plannedQty}</span> },
        { header: "PRODUCED QTY", align: "right", width: "120px", render: (r) => <span className="font-bold text-green-600">{r.producedQty}</span> },
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
    ], []);

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
                    ? new Date(item.dispatch.dispatchDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
                    : "-"}
            </span>,
        },
        {
            header: "VEHICLE",
            render: (item) => <span className="text-ink-muted">{item.dispatch?.vehicleNumber || "-"}</span>,
        },
        {
            header: "DRIVER",
            render: (item) => <span className="text-ink-muted">{item.dispatch?.driverName || "-"}</span>,
        },
        {
            header: "DISPATCH QTY",
            align: "right",
            width: "120px",
            render: (item) => <span className="font-semibold text-ink-muted">{Number(item.dispatchQty || 0).toFixed(2)}</span>,
        },
        {
            header: "RECEIVED QTY",
            align: "right",
            width: "120px",
            render: (item) => <span className="font-semibold text-blue-600">
                {item.receivedQty != null ? Number(item.receivedQty).toFixed(2) : "-"}
            </span>,
        },
        {
            header: "STATUS",
            width: "150px",
            render: (item) => <StatusBadge status={item.dispatch?.status || "PENDING_GATE_APPROVAL"} />,
        },
    ], []);


    // ── Status history columns ────────────────────────────────────────────────
    const historyColumns: DataTableColumn<any>[] = useMemo(() => [
        {
            header: "#",
            width: "48px",
            render: (_, idx) => <span className="text-ink-subtle font-medium">{idx + 1}</span>,
        },
        {
            header: "DATE & TIME",
            width: "160px",
            render: (rec) => <span className="text-ink-muted whitespace-nowrap">{formatDateTime(rec.changedAt)}</span>,
        },
        {
            header: "ACTION",
            width: "160px",
            render: (rec) => <span className="font-medium text-ink">{rec.action || "-"}</span>,
        },
        {
            header: "FROM STATUS",
            width: "170px",
            render: (rec) => rec.fromStatus
                ? <StatusBadge status={rec.fromStatus} />
                : <span className="text-ink-subtle italic">—</span>,
        },
        {
            header: "TO STATUS",
            width: "170px",
            render: (rec) => <StatusBadge status={rec.toStatus} />,
        },
        {
            header: "CHANGED BY",
            render: (rec) => <span className="text-ink-muted">{rec.changedByName || rec.changedBy || "-"}</span>,
        },
        {
            header: "REMARKS",
            render: (rec) => <span className="text-ink-muted">{rec.remarks || "-"}</span>,
        },
    ], []);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="w-full">
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                    <h2 className="text-xl font-bold text-ink">
                        Production Order Details
                        <span className="text-primary text-sm font-semibold ml-2">{id}</span>
                    </h2>
                    <BackButton text="Back to List" to="/allproduction-orders" />
                </div>

                <div className="p-5 lg:p-6 space-y-6">
                    {/* Insufficient stock alert */}
                    {hasInsufficientStock && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium">
                            One or more required raw materials have insufficient stock. Please create a Raw Material Order before proceeding to Weekly Machine Assignment.
                        </div>
                    )}

                    {loading ? (
                        <CommonLoader text="Loading order details..." fullScreen={false} />
                    ) : (
                        <>
                            {/* ── General Info ──────────────────────────────── */}
                            <div className="bg-card-2 rounded-xl border border-line p-5">
                                <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider mb-4">Order Information</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                                    <div>
                                        <div className="text-xs text-ink-subtle font-medium mb-1 uppercase">Order No</div>
                                        <div className="font-semibold text-ink">{displayOrder?.productionOrderId || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-ink-subtle font-medium mb-1 uppercase">Order Date</div>
                                        <div className="font-semibold text-ink">{formatDate(displayOrder?.orderDate)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-ink-subtle font-medium mb-1 uppercase">Due Date</div>
                                        <div className="font-semibold text-ink">{formatDate(displayOrder?.dueDate)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-ink-subtle font-medium mb-1 uppercase">Status</div>
                                        <div className="flex flex-col gap-1 items-start">
                                            {(() => {
                                                const rawStatus = displayOrder?.status || fullOrder?.status;
                                                const target = Number(fullOrder?.targetQty || displayOrder?.targetQty || 0);
                                                const produced = Number(fullOrder?.producedQty || displayOrder?.producedQty || 0);
                                                // If DB has COMPLETED_WITH_SHORTFALL but produced >= target, it was set incorrectly — show correct status
                                                const resolvedStatus = rawStatus === "COMPLETED_WITH_SHORTFALL" && target > 0 && produced >= target
                                                    ? "READY_FOR_DISPATCH"
                                                    : rawStatus;
                                                const shortfall = target - produced;
                                                return (
                                                    <>
                                                        <StatusBadge status={resolvedStatus} />
                                                        {resolvedStatus === "COMPLETED_WITH_SHORTFALL" && shortfall > 0 && (
                                                            <span className="text-[10px] text-red-600 font-bold uppercase whitespace-nowrap">
                                                                Shortfall: {shortfall} pcs
                                                            </span>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Products & Raw Materials ──────────────────── */}
                            {fullOrder?.products?.map((prod: any, idx: number) => (
                                <div key={idx} className="border border-line rounded-xl overflow-hidden">
                                    {/* Product header */}
                                    <div className="bg-card-2 border-b border-line px-5 py-4">
                                        <h4 className="text-sm font-bold text-ink mb-3">
                                            Product {idx + 1}: <span className="text-primary">{prod.productName}</span>{" "}
                                            <span className="text-ink-subtle font-normal text-xs">({prod.productCode})</span>
                                        </h4>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <div className="text-xs text-ink-subtle font-medium mb-1 uppercase">Production Qty</div>
                                                <div className="font-semibold text-ink">{prod.quantity} {normalizeUom(prod.uom)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-ink-subtle font-medium mb-1 uppercase">Weight Used</div>
                                                <div className="font-semibold text-ink">{Number(prod.weightPerPieceUsed || 0).toFixed(3)} KG</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-ink-subtle font-medium mb-1 uppercase">Unit (UOM)</div>
                                                <div className="font-semibold text-ink">{normalizeUom(prod.uom)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Raw materials table */}
                                    <div className="p-5">
                                        <div className="text-xs font-extrabold text-ink uppercase tracking-wider mb-3">
                                            Required Raw Materials
                                        </div>
                                        <RawMaterialsTable
                                            rawMaterials={prod.rawMaterials || []}
                                            rawMaterialsMap={rawMaterialsMap}
                                            orderStatus={fullOrder?.status || ""}
                                            productionHasStarted={productionHasStarted}
                                        />
                                    </div>
                                </div>
                            ))}

                            {/* ── Shift-wise Production & Dispatch ─────────── */}
                            <div className="border border-line rounded-xl overflow-hidden">
                                <div className="flex flex-wrap justify-between items-center gap-3 px-5 py-4 border-b border-line bg-card">
                                    <h4 className="text-sm font-bold text-ink">Shift-wise Production &amp; Dispatch Details</h4>
                                    <div className="flex items-center gap-3 flex-wrap text-xs font-semibold text-ink-subtle uppercase tracking-wider">
                                        <span>Target: <span className="text-ink font-bold text-sm">{targetVal}</span></span>
                                        <span className="text-line-soft">|</span>
                                        <span>Produced: <span className="text-green-600 font-bold text-sm">{producedVal}</span></span>
                                        <span className="text-line-soft">|</span>
                                        <span>Dispatched: <span className="text-blue-600 font-bold text-sm">{totalDispatchedQty}</span></span>
                                        {fullOrder?.status === "COMPLETED_WITH_SHORTFALL" && producedVal < targetVal && (
                                            <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded text-xs font-bold uppercase whitespace-nowrap">
                                                Permanently Stopped (Shortfall: {targetVal - producedVal} pcs)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4">
                                    <DataTable
                                        columns={plansWithDispatch.length > 0 ? shiftColumns : fallbackShiftColumns}
                                        data={plansWithDispatch.length > 0 ? plansWithDispatch : fallbackShiftData}
                                        rowKey={(r) => r.id}
                                        emptyMessage="No shift plans recorded yet."
                                        minHeightClassName="min-h-0"
                                        density="compact"
                                    />
                                </div>
                            </div>

                            {/* ── Dispatch History ──────────────────────────── */}
                            {fullOrder?.goodsDispatchItems?.length > 0 && (
                                <div className="border border-line rounded-xl overflow-hidden">
                                    <div className="px-5 py-4 border-b border-line bg-card">
                                        <h4 className="text-sm font-bold text-ink">Dispatch History</h4>
                                    </div>
                                    <div className="p-4">
                                        <DataTable
                                            columns={dispatchColumns}
                                            data={fullOrder.goodsDispatchItems}
                                            rowKey={(item) => item.id}
                                            emptyMessage="No dispatches recorded."
                                            minHeightClassName="min-h-0"
                                            density="compact"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ── Raw Material Issues ───────────────────────── */}
                            {rmIssues.length > 0 && (
                                <div className="border border-line rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-card">
                                        <h4 className="text-sm font-bold text-ink">Raw Material Issues</h4>
                                        <span className="text-xs font-semibold text-ink-subtle bg-card-2 border border-line px-2.5 py-1 rounded-full">
                                            {rmIssues.length} adjustment{rmIssues.length !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {rmIssues.map((adj: any) => (
                                            <div key={adj.adjId} className="border border-line rounded-lg overflow-hidden">
                                                {/* Adjustment header */}
                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 bg-card-2 border-b border-line-soft">
                                                    <span className="font-mono text-xs font-bold text-primary">{adj.adjustmentNumber}</span>
                                                    <span className="text-xs text-ink-muted">{formatDate(adj.date)}</span>
                                                    {adj.reason && adj.reason !== "-" && (
                                                        <span className="text-xs text-ink-subtle italic">{adj.reason}</span>
                                                    )}
                                                    <span className="ml-auto text-xs text-ink-subtle font-medium">
                                                        {adj.items.length} material{adj.items.length !== 1 ? "s" : ""}
                                                    </span>
                                                </div>
                                                {/* Items */}
                                                <div className="divide-y divide-line-soft">
                                                    {/* Column headers */}
                                                    <div className="grid grid-cols-[1fr_140px_110px_110px_110px_1fr] gap-3 px-4 py-2 bg-card-2/40">
                                                        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Raw Material</span>
                                                        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Store</span>
                                                        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider text-right">Before</span>
                                                        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider text-right">After</span>
                                                        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider text-right">Issued</span>
                                                        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Remarks</span>
                                                    </div>
                                                    {adj.items.map((item: any, idx: number) => (
                                                        <div key={idx} className="grid grid-cols-[1fr_140px_110px_110px_110px_1fr] gap-3 px-4 py-2.5 hover:bg-card-2/30 transition-colors">
                                                            <div>
                                                                <div className="font-semibold text-sm text-ink">{item.rawMaterialName}</div>
                                                                {item.rawMaterialCode && item.rawMaterialCode !== "-" && (
                                                                    <div className="text-xs text-ink-subtle">{item.rawMaterialCode}</div>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-ink-muted self-center">{item.store}</span>
                                                            <span className="text-xs text-ink-muted text-right self-center tabular-nums">
                                                                {item.currentQty.toFixed(3)} {item.uom}
                                                            </span>
                                                            <span className="text-xs text-ink-muted text-right self-center tabular-nums">
                                                                {item.adjustedQty.toFixed(3)} {item.uom}
                                                            </span>
                                                            <span className={`text-xs font-bold text-right self-center tabular-nums whitespace-nowrap ${item.difference < 0 ? "text-red-500" : "text-green-500"}`}>
                                                                {item.difference < 0 ? "" : "+"}{item.difference.toFixed(3)} {item.uom}
                                                            </span>
                                                            <span className="text-xs text-ink-muted self-center">{item.remarks}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Status Change History ─────────────────────── */}
                            {historyRecords.length > 0 && (
                                <div className="border border-line rounded-xl overflow-hidden">
                                    <div className="px-5 py-4 border-b border-line bg-card">
                                        <h4 className="text-sm font-bold text-ink">Status Change History</h4>
                                    </div>
                                    <div className="p-4">
                                        <DataTable
                                            columns={historyColumns}
                                            data={historyRecords}
                                            rowKey={(rec) => rec.id ?? rec.changedAt ?? Math.random()}
                                            emptyMessage="No history available."
                                            minHeightClassName="min-h-0"
                                            density="compact"
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductionOrderHistoryView;
