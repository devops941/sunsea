import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Row, Col, Card, Alert, Spinner } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft, FaInfoCircle, FaCheckCircle } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/custombutton/CustomButton";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createHourlyProduction, updateHourlyProduction } from "../../../features/hourly-productions/hourlyProductionSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import apiClient from "../../../api/apiClient";
import config from "../../../api/config";

// Helper to get current week's Monday (UTC-safe)
const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getUTCDay();
    const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
    return monday;
};

const formatDateString = (d: Date) => {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const HourlyWorkReportCreate: React.FC = () => {
    const navigate = useNavigate();
    const locationState = useLocation();
    const dispatch = useAppDispatch();

    // Redux State
    const { data: machines } = useAppSelector((state) => state.machines);
    const { data: shifts } = useAppSelector((state: any) => state.shifts || { data: [] });

    // State for selectors
    const [machineId, setMachineId] = useState("");
    const [productionDate, setProductionDate] = useState(formatLocalDateString(new Date()));
    const [shiftId, setShiftId] = useState("");
    const [editingLogId, setEditingLogId] = useState<string | null>(null);

    // State for hourly log fields
    const [hourIndex, setHourIndex] = useState("1");
    const [qtyProduced, setQtyProduced] = useState("");
    const [rejectQty, setRejectQty] = useState("0");
    const [scrapQty, setScrapQty] = useState("0");
    const [downtime, setDowntime] = useState("0");
    const [remarks, setRemarks] = useState("");
    const [operatorId, setOperatorId] = useState("");

    // Auto-loaded plan details
    const [activePlan, setActivePlan] = useState<any>(null);
    const [loadingPlan, setLoadingPlan] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Is the form pre-filled from Daily Planning?
    const isPreFilled = useMemo(() => {
        return !!(locationState.state && locationState.state.productionOrderId);
    }, [locationState.state]);

    useEffect(() => {
        dispatch(fetchMachines());
        dispatch(fetchShifts());
    }, [dispatch]);

    // Handle pre-filled state
    useEffect(() => {
        if (locationState.state && locationState.state.productionOrderId) {
            const s = locationState.state;
            setMachineId(s.machineId || "");
            setProductionDate(s.productionDate || formatLocalDateString(new Date()));
            setShiftId(s.shiftId || "");
            setActivePlan({
                productionOrderId: s.productionOrderId,
                productName: s.productName,
                productCode: s.productCode,
                plannedQty: s.plannedQty,
            });
            if (s.hourIndex) {
                setHourIndex(String(s.hourIndex));
            }
            if (s.editingLogId) {
                setEditingLogId(s.editingLogId);
                setHourIndex(s.hourIndex || "1");
                setQtyProduced(s.qtyProduced || "");
                setRejectQty(s.rejectQty || "0");
                setScrapQty(s.scrapQty || "0");
                setDowntime(s.downtime || "0");
                setRemarks(s.remarks || "");
                setOperatorId(s.operatorId || "");
            }
        }
    }, [locationState.state]);

    // State for existing logs to prevent duplicates and enable editing
    const [existingLogs, setExistingLogs] = useState<any[]>([]);

    const fetchExistingLogs = useCallback(async () => {
        if (!machineId || !productionDate || !shiftId) {
            setExistingLogs([]);
            return;
        }
        try {
            const response = await apiClient.get(config.hourlyProduction.base, {
                params: {
                    machineId,
                    shiftId,
                    productionDate
                }
            });
            if (response.data?.success) {
                setExistingLogs(response.data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch existing hourly logs", err);
        }
    }, [machineId, productionDate, shiftId]);

    useEffect(() => {
        fetchExistingLogs();
    }, [fetchExistingLogs]);

    // Track chosen hour index to load/edit existing production values
    useEffect(() => {
        const matched = existingLogs.find(log => Number(log.hourIndex) === Number(hourIndex));
        if (matched) {
            setQtyProduced(String(matched.qtyProduced));
            setRejectQty(String(matched.rejectQty || 0));
            setScrapQty(String(matched.scrapQty || 0));
            setDowntime(String(matched.downtime || 0));
            setRemarks(matched.remarks || "");
            setOperatorId(matched.operatorId || "");
            setEditingLogId(matched.hourlyProductionId);
        } else {
            setQtyProduced("");
            setRejectQty("0");
            setScrapQty("0");
            setDowntime("0");
            setRemarks("");
            setOperatorId("");
            setEditingLogId(null);
        }
    }, [hourIndex, existingLogs]);

    // Shift timing for hour slots generation
    const shiftTiming = useMemo(() => {
        if (locationState.state?.startTime && locationState.state?.endTime) {
            return {
                startTime: locationState.state.startTime,
                endTime: locationState.state.endTime
            };
        }
        const selectedShift = shifts.find((s: any) => s.shiftCode === shiftId);
        if (selectedShift) {
            return {
                startTime: selectedShift.startTime,
                endTime: selectedShift.endTime
            };
        }
        return null;
    }, [locationState.state, shifts, shiftId]);

    const hourOptions = useMemo(() => {
        if (!shiftTiming?.startTime || !shiftTiming?.endTime) {
            return Array.from({ length: 24 }, (_, i) => ({
                label: `Hour ${i + 1}`,
                value: String(i + 1)
            }));
        }

        const [startH, startM] = shiftTiming.startTime.split(":").map(Number);
        const [endH, endM] = shiftTiming.endTime.split(":").map(Number);

        let startMinutes = startH * 60 + startM;
        let endMinutes = endH * 60 + endM;

        if (endMinutes <= startMinutes) {
            endMinutes += 24 * 60;
        }

        const totalMinutes = endMinutes - startMinutes;
        const hours = Math.floor(totalMinutes / 60);

        return Array.from({ length: hours }, (_, i) => {
            const slotStartMin = startMinutes + i * 60;
            const slotEndMin = slotStartMin + 60;

            const startHourStr = String(Math.floor((slotStartMin % (24 * 60)) / 60)).padStart(2, "0");
            const startMinStr = String((slotStartMin % 60)).padStart(2, "0");

            const endHourStr = String(Math.floor((slotEndMin % (24 * 60)) / 60)).padStart(2, "0");
            const endMinStr = String((slotEndMin % 60)).padStart(2, "0");

            return {
                label: `Hour ${i + 1} (${startHourStr}:${startMinStr} - ${endHourStr}:${endMinStr})`,
                value: String(i + 1)
            };
        });
    }, [shiftTiming]);

    // Fetch matching plan dynamically if selectors change (and not pre-filled)
    useEffect(() => {
        if (isPreFilled || !machineId || !productionDate || !shiftId) return;

        const fetchMatchingPlan = async () => {
            setLoadingPlan(true);
            try {
                const [yyyy, mm, dd] = productionDate.split("-").map(Number);
                const parsedDate = new Date(Date.UTC(yyyy, mm - 1, dd));
                const monday = getMonday(parsedDate);
                const dayOfWeek = parsedDate.getUTCDay();
                const normalizedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

                const response = await weeklyProgramService.getDailyPlanningData({
                    machineId,
                    weekStartDate: formatDateString(monday),
                });

                const matchedDay = response.days.find((d: any) => d.dayOfWeek === normalizedDayOfWeek);
                const matchedShift = matchedDay?.shifts.find((s: any) => s.shiftId === shiftId);
                const matchedProgram = matchedShift?.programs?.[0];

                if (matchedProgram) {
                    setActivePlan(matchedProgram);
                } else {
                    setActivePlan(null);
                    toast.warning("No weekly machine schedule exists for this machine, date, and shift");
                }
            } catch (err: any) {
                console.error("Failed to load plan", err);
                setActivePlan(null);
            } finally {
                setLoadingPlan(false);
            }
        };

        fetchMatchingPlan();
    }, [machineId, productionDate, shiftId, isPreFilled]);

    // Fetch produced qty dynamically if pre-filled
    useEffect(() => {
        if (!isPreFilled || !machineId || !productionDate || !shiftId || !activePlan?.productionOrderId) return;

        const fetchProducedQty = async () => {
            try {
                const [yyyy, mm, dd] = productionDate.split("-").map(Number);
                const parsedDate = new Date(Date.UTC(yyyy, mm - 1, dd));
                const monday = getMonday(parsedDate);
                const dayOfWeek = parsedDate.getUTCDay();
                const normalizedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

                const response = await weeklyProgramService.getDailyPlanningData({
                    machineId,
                    weekStartDate: formatDateString(monday),
                });

                const matchedDay = response.days.find((d: any) => d.dayOfWeek === normalizedDayOfWeek);
                const matchedShift = matchedDay?.shifts.find((s: any) => s.shiftId === shiftId);
                const matchedProgram = matchedShift?.programs.find((p: any) => p.productionOrderId === activePlan.productionOrderId);

                if (matchedProgram) {
                    setActivePlan(matchedProgram);
                }
            } catch (err) {
                console.error("Failed to sync produced quantity", err);
            }
        };

        fetchProducedQty();
    }, [isPreFilled, machineId, productionDate, shiftId, activePlan?.productionOrderId]);

    const handleClear = () => {
        if (!isPreFilled) {
            setMachineId("");
            setShiftId("");
            setProductionDate(formatLocalDateString(new Date()));
        }
        setHourIndex("1");
        setQtyProduced("");
        setRejectQty("0");
        setScrapQty("0");
        setDowntime("0");
        setRemarks("");
        setOperatorId("");
        if (!isPreFilled) {
            setActivePlan(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activePlan) {
            toast.error("Cannot save: No active Daily Plan loaded.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                productionOrderId: activePlan.productionOrderId,
                productionDate,
                shiftId,
                machineId,
                hourIndex: parseInt(hourIndex, 10),
                qtyProduced: parseFloat(qtyProduced),
                rejectQty: parseFloat(rejectQty),
                scrapQty: parseFloat(scrapQty),
                downtime: parseFloat(downtime),
                remarks: remarks || undefined,
                operatorId: operatorId || undefined,
            };

            if (editingLogId) {
                await dispatch(updateHourlyProduction({ id: String(editingLogId), data: payload })).unwrap();
                toast.success("Hourly Production entry updated successfully!");
            } else {
                await dispatch(createHourlyProduction(payload)).unwrap();
                toast.success("Hourly Production entry saved successfully!");
            }

            navigate("/hourly-work-reports");
        } catch (err: any) {
            toast.error(err || "Failed to log hourly production");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title mb-1">Hourly Production Entry</h2>
                                <div className="page-breadcrumb text-muted small">Home / Production / Hourly Entry / Create</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions justify-content-lg-end">
                                <CustomButton
                                    text="Back to Planning"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/daily-machine-planning")}
                                    variant="secondary"
                                    className="shadow-sm"
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit}>
                    <Row className="g-4">
                        <Col lg={5} md={12}>
                            <Card className="border-0 shadow-sm mb-4 h-100" style={{ borderRadius: "12px" }}>
                                <Card.Body className="p-4">
                                    <h2 className="form-title">Plan Details</h2>

                                    <Row className="g-3">
                                        <Col md={12}>
                                            <SelectInput
                                                label="Machine"
                                                name="machineId"
                                                value={machineId}
                                                options={machines.map((m) => ({ label: m.machineName, value: m.machineId }))}
                                                required
                                                onChange={(e) => setMachineId(e.target.value)}
                                                disabled={isPreFilled}
                                            />
                                        </Col>
                                        <Col md={12}>
                                            <TextInput
                                                label="Production Date"
                                                name="productionDate"
                                                value={productionDate}
                                                type="date"
                                                required
                                                onChange={(e) => setProductionDate(e.target.value)}
                                                disabled={isPreFilled}
                                            />
                                        </Col>
                                        <Col md={12}>
                                            <SelectInput
                                                label="Shift"
                                                name="shiftId"
                                                value={shiftId}
                                                options={shifts.map((s: any) => ({ label: s.shiftName, value: s.shiftCode }))}
                                                required
                                                onChange={(e) => setShiftId(e.target.value)}
                                                disabled={isPreFilled}
                                            />
                                        </Col>
                                    </Row>

                                    <div className="mt-4 pt-3 border-top">
                                        {loadingPlan ? (
                                            <div className="text-center py-4">
                                                <Spinner animation="border" size="sm" variant="primary" className="me-2" />
                                                <span className="text-muted small">Loading active plan...</span>
                                            </div>
                                        ) : activePlan ? (
                                            <div className="p-3 rounded-3" style={{ background: "rgba(0, 52, 40, 0.04)", border: "1px solid rgba(0, 52, 40, 0.1)" }}>
                                                <div className="d-flex align-items-center gap-2 mb-3 fw-bold small" style={{ color: "var(--color-primary)" }}>
                                                    <FaCheckCircle />
                                                    <span>ACTIVE PLAN LOADED</span>
                                                </div>
                                                <div className="mb-2">
                                                    <span className="text-muted small d-block">Production Order</span>
                                                    <strong className="fs-5" style={{ color: "var(--color-primary)" }}>{activePlan.productionOrderId}</strong>
                                                </div>
                                                <div className="mb-2">
                                                    <span className="text-muted small d-block">Product</span>
                                                    <strong className="text-dark">{activePlan.productName}</strong>
                                                    {activePlan.productCode && <span className="text-muted small block"> ({activePlan.productCode})</span>}
                                                </div>
                                                <Row className="g-2 mt-3 pt-2 border-top text-center">
                                                    <Col xs={4}>
                                                        <span className="text-muted d-block" style={{ fontSize: "10px" }}>TARGET</span>
                                                        <strong className="fs-6 text-dark">{activePlan.plannedQty}</strong>
                                                    </Col>
                                                    <Col xs={4}>
                                                        <span className="text-muted d-block" style={{ fontSize: "10px" }}>PRODUCED</span>
                                                        <strong className="fs-6" style={{ color: "var(--color-success)" }}>{activePlan.producedQty ?? 0}</strong>
                                                    </Col>
                                                    <Col xs={4}>
                                                        <span className="text-muted d-block" style={{ fontSize: "10px" }}>REMAINING</span>
                                                        <strong className="fs-6" style={{ color: "var(--color-secondary)" }}>{activePlan.remainingQty ?? activePlan.plannedQty}</strong>
                                                    </Col>
                                                </Row>
                                            </div>
                                        ) : (
                                            <Alert variant="warning" className="d-flex align-items-start gap-2 border-0 shadow-sm" style={{ borderRadius: "10px" }}>
                                                <FaInfoCircle className="mt-1" />
                                                <div>
                                                    <strong>No Plan Active</strong>
                                                    <p className="mb-0 small">Please choose a valid Machine, Date, and Shift that has been planned in the weekly schedule.</p>
                                                </div>
                                            </Alert>
                                        )}
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col lg={7} md={12}>
                            <Card className="border-0 shadow-sm h-100" style={{ borderRadius: "12px" }}>
                                <Card.Body className="p-4">
                                    <h2 className="form-title">Hourly Entry Log</h2>

                                    <Row className="g-3">
                                        <Col md={6}>
                                            <SelectInput
                                                label="Hour index of Shift"
                                                name="hourIndex"
                                                value={hourIndex}
                                                options={hourOptions}
                                                required
                                                onChange={(e) => setHourIndex(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={6}>
                                            <TextInput
                                                label="Operator ID (Optional)"
                                                name="operatorId"
                                                value={operatorId}
                                                placeholder="Enter Operator ID"
                                                onChange={(e) => setOperatorId(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={6}>
                                            <TextInput
                                                label="Produced Qty"
                                                name="qtyProduced"
                                                value={qtyProduced}
                                                type="number"
                                                step="0.001"
                                                required
                                                placeholder="Enter produced amount"
                                                onChange={(e) => setQtyProduced(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={6}>
                                            <TextInput
                                                label="Reject Qty"
                                                name="rejectQty"
                                                value={rejectQty}
                                                type="number"
                                                step="0.001"
                                                placeholder="Enter reject amount"
                                                onChange={(e) => setRejectQty(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={6}>
                                            <TextInput
                                                label="Scrap Qty"
                                                name="scrapQty"
                                                value={scrapQty}
                                                type="number"
                                                step="0.001"
                                                placeholder="Enter scrap amount"
                                                onChange={(e) => setScrapQty(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={6}>
                                            <TextInput
                                                label="Downtime (Minutes)"
                                                name="downtime"
                                                value={downtime}
                                                type="number"
                                                placeholder="Enter downtime in minutes"
                                                onChange={(e) => setDowntime(e.target.value)}
                                            />
                                        </Col>
                                        <Col md={12}>
                                            <TextInput
                                                label="Remarks / Comments"
                                                name="remarks"
                                                value={remarks}
                                                placeholder="Enter downtime reasons or log details"
                                                onChange={(e) => setRemarks(e.target.value)}
                                            />
                                        </Col>
                                    </Row>

                                    <div className="form-actions d-flex justify-content-end gap-3 mt-4 pt-3 border-top">
                                        <CustomButton
                                            text="Reset Fields"
                                            icon={FaEraser}
                                            onClick={handleClear}
                                            disabled={isSubmitting}
                                            variant="secondary"
                                        />
                                        <div className="ms-2">
                                            <CustomButton
                                                text={isSubmitting ? (editingLogId ? "Updating Entry..." : "Saving Entry...") : (editingLogId ? "Update Entry" : "Save Entry")}
                                                icon={FaSave}
                                                type="submit"
                                                disabled={isSubmitting || !activePlan}
                                            />
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </form>
            </Container>
        </div>
    );
};

export default HourlyWorkReportCreate;
