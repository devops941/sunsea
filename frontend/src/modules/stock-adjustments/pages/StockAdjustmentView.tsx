import React, { useEffect, useState } from "react";
import { Container, Row, Col, Table, Badge, Form, Modal, Button } from "react-bootstrap";
import { FaArrowLeft, FaCheck, FaTimes } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchStockAdjustmentById, approveStockAdjustment, clearCurrent } from "../../../features/stock-adjustments/stockAdjustmentSlice";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { formatDate } from "../../../utils/dateUtils";

const StockAdjustmentView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentAdjustment, loading } = useAppSelector((state) => state.stockAdjustments);
  
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveStatus, setApproveStatus] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (id) {
      dispatch(fetchStockAdjustmentById(id));
    }
    return () => { dispatch(clearCurrent()); };
  }, [dispatch, id]);

  const handleApproveReject = async () => {
    if (!id || !approveStatus) return;
    try {
      await dispatch(approveStockAdjustment({ id, status: approveStatus, reason })).unwrap();
      toast.success(`Stock Adjustment ${approveStatus.toLowerCase()} successfully`);
      setShowApproveModal(false);
      dispatch(fetchStockAdjustmentById(id)); // refetch
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

  return (
    <div className="inner-container">
      <Container fluid>
        <div className="page-header">
          <Row className="align-items-center">
            <Col>
              <h2 className="page-title">Stock Adjustment Details</h2>
              <div className="page-breadcrumb">Inventory / Stock Adjustments / {currentAdjustment.adjustmentNumber}</div>
            </Col>
            <Col className="text-end">
              <CustomButton text="Back" variant="secondary" icon={FaArrowLeft} onClick={() => navigate("/inventory/stock-adjustments")} className="me-2" />
              {currentAdjustment.status === "DRAFT" && (
                <CustomButton text="Edit" onClick={() => navigate(`/inventory/stock-adjustments/edit/${currentAdjustment.id}`)} />
              )}
            </Col>
          </Row>
        </div>

        <div className="page-content">
          <Row className="mb-4">
            <Col md={3}>
              <div className="info-group">
                <label className="text-muted small">Adjustment Number</label>
                <div className="fw-bold">{currentAdjustment.adjustmentNumber}</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="info-group">
                <label className="text-muted small">Date</label>
                <div className="fw-bold">{formatDate(currentAdjustment.adjustmentDate)}</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="info-group">
                <label className="text-muted small">Status</label>
                <div>{getStatusBadge(currentAdjustment.status)}</div>
              </div>
            </Col>
            <Col md={3}>
              <div className="info-group">
                <label className="text-muted small">Reason</label>
                <div className="fw-bold">{currentAdjustment.reason || "-"}</div>
              </div>
            </Col>
          </Row>

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

          <h5 className="mb-3">Adjustment Items</h5>
          <Table bordered hover responsive>
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
                    {item.itemType === "RAW_MATERIAL" ? item.rawMaterial?.materialName : item.product?.productName}
                    {" "}
                    <small className="text-muted">({item.itemType === "RAW_MATERIAL" ? item.rawMaterialId : item.product?.productCode})</small>
                  </td>
                  <td>{item.store?.storeName}</td>
                  <td>{item.batchNo || "-"}</td>
                  <td>{item.unitCost !== null && item.unitCost !== undefined ? `₹${Number(item.unitCost).toFixed(2)}` : "-"}</td>
                  <td>{item.currentQty}</td>
                  <td>{item.adjustedQty}</td>
                  <td className={Number(item.difference) > 0 ? "text-success fw-bold" : Number(item.difference) < 0 ? "text-danger fw-bold" : ""}>
                    {Number(item.difference) > 0 ? `+${item.difference}` : item.difference}
                  </td>
                  <td>{item.remarks || "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Approval Section */}
          {currentAdjustment.status !== "APPROVED" && currentAdjustment.status !== "REJECTED" && (
            <div className="mt-4 p-3 border rounded bg-light d-flex justify-content-between align-items-center">
              <div>
                <strong>Workflow Actions</strong>
                <p className="text-muted mb-0 small">Review the items and approve or reject this adjustment.</p>
              </div>
              <div>
                <CustomButton text="Reject" variant="danger" icon={FaTimes} className="me-2" onClick={() => openApproveModal("REJECTED")} />
                <CustomButton text="Approve" variant="success" icon={FaCheck} onClick={() => openApproveModal("APPROVED")} />
              </div>
            </div>
          )}
        </div>
      </Container>

      <Modal show={showApproveModal} onHide={() => setShowApproveModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{approveStatus === "APPROVED" ? "Approve Adjustment" : "Reject Adjustment"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to <strong>{approveStatus?.toLowerCase()}</strong> this stock adjustment?
            {approveStatus === "APPROVED" && " This will permanently update the stock levels."}
          </p>
          <Form.Group>
            <Form.Label>Reason / Remarks (Optional)</Form.Label>
            <Form.Control as="textarea" rows={3} value={reason} onChange={e => setReason(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApproveModal(false)}>Cancel</Button>
          <Button variant={approveStatus === "APPROVED" ? "success" : "danger"} onClick={handleApproveReject}>
            Confirm {approveStatus === "APPROVED" ? "Approval" : "Rejection"}
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
};

export default StockAdjustmentView;
