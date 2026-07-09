// src/pages/sales/SalesOrderDetail/SalesOrderDetail.tsx
import React, { useEffect, useState } from "react";
import { Container, Row, Col, Spinner, Table } from "react-bootstrap";
import { FaArrowLeft, FaUser, FaMapMarkerAlt, FaBoxOpen, FaCheckCircle } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import CustomButton from "../../../components/ui/Button/Button";
import { salesOrderService, type SalesOrder } from "../../../services/salesOrderService";
import { getUnitPrice } from "../../../utils/pricingUtils";

// ─── Formatting helpers ─────────────────────────────────────────────────
const formatMoney = (val: string | number | null | undefined) => {
    const n = Number(val ?? 0);
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (val: string | null | undefined) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (val: string | null | undefined) => {
    if (!val) return "—";
    return new Date(val).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const COLOR_TYPE_LABELS: Record<string, string> = {
    sc: "Single Color",
    mc: "Multi Color",
};

// ─── Status → pill modifier map (uses .status-pill--active/--inactive/--hold from theme.css) ──
const STATUS_MODIFIER: Record<string, "active" | "inactive" | "hold"> = {
    DRAFT: "hold",
    CONFIRMED: "active",
    PENDING_MD_APPROVAL: "hold",
    MD_REJECTED: "inactive",
    IN_PRODUCTION: "hold",
    PENDING_CUSTOMER_APPROVAL: "hold",
    CUSTOMER_REJECTED: "inactive",
    COMPLETED: "active",
};

const APPROVAL_MODIFIER: Record<string, "active" | "inactive" | "hold"> = {
    PENDING: "hold",
    APPROVED: "active",
    REJECTED: "inactive",
};

const PRODUCTION_MODIFIER: Record<string, "active" | "inactive" | "hold"> = {
    NOT_STARTED: "hold",
    IN_PROGRESS: "hold",
    COMPLETED: "active",
};

const StatusPill: React.FC<{ status?: string | null; modifierMap: Record<string, "active" | "inactive" | "hold"> }> = ({ status, modifierMap }) => {
    if (!status) return <span className="status-pill">—</span>;
    const modifier = modifierMap[status] || "hold";
    return (
        <span className={`status-pill status-pill--${modifier}`}>
            {status.replace(/_/g, " ")}
        </span>
    );
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

// ─── Component ─────────────────────────────────────────────────────────
const SalesOrderDetail: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: idParam } = useParams<{ id: string }>();

    const [order, setOrder] = useState<SalesOrder | null>((location.state as SalesOrder) || null);
    const [loading, setLoading] = useState(!location.state);

    // Always refetch on mount (or when id changes) so the page reflects
    // the latest server state — e.g. after an MD approval/rejection that
    // happened elsewhere, a stale `location.state` snapshot won't show it.
    useEffect(() => {
        const id = idParam ? Number(idParam) : (location.state as SalesOrder)?.id;
        if (!id) {
            toast.error("No order specified");
            navigate("/quatation-order");
            return;
        }

        const load = async () => {
            try {
                const data = await salesOrderService.fetchById(id);
                setOrder(data);
            } catch (error) {
                toast.error("Failed to load order details");
                navigate("/quatation-order");
            } finally {
                setLoading(false);
            }
        };

        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idParam]);

    if (loading || !order) {
        return (
            <div className="inner-container">
                <Container fluid className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3">Loading order details...</p>
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
                                    <StatusPill status={order.status} modifierMap={STATUS_MODIFIER} />
                                </div>
                                <div className="page-breadcrumb">Home / Sales / Sales Orders / view</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions d-flex justify-content-lg-end gap-2">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/quatation-order")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* ── Rejection reason banner ── */}
                {order.status === "MD_REJECTED" && order.mdRejectionReason && (
                    <div className="alert alert-danger mb-4">
                        <strong>MD Rejected this order:</strong> {order.mdRejectionReason}
                    </div>
                )}
                {order.status === "CUSTOMER_REJECTED" && order.customerRejectionReason && (
                    <div className="alert alert-danger mb-4">
                        <strong>Customer Rejected this order:</strong> {order.customerRejectionReason}
                    </div>
                )}

                <Row>
                    {/* ── Left column: main details ── */}
                    <Col lg={8}>
                        <Section title="Order Information">
                            <Row>
                                <Col md={4}><Field label="Order No" value={order.orderNo} /></Col>
                                <Col md={4}><Field label="Order Date" value={formatDate(order.orderDate)} /></Col>
                                <Col md={4}><Field label="Expected Completion" value={formatDate(order.expectedCompletionDate)} /></Col>
                                <Col md={4}><Field label="Order Type" value={order.orderType} /></Col>
                                <Col md={4}><Field label="Dispatch Type" value={order.dispatchType} /></Col>
                                <Col md={4}>
                                    <Field
                                        label="Production Status"
                                        value={<StatusPill status={(order as any).productionStatus} modifierMap={PRODUCTION_MODIFIER} />}
                                    />
                                </Col>
                                {order.remarks && <Col md={6}><Field label="Remarks" value={order.remarks} /></Col>}
                                {order.internalNotes && <Col md={6}><Field label="Internal Notes" value={order.internalNotes} /></Col>}
                            </Row>
                        </Section>

                        <Section title="Customer" icon={<FaUser />}>
                            <Row>
                                <Col md={4}> <Field label="Name" value={order.customer?.displayName || order.customer?.firmName} /></Col>
                                <Col md={4}> <Field label="Type" value={order.customerType ? order.customerType.toLowerCase() : ''} /></Col>
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
                                    <div>{order.billingAddressLine1}</div>
                                    <div>{order.billingCity}, {order.billingState} — {order.billingPincode}</div>
                                </Col>
                                <Col md={6}>
                                    <div
                                        className="small text-uppercase mb-2"
                                        style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                    >
                                        Shipping Address{" "}

                                    </div>
                                    {order.shippingAddressLine1 ? (
                                        <>
                                            <div>{order.shippingAddressLine1}</div>
                                            <div>{order.shippingCity}, {order.shippingState} — {order.shippingPincode}</div>
                                        </>
                                    ) : (
                                        <div>Same as Billing Address</div>
                                    )}
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
                                            <th className="text-end">GST</th>
                                            <th className="text-end">Cess</th>
                                            <th className="text-end">Line Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.items?.map((item: any, idx: number) => (
                                            <tr key={item.id} className="master-data-row">
                                                <td className="master-data-cell">{idx + 1}</td>
                                                <td className="master-data-cell">
                                                    <div className="fw-semibold">{item.product?.productName}</div>
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
                                                <td className="master-data-cell text-end">{formatMoney(item.taxableValue)}</td>
                                                <td className="master-data-cell text-end">
                                                    {formatMoney(item.gstAmount)}
                                                    <div className="text-muted small">({item.gstRate}%)</div>
                                                </td>
                                                <td className="master-data-cell text-end">
                                                    {formatMoney(item.cessAmount)}
                                                    <div className="text-muted small">({item.cessRate}%)</div>
                                                </td>
                                                <td className="master-data-cell text-end fw-bold">{formatMoney(item.lineTotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        </Section>
                    </Col>

                    {/* ── Right column: approval trail + totals ── */}
                    <Col lg={4}>
                        <Section title="Approval Status" icon={<FaCheckCircle />}>
                            <div className="mb-4">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span
                                        className="small text-uppercase"
                                        style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                    >
                                        MD Approval
                                    </span>
                                    <StatusPill status={order.mdApprovalStatus} modifierMap={APPROVAL_MODIFIER} />
                                </div>
                                {order.mdApprovedAt && (
                                    <div className="text-muted small">Decided on {formatDateTime(order.mdApprovedAt)}</div>
                                )}
                                {order.mdRejectionReason && (
                                    <div className="text-danger small mt-1">Reason: {order.mdRejectionReason}</div>
                                )}
                            </div>

                            <div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span
                                        className="small text-uppercase"
                                        style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                    >
                                        Customer Approval
                                    </span>
                                    <StatusPill status={order.customerApprovalStatus} modifierMap={APPROVAL_MODIFIER} />
                                </div>
                                {order.customerApprovedAt && (
                                    <div className="text-muted small">Decided on {formatDateTime(order.customerApprovedAt)}</div>
                                )}
                                {order.customerRejectionReason && (
                                    <div className="text-danger small mt-1">Reason: {order.customerRejectionReason}</div>
                                )}
                            </div>
                        </Section>

                        <Section title="Amount Summary">
                            <div className="d-flex justify-content-between py-1">
                                <span className="text-muted">Subtotal</span>
                                <span>{formatMoney(order.subtotal)}</span>
                            </div>
                            <div className="d-flex justify-content-between py-1">
                                <span className="text-muted">GST</span>
                                <span>{formatMoney(order.totalGst)}</span>
                            </div>
                            <div className="d-flex justify-content-between py-1">
                                <span className="text-muted">CESS</span>
                                <span>{formatMoney(order.totalCess)}</span>
                            </div>
                            <div className="d-flex justify-content-between py-1">
                                <span className="text-muted">Discount</span>
                                <span className="text-danger">− {formatMoney(order.totalDiscount)}</span>
                            </div>
                            {/* <div className="d-flex justify-content-between py-1">
                                <span className="text-muted">GST</span>
                                <span>+ {formatMoney(order.totalGst)}</span>
                            </div>
                            <div className="d-flex justify-content-between py-1">
                                <span className="text-muted">Cess</span>
                                <span>+ {formatMoney(order.totalCess)}</span>
                            </div> */}
                            <hr style={{ borderColor: "var(--color-border)" }} />
                            <div className="d-flex justify-content-between py-1">
                                <span className="fw-bold" style={{ color: "var(--color-primary)" }}>Net Amount</span>
                                <span className="fw-bold fs-5" style={{ color: "var(--color-secondary)" }}>{formatMoney(order.netAmount)}</span>
                            </div>
                        </Section>

                        <Section title="Meta">
                            <Field label="Created On" value={formatDateTime((order as any).createdAt)} />
                            <Field label="Last Updated" value={formatDateTime((order as any).updatedAt)} />
                        </Section>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default SalesOrderDetail;