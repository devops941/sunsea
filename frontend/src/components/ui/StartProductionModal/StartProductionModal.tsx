import React, { useState, useEffect } from "react";
import { Modal, Form, Row, Col, Button } from "react-bootstrap";
import { shiftService } from "../../../services/shiftService";
import type { Shift } from "../../../features/shifts/types";

interface Machine {
  machineId: string;
  machineName: string;
}

interface StartProductionModalProps {
  show: boolean;
  onHide: () => void;
  onConfirm: (machineId: string, shiftId: string) => void;
  program: any;
  allowedMachines: Machine[];
}

const StartProductionModal: React.FC<StartProductionModalProps> = ({
  show,
  onHide,
  onConfirm,
  program,
  allowedMachines,
}) => {
  const [machineId, setMachineId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);

  // Fetch shifts once on mount
  useEffect(() => {
    const loadShifts = async () => {
      try {
        const data = await shiftService.fetchAll();
        setShifts(data);
      } catch (err) {
        console.error("Failed to load shifts:", err);
      }
    };
    loadShifts();
  }, []);

  // Reset selections whenever modal opens
  useEffect(() => {
    if (show) {
      setMachineId("");
      setShiftId("");
    }
  }, [show]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(machineId, shiftId);
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton style={{ background: "var(--color-success, #22C55E)", color: "#fff" }}>
        <Modal.Title className="fs-5 fw-bold">Start Production Run</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Row className="g-3">
            <Col md={12}>
              <Form.Group>
                <Form.Label className="fw-bold small text-muted text-uppercase">Run Details</Form.Label>
                <div className="p-3 bg-light rounded border small">
                  <strong>PO ID:</strong> {program?.productionOrderId}<br />
                  <strong>Product Name:</strong> {program?.productionOrder?.productItem?.productName}<br />
                  <strong>Target Quantity:</strong> {program?.plannedQty} pcs
                </div>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-bold small text-muted text-uppercase">Select Machine to Run On</Form.Label>
                <Form.Select
                  required
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  style={{ height: "42px", borderRadius: "8px" }}
                >
                  <option value="">-- Choose Active Machine --</option>
                  {allowedMachines.map((m) => (
                    <option key={m.machineId} value={m.machineId}>
                      {m.machineName} ({m.machineId})
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-danger small fw-medium mt-1 d-block">
                  * MAC-001 disabled for planning
                </Form.Text>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-bold small text-muted text-uppercase">Select Shift</Form.Label>
                <Form.Select
                  required
                  value={shiftId}
                  onChange={(e) => setShiftId(e.target.value)}
                  style={{ height: "42px", borderRadius: "8px" }}
                >
                  <option value="">-- Choose Shift --</option>
                  {shifts.map((s) => (
                    <option key={s.shiftCode} value={s.shiftCode}>
                      {s.shiftName} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" className="rounded-3" onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit" variant="success" className="rounded-3 px-4">
            Confirm Start Run
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default StartProductionModal;
