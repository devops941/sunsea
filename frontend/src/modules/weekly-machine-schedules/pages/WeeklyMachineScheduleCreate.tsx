import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Container, Row, Col, Card, Spinner, Table } from "react-bootstrap";
import { FaSave, FaArrowLeft, FaCheck } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import TextInput from "../../../components/form/TextInput/TextInput";
import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createWeeklyProgram } from "../../../features/weekly-programs/weeklyProgramSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import { productionOrderService } from "../../../services/productionOrderService";

const WeeklyMachineScheduleCreate: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();

    const [weekStartDate, setWeekStartDate] = useState("");
    const [weekEndDate, setWeekEndDate] = useState("");

    const [productionOrders, setProductionOrders] = useState<any[]>([]);
    const [loadingPo, setLoadingPo] = useState(false);

    const [alreadyScheduled, setAlreadyScheduled] = useState<any[]>([]);
    const [loadingScheduled, setLoadingScheduled] = useState(false);

    const [selectedOrders, setSelectedOrders] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: machines } = useAppSelector((state) => state.machines);
    const { data: shifts } = useAppSelector((state: any) => state.shifts || { data: [] });

    useEffect(() => {
        dispatch(fetchMachines());
        dispatch(fetchShifts());

        const loadProductionOrders = async () => {
            setLoadingPo(true);
            try {
                const res: any = await productionOrderService.fetchAll({ limit: 1000 } as any);
                const list = res.data || res || [];
                const poList = Array.isArray(list) ? list : (list.data || []);
                setProductionOrders(poList);
            } catch (err) {
                console.error("Failed to load production orders", err);
            } finally {
                setLoadingPo(false);
            }
        };

        loadProductionOrders();
    }, [dispatch]);

    useEffect(() => {
        if (location.state) {
            const item = location.state as any;
            if (item.weekStartDate) {
                setWeekStartDate(item.weekStartDate.split('T')[0]);
            }
            if (item.weekEndDate) {
                setWeekEndDate(item.weekEndDate.split('T')[0]);
            }
        }
    }, [location.state]);

    const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val) {
            const date = new Date(val);
            if (!isNaN(date.getTime())) {
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                const mondayDate = new Date(date.setDate(diff));

                const yyyy = mondayDate.getFullYear();
                const mm = String(mondayDate.getMonth() + 1).padStart(2, '0');
                const dd = String(mondayDate.getDate()).padStart(2, '0');
                const formattedStart = `${yyyy}-${mm}-${dd}`;

                setWeekStartDate(formattedStart);

                const endDate = new Date(mondayDate);
                endDate.setDate(mondayDate.getDate() + 6);
                const endYyyy = endDate.getFullYear();
                const endMm = String(endDate.getMonth() + 1).padStart(2, '0');
                const endDd = String(endDate.getDate()).padStart(2, '0');
                setWeekEndDate(`${endYyyy}-${endMm}-${endDd}`);
            }
        } else {
            setWeekStartDate("");
            setWeekEndDate("");
        }
    }, []);

    useEffect(() => {
        if (!weekStartDate) {
            setAlreadyScheduled([]);
            return;
        }

        const fetchScheduled = async () => {
            setLoadingScheduled(true);
            try {
                const res: any = await weeklyProgramService.getAll({ weekStartDate });
                const list = res.data || res || [];
                setAlreadyScheduled(Array.isArray(list) ? list : (list.data || []));
            } catch (err) {
                console.error("Failed to load scheduled programs", err);
            } finally {
                setLoadingScheduled(false);
            }
        };

        fetchScheduled();
    }, [weekStartDate]);

    const displayOrders = useMemo(() => {
        return productionOrders.filter((po: any) => {
            return po.status === "RM_AVAILABLE" || po.status === "READY_FOR_PLANNING" || po.status === "SCHEDULE_DELETED";
        });
    }, [productionOrders]);

    const handleToggleSelect = (poId: string) => {
        setSelectedOrders(prev => ({ ...prev, [poId]: !prev[poId] }));
    };



    const getMachineName = (id: string) => {
        const m = machines.find((x: any) => x.machineId === id);
        return m ? m.machineName : id;
    };

    const handleSubmit = async () => {
        const selectedIds = Object.keys(selectedOrders).filter(id => selectedOrders[id]);
        
        if (selectedIds.length === 0) {
            toast.error("Please select at least one order to allocate.");
            return;
        }

        setIsSubmitting(true);
        try {
            const defaultShiftId = shifts.length > 0 ? (shifts[0].shiftCode || shifts[0].id) : "SHIFT-001";

            for (let i = 0; i < selectedIds.length; i++) {
                const poId = selectedIds[i];
                const po = displayOrders.find((o: any) => o.productionOrderId === poId);
                if (!po) continue;

                const qty = Number(po.targetQty) || 0;
                if (qty <= 0) continue;

                const actualId = await weeklyProgramService.fetchNextId();

                const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
                const mappedPriority = (po.priority && typeof po.priority === 'string' && validPriorities.includes(po.priority.toUpperCase())) 
                    ? po.priority.toUpperCase() 
                    : "MEDIUM";

                const payload = {
                    weeklyProgramId: actualId,
                    productionOrderId: po.productionOrderId,
                    weekStartDate,
                    weekEndDate,
                    machineId: null, // Target machine remains null until production start
                    dayOfWeek: 1, // Default to Monday
                    shiftId: defaultShiftId, // Default shift
                    plannedQty: qty,
                    plannedHours: 0, 
                    setupHours: 0,
                    sequenceNo: i + 1,
                    priority: mappedPriority,
                    status: "PLANNED",
                    productItem: po.productItem
                };

                await dispatch(createWeeklyProgram(payload)).unwrap();
            }

            toast.success("Orders successfully allocated to the week!");
            navigate("/weekly-machine-schedules");
        } catch (err: any) {
            console.error("CREATE ERROR =>", err);
            let errMsg = "Failed to save schedule.";
            if (err.response?.data?.message) {
                errMsg = err.response.data.message;
            } else if (err.response?.data?.errors?.length > 0) {
                errMsg = err.response.data.errors.map((e: any) => `${e.path}: ${e.message}`).join(", ");
            }
            toast.error(errMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedCount = Object.values(selectedOrders).filter(Boolean).length;

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header mb-4">
                    <Row className="align-items-center g-3">
                        <Col lg={6}>
                            <h2 className="page-title">Allocate Weekly Schedule</h2>
                            <div className="page-breadcrumb">Weekly Schedules / Allocate</div>
                        </Col>
                        <Col lg={6} className="text-end">
                            <CustomButton text="Back to List" icon={FaArrowLeft} onClick={() => navigate("/weekly-machine-schedules")} />
                        </Col>
                    </Row>
                </div>

                <Card className="mb-4 shadow-sm border-0">
                    <Card.Body>
                        <Row className="g-3">
                            <Col md={6}>
                                <TextInput
                                    label="Week Start Date"
                                    name="weekStartDate"
                                    value={weekStartDate}
                                    type="date"
                                    required
                                    onChange={handleDateChange}
                                />
                            </Col>
                            <Col md={6}>
                                <TextInput
                                    label="Week End Date"
                                    name="weekEndDate"
                                    value={weekEndDate}
                                    type="date"
                                    disabled
                                    onChange={() => { }}
                                />
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {weekStartDate ? (
                    <Card className="border-0 shadow-sm mb-3">
                          
                            {selectedCount > 0 && (
                                <div className="d-flex align-items-center gap-3">
                                    <span className="fw-bold text-primary">{selectedCount} Selected</span>
                                    <CustomButton
                                        text={isSubmitting ? "Saving..." : "Confirm & Save Allocation"}
                                        icon={FaSave}
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                    />
                                </div>
                            )}
                        <Card.Body className="p-0">
                            {loadingPo ? (
                                <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>
                            ) : displayOrders.length > 0 ? (
                                <div className="table-responsive">
                                    <table className="master-data-table mb-0" style={{ width: "100%" }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: "50px", textAlign: "center" }}>
                                                    <FaCheck className="text-muted" />
                                                </th>
                                                <th>Production Order</th>
                                                <th>Product</th>
                                                <th>Target Machine</th>
                                                <th>Qty</th>
                                                <th>Status / Priority</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Render Pending Orders first */}
                                            {displayOrders.map((po: any) => {
                                                const targetQty = Number(po.targetQty);
                                                const isSelected = !!selectedOrders[po.productionOrderId];

                                                return (
                                                    <tr key={po.productionOrderId} className={`master-data-row ${isSelected ? "table-primary" : ""}`}>
                                                        <td className="master-data-cell text-center">
                                                            <input
                                                                type="checkbox"
                                                                className="form-check-input"
                                                                style={{ cursor: "pointer", width: "1.2rem", height: "1.2rem" }}
                                                                checked={isSelected}
                                                                onChange={() => handleToggleSelect(po.productionOrderId)}
                                                            />
                                                        </td>
                                                        <td className="master-data-cell fw-bold">{po.productionOrderId}</td>
                                                        <td className="master-data-cell">{po.productItem?.productName || "-"}</td>
                                                        <td className="master-data-cell text-muted">-</td>
                                                        <td className="master-data-cell">{targetQty} <span className="small text-muted">PCS</span></td>
                                                        <td className="master-data-cell"><StatusBadge status={po.priority || 'MEDIUM'} /></td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Render Already Scheduled Orders below them if week is selected */}
                                            {weekStartDate && alreadyScheduled.length > 0 && alreadyScheduled.map((program: any) => (
                                                <tr key={`sched-${program.weeklyProgramId}`} className="master-data-row text-muted bg-light">
                                                    <td className="master-data-cell text-center">
                                                        {/* No checkbox for already scheduled items */}
                                                    </td>
                                                    <td className="master-data-cell fw-bold opacity-75">{program.productionOrderId}</td>
                                                    <td className="master-data-cell opacity-75">{program.productionOrder?.productItem?.productName || "-"}</td>
                                                    <td className="master-data-cell opacity-75">{program.machine?.machineName || "Unassigned"}</td>
                                                    <td className="master-data-cell opacity-75">{Number(program.plannedQty)} <span className="small">PCS</span></td>
                                                    <td className="master-data-cell opacity-75"><StatusBadge status={program.status || 'SCHEDULED'} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center p-5 text-muted">
                                    No ready production orders (RM_AVAILABLE) found for scheduling.
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                ) : (
                    <Card className="text-center p-5 border-dashed bg-transparent text-muted mb-4">
                        Please select a Week Start Date to view and allocate ready production orders.
                    </Card>
                )}
            </Container>
        </div>
    );
};

export default WeeklyMachineScheduleCreate;
