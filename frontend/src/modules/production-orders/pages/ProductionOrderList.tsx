import React, { useState, useCallback, useEffect } from "react";
import { FaPlus, FaCalendarAlt, FaCheckCircle, FaEye, FaSyncAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CustomButton from "../../../components/ui/Button/Button";
import DataTable from "../../../components/ui/table/DataTable";
import IconButton from "../../../components/ui/IconButton/IconButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { productionOrderService } from "../../../services/productionOrderService";
import type { ProductionOrder } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { salesOrderService } from "../../../services/salesOrderService";
import { finishedGoodsStockService } from "../../../services/finishedGoodsStockService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

const ITEMS_PER_PAGE = 20;

const ProductionOrderList: React.FC = () => {
    const navigate = useNavigate();
    const { can } = usePermission();

    // --- State ---
    const [combinedData, setCombinedData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ProductionOrder | null>(null);
    const [fullOrder, setFullOrder] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string[]>([]);

    const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());



    // Fetch raw materials map
    const fetchRawMaterials = useCallback(async () => {
        try {
            const data = await rawMaterialService.fetchAll();
            const arr = Array.isArray(data) ? data : ((data as any)?.rawMaterials ?? []);
            const map = new Map<string, any>();
            arr.forEach((rm: any) => map.set(rm.rawMaterialId?.toString(), rm));
            setRawMaterialsMap(map);
        } catch (error) {
            console.error("Failed to fetch raw materials", error);
        }
    }, []);

    const fetchOrderDetails = useCallback(async (id: string) => {
        setLoadingDetails(true);
        try {
            const data = (await productionOrderService.getById(id)) as any;
            if (data && data.products) {
                data.products = data.products.map((p: any) => ({
                    ...p,
                    productionOrderId: data.productionOrderId,
                    status: data.status
                }));
            }
            setFullOrder(data);
        } catch (err) {
            console.error("❌ Failed to fetch PO details:", err);
            toast.error("Failed to load production order details");
        } finally {
            setLoadingDetails(false);
        }
    }, []);

    useEffect(() => {
        fetchRawMaterials();
    }, [fetchRawMaterials]);

    // Fetch and combine Sales Orders and Production Orders
    const fetchCombinedData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch Sales Orders (status: IN_PRODUCTION) if allowed
            let soList: any[] = [];
            if (can("sales-orders.view")) {
                try {
                    const soRes = await salesOrderService.fetchAll({
                        status: "IN_PRODUCTION"
                    });
                    soList = (soRes as any).data || soRes || [];
                } catch (err) {
                    console.warn("Sales Orders fetch skipped or permission denied:", err);
                }
            }

            // 2. Fetch Production Orders
            let poList: any[] = [];
            if (can("production_orders.view") || can("weekly_programs.view")) {
                try {
                    const poRes = await productionOrderService.fetchAll({
                        limit: 10
                    } as any);
                    poList = poRes.data || [];
                } catch (err) {
                    console.warn("Production Orders fetch skipped or permission denied:", err);
                }
            }

            // 2.5 Fetch Finished Goods Stock
            let fgList: any[] = [];
            if (can("finished_goods_stocks.view")) {
                try {
                    const fgRes = await finishedGoodsStockService.fetchAll();
                    fgList = Array.isArray(fgRes) ? fgRes : (fgRes as any).data || [];
                } catch (err) {
                    console.warn("Failed to fetch Finished Goods Stock:", err);
                }
            }

            // Create stock map of productItemId -> onHandQty
            const fgStockMap = new Map<string, number>();
            fgList.forEach((fg: any) => {
                const prodId = (fg.productItemId || fg.productId)?.toString();
                if (prodId) {
                    const qty = Number(fg.onHandQty || 0);
                    fgStockMap.set(prodId, (fgStockMap.get(prodId) || 0) + qty);
                }
            });

            // 3. Map Sales Orders to their production orders
            const mapped = soList.map((so: any) => {
                const associatedPOs = poList.filter((po: any) =>
                    po.sourceSalesOrderId === so.id.toString() ||
                    po.sourceSalesOrderId === so.orderNo
                );

                let status = "PENDING_PLANNING";
                let primaryPO = null;

                if (associatedPOs.length > 0) {
                    primaryPO = associatedPOs[0];
                    const hasCreated = associatedPOs.some((po: any) => po.status === "CREATED");
                    const hasWaiting = associatedPOs.some((po: any) => po.status === "WAITING_FOR_MATERIAL");
                    const hasReady = associatedPOs.some((po: any) => po.status === "READY_FOR_PLANNING");
                    const hasWeekly = associatedPOs.some((po: any) => po.status === "WEEKLY_SCHEDULED" || po.status === "SCHEDULED");
                    const hasDaily = associatedPOs.some((po: any) => po.status === "DAILY_PLANNED");
                    const hasProgress = associatedPOs.some((po: any) => po.status === "IN_PRODUCTION" || po.status === "IN_PROGRESS");
                    const hasPostProd = associatedPOs.some((po: any) => po.status === "POST_PRODUCTION");
                    const hasReadyDispatch = associatedPOs.some((po: any) => po.status === "READY_FOR_DISPATCH" || po.status === "COMPLETED");
                    const hasDispatched = associatedPOs.every((po: any) => po.status === "DISPATCHED");

                    if (hasDispatched) {
                        status = "DISPATCHED";
                    } else if (hasReadyDispatch) {
                        status = "READY_FOR_DISPATCH";
                    } else if (hasPostProd) {
                        status = "POST_PRODUCTION";
                    } else if (hasProgress) {
                        status = "IN_PRODUCTION";
                    } else if (hasDaily) {
                        status = "DAILY_PLANNED";
                    } else if (hasWeekly) {
                        status = "WEEKLY_SCHEDULED";
                    } else if (hasReady) {
                        status = "READY_FOR_PLANNING";
                    } else if (hasWaiting) {
                        status = "WAITING_FOR_MATERIAL";
                    } else if (hasCreated) {
                        status = "CREATED";
                    } else {
                        status = associatedPOs[0]?.status || "CREATED";
                    }
                } else {
                    // Check Finished Goods Stock
                    let isAllAvailable = true;
                    if (so.items && so.items.length > 0) {
                        so.items.forEach((item: any) => {
                            const prodId = (item.productId || item.product?.id)?.toString();
                            const orderedQty = Number(item.quantity || 0);
                            const stockQty = fgStockMap.get(prodId) || 0;
                            if (stockQty < orderedQty) {
                                isAllAvailable = false;
                            }
                        });
                    } else {
                        isAllAvailable = false;
                    }
                    if (isAllAvailable) {
                        status = "AVAILABLE";
                    }
                }

                return {
                    ...so,
                    status,
                    productionOrders: associatedPOs,
                    primaryPO
                };
            });

            // 4. Find Production Orders that do not belong to any Sales Order in soList
            const directPOs = poList.filter((po: any) => {
                if (!po.sourceSalesOrderId) return true;
                const matchesSO = soList.some((so: any) =>
                    so.id.toString() === po.sourceSalesOrderId ||
                    so.orderNo === po.sourceSalesOrderId
                );
                return !matchesSO;
            });

            const directMapped = directPOs.map((po: any) => {
                return {
                    id: `direct-${po.productionOrderId}`,
                    orderNo: po.productionOrderId,
                    orderDate: po.orderDate,
                    expectedCompletionDate: po.dueDate,
                    customer: { firmName: "Direct Production Order" },
                    status: po.status,
                    productionOrders: [po],
                    primaryPO: po,
                    isDirect: true,
                    items: [{
                        product: po.productItem,
                        quantity: po.targetQty
                    }]
                };
            });

            // Combine both mapped and directMapped
            let combinedList = [...mapped, ...directMapped];

            // Filter out DISPATCHED, CANCELLED, and AVAILABLE items from the active board
            combinedList = combinedList.filter(item => !["DISPATCHED", "CANCELLED", "CANCELED", "DELETED", "AVAILABLE"].includes(item.status?.toUpperCase()));

            setTotalItems(combinedList.length);

            // 7. Paginate
            const start = (currentPage - 1) * ITEMS_PER_PAGE;
            setCombinedData(combinedList.slice(start, start + ITEMS_PER_PAGE));
        } catch (error) {
            console.error("Failed to load combined dashboard data", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    }, [currentPage]);

    useEffect(() => {
        fetchCombinedData();
    }, [fetchCombinedData]);

    useSocketSync("productionOrder", undefined, fetchCombinedData);
    useSocketSync("salesOrder", undefined, fetchCombinedData);



    const handleCreateProductionOrder = (so: any) => {
        navigate(`/production-orders/create`, {
            state: { sourceSalesOrderId: so.id }
        });
    };

    // STEP 2 & 3: Auto-check raw material availability when assigning to Weekly Schedule
    const handleAssignWeekly = async (item: any) => {
        const po = item.primaryPO;
        if (!po) return;

        // If status is already READY_FOR_PLANNING / PENDING_PLANNING, navigate directly!
        const isAlreadyReady = ["READY_FOR_PLANNING", "PENDING_PLANNING"].includes(po.status) || 
                               ["READY_FOR_PLANNING", "PENDING_PLANNING"].includes(item.status);
        if (isAlreadyReady) {
            navigate(`/weekly-machine-schedules/create?po=${po.productionOrderId}`);
            return;
        }

        setLoading(true);
        try {
            // Check materials directly
            const result = await productionOrderService.checkMaterialAvailability(po.productionOrderId);
            if ((result as any).allAvailable) {
                toast.success(`Raw materials verified. Navigating to Weekly Scheduling for ${po.productionOrderId}.`);
                navigate(`/weekly-machine-schedules/create?po=${po.productionOrderId}`);
            } else {
                const insufficient = (result as any).materialStatus?.filter((m: any) => m.status === "INSUFFICIENT") || [];
                toast.warning(
                    `${insufficient.length} material(s) are insufficient for order ${po.productionOrderId}. ` +
                    `Status set to WAITING FOR MATERIAL. Please create purchase orders for: ${insufficient.map((m: any) => m.materialName).join(", ")}`
                );
                fetchCombinedData();
            }
        } catch (error: any) {
            console.error("Failed to check materials:", error);
            toast.error(error?.response?.data?.message || error?.message || "Failed to verify material availability.");
        } finally {
            setLoading(false);
        }
    };

    const handleRecheckMaterials = async (item: any) => {
        const po = item.primaryPO;
        if (!po) return;
        setLoading(true);
        try {
            const result = await productionOrderService.checkMaterialAvailability(po.productionOrderId);
            if ((result as any).allAvailable) {
                toast.success(`Raw materials verified! Order ${po.productionOrderId} is now READY FOR PLANNING.`);
            } else {
                const insufficient = (result as any).materialStatus?.filter((m: any) => m.status === "INSUFFICIENT") || [];
                toast.warning(
                    `Raw materials still insufficient for order ${po.productionOrderId}. ` +
                    `Please add stock for: ${insufficient.map((m: any) => m.materialName).join(", ")}`
                );
            }
            fetchCombinedData();
        } catch (error: any) {
            console.error("Failed to check materials:", error);
            toast.error(error?.response?.data?.message || error?.message || "Failed to verify material availability.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEdit = (po: any) => {
        navigate(`/production-orders/edit/${po.productionOrderId}`);
    };

    const handleAllocateRM = async (order: any) => {
        setLoading(true);
        try {
            let successCount = 0;
            const targetPOs = order.productionOrders.filter((po: any) => po.status === "RM_PENDING");

            if (targetPOs.length === 0) {
                toast.info("No raw materials require allocation.");
                setLoading(false);
                return;
            }

            for (const po of targetPOs) {
                const fullPo = await productionOrderService.getById(po.productionOrderId);
                const cleanRawMaterials = ((fullPo as any).draftRawMaterials || []).map((rm: any) => ({
                    rawMaterialId: rm.rawMaterialId?.toString() || "",
                    requiredQty: Number(rm.requiredQty),
                    uom: rm.uom || "KG",
                    storeId: rm.storeId?.toString() || "STR-001",
                    remarks: rm.remarks || ""
                }));

                const updated = await productionOrderService.update(po.productionOrderId, {
                    status: "PLANNED",
                    rawMaterials: cleanRawMaterials
                });
                if (updated.status === "RM_AVAILABLE" || updated.status === "READY_FOR_PLANNING") {
                    successCount++;
                }
            }

            if (successCount === targetPOs.length) {
                toast.success(`Raw materials successfully allocated and reserved for Sales Order ${order.orderNo}!`);
            } else if (successCount > 0) {
                toast.warning(`Raw materials allocated for ${successCount}/${targetPOs.length} items. Stock is still insufficient for remaining items.`);
            } else {
                toast.error(`Raw material stock is still insufficient for Sales Order ${order.orderNo}.`);
            }
            fetchCombinedData();
        } catch (error: any) {
            console.error("Failed to allocate raw materials:", error);
            toast.error(error?.response?.data?.message || error?.message || "Failed to allocate raw materials.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!itemToDelete || itemToDelete.length === 0) return;
        try {
            for (const id of itemToDelete) {
                await productionOrderService.delete(id);
            }
            toast.success("Production order(s) deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete([]);
            fetchCombinedData();
        } catch (error: any) {
            console.error("Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete order(s)");
        }
    };

    const triggerDelete = useCallback((ids: string[]) => {
        setItemToDelete(ids);
        setShowDeleteModal(true);
    }, []);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    const columns = [
        {
            header: "#",
            width: "48px",
            render: (_: any, index: number) => <span className="text-ink-subtle">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</span>
        },
        {
            header: "PO NO",
            width: "110px",
            render: (item: any) => <span className="font-semibold text-ink">{item.primaryPO ? item.primaryPO.productionOrderId : item.orderNo}</span>
        },
        {
            header: "ORDER DATE",
            width: "100px",
            render: (item: any) => <span className="text-ink-muted">{formatDate(item.orderDate)}</span>
        },
        {
            header: "EXPECTED DATE",
            width: "110px",
            render: (item: any) => <span className="text-ink-muted">{item.expectedCompletionDate ? formatDate(item.expectedCompletionDate) : "-"}</span>
        },
        {
            header: "PRODUCTS",
            width: "minmax(0, 1fr)",
            render: (item: any) => <span className="text-ink-muted">{item.productionOrders && item.productionOrders.length > 0
                ? item.productionOrders.map((po: any) => po.productItem?.productName || "Unknown Product").join(", ")
                : item.items?.map((it: any) => it.product?.productName || "Unknown Product").join(", ") || "-"
            }</span>
        },
        {
            header: "STATUS",
            width: "165px",
            render: (item: any) => <StatusBadge status={item.status} />
        },
        {
            header: "ACTIONS",
            width: "160px",
            render: (item: any) => (
                <div className="flex items-center gap-2 justify-start">

                    {/* PENDING_PLANNING with no PO yet → Create Production Order */}
                    {item.status === "PENDING_PLANNING" && !item.primaryPO && can("production_orders.create") && (
                        <IconButton
                            variant="primary"
                            title="Create Production Order"
                            icon={FaPlus}
                            onClick={() => handleCreateProductionOrder(item)}
                        />
                    )}

                    {/* CREATED / PENDING_PLANNING / READY_FOR_PLANNING with PO → Assign to Weekly */}
                    {(item.status === "CREATED" || item.status === "PENDING_PLANNING" || item.status === "READY_FOR_PLANNING") && item.primaryPO && (can("weekly_programs.create") || can("production_orders.edit")) && (
                        <IconButton
                            variant="success"
                            title="Assign to Weekly Scheduling (Verifies Material)"
                            icon={FaCalendarAlt}
                            onClick={() => handleAssignWeekly(item)}
                        />
                    )}

                    {/* WAITING_FOR_MATERIAL: Re-Check Raw Material + Reserve button */}
                    {item.status === "WAITING_FOR_MATERIAL" && item.primaryPO && can("production_orders.edit") && (
                        <>
                            <IconButton
                                variant="info"
                                title="Re-Check Raw Material Stock Availability"
                                icon={FaSyncAlt}
                                onClick={() => handleRecheckMaterials(item)}
                            />
                            {/* <IconButton
                                variant="success"
                                title="Reserve Raw Materials"
                                icon={FaCheckCircle}
                                onClick={() => handleAllocateRM(item)}
                            /> */}
                            {/* {can("purchase_orders.create") && (
                                <IconButton
                                    variant="warning"
                                    title="Create Purchase Order for Missing Materials"
                                    icon={FaShoppingCart}
                                    onClick={() => navigate(`/purchase-orders/create?po=${item.primaryPO?.productionOrderId}`)}
                                />
                            )} */}
                        </>
                    )}

                    {/* RM_PENDING: Reserve Raw Materials + Create Purchase Order */}
                    {item.status === "RM_PENDING" && can("production_orders.edit") && (
                        <IconButton
                            variant="success"
                            title="Allocate & Reserve Raw Materials"
                            icon={FaCheckCircle}
                            onClick={() => handleAllocateRM(item)}
                        />
                    )}
                    {/* {item.status === "RM_PENDING" && can("purchase_orders.create") && (
                        <IconButton
                            variant="warning"
                            title="Create Raw Material Purchase Order"
                            icon={FaShoppingCart}
                            onClick={() => navigate(`/purchase-orders/create?po=${item.primaryPO?.productionOrderId}`)}
                        />
                    )} */}

                    {/* View Details */}
                    {item.primaryPO && can("production_orders.view") && (
                        <IconButton
                            variant="info"
                            title="View Details"
                            icon={FaEye}
                            onClick={() => {
                                setSelectedItem(item.primaryPO);
                                setFullOrder(null);
                                setShowViewModal(true);
                                fetchOrderDetails(item.primaryPO.productionOrderId || item.primaryPO.id);
                            }}
                        />
                    )}

                    {/* Edit — only for CREATED (draft) orders */}
                    {item.primaryPO && ["CREATED"].includes(item.primaryPO.status?.toUpperCase()) && can("production_orders.edit") && (
                        <EditButton onClick={() => handleOpenEdit(item.primaryPO)} />
                    )}

                    {/* Delete — only for direct draft orders */}
                    {item.primaryPO && ["CREATED"].includes(item.primaryPO.status?.toUpperCase()) && item.isDirect && can("production_orders.delete") && (
                        <DeleteButton onClick={() => triggerDelete(item.productionOrders.map((po: any) => po.productionOrderId))} />
                    )}
                </div>
            )
        }
    ];

    const hasInsufficientStock = fullOrder?.products?.some((p: any) =>
        p.rawMaterials?.some((rm: any) => {
            const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
            const required = Number(rm.requiredQty || 0);
            let available = stockRm 
                ? Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0) 
                : Number(rm.availableStock || 0);
            const isReservedStatus = ["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULED", "IN_PROGRESS", "IN PROGRESS"].includes(fullOrder?.status);
            if (isReservedStatus && stockRm) {
                available += required;
            }
            return rm.status ? rm.status === "INSUFFICIENT" : available < required;
        })
    );

    const modalSections = selectedItem
        ? [
            {
                title: "Order Information",
                fields: [
                    { label: "Order No", value: fullOrder?.productionOrderId || selectedItem.productionOrderId },
                    { 
                        label: "Sales Order No", 
                        value: fullOrder?.salesOrderDetails?.orderNo || selectedItem.salesOrderDetails?.orderNo || selectedItem.sourceSalesOrderId || "Direct Order"
                    },
                    { 
                        label: "Customer", 
                        value: fullOrder?.salesOrderDetails?.customerName || selectedItem.salesOrderDetails?.customerName || "N/A (Direct)"
                    },
                    { label: "Priority", value: fullOrder?.priority || selectedItem.priority || "-" },
                ],
            },
            {
                title: "Schedule & Additional Details",
                fields: [
                    { label: "Order Date", value: formatDate(fullOrder?.orderDate || selectedItem.orderDate) },
                    { label: "Due Date", value: formatDate(fullOrder?.dueDate || selectedItem.dueDate) },
                    { label: "Order Type", value: fullOrder?.orderType || selectedItem.orderType || "-" },
                    { label: "Remarks", value: fullOrder?.remarks || selectedItem.remarks || "N/A" },
                ],
            },
        ]
        : [];

    const modalCustomContent = (
        <div>
            {hasInsufficientStock && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-4 fw-medium" role="alert" style={{ borderRadius: '8px', fontSize: '14px' }}>
                    <span>One or more required raw materials have insufficient stock. Please create a Raw Material Order before proceeding to Weekly Machine Assignment.</span>
                </div>
            )}

            {loadingDetails ? (
                <div className="text-center p-4">
                    <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-6 w-6 inline-block mr-2"></div> Loading details...
                </div>
            ) : (
                fullOrder?.products?.map((prod: any, idx: number) => (
                    <div key={idx} className="mt-4 border-t border-line pt-4">
                        <h6 className="text-base font-bold text-ink mb-3">Product {idx + 1}: {prod.productName} ({prod.productCode})</h6>
                        
                        <div className="grid grid-cols-3 gap-4 mb-4 bg-card-2 p-4 rounded-xl border border-line-soft">
                            <div>
                                <div className="text-xs font-semibold text-ink-subtle uppercase tracking-wide">Production Qty</div>
                                <div className="text-sm font-bold text-ink mt-1">{prod.quantity} {prod.uom?.toLowerCase() === 'ea' || prod.uom?.toLowerCase() === 'each' ? 'pcs' : prod.uom}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-ink-subtle uppercase tracking-wide">Weight Used</div>
                                <div className="text-sm font-bold text-ink mt-1">{Number(prod.weightPerPieceUsed || 0).toFixed(3)} KG</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-ink-subtle uppercase tracking-wide">Unit (UOM)</div>
                                <div className="text-sm font-bold text-ink mt-1">{prod.uom?.toLowerCase() === 'ea' || prod.uom?.toLowerCase() === 'each' ? 'pcs' : prod.uom}</div>
                            </div>
                        </div>

                        <div className="text-sm font-semibold text-ink-muted mb-2 mt-4">Required Raw Materials</div>
                        <div className="w-full border border-line rounded-lg overflow-hidden mb-3">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-card-2 border-b border-line text-ink-muted">
                                    <tr>
                                        <th className="p-2 font-semibold">RAW MATERIAL CODE</th>
                                        <th className="p-2 font-semibold">RAW MATERIAL NAME</th>
                                        <th className="p-2 font-semibold text-right">REQUIRED QTY</th>
                                        <th className="p-2 font-semibold text-right">AVAILABLE STOCK</th>
                                        <th className="p-2 font-semibold text-center">STOCK STATUS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line bg-card">
                                    {prod.rawMaterials?.map((rm: any) => {
                                        const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                                        const required = Number(rm.requiredQty || 0);
                                        let available = stockRm 
                                            ? Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0) 
                                            : Number(rm.availableStock || 0);
                                        const isReservedStatus = ["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULED", "IN_PROGRESS", "IN PROGRESS"].includes(fullOrder?.status);
                                        if (isReservedStatus && stockRm) {
                                            available += required;
                                        }
                                        const materialName = rm.materialName || stockRm?.materialName || rm.rawMaterialId;
                                        const isAvailable = rm.status ? rm.status === "AVAILABLE" : available >= required;
                                        
                                        // Get correct UOM
                                        let displayUom = stockRm?.baseUom?.split(',')[0] || rm.uom || stockRm?.uom || "KG";
                                        if (displayUom.toLowerCase() === 'ea' || displayUom.toLowerCase() === 'each') {
                                            displayUom = 'pcs';
                                        }

                                        return (
                                            <tr key={rm.rawMaterialId} className="hover:bg-card-2 transition-colors">
                                                <td className="p-2 font-semibold text-ink-muted">{rm.rawMaterialId}</td>
                                                <td className="p-2 text-ink-muted">{materialName}</td>
                                                <td className="p-2 text-right text-ink-muted">{required.toFixed(2)} {displayUom}</td>
                                                <td className="p-2 text-right text-ink-muted">{available.toFixed(2)} {displayUom}</td>
                                                <td className="p-2 text-center">
                                                    <StatusBadge status={isAvailable ? "AVAILABLE" : "INSUFFICIENT"} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {(!prod.rawMaterials || prod.rawMaterials.length === 0) && (
                                        <tr>
                                            <td colSpan={5} className="text-center text-ink-subtle p-4">
                                                No raw materials defined for this product.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* {["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULED"].includes(prod.status || fullOrder?.status) && (
                            <div className="flex justify-end mt-2">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setSelectedProdForIssue(prod);
                                        setShowIssueModal(true);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-1.5 rounded text-sm transition-colors"
                                >
                                    Issue Raw Materials
                                </button>
                            </div>
                        )} */}
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div>
            <div className="max-w-[1100px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
                    <div>
                        <h2 className="text-base font-bold text-ink">Production Order Management</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {(can("weekly_programs.create") || can("weekly_programs.view")) && (
                            <CustomButton
                                text="Weekly Scheduling"
                                icon={FaCalendarAlt}
                                onClick={() => navigate("/weekly-machine-schedules/create")}
                                variant="secondary"
                            />
                        )}
                        {can("production_orders.create") && (
                            <CustomButton
                                text="Add Production Order"
                                icon={FaPlus}
                                onClick={() => navigate("/production-orders/create")}
                            />
                        )}
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    columns={columns}
                    data={combinedData}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No orders found."
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: (page) => setCurrentPage(page)
                    }}
                />
            </div>

            {/* VIEW PO MODAL */}
            <CommonViewModal
                show={showViewModal}
                onHide={() => {
                    setShowViewModal(false);
                    setSelectedItem(null);
                    setFullOrder(null);
                }}
                modalTitle="Production Order Details"
                avatarText={selectedItem ? "PO" : ""}
                headerTitle={selectedItem ? (fullOrder?.productionOrderId || selectedItem.productionOrderId) : ""}
                headerSubtitle={selectedItem ? `Customer: ${fullOrder?.salesOrderDetails?.customerName || selectedItem.salesOrderDetails?.customerName || "Direct"}` : ""}
                statusNode={selectedItem ? <StatusBadge status={fullOrder?.status || selectedItem.status} /> : undefined}
                sections={modalSections}
                customContent={modalCustomContent}
            />

            {/* {selectedProdForIssue && (
                <MaterialIssueModal
                    show={showIssueModal}
                    onHide={() => {
                        setShowIssueModal(false);
                        setSelectedProdForIssue(null);
                    }}
                    productionOrderId={selectedProdForIssue.productionOrderId}
                    rawMaterials={selectedProdForIssue.rawMaterials || []}
                    rawMaterialsMap={rawMaterialsMap}
                    defaultStoreId={fullOrder?.sourceStoreId}
                    onSuccess={() => {
                        if (selectedItem) {
                            fetchOrderDetails(String(selectedItem.productionOrderId || selectedItem.id));
                        }
                        fetchCombinedData();
                    }}
                />
            )} */}

            {/* DELETE PO MODAL */}
            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Draft Production Order"
                message={
                    <>
                        Are you sure you want to delete the production plan for this order?<br />
                        This will remove {itemToDelete.length} draft Production Order(s) permanently.<br />
                        The associated Sales Order will become available again so that a new plan can be created.
                    </>
                }
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
};

export default ProductionOrderList;
