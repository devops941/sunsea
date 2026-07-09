import React, { useState, useEffect } from "react";
import { Container, Row, Col, Table, Spinner, Modal } from "react-bootstrap";
import { FaInfoCircle, FaUser, FaMapMarkerAlt, FaBoxOpen, FaCheck, FaTimes, FaArrowLeft } from "react-icons/fa";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import CustomButton from "../../../../components/ui/Button/Button";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import Section from "../../../../components/ui/Section/Section";
import { useUsers } from "../../../../hooks/useUsers";

// ============================================================
// SIMPLE READ-ONLY FIELD DISPLAY
// ============================================================
const ViewField: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="mb-3">
        <div className="text-muted" style={{ fontSize: "0.8rem" }}>{label}</div>
        <div className="fw-semibold">{value || value === 0 ? value : "—"}</div>
    </div>
);

const statusBadgeClass = (status: string) => {
    switch (status) {
        case "APPROVED": return "success";
        case "PENDING": return "warning";
        case "REJECTED": return "danger";
        case "CANCELLED": return "secondary";
        case "COMPLETED": return "info";
        default: return "dark"; // DRAFT
    }
};

const PurchaseOrderViewPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const { suppliers, loadSuppliers } = useSuppliers();
    const { users, loadUsers } = useUsers();

    const [po, setPo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // ── Unified approve/reject modal state ──
    const [actionMode, setActionMode] = useState<"approve" | "reject" | null>(null);
    const [reason, setReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    const isRejectReasonValid = reason.trim().length > 0;

    useEffect(() => {
        loadSuppliers();
        loadUsers();
    }, [loadSuppliers, loadUsers]);

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            try {
                if (location.state) {
                    if (mounted) setPo(location.state);
                } else if (id) {
                    const data = await purchaseOrderService.fetchById(id);
                    if (mounted) setPo(data);
                }
            } catch {
                toast.error("Failed to load purchase order");
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        return () => {
            mounted = false;
        };
    }, [id, location.state]);

    if (loading) {
        return (
            <div className="inner-container d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
                <Spinner animation="border" />
            </div>
        );
    }

    if (!po) {
        return (
            <div className="inner-container">
                <Container fluid>
                    <div className="text-center text-muted py-5">Purchase order not found.</div>
                </Container>
            </div>
        );
    }

    const supplier = suppliers.find((s) => String(s.id) === String(po.supplierId));
    const createdByUser = users.find((u: any) => u.userId === po.createdBy);

    // ============================================================
    // APPROVE / REJECT (unified handler)
    // ============================================================
    const handleConfirmAction = async () => {
        if (!po?.id) return;

        setActionLoading(true);
        try {
            if (actionMode === "approve") {
                await purchaseOrderService.updateStatus(po.id, "APPROVED");
                toast.success("Purchase Order approved.");
                setPo((prev: any) => ({ ...prev, status: "APPROVED" }));
                setActionMode(null);
                navigate("/purchase-order-approvals");
            } else if (actionMode === "reject") {
                if (!reason.trim()) return;
                await purchaseOrderService.updateStatus(po.id, "REJECTED", reason.trim());
                toast.success("Purchase Order rejected.");
                setPo((prev: any) => ({ ...prev, status: "REJECTED", rejectReason: reason.trim() }));
                setActionMode(null);
                navigate("/purchase-order-approvals");
                setReason("");
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || "Failed to update purchase order");
        } finally {
            setActionLoading(false);
        }
    };

    // ============================================================
    // UI
    // ============================================================
    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Purchase Order — {po.poNumber}</h2>
                                <div className="page-breadcrumb">Home / Purchase / Purchase Orders / View</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12} className="text-lg-end">
                            <span className={`badge bg-${statusBadgeClass(po.status)}`} style={{ fontSize: "0.9rem" }}>
                                {po.status}
                            </span>
                        </Col>
                    </Row>
                </div>

                {/* ── Order Information ── */}
                <Section title="Order Information" icon={<FaInfoCircle />}>
                    <Row>
                        <Col lg={3} md={6}><ViewField label="PO Number" value={po.poNumber} /></Col>
                        <Col lg={3} md={6}><ViewField label="PO Date" value={po.poDate ? po.poDate.split("T")[0] : ""} /></Col>
                        <Col lg={3} md={6}><ViewField label="Expected Delivery Date" value={po.expectedDeliveryDate ? po.expectedDeliveryDate.split("T")[0] : ""} /></Col>
                        <Col lg={3} md={6}><ViewField label="Created By" value={createdByUser?.username} /></Col>
                    </Row>
                    {po.status === "REJECTED" && po.rejectReason && (
                        <Row>
                            <Col lg={12}>
                                <div className="alert alert-danger mb-0">
                                    <strong>Rejection Reason:</strong> {po.rejectReason}
                                </div>
                            </Col>
                        </Row>
                    )}
                </Section>

                {/* ── Supplier ── */}
                <Section title="Supplier" icon={<FaUser />}>
                    <Row>
                        <Col lg={6} md={12}>
                            <ViewField
                                label="Supplier"
                                value={supplier ? `${supplier.supplierCode} - ${supplier.legalName || supplier.displayName || ""}` : po.supplierId}
                            />
                        </Col>
                    </Row>
                </Section>

                {/* ── Addresses ── */}
                <Section title="Billing & Shipping Address" icon={<FaMapMarkerAlt />}>
                    <Row>
                        <Col lg={6}>
                            <h6 className="mb-3">Billing Address</h6>
                            <ViewField label="Address Line" value={po.billingAddressLine1} />
                            <Row>
                                <Col md={4}><ViewField label="City" value={po.billingCity} /></Col>
                                <Col md={4}><ViewField label="State" value={po.billingState} /></Col>
                                <Col md={4}><ViewField label="Pincode" value={po.billingPincode} /></Col>
                            </Row>
                        </Col>
                        <Col lg={6}>
                            <h6 className="mb-3">Shipping Address</h6>
                            <ViewField label="Address Line" value={po.shippingAddressLine1} />
                            <Row>
                                <Col md={4}><ViewField label="City" value={po.shippingCity} /></Col>
                                <Col md={4}><ViewField label="State" value={po.shippingState} /></Col>
                                <Col md={4}><ViewField label="Pincode" value={po.shippingPincode} /></Col>
                            </Row>
                        </Col>
                    </Row>
                </Section>

                {/* ── Items ── */}
                <Section title="Items" icon={<FaBoxOpen />}>
                    <div className="table-responsive">
                        <Table bordered hover>
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th>Product</th>
                                    <th>UOM</th>
                                    <th>Quantity</th>
                                    <th>Unit Price</th>
                                    <th>Discount %</th>
                                    <th>Tax %</th>
                                    <th>Line Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(po.items || []).map((item: any, index: number) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td>{item.product?.productName || item.productId}</td>
                                        <td>{item.uom}</td>
                                        <td>{item.quantity}</td>
                                        <td>₹{Number(item.unitPrice).toFixed(2)}</td>
                                        <td>{item.discount || 0}%</td>
                                        <td>{item.tax || 0}%</td>
                                        <td>₹{Number(item.lineTotal).toFixed(2)}</td>
                                    </tr>
                                ))}
                                {(!po.items || po.items.length === 0) && (
                                    <tr>
                                        <td colSpan={8} className="text-center">No items</td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    </div>
                </Section>

                {/* ── Remarks + Summary ── */}
                <Section title="Notes & Summary">
                    <Row>
                        <Col lg={6}>
                            <ViewField label="Remarks" value={po.remarks} />
                        </Col>
                        <Col lg={{ span: 5, offset: 1 }}>
                            <div
                                className="p-3"
                                style={{
                                    background: "var(--color-bg, #f8f9fa)",
                                    borderRadius: "var(--radius-md, 8px)",
                                    border: "1px solid var(--color-border)",
                                }}
                            >
                                <h6 className="mb-3 fw-bold" style={{ color: "var(--color-primary)" }}>Order Summary</h6>
                                <div className="d-flex justify-content-between mb-2">
                                    <span>Subtotal:</span>
                                    <span>₹{Number(po.subtotal).toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2 text-danger">
                                    <span>Total Discount:</span>
                                    <span>-₹{Number(po.totalDiscount).toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2 text-success">
                                    <span>Total Tax:</span>
                                    <span>+₹{Number(po.totalTax).toFixed(2)}</span>
                                </div>
                                <hr />
                                <div className="d-flex justify-content-between fw-bold">
                                    <span>Net Amount:</span>
                                    <span>₹{Number(po.netAmount).toFixed(2)}</span>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Section>

                {/* ── Actions ── */}
                <div
                    className="form-actions d-flex justify-content-end gap-3 mt-4"
                    style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}
                >
                    <CustomButton
                        text="Back"
                        icon={FaArrowLeft}
                        onClick={() => navigate("/purchase-order-approvals")}
                        type="button"
                    />

                    {po.status === "PENDING" && (
                        <>
                            <CustomButton
                                text="Approve"
                                icon={FaCheck}
                                onClick={() => setActionMode("approve")}
                                type="button"
                            />
                            <CustomButton
                                text="Reject"
                                icon={FaTimes}
                                onClick={() => setActionMode("reject")}
                                type="button"
                            />
                        </>
                    )}
                </div>

                {/* ── Approve / Reject Modal ── */}
                <Modal show={actionMode !== null} onHide={() => setActionMode(null)} centered>
                    <Modal.Header closeButton>
                        <Modal.Title style={{ color: "var(--color-primary)", fontFamily: "var(--font-head)" }}>
                            {actionMode === "approve" ? "Approve Purchase Order" : "Reject Purchase Order"}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {actionMode === "approve" ? (
                            <p>Are you sure you want to approve this purchase order?</p>
                        ) : (
                            <>
                                <label htmlFor="rejection-reason" className="form-label">
                                    Enter the reason for rejection <span className="text-danger">*</span>
                                </label>
                                <textarea
                                    id="rejection-reason"
                                    className="form-control"
                                    rows={4}
                                    placeholder="Type your rejection reason here..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    required
                                />
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <CustomButton text="Cancel" onClick={() => setActionMode(null)} disabled={actionLoading} />
                        <CustomButton
                            text={actionLoading ? "Processing..." : actionMode === "approve" ? "Confirm Approve" : "Confirm Reject"}
                            className={actionMode === "approve" ? "btn-success" : "btn-danger"}
                            onClick={handleConfirmAction}
                            disabled={actionLoading || (actionMode === "reject" && !isRejectReasonValid)}
                        />
                    </Modal.Footer>
                </Modal>
            </Container>
        </div>
    );
};

export default PurchaseOrderViewPage;