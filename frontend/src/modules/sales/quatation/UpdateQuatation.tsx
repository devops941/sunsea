// src/pages/sales/QuotationForm/QuotationReport.tsx
import React, { useEffect, useState } from "react";
import { Container, Row, Col, Spinner, Modal, Table } from "react-bootstrap";
import { FaArrowLeft, FaCheck, FaTimes, FaUser, FaMapMarkerAlt, FaBoxOpen } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import CustomButton from "../../../components/ui/Button/Button";
import {
    salesOrderService,
    type SalesOrder,
    type MdApprovalDecisionDto,
} from "../../../services/salesOrderService";
import { getUnitPrice } from "../../../utils/pricingUtils";

// ─── Formatting helpers ─────────────────────────────────────────────────
const formatMoney = (val: string | number | null | undefined) => {
    const n = Number(val ?? 0);
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (val?: string | null) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};



const COLOR_TYPE_LABELS: Record<string, string> = {
    sc: "Single Color",
    mc: "Multi Color",
};

// ─── Small labeled value block ──────────────────────────────────────────
const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="mb-3">
        <div
            className="small text-uppercase"
            style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
        >
            {label}
        </div>
        <div className="fw-semibold" style={{ color: "var(--color-text-primary)" }}>{value ?? "—"}</div>
    </div>
);

// ─── Section wrapper ─────────────────────────────────────────────────────
const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div
        className="mb-4 p-4"
        style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
        }}
    >
        <div className="d-flex align-items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
            {icon && (
                <span
                    className="d-inline-flex align-items-center justify-content-center"
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(203, 122, 33, 0.1)",
                        color: "var(--color-secondary)",
                    }}
                >
                    {icon}
                </span>
            )}
            <h6 className="mb-0 fw-bold" style={{ color: "var(--color-primary)", fontFamily: "var(--font-head)" }}>{title}</h6>
        </div>
        {children}
    </div>
);

