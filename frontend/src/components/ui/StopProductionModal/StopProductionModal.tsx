import React, { useState, useEffect } from "react";
import { Modal, Form, Button } from "react-bootstrap";
import TextInput from "../../form/TextInput/TextInput";

interface StopProductionModalProps {
  show: boolean;
  onHide: () => void;
  onConfirm: (reason: string, remarks: string) => void;
  program: any;
}

const StopProductionModal: React.FC<StopProductionModalProps> = ({
  show,
  onHide,
  onConfirm,
  program,
}) => {
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");

  const stopReasons = [
    "Machine Breakdown",
    "Power Failure",
    "Material Shortage",
    "Tool Change",
    "Lunch/Tea Break",
    "Maintenance",
    "Shift End",
    "Production Complete",
    "Others"
  ];

  useEffect(() => {
    if (show) {
      setReason("");
      setRemarks("");
    }
  }, [show]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason, remarks);
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton style={{ background: "var(--color-danger, #EF4444)", color: "#fff" }}>
        <Modal.Title className="fs-5 fw-bold">Stop Production Run</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="mb-3 p-3 bg-light rounded border small">
            <strong>PO ID:</strong> {program?.productionOrderId}<br />
            <strong>Product Name:</strong> {program?.productionOrder?.productItem?.productName}<br />
          </div>

          <Form.Group className="mb-3">
            <Form.Label className="fw-bold small text-muted text-uppercase">Stop Reason</Form.Label>
            <Form.Select
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ height: "42px", borderRadius: "8px" }}
            >
              <option value="">-- Select Reason --</option>
              {stopReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {reason === "Others" && (
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold small text-muted text-uppercase">Remarks</Form.Label>
              <TextInput
                name="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks for stopping..."
                required
              />
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" className="rounded-3" onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" className="rounded-3 px-4">
            Confirm Stop Run
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default StopProductionModal;
