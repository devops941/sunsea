import React, { useEffect, useState, useCallback } from "react";
import { Container, Row, Col, Spinner, Alert, Modal } from "react-bootstrap";
import { FaPlus, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { salesOrderService, type SalesOrder } from "../../../services/salesOrderService";
import { productionOrderService } from "../../../services/productionOrderService";
import IconButton from "../../../components/ui/IconButton/IconButton";
import ViewButton from "../../../components/ui/viewbutton/ViewButton"
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

const ApprovedSalesOrderList: React.FC = () => {
    const navigate = useNavigate();

    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedViewOrder, setSelectedViewOrder] = useState<SalesOrder | null>(null);
    const [orderProductionStages, setOrderProductionStages] = useState<Record<string, string>>({});
    const [loadingStages, setLoadingStages] = useState(false);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await salesOrderService.fetchAll({
                status: "IN_PRODUCTION"
            });

            let filteredData = response.data || [];

            filteredData = filteredData.filter(o => 
                o.productionStatus !== 'PRODUCTION_CREATED' && 
                o.productionStatus !== 'IN_PRODUCTION' && 
                o.productionStatus !== 'PRODUCTION_DRAFT'
            );

            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                filteredData = filteredData.filter(o =>
                    o.orderNo?.toLowerCase().includes(lowerTerm) ||
                    o.customer?.firmName?.toLowerCase().includes(lowerTerm)
                );
            }

            setOrders(filteredData);
        } catch (err: any) {
            console.error("Error fetching approved sales orders", err);
            setError(err?.response?.data?.message || "Failed to load approved sales orders.");
        } finally {
            setLoading(false);
        }
    }, [searchTerm]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    const handleCreateProductionOrder = useCallback((order: SalesOrder) => {
        navigate("/production-orders/create", {
            state: { sourceSalesOrderId: order.id }
        });
    }, [navigate]);


    const handleViewOrder = useCallback(async (order: SalesOrder) => {
        setSelectedViewOrder(order);
        setShowViewModal(true);
        setOrderProductionStages({});
        setLoadingStages(true);
        try {
            const res = await productionOrderService.fetchAll({ sourceSalesOrderId: order.id.toString() });
            const stages: Record<string, string> = {};
            const prodOrders = res.data || [];
            prodOrders.forEach(po => {
                if (po.productItemId) {
                    stages[po.productItemId.toString()] = po.status || "PLANNED";
                }
            });
            setOrderProductionStages(stages);
        } catch (error) {
            console.error("Failed to fetch production stages", error);
            toast.error("Failed to fetch production stages");
        } finally {
            setLoadingStages(false);
        }
    }, []);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Approved Sales Orders</h2>
                                
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
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

                {error && <Alert variant="danger" className="m-3">{error}</Alert>}

                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "60px" }}>#</th>
                                    <th>ORDER NO</th>
                                    <th>ORDER DATE</th>
                                    <th>END DATE</th>
                                    <th>PRIORITY</th>
                                    <th>CUSTOMER</th>
                                    <th>REMARKS</th>
                                    <th>PRODUCTION STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            Loading approved sales orders...
                                        </td>
                                    </tr>
                                ) : orders.length > 0 ? (
                                    orders.map((order, index) => {
                                        return (
                                            <tr key={order.id} className="master-data-row">
                                                <td className="master-data-cell">{index + 1}</td>
                                                <td className="master-data-cell">{order.orderNo}</td>
                                                <td className="master-data-cell">{formatDate(order.orderDate)}</td>
                                                <td className="master-data-cell">{order.expectedCompletionDate ? formatDate(order.expectedCompletionDate) : "-"}</td>
                                                <td className="master-data-cell">{order.dispatchType || "-"}</td>
                                                <td className="master-data-cell">{order.customer?.firmName || "-"}</td>
                                                <td className="master-data-cell">{order.remarks || "-"}</td>
                                                <td className="master-data-cell">
                                                    <StatusBadge status={order.productionStatus === 'NOT_STARTED' || !order.productionStatus ? 'PENDING' : order.productionStatus} />
                                                </td>
                                                <td className="master-data-cell">
                                                    <div className="table-action-group">
                                                        <ViewButton
                                                            onClick={() => handleViewOrder(order)}
                                                        />
                                                        <IconButton
                                                            variant="primary"
                                                            title="Plan Production"
                                                            icon={FaPlus}
                                                            onClick={() => handleCreateProductionOrder(order)}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">
                                            No approved sales orders found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Container>

            {/* Order View Modal */}
            <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>Sales Order Details</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedViewOrder ? (
                        <>
                            <Row className="mb-4">
                                <Col md={4}>
                                    <div className="text-muted small">Order No</div>
                                    <div className="fw-bold">{selectedViewOrder.orderNo}</div>
                                </Col>
                                <Col md={4}>
                                    <div className="text-muted small">Customer</div>
                                    <div className="fw-bold">{selectedViewOrder.customer?.firmName || "-"}</div>
                                </Col>
                                <Col md={4}>
                                    <div className="text-muted small">Order Date</div>
                                    <div className="fw-bold">{formatDate(selectedViewOrder.orderDate)}</div>
                                </Col>
                            </Row>
                            <h6 className="section-title">Products & Production Stage</h6>
                            <div className="master-table-body table-wrap">
                                <div className="master-table-body">
                                    <table className="master-data-table">
                                        <thead>
                                            <tr>
                                                <th>PRODUCT CODE</th>
                                                <th>PRODUCT NAME</th>
                                                <th>ORDERED QTY</th>
                                                <th>PRODUCTION STAGE</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedViewOrder.items?.map((item, idx) => (
                                                <tr key={idx} className="master-data-row">
                                                    <td className="master-data-cell">{item.product?.productCode || "-"}</td>
                                                    <td className="master-data-cell">{item.product?.productName || "-"}</td>
                                                    <td className="master-data-cell">{item.quantity} {(item.product as any)?.uom?.name || "PCS"}</td>
                                                    <td className="master-data-cell">
                                                        {loadingStages ? (
                                                            <Spinner animation="border" size="sm" />
                                                        ) : (
                                                            <StatusBadge status={orderProductionStages[item.productId.toString()] || 'NOT_STARTED'} />
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-muted text-center p-4">No order selected.</div>
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default ApprovedSalesOrderList;
