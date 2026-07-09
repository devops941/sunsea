import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Container, Row, Col, Card, Spinner } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import Select from "react-select";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import PlanningBoardGrid from "../../../components/ui/Planning/PlanningBoardGrid";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createWeeklyProgram, fetchWeeklyPrograms } from "../../../features/weekly-programs/weeklyProgramSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import { productionOrderService } from "../../../services/productionOrderService";

const DAY_OPTIONS = [
    { label: "Monday", value: 1 },
    { label: "Tuesday", value: 2 },
    { label: "Wednesday", value: 3 },
    { label: "Thursday", value: 4 },
    { label: "Friday", value: 5 },
    { label: "Saturday", value: 6 },
    { label: "Sunday", value: 7 },
];

const SHIFT_CAPACITY_HOURS = 8; // Assuming 8 hours standard shift capacity for splitting

const generateTempId = () => `WP-TEMP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

const WeeklyMachineScheduleCreate: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();

    const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);
    const [weekStartDate, setWeekStartDate] = useState("");
    const [weekEndDate, setWeekEndDate] = useState("");
    
    const [productionOrders, setProductionOrders] = useState<any[]>([]);
    const [loadingPo, setLoadingPo] = useState(false);
    
    // Auto-split staged programs before save
    const [stagedPrograms, setStagedPrograms] = useState<any[]>([]);
    const [deletedDbPrograms, setDeletedDbPrograms] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                // We need all POs in state so that grid moves of already scheduled/in-progress POs don't fail
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
            if (item.machineId) {
                setSelectedMachineIds(prev => prev.includes(item.machineId) ? prev : [...prev, item.machineId]);
            }
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
                // Monday is 1. If Sunday (0), we go back 6 days. Else go back (day - 1) days.
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                const mondayDate = new Date(date.setDate(diff));
                
                // Format to YYYY-MM-DD avoiding timezone offset issues by using local parts
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

    // Drag and drop handlers
    const handleDragStart = useCallback((e: React.DragEvent, po: any) => {
        e.dataTransfer.setData("application/json", JSON.stringify(po));
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault(); // Allow drop
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent, dayValue: number, shiftId: string, targetMachineId: string) => {
        e.preventDefault();
        
        if (!targetMachineId) {
            toast.error("Please select a machine first!");
            return;
        }

        const data = e.dataTransfer.getData("application/json");
        if (!data) return;
        
        const dragData = JSON.parse(data);
        const machine = machines.find(m => m.machineId === targetMachineId);
        
        if (!machine) {
            toast.error("Machine details not found.");
            return;
        }

        // 1. Check Capacity
        const shiftCapacityQty = machine.capacity ? Number(machine.capacity) : 0;
        if (shiftCapacityQty <= 0) {
            toast.error(`Capacity for machine ${machine.machineName} is 0 or not set in DB.`);
            return;
        }

        const cycleTimeSec = machine.cycleTime ? Number(machine.cycleTime) : (8 * 3600) / shiftCapacityQty;

        let currentAllPrograms = [
            ...weeklyPrograms.filter((wp: any) => wp.machineId === targetMachineId && wp.weekStartDate.split("T")[0] === weekStartDate && wp.status !== "CANCELLED"),
            ...stagedPrograms.filter((wp: any) => wp.machineId === targetMachineId)
        ];

        const newDeletedDbPrograms = [...deletedDbPrograms];
        let itemsToSchedule = dragData.items ? dragData.items : [dragData];

        if (dragData.isGridMove) {
            const poId = dragData.productionOrderId;
            const po = productionOrders.find((o: any) => o.productionOrderId === poId);
            
            if (!po) {
                toast.error("Could not find original production order details for this move.");
                return;
            }

            // Remove from current calculations
            currentAllPrograms = currentAllPrograms.filter((p: any) => p.productionOrderId !== poId);

            // Mark DB ones for deletion
            const dbProgramsForMove = weeklyPrograms.filter((wp: any) => 
                wp.productionOrderId === poId && 
                wp.machineId === targetMachineId && 
                wp.weekStartDate.split("T")[0] === weekStartDate && 
                wp.status !== "CANCELLED"
            );
            dbProgramsForMove.forEach((p: any) => {
                if (!newDeletedDbPrograms.includes(p.weeklyProgramId)) {
                    newDeletedDbPrograms.push(p.weeklyProgramId);
                }
            });

            setDeletedDbPrograms(newDeletedDbPrograms);
            setStagedPrograms(prev => prev.filter(p => !(p.productionOrderId === poId && p.machineId === targetMachineId && p.weekStartDate === weekStartDate)));

            itemsToSchedule = [po];
        }

        // Apply deletion filter
        currentAllPrograms = currentAllPrograms.filter(p => !newDeletedDbPrograms.includes(p.weeklyProgramId));

        let currentDay = dayValue;
        let currentShiftIndex = shifts.findIndex((s: any) => s.shiftCode === shiftId || s.id === shiftId);
        if (currentShiftIndex === -1) currentShiftIndex = 0;

        const newStaged: any[] = [];
        
        // Loop through all POs in the dropped data
        for (const po of itemsToSchedule) {
            let remainingRequiredQty = Number(po.targetQty);
            
            // Auto-split logic loop for this specific PO
            while (remainingRequiredQty > 0) {
                if (currentDay > 7) {
                    toast.warning(`Ran out of days in the week. Could not schedule remaining quantity for ${po.productionOrderId}.`);
                    break;
                }

                const currentShift = shifts[currentShiftIndex];
                const activeShiftId = currentShift.shiftCode || currentShift.id;

                // Calculate booked qty in this specific slot
                const bookedQtyInSlot = currentAllPrograms
                    .filter(wp => wp.dayOfWeek === currentDay && wp.shiftId === activeShiftId)
                    .reduce((sum, wp) => sum + Number(wp.plannedQty), 0);

                const shiftRemainingCapacityQty = Math.max(0, shiftCapacityQty - bookedQtyInSlot);

                if (shiftRemainingCapacityQty > 0) {
                    const qtyToAllocate = Math.min(shiftRemainingCapacityQty, remainingRequiredQty);
                    
                    // Get next ID placeholder
                    const nextIdTemp = generateTempId();
                    
                    const getValidPriority = (p?: string) => {
                        if (!p) return "MEDIUM";
                        const up = p.toUpperCase();
                        if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(up)) return up;
                        if (up === "NORMAL") return "MEDIUM";
                        return "MEDIUM";
                    };

                    const newProg = {
                        weeklyProgramId: nextIdTemp,
                        productionOrderId: po.productionOrderId,
                        weekStartDate,
                        weekEndDate,
                        machineId: targetMachineId,
                        dayOfWeek: currentDay,
                        shiftId: activeShiftId,
                        plannedQty: qtyToAllocate,
                        plannedHours: Number(((qtyToAllocate * cycleTimeSec) / 3600).toFixed(2)),
                        setupHours: 0,
                        sequenceNo: 1,
                        priority: getValidPriority(po.priority),
                        status: "PLANNED",
                        productItem: po.productItem
                    };
                    
                    newStaged.push(newProg);
                    currentAllPrograms.push(newProg);

                    remainingRequiredQty -= qtyToAllocate;
                }

                // Move to next shift / day if still quantity left for THIS PO
                if (remainingRequiredQty > 0) {
                    currentShiftIndex++;
                    if (currentShiftIndex >= shifts.length) {
                        currentShiftIndex = 0;
                        currentDay++;
                    }
                }
            }
        }

        if (newStaged.length > 0) {
            setStagedPrograms(prev => [...prev, ...newStaged]);
            toast.success(`Automatically allocated ${newStaged.length} slots for ${dragData.baseId || dragData.productionOrderId}`);
        }
    }, [machines, shifts, weeklyPrograms, stagedPrograms, weekStartDate, weekEndDate, deletedDbPrograms, productionOrders]);

    const handleClear = useCallback(() => {
        setStagedPrograms([]);
        setSelectedMachineIds([]);
        setWeekStartDate("");
        setWeekEndDate("");
    }, []);

    const handleRemoveStaged = useCallback((id: string) => {
        if (id.startsWith("WP-TEMP-")) {
            setStagedPrograms(prev => prev.filter(p => p.weeklyProgramId !== id));
        } else {
            setDeletedDbPrograms(prev => prev.includes(id) ? prev : [...prev, id]);
        }
    }, []);

    const handleSubmit = useCallback(async () => {
        if (stagedPrograms.length === 0) {
            toast.error("No schedule to save. Please drag and drop production orders first.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Process Deletions first
            for (const idToDelete of deletedDbPrograms) {
                await weeklyProgramService.delete(idToDelete);
            }

            // Since there's no bulk create endpoint yet, we execute sequentially 
            // to avoid race conditions when generating new IDs
            for (let i = 0; i < stagedPrograms.length; i++) {
                const staged = stagedPrograms[i];
                const actualId = await weeklyProgramService.fetchNextId();
                const payload = {
                    ...staged,
                    weeklyProgramId: actualId, 
                    sequenceNo: i + 1
                };
                await dispatch(createWeeklyProgram(payload)).unwrap();
            }
            toast.success("All schedules saved successfully!");
            navigate("/weekly-machine-schedules");
        } catch (err: any) {
            console.error("CREATE ERROR =>", err.response?.data?.errors || err.response?.data || err);
            
            let errMsg = "Failed to save some schedules. Please check the logs.";
            if (err.response?.data?.errors?.length > 0) {
                errMsg = "Validation Error: " + err.response.data.errors.map((e: any) => `${e.path}: ${e.message}`).join(", ");
            } else if (err.response?.data?.message) {
                errMsg = err.response.data.message;
            }
            toast.error(errMsg);
        } finally {
            setIsSubmitting(false);
        }
    }, [stagedPrograms, deletedDbPrograms, dispatch, navigate]);

    // We don't filter combinedPrograms globally anymore. We pass the full lists and filter per board.
    const activeWeeklyPrograms = useMemo(() => weeklyPrograms.filter((wp: any) => wp.weekStartDate.split("T")[0] === weekStartDate && wp.status !== "CANCELLED"), [weeklyPrograms, weekStartDate]);

    const queryParams = new URLSearchParams(location.search);
    const filterPo = queryParams.get("productionOrderId") || queryParams.get("po");

    // Only show relevant statuses OR the explicitly filtered PO in edit mode
    const displayOrdersMemo = useMemo(() => {
        const planningOrders = productionOrders.filter((po: any) => 
            po.status === "RM_AVAILABLE" || 
            po.status === "READY_FOR_PLANNING" || 
            po.status === "SCHEDULE_DELETED" ||
            po.status === "NOT_STARTED" ||
            po.status === "PARTIALLY_PLANNED" ||
            (filterPo && po.productionOrderId.includes(filterPo))
        );

        return filterPo 
            ? planningOrders.filter(po => {
                const parts = po.productionOrderId.split('-');
                const baseId = parts.length > 2 ? `${parts[0]}-${parts[1]}` : po.productionOrderId;
                return baseId === filterPo;
            })
            : planningOrders;
    }, [filterPo, productionOrders]);

    // Helper to calculate total allocated quantity for a PO
    const getAllocatedQty = useCallback((productionOrderId: string) => {
        const dbAllocated = activeWeeklyPrograms
            .filter((wp: any) => wp.productionOrderId === productionOrderId && !deletedDbPrograms.includes(wp.weeklyProgramId))
            .reduce((sum: number, wp: any) => sum + Number(wp.plannedQty || 0), 0);
        
        const stagedAllocated = stagedPrograms
            .filter(sp => sp.productionOrderId === productionOrderId)
            .reduce((sum: number, sp) => sum + Number(sp.plannedQty || 0), 0);
            
        return dbAllocated + stagedAllocated;
    }, [activeWeeklyPrograms, stagedPrograms, deletedDbPrograms]);

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header mb-4">
                    <Row className="align-items-center g-3">
                        <Col lg={6}>
                            <h2 className="page-title">{location.state ? "Edit Schedule" : "Interactive Schedule Board"}</h2>
                            <div className="page-breadcrumb">Weekly Schedules / {location.state ? "Edit" : "Create"}</div>
                        </Col>
                        <Col lg={6} className="text-end">
                            <CustomButton text="Back to List" icon={FaArrowLeft} onClick={() => navigate("/weekly-machine-schedules")} />
                        </Col>
                    </Row>
                </div>

                {/* Configuration Bar */}
                <Card className="mb-4 shadow-sm border-0">
                    <Card.Body>
                        <Row className="g-3">
                            <Col md={4}>
                                <div className="form-group mb-0">
                                    <label className="form-label mb-1" style={{ fontSize: "14px", fontWeight: 600 }}>Select Machines</label>
                                    <Select
                                        isMulti
                                        name="machineIds"
                                        options={machines.map((m: any) => ({ label: m.machineName, value: m.machineId }))}
                                        className="basic-multi-select"
                                        classNamePrefix="select"
                                        placeholder="Select Machines..."
                                        value={machines
                                            .filter((m: any) => selectedMachineIds.includes(m.machineId))
                                            .map((m: any) => ({ label: m.machineName, value: m.machineId }))}
                                        onChange={(selectedOpts) => {
                                            setSelectedMachineIds((selectedOpts as any[]).map(opt => opt.value));
                                        }}
                                        styles={{
                                            control: (base) => ({ ...base, minHeight: '38px' }),
                                        }}
                                    />
                                </div>
                            </Col>
                            <Col md={4}>
                                <TextInput
                                    label="Week Start Date"
                                    name="weekStartDate"
                                    value={weekStartDate}
                                    type="date"
                                    required
                                    onChange={handleDateChange}
                                />
                            </Col>
                            <Col md={4}>
                                <TextInput
                                    label="Week End Date"
                                    name="weekEndDate"
                                    value={weekEndDate}
                                    type="date"
                                    disabled
                                    onChange={() => {}}
                                />
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {selectedMachineIds.length > 0 && weekStartDate ? (
                    <Row className="g-4">
                        {/* Top Panel: Draggable Orders Horizontal */}
                        <Col lg={12}>
                            <Card className="border-0 shadow-sm mb-3">
                                <Card.Header className="bg-white border-bottom">
                                    <h6 className=" section-title border-bottom-0 mb-0  ">Ready for Planning</h6>
                                    <div className="text-muted small">Drag orders to the board</div>
                                </Card.Header>
                                <Card.Body className="p-3 d-flex gap-3" style={{ overflowX: "auto", whiteSpace: "nowrap" }}>
                                    {loadingPo ? (
                                        <div className="w-100 text-center p-4"><Spinner animation="border" /></div>
                                    ) : displayOrdersMemo.length > 0 ? (
                                        displayOrdersMemo.map((po: any) => {
                                            const targetQty = Number(po.targetQty);
                                            const allocated = getAllocatedQty(po.productionOrderId);
                                            const isFullyAllocated = allocated >= targetQty;
                                            
                                            return (
                                                <div
                                                    key={po.productionOrderId}
                                                    draggable={!isFullyAllocated}
                                                    onDragStart={(e) => !isFullyAllocated && handleDragStart(e, po)}
                                                    className={`border rounded p-3 shadow-sm bg-white position-relative ${isFullyAllocated ? 'opacity-50' : 'cursor-grab d-inline-block'}`}
                                                    style={{ cursor: isFullyAllocated ? "not-allowed" : "grab", minWidth: "250px", flexShrink: 0 }}
                                                >
                                                    {isFullyAllocated && (
                                                        <div className="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-success border border-white">
                                                            Fully Allocated
                                                        </div>
                                                    )}
                                                    <div className="mb-1 section-title border-bottom-0 ">{po.productionOrderId}</div>
                                                    <div className="small fw-medium text-truncate" style={{ maxWidth: "200px" }}>{po.productItem?.productName}</div>
                                                    
                                                    <div className="mt-2">
                                                        <div className="d-flex justify-content-between mb-1" style={{ fontSize: "10px" }}>
                                                            <span>Allocated: {allocated}</span>
                                                            <span>Target: {targetQty}</span>
                                                        </div>
                                                        <div className="progress mt-3" style={{ height: "4px" }}>
                                                            <div className="progress-bar bg-success" role="progressbar" style={{ width: `${Math.min(100, (allocated / targetQty) * 100)}%` }}></div>
                                                        </div>
                                                    </div>

                                                    <div className="d-flex justify-content-between mt-3 align-items-center">
                                                        <StatusBadge status={`${po.targetQty} ${po.uom}`} />
                                                        <StatusBadge status={po.priority || 'MEDIUM'} />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-muted text-center p-3 w-100">No orders found.</div>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>

                        {/* Right Panel: Virtual Planning Boards */}
                        <Col lg={12}>
                            {selectedMachineIds.map((mId) => {
                                const mSelected = machines.find(m => m.machineId === mId);
                                const combinedForMachine = [
                                    ...activeWeeklyPrograms.filter((wp: any) => wp.machineId === mId && !deletedDbPrograms.includes(wp.weeklyProgramId)),
                                    ...stagedPrograms.filter((sp) => sp.machineId === mId)
                                ];
                                
                                return (
                                    <div key={mId} className="mb-4">
                                        <PlanningBoardGrid
                                            selectedMachine={mSelected}
                                            weekStartDate={weekStartDate}
                                            DAY_OPTIONS={DAY_OPTIONS}
                                            shifts={shifts}
                                            combinedPrograms={combinedForMachine}
                                            SHIFT_CAPACITY_HOURS={SHIFT_CAPACITY_HOURS}
                                            handleDragOver={handleDragOver}
                                            handleDrop={handleDrop}
                                            handleRemoveStaged={handleRemoveStaged}
                                        />
                                    </div>
                                );
                            })}

                            <div className="form-actions d-flex justify-content-end gap-3 mt-4">
                                <CustomButton text="Clear Selection" icon={FaEraser} onClick={handleClear} disabled={isSubmitting} />
                                <div className="ms-2">
                                    <CustomButton
                                        text={isSubmitting ? "Saving..." : "Confirm & Save Schedule"}
                                        icon={FaSave}
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || stagedPrograms.length === 0}
                                    />
                                </div>
                            </div>
                        </Col>
                    </Row>
                ) : (
                    <Card className="text-center p-5 border-dashed bg-transparent text-muted">
                        Please select a Machine and Week Start Date to begin visual planning.
                    </Card>
                )}
            </Container>
        </div>
    );
};

export default WeeklyMachineScheduleCreate;
