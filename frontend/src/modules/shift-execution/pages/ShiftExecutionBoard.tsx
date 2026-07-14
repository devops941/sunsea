import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col, Card, Button, Table, Badge, Modal, Form } from "react-bootstrap";
import { 
  FaPlay, FaStop, FaCheck, FaUnlock, FaLock, 
  FaClipboardList, FaClock, FaPlus, FaTrash, FaCalculator 
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchProductionOrders, updateProductionOrder } from "../../../features/production-orders/productionOrderSlice";
import { fetchHourlyProductions, createHourlyProduction, updateHourlyProduction } from "../../../features/hourly-productions/hourlyProductionSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";

// Interface for local Downtime log
interface DowntimeLog {
  id: string;
  reason: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

const ShiftExecutionBoard: React.FC = () => {
  const dispatch = useAppDispatch();

  // Redux data
  const { data: productionOrders } = useAppSelector((state) => state.productionOrders);
  const { data: hourlyProductions } = useAppSelector((state) => state.hourlyProductions);
  const { data: machines } = useAppSelector((state) => state.machines);

  // Console setup state
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [isConsoleActive, setIsConsoleActive] = useState(false);

  // Active production order selection
  const [activeOrderId, setActiveOrderId] = useState("");

  // Lock rules & Supervisor override
  const [activeHourIndex, setActiveHourIndex] = useState(1);
  const [supervisorMode, setSupervisorMode] = useState(false);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [passcode, setPasscode] = useState("");

  // Downtime modal state
  const [showDowntimeModal, setShowDowntimeModal] = useState(false);
  const [downtimeReason, setDowntimeReason] = useState("Breakdown");
  const [downtimeStart, setDowntimeStart] = useState("");
  const [downtimeEnd, setDowntimeEnd] = useState("");
  const [downtimeLogs, setDowntimeLogs] = useState<DowntimeLog[]>([]);

  // Hourly inputs (temp form state for 8 hours)
  const [hourlyInputs, setHourlyInputs] = useState<Record<number, { actual: string; reject: string; scrap: string }>>({
    1: { actual: "", reject: "", scrap: "" },
    2: { actual: "", reject: "", scrap: "" },
    3: { actual: "", reject: "", scrap: "" },
    4: { actual: "", reject: "", scrap: "" },
    5: { actual: "", reject: "", scrap: "" },
    6: { actual: "", reject: "", scrap: "" },
    7: { actual: "", reject: "", scrap: "" },
    8: { actual: "", reject: "", scrap: "" },
  });

  useEffect(() => {
    dispatch(fetchProductionOrders());
    dispatch(fetchHourlyProductions());
    dispatch(fetchMachines());
    dispatch(fetchShifts());
  }, [dispatch]);

  // Load downtime logs from local storage when activeOrderId changes
  useEffect(() => {
    if (activeOrderId) {
      const stored = localStorage.getItem(`downtime_${activeOrderId}`);
      if (stored) {
        setDowntimeLogs(JSON.parse(stored));
      } else {
        setDowntimeLogs([]);
      }
    }
  }, [activeOrderId]);

  // Get active order details
  const activeOrder = useMemo(() => {
    return productionOrders.find((po) => po.productionOrderId === activeOrderId);
  }, [productionOrders, activeOrderId]);

  // Load existing hourly production logs for activeOrder
  useEffect(() => {
    if (activeOrderId && hourlyProductions.length > 0) {
      const inputs = { ...hourlyInputs };
      let logsFound = false;

      // Reset
      for (let i = 1; i <= 8; i++) {
        inputs[i] = { actual: "", reject: "", scrap: "" };
      }

      hourlyProductions.forEach((hp) => {
        if (hp.productionOrderId === activeOrderId) {
          const idx = Number(hp.hourIndex);
          if (idx >= 1 && idx <= 8) {
            inputs[idx] = {
              actual: hp.qtyProduced.toString(),
              // Mapped properties or default to 0 if not fetched
              reject: (activeOrder?.rejectedQty ? (Number(activeOrder.rejectedQty) / 8).toFixed(0) : "0"), 
              scrap: (activeOrder?.scrapQty ? (Number(activeOrder.scrapQty) / 8).toFixed(0) : "0"),
            };
            logsFound = true;
          }
        }
      });

      if (logsFound) {
        setHourlyInputs(inputs);
      }
    }
  }, [activeOrderId, hourlyProductions, activeOrder]);

  // Compute auto Hourly Target
  const hourlyTarget = useMemo(() => {
    if (!activeOrder) return 0;
    const total = Number(activeOrder.targetQty) || 0;
    const hours = 8;
    return Math.round(total / hours);
  }, [activeOrder]);

  // Filter production orders matching setup criteria
  const availableOrders = useMemo(() => {
    return productionOrders.filter(
      (po) => 
        ((po as any).machineId === selectedMachineId || !selectedMachineId) &&
        ((po as any).shiftId === selectedShiftId || !selectedShiftId) &&
        po.status !== "POST_PRODUCTION" &&
        po.status !== "COMPLETED" &&
        po.status !== "CANCELLED"
    );
  }, [productionOrders, selectedMachineId, selectedShiftId]);

  // Handle shift status changes
  const handleStatusChange = async (newStatus: string) => {
    if (!activeOrder) return;
    try {
      const payload: any = {
        ...activeOrder,
        status: newStatus,
      };

      if (newStatus === "IN PROGRESS") {
        payload.actualStartDateTime = new Date().toISOString();
        toast.info("Shift production started!");
      } else if (newStatus === "POST_PRODUCTION") {
        payload.actualEndDateTime = new Date().toISOString();
        // sum actuals to update order's produced qty
        let sumActual = 0;
        let sumReject = 0;
        let sumScrap = 0;
        Object.keys(hourlyInputs).forEach((key) => {
          const val = hourlyInputs[Number(key)];
          sumActual += Number(val.actual) || 0;
          sumReject += Number(val.reject) || 0;
          sumScrap += Number(val.scrap) || 0;
        });

        payload.producedQty = sumActual;
        payload.rejectedQty = sumReject;
        payload.scrapQty = sumScrap;
        toast.success("Shift production finishing phase initiated! Status updated to Post-Production.");
      }

      await dispatch(updateProductionOrder({ id: Number(activeOrderId), data: payload })).unwrap();
      dispatch(fetchProductionOrders());
    } catch (err: any) {
      toast.error(err || "Failed to update status");
    }
  };

  // Submit log for a specific hour
  const handleSaveHourlyRow = async (hourIndex: number) => {
    if (!activeOrderId) return;
    const row = hourlyInputs[hourIndex];
    if (!row.actual) {
      toast.error("Please enter actual production quantity");
      return;
    }

    try {
      // Check if log already exists
      const existing = hourlyProductions.find(
        (hp) => hp.productionOrderId === activeOrderId && Number(hp.hourIndex) === hourIndex
      );

      if (existing) {
        await dispatch(
          updateHourlyProduction({
            id: existing.hourlyProductionId.toString(),
            data: {
              qtyProduced: Number(row.actual),
            },
          })
        ).unwrap();
        toast.success(`Hour ${hourIndex} log updated successfully!`);
      } else {
        await dispatch(
          createHourlyProduction({
            productionOrderId: activeOrderId,
            hourIndex,
            qtyProduced: Number(row.actual),
          })
        ).unwrap();
        toast.success(`Hour ${hourIndex} log saved successfully!`);
      }

      // Automatically advance active hour index
      if (hourIndex === activeHourIndex && activeHourIndex < 8) {
        setActiveHourIndex(activeHourIndex + 1);
      }

      // Sync total production quantities to Production Order
      let totalActual = 0;
      let totalReject = 0;
      let totalScrap = 0;
      for (let i = 1; i <= 8; i++) {
        const val = i === hourIndex ? row : hourlyInputs[i];
        totalActual += Number(val.actual) || 0;
        totalReject += Number(val.reject) || 0;
        totalScrap += Number(val.scrap) || 0;
      }

      await dispatch(
        updateProductionOrder({
          id: Number(activeOrderId),
          data: {
            ...activeOrder,
            producedQty: totalActual,
            rejectedQty: totalReject,
            scrapQty: totalScrap,
          },
        })
      ).unwrap();

      dispatch(fetchHourlyProductions());
      dispatch(fetchProductionOrders());
    } catch (err: any) {
      toast.error(err || "Failed to save hourly log");
    }
  };

  // Handle input changes
  const handleInputChange = (hourIndex: number, field: "actual" | "reject" | "scrap", value: string) => {
    setHourlyInputs((prev) => ({
      ...prev,
      [hourIndex]: {
        ...prev[hourIndex],
        [field]: value,
      },
    }));
  };

  // Supervisor override authentication
  const handleSupervisorVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === "1234") {
      setSupervisorMode(true);
      setShowSupervisorModal(false);
      setPasscode("");
      toast.success("Supervisor Mode activated! Editing unlocked.");
    } else {
      toast.error("Incorrect passcode. Editing remains locked.");
    }
  };

  // Add Downtime log
  const handleAddDowntime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!downtimeStart || !downtimeEnd) {
      toast.error("Please enter start and end time");
      return;
    }

    const start = new Date(downtimeStart);
    const end = new Date(downtimeEnd);
    if (end <= start) {
      toast.error("End time must be after start time");
      return;
    }

    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / 60000);

    const log: DowntimeLog = {
      id: Date.now().toString(),
      reason: downtimeReason,
      startTime: downtimeStart,
      endTime: downtimeEnd,
      durationMinutes: diffMins,
    };

    const updated = [...downtimeLogs, log];
    setDowntimeLogs(updated);
    localStorage.setItem(`downtime_${activeOrderId}`, JSON.stringify(updated));
    setShowDowntimeModal(false);
    toast.success("Downtime stoppage logged!");

    setDowntimeStart("");
    setDowntimeEnd("");
  };

  // Delete Downtime log
  const handleDeleteDowntime = (id: string) => {
    const updated = downtimeLogs.filter((log) => log.id !== id);
    setDowntimeLogs(updated);
    localStorage.setItem(`downtime_${activeOrderId}`, JSON.stringify(updated));
    toast.info("Downtime log deleted");
  };

  // Shift performance analytics calculations
  const analytics = useMemo(() => {
    const totalProduced = Object.values(hourlyInputs).reduce((sum, h) => sum + (Number(h.actual) || 0), 0);
    const totalRejected = Object.values(hourlyInputs).reduce((sum, h) => sum + (Number(h.reject) || 0), 0);
    const totalDowntime = downtimeLogs.reduce((sum, log) => sum + log.durationMinutes, 0);

    const plannedTime = 8 * 60; // minutes
    const runningTime = Math.max(0, plannedTime - totalDowntime);

    // 1. Availability = Running Time / Planned Time
    const availability = plannedTime > 0 ? (runningTime / plannedTime) * 100 : 0;

    // 2. Performance = Produced / Target
    const target = Number(activeOrder?.targetQty) || 1;
    const performance = (totalProduced / target) * 100;

    // 3. Quality = Good / Total
    const quality = totalProduced > 0 ? ((totalProduced - totalRejected) / totalProduced) * 100 : 100;

    // 4. OEE = Availability * Performance * Quality
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

    return {
      totalProduced,
      totalRejected,
      totalDowntime,
      availability: Math.min(100, Math.max(0, availability)).toFixed(1),
      performance: Math.min(100, Math.max(0, performance)).toFixed(1),
      quality: Math.min(100, Math.max(0, quality)).toFixed(1),
      oee: Math.min(100, Math.max(0, oee)).toFixed(1),
    };
  }, [hourlyInputs, downtimeLogs, activeOrder]);

  return (
    <div className="inner-container">
      <Container fluid className="px-4 py-3">
        {/* Header */}
        <div className="page-header mb-4">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Operator Shift Execution Console</h2>
                
              </div>
            </Col>
            <Col lg={6} md={12} className="text-lg-end">
              {isConsoleActive && (
                <Button 
                  variant="outline-danger" 
                  onClick={() => {
                    setIsConsoleActive(false);
                    setActiveOrderId("");
                    setSupervisorMode(false);
                  }}
                  className="rounded-3 px-4 shadow-sm"
                >
                  Close Console Session
                </Button>
              )}
            </Col>
          </Row>
        </div>

        {/* Setup Phase */}
        {!isConsoleActive ? (
          <Row className="justify-content-center py-4">
            <Col lg={6} md={8}>
              <Card className="border-0 shadow-sm rounded-3 p-4">
                <h4 className="fw-bold mb-4 text-center" style={{ color: "var(--color-primary)" }}>
                  Setup Shift Console Session
                </h4>
                <Form onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedMachineId || !selectedShiftId || !operatorName) {
                    toast.error("Please fill in all setup fields");
                    return;
                  }
                  setIsConsoleActive(true);
                  // auto select order if single one is available
                  if (availableOrders.length > 0) {
                    setActiveOrderId(availableOrders[0].productionOrderId || "");
                  }
                }}>
                  <Row className="g-3">
                    <Col md={12}>
                      <SelectInput
                        label="Machine"
                        name="machineId"
                        value={selectedMachineId}
                        options={machines.map(m => ({ label: m.machineName, value: m.machineId }))}
                        required
                        defaultOptionLabel="Select Machine"
                        onChange={(e) => setSelectedMachineId(e.target.value)}
                      />
                    </Col>
                    <Col md={12}>
                      <SelectInput
                        label="Shift"
                        name="shiftId"
                        value={selectedShiftId}
                        options={[
                          { label: "Morning Shift", value: "MORNING" },
                          { label: "Evening Shift", value: "EVENING" }
                        ]}
                        required
                        defaultOptionLabel="Select Shift"
                        onChange={(e) => setSelectedShiftId(e.target.value)}
                      />
                    </Col>
                    <Col md={12}>
                      <TextInput
                        label="Operator Name / ID"
                        name="operatorName"
                        value={operatorName}
                        required
                        placeholder="Enter your name"
                        onChange={(e) => setOperatorName(e.target.value)}
                      />
                    </Col>
                    <Col md={12} className="text-center mt-4">
                      <Button variant="primary" type="submit" className="w-100 py-2 fw-semibold rounded-3">
                        Initialize Operator Board
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Card>
            </Col>
          </Row>
        ) : (
          /* Active Console Session */
          <Row className="g-4">
            {/* Left Column: Active Order Details & Status Toggles */}
            <Col lg={4} md={12}>
              <Card className="border-0 shadow-sm rounded-3 p-4 mb-4">
                <h5 className="fw-bold mb-3 text-dark border-bottom pb-2">Console Session</h5>
                <div className="small mb-3">
                  <strong>Operator:</strong> {operatorName}<br />
                  <strong>Machine:</strong> {machines.find(m => m.machineId === selectedMachineId)?.machineName}<br />
                  <strong>Shift:</strong> {selectedShiftId === "MORNING" ? "Morning Shift" : "Evening Shift"}
                </div>

                <SelectInput
                  label="Select Production Order"
                  name="activeOrderId"
                  value={activeOrderId}
                  options={availableOrders.map(po => ({ 
                    label: `${po.productionOrderId} (${po.productItem?.productName})`, 
                    value: po.productionOrderId || ""
                  }))}
                  onChange={(e) => setActiveOrderId(e.target.value)}
                />

                {activeOrder ? (
                  <div className="mt-4">
                    <div className="p-3 bg-light rounded-3 mb-4">
                      <h6 className="fw-bold text-primary mb-2">Order Information</h6>
                      <div className="small">
                        <strong>Product:</strong> {activeOrder.productItem?.productName}<br />
                        <strong>Planned Target:</strong> {activeOrder.targetQty} {activeOrder.uom}<br />
                        <strong>Expected Run Hours:</strong> 8 Hrs<br />
                        <strong>Hourly Target:</strong> {hourlyTarget} {activeOrder.uom}/Hr<br />
                        <strong>Setup Time:</strong> N/A
                      </div>
                    </div>

                    <h6 className="fw-bold text-dark mb-3">Shift Status Controls</h6>
                    <div className="d-flex flex-column gap-2">
                      <Button 
                        variant={activeOrder.status === "IN PROGRESS" ? "primary" : "outline-primary"}
                        onClick={() => handleStatusChange("IN PROGRESS")}
                        className="d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold"
                        disabled={activeOrder.status === "IN PROGRESS"}
                      >
                        <FaPlay size={14} /> Start Shift / Resume
                      </Button>
                      <Button 
                        variant={activeOrder.status === "POST_PRODUCTION" ? "success" : "outline-success"}
                        onClick={() => handleStatusChange("POST_PRODUCTION")}
                        className="d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold"
                        disabled={activeOrder.status === "POST_PRODUCTION" || activeOrder.status === "COMPLETED"}
                      >
                        <FaCheck size={14} /> Complete Shift / Finish
                      </Button>
                      <Button 
                        variant={activeOrder.status === "CANCELLED" ? "danger" : "outline-danger"}
                        onClick={() => handleStatusChange("CANCELLED")}
                        className="d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold"
                        disabled={activeOrder.status === "CANCELLED"}
                      >
                        <FaStop size={14} /> Stop / Stoppage
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning mt-4 py-3 text-center small">
                    No active production order loaded for this machine shift slot. Please select or schedule one.
                  </div>
                )}
              </Card>

              {/* Shift OEE Gauge Panel */}
              {activeOrder && (
                <Card className="border-0 shadow-sm rounded-3 p-4">
                  <h5 className="fw-bold mb-3 text-dark border-bottom pb-2 d-flex align-items-center gap-2">
                    <FaCalculator className="text-secondary" />
                    <span>Real-time Shift OEE</span>
                  </h5>
                  <div className="text-center py-3">
                    <div className="display-4 fw-bold text-primary font-monospace">{analytics.oee}%</div>
                    <div className="text-uppercase small text-muted fw-bold tracking-wider">Overall Shift OEE</div>
                  </div>

                  <hr />

                  <div className="d-flex flex-column gap-2 mt-2">
                    <div className="d-flex justify-content-between align-items-center small">
                      <span className="text-muted">Machine Availability:</span>
                      <span className="fw-bold text-dark">{analytics.availability}%</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center small">
                      <span className="text-muted">Production Performance:</span>
                      <span className="fw-bold text-dark">{analytics.performance}%</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center small">
                      <span className="text-muted">Quality Index:</span>
                      <span className="fw-bold text-dark">{analytics.quality}%</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center small border-top pt-2 mt-1">
                      <span className="text-muted">Total Downtime Minutes:</span>
                      <span className="badge bg-danger">{analytics.totalDowntime} Min</span>
                    </div>
                  </div>
                </Card>
              )}
            </Col>

            {/* Right Column: Hourly Production Logs & Downtime Logs */}
            <Col lg={8} md={12}>
              {activeOrder ? (
                <>
                  {/* Hourly Entry Panel */}
                  <Card className="border-0 shadow-sm rounded-3 p-4 mb-4">
                    <Card.Header className="bg-white border-0 p-0 mb-3 d-flex justify-content-between align-items-center">
                      <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                        <FaClipboardList className="text-primary" />
                        <span>Hourly Production Log</span>
                      </h5>
                      <div className="d-flex align-items-center gap-2">
                        {supervisorMode ? (
                          <Badge bg="success" className="d-flex align-items-center gap-1 p-2 cursor-pointer" onClick={() => setSupervisorMode(false)}>
                            <FaUnlock /> Supervisor Unlocked
                          </Badge>
                        ) : (
                          <Button variant="outline-secondary" size="sm" className="d-flex align-items-center gap-1 px-2 py-1 rounded-3" onClick={() => setShowSupervisorModal(true)}>
                            <FaLock /> Supervisor Override
                          </Button>
                        )}
                        
                        <div className="small text-muted font-monospace border rounded px-2 py-1 bg-light">
                          Active Hour: 
                          <select 
                            value={activeHourIndex} 
                            onChange={(e) => setActiveHourIndex(Number(e.target.value))}
                            className="border-0 bg-transparent fw-bold"
                          >
                            {[1,2,3,4,5,6,7,8].map(h => (
                              <option key={h} value={h}>Hour {h}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </Card.Header>

                    <div className="table-responsive">
                      <Table bordered hover className="align-middle text-center mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: "80px" }}>Hour</th>
                            <th>Target Qty</th>
                            <th>Actual Qty</th>
                            <th>Reject Qty</th>
                            <th>Scrap Qty</th>
                            <th style={{ width: "90px" }}>Save</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((hour) => {
                            const isEditable = supervisorMode || hour === activeHourIndex;
                            const input = hourlyInputs[hour] || { actual: "", reject: "", scrap: "" };

                            return (
                              <tr key={hour} className={hour === activeHourIndex ? "table-primary" : ""}>
                                <td className="fw-bold font-monospace">H-{hour}</td>
                                <td className="font-monospace text-secondary fw-semibold">
                                  {hourlyTarget} {activeOrder.uom}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm text-center font-monospace"
                                    placeholder="0"
                                    value={input.actual}
                                    disabled={!isEditable}
                                    onChange={(e) => handleInputChange(hour, "actual", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm text-center font-monospace"
                                    placeholder="0"
                                    value={input.reject}
                                    disabled={!isEditable}
                                    onChange={(e) => handleInputChange(hour, "reject", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm text-center font-monospace"
                                    placeholder="0"
                                    value={input.scrap}
                                    disabled={!isEditable}
                                    onChange={(e) => handleInputChange(hour, "scrap", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <Button 
                                    variant={isEditable ? "success" : "light"}
                                    size="sm" 
                                    disabled={!isEditable}
                                    onClick={() => handleSaveHourlyRow(hour)}
                                    className="px-3"
                                  >
                                    Save
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                  </Card>

                  {/* Downtime Logs Panel */}
                  <Card className="border-0 shadow-sm rounded-3 p-4">
                    <Card.Header className="bg-white border-0 p-0 mb-3 d-flex justify-content-between align-items-center">
                      <h5 className="fw-bold mb-0 text-danger d-flex align-items-center gap-2">
                        <FaClock />
                        <span>Machine Stoppage & Downtime Logs</span>
                      </h5>
                      <Button variant="danger" size="sm" className="d-flex align-items-center gap-1 rounded-3 px-3 py-1 fw-semibold" onClick={() => setShowDowntimeModal(true)}>
                        <FaPlus /> Log Stoppage
                      </Button>
                    </Card.Header>

                    <div className="table-responsive">
                      <Table hover className="align-middle text-center mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Downtime Reason</th>
                            <th>Start Time</th>
                            <th>End Time</th>
                            <th>Duration</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {downtimeLogs.length > 0 ? (
                            downtimeLogs.map((log) => (
                              <tr key={log.id}>
                                <td className="fw-bold text-start ps-3 text-danger">{log.reason}</td>
                                <td className="font-monospace text-secondary" style={{ fontSize: "12px" }}>
                                  {new Date(log.startTime).toLocaleString()}
                                </td>
                                <td className="font-monospace text-secondary" style={{ fontSize: "12px" }}>
                                  {new Date(log.endTime).toLocaleString()}
                                </td>
                                <td className="fw-bold text-dark font-monospace">{log.durationMinutes} Min</td>
                                <td>
                                  <Button variant="link" className="text-danger p-0 border-0" onClick={() => handleDeleteDowntime(log.id)}>
                                    <FaTrash size={12} />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="text-center py-4 text-muted small">
                                No machine stoppages logged for this shift. High efficiency!
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </Card>
                </>
              ) : (
                <div className="alert alert-info py-5 text-center shadow-sm rounded-3 border-0 bg-white">
                  <FaClipboardList className="mb-3 text-secondary" size={45} />
                  <h5>Awaiting active Production Order selection</h5>
                  <p className="extra-small">Please select a Production Order in the side panel to view execution grids and logs.</p>
                </div>
              )}
            </Col>
          </Row>
        )}
      </Container>

      {/* Supervisor Verification Modal */}
      <Modal show={showSupervisorModal} onHide={() => setShowSupervisorModal(false)} centered size="sm">
        <form onSubmit={handleSupervisorVerify}>
          <Modal.Header closeButton>
            <Modal.Title className="fw-bold text-dark" style={{ fontSize: "16px" }}>Supervisor Authorization</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label className="small">Enter Supervisor Passcode</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter passcode (Hint: 1234)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                className="text-center font-monospace"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="justify-content-center p-2">
            <Button variant="secondary" size="sm" onClick={() => setShowSupervisorModal(false)}>Cancel</Button>
            <Button variant="success" size="sm" type="submit">Unlock Console</Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Add Downtime Modal */}
      <Modal show={showDowntimeModal} onHide={() => setShowDowntimeModal(false)} centered>
        <form onSubmit={handleAddDowntime}>
          <Modal.Header closeButton>
            <Modal.Title className="fw-bold text-danger">Log Machine Downtime Stoppage</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3">
              <Col md={12}>
                <SelectInput
                  label="Downtime Reason"
                  name="downtimeReason"
                  value={downtimeReason}
                  options={[
                    { label: "Breakdown (Mechanical/Electrical)", value: "Breakdown" },
                    { label: "Mold Change", value: "Mold Change" },
                    { label: "Material Shortage", value: "Material Shortage" },
                    { label: "Power Failure", value: "Power Failure" },
                    { label: "Quality Issue (Inspection delay)", value: "Quality Issue" },
                    { label: "Operator Absence", value: "Operator Absence" }
                  ]}
                  required
                  onChange={(e) => setDowntimeReason(e.target.value)}
                />
              </Col>
              <Col md={6}>
                <TextInput
                  label="Stoppage Start Time"
                  name="downtimeStart"
                  type="datetime-local"
                  value={downtimeStart}
                  required
                  onChange={(e) => setDowntimeStart(e.target.value)}
                />
              </Col>
              <Col md={6}>
                <TextInput
                  label="Stoppage End Time"
                  name="downtimeEnd"
                  type="datetime-local"
                  value={downtimeEnd}
                  required
                  onChange={(e) => setDowntimeEnd(e.target.value)}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDowntimeModal(false)}>Cancel</Button>
            <Button variant="danger" type="submit">Log Stoppage</Button>
          </Modal.Footer>
        </form>
      </Modal>
    </div>
  );
};

export default ShiftExecutionBoard;
