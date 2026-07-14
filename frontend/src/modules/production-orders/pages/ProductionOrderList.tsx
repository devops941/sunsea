import React, { useState, useCallback, useEffect } from "react";
import { FaPlus, FaCalendarAlt, FaCheckCircle, FaShoppingCart, FaEye, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CustomButton from "../../../components/ui/Button/Button";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";

import IconButton from "../../../components/ui/IconButton/IconButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import ProductionOrderViewModal from "../components/ProductionOrderViewModal";
import { productionOrderService } from "../../../services/productionOrderService";
import type { ProductionOrder } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { salesOrderService } from "../../../services/salesOrderService";
import { finishedGoodsStockService } from "../../../services/finishedGoodsStockService";

const ITEMS_PER_PAGE = 20;

const ProductionOrderList: React.FC = () => {
    const navigate = useNavigate();

    // --- State ---
    const [combinedData, setCombinedData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ProductionOrder | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string[]>([]);

    const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());



    // Fetch raw materials map
    const fetchRawMaterials = useCallback(async () => {
        try {
            const data = await rawMaterialService.fetchAll();
            const arr = Array.isArray(data) ? data : (data as any)?.data || [];
            const map = new Map<string, any>();
            arr.forEach((rm: any) => map.set(rm.rawMaterialId?.toString(), rm));
            setRawMaterialsMap(map);
        } catch (error) {
            console.error("Failed to fetch raw materials", error);
        }
    }, []);

    useEffect(() => {
        fetchRawMaterials();
    }, [fetchRawMaterials]);

    // Fetch and combine Sales Orders and Production Orders
    const fetchCombinedData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch Sales Orders (status: IN_PRODUCTION)
            const soRes = await salesOrderService.fetchAll({
                status: "IN_PRODUCTION"
            });
            const soList: any[] = (soRes as any).data || soRes || [];

            // 2. Fetch Production Orders
            const poRes = await productionOrderService.fetchAll({
                limit: 1000
            } as any);
            const poList = poRes.data || [];

            // 2.5 Fetch Finished Goods Stock
            let fgList: any[] = [];
            try {
                const fgRes = await finishedGoodsStockService.fetchAll();
                fgList = Array.isArray(fgRes) ? fgRes : (fgRes as any).data || [];
            } catch (err) {
                console.error("Failed to fetch Finished Goods Stock", err);
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
                    const hasPending = associatedPOs.some((po: any) => po.status === "RM_PENDING");
                    const hasDraft = associatedPOs.some((po: any) => po.status === "DRAFT");
                    const hasProgress = associatedPOs.some((po: any) => po.status === "IN_PROGRESS");
                    const hasCompleted = associatedPOs.every((po: any) => po.status === "COMPLETED");

                    if (hasCompleted) {
                        status = "COMPLETED";
                    } else if (hasProgress) {
                        status = "IN_PROGRESS";
                    } else if (hasPending) {
                        status = "RM_PENDING";
                    } else if (hasDraft) {
                        status = "DRAFT";
                    } else {
                        status = associatedPOs.find((po: any) => po.status !== "COMPLETED")?.status || "PLANNED";
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

            // Filter out scheduled, completed, and cancelled items to make this an unscheduled backlog
            combinedList = combinedList.filter(item => !["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "CANCELED", "DELETED"].includes(item.status?.toUpperCase()));

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



    const handleCreateProductionOrder = (so: any) => {
        navigate(`/production-orders/create`, {
            state: { sourceSalesOrderId: so.id }
        });
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
            render: (_: any, index: number) => <span className="text-slate-500">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</span>
        },
        {
            header: "PO NO",
            render: (item: any) => <span className="font-semibold text-slate-800">{item.primaryPO ? item.primaryPO.productionOrderId : item.orderNo}</span>
        },
        {
            header: "ORDER DATE",
            render: (item: any) => <span className="text-slate-700">{formatDate(item.orderDate)}</span>
        },
        {
            header: "EXPECTED DATE",
            render: (item: any) => <span className="text-slate-700">{item.expectedCompletionDate ? formatDate(item.expectedCompletionDate) : "-"}</span>
        },
        {
            header: "CUSTOMER",
            render: (item: any) => <span className="text-slate-700">{item.customer?.firmName || "-"}</span>
        },
        {
            header: "PRODUCTS",
            render: (item: any) => <span className="text-slate-700">{item.productionOrders && item.productionOrders.length > 0
                ? item.productionOrders.map((po: any) => po.productItem?.productName || "Unknown Product").join(", ")
                : item.items?.map((it: any) => it.product?.productName || "Unknown Product").join(", ") || "-"
            }</span>
        },
        {
            header: "RAW MATERIALS",
            render: (item: any) => {
                const rawMaterials = item.productionOrders?.flatMap((po: any) => po.draftRawMaterials || []) || [];
                const visibleRMs = rawMaterials.slice(0, 2);
                const hiddenRMs = rawMaterials.slice(2);
                
                if (rawMaterials.length === 0) return <span className="text-slate-500">N/A</span>;
                
                return (
                    <div className="flex flex-wrap gap-1 items-center">
                        {visibleRMs.map((rm: any, rmIdx: number) => {
                            const rmIdStr = rm.rawMaterialId?.toString();
                            const stockRm = rawMaterialsMap.get(rmIdStr);
                            const name = stockRm?.materialName || rmIdStr;
                            let availableStock = stockRm
                                ? Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0)
                                : 0;
                            const reqQty = Number(rm.requiredQty || 0);

                            const parentPO = item.productionOrders?.find((po: any) => {
                                const rawMaterials = po.draftRawMaterials || [];
                                return rawMaterials.some((drm: any) => drm.rawMaterialId === rm.rawMaterialId);
                            });
                            const isReservedStatus = parentPO
                                ? ["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULED", "IN_PROGRESS", "IN PROGRESS"].includes(parentPO.status)
                                : false;
                            if (isReservedStatus && stockRm) {
                                availableStock += reqQty;
                            }

                            const isAvailable = availableStock >= reqQty;
                            return (
                                <StatusBadge
                                    key={`${item.id}-${rmIdx}`}
                                    status="UNKNOWN"
                                    customText={name}
                                    customColor={{
                                        bg: isAvailable ? '#d1fae5' : '#fee2e2',
                                        text: isAvailable ? '#065f46' : '#b91c1c'
                                    }}
                                    title={`Req: ${reqQty.toFixed(2)}, Avail: ${availableStock.toFixed(2)}`}
                                    className="fw-normal"
                                />
                            );
                        })}
                        {hiddenRMs.length > 0 && (
                            <StatusBadge
                                status="UNKNOWN"
                                customText={`+${hiddenRMs.length} more`}
                                customColor={{ bg: '#f1f3f4', text: '#5f6368' }}
                                className="fw-normal"
                                title={hiddenRMs.map((rm: any) => {
                                    const stockRm = rawMaterialsMap.get(rm.rawMaterialId?.toString());
                                    return stockRm?.materialName || rm.rawMaterialId;
                                }).join(', ')}
                                style={{ cursor: 'help' }}
                            />
                        )}
                    </div>
                );
            }
        },
        {
            header: "STATUS",
            render: (item: any) => <StatusBadge status={item.status} />
        },
        {
            header: "ACTIONS",
            render: (item: any) => (
                <div className="flex items-center gap-2 justify-end">
                    {item.status === "PENDING_PLANNING" && (
                        <IconButton
                            variant="success"
                            title="Assign & Allocate Raw Materials"
                            icon={FaCheckCircle}
                            onClick={() => handleCreateProductionOrder(item)}
                        />
                    )}
                    {item.status === "RM_PENDING" && (
                        <IconButton
                            variant="success"
                            title="Allocate & Reserve Raw Materials"
                            icon={FaCheckCircle}
                            onClick={() => handleAllocateRM(item)}
                        />
                    )}
                    {item.status === "RM_PENDING" && (
                        <IconButton
                            variant="warning"
                            title="Create Raw Material Purchase Order"
                            icon={FaShoppingCart}
                            onClick={() => navigate(`/purchase-orders/create?po=${item.primaryPO?.productionOrderId}`)}
                        />
                    )}

                    {item.primaryPO && (
                        <IconButton
                            variant="info"
                            title="View Details"
                            icon={FaEye}
                            onClick={() => {
                                setSelectedItem(item.primaryPO);
                                setShowViewModal(true);
                            }}
                        />
                    )}
                    {item.primaryPO && !["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "CANCELED", "DELETED"].includes(item.primaryPO.status?.toUpperCase()) && (
                        <>
                            <EditButton onClick={() => handleOpenEdit(item.primaryPO)} />
                            {item.isDirect && (
                                <DeleteButton onClick={() => triggerDelete(item.productionOrders.map((po: any) => po.productionOrderId))} />
                            )}
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Production Order Management</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <CustomButton
                            text="Weekly Scheduling"
                            icon={FaCalendarAlt}
                            onClick={() => navigate("/weekly-machine-schedules/create")}
                        />
                        <CustomButton
                            text="Add Production Order"
                            icon={FaPlus}
                            onClick={() => navigate("/production-orders/create")}
                        />
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
            <ProductionOrderViewModal
                show={showViewModal}
                onHide={() => setShowViewModal(false)}
                order={selectedItem}
                onSuccess={fetchCombinedData}
            />

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
