import React, { useEffect, useState } from "react";
import { Modal, Spinner, Row, Col, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { productionOrderService } from "../../../services/productionOrderService";
import type { ProductionOrder } from "../../../services/productionOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { MaterialIssueModal } from "./MaterialIssueModal";

interface ProductionOrderViewModalProps {
    show: boolean;
    onHide: () => void;
    order: ProductionOrder | null;
    onSuccess?: () => void;
}

export const ProductionOrderViewModal: React.FC<ProductionOrderViewModalProps> = ({ show, onHide, order, onSuccess }) => {
    const [fullOrder, setFullOrder] = useState<any>(null);
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [selectedProdForIssue, setSelectedProdForIssue] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [rawMaterialsMap, setRawMaterialsMap] = useState<Map<string, any>>(new Map());

    useEffect(() => {
        rawMaterialService.fetchAll()
            .then(data => {
                const arr = Array.isArray(data) ? data : (data as any)?.data || [];
                const map = new Map<string, any>();
                arr.forEach((rm: any) => map.set(rm.rawMaterialId?.toString(), rm));
                setRawMaterialsMap(map);
            })
            .catch(err => console.error("Failed to fetch raw materials", err));
    }, []);

    useEffect(() => {
        if (show && order) {
            setLoading(true);
            const fetchIds = ((order as any).items && Array.isArray((order as any).items) && (order as any).items.length > 0)
                ? (order as any).items.map((i: any) => i.productionOrderId || i.id)
                : [order.productionOrderId || order.id];

            Promise.all(fetchIds.map((id: string) => productionOrderService.getById(id)))
                .then((dataArray) => {
                    if (dataArray.length === 1) {
                        const o = dataArray[0];
                        if (o && o.products) {
                            o.products = o.products.map((p: any) => ({ ...p, productionOrderId: o.productionOrderId, status: o.status }));
                        }
                        setFullOrder(o);
                    } else if (dataArray.length > 1) {
                        const mergedOrder = { ...dataArray[0] };
                        mergedOrder.products = dataArray.flatMap((d: any) => 
                            (d.products || []).map((p: any) => ({ ...p, productionOrderId: d.productionOrderId, status: d.status }))
                        );
                        mergedOrder.productionOrderId = order.productionOrderId || order.id;
                        setFullOrder(mergedOrder);
                    }
                })
                .catch((err) => {
                    console.error("❌ Failed to fetch PO details:", err);
                    toast.error("Failed to load production order details");
                })
                .finally(() => setLoading(false));
        } else {
            setFullOrder(null);
        }
    }, [show, order]);

    if (!order) return null;

    const formatDate = (dateString?: string) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

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

    return (
        <Modal show={show} onHide={onHide} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>Production Order Details</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {hasInsufficientStock && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 mb-3 fw-medium" role="alert" style={{ borderRadius: '8px', fontSize: '14px' }}>
                        <span>One or more required raw materials have insufficient stock. Please create a Raw Material Order before proceeding to Weekly Machine Assignment.</span>
                    </div>
                )}
                
                {loading ? (
                    <div className="text-center p-4">
                        <Spinner animation="border" size="sm" className="me-2" /> Loading details...
                    </div>
                ) : (
                    <>
                        <Row className="mb-4">
                            <Col md={4}>
                                <div className="text-muted small">Order No</div>
                                <div className="fw-bold">{fullOrder?.productionOrderId || order.productionOrderId}</div>
                            </Col>
                            <Col md={4}>
                                <div className="text-muted small">Sales Order No</div>
                                <div className="fw-bold">
                                    {fullOrder?.salesOrderDetails?.orderNo || order.salesOrderDetails?.orderNo || order.sourceSalesOrderId ? (
                                        fullOrder?.salesOrderDetails?.orderNo || order.salesOrderDetails?.orderNo || order.sourceSalesOrderId
                                    ) : (
                                        <span className="badge border-0 shadow-sm px-2 py-1" style={{ fontSize: "0.75rem", borderRadius: "12px", background: "linear-gradient(135deg, #6c757d, #495057)", color: "white" }}>Direct Order</span>
                                    )}
                                </div>
                            </Col>
                            <Col md={4}>
                                <div className="text-muted small">Customer</div>
                                <div className="fw-bold">
                                    {fullOrder?.salesOrderDetails?.customerName || order.salesOrderDetails?.customerName ? (
                                        fullOrder?.salesOrderDetails?.customerName || order.salesOrderDetails?.customerName
                                    ) : (
                                        <span className="text-muted fst-italic" style={{ fontSize: "0.85rem" }}>N/A (Direct)</span>
                                    )}
                                </div>
                            </Col>
                        </Row>
                        <Row className="mb-4">
                            <Col md={4}>
                                <div className="text-muted small">Order Date</div>
                                <div className="fw-bold">{formatDate(fullOrder?.orderDate || order.orderDate)}</div>
                            </Col>
                            <Col md={4}>
                                <div className="text-muted small">Due Date</div>
                                <div className="fw-bold">{formatDate(fullOrder?.dueDate || order.dueDate)}</div>
                            </Col>
                            <Col md={4}>
                                <div className="text-muted small">Priority</div>
                                <div className="fw-bold">{fullOrder?.priority || order.priority || "-"}</div>
                            </Col>
                        </Row>
                        <Row className="mb-4">
                            <Col md={6}>
                                <div className="text-muted small">Order Type</div>
                                <div className="fw-bold">{fullOrder?.orderType || order.orderType || "-"}</div>
                            </Col>
                            <Col md={6}>
                                <div className="text-muted small">Color Type</div>
                                <div className="fw-bold">
                                    {(fullOrder?.colorType || order?.colorType) ? (
                                        <StatusBadge 
                                            status={(fullOrder?.colorType || order?.colorType) === 'mc' ? 'MULTI COLOR' : 'SINGLE COLOR'} 
                                            customColor={(fullOrder?.colorType || order?.colorType) === 'mc' ? { bg: '#e0e7ff', text: '#3730a3' } : { bg: '#fef3c7', text: '#92400e' }}
                                        />
                                    ) : "-"}
                                </div>
                            </Col>
                        </Row>

                        {fullOrder?.products?.map((prod: any, idx: number) => (
                            <div key={idx} className="mt-4 border-top pt-4">
                                <h6 className="section-title">Product {idx + 1}: {prod.productName} ({prod.productCode})</h6>
                                
                                <Row className="mb-4 mt-3">
                                    <Col md={3}>
                                        <div className="text-muted small">Production Qty</div>
                                        <div className="fw-bold">{prod.quantity} {prod.uom?.toLowerCase() === 'ea' ? 'pcs' : prod.uom}</div>
                                    </Col>
                                    <Col md={3}>
                                        <div className="text-muted small">Weight Used</div>
                                        <div className="fw-bold">{Number(prod.weightPerPieceUsed || 0).toFixed(3)} KG</div>
                                    </Col>
                                    <Col md={3}>
                                        <div className="text-muted small">Unit (UOM)</div>
                                        <div className="fw-bold">{prod.uom?.toLowerCase() === 'ea' ? 'pcs' : prod.uom}</div>
                                    </Col>
                                </Row>

                                <div className="text-muted small fw-bold mb-2 mt-4" style={{ color: 'var(--color-primary)' }}>Required Raw Materials</div>
                                <div className="master-table-body table-wrap">
                                    <div className="master-table-body">
                                        <table className="master-data-table">
                                            <thead>
                                                <tr>
                                                    <th>RAW MATERIAL CODE</th>
                                                    <th>RAW MATERIAL NAME</th>
                                                    <th>REQUIRED QTY</th>
                                                    <th>AVAILABLE STOCK</th>
                                                    <th>STOCK STATUS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
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
                                                    
                                                    return (
                                                        <tr key={rm.rawMaterialId} className="master-data-row">
                                                            <td className="master-data-cell fw-medium">{rm.rawMaterialId}</td>
                                                            <td className="master-data-cell">{materialName}</td>
                                                            <td className="master-data-cell">{required.toFixed(2)} KG</td>
                                                            <td className="master-data-cell">{available.toFixed(2)} KG</td>
                                                            <td className="master-data-cell">
                                                                <StatusBadge status={isAvailable ? "AVAILABLE" : "INSUFFICIENT"} />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {(!prod.rawMaterials || prod.rawMaterials.length === 0) && (
                                                    <tr>
                                                        <td colSpan={5} className="text-center text-muted p-3">
                                                            No raw materials defined for this product.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULED"].includes(prod.status || fullOrder?.status) && (
                                    <div className="d-flex justify-content-end mt-2">
                                        <Button 
                                            variant="success" 
                                            size="sm"
                                            onClick={() => {
                                                setSelectedProdForIssue(prod);
                                                setShowIssueModal(true);
                                            }}
                                            className="fw-semibold px-3"
                                        >
                                            Issue Raw Materials
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Close
                </Button>
            </Modal.Footer>

            {selectedProdForIssue && (
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
                        // Reload details in modal
                        setLoading(true);
                        const fetchIds = ((order as any).items && Array.isArray((order as any).items) && (order as any).items.length > 0)
                            ? (order as any).items.map((i: any) => i.productionOrderId || i.id)
                            : [order.productionOrderId || order.id];
            
                        Promise.all(fetchIds.map((id: string) => productionOrderService.getById(id)))
                            .then((dataArray) => {
                                if (dataArray.length === 1) {
                                    const o = dataArray[0];
                                    if (o && o.products) {
                                        o.products = o.products.map((p: any) => ({ ...p, productionOrderId: o.productionOrderId, status: o.status }));
                                    }
                                    setFullOrder(o);
                                } else if (dataArray.length > 1) {
                                    const mergedOrder = { ...dataArray[0] };
                                    mergedOrder.products = dataArray.flatMap((d: any) => 
                                        (d.products || []).map((p: any) => ({ ...p, productionOrderId: d.productionOrderId, status: d.status }))
                                    );
                                    mergedOrder.productionOrderId = order.productionOrderId || order.id;
                                    setFullOrder(mergedOrder);
                                }
                            })
                            .catch(err => console.error("Failed to reload PO details after issue", err))
                            .finally(() => setLoading(false));

                        // Trigger parent refresh
                        onSuccess?.();
                    }}
                />
            )}
        </Modal>
    );
};

export default ProductionOrderViewModal;
