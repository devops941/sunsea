import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Table,
  Badge,
  Form,
  Modal,
  Button,
  Card,
  Alert,
} from "react-bootstrap";
import { FaArrowLeft, FaCheck, FaTimes, FaBoxes, FaEdit } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import {
  fetchStockAdjustmentById,
  approveStockAdjustment,
  clearCurrent,
} from "../../../features/stock-adjustments/stockAdjustmentSlice";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { formatDate } from "../../../utils/dateUtils";

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  PRODUCTION_MATERIAL_ISSUE: "Production Material Issue",
  PRODUCTION_MATERIAL_RETURN: "Production Material Return",
  STOCK_INCREASE: "Stock Increase",
  STOCK_DECREASE: "Stock Decrease",
  DAMAGE: "Damage",
  SCRAP: "Scrap",
  OPENING_STOCK: "Opening Stock",
  MANUAL_CORRECTION: "Manual Correction",
  OTHER: "Other",
};

const ADJUSTMENT_TYPE_BADGE: Record<string, string> = {
  PRODUCTION_MATERIAL_ISSUE: "primary",
  PRODUCTION_MATERIAL_RETURN: "info",
  STOCK_INCREASE: "success",
  STOCK_DECREASE: "warning",
  DAMAGE: "danger",
  SCRAP: "secondary",
  OPENING_STOCK: "dark",
  MANUAL_CORRECTION: "light",
  OTHER: "secondary",
};

