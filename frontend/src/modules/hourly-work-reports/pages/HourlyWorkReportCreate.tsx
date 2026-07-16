import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Form } from 'react-bootstrap';

import { FaSave, FaEraser, FaArrowLeft, FaInfoCircle, FaCheckCircle } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import BackButton from "../../../components/ui/BackButton/BackButton";

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
    const [qtyProduced, setQtyProduced] = useState("0");
    const [rejectQty, setRejectQty] = useState("0");
    const [scrapQty, setScrapQty] = useState("0");
    const [downtime, setDowntime] = useState("0");
    const [remarks, setRemarks] = useState("");
    const [downtimeReason, setDowntimeReason] = useState("");
    const [rejectReason, setRejectReason] = useState("");
    const [scrapReason, setScrapReason] = useState("");
    const [operatorId, setOperatorId] = useState("");

    // Auto-loaded plan details
    const [activePlan, setActivePlan] = useState<any>(null);
    const [loadingPlan, setLoadingPlan] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dailyPlanId, setDailyPlanId] = useState<string | null>(null);

    // Wastage Audit State
    const [logWastage, setLogWastage] = useState(false);
    const [wastageType, setWastageType] = useState("SCRAP");
    const [wastageQuantity, setWastageQuantity] = useState("");
    const [wastageUom, setWastageUom] = useState("");
    const [wastageReason, setWastageReason] = useState("");
    const [isRecyclable, setIsRecyclable] = useState(false);
    const [stopPlanEarly, setStopPlanEarly] = useState(false);
    const [stopPlanReason, setStopPlanReason] = useState("");


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
                uom: s.uom || "units",
                weeklyProgramId: s.weeklyProgramId,
                productId: s.productId,
            });
            if (s.uom) {
                setWastageUom(prev => prev || s.uom);
            }
            if (s.dailyPlanId) {
                setDailyPlanId(s.dailyPlanId);
            }
            if (s.hourIndex) {
                setHourIndex(String(s.hourIndex));
            }
            if (s.editingLogId) {
                setEditingLogId(s.editingLogId);
                setHourIndex(s.hourIndex || "1");
                setQtyProduced(s.qtyProduced || "");
                setRejectQty(s.rejectQty || "0");
                setScrapQty(s.scrapQty || "0");
                setDowntime(s.downtime?.toString() || "0");
                setRemarks(s.remarks || "");
                setDowntimeReason(s.downtimeReason || "");
                setRejectReason(s.rejectReason || "");
                setScrapReason(s.scrapReason || "");
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
            setDowntimeReason(matched.downtimeReason || "");
            setOperatorId(matched.operatorId || "");
            setEditingLogId(matched.hourlyProductionId);
        } else {
            setQtyProduced("0");
            setRejectQty("0");
            setScrapQty("0");
            setDowntime("0");
            setRemarks("");
            setDowntimeReason("");
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
        let baseOptions: { label: string; value: string; disabled?: boolean }[];
        if (!shiftTiming?.startTime || !shiftTiming?.endTime) {
            baseOptions = Array.from({ length: 24 }, (_, i) => ({
                label: `Hour ${i + 1}`,
                value: String(i + 1)
            }));
        } else {
            const [startH, startM] = shiftTiming.startTime.split(":").map(Number);
            const [endH, endM] = shiftTiming.endTime.split(":").map(Number);

            const startMinutes = startH * 60 + startM;
            let endMinutes = endH * 60 + endM;

            if (endMinutes <= startMinutes) {
                endMinutes += 24 * 60;
            }

            const totalMinutes = endMinutes - startMinutes;
            const hours = Math.floor(totalMinutes / 60);

            baseOptions = Array.from({ length: hours }, (_, i) => ({
                label: `Hour ${i + 1}`,
                value: String(i + 1)
            }));
        }

        const filledIndices = existingLogs.map(log => Number(log.hourIndex));
        const maxFilled = filledIndices.length > 0 ? Math.max(...filledIndices) : 0;
        const nextRequiredHour = maxFilled + 1;

        return baseOptions.map(opt => {
            const optNum = Number(opt.value);
            const isEditingThisOne = existingLogs.some(log => String(log.hourIndex) === opt.value && String(log.hourlyProductionId) === String(editingLogId));

            return {
                ...opt,
                disabled: !isEditingThisOne && optNum !== nextRequiredHour
            };
        });
    }, [shiftTiming, existingLogs, editingLogId]);

    const isFinalHour = hourOptions.length > 0 && Number(hourIndex) === hourOptions.length;

    useEffect(() => {
        if (isFinalHour || stopPlanEarly) {
            setLogWastage(true);
        }
    }, [isFinalHour, stopPlanEarly]);

    // Auto-select the next available hour if the currently selected one is disabled
    useEffect(() => {
        if (!hourOptions || hourOptions.length === 0) return;
        const selectedOption = hourOptions.find(opt => opt.value === hourIndex);
        if (!selectedOption || selectedOption.disabled) {
            const firstAvailable = hourOptions.find(opt => !opt.disabled);
            if (firstAvailable && firstAvailable.value !== hourIndex) {
                setHourIndex(firstAvailable.value);
            }
        }
    }, [hourOptions, hourIndex]);

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
                let matchedProgram = null;
                if (matchedShift?.programs && matchedShift.programs.length > 0) {
                    matchedProgram = matchedShift.programs.find((p: any) => p.status === "IN_PROGRESS") ||
                        matchedShift.programs.find((p: any) => ["PLANNED", "APPROVED", "RELEASED"].includes(p.status)) ||
                        matchedShift.programs[0];
                }

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

        const isLastHour = hourOptions.length > 0 && (Number(hourIndex) === hourOptions.length || stopPlanEarly);

        if (isLastHour) {
            if (!logWastage) {
                toast.error("Wastage collection is mandatory for the final hourly entry.");
                return;
            }
            if (!wastageType || wastageQuantity === "") {
                toast.error("Please provide a Wastage Type and Quantity (enter 0 if none) for the final entry.");
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const numReject = Math.round(Number(rejectQty) || 0);
            const numScrap = Math.round(Number(scrapQty) || 0);
            const numProduced = Math.round(Number(qtyProduced) || 0);

            const payload = {
                productionOrderId: activePlan.productionOrderId,
                productionDate,
                shiftId,
                machineId,
                hourIndex: Number(hourIndex),
                qtyProduced: numProduced,
                rejectQty: numReject,
                scrapQty: numScrap,
                downtime: Number(downtime) || 0,
                remarks: remarks.trim() || undefined,
                downtimeReason: Number(downtime) > 0 ? downtimeReason : undefined,
                rejectReason: numReject > 0 ? rejectReason : undefined,
                scrapReason: numScrap > 0 ? scrapReason : undefined,
                operatorId: operatorId || undefined,
                dailyPlanId: dailyPlanId || undefined,
            };

            if (editingLogId) {
                await dispatch(updateHourlyProduction({ id: String(editingLogId), data: payload })).unwrap();
                toast.success("Hourly Production entry updated successfully!");
            } else {
                await dispatch(createHourlyProduction(payload)).unwrap();
                toast.success("Hourly Production entry saved successfully!");
            }

            const newShiftProduced = shiftProducedQty + (Number(qtyProduced) || 0);
            const pendingQtyRaw = Math.max(0, Number(activePlan?.plannedQty || 0) - newShiftProduced);
            const pendingQty = Math.round(pendingQtyRaw * 1000) / 1000;

            const actualProductId = activePlan?.productId || activePlan?.productItemId || activePlan?.productionOrder?.productItemId || activePlan?.productionOrder?.productId;

            // Handle Stop Plan Early
            if (stopPlanEarly && dailyPlanId) {
                try {
                    const stopRemarks = activePlan?.remarks
                        ? `${activePlan.remarks} | Stopped: ${stopPlanReason.trim()}`
                        : `Stopped: ${stopPlanReason.trim()}`;

                    await apiClient.put(`/daily-production-plans/${dailyPlanId}`, {
                        status: "STOPPED",
                        remarks: stopRemarks,
                        plannedHours: Number(hourIndex)
                    });
                    toast.success("Production plan stopped and capacity released.");
                } catch (err: any) {
                    console.error("Failed to stop production plan early", err);
                    toast.error(err?.response?.data?.message || "Failed to stop production plan early");
                }
            }

            if (isLastHour && logWastage && Number(wastageQuantity) > 0 && actualProductId) {
                try {
                    await apiClient.post(config.productionWastage.base, {
                        wastageDate: productionDate,
                        productionOrderId: activePlan.productionOrderId,
                        machineId: machineId,
                        shiftId: shiftId,
                        productId: Number(actualProductId),
                        wastageType: wastageType,
                        quantity: Number(wastageQuantity),
                        uom: wastageUom || "KG",
                        reason: wastageReason || undefined,
                        isRecyclable: isRecyclable,
                        status: "APPROVED"
                    });
                    toast.success("Shift Wastage logged successfully!");
                } catch (err: any) {
                    toast.error(err?.response?.data?.message || "Failed to log wastage");
                }
            }

            if (isLastHour && pendingQty > 0 && activePlan?.weeklyProgramId) {
                toast.info("Shift completed. Please carry forward the pending quantity.", { autoClose: 5000 });
                navigate("/daily-production-plans/create", {
                    state: {
                        weeklyProgramId: activePlan.weeklyProgramId,
                        machineId: machineId,
                        plannedQty: pendingQty,
                        remarks: `Carried forward from Daily Plan ${dailyPlanId}`
                    }
                });
                return;
            }

            navigate("/daily-machine-planning");
        } catch (err: any) {
            toast.error(err || "Failed to log hourly production");
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeProductionOrderId = activePlan?.productionOrderId;
    const shiftProducedQty = existingLogs
        .filter(log => log.productionOrderId === activeProductionOrderId && Number(log.hourIndex) > 0)
        .reduce((sum, log) => sum + Number(log.qtyProduced || 0), 0);

    const remainingQtyForShift = activePlan
        ? Math.max(0, Number(activePlan.plannedQty || 0) - shiftProducedQty)
        : 0;

    return (

        <div className="p-4 md:p-6 min-h-screen bg-slate-50">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 m-0">Hourly Production Entry</h2>
                    </div>
                    <div className="flex justify-end">
                        <BackButton to="/daily-machine-planning" text="Back to Planning" />
                    </div>
                </div>
                <div className="flex flex-col md:flex-row gap-6 p-6">

                    {/* Left Side: Plan Details */}
                    <div className="w-full md:w-5/12 lg:w-4/12 flex flex-col gap-6 sticky top-6 self-start">
                        <div>
                            <h6 className="font-bold text-lg text-slate-800 m-0">Plan Details</h6>
                        </div>
                        <div>
                            <div className="flex flex-col gap-4">

                                <div>
                                    <SelectInput
                                        label="Machine"
                                        name="machineId"
                                        value={machineId}
                                        options={machines.map((m) => ({ label: m.machineName, value: m.machineId }))}
                                        required
                                        onChange={(e) => setMachineId(e.target.value)}
                                        disabled={isPreFilled}
                                    />
                                </div>
                                <div>
                                    <TextInput
                                        label="Production Date"
                                        name="productionDate"
                                        value={productionDate}
                                        type="date"
                                        required
                                        onChange={(e) => setProductionDate(e.target.value)}
                                        disabled={isPreFilled}
                                    />
                                </div>
                                <div>
                                    <SelectInput
                                        label="Shift"
                                        name="shiftId"
                                        value={shiftId}
                                        options={shifts.map((s: any) => ({ label: s.shiftName, value: s.shiftCode }))}
                                        required
                                        onChange={(e) => setShiftId(e.target.value)}
                                        disabled={isPreFilled}
                                    />
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-200">
                                {loadingPlan ? (
                                    <div className="text-center py-4">
                                        <div className="animate-spin rounded-full border-2 border-indigo-600 border-t-transparent h-4 w-4 mr-2 inline-block align-middle"></div>
                                        <span className="text-slate-500 small">Loading active plan...</span>
                                    </div>
                                ) : activePlan ? (
                                    <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                                        <div className="flex items-center gap-2 mb-4 font-bold text-sm tracking-wider text-indigo-600">
                                            <FaCheckCircle className="text-xl" />
                                            <span>ACTIVE PLAN LOADED</span>
                                        </div>
                                        <div className="mb-3">
                                            <span className="text-slate-400 text-xs block">Production Order</span>
                                            <strong className="text-lg text-indigo-700">{activePlan.productionOrderId}</strong>
                                        </div>
                                        <div className="mb-3">
                                            <span className="text-slate-400 text-xs block">Product</span>
                                            <strong className="text-sm text-slate-800">{activePlan.productName}</strong>
                                            {activePlan.productCode && <span className="text-slate-400 text-xs block"> ({activePlan.productCode})</span>}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-slate-200 text-center">
                                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100/50">
                                                <span className="text-slate-400 block text-[10px] tracking-wider font-semibold">TARGET</span>
                                                <strong className="text-sm text-slate-800">{activePlan.plannedQty}</strong>
                                            </div>
                                            <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100/50">
                                                <span className="text-emerald-600 block text-[10px] tracking-wider font-semibold">PRODUCED</span>
                                                <strong className="text-sm text-emerald-700">{shiftProducedQty}</strong>
                                            </div>
                                            <div className="bg-amber-50 p-2 rounded-xl border border-amber-100/50">
                                                <span className="text-amber-600 block text-[10px] tracking-wider font-semibold">REMAINING</span>
                                                <strong className="text-sm text-amber-700">{remainingQtyForShift}</strong>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-start gap-3 border border-amber-200 shadow-sm">
                                        <FaInfoCircle className="mt-1" />
                                        <div>
                                            <strong>No Plan Active</strong>
                                            <p className="mb-0 small">Please choose a valid Machine, Date, and Shift that has been planned in the weekly schedule.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Hourly Entry Log */}
                    <div className="w-full md:w-7/12 lg:w-8/12 flex flex-col">
                        <h6 className="font-bold text-lg text-slate-800 mb-6">Hourly Entry Log</h6>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                            <div>
                                <SelectInput
                                    label="Hour index of Shift"
                                    name="hourIndex"
                                    value={hourIndex}
                                    options={hourOptions}
                                    required
                                    onChange={(e) => setHourIndex(e.target.value)}
                                />
                            </div>
                            <div>
                                <TextInput
                                    label="Operator ID (Optional)"
                                    name="operatorId"
                                    value={operatorId}
                                    placeholder="Enter Operator ID"
                                    onChange={(e) => setOperatorId(e.target.value)}
                                />
                            </div>
                            <div>
                                <TextInput
                                    label="Produced Qty"
                                    name="qtyProduced"
                                    value={qtyProduced}
                                    type="number"
                                    step="1"
                                    required
                                    placeholder="Enter produced amount"
                                    onChange={(e) => setQtyProduced(e.target.value)}
                                />
                            </div>
                            <div>
                                <TextInput
                                    label="Reject Qty"
                                    name="rejectQty"
                                    value={rejectQty}
                                    type="number"
                                    step="1"
                                    placeholder="Enter reject amount"
                                    onChange={(e) => setRejectQty(e.target.value)}
                                />
                            </div>
                            <div>
                                <TextInput
                                    label="Scrap Qty"
                                    name="scrapQty"
                                    value={scrapQty}
                                    type="number"
                                    step="1"
                                    placeholder="Enter scrap amount"
                                    onChange={(e) => setScrapQty(e.target.value)}
                                />
                            </div>
                            <div>
                                <QuantityInput
                                    label="Downtime"
                                    name="downtime"
                                    value={downtime}
                                    baseUoms="mins,hrs"
                                    onChange={(e) => setDowntime(e.target.value)}
                                />
                            </div>
                            {Number(downtime) > 0 && (
                                <div>
                                    <SelectInput
                                        label="Downtime Reason"
                                        name="downtimeReason"
                                        value={downtimeReason}
                                        onChange={(e) => setDowntimeReason(e.target.value)}
                                        options={[
                                            { label: "Machine Breakdown", value: "Machine Breakdown" },
                                            { label: "Power Failure", value: "Power Failure" },
                                            { label: "Material Shortage", value: "Material Shortage" },
                                            { label: "Tool/Mould Change", value: "Tool/Mould Change" },
                                            { label: "Operator Unavailable", value: "Operator Unavailable" },
                                            { label: "Quality Issue", value: "Quality Issue" },
                                            { label: "Preventative Maintenance", value: "Preventative Maintenance" },
                                            { label: "Others", value: "Others" },
                                        ]}
                                    />
                                </div>
                            )}
                            {Number(rejectQty) > 0 && (
                                <div>
                                    <SelectInput
                                        label="Reject Reason"
                                        name="rejectReason"
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        options={[
                                            { value: "Quality Issue", label: "Quality Issue" },
                                            { value: "Machine Defect", label: "Machine Defect" },
                                            { value: "Material Defect", label: "Material Defect" },
                                            { value: "Operator Error", label: "Operator Error" },
                                            { value: "Others", label: "Others" }
                                        ]}
                                    />
                                </div>
                            )}
                            {Number(scrapQty) > 0 && (
                                <div>
                                    <SelectInput
                                        label="Scrap Reason"
                                        name="scrapReason"
                                        value={scrapReason}
                                        onChange={(e) => setScrapReason(e.target.value)}
                                        options={[
                                            { value: "Startup Scrap", label: "Startup Scrap" },
                                            { value: "Process Setting", label: "Process Setting" },
                                            { value: "Material Purging", label: "Material Purging" },
                                            { value: "Others", label: "Others" }
                                        ]}
                                    />
                                </div>
                            )}
                            {(downtimeReason === "Others" || rejectReason === "Others" || scrapReason === "Others") && (
                                <div>
                                    <TextInput
                                        label="Remarks (Reason for Others)"
                                        name="remarks"
                                        value={remarks}
                                        required
                                        placeholder="Enter specific reason"
                                        onChange={(e) => setRemarks(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Stop Plan Early Section (only if not final hour) */}
                        {hourOptions.length > 0 && Number(hourIndex) < hourOptions.length && (
                            <div className="mt-8 pt-6 border-t border-slate-200">
                                <Form.Check
                                    type="switch"
                                    id="stop-plan-early-switch"
                                    label={<span className="font-semibold text-red-600 ml-3 text-base">Stop Production Plan after this hour</span>}
                                    checked={stopPlanEarly}
                                    onChange={(e) => {
                                        setStopPlanEarly(e.target.checked);
                                        if (e.target.checked) setLogWastage(true);
                                    }}
                                />
                                {stopPlanEarly && (
                                    <div className="mt-3 bg-slate-50/50 p-5 rounded-xl border border-slate-100 w-full">
                                        <div className="w-full">
                                            <TextInput
                                                label="Reason for Stopping"
                                                name="stopPlanReason"
                                                value={stopPlanReason}
                                                required
                                                placeholder="e.g. Urgent plan PO2 required on this machine"
                                                onChange={(e) => setStopPlanReason(e.target.value)}
                                                width="100%"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {hourOptions.length > 0 && (Number(hourIndex) === hourOptions.length || stopPlanEarly) && (
                            <div className="mt-8 pt-6 border-t border-slate-200">
                                <div className="bg-amber-50/50 border border-amber-200 p-5 flex items-start gap-4 rounded-xl mb-6">
                                    <FaInfoCircle className="text-amber-600 mt-1 shrink-0 text-xl" />
                                    <div>
                                        <span className="text-base font-bold text-amber-900 block mb-2">
                                            {stopPlanEarly ? "Production Stopped: Log Final Wastage" : "Shift Completed: Log Shift Wastage"}
                                        </span>
                                        <p className="text-sm text-amber-700 leading-relaxed mb-0">
                                            {stopPlanEarly
                                                ? "Since you are stopping the production plan early, please log the final wastage occurred up to this hour."
                                                : "Since this is the final hour of the shift, please log the total wastage occurred during this entire shift."}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center mb-6">
                                    <Form.Check
                                        type="switch"
                                        id="log-wastage-switch"
                                        label={<span className="text-sm font-semibold text-slate-700 ml-2">Log Wastage for this Shift</span>}
                                        checked={logWastage}
                                        disabled={isFinalHour || stopPlanEarly}
                                        onChange={(e) => setLogWastage(e.target.checked)}
                                    />
                                    {(isFinalHour || stopPlanEarly) && <span className="ml-3 text-red-500 text-xs font-bold">* Mandatory for final entry</span>}
                                </div>

                                {logWastage && (
                                    <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 mt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                                            <div>
                                                <SelectInput
                                                    label="Wastage Type"
                                                    name="wastageType"
                                                    value={wastageType}
                                                    onChange={(e) => setWastageType(e.target.value)}
                                                    options={[
                                                        { label: "Scrap", value: "SCRAP" },
                                                        { label: "Raw Material Waste", value: "RAW_MATERIAL_WASTE" },
                                                        { label: "Quality Rejection", value: "QUALITY_REJECTION" },
                                                        { label: "Machine Setup", value: "MACHINE_SETUP" },
                                                        { label: "Rework", value: "REWORK" },
                                                        { label: "Other", value: "OTHER" },
                                                    ]}
                                                />
                                            </div>
                                            <div>
                                                <QuantityInput
                                                    label="Total Wastage Quantity"
                                                    name="wastageQuantity"
                                                    value={wastageQuantity}
                                                    onChange={(e) => setWastageQuantity(e.target.value)}
                                                    baseUoms="KG,G"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <TextInput
                                                    label="Reason / Remarks"
                                                    name="wastageReason"
                                                    value={wastageReason}
                                                    onChange={(e) => setWastageReason(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                            <Form.Check
                                                type="checkbox"
                                                id="is-recyclable-check"
                                                label={<span className="text-slate-500 text-xs font-semibold ml-2">This wastage is recyclable</span>}
                                                checked={isRecyclable}
                                                onChange={(e) => setIsRecyclable(e.target.checked)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end items-center gap-3 px-6 py-5 border-t border-slate-200">
                    <CustomButton
                        text="Reset Fields"
                        icon={FaEraser}
                        variant="secondary"
                        onClick={handleClear}
                        disabled={isSubmitting}
                    />
                    <CustomButton
                        text={isSubmitting ? (editingLogId ? "Updating..." : "Saving...") : (editingLogId ? "Update Entry" : "Save Entry")}
                        icon={isSubmitting ? undefined : FaSave}
                        type="submit"
                        disabled={isSubmitting || !activePlan}
                    />
                </div>
            </form>
        </div>
    );
};

export default HourlyWorkReportCreate;
