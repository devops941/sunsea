import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Container, Row, Col, Card } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import CustomButton from "../../../components/ui/Button/Button";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createWeeklyProgram, fetchWeeklyPrograms } from "../../../features/weekly-programs/weeklyProgramSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import { productionOrderService } from "../../../services/productionOrderService";

const normalizePriority = (pri?: string): "LOW" | "MEDIUM" | "HIGH" | "URGENT" => {
    if (!pri) return "MEDIUM";
    const upper = pri.toUpperCase();
    if (upper === "LOW") return "LOW";
    if (upper === "MEDIUM" || upper === "NORMAL") return "MEDIUM";
    if (upper === "HIGH") return "HIGH";
    if (upper === "URGENT") return "URGENT";
    return "MEDIUM";
};

const generateTempId = () => `WP-TEMP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

const WeeklyMachineScheduleEdit: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();

    const [weekStartDate, setWeekStartDate] = useState("");
    const [weekEndDate, setWeekEndDate] = useState("");
    const [targetPoId, setTargetPoId] = useState("");
    
    const [productionOrders, setProductionOrders] = useState<any[]>([]);
    const [loadingPo, setLoadingPo] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form inputs for editing
    const [selectedMachineId, setSelectedMachineId] = useState("");
    const [plannedQty, setPlannedQty] = useState("");

    const [deletedDbPrograms, setDeletedDbPrograms] = useState<string[]>([]);

    const { data: machines } = useAppSelector((state) => state.machines);
    const { data: shifts } = useAppSelector((state: any) => state.shifts || { data: [] });
    const { data: weeklyPrograms } = useAppSelector((state: any) => state.weeklyPrograms || { data: [] });

    useEffect(() => {
        dispatch(fetchMachines());
        dispatch(fetchShifts());
        dispatch(fetchWeeklyPrograms(undefined));

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

        if (location.state) {
            const item = location.state as any;
            if (item.productionOrderId) {
                setTargetPoId(item.productionOrderId);
            }
            if (item.machineId) {
                setSelectedMachineId(item.machineId);
            }
            if (item.weekStartDate) {
                const date = new Date(item.weekStartDate);
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                setWeekStartDate(`${yyyy}-${mm}-${dd}`);
                
                const endDate = new Date(date);
                endDate.setDate(date.getDate() + 6);
                const endYyyy = endDate.getFullYear();
                const endMm = String(endDate.getMonth() + 1).padStart(2, '0');
                const endDd = String(endDate.getDate()).padStart(2, '0');
                setWeekEndDate(`${endYyyy}-${endMm}-${endDd}`);
            }
        } else {
            toast.error("No schedule context provided for edit.");
            navigate("/weekly-machine-schedules");
        }
    }, [dispatch, location.state, navigate]);

    // Active programs in DB for the selected week & production order
    const dbProgramsForPo = useMemo(() => 
        weeklyPrograms.filter((wp: any) => 
            wp.weekStartDate.split("T")[0] === weekStartDate && 
            wp.productionOrderId === targetPoId &&
            wp.status !== "CANCELLED"
        ),
        [weeklyPrograms, weekStartDate, targetPoId]
    );

    // Initial load of planned qty from existing db schedules
    useEffect(() => {
        if (dbProgramsForPo.length > 0) {
            const totalPlanned = dbProgramsForPo.reduce((sum: number, wp: any) => sum + Number(wp.plannedQty || 0), 0);
            setPlannedQty(String(totalPlanned));
            setDeletedDbPrograms(dbProgramsForPo.map((wp: any) => wp.weeklyProgramId));
        }
    }, [dbProgramsForPo]);

    // Details of the specific PO being edited
    const currentPo = useMemo(() => 
        productionOrders.find((po: any) => po.productionOrderId === targetPoId),
        [productionOrders, targetPoId]
    );

    // Helper to calculate total allocated quantity for a PO excluding the current week's editable records
    const getOtherAllocatedQty = useCallback(() => {
        const totalAllocated = weeklyPrograms
            .filter((wp: any) => wp.productionOrderId === targetPoId && wp.status !== "CANCELLED")
            .reduce((sum: number, wp: any) => sum + Number(wp.plannedQty || 0), 0);
        
        const currentWeekAllocated = dbProgramsForPo
            .reduce((sum: number, wp: any) => sum + Number(wp.plannedQty || 0), 0);

        return Math.max(0, totalAllocated - currentWeekAllocated);
    }, [weeklyPrograms, dbProgramsForPo, targetPoId]);

    // Distributes planned quantities sequentially across shifts and days in the background
    const autoAllocatePrograms = (plannedQuantity: number, machineId: string) => {
        const newStaged: any[] = [];
        const bookedInSlot: Record<string, number> = {};
        
        // Pre-populate bookedInSlot with other active weekly program allocations (excluding the ones we are editing/deleting)
        const currentWeekIds = dbProgramsForPo.map((wp: any) => wp.weeklyProgramId);
        weeklyPrograms.forEach((wp: any) => {
            if (wp.weekStartDate.split("T")[0] === weekStartDate && wp.status !== "CANCELLED" && !currentWeekIds.includes(wp.weeklyProgramId)) {
                const key = `${wp.machineId}_${wp.dayOfWeek}_${wp.shiftId}`;
                bookedInSlot[key] = (bookedInSlot[key] || 0) + Number(wp.plannedQty);
            }
        });

        const machine = machines.find(m => m.machineId === machineId);
        if (!machine) return newStaged;

        const shiftCapacityQty = machine.capacity ? Number(machine.capacity) : 2000;
        const cycleTimeSec = machine.cycleTime ? Number(machine.cycleTime) : (8 * 3600) / shiftCapacityQty;

        let remainingRequiredQty = plannedQuantity;
        let currentDay = 1;
        let currentShiftIndex = 0;

        while (remainingRequiredQty > 0) {
            if (currentDay > 7) {
                const sundayLastShift = shifts[shifts.length - 1];
                if (sundayLastShift) {
                    const activeShiftId = sundayLastShift.shiftCode || sundayLastShift.id;
                    const nextIdTemp = generateTempId();
                    newStaged.push({
                        weeklyProgramId: nextIdTemp,
                        productionOrderId: targetPoId,
                        weekStartDate,
                        weekEndDate,
                        machineId,
                        dayOfWeek: 7,
                        shiftId: activeShiftId,
                        plannedQty: remainingRequiredQty,
                        plannedHours: Number(((remainingRequiredQty * cycleTimeSec) / 3600).toFixed(2)),
                        setupHours: 0,
                        sequenceNo: 1,
                        priority: normalizePriority(currentPo?.priority),
                        status: "PLANNED",
                        productItem: currentPo?.productItem
                    });
                }
                break;
            }

            const currentShift = shifts[currentShiftIndex];
            if (!currentShift) {
                currentShiftIndex = 0;
                currentDay++;
                continue;
            }

            const activeShiftId = currentShift.shiftCode || currentShift.id;
            const slotKey = `${machineId}_${currentDay}_${activeShiftId}`;

            const bookedQtyInSlot = bookedInSlot[slotKey] || 0;
            const shiftRemainingCapacityQty = Math.max(0, shiftCapacityQty - bookedQtyInSlot);

            if (shiftRemainingCapacityQty > 0) {
                const qtyToAllocate = Math.min(shiftRemainingCapacityQty, remainingRequiredQty);
                const nextIdTemp = generateTempId();

                newStaged.push({
                    weeklyProgramId: nextIdTemp,
                    productionOrderId: targetPoId,
                    weekStartDate,
                    weekEndDate,
                    machineId,
                    dayOfWeek: currentDay,
                    shiftId: activeShiftId,
                    plannedQty: qtyToAllocate,
                    plannedHours: Number(((qtyToAllocate * cycleTimeSec) / 3600).toFixed(2)),
                    setupHours: 0,
                    sequenceNo: 1,
                    priority: normalizePriority(currentPo?.priority),
                    status: "PLANNED",
                    productItem: currentPo?.productItem
                });

                bookedInSlot[slotKey] = bookedQtyInSlot + qtyToAllocate;
                remainingRequiredQty -= qtyToAllocate;
            }

            if (remainingRequiredQty > 0) {
                currentShiftIndex++;
                if (currentShiftIndex >= shifts.length) {
                    currentShiftIndex = 0;
                    currentDay++;
                }
            }
        }

        return newStaged;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMachineId || !plannedQty) {
            toast.error("Please select a machine and enter planned quantity.");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Delete old DB entries
            for (const idToDelete of deletedDbPrograms) {
                await weeklyProgramService.delete(idToDelete);
            }

            // 2. Generate new allocations in background
            const staged = autoAllocatePrograms(Number(plannedQty), selectedMachineId);
            if (staged.length === 0) {
                toast.error("Could not allocate any quantity. Please verify machine capacities.");
                setIsSubmitting(false);
                return;
            }

            // 3. Save new allocations sequentially
            for (let i = 0; i < staged.length; i++) {
                const program = staged[i];
                const actualId = await weeklyProgramService.fetchNextId();
                const payload = {
                    ...program,
                    weeklyProgramId: actualId,
                    sequenceNo: i + 1
                };
                await dispatch(createWeeklyProgram(payload)).unwrap();
            }

            toast.success("Weekly assignment updated successfully!");
            navigate("/weekly-machine-schedules");
        } catch (err: any) {
            console.error("EDIT SAVE ERROR =>", err);
            toast.error(err?.response?.data?.message || err?.message || "Failed to update weekly assignment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const otherAllocated = getOtherAllocatedQty();
    const remainingToPlan = currentPo ? Math.max(0, Number(currentPo.targetQty) - otherAllocated) : 0;

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header mb-4">
                    <Row className="align-items-center g-3">
                        <Col lg={6}>
                            <h2 className="page-title">Edit Weekly Assignment</h2>
                            
                        </Col>
                        <Col lg={6} className="text-end">
                            <CustomButton text="Back to List" icon={FaArrowLeft} onClick={() => navigate("/weekly-machine-schedules")} />
                        </Col>
                    </Row>
                </div>

                {loadingPo || !currentPo ? (
                    <div className="text-center py-5">
                        <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-8 w-8"></div>
                        <p className="mt-3 text-muted">Loading assignment details...</p>
                    </div>
                ) : (
                    <Card className="border-0 shadow-sm">
                        <Card.Header className="bg-white border-bottom py-3">
                            <h5 className="mb-0 fw-bold" style={{ color: "var(--color-primary)" }}>Assignment Context</h5>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <form onSubmit={handleSubmit}>
                                <Row className="g-4 mb-4">
                                    <Col md={6}>
                                        <TextInput
                                            label="Production Order ID"
                                            name="productionOrderId"
                                            value={targetPoId}
                                            disabled
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <TextInput
                                            label="Product Name"
                                            name="productName"
                                            value={currentPo.productItem?.productName || "Unknown Product"}
                                            disabled
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <TextInput
                                            label="Week Start Date"
                                            name="weekStartDate"
                                            value={weekStartDate}
                                            disabled
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <TextInput
                                            label="Week End Date"
                                            name="weekEndDate"
                                            value={weekEndDate}
                                            disabled
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <TextInput
                                            label="Order Target Qty"
                                            name="targetQty"
                                            value={`${currentPo.targetQty} ${currentPo.uom?.toLowerCase() === 'ea' ? 'pcs' : currentPo.uom}`}
                                            disabled
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <TextInput
                                            label="Other Weeks Allocated"
                                            name="otherAllocated"
                                            value={`${otherAllocated} ${currentPo.uom?.toLowerCase() === 'ea' ? 'pcs' : currentPo.uom}`}
                                            disabled
                                        />
                                    </Col>
                                    <Col md={4}>
                                        <TextInput
                                            label="Remaining To Plan"
                                            name="remainingToPlan"
                                            value={`${remainingToPlan} ${currentPo.uom?.toLowerCase() === 'ea' ? 'pcs' : currentPo.uom}`}
                                            disabled
                                        />
                                    </Col>
                                </Row>

                                <Row className="g-4 border-top pt-4">
                                    <Col md={6}>
                                        <TextInput
                                            label="Planned Qty This Week"
                                            name="plannedQty"
                                            type="number"
                                            required
                                            value={plannedQty}
                                            onChange={(e) => setPlannedQty(e.target.value)}
                                            min={1}
                                            max={remainingToPlan}
                                        />
                                    </Col>
                                    <Col md={6}>
                                        <TextInput
                                            label="Assigned Machine"
                                            name="assignedMachine"
                                            value={machines.find((m: any) => m.machineId === selectedMachineId)?.machineName || selectedMachineId}
                                            disabled
                                        />
                                    </Col>
                                </Row>

                                <div className="form-actions d-flex justify-content-end gap-3 mt-4 pt-3 border-top">
                                    <CustomButton
                                        text="Cancel"
                                        icon={FaEraser}
                                        onClick={() => navigate("/weekly-machine-schedules")}
                                        disabled={isSubmitting}
                                    />
                                    <CustomButton
                                        text={isSubmitting ? "Saving..." : "Update Assignment"}
                                        icon={FaSave}
                                        type="submit"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </form>
                        </Card.Body>
                    </Card>
                )}
            </Container>
        </div>
    );
};

export default WeeklyMachineScheduleEdit;