const StockAdjustmentView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentAdjustment, loading } = useAppSelector(
    (state) => state.stockAdjustments
  );

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveStatus, setApproveStatus] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (id) dispatch(fetchStockAdjustmentById(id));
    return () => { dispatch(clearCurrent()); };
  }, [dispatch, id]);

  const handleApproveReject = async () => {
    if (!id || !approveStatus) return;
    try {
      await dispatch(
        approveStockAdjustment({ id, status: approveStatus, reason })
      ).unwrap();
      toast.success(`Stock Adjustment ${approveStatus.toLowerCase()} successfully`);
      setShowApproveModal(false);
      dispatch(fetchStockAdjustmentById(id));
    } catch (err: any) {
      toast.error(err || "Failed to update status");
    }
  };

  const openApproveModal = (status: "APPROVED" | "REJECTED") => {
    setApproveStatus(status);
    setReason("");
    setShowApproveModal(true);
  };

  if (loading || !currentAdjustment) {
    return <div className="text-center py-5">Loading...</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT": return <Badge bg="secondary">Draft</Badge>;
      case "PENDING_APPROVAL": return <Badge bg="warning">Pending Approval</Badge>;
      case "APPROVED": return <Badge bg="success">Approved</Badge>;
      case "REJECTED": return <Badge bg="danger">Rejected</Badge>;
      default: return <Badge bg="secondary">{status}</Badge>;
    }
  };

  const isPMI = currentAdjustment.adjustmentType === "PRODUCTION_MATERIAL_ISSUE";
  const po = currentAdjustment.productionOrder;

  return (
    <div className="inner-container">
      <Container fluid>
        {/* PAGE HEADER */}
        <div className="page-header">
          <Row className="align-items-center">
            <Col>
              <h2 className="page-title">Stock Adjustment Details</h2>
              <div className="page-breadcrumb">
                Inventory / Stock Adjustments /{" "}
                {currentAdjustment.adjustmentNumber}
              </div>
            </Col>
            <Col className="text-end">
              <CustomButton
                text="Back"
                variant="secondary"
                icon={FaArrowLeft}
                onClick={() => navigate("/inventory/stock-adjustments")}
                className="me-2"
              />
              {currentAdjustment.status === "DRAFT" && (
                <CustomButton
                  text="Edit"
                  icon={FaEdit}
                  onClick={() =>
                    navigate(
                      `/inventory/stock-adjustments/edit/${currentAdjustment.id}`
                    )
                  }
                />
              )}
            </Col>
          </Row>
        </div>

        <div className="page-content">
          {/* ── ADJUSTMENT SUMMARY ── */}
          <Card className="mb-4 border-0 shadow-sm">
            <Card.Header className="bg-primary text-white py-3">
              <h5 className="mb-0 fw-bold">Adjustment Information</h5>
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={2}>
                  <div className="info-group">
                    <label className="text-muted small">Adjustment Number</label>
                    <div className="fw-bold">{currentAdjustment.adjustmentNumber}</div>
                  </div>
                </Col>
                <Col md={2}>
                  <div className="info-group">
                    <label className="text-muted small">Date</label>
                    <div className="fw-bold">{formatDate(currentAdjustment.adjustmentDate)}</div>
                  </div>
                </Col>
                <Col md={2}>
                  <div className="info-group">
                    <label className="text-muted small">Adjustment Type</label>
                    <div>
                      <Badge
                        bg={
                          ADJUSTMENT_TYPE_BADGE[currentAdjustment.adjustmentType] ||
                          "secondary"
                        }
                      >
                        {ADJUSTMENT_TYPE_LABELS[currentAdjustment.adjustmentType] ||
                          currentAdjustment.adjustmentType}
                      </Badge>
                    </div>
                  </div>
                </Col>
                <Col md={2}>
                  <div className="info-group">
                    <label className="text-muted small">Status</label>
                    <div>{getStatusBadge(currentAdjustment.status)}</div>
                  </div>
                </Col>
                <Col md={2}>
                  <div className="info-group">
                    <label className="text-muted small">Created By</label>
                    <div className="fw-bold">{currentAdjustment.createdBy || "—"}</div>
                  </div>
                </Col>
                <Col md={2}>
                  <div className="info-group">
                    <label className="text-muted small">Approved By</label>
                    <div className="fw-bold">
                      {currentAdjustment.approvedBy
                        ? `${currentAdjustment.approvedBy} (${formatDate(currentAdjustment.approvedAt)})`
                        : "—"}
                    </div>
                  </div>
                </Col>
                <Col md={12}>
                  <div className="info-group">
                    <label className="text-muted small">Reason</label>
                    <div>{currentAdjustment.reason || "—"}</div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {!isPMI && (
            <Row className="mb-4">
              <Col md={3}>
                <div className="info-group">
                  <label className="text-muted small">Source Document</label>
                  <div className="fw-bold">{currentAdjustment.sourceDocument || "-"}</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="info-group">
                  <label className="text-muted small">Source Doc ID / Ref</label>
                  <div className="fw-bold">{currentAdjustment.sourceDocId || "-"}</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="info-group">
                  <label className="text-muted small">Auto Generated</label>
                  <div>
                    {currentAdjustment.autoGenerated ? (
                      <Badge bg="info">Auto-generated</Badge>
                    ) : (
                      "No"
                    )}
                  </div>
                </div>
              </Col>
              <Col md={3}>
                <div className="info-group">
                  <label className="text-muted small">Adjustment Type</label>
                  <div className="fw-bold">{currentAdjustment.type || "Adjustment"}</div>
                </div>
              </Col>
            </Row>
          )}

          {/* ── PRODUCTION INFO CARD (PMI only) ── */}
          {isPMI && po && (
            <Card className="mb-4 border-0 shadow-sm">
              <Card.Header
                className="py-3 d-flex align-items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #1e3a5f, #2d6a9f)",
                  color: "#fff",
                }}
              >
                <FaBoxes />
                <h5 className="mb-0 fw-bold">Production Order Information</h5>
              </Card.Header>
              <Card.Body>
                <Row className="g-3">
                  <Col md={2}>
                    <label className="text-muted small">PO Number</label>
                    <div className="fw-bold text-primary">
                      {po.productionOrderId}
                    </div>
                  </Col>
                  <Col md={3}>
                    <label className="text-muted small">Product</label>
                    <div className="fw-bold">
                      {po.productItem?.productName || "—"}
                    </div>
                    <div className="text-muted small">
                      {po.productItem?.productCode}
                    </div>
                  </Col>
                  <Col md={2}>
                    <label className="text-muted small">Planned Qty</label>
                    <div className="fw-bold">
                      {po.targetQty ? Number(po.targetQty).toLocaleString() : "—"}{" "}
                      {po.uom}
                    </div>
                  </Col>
                  <Col md={2}>
                    <label className="text-muted small">Due Date</label>
                    <div className="fw-bold">{formatDate(po.dueDate)}</div>
                  </Col>
                  <Col md={2}>
                    <label className="text-muted small">Machine</label>
                    <div className="fw-bold">
                      {po.Machine?.machineName || po.machineMachineId || "—"}
                    </div>
                  </Col>
                  <Col md={1}>
                    <label className="text-muted small">PO Status</label>
                    <div>
                      <Badge bg="info" className="small">
                        {po.status}
                      </Badge>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}

          {/* ── ITEMS TABLE ── */}
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-secondary text-white py-3">
              <h5 className="mb-0 fw-bold">
                {isPMI ? "Issued Materials" : "Adjustment Items"}
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              {isPMI ? (
                /* PMI items with richer columns */
                <Table bordered hover responsive className="mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th>RM Code</th>
                      <th>Material Name</th>
                      <th>Store</th>
                      <th className="text-end">Stock Before</th>
                      <th className="text-end">Stock After</th>
                      <th className="text-end">Issued Qty</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAdjustment.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td>
                          <code>{item.rawMaterialId}</code>
                        </td>
                        <td className="fw-semibold">
                          {item.rawMaterial?.materialName || item.rawMaterialId}
                        </td>
                        <td>{item.store?.storeName || item.storeId}</td>
                        <td className="text-end">{Number(item.currentQty).toFixed(3)}</td>
                        <td className="text-end">{Number(item.adjustedQty).toFixed(3)}</td>
                        <td className="text-end fw-bold text-danger">
                          {Math.abs(Number(item.difference)).toFixed(3)}
                        </td>
                        <td>{item.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                /* Regular adjustment items */
                <Table bordered hover responsive className="mb-0">
                  <thead className="bg-light">
                    <tr>
                      <th>Item Type</th>
                      <th>Item Details</th>
                      <th>Store</th>
                      <th>Batch No</th>
                      <th>Unit Cost</th>
                      <th>Current Qty</th>
                      <th>Adjusted Qty</th>
                      <th>Difference</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAdjustment.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td>{item.itemType}</td>
                        <td>
                          {item.itemType === "RAW_MATERIAL"
                            ? item.rawMaterial?.materialName
                            : item.product?.productName}
                          {" "}
                          <small className="text-muted">
                            (
                            {item.itemType === "RAW_MATERIAL"
                              ? item.rawMaterialId
                              : item.product?.productCode}
                            )
                          </small>
                        </td>
                        <td>{item.store?.storeName}</td>
                        <td>{item.batchNo || "-"}</td>
                        <td>{item.unitCost !== null && item.unitCost !== undefined ? `₹${Number(item.unitCost).toFixed(2)}` : "-"}</td>
                        <td>{Number(item.currentQty).toFixed(3)}</td>
                        <td>{Number(item.adjustedQty).toFixed(3)}</td>
                        <td
                          className={
                            Number(item.difference) > 0
                              ? "text-success fw-bold"
                              : Number(item.difference) < 0
                              ? "text-danger fw-bold"
                              : ""
                          }
                        >
                          {Number(item.difference) > 0
                            ? `+${Number(item.difference).toFixed(3)}`
                            : Number(item.difference).toFixed(3)}
                        </td>
                        <td>{item.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>

          {/* ── PMI PRODUCTION START NOTICE ── */}
          {isPMI && currentAdjustment.status === "APPROVED" && (
            <Alert variant="success" className="d-flex align-items-center gap-2 mb-4">
              <FaCheck />
              <span>
                Material Issue <strong>approved</strong>. The Production Order{" "}
                <strong>{currentAdjustment.productionOrderId}</strong> is now eligible to
                start production.
              </span>
            </Alert>
          )}

          {isPMI && currentAdjustment.status === "DRAFT" && (
            <Alert variant="warning" className="d-flex align-items-center gap-2 mb-4">
              <span>
                ⚠ This Material Issue is in <strong>Draft</strong> status. Approve it to
                allow Production Start and deduct stock.
              </span>
            </Alert>
          )}

          {/* ── WORKFLOW ACTIONS ── */}
          {currentAdjustment.status !== "APPROVED" &&
            currentAdjustment.status !== "REJECTED" && (
              <div className="mt-4 p-3 border rounded bg-light d-flex justify-content-between align-items-center">
                <div>
                  <strong>Workflow Actions</strong>
                  <p className="text-muted mb-0 small">
                    {isPMI
                      ? "Approving this Material Issue will deduct raw material stock and enable Production Start."
                      : "Review the items and approve or reject this adjustment."}
                  </p>
                </div>
                <div>
                  <CustomButton
                    text="Reject"
                    variant="danger"
                    icon={FaTimes}
                    className="me-2"
                    onClick={() => openApproveModal("REJECTED")}
                  />
                  <CustomButton
                    text="Approve"
                    variant="success"
                    icon={FaCheck}
                    onClick={() => openApproveModal("APPROVED")}
                  />
                </div>
              </div>
            )}
        </div>
      </Container>

      {/* Approve / Reject Modal */}
      <Modal show={showApproveModal} onHide={() => setShowApproveModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {approveStatus === "APPROVED" ? "Approve Adjustment" : "Reject Adjustment"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to{" "}
            <strong>{approveStatus?.toLowerCase()}</strong> this stock adjustment?
            {approveStatus === "APPROVED" &&
              (isPMI
                ? " This will deduct the issued quantities from raw material stock and enable Production Start."
                : " This will permanently update the stock levels.")}
          </p>
          <Form.Group>
            <Form.Label>Reason / Remarks (Optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
            Cancel
          </Button>
          <Button
            variant={approveStatus === "APPROVED" ? "success" : "danger"}
            onClick={handleApproveReject}
          >
            Confirm {approveStatus === "APPROVED" ? "Approval" : "Rejection"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StockAdjustmentView;
