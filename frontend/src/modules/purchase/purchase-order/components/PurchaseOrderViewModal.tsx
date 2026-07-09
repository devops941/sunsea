import React, { useEffect } from "react";
import { Modal, Row, Col, Badge, Table } from "react-bootstrap";
import { FaInfoCircle, FaMapMarkerAlt, FaBoxOpen, FaStickyNote, FaUser } from "react-icons/fa";
import type { PurchaseOrder } from "../../../../features/purchaseOrder/types";
import { useSelector, useDispatch } from "react-redux";
import { fetchRawMaterials } from "../../../../features/raw-materials/rawMaterialSlice";
import type { AppDispatch } from "../../../../app/store";
import Section from "../../../../components/ui/Section/Section";

interface PurchaseOrderViewModalProps {
  show: boolean;
  onHide: () => void;
  purchaseOrder: PurchaseOrder | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  COMPLETED: "info",
  CANCELLED: "dark",
};

const safeDate = (date?: string | null) => {
  if (!date) return "-";
  const d = new Date(date);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
};

const safeNumber = (val: any): number => {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// ─── Report-style read-only Field (matches QuotationForm) ──────────────────
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

const PurchaseOrderViewModal: React.FC<PurchaseOrderViewModalProps> = ({
  show,
  onHide,
  purchaseOrder,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const rawMaterials = useSelector((state: any) => state.rawMaterials?.data || []);
  const user = useSelector((state: any) => state?.auth?.user);

  useEffect(() => {
    if (show && rawMaterials.length === 0) {
      dispatch(fetchRawMaterials(undefined));
    }
  }, [show, dispatch, rawMaterials.length]);

  if (!purchaseOrder) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg" scrollable centered>
      <Modal.Header closeButton>
        <Modal.Title>Purchase Order Details</Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ background: "var(--color-bg, #f8f9fa)" }}>
        {/* ── Order Information ── */}
        <Section title="Order Information" icon={<FaInfoCircle />}>
          <Row>
            <Col md={6}><Field label="PO Number" value={purchaseOrder.poNumber} /></Col>
            <Col md={6}>
              <div className="mb-3">
                <div
                  className="small text-uppercase"
                  style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                >
                  Status
                </div>
                <Badge bg={STATUS_COLORS[purchaseOrder.status] || "secondary"}>
                  {purchaseOrder.status || "N/A"}
                </Badge>
              </div>
            </Col>
            <Col md={6}><Field label="PO Date" value={safeDate(purchaseOrder.poDate)} /></Col>
            <Col md={6}><Field label="Expected Delivery" value={safeDate(purchaseOrder.expectedDeliveryDate)} /></Col>
            <Col md={6}><Field label="Supplier" value={purchaseOrder.supplier?.supplierName || "N/A"} /></Col>
            <Col md={6}><Field label="Supplier Code" value={purchaseOrder.supplier?.supplierCode || "N/A"} /></Col>
          </Row>
        </Section>

        {/* ── Addresses ── */}
        <Section title="Addresses" icon={<FaMapMarkerAlt />}>
          <Row>
            <Col md={6}>
              <Field
                label="Billing Address"
                value={
                  <>
                    {purchaseOrder.billingAddressLine1 || "-"} <br />
                    {purchaseOrder.billingCity || "-"}, {purchaseOrder.billingState || "-"} <br />
                    {purchaseOrder.billingPincode || "-"}
                  </>
                }
              />
            </Col>
            <Col md={6}>
              <Field
                label="Shipping Address"
                value={
                  <>
                    {purchaseOrder.shippingAddressLine1 || "-"} <br />
                    {purchaseOrder.shippingCity || "-"}, {purchaseOrder.shippingState || "-"} <br />
                    {purchaseOrder.shippingPincode || "-"}
                    {purchaseOrder.sameAsBilling && (
                      <div className="mt-1"><Badge bg="success">Same as billing</Badge></div>
                    )}
                  </>
                }
              />
            </Col>
          </Row>
        </Section>

        {/* ── Items ── */}
        <Section title="Items" icon={<FaBoxOpen />}>
          <div className="table-responsive mb-3">
            <Table bordered hover size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Discount %</th>
                  <th>Tax %</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {(purchaseOrder.items || []).length > 0 ? (
                  purchaseOrder.items.map((item, index) => {
                    const qty = safeNumber(item.quantity);
                    const price = safeNumber(item.unitPrice);
                    const discount = safeNumber(item.discount);
                    const tax = safeNumber(item.tax);

                    const base = qty * price;
                    const discountAmt = (base * discount) / 100;
                    const taxAmt = ((base - discountAmt) * tax) / 100;
                    const total = base - discountAmt + taxAmt;

                    const matchedMaterial = rawMaterials.find(
                      (rm: any) => String(rm.rawMaterialId) === String(item.productId)
                    );
                    const productName = matchedMaterial?.materialName || `Product #${item.productId || "-"}`;

                    return (
                      <tr key={item.id || index}>
                        <td>{index + 1}</td>
                        <td>{productName}</td>
                        <td>{qty}</td>
                        <td>₹{price.toFixed(2)}</td>
                        <td>{discount}%</td>
                        <td>{tax}%</td>
                        <td>₹{total.toFixed(2)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center">
                      No items found
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          {/* Summary */}
          <Row>
            <Col md={{ span: 6, offset: 6 }}>
              <div
                className="p-3"
                style={{
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="d-flex justify-content-between mb-2">
                  <span>Subtotal:</span>
                  <span>₹{safeNumber(purchaseOrder.subtotal).toFixed(2)}</span>
                </div>

                <div className="d-flex justify-content-between mb-2 text-danger">
                  <span>Discount:</span>
                  <span>-₹{safeNumber(purchaseOrder.totalDiscount).toFixed(2)}</span>
                </div>

                <div className="d-flex justify-content-between mb-2 text-success">
                  <span>Tax:</span>
                  <span>+₹{safeNumber(purchaseOrder.totalTax).toFixed(2)}</span>
                </div>

                <hr />

                <div className="d-flex justify-content-between fw-bold">
                  <span>Net Amount:</span>
                  <span>₹{safeNumber(purchaseOrder.netAmount).toFixed(2)}</span>
                </div>
              </div>
            </Col>
          </Row>
        </Section>

        {/* ── Notes ── */}
        {purchaseOrder.remarks && (
          <Section title="Remarks" icon={<FaStickyNote />}>
            <p className="mb-0">{purchaseOrder.remarks}</p>
          </Section>
        )}

        {/* ── Rejection Reason ── */}
        {purchaseOrder.status === "REJECTED" && purchaseOrder.rejectReason && (
          <Section title="Rejection Reason" icon={<FaStickyNote />}>
            <p className="mb-0 text-danger fw-semibold">{purchaseOrder.rejectReason}</p>
          </Section>
        )}

        {/* ── Meta ── */}
        <Section title="Timestamps" icon={<FaUser />}>
          <Row>
            <Col md={6}><Field label="Created By" value={user?.username || "NA"} /></Col>
            <Col md={6}><Field label="Created At" value={safeDate(purchaseOrder.createdAt)} /></Col>
          </Row>
        </Section>
      </Modal.Body>
    </Modal>
  );
};

export default PurchaseOrderViewModal;