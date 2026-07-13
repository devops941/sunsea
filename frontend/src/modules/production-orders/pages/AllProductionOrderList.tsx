import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import ProductionOrderViewModal from "../components/ProductionOrderViewModal";
import { productionOrderService } from "../../../services/productionOrderService";
import type { ProductionOrder } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";

const ITEMS_PER_PAGE = 10;

const AllProductionOrderList: React.FC = () => {
    const [data, setData] = useState<ProductionOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ProductionOrder | null>(null);

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
                page: 1,
                pageSize: 1000,
                search: searchTerm || undefined,
                status: statusFilter || undefined,
            });

            setData(response.data || []);
            // We use groupedData length for pagination total now
        } catch (error: any) {
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch orders");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, statusFilter]);

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
            const hasPending = group.items.some((po: any) => po.status === "RM_PENDING");
            return {
                ...group,
                status: hasPending && group.status !== "DRAFT" ? "RM_PENDING" : group.status,
                productNames: Array.from(group.productNames).join(", ")
            };
        });
    }, [data]);

    const handleOpenView = useCallback((item: ProductionOrder) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const totalPages = Math.max(1, Math.ceil(groupedData.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedGroups = groupedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Production Order History</h2>
                                <div className="page-breadcrumb">
                                    Home / Production / Order History
                                </div>
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
                                            { label: "All Statuses", value: "" },
                                            { label: "Draft", value: "DRAFT" },
                                            { label: "Planned", value: "PLANNED" },
                                            { label: "RM Pending", value: "RM_PENDING" },
                                            { label: "RM Available", value: "RM_AVAILABLE" },
                                            { label: "Scheduled", value: "SCHEDULED" },
                                            { label: "Schedule Deleted", value: "SCHEDULE_DELETED" },
                                            { label: "In Progress", value: "IN_PROGRESS" },
                                            { label: "Completed", value: "COMPLETED" },
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
                                    <th>COLOR</th>
                                    <th>STATUS</th>
                                    <th>CREATED DATE</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            Loading orders...
                                        </td>
                                    </tr>
                                ) : paginatedGroups.length > 0 ? (
                                    paginatedGroups.map((item: any, index: number) => (
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
                                                                            status={isAvailable ? "AVAILABLE" : "INSUFFICIENT"}
                                                                            customText={name}
                                                                            title={`Req: ${reqQty.toFixed(2)}, Avail: ${availableStock.toFixed(2)}`}
                                                                            className="fw-normal"
                                                                        />
                                                                    );
                                                                })}
                                                                {hiddenRMs.length > 0 && (
                                                                    <StatusBadge
                                                                        status=""
                                                                        customText={`+${hiddenRMs.length} more`}
                                                                        customColor={{ bg: '#e9ecef', text: '#495057' }}
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
                                                {item.colorType ? (
                                                    <StatusBadge
                                                        status={item.colorType === 'mc' ? 'MULTI COLOR' : 'SINGLE COLOR'}
                                                        customColor={item.colorType === 'mc' ? { bg: '#e0e7ff', text: '#3730a3' } : { bg: '#fef3c7', text: '#92400e' }}
                                                    />
                                                ) : "-"}
                                            </td>
                                            <td className="master-data-cell">
                                                <StatusBadge status={item.status === 'CANCELLED' ? 'DELETED' : (item.status || 'PLANNED')} />
                                            </td>
                                            <td className="master-data-cell">{formatDate(item.createdAt)}</td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(item)} />
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
                    onSuccess={fetchOrders}
                />

            </Container>
        </div>
    );
};

export default AllProductionOrderList;
