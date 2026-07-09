import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Container, Row, Col, Spinner} from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaCalendarAlt, FaShoppingCart } from "react-icons/fa";
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

const ITEMS_PER_PAGE = 10;

const ProductionOrderList: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<ProductionOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ProductionOrder | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | string | null>(null);

    const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());

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

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await productionOrderService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
                status: statusFilter || undefined,
            });

            setData(response.data || []);
            setTotal(response.total || 0);
        } catch (error: any) {
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch orders");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm, statusFilter]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }, []);

    const groupedData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const groupedPOs = data.reduce((acc: any, po: any) => {
            const parts = po.productionOrderId.split('-');
            const baseId = parts.length > 2 ? `${parts[0]}-${parts[1]}` : po.productionOrderId;
            
            if (!acc[baseId]) {
                acc[baseId] = {
                    ...po,
                    productionOrderId: baseId,
                    items: [],
                    totalProducts: 0,
                    totalProductionQuantity: 0,
                    productNames: new Set()
                };
            }
            acc[baseId].items.push(po);
            acc[baseId].totalProducts += 1;
            acc[baseId].totalProductionQuantity += Number(po.targetQty) || 0;
            if (po.productItem?.productName) acc[baseId].productNames.add(po.productItem.productName);
            return acc;
        }, {});

        return Object.values(groupedPOs).map((group: any) => {
            let hasPending = group.items.some((po: any) => po.status === "RM_PENDING");
            
            // Re-evaluate stock availability for all items in the group to catch any edits where stock is now insufficient
            if (!hasPending && group.status !== "DRAFT") {
                const allRMs = group.items.flatMap((po: any) => po.draftRawMaterials || []);
                for (const rm of allRMs) {
                    const rmIdStr = rm.rawMaterialId?.toString();
                    const stockRm = rawMaterialsMap.get(rmIdStr);
                    const availableStock = stockRm ? Number(stockRm.onHandQty || 0) : 0;
                    const reqQty = Number(rm.requiredQty || 0);
                    if (availableStock < reqQty) {
                        hasPending = true;
                        break;
                    }
                }
            }

            return {
                ...group,
                status: hasPending && group.status !== "DRAFT" ? "RM_PENDING" : group.status,
                productNames: Array.from(group.productNames).join(", ")
            };
        }).filter((group: any) => {
            const activeStatuses = ["DRAFT", "PLANNED", "RM_PENDING", "RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULE_DELETED"];
            return activeStatuses.includes(group.status);
        });
    }, [data, rawMaterialsMap]);

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null) return;

        try {
            await productionOrderService.delete(itemToDelete);
            toast.success("Production order deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            fetchOrders();
        } catch (error: any) {
            console.error("❌ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete order");
        }
    };

    const triggerDelete = useCallback((id: number | string) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    const handleOpenView = useCallback((item: ProductionOrder) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenAdd = useCallback(() => {
        navigate("/production-orders/create");
    }, [navigate]);

    const handleOpenEdit = useCallback((item: ProductionOrder) => {
        navigate(`/production-orders/edit/${item.productionOrderId}`, { state: item });
    }, [navigate]);

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Production Order Management</h2>
                                <div className="page-breadcrumb">Home / Production / Production Orders</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions" style={{ gap: '10px' }}>
                                <div style={{ minWidth: '180px' }}>
                                    <SelectInput
                                        label=""
                                        hideLabel
                                        value={statusFilter}
                                        onChange={(e) => {
                                            setStatusFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        options={[
                                            { label: "All Active", value: "" },
                                            { label: "Draft", value: "DRAFT" },
                                            { label: "Planned", value: "PLANNED" },
                                            { label: "RM Pending", value: "RM_PENDING" },
                                            { label: "RM Available", value: "RM_AVAILABLE" },
                                            { label: "Ready for Planning", value: "READY_FOR_PLANNING" },
                                            { label: "Schedule Deleted", value: "SCHEDULE_DELETED" },
                                        ]}
                                    />
                                </div>
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search orders..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Add Production Order"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>
                

                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "60px" }}>#</th>
                                    <th>PO NO</th>
                                    <th>SO NO</th>
                                    <th>CUSTOMER</th>
                                    <th>TOTAL PRODUCTS</th>
                                    <th>TOTAL QTY</th>
                                    <th>RAW MATERIALS</th>
                                    <th>STATUS</th>
                                    <th>CREATED DATE</th>
                                    <th>ACTIONS</th>
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
                                ) : groupedData.length > 0 ? (
                                    groupedData.map((item: any, index: number) => (
                                            <tr key={item.productionOrderId} className="master-data-row">
                                                <td className="master-data-cell">
                                                    {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                                                </td>
                                            <td className="master-data-cell">{item.productionOrderId}</td>
                                            <td className="master-data-cell">
                                                {item.salesOrderDetails?.orderNo || item.sourceSalesOrderId ? (
                                                    item.salesOrderDetails?.orderNo || item.sourceSalesOrderId
                                                ) : (
                                                    <span className="badge border-0 shadow-sm px-2 py-1" style={{ fontSize: "0.75rem", borderRadius: "12px", background: "linear-gradient(135deg, #6c757d, #495057)", color: "white" }}>Direct Order</span>
                                                )}
                                            </td>
                                            <td className="master-data-cell">
                                                {item.salesOrderDetails?.customerName ? (
                                                    item.salesOrderDetails?.customerName
                                                ) : (
                                                    <span className="text-muted fst-italic" style={{ fontSize: "0.85rem" }}>N/A (Direct)</span>
                                                )}
                                            </td>
                                            <td className="master-data-cell">{(item as any).totalProducts ?? 1}</td>
                                            <td className="master-data-cell">{(item as any).totalProductionQuantity ?? item.targetQty}</td>
                                            <td className="master-data-cell">
                                                {item.items && item.items.length > 0 ? (
                                                    (() => {
                                                        const rawMaterials = item.items.flatMap((po: any) => po.draftRawMaterials || []);
                                                        const visibleRMs = rawMaterials.slice(0, 2);
                                                        const hiddenRMs = rawMaterials.slice(2);
                                                        
                                                        return (
                                                            <div className="d-flex flex-wrap gap-1 align-items-center">
                                                                {visibleRMs.map((rm: any, rmIdx: number) => {
                                                                    const rmIdStr = rm.rawMaterialId?.toString();
                                                                    const stockRm = rawMaterialsMap.get(rmIdStr);
                                                                    const name = stockRm?.materialName || rmIdStr;
                                                                    const availableStock = stockRm ? Number(stockRm.onHandQty || 0) : 0;
                                                                    const reqQty = Number(rm.requiredQty || 0);
                                                                    const isAvailable = availableStock >= reqQty;
                                                                    return (
                                                                        <StatusBadge 
                                                                            key={`${item.productionOrderId}-${rmIdx}`}
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
                                                    })()
                                                ) : "N/A"}
                                            </td>
                                            <td className="master-data-cell">
                                                <StatusBadge status={item.status || 'PLANNED'} />
                                            </td>
                                            <td className="master-data-cell">{formatDate(item.createdAt)}</td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(item)} />
                                                    {!["SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(item.status) && (
                                                        <EditButton onClick={() => handleOpenEdit(item)} />
                                                    )}
                                                    {item.status === "DRAFT" && (
                                                        <DeleteButton onClick={() => triggerDelete(item.productionOrderId)} />
                                                    )}
                                                    {["RM_AVAILABLE", "RM_PENDING", "READY_FOR_PLANNING", "SCHEDULE_DELETED"].includes(item.status) && (
                                                        <IconButton
                                                            variant="success"
                                                            title="Weekly Scheduling"
                                                            icon={FaCalendarAlt}
                                                            onClick={() => navigate(`/weekly-machine-schedules/create?productionOrderId=${item.productionOrderId}`)}
                                                            disabled={item.status === "RM_PENDING"}
                                                        />
                                                    )}
                                                    {item.status === "RM_PENDING" && (
                                                        <IconButton
                                                            variant="warning"
                                                            title="Create Raw Material Order"
                                                            icon={FaShoppingCart}
                                                            onClick={() => navigate(`/purchase-orders/create?po=${item.productionOrderId}`)}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">
                                            No production orders found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

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
                    </div>
                </div>

                <ProductionOrderViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    order={selectedItem}
                />

                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Draft Production Order"
                    message={
                        <>
                            Are you sure you want to delete this draft Production Order?<br/>
                            This action will remove the draft permanently.<br/>
                            The associated Approved Sales Order will become available again so that a new Production Order can be created.
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
