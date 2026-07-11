import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Container, Row, Col, Spinner, Card } from "react-bootstrap";
import { FaSearch, FaPlus, FaCalendarAlt, FaCheckCircle, FaShoppingCart, FaEye, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CustomButton from "../../../components/ui/Button/Button";
import IconButton from "../../../components/ui/IconButton/IconButton";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import ProductionOrderViewModal from "../components/ProductionOrderViewModal";
import { productionOrderService } from "../../../services/productionOrderService";
import type { ProductionOrder } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { salesOrderService, type SalesOrder } from "../../../services/salesOrderService";
import { storeService } from "../../../services/storeService";
import { billOfMaterialService } from "../../../services/billOfMaterialService";

const ITEMS_PER_PAGE = 20;

const ProductionOrderList: React.FC = () => {
    const navigate = useNavigate();

    // --- State ---
    const [combinedData, setCombinedData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const [stores, setStores] = useState<any[]>([]);
    const [boms, setBoms] = useState<any[]>([]);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ProductionOrder | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string[]>([]);

    const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());

    // Fetch helper options
    const fetchDependencies = useCallback(async () => {
        const extractArray = (d: any): any[] => {
            if (Array.isArray(d)) return d;
            if (Array.isArray(d?.data)) return d.data;
            if (Array.isArray(d?.data?.data)) return d.data.data;
            return [];
        };
        try {
            const [storeRes, bomRes] = await Promise.all([
                storeService.fetchAll({ limit: 1000 }),
                billOfMaterialService.fetchAll()
            ]);
            setStores(extractArray(storeRes));
            setBoms(extractArray(bomRes));
        } catch (error) {
            console.error("Failed to load options", error);
        }
    }, []);

    useEffect(() => {
        fetchDependencies();
    }, [fetchDependencies]);

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
            const soList = soRes.data || soRes || [];

            // 2. Fetch Production Orders
            const poRes = await productionOrderService.fetchAll({
                limit: 1000
            } as any);
            const poList = poRes.data || [];

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

            // Filter out scheduled and completed items to make this an unscheduled backlog
            combinedList = combinedList.filter(item => !["SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(item.status));

            // 5. Filter by status if selected
            let filtered = combinedList;
            if (statusFilter) {
                filtered = filtered.filter(item => item.status === statusFilter);
            }

            // 6. Filter by search term
            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                filtered = filtered.filter(item => 
                    item.orderNo?.toLowerCase().includes(lower) ||
                    item.customer?.firmName?.toLowerCase().includes(lower)
                );
            }

            setTotalItems(filtered.length);
            
            // 7. Paginate
            const start = (currentPage - 1) * ITEMS_PER_PAGE;
            setCombinedData(filtered.slice(start, start + ITEMS_PER_PAGE));
        } catch (error) {
            console.error("Failed to load combined dashboard data", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm, statusFilter]);

    useEffect(() => {
        fetchCombinedData();
    }, [fetchCombinedData]);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }, []);

    const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setStatusFilter(e.target.value);
        setCurrentPage(1);
    };

    const handleCreateProductionOrder = (so: any) => {
        navigate(`/production-orders/create`, {
            state: { sourceSalesOrderId: so.id }
        });
    };

    const handleOpenEdit = (po: any) => {
        navigate(`/production-orders/edit/${po.productionOrderId}`);
    };

    // Auto-create Production Order & Assign Raw Materials directly from Sales Order row
    const handleAutoPlanAndAllocateRM = async (order: any) => {
        setLoading(true);
        try {
            // Fetch complete Sales Order details
            const so = await salesOrderService.fetchById(order.id);
            const items = so?.items || [];
            
            if (items.length === 0) {
                toast.error("Sales Order has no items to plan.");
                setLoading(false);
                return;
            }

            // Get next Base ID
            const nextIdRes = await productionOrderService.fetchNextId();
            const basePoId = nextIdRes || `PO-${Date.now()}`;

            // Resolve default store ID
            const defaultStoreId = stores[0]?.storeId || "STR-001";

            const getValidPriority = (p?: string) => {
                if (!p) return "MEDIUM";
                const up = p.toUpperCase();
                if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(up)) return up;
                if (up === "NORMAL") return "MEDIUM";
                return "MEDIUM";
            };

            // Loop to create Production Orders (PLANNED status triggers RM check on backend)
            for (let idx = 0; idx < items.length; idx++) {
                const item = items[idx];
                const bom = boms.find((b: any) => Number(b.productId) === Number(item.productId));
                const targetQty = Number(item.quantity) || 0;
                const damageQty = 100;
                const totalQty = targetQty + damageQty;

                const productRawMaterials = (bom?.items || []).map((bomItem: any) => ({
                    rawMaterialId: bomItem.rawMaterialId?.toString() || "",
                    requiredQty: Number((totalQty * (Number(bomItem.requiredQuantity) || 0)).toFixed(3)),
                    uom: bomItem.uom || "KG",
                    storeId: defaultStoreId,
                    remarks: ""
                }));

                const payload = {
                    productionOrderId: `${basePoId}-${idx + 1}`,
                    orderDate: so.orderDate ? new Date(so.orderDate).toISOString() : new Date().toISOString(),
                    dueDate: so.expectedCompletionDate ? new Date(so.expectedCompletionDate).toISOString() : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
                    priority: so.dispatchType ? getValidPriority(so.dispatchType) : "MEDIUM",
                    orderType: so.orderType ? so.orderType.toUpperCase() : "STANDARD",
                    batchNo: null,
                    lotNo: null,
                    sourceSalesOrderId: so.id.toString(),
                    sourceSalesOrderLineId: item.id?.toString() || null,
                    sourceStoreId: defaultStoreId,
                    destinationStoreId: defaultStoreId,
                    status: "PLANNED",
                    remarks: so.remarks || null,
                    productItemId: item.productId?.toString(),
                    targetQty: targetQty,
                    damageQty: damageQty,
                    uom: item.product?.uom?.name || "PCS",
                    colorType: item.colorType || "sc",
                    rawMaterials: productRawMaterials,
                };

                await productionOrderService.create(payload as any);
            }

            toast.success(`Production Order(s) created and raw material allocation processed for Sales Order ${order.orderNo}!`);
            fetchCombinedData();
        } catch (error: any) {
            console.error("Auto allocation failed:", error);
            toast.error(error?.response?.data?.message || error?.message || "Failed to assign raw materials.");
        } finally {
            setLoading(false);
        }
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
                const cleanRawMaterials = (fullPo.draftRawMaterials || []).map((rm: any) => ({
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

    return (
        <div className="inner-container">
            <Container fluid>
                {/* HEADER SECTION */}
                <div className="page-header mb-4">
                    <Row className="align-items-center g-3">
                        <Col lg={4} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Production Order Management</h2>
                                <div className="page-breadcrumb">Home / Production / Dashboard</div>
                            </div>
                        </Col>
                        <Col lg={8} md={12}>
                            <div className="page-header-actions d-flex justify-content-end gap-2 align-items-center flex-wrap">
                                <CustomButton
                                    text="Weekly Scheduling"
                                    icon={FaCalendarAlt}
                                    onClick={() => navigate("/weekly-machine-schedules/create")}
                                    style={{ backgroundColor: "var(--color-primary-dark, #0f766e)", borderColor: "var(--color-primary-dark, #0f766e)" }}
                                />
                                <CustomButton
                                    text="Add Production Order"
                                    icon={FaPlus}
                                    onClick={() => navigate("/production-orders/create")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* DASHBOARD CARD - ONE TABLE FOR PRODUCTION ORDERS */}
                <Card className="border-0 shadow-sm mb-4">
                  
                    <Card.Body className="p-0">
                        <div className="table-responsive">
                            <table className="master-data-table mb-0" style={{ width: "100%" }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th>SO NO / PO NO</th>
                                        <th>ORDER DATE</th>
                                        <th>EXPECTED DATE</th>
                                        <th>CUSTOMER</th>
                                        <th>PRODUCTS</th>
                                        <th>RAW MATERIALS</th>
                                        <th>STATUS</th>
                                        <th style={{ width: "180px", textAlign: "right" }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={9} className="text-center p-4">
                                                <Spinner animation="border" size="sm" className="me-2" />
                                                Loading orders...
                                            </td>
                                        </tr>
                                    ) : combinedData.length > 0 ? (
                                        combinedData.map((item: any, index: number) => {
                                            const rawMaterials = item.productionOrders?.flatMap((po: any) => po.draftRawMaterials || []) || [];
                                            const visibleRMs = rawMaterials.slice(0, 2);
                                            const hiddenRMs = rawMaterials.slice(2);

                                            return (
                                                <tr key={item.id} className="master-data-row">
                                                    <td className="master-data-cell">
                                                        {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                                                    </td>
                                                    <td className="master-data-cell fw-bold text-dark">
                                                        {item.primaryPO ? item.primaryPO.productionOrderId : item.orderNo}
                                                    </td>
                                                    <td className="master-data-cell">{formatDate(item.orderDate)}</td>
                                                    <td className="master-data-cell">{item.expectedCompletionDate ? formatDate(item.expectedCompletionDate) : "-"}</td>
                                                    <td className="master-data-cell">{item.customer?.firmName || "-"}</td>
                                                    <td className="master-data-cell">
                                                        {item.productionOrders && item.productionOrders.length > 0 
                                                            ? item.productionOrders.map((po: any) => po.productItem?.productName || "Unknown Product").join(", ")
                                                            : item.items?.map((it: any) => it.product?.productName || "Unknown Product").join(", ") || "-"
                                                        }
                                                    </td>
                                                    <td className="master-data-cell">
                                                        {rawMaterials.length > 0 ? (
                                                            <div className="d-flex flex-wrap gap-1 align-items-center">
                                                                {visibleRMs.map((rm: any, rmIdx: number) => {
                                                                    const rmIdStr = rm.rawMaterialId?.toString();
                                                                    const stockRm = rawMaterialsMap.get(rmIdStr);
                                                                    const name = stockRm?.materialName || rmIdStr;
                                                                    let availableStock = stockRm 
                                                                        ? Number(stockRm.onHandQty || 0) - Number(stockRm.reservedQty || 0) 
                                                                        : 0;
                                                                    const reqQty = Number(rm.requiredQty || 0);

                                                                    const parentPO = item.productionOrders?.find((po: any) => 
                                                                        (po.draftRawMaterials || []).some((drm: any) => drm.rawMaterialId === rm.rawMaterialId)
                                                                    );
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
                                                        ) : "N/A"}
                                                    </td>
                                                    <td className="master-data-cell">
                                                        <StatusBadge status={item.status} />
                                                    </td>
                                                    <td className="master-data-cell text-end">
                                                        <div className="table-action-group justify-content-end">
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
                                                            {item.primaryPO && !["SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(item.primaryPO.status) && (
                                                                <>
                                                                    <EditButton onClick={() => handleOpenEdit(item.primaryPO)} />
                                                                    {item.isDirect && (
                                                                        <DeleteButton onClick={() => triggerDelete(item.productionOrders.map((po: any) => po.productionOrderId))} />
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={9} className="text-center p-4">
                                                No orders found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="pagination-wrap">
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                >
                                    <FaChevronLeft />
                                </button>
                                <div className="pagination-info">Page {currentPage} of {totalPages}</div>
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        )}
                    </Card.Body>
                </Card>

                {/* VIEW PO MODAL */}
                <ProductionOrderViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    order={selectedItem}
                />

                {/* DELETE PO MODAL */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Draft Production Order"
                    message={
                        <>
                            Are you sure you want to delete the production plan for this order?<br/>
                            This will remove {itemToDelete.length} draft Production Order(s) permanently.<br/>
                            The associated Sales Order will become available again so that a new plan can be created.
                        </>
                    }
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </Container>
        </div>
    );
};

export default ProductionOrderList;