// ─── Component ────────────────────────────────────────────────────────────
const QuotationReport: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [order, setOrder] = useState<SalesOrder | null>(null);
    const [loading, setLoading] = useState(true);

    const [actionMode, setActionMode] = useState<"approve" | "reject" | null>(null);
    const user = useSelector((state: any) => state.auth.user);
    const [reason, setReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    // Always refetch from the server on load so this page reflects the
    // current approval state — a stale location.state snapshot could
    // still show PENDING_MD_APPROVAL after a decision was already made.
    useEffect(() => {
        const state = location.state as any;
        const load = async () => {
            setLoading(true);
            try {
                if (state?.id) {
                    const fresh = await salesOrderService.fetchById(state.id);
                    setOrder(fresh);
                } else if (state) {
                    setOrder(state as SalesOrder);
                }
            } catch {
                toast.error("Failed to load quotation");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [location]);

    const billing = {
        addressLine1: order?.billingAddressLine1 || "",
        city: order?.billingCity || "",
        state: order?.billingState || "",
        pincode: order?.billingPincode || "",
    };
    const shipping = {
        addressLine1: order?.shippingAddressLine1 || "",
        city: order?.shippingCity || "",
        state: order?.shippingState || "",
        pincode: order?.shippingPincode || "",
    };

    // ── Approve / Reject handler ──
    const handleConfirmAction = async () => {
        if (!order?.id) return;
        if (actionMode === "reject" && !reason.trim()) return;

        const payload: MdApprovalDecisionDto = {
            decision: actionMode === "approve" ? "APPROVED" : "REJECTED",
            approverId: user?.userId,
            rejectionReason: actionMode === "reject" ? reason.trim() : undefined,
        };

        setActionLoading(true);
        try {
            await salesOrderService.approveMd(order.id, payload);
            toast.success(actionMode === "approve" ? "Quotation approved" : "Quotation rejected");
            setActionMode(null);
            setReason("");
            navigate("/pending-quotations");
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Action failed");
        } finally {
            setActionLoading(false);
        }
    };

    const isRejectReasonValid = reason.trim().length > 0;

    if (loading) {
        return (
            <div className="inner-container">
                <Container fluid className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3">Loading data...</p>
                </Container>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="inner-container">
                <Container fluid className="py-5">
                    <p className="text-muted">No quotation data found.</p>
                </Container>
            </div>
        );
    }

    return (
        <div className="inner-container">
            <Container fluid>
                {/* ── Page Header ── */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                    <h2 className="page-title mb-0">{order.orderNo}</h2>
                                </div>
                                <div className="page-breadcrumb">Home / Sales / MD Approval / edit</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions d-flex justify-content-lg-end gap-2">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/pending-quotations")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* ── Rejection reason banner ── */}
                {order.status === "MD_REJECTED" && (order as any).mdRejectionReason && (
                    <div className="alert alert-danger mb-4">
                        <strong>MD Rejected this order:</strong> {(order as any).mdRejectionReason}
                    </div>
                )}
                {(order.status as string) === "CUSTOMER_REJECTED" && (order as any).customerRejectionReason && (
                    <div className="alert alert-danger mb-4">
                        <strong>Customer Rejected this order:</strong> {(order as any).customerRejectionReason}
                    </div>
                )}

                <Row>
                    {/* ── Left column: main details ── */}

                    <Section title="Order Information">
                        <Row>
                            <Col md={4}><Field label="Quotation No" value={order.orderNo} /></Col>
                            <Col md={4}><Field label="Quotation Date" value={formatDate(order.orderDate)} /></Col>
                            <Col md={4}><Field label="Valid Until" value={formatDate(order.expectedCompletionDate)} /></Col>
                            {order.remarks && <Col md={6}><Field label="Remarks" value={order.remarks} /></Col>}
                            {order.internalNotes && <Col md={6}><Field label="Internal Notes" value={order.internalNotes} /></Col>}
                        </Row>
                    </Section>

                    <Section title="Customer" icon={<FaUser />}>
                        <Row>
                            <Col md={4}><Field label="Name" value={order.customer?.displayName || order.customer?.firmName} /></Col>
                            <Col md={4}><Field label="Type" value={order.customerType ? order.customerType.toLowerCase() : ""} /></Col>

                        </Row>
                    </Section>

                    <Section title="Addresses" icon={<FaMapMarkerAlt />}>
                        <Row>
                            <Col md={6}>
                                <div
                                    className="small text-uppercase mb-2"
                                    style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                >
                                    Billing Address
                                </div>
                                <div>{billing?.addressLine1}</div>
                                <div>{billing?.city}, {billing?.state} — {billing?.pincode}</div>
                            </Col>
                            <Col md={6}>
                                <div
                                    className="small text-uppercase mb-2"
                                    style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                >
                                    Shipping Address
                                </div>
                                <div>{shipping?.addressLine1}</div>
                                <div>{shipping?.city}, {shipping?.state} — {shipping?.pincode}</div>
                            </Col>
                        </Row>
                    </Section>

                    <Section title="Items" icon={<FaBoxOpen />}>
                        <div className="table-wrap">
                            <Table hover className="master-data-table align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product</th>
                                        <th>Color</th>
                                        <th className="text-end">Qty</th>
                                        <th className="text-end">Unit Price</th>
                                        <th className="text-end">Discount</th>
                                        <th className="text-end">Taxable Value</th>
                                        {order.isInterState ? (
                                            <th className="text-end">IGST</th>
                                        ) : (
                                            <>
                                                <th className="text-end">CGST</th>
                                                <th className="text-end">SGST</th>
                                            </>
                                        )}

                                        <th className="text-end">Line Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(order.items || []).map((item: any, idx: number) => (
                                        <tr key={item.id || idx} className="master-data-row">
                                            <td className="master-data-cell">{idx + 1}</td>
                                            <td className="master-data-cell">
                                                <div className="fw-semibold">{item.product?.productName || item.productId}</div>
                                                <div className="text-muted small">{item.product?.productCode}</div>
                                            </td>
                                            <td className="master-data-cell">{COLOR_TYPE_LABELS[item.colorType] || item.colorType || "—"}</td>
                                            <td className="master-data-cell text-end">{item.quantity}</td>
                                            <td className="master-data-cell text-end">{formatMoney(getUnitPrice(item, order.customerType))}</td>
                                            <td className="master-data-cell text-end">
                                                {formatMoney(item.discountAmount)}
                                                <div className="text-muted small">
                                                    ({item.discountType === "PERCENT" ? `${item.discountValue}%` : "flat"})
                                                </div>
                                            </td>
                                            <td className="master-data-cell text-end">{formatMoney(item.taxableAmount || item.taxableValue)}</td>
                                            {order.isInterState ? (
                                                <td className="master-data-cell text-end">
                                                    {formatMoney(item.igstAmount || item.gstAmount || 0)}
                                                    <div className="text-muted small">({item.igstRate || item.gstRate || 0}%)</div>
                                                </td>
                                            ) : (
                                                <>
                                                    <td className="master-data-cell text-end">
                                                        {formatMoney(item.cgstAmount || (Number(item.gstAmount || 0) / 2))}
                                                        <div className="text-muted small">({item.cgstRate || (Number(item.gstRate || 0) / 2)}%)</div>
                                                    </td>
                                                    <td className="master-data-cell text-end">
                                                        {formatMoney(item.sgstAmount || (Number(item.gstAmount || 0) / 2))}
                                                        <div className="text-muted small">({item.sgstRate || (Number(item.gstRate || 0) / 2)}%)</div>
                                                    </td>
                                                </>
                                            )}

                                            <td className="master-data-cell text-end fw-bold">{formatMoney(item.lineTotal)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    </Section>

                    <Section title="Amount Summary">
                        <Row>
                            <Col md={6}>
                                <div className="d-flex justify-content-between py-1">
                                    <span className="text-muted">Subtotal</span>
                                    <span>{formatMoney(order.subtotal)}</span>
                                </div>
                                {order.isInterState ? (
                                    <div className="d-flex justify-content-between py-1 small text-success">
                                        <span>IGST</span>
                                        <span>+ {formatMoney(order.totalIgst || order.totalGst || 0)}</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="d-flex justify-content-between py-1 small text-success">
                                            <span>CGST</span>
                                            <span>+ {formatMoney(order.totalCgst || (Number(order.totalGst || 0) / 2))}</span>
                                        </div>
                                        <div className="d-flex justify-content-between py-1 small text-success">
                                            <span>SGST</span>
                                            <span>+ {formatMoney(order.totalSgst || (Number(order.totalGst || 0) / 2))}</span>
                                        </div>
                                    </>
                                )}
                                <div className="d-flex justify-content-between py-1">
                                    <span className="text-muted">Discount</span>
                                    <span className="text-danger">− {formatMoney(order.totalDiscount)}</span>
                                </div>
                                <hr style={{ borderColor: "var(--color-border)" }} />
                                <div className="d-flex justify-content-between py-1">
                                    <span className="fw-bold" style={{ color: "var(--color-primary)" }}>Net Amount</span>
                                    <span className="fw-bold fs-5" style={{ color: "var(--color-secondary)" }}>{formatMoney(order.netAmount)}</span>
                                </div>
                            </Col>
                        </Row>
                    </Section>

                    {/* ── Approve / Reject actions (only while pending MD approval) ── */}
                    {order.status === "PENDING_MD_APPROVAL" && (
                        <div className="d-flex justify-content-end gap-3 mt-4 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
                            <CustomButton
                                text="Reject"
                                icon={FaTimes}
                                className="btn-outline-danger"
                                onClick={() => {
                                    setReason("");
                                    setActionMode("reject");
                                }}
                            />
                            <CustomButton
                                text="Approve"
                                icon={FaCheck}
                                className="btn-success"
                                onClick={() => setActionMode("approve")}
                            />
                        </div>
                    )}

                    {/* ── Right column: approval trail + totals ── */}

                </Row>
            </Container>

            {/* ── Confirmation Modal ── */}
            <Modal show={actionMode !== null} onHide={() => setActionMode(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title style={{ color: "var(--color-primary)", fontFamily: "var(--font-head)" }}>
                        {actionMode === "approve" ? "Approve Quotation" : "Reject Quotation"}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {actionMode === "approve" ? (
                        <p>Are you sure you want to approve this quotation?</p>
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
        </div>
    );
};

export default QuotationReport;