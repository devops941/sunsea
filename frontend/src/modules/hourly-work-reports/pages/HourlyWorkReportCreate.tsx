import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Form } from 'react-bootstrap';

import { FaSave, FaEraser, FaInfoCircle, FaCheckCircle } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createHourlyProduction, updateHourlyProduction } from "../../../features/hourly-productions/hourlyProductionSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { dailyPlanService } from "../../../services/dailyPlanService";
import apiClient from "../../../api/apiClient";
import config from "../../../api/config";



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
    // Tracks whether the user manually chose an operator from the dropdown.
    // When true, async useEffects must NOT overwrite the user's selection.
    const userSelectedOperator = useRef(false);

    // Auto-loaded plan details
    const [activePlan, setActivePlan] = useState<any>(null);
    const [loadingPlan, setLoadingPlan] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dailyPlanId, setDailyPlanId] = useState<string | null>(null);

    // Added states for Daily Production Plan dropdown and Operator lookup
    const [dailyPlans, setDailyPlans] = useState<any[]>([]);
    const [selectedDailyPlanId, setSelectedDailyPlanId] = useState("");
    const [operatorName, setOperatorName] = useState("");
    const [availableOperators, setAvailableOperators] = useState<any[]>([]);
    const [shiftInchargeName, setShiftInchargeName] = useState("");
    const [planError, setPlanError] = useState<string | null>(null);

    // Wastage Audit State
    const [logWastage, setLogWastage] = useState(false);
    const [wastages, setWastages] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [rawMaterials, setRawMaterials] = useState<any[]>([]);
    
    const [stopPlanEarly, setStopPlanEarly] = useState(false);
    const [stopPlanReason, setStopPlanReason] = useState("");


    // Is the form pre-filled from Daily Planning?
    const isPreFilled = useMemo(() => {
        return !!(locationState.state && locationState.state.productionOrderId);
    }, [locationState.state]);

    useEffect(() => {
        dispatch(fetchMachines());
        dispatch(fetchShifts());
        // Fetch Stores and Raw Materials (Wastage Products)
        apiClient.get(config.store.base, { params: { limit: 1000 } }).then(res => {
            const data = res.data?.data;
            if (Array.isArray(data)) setStores(data);
            else if (data && Array.isArray(data.stores)) setStores(data.stores);
            else if (res.data && Array.isArray(res.data.stores)) setStores(res.data.stores);
        }).catch(err => console.error(err));
        
        apiClient.get(config.rawMaterial.base, { params: { limit: 1000 } }).then(res => {
            const data = res.data?.data;
            let list: any[] = [];
            if (Array.isArray(data)) list = data;
            else if (data && Array.isArray(data.rawMaterials)) list = data.rawMaterials;
            else if (res.data && Array.isArray(res.data.rawMaterials)) list = res.data.rawMaterials;
            setRawMaterials(list.filter((rm: any) => rm.itemType === "WASTAGE"));
        }).catch(err => console.error(err));
    }, [dispatch]);

    // Fetch daily plans list for dropdown (if not prefilled)
    useEffect(() => {
        if (isPreFilled) return;
        dailyPlanService.getAll()
            .then((res: any) => {
                let list: any[] = [];
                if (Array.isArray(res)) list = res;
                else if (res && Array.isArray(res.data)) list = res.data;
                else if (res && res.data && Array.isArray(res.data.dailyPlans)) list = res.data.dailyPlans;
                else if (res && Array.isArray(res.dailyPlans)) list = res.dailyPlans;
                
                // Filter by active statuses: APPROVED, IN_PROGRESS
                const activePlansList = list.filter((p: any) => 
                    p.status === "APPROVED" || p.status === "IN_PROGRESS"
                );
                setDailyPlans(activePlansList);
            })
            .catch((err) => console.error("Failed to load daily plans:", err));
    }, [isPreFilled]);

    // Handle selection of Daily Production Plan
    const handleDailyPlanSelect = (val: string) => {
        setSelectedDailyPlanId(val);
        setDailyPlanId(val);
    };

    // Unified useEffect to load plan details when dailyPlanId changes
    useEffect(() => {
        if (!dailyPlanId) {
            setActivePlan(null);
            setOperatorName("");
            setAvailableOperators([]);
            setShiftInchargeName("");
            setOperatorId("");
            setPlanError(null);
            return;
        }

        setLoadingPlan(true);
        setPlanError(null);

        dailyPlanService.getById(dailyPlanId)
            .then((res: any) => {
                const plan = res.data;
                if (!plan) {
                    toast.error("Daily Production Plan not found");
                    setActivePlan(null);
                    setOperatorName("");
                    setAvailableOperators([]);
                    setShiftInchargeName("");
                    setOperatorId("");
                    return;
                }

                setMachineId(plan.machineId);
                setShiftId(plan.shiftId);
                setProductionDate(plan.productionDate?.split("T")[0]);
                
                if (!plan.operators || plan.operators.length === 0) {
                    setOperatorName("");
                    setAvailableOperators([]);
                    setShiftInchargeName(plan.shiftIncharge?.fullName || "");
                    setOperatorId("");
                    setPlanError("The selected Daily Production Plan does not have an assigned operator.");
                } else {
                    setOperatorName(plan.operators.map((op: any) => op.fullName).join(", "));
                    setAvailableOperators(plan.operators);
                    setShiftInchargeName(plan.shiftIncharge?.fullName || "");
                    // Reset manual-selection flag since this is a plan change (new context)
                    userSelectedOperator.current = false;
                    // Only auto-select if there's exactly one operator (no choice to make).
                    // If multiple operators exist, leave blank so user must explicitly select.
                    if (plan.operators.length === 1) {
                        setOperatorId(plan.operators[0].id.toString());
                    } else {
                        setOperatorId("");
                    }
                    setPlanError(null);
                }

                setActivePlan({
                    productionOrderId: plan.productionOrderId,
                    productName: plan.productionOrder?.productItem?.productName || "Unknown Product",
                    productCode: plan.productionOrder?.productItem?.productCode || "",
                    plannedQty: plan.plannedQty,
                    uom: (plan.productionOrder?.productItem?.uom?.uomCode?.toUpperCase() === "EA" ? "PCS" : plan.productionOrder?.productItem?.uom?.uomCode?.toUpperCase()) || "PCS",
                    weeklyProgramId: plan.weeklyProgramId,
                    productId: plan.productionOrder?.productItemId ? Number(plan.productionOrder.productItemId) : null,
                    // Production order level data for carry-forward guard
                    poTargetQty: Number(plan.productionOrder?.targetQty || 0),
                    poProducedQty: Number(plan.productionOrder?.producedQty || 0),
                    poStatus: plan.productionOrder?.status || "",
                });
            })
            .catch((err: any) => {
                console.error("Failed to fetch daily plan:", err);
                toast.error("Failed to load daily plan details");
                setActivePlan(null);
                setOperatorName("");
                setAvailableOperators([]);
                setShiftInchargeName("");
                setOperatorId("");
            })
            .finally(() => {
                setLoadingPlan(false);
            });
    }, [dailyPlanId]);

    // Handle pre-filled state
    useEffect(() => {
        if (locationState.state && locationState.state.productionOrderId) {
            const s = locationState.state;
            setMachineId(s.machineId || "");
            setProductionDate(s.productionDate || formatLocalDateString(new Date()));
            setShiftId(s.shiftId || "");
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

    // When the user switches to a different hour, reset the manual-selection flag and
    // clear the operator field so each hour starts with a fresh pick.
    useEffect(() => {
        userSelectedOperator.current = false;
        setOperatorId("");
    }, [hourIndex]);

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
            
            // Only load operator from saved log if user has NOT manually picked someone yet.
            // Once the user selects an operator, their choice is locked in for this hour.
            if (matched.operatorId && !userSelectedOperator.current) {
                setOperatorId(matched.operatorId);
            }
            
            setEditingLogId(matched.hourlyProductionId);
        } else {
            setQtyProduced("0");
            setRejectQty("0");
            setScrapQty("0");
            setDowntime("0");
            setRemarks("");
            setDowntimeReason("");
            // operatorId is already cleared by the hourIndex effect above
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

    const handleClear = () => {
        if (!isPreFilled) {
            setMachineId("");
            setShiftId("");
            setProductionDate(formatLocalDateString(new Date()));
            setSelectedDailyPlanId("");
            setDailyPlanId("");
        }
        setWastages([]);
        setStopPlanEarly(false);
        setStopPlanReason("");
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
        if (planError) {
            toast.error(planError);
            return;
        }
        if (!operatorId) {
            toast.error("The selected Daily Production Plan does not have an assigned operator.");
            return;
        }
        if (!activePlan) {
            toast.error("Cannot save: No active Daily Plan loaded.");
            return;
        }

        const isLastHour = hourOptions.length > 0 && (Number(hourIndex) === hourOptions.length || stopPlanEarly);

        if (isLastHour && !logWastage) {
            toast.error("Wastage collection is mandatory for the final hourly entry.");
            return;
        }
        
        if (logWastage) {
            if (wastages.length === 0) {
                toast.error("Please add at least one Wastage Product, or uncheck the 'Log Wastage' option.");
                return;
            }
            const hasInvalidWastage = wastages.some(w => !w.storeId || !w.targetWastageProductId || w.quantity === "");
            if (hasInvalidWastage) {
                toast.error("Please fill in Store, Product, and Quantity for all added wastage products.");
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
                operatorId: operatorId,
                stopPlanEarly,
                stopPlanReason: stopPlanEarly ? stopPlanReason : null,
                logWastage,
                wastages: logWastage ? wastages : [],
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


            // Guard: only carry forward if the production order itself still has remaining qty.
            // If the PO's overall target is already met (e.g., over-produced in earlier shifts),
            // never trigger carry forward even if this daily plan's own planned qty is short.
            const poTargetQty = Number(activePlan?.poTargetQty || 0);
            const poProducedQty = Number(activePlan?.poProducedQty || 0);
            const poStatus = activePlan?.poStatus || "";
            const isPOComplete = ["COMPLETED", "DISPATCHED", "READY_FOR_DISPATCH"].includes(poStatus);
            // poProducedQty is the DB value BEFORE this submission; add current qty to get total
            const poTotalAfterThisEntry = poProducedQty + (Number(qtyProduced) || 0);
            const poStillHasRemaining = poTargetQty > 0 && poTotalAfterThisEntry < poTargetQty;

            if (isLastHour && pendingQty > 0 && activePlan?.weeklyProgramId && !isPOComplete && poStillHasRemaining) {
                toast.info(`Shift completed with ${pendingQty} pcs pending. Please create a carry-forward Daily Plan.`, { autoClose: 6000 });
                navigate("/daily-production-plans/create", {
                    state: {
                        weeklyProgramId: activePlan.weeklyProgramId,
                        machineId: machineId,
                        plannedQty: pendingQty,
                        remarks: `Carried forward from Daily Plan ${dailyPlanId}`,
                        // Pass carry-forward info so DailyPlanCreate shows the banner
                        carryForwardFromPlanId: dailyPlanId,
                        carryForwardFromInfo: {
                            shiftId: shiftId,
                            shiftName: shifts.find((s: any) => s.shiftCode === shiftId)?.shiftName || locationState.state?.shiftName || shiftId,
                            productionDate: productionDate,
                            pendingQty: pendingQty,
                        }
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

        <div className="min-h-screen">
            <form onSubmit={handleSubmit} className="bg-white  shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 m-0">Hourly Production Entry</h2>
                    </div>
                    <div className="flex justify-end">
                        <BackButton to="/daily-machine-planning" text="Back to Planning" />
                    </div>
                </div>

                {planError && (
                    <div className="mx-6 mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
                        <div className="text-red-500 font-bold text-lg">⚠️</div>
                        <div>
                            <p className="font-bold text-red-700 text-sm">Plan Verification Failed</p>
                            <p className="text-red-600 text-xs">{planError}</p>
                        </div>
                    </div>
                )}
                <div className="flex flex-col md:flex-row gap-6 p-6">

                    {/* Left Side: Plan Details */}
                    <div className="w-full md:w-5/12 lg:w-4/12 flex flex-col gap-6 sticky top-6 self-start">
                        <div>
                            <h6 className="font-bold text-lg text-slate-800 m-0">Plan Details</h6>
                        </div>
                        <div>
                            <div className="flex flex-col gap-4">
                                {/* Daily Production Plan dropdown when not prefilled */}
                                {!isPreFilled ? (
                                    <div>
                                        <SelectInput
                                            label="Daily Production Plan"
                                            name="selectedDailyPlanId"
                                            value={selectedDailyPlanId}
                                            required
                                            options={dailyPlans.map((dp) => ({
                                                label: `${dp.dailyPlanId} — PO: ${dp.productionOrderId} — Date: ${dp.productionDate?.split("T")[0]} — Machine: ${dp.machineId} — Shift: ${dp.shiftId}`,
                                                value: dp.dailyPlanId
                                            }))}
                                            onChange={(e) => handleDailyPlanSelect(e.target.value)}
                                            defaultOptionLabel="— Select Daily Production Plan —"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <TextInput
                                            label="Daily Production Plan ID"
                                            name="dailyPlanId"
                                            value={dailyPlanId || ""}
                                            disabled
                                        />
                                    </div>
                                )}

                                <div>
                                    <TextInput
                                        label="Machine"
                                        name="machineId"
                                        value={machines.find((m: any) => m.machineId === machineId)?.machineName || machineId || "—"}
                                        disabled
                                    />
                                </div>
                                <div>
                                    <TextInput
                                        label="Production Date"
                                        name="productionDate"
                                        value={productionDate || "—"}
                                        disabled
                                    />
                                </div>
                                <div>
                                    <TextInput
                                        label="Shift"
                                        name="shiftId"
                                        value={shifts.find((s: any) => s.shiftCode === shiftId)?.shiftName || shiftId || "—"}
                                        disabled
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
                                    <SelectInput
                                        label="Operator"
                                        name="operatorId"
                                        value={operatorId}
                                        onChange={(e: any) => {
                                            userSelectedOperator.current = true;
                                            setOperatorId(e.target.value);
                                        }}
                                        error={planError && planError.includes("operator") ? planError : undefined}
                                        disabled={loadingPlan || availableOperators.length === 0}
                                        defaultOptionLabel={loadingPlan ? "Loading operator..." : "— Select Operator —"}
                                        options={availableOperators.map(op => ({
                                            value: op.id.toString(),
                                            label: op.fullName
                                        }))}
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
                                    {/* <FaInfoCircle className="text-amber-600 mt-1 shrink-0 text-xl" /> */}
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
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-slate-700 text-sm m-0">Wastage Products</h4>
                                            <CustomButton
                                                text="Add Wastage Product"
                                                icon={FaSave} // or any relevant icon, actually it's just 'Add', no icon needed or FaPlus if imported. But we can just use `text`. Let's just use CustomButton.
                                                variant="secondary"
                                                onClick={() => setWastages([...wastages, { storeId: "", targetWastageProductId: "", quantity: "" }])}
                                            />
                                        </div>
                                        
                                        {wastages.length === 0 ? (
                                            <div className="text-center py-6 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                                                No wastage products added yet. Click the button above to add one.
                                            </div>
                                        ) : (
                                            <div className="overflow-visible pb-24">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                            <th className="px-4 py-3 bg-slate-50">Store</th>
                                                            <th className="px-4 py-3 bg-slate-50">Wastage Product</th>
                                                            <th className="px-4 py-3 bg-slate-50 w-48">Quantity</th>
                                                            <th className="px-4 py-3 bg-slate-50 w-20 text-center">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {wastages.map((w, index) => (
                                                            <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-4 py-3 align-top">
                                                                    <SelectInput
                                                                        label=""
                                                                        hideLabel
                                                                        noMargin
                                                                        name={`storeId-${index}`}
                                                                        value={w.storeId}
                                                                        onChange={(e) => {
                                                                            const newW = [...wastages];
                                                                            newW[index].storeId = e.target.value;
                                                                            setWastages(newW);
                                                                        }}
                                                                        options={[
                                                                            { label: "Select Store", value: "" },
                                                                            ...stores.map((s: any) => ({ label: s.storeName, value: s.storeId }))
                                                                        ]}
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3 align-top">
                                                                    <SelectInput
                                                                        label=""
                                                                        hideLabel
                                                                        noMargin
                                                                        name={`targetWastageProductId-${index}`}
                                                                        value={w.targetWastageProductId}
                                                                        onChange={(e) => {
                                                                            const newW = [...wastages];
                                                                            newW[index].targetWastageProductId = e.target.value;
                                                                            const rm = rawMaterials.find(r => r.rawMaterialId === e.target.value);
                                                                            if (rm) {
                                                                                let uoms = rm.baseUom || "KG";
                                                                                if (Array.isArray(rm.baseUom)) uoms = rm.baseUom.join(',');
                                                                                else if (typeof rm.baseUom === "string" && rm.baseUom.startsWith("[")) {
                                                                                    try { uoms = JSON.parse(rm.baseUom).join(','); } catch(e){}
                                                                                }
                                                                                newW[index].uom = uoms;
                                                                            }
                                                                            setWastages(newW);
                                                                        }}
                                                                        options={[
                                                                            { label: "Select Product", value: "" },
                                                                            ...rawMaterials
                                                                                .filter((r: any) => !w.storeId || r.storeId === w.storeId)
                                                                                .map((r: any) => {
                                                                                    const isSelectedInOtherRow = wastages.some((otherW, otherIdx) => otherIdx !== index && otherW.targetWastageProductId === r.rawMaterialId);
                                                                                    return { 
                                                                                        label: `${r.materialName} (${r.rawMaterialId})`, 
                                                                                        value: r.rawMaterialId,
                                                                                        disabled: isSelectedInOtherRow
                                                                                    };
                                                                                })
                                                                        ]}
                                                                        disabled={!w.storeId}
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3 align-top">
                                                                    <QuantityInput
                                                                        label=""
                                                                        hideLabel
                                                                        
                                                                        name={`quantity-${index}`}
                                                                        value={w.quantity}
                                                                        onChange={(e) => {
                                                                            const newW = [...wastages];
                                                                            newW[index].quantity = Number(e.target.value);
                                                                            setWastages(newW);
                                                                        }}
                                                                        baseUoms={w.uom || "KG"}
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3 align-middle text-center">
                                                                    <DeleteButton
                                                                        onClick={() => {
                                                                            const newW = [...wastages];
                                                                            newW.splice(index, 1);
                                                                            setWastages(newW);
                                                                        }}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
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
