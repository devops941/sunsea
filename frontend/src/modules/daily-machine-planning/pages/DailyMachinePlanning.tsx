import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Row, Col, Card, Spinner, Modal, Button, Form, Table, ProgressBar } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import { productionOrderService } from "../../../services/productionOrderService";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import apiClient from "../../../api/apiClient";
import config from "../../../api/config";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CustomButton from "../../../components/ui/Button/Button";
import IconButton from "../../../components/ui/IconButton/IconButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StartProductionModal from "../../../components/ui/StartProductionModal/StartProductionModal";
import CustomProgressBar from "../../../components/common/CustomProgressBar";
import { FaPlay, FaStop, FaClipboardList, FaPlus, FaCalendarAlt, FaIndustry, FaSearch } from "react-icons/fa";

const normalizePriority = (pri?: string): "LOW" | "MEDIUM" | "HIGH" | "URGENT" => {
  if (!pri) return "MEDIUM";
  const upper = pri.toUpperCase();
  if (upper === "LOW") return "LOW";
  if (upper === "MEDIUM" || upper === "NORMAL") return "MEDIUM";
  if (upper === "HIGH") return "HIGH";
  if (upper === "URGENT") return "URGENT";
  return "MEDIUM";
};

// Helper to filter out placeholder priority values
const getDisplayPriority = (priority?: string): "LOW" | "MEDIUM" | "HIGH" | "URGENT" => {
  const p = (priority || "").toUpperCase();
  if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(p)) {
    return p as any;
  }
  return "MEDIUM";
};

// Helper to get current week's Monday (UTC-safe)
const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
  return monday;
};

// Formats a Date object as YYYY-MM-DD in UTC
const formatDateString = (d: Date) => {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Formats a Date object as YYYY-MM-DD in Local time
const formatLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DailyMachinePlanning: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Redux state
  const { data: machines, loading: loadingMachines } = useAppSelector((state) => state.machines);

  // Local state
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(getMonday(new Date()));
  const [weeklyPrograms, setWeeklyPrograms] = useState<any[]>([]);
  const [loadingPlanning, setLoadingPlanning] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(formatLocalDateString(new Date()));

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Active production orders (for adding a run)
  const [activeProductionOrders, setActiveProductionOrders] = useState<any[]>([]);

  // Modals state
  const [showAddRunModal, setShowAddRunModal] = useState(false);
  const [newRunPoId, setNewRunPoId] = useState("");
  const [newRunPlannedQty, setNewRunPlannedQty] = useState("");
  const [newRunPriority, setNewRunPriority] = useState("MEDIUM");

  const [showStartModal, setShowStartModal] = useState(false);
  const [programToStart, setProgramToStart] = useState<any>(null);

  const [showViewModal, setShowViewModal] = useState(false);
  const [programToView, setProgramToView] = useState<any>(null);

  // Confirmation Modals State
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopProgram, setStopProgram] = useState<any | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteProgramId, setDeleteProgramId] = useState<string | null>(null);

  // Sync date input to Week Monday
  useEffect(() => {
    if (selectedDate) {
      const parsed = new Date(selectedDate);
      if (!isNaN(parsed.getTime())) {
        const newMonday = getMonday(parsed);
        if (newMonday.getTime() !== currentWeekMonday.getTime()) {
          setCurrentWeekMonday(newMonday);
        }
      }
    }
  }, [selectedDate, currentWeekMonday]);

  useEffect(() => {
    dispatch(fetchMachines());
  }, [dispatch]);

  // Load weekly programs for selected week
  const fetchWeeklyPrograms = useCallback(async () => {
    setLoadingPlanning(true);
    try {
      const res = await weeklyProgramService.getAll({
        weekStartDate: formatDateString(currentWeekMonday)
      });
      const programList = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      setWeeklyPrograms(programList);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to load weekly program runs");
    } finally {
      setLoadingPlanning(false);
    }
  }, [currentWeekMonday]);

  useEffect(() => {
    fetchWeeklyPrograms();
  }, [fetchWeeklyPrograms]);

  // Filter programs based on Search Term and Status Filter
  const filteredPrograms = useMemo(() => {
    let list = weeklyPrograms;
    if (statusFilter) {
      list = list.filter(p => p.status === statusFilter);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(p => 
        p.productionOrderId?.toLowerCase().includes(lower) ||
        p.productionOrder?.productItem?.productName?.toLowerCase().includes(lower) ||
        p.machine?.machineName?.toLowerCase().includes(lower) ||
        p.machineId?.toLowerCase().includes(lower)
      );
    }
    return list;
  }, [weeklyPrograms, statusFilter, searchTerm]);

  // Load active orders for selection
  const loadActiveOrders = async () => {
    try {
      const res = await productionOrderService.fetchAll({ limit: 1000 } as any);
      const list = res.data || res || [];
      const poList = Array.isArray(list) ? list : (list.data || []);
      
      const activeList = poList.filter((po: any) =>
        ["RM_AVAILABLE", "READY_FOR_PLANNING", "SCHEDULE_DELETED", "NOT_STARTED", "PARTIALLY_PLANNED"].includes(po.status)
      );
      setActiveProductionOrders(activeList);
    } catch (err) {
      console.error("Failed to load active orders", err);
    }
  };

  // Exclude MAC-001 from machine dropdown choices
  const allowedMachines = useMemo(() => {
    if (!machines) return [];
    return machines.filter((m: any) => m.machineId !== "MAC-001");
  }, [machines]);

  // Format week range text for header
  const weekRangeText = useMemo(() => {
    const start = new Date(currentWeekMonday);
    const end = new Date(currentWeekMonday);
    end.setDate(start.getDate() + 6);
    const options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
    return `${start.toLocaleDateString("en-IN", options)} - ${end.toLocaleDateString("en-IN", options)}`;
  }, [currentWeekMonday]);

  // Add Production Run handlers
  const handleOpenAddRun = () => {
    setNewRunPoId("");
    setNewRunPlannedQty("");
    setNewRunPriority("MEDIUM");
    loadActiveOrders();
    setShowAddRunModal(true);
  };

  const handleSaveNewRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRunPoId || !newRunPlannedQty) {
      toast.error("Please select a Production Order and enter planned quantity");
      return;
    }

    try {
      const nextId = await weeklyProgramService.fetchNextId();
      const po = activeProductionOrders.find(o => o.productionOrderId === newRunPoId);
      
      const weekStartStr = formatDateString(currentWeekMonday);
      const weekEnd = new Date(currentWeekMonday);
      weekEnd.setDate(currentWeekMonday.getDate() + 6);
      const weekEndStr = formatDateString(weekEnd);

      const payload = {
        weeklyProgramId: nextId,
        productionOrderId: newRunPoId,
        weekStartDate: weekStartStr,
        weekEndDate: weekEndStr,
        machineId: null, // Machine and shift will be chosen on start
        shiftId: null,
        dayOfWeek: currentWeekMonday.getDay() === 0 ? 7 : currentWeekMonday.getDay(), // Map Sunday (0) to 7
        plannedQty: Number(newRunPlannedQty),
        plannedHours: 8,
        setupHours: 0,
        sequenceNo: 1,
        priority: normalizePriority(po?.priority || newRunPriority),
        status: "PLANNED",
        remarks: "Scheduled run"
      };

      await weeklyProgramService.create(payload);
      toast.success("Run scheduled successfully! Click Start to choose machine and start production.");
      setShowAddRunModal(false);
      fetchWeeklyPrograms();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to schedule run");
    }
  };

  // Start Run handlers
  const handleOpenStart = (program: any) => {
    setProgramToStart(program);
    setShowStartModal(true);
  };

  const confirmStartRun = async (selectedMachineId: string, selectedShiftId: string) => {
    if (!programToStart || !selectedMachineId || !selectedShiftId) {
      toast.error("Please select both a machine and a shift to run production on.");
      return;
    }

    try {
      const today = new Date();
      const todayStartMonday = getMonday(today);
      
      // 1. Update program to IN_PROGRESS and assign selected machine and shift
      await weeklyProgramService.update(programToStart.weeklyProgramId, {
        machineId: selectedMachineId,
        shiftId: selectedShiftId,
        status: "IN_PROGRESS",
        weekStartDate: formatDateString(todayStartMonday),
        dayOfWeek: today.getDay() === 0 ? 7 : today.getDay()
      });

      // 2. Log SYSTEM_START in hourly production to start tracking
      const todayStr = formatLocalDateString(new Date());
      const payload = {
        productionOrderId: programToStart.productionOrderId,
        productionDate: todayStr,
        shiftId: selectedShiftId,
        machineId: selectedMachineId,
        hourIndex: 0,
        qtyProduced: 0,
        rejectQty: 0,
        scrapQty: 0,
        downtime: 0,
        remarks: "SYSTEM_START",
        operatorId: "SYSTEM"
      };

      await apiClient.post(config.hourlyProduction.base, payload);
      toast.success(`Production run started on machine ${selectedMachineId}!`);
      setShowStartModal(false);
      setProgramToStart(null);
      fetchWeeklyPrograms();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to start production run");
    }
  };

  // Stop Run handler
  const confirmStopRun = async () => {
    if (!stopProgram) return;
    try {
      const producedQty = Number(stopProgram.productionOrder?.producedQty || 0);
      const plannedQty = Number(stopProgram.plannedQty || 0);
      const targetQty = Number(stopProgram.productionOrder?.targetQty || 0);
      
      // If the overall PO target is met, or the scheduled plannedQty is met, mark as COMPLETED.
      // Otherwise, put it back to PLANNED so it can be resumed later.
      const newStatus = (producedQty >= plannedQty || producedQty >= targetQty) ? "COMPLETED" : "PLANNED";

      await weeklyProgramService.update(stopProgram.weeklyProgramId, {
        status: newStatus
      });
      toast.success(`Production run stopped! Status updated to ${newStatus}.`);
      setShowStopModal(false);
      setStopProgram(null);
      fetchWeeklyPrograms();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to stop production run");
    }
  };

  // Delete Run handler
  const confirmDeleteRun = async () => {
    if (!deleteProgramId) return;
    try {
      await weeklyProgramService.delete(deleteProgramId);
      toast.success("Scheduled run removed from the week.");
      setShowDeleteModal(false);
      setDeleteProgramId(null);
      fetchWeeklyPrograms();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete schedule");
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = weeklyPrograms.length;
    const running = weeklyPrograms.filter(p => p.status === "IN_PROGRESS").length;
    const completed = weeklyPrograms.filter(p => p.status === "COMPLETED").length;
    const target = weeklyPrograms.reduce((acc, p) => acc + Number(p.plannedQty || 0), 0);
    return { total, running, completed, target };
  }, [weeklyPrograms]);

  return (
    <div className="inner-container">
      <Container fluid>
        {/* Page Header */}
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={5} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Daily Machine Planning</h2>
                <div className="page-breadcrumb">Home / Production / Daily Planning</div>
              </div>
            </Col>
            <Col lg={7} md={12}>
              <div className="page-header-actions d-flex align-items-center justify-content-end gap-2 flex-wrap">
                {/* Week Selection Display */}
                <div className="d-flex align-items-center bg-white border px-3 py-2 rounded shadow-sm text-secondary small fw-medium" style={{ height: "42px" }}>
                  <FaCalendarAlt className="me-2" style={{ color: "var(--color-primary, #003428)" }} />
                  Week Range: <span className="ms-1 fw-bold text-dark">{weekRangeText}</span>
                </div>

                {/* Datepicker Selector */}
                <div style={{ width: "160px" }}>
                  <TextInput
                    label=""
                    name="filterDate"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                {/* Add Run Button */}
                <CustomButton 
                  text="Add Production Run"
                  icon={FaPlus}
                  onClick={handleOpenAddRun}
                />
              </div>
            </Col>
          </Row>
        </div>

        {/* Operational Stats Cards */}
        <Row className="g-3 mb-4">
          <Col xl={3} sm={6}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="d-flex align-items-center p-3">
                <div className="p-3 rounded-circle bg-light text-primary me-3">
                  <FaCalendarAlt size={20} style={{ color: "var(--color-primary, #003428)" }} />
                </div>
                <div>
                  <h6 className="text-muted small text-uppercase mb-1 fw-bold">Scheduled Runs</h6>
                  <h4 className="mb-0 fw-extrabold text-dark">{stats.total}</h4>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} sm={6}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="d-flex align-items-center p-3">
                <div className="p-3 rounded-circle bg-success bg-opacity-10 text-success me-3">
                  <FaPlay size={20} />
                </div>
                <div>
                  <h6 className="text-muted small text-uppercase mb-1 fw-bold">Running Now</h6>
                  <h4 className="mb-0 fw-extrabold text-success">{stats.running}</h4>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} sm={6}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="d-flex align-items-center p-3">
                <div className="p-3 rounded-circle bg-secondary bg-opacity-10 text-secondary me-3">
                  <FaStop size={20} />
                </div>
                <div>
                  <h6 className="text-muted small text-uppercase mb-1 fw-bold">Completed Runs</h6>
                  <h4 className="mb-0 fw-extrabold text-muted">{stats.completed}</h4>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} sm={6}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="d-flex align-items-center p-3">
                <div className="p-3 rounded-circle bg-warning bg-opacity-10 text-warning me-3">
                  <FaIndustry size={20} style={{ color: "var(--color-secondary, #CB7A21)" }} />
                </div>
                <div>
                  <h6 className="text-muted small text-uppercase mb-1 fw-bold">Weekly Target Run</h6>
                  <h4 className="mb-0 fw-extrabold text-dark">{stats.target.toLocaleString()} pcs</h4>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Production Runs Schedule List */}
        <Card className="border-0 shadow-sm rounded-3 mb-4">
          <Card.Body className="p-0">
            {loadingPlanning || loadingMachines ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3 text-muted">Loading production runs...</p>
              </div>
            ) : filteredPrograms.length > 0 ? (
              <div className="table-responsive">
                 <table className="master-data-table mb-0" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "60px" }}>#</th>
                      <th>PRODUCTION ORDER</th>
                      <th>PRODUCT NAME</th>
                      <th>TARGET QTY</th>
                      <th>PRODUCED QTY</th>
                      <th style={{ width: "200px" }}>PROGRESS</th>
                      <th>MACHINE</th>
                      <th>STATUS</th>
                      <th style={{ width: "160px", textAlign: "right" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrograms.map((prog, idx) => {
                      const po = prog.productionOrder;
                      const target = Number(prog.plannedQty || po?.targetQty || 0);
                      const produced = Number(po?.producedQty || 0);
                      const progressPercent = Math.min(100, Math.max(0, target > 0 ? Math.round((produced / target) * 100) : 0));
                      const displayPriority = getDisplayPriority(po?.priority);
                      
                      const isPaused = prog.status === "PLANNED" && produced > 0;
                      const displayStatus = isPaused ? "ON_HOLD" : prog.status;

                      return (
                        <tr key={prog.weeklyProgramId} className="master-data-row">
                          <td className="master-data-cell">{idx + 1}</td>
                          <td className="master-data-cell fw-bold">
                            {prog.productionOrderId}
                            {po?.priority && (
                              <span className="ms-2">
                                <StatusBadge status={displayPriority} />
                              </span>
                            )}
                          </td>
                          <td className="master-data-cell">{po?.productItem?.productName || "Unknown Product"}</td>
                          <td className="master-data-cell fw-medium">{target} pcs</td>
                          <td className="master-data-cell fw-medium text-success">{produced} pcs</td>
                          <td className="master-data-cell">
                            <CustomProgressBar progressPercent={progressPercent} />
                          </td>
                          <td className="master-data-cell">
                            {prog.status === "PLANNED" && !isPaused ? (
                              <span className="text-muted small italic">Choose on Start</span>
                            ) : (
                              <span className="fw-semibold text-dark">
                                <FaIndustry className="me-1 text-secondary" />
                                {prog.machine?.machineName || prog.machineId || "Choose on Start"}
                              </span>
                            )}
                          </td>
                          <td className="master-data-cell">
                            <StatusBadge status={displayStatus} customText={isPaused ? "Pending" : undefined} />
                          </td>
                          <td className="master-data-cell text-end">
                            <div className="table-action-group justify-content-end">
                              <ViewButton onClick={() => {
                                setProgramToView(prog);
                                setShowViewModal(true);
                              }} />
                              {prog.status === "PLANNED" && (
                                <>
                                  <IconButton
                                    variant="success"
                                    title={isPaused ? "Resume Run" : "Start Run"}
                                    icon={FaPlay}
                                    onClick={() => handleOpenStart(prog)}
                                  />
                                  {!isPaused && (
                                    <DeleteButton 
                                      onClick={() => {
                                        setDeleteProgramId(prog.weeklyProgramId);
                                        setShowDeleteModal(true);
                                      }} 
                                    />
                                  )}
                                </>
                              )}

                              {prog.status === "IN_PROGRESS" && (
                                <>
                                  <IconButton
                                    variant="primary"
                                    title="Log Hourly Production"
                                    icon={FaClipboardList}
                                    onClick={() => navigate("/hourly-work-reports")}
                                  />
                                  <IconButton
                                    variant="danger"
                                    title="Stop / Complete Run"
                                    icon={FaStop}
                                    onClick={() => {
                                      setStopProgram(prog);
                                      setShowStopModal(true);
                                    }}
                                  />
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                 </table>
              </div>
            ) : (
              <div className="text-center py-5">
                <h5 className="text-muted mb-1">No scheduled production runs match your filters.</h5>
                <p className="text-muted small mb-0">Try adjusting your filters or click "Add Production Run" to schedule a new one.</p>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Modal: Add Production Run to Week */}
        <Modal show={showAddRunModal} onHide={() => setShowAddRunModal(false)} centered>
          <Modal.Header closeButton style={{ background: "var(--color-primary, #003428)", color: "#fff" }}>
            <Modal.Title className="fs-5 fw-bold">Schedule Production Run</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSaveNewRun}>
            <Modal.Body>
              <Row className="g-3">
                <Col md={12}>
                  <Form.Group>
                    <Form.Label className="fw-bold small text-muted text-uppercase">Target Week Period</Form.Label>
                    <div className="p-3 bg-light rounded border small fw-medium text-dark">
                      <FaCalendarAlt className="me-2 text-primary" style={{ color: "var(--color-primary, #003428)" }} /> {weekRangeText}
                    </div>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group>
                    <Form.Label className="fw-bold small text-muted text-uppercase">Select Production Order</Form.Label>
                    <Form.Select
                      required
                      value={newRunPoId}
                      onChange={(e) => setNewRunPoId(e.target.value)}
                      style={{ height: "42px", borderRadius: "8px" }}
                    >
                      <option value="">-- Select Production Order --</option>
                      {activeProductionOrders.map((po) => (
                        <option key={po.productionOrderId} value={po.productionOrderId}>
                          {po.productionOrderId} - {po.productItem?.productName} (Qty: {po.targetQty} pcs)
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <TextInput
                    label="Target Run Quantity"
                    name="plannedQty"
                    type="number"
                    required
                    value={newRunPlannedQty}
                    placeholder="e.g. 500"
                    onChange={(e) => setNewRunPlannedQty(e.target.value)}
                  />
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-bold small text-muted text-uppercase">Priority</Form.Label>
                    <Form.Select
                      value={newRunPriority}
                      onChange={(e) => setNewRunPriority(e.target.value)}
                      style={{ height: "42px", borderRadius: "8px" }}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" className="rounded-3" onClick={() => setShowAddRunModal(false)}>
                Cancel
              </Button>
              <Button type="submit" style={{ backgroundColor: "var(--color-primary, #003428)", borderColor: "var(--color-primary, #003428)" }} className="rounded-3 px-4 text-white">
                Schedule Run
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Reusable Modal: Start Production Run */}
        <StartProductionModal
          show={showStartModal}
          onHide={() => setShowStartModal(false)}
          onConfirm={confirmStartRun}
          program={programToStart}
          allowedMachines={allowedMachines}
        />

        {/* Reusable Confirmation Modal: Stop Run */}
        <CommonConfirmModal
          show={showStopModal}
          onHide={() => {
            setShowStopModal(false);
            setStopProgram(null);
          }}
          onConfirm={confirmStopRun}
          title="Stop Production Run"
          message={`Are you sure you want to stop the run for PO ${stopProgram?.productionOrderId}? ${
            Number(stopProgram?.productionOrder?.producedQty || 0) >= Number(stopProgram?.plannedQty || 0) 
              ? "The quantity has been met, so it will be marked as Completed." 
              : "The quantity has NOT been met, so it will be Paused (set back to Planned) so you can resume it later."
          }`}
          confirmText="Yes, Stop Run"
          confirmVariant="danger"
        />

        {/* View Modal */}
        <CommonViewModal
          show={showViewModal}
          onHide={() => {
            setShowViewModal(false);
            setProgramToView(null);
          }}
          modalTitle="Production Run Details"
          headerTitle={programToView?.productionOrderId || "Unknown PO"}
          headerSubtitle={`Product: ${programToView?.productionOrder?.productItem?.productName || "Unknown"}`}
          statusNode={<StatusBadge status={programToView?.status} />}
          sections={[
            {
              title: "Planning Details",
              fields: [
                { label: "Target Quantity", value: `${programToView?.plannedQty || 0} pcs` },
                { label: "Produced Quantity", value: `${programToView?.productionOrder?.producedQty || 0} pcs` },
                { label: "Machine Assigned", value: programToView?.machine?.machineName || programToView?.machineId || "Not Assigned" },
                { label: "Shift", value: programToView?.shift?.shiftName || programToView?.shiftId || "Not Assigned" },
              ]
            },
            {
              title: "Scheduling Info",
              fields: [
                { label: "Week Start", value: programToView?.weekStartDate },
                { label: "Day of Week", value: programToView?.dayOfWeek },
                { label: "Priority", value: programToView?.priority || "Normal" },
              ]
            }
          ]}
        />

        {/* Reusable Confirmation Modal: Delete Run */}
        <CommonConfirmModal
          show={showDeleteModal}
          onHide={() => {
            setShowDeleteModal(false);
            setDeleteProgramId(null);
          }}
          onConfirm={confirmDeleteRun}
          title="Remove Scheduled Run"
          message="Are you sure you want to remove this scheduled run from the weekly program schedule?"
          confirmText="Remove Run"
          confirmVariant="danger"
        />
      </Container>
    </div>
  );
};

export default DailyMachinePlanning;
