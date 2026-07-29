import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Form } from 'react-bootstrap';

import { FaSave, FaEraser, FaInfoCircle, FaCheckCircle, FaCalendarAlt, FaCogs, FaClock, FaUsers, FaTrophy, FaCrown, FaBoxOpen, FaPlus } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonModal from "../../../components/ui/Modal/CommonModal";

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

const getUomOptions = (baseUom: string) => {
    if (!baseUom) return [];
    return baseUom.split(",").map(u => {
        const cleaned = u.trim().toLowerCase();
        const display = cleaned === "ea" ? "pcs" : cleaned;
        return { value: cleaned, label: display };
    });
};

const convertToPrimaryUom = (qty: number, selectedUom: string, baseUomStr: string) => {
    if (!baseUomStr) return qty;
    const uoms = baseUomStr.split(",").map(u => u.trim().toLowerCase());
    const primary = uoms[0];
    const selected = selectedUom.toLowerCase();
    if (primary === selected) return qty;

    // Weight conversions
    if (primary === "kg" && selected === "g") return qty / 1000;
    if (primary === "kg" && (selected === "ton" || selected === "t")) return qty * 1000;
    if (primary === "g" && selected === "kg") return qty * 1000;

    // Volume conversions
    if ((primary === "l" || primary === "ltr") && selected === "ml") return qty / 1000;
    if (primary === "ml" && (selected === "l" || selected === "ltr")) return qty * 1000;

    // Dozen conversions
    if (primary === "dz" && selected === "ea") return qty / 12;
    if (primary === "ea" && selected === "dz") return qty * 12;

    return qty;
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

    // Inline validation errors
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
    const [rawMaterialsUsed, setRawMaterialsUsed] = useState<any[]>([]);
    const [rawMaterialOptions, setRawMaterialOptions] = useState<any[]>([]);

    const [stopPlanEarly, setStopPlanEarly] = useState(false);
    const [stopPlanReason, setStopPlanReason] = useState("");
    const [stopOption, setStopOption] = useState<"CARRY_FORWARD" | "FORCE_COMPLETE">("CARRY_FORWARD");
    const [showNewHighModal, setShowNewHighModal] = useState(false);
    const [newHighDetails, setNewHighDetails] = useState<any>(null);


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
            setRawMaterialOptions(list.filter((rm: any) => rm.itemType !== "WASTAGE"));
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
                    p.status === "APPROVED" || p.status === "IN_PROGRESS" || p.status === "STOPPED" || p.status === "CANCELLED" || (p.status === "COMPLETED" && p.producedQty < p.plannedQty)
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

            // Load existing wastages if available on this log
            if (matched.productionWastages && Array.isArray(matched.productionWastages) && matched.productionWastages.length > 0) {
                setWastages(matched.productionWastages.map((w: any) => ({
                    storeId: w.storeId || "",
                    targetWastageProductId: w.targetWastageProductId || "",
                    quantity: String(w.quantity || ""),
                    uom: w.uom || "KG",
                    selectedUom: w.uom || "KG",
                    storeError: "",
                    productError: "",
                    quantityError: ""
                })));
            } else {
                setWastages([]);
            }
            setRawMaterialsUsed([]);
        } else {
            setQtyProduced("0");
            setRejectQty("0");
            setScrapQty("0");
            setDowntime("0");
            setRemarks("");
            setDowntimeReason("");
            // operatorId is already cleared by the hourIndex effect above
            setEditingLogId(null);
            setWastages([]);
            setRawMaterialsUsed([]);
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
        if (isFinalHour) {
            setLogWastage(true);
        }
    }, [isFinalHour]);

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
        setStopOption("CARRY_FORWARD");
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
        setFormErrors({});

        // Collect ALL errors in one pass
        const errors: Record<string, string> = {};

        if (!hourIndex) errors.hourIndex = "Hour index is required";
        if (!operatorId) errors.operatorId = "Operator is required";
        if (!qtyProduced || Number(qtyProduced) <= 0) errors.qtyProduced = "Produced quantity must be greater than 0";
        if (Number(downtime) > 0 && !downtimeReason) errors.downtimeReason = "Please select a downtime reason";
        if (Number(rejectQty) > 0 && !rejectReason) errors.rejectReason = "Please select a reject reason";
        if (Number(scrapQty) > 0 && !scrapReason) errors.scrapReason = "Please select a scrap reason";
        if ((downtimeReason === "Others" || rejectReason === "Others" || scrapReason === "Others") && !remarks?.trim()) {
            errors.remarks = "Please provide a reason";
        }

        // Stop plan reason validation (same pass)
        if (stopPlanEarly && !stopPlanReason.trim()) {
            errors.stopPlanReason = "Reason for stopping is required";
        }

        // Wastage validation
        const isLastHour = hourOptions.length > 0 && Number(hourIndex) === hourOptions.length;
        if (isLastHour && !stopPlanEarly && wastages.length === 0) {
            errors.logWastage = "Please add at least one wastage product for the final hourly entry";
        }

        let updatedWastages = wastages;
        let hasWastageError = false;
        if (wastages.length > 0) {
            const normalizedWastages = wastages.map((w) => ({
                ...w,
                storeError: !w.storeId ? "Store is required" : "",
                productError: !w.targetWastageProductId ? "Product is required" : "",
                quantityError: Number(w.quantity) > 0 ? "" : "Quantity must be greater than 0",
            }));
            hasWastageError = normalizedWastages.some(w => w.storeError || w.productError || w.quantityError);
            if (hasWastageError) updatedWastages = normalizedWastages;
        }

        let updatedRawMaterials = rawMaterialsUsed;
        let hasRawMaterialError = false;
        if (rawMaterialsUsed.length > 0) {
            const normalizedRM = rawMaterialsUsed.map((rm) => ({
                ...rm,
                storeError: !rm.storeId ? "Store is required" : "",
                productError: !rm.rawMaterialId ? "Raw Material is required" : "",
                quantityError: Number(rm.quantity) > 0 ? "" : "Quantity must be greater than 0",
            }));
            hasRawMaterialError = normalizedRM.some(rm => rm.storeError || rm.productError || rm.quantityError);
            if (hasRawMaterialError) updatedRawMaterials = normalizedRM;
        }

        // Show all errors at once and stop
        if (Object.keys(errors).length > 0 || hasWastageError || hasRawMaterialError) {
            setFormErrors(errors);
            if (hasWastageError) setWastages(updatedWastages);
            if (hasRawMaterialError) setRawMaterialsUsed(updatedRawMaterials);
            return;
        }

        // Non-field checks (toast only)
        if (planError) {
            toast.error(planError);
            return;
        }
        if (!activePlan) {
            toast.error("Cannot save: No active Daily Plan loaded.");
            return;
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
                logWastage: (isFinalHour || stopPlanEarly) && wastages.length > 0,
                wastages: (isFinalHour || stopPlanEarly)
                    ? wastages.map((w) => {
                        const matched = rawMaterials.find((r: any) => r.rawMaterialId === w.targetWastageProductId);
                        let baseUomStr = matched?.baseUom || "KG";
                        if (Array.isArray(matched?.baseUom)) baseUomStr = matched.baseUom.join(',');
                        else if (typeof matched?.baseUom === "string" && matched.baseUom.startsWith("[")) {
                            try { baseUomStr = JSON.parse(matched.baseUom).join(','); } catch (e) { }
                        }
                        const qty = Number(w.quantity) || 0;
                        const finalQty = convertToPrimaryUom(qty, w.selectedUom || "", baseUomStr);
                        return {
                            storeId: w.storeId,
                            targetWastageProductId: w.targetWastageProductId,
                            quantity: finalQty,
                        };
                    })
                    : [],
                rawMaterialsUsed: (isFinalHour || stopPlanEarly)
                    ? rawMaterialsUsed.map((rm) => {
                        const matched = rawMaterialOptions.find((r: any) => r.rawMaterialId === rm.rawMaterialId);
                        const baseUomStr = matched?.baseUom || "";
                        const qty = Number(rm.quantity) || 0;
                        const finalQty = convertToPrimaryUom(qty, rm.uom || "", baseUomStr);
                        return {
                            storeId: rm.storeId,
                            rawMaterialId: rm.rawMaterialId,
                            quantity: finalQty,
                        };
                    })
                    : [],
                dailyPlanId: dailyPlanId || undefined,
            };

            let res: any;
            if (editingLogId) {
                res = await dispatch(updateHourlyProduction({ id: String(editingLogId), data: payload })).unwrap();
                toast.success("Hourly Production entry updated successfully!");
            } else {
                res = await dispatch(createHourlyProduction(payload)).unwrap();
                toast.success("Hourly Production entry saved successfully!");
            }
            const actualProductId = activePlan?.productId || activePlan?.productItemId || activePlan?.productionOrder?.productItemId || activePlan?.productionOrder?.productId;

            // Handle Stop Plan Early
            if (stopPlanEarly && dailyPlanId) {
                try {
                    const stopRemarks = activePlan?.remarks
                        ? `${activePlan.remarks} | Stopped: ${stopPlanReason.trim()}`
                        : `Stopped: ${stopPlanReason.trim()}`;

                    const stopStatus = stopOption === "CARRY_FORWARD" ? "STOPPED" : "COMPLETED";

                    await apiClient.put(`/daily-production-plans/${dailyPlanId}`, {
                        status: stopStatus,
                        remarks: stopRemarks,
                        plannedHours: Number(hourIndex)
                    });
                    toast.success(
                        stopOption === "CARRY_FORWARD"
                            ? "Production stopped. You can carry forward the remaining quantity from the planning page."
                            : "Production plan short-closed successfully."
                    );
                } catch (err: any) {
                    console.error("Failed to stop production plan early", err);
                    toast.error(err?.response?.data?.message || "Failed to stop production plan early");
                }
            }

            const dataObj = res?.data || res;
            if (dataObj?.newHighReached) {
                setNewHighDetails(dataObj.newHighDetails);
                setShowNewHighModal(true);
            } else {
                navigate("/daily-machine-planning");
            }
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
                                    error={formErrors.hourIndex}
                                    onChange={(e) => {
                                        setHourIndex(e.target.value);
                                        setFormErrors((prev) => ({ ...prev, hourIndex: "" }));
                                    }}
                                />
                            </div>
                            <div>
                                <SelectInput
                                    label="Operator"
                                    name="operatorId"
                                    value={operatorId}
                                    required
                                    error={formErrors.operatorId || (planError && planError.includes("operator") ? planError : undefined)}
                                    disabled={loadingPlan || availableOperators.length === 0}
                                    defaultOptionLabel={loadingPlan ? "Loading operator..." : "— Select Operator —"}
                                    options={availableOperators.map(op => ({
                                        value: op.id.toString(),
                                        label: op.fullName
                                    }))}
                                    onChange={(e: any) => {
                                        userSelectedOperator.current = true;
                                        setOperatorId(e.target.value);
                                        setFormErrors((prev) => ({ ...prev, operatorId: "" }));
                                    }}
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
                                    error={formErrors.qtyProduced}
                                    onChange={(e) => {
                                        setQtyProduced(e.target.value);
                                        setFormErrors((prev) => ({ ...prev, qtyProduced: "" }));
                                    }}
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
                                    error={formErrors.rejectQty}
                                    onChange={(e) => {
                                        setRejectQty(e.target.value);
                                        setFormErrors((prev) => ({ ...prev, rejectQty: "" }));
                                    }}
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
                                    error={formErrors.scrapQty}
                                    onChange={(e) => {
                                        setScrapQty(e.target.value);
                                        setFormErrors((prev) => ({ ...prev, scrapQty: "" }));
                                    }}
                                />
                            </div>
                            <div>
                                <QuantityInput
                                    label="Downtime"
                                    name="downtime"
                                    value={downtime}
                                    baseUoms="mins,hrs"
                                    error={formErrors.downtime}
                                    onChange={(e) => {
                                        setDowntime(e.target.value);
                                        setFormErrors((prev) => ({ ...prev, downtime: "" }));
                                    }}
                                />
                            </div>
                            {Number(downtime) > 0 && (
                                <div>
                                    <SelectInput
                                        label="Downtime Reason"
                                        name="downtimeReason"
                                        value={downtimeReason}
                                        error={formErrors.downtimeReason}
                                        onChange={(e) => {
                                            setDowntimeReason(e.target.value);
                                            setFormErrors((prev) => ({ ...prev, downtimeReason: "" }));
                                        }}
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
                                        error={formErrors.rejectReason}
                                        onChange={(e) => {
                                            setRejectReason(e.target.value);
                                            setFormErrors((prev) => ({ ...prev, rejectReason: "" }));
                                        }}
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
                                        error={formErrors.scrapReason}
                                        onChange={(e) => {
                                            setScrapReason(e.target.value);
                                            setFormErrors((prev) => ({ ...prev, scrapReason: "" }));
                                        }}
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
                                        error={formErrors.remarks}
                                        onChange={(e) => {
                                            setRemarks(e.target.value);
                                            setFormErrors((prev) => ({ ...prev, remarks: "" }));
                                        }}
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
                                        if (!e.target.checked) {
                                            setFormErrors((prev) => ({ ...prev, stopPlanReason: "" }));
                                        }
                                    }}
                                />
                                {stopPlanEarly && (
                                    <div className="mt-3 bg-slate-50/50 p-5 rounded-xl border border-slate-100 w-full flex flex-col gap-4">
                                        <div className="w-full">
                                            <TextInput
                                                label="Reason for Stopping"
                                                name="stopPlanReason"
                                                value={stopPlanReason}
                                                required
                                                placeholder="e.g. Urgent plan PO2 required on this machine"
                                                error={formErrors.stopPlanReason}
                                                onChange={(e) => {
                                                    setStopPlanReason(e.target.value);
                                                    setFormErrors((prev) => ({ ...prev, stopPlanReason: "" }));
                                                }}
                                                width="100%"
                                            />
                                        </div>
                                        <div className="w-full">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                                Stop Action Type *
                                            </label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                                                <div
                                                    className={`cursor-pointer border rounded-xl p-3 flex flex-col transition-all ${stopOption === "FORCE_COMPLETE"
                                                            ? "border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20"
                                                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                                        }`}
                                                    onClick={() => setStopOption("FORCE_COMPLETE")}
                                                >
                                                    <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                                                        <input
                                                            type="radio"
                                                            name="stopOption"
                                                            checked={stopOption === "FORCE_COMPLETE"}
                                                            onChange={() => setStopOption("FORCE_COMPLETE")}
                                                            className="text-rose-600 focus:ring-rose-500"
                                                        />
                                                        Completed Stop
                                                    </div>
                                                    <span className="text-[11px] text-slate-500 mt-1 pl-5">
                                                        Stop production without carrying forward any quantity.
                                                    </span>
                                                </div>

                                                <div
                                                    className={`cursor-pointer border rounded-xl p-3 flex flex-col transition-all ${stopOption === "CARRY_FORWARD"
                                                            ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20"
                                                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                                        }`}
                                                    onClick={() => setStopOption("CARRY_FORWARD")}
                                                >
                                                    <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                                                        <input
                                                            type="radio"
                                                            name="stopOption"
                                                            checked={stopOption === "CARRY_FORWARD"}
                                                            onChange={() => setStopOption("CARRY_FORWARD")}
                                                            className="text-amber-600 focus:ring-amber-500"
                                                        />
                                                        Stop & Carry Forward
                                                    </div>
                                                    <span className="text-[11px] text-slate-500 mt-1 pl-5">
                                                        Carry forward the remaining <strong>{Math.max(0, remainingQtyForShift - (Number(qtyProduced) || 0))} pcs</strong> to a new daily plan.
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {hourOptions.length > 0 && (Number(hourIndex) === hourOptions.length || stopPlanEarly) && (
                            <div className="mt-8 pt-6 border-t border-slate-200">
                                {/* Info Banner */}
                                <div className="bg-amber-50 border border-amber-200 p-4 flex items-start gap-3 rounded-xl mb-5">
                                    <div>
                                        <span className="text-sm font-bold text-amber-900 block mb-1">
                                            {stopPlanEarly ? "🛑 Production Stopped — Log Wastage (Optional)" : "✅ Final Hour — Log Shift Wastage (Required)"}
                                        </span>
                                        <p className="text-xs text-amber-700 leading-relaxed mb-0">
                                            {stopPlanEarly
                                                ? "Wastage logging is optional when stopping early. Add rows below only if wastage occurred."
                                                : "Since this is the final hour, please log all wastage products for this shift. At least one entry is required."}
                                        </p>
                                    </div>
                                </div>

                                {/* Wastage error (when final hour + no rows) */}
                                {formErrors.logWastage && (
                                    <p className="mb-4 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                        ⚠️ {formErrors.logWastage}
                                    </p>
                                )}

                                {/* Wastage Table — always shown (no checkbox) */}
                                <div className="mt-4 p-5 border border-slate-200 rounded-xl bg-slate-50/50">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-slate-800 text-[15px] m-0 leading-tight">
                                            Wastage Products
                                            {!stopPlanEarly && <span className="text-red-500 ml-1">*</span>}
                                            {stopPlanEarly && <span className="ml-2 text-xs text-slate-400 font-normal">(optional)</span>}
                                        </h4>
                                        <CustomButton
                                            size="sm"
                                            variant="secondary"
                                            icon={FaPlus}
                                            text=" Add Wastage Product"
                                            onClick={() => {
                                                setFormErrors((prev) => ({ ...prev, logWastage: "" }));
                                                setWastages([...wastages, { storeId: "", targetWastageProductId: "", quantity: "", storeError: "", productError: "", quantityError: "" }]);
                                            }}
                                        />
                                    </div>

                                    {wastages.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                                            {stopPlanEarly
                                                ? "No wastage products added. Click '+ Add Wastage Product' if needed."
                                                : "No wastage products added yet. Click '+ Add Wastage Product' to add one."}
                                        </div>
                                    ) : (
                                        <div className="bg-white border border-slate-200 rounded-xl overflow-visible mt-3">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                            <th className="px-4 py-3 bg-slate-50 min-w-[160px]">Store <span className="text-red-500">*</span></th>
                                                            <th className="px-4 py-3 bg-slate-50 min-w-[220px]">Wastage Product <span className="text-red-500">*</span></th>
                                                            <th className="px-4 py-3 bg-slate-50 min-w-[180px]">Quantity <span className="text-red-500">*</span></th>
                                                            <th className="px-4 py-3 bg-slate-50 text-center w-[80px]">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {wastages.map((w, index) => (
                                                            <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-4 py-3 align-top min-w-[160px]">
                                                                    <SelectInput
                                                                        label=""
                                                                        hideLabel
                                                                        noMargin
                                                                        name={`storeId-${index}`}
                                                                        value={w.storeId}
                                                                        onChange={(e) => {
                                                                            const newW = [...wastages];
                                                                            newW[index].storeId = e.target.value;
                                                                            newW[index].storeError = "";
                                                                            newW[index].targetWastageProductId = "";
                                                                            newW[index].productError = "";
                                                                            setWastages(newW);
                                                                        }}
                                                                        options={[
                                                                            { label: "Select Store", value: "" },
                                                                            ...stores.map((s: any) => ({ label: s.storeName, value: s.storeId }))
                                                                        ]}
                                                                        required
                                                                        error={w.storeError}
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3 align-top min-w-[220px]">
                                                                    <SelectInput
                                                                        label=""
                                                                        hideLabel
                                                                        noMargin
                                                                        name={`targetWastageProductId-${index}`}
                                                                        value={w.targetWastageProductId}
                                                                        onChange={(e) => {
                                                                            const newW = [...wastages];
                                                                            newW[index].targetWastageProductId = e.target.value;
                                                                            newW[index].productError = "";
                                                                            const rm = rawMaterials.find(r => r.rawMaterialId === e.target.value);
                                                                            if (rm) {
                                                                                let uoms = rm.baseUom || "KG";
                                                                                if (Array.isArray(rm.baseUom)) uoms = rm.baseUom.join(',');
                                                                                else if (typeof rm.baseUom === "string" && rm.baseUom.startsWith("[")) {
                                                                                    try { uoms = JSON.parse(rm.baseUom).join(','); } catch (e) { }
                                                                                }
                                                                                newW[index].uom = uoms;
                                                                                const opts = getUomOptions(uoms);
                                                                                newW[index].selectedUom = opts.length > 0 ? opts[0].value : "";
                                                                            } else {
                                                                                newW[index].uom = "";
                                                                                newW[index].selectedUom = "";
                                                                            }
                                                                            setWastages(newW);
                                                                        }}
                                                                        options={[
                                                                            { label: "Select Product", value: "" },
                                                                            ...rawMaterials
                                                                                .filter((r: any) => {
                                                                                    if (!w.storeId) return true;
                                                                                    const rmStoreId = r.storeId || r.store?.storeId;
                                                                                    return rmStoreId && String(rmStoreId) === String(w.storeId);
                                                                                })
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
                                                                        error={w.productError}
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3 align-top min-w-[180px]">
                                                                    <QuantityInput
                                                                        label=""
                                                                        hideLabel
                                                                        name={`quantity-${index}`}
                                                                        value={w.quantity}
                                                                        onChange={(e) => {
                                                                            const newW = [...wastages];
                                                                            newW[index].quantity = e.target.value;
                                                                            if (e.target.uom) {
                                                                                newW[index].selectedUom = e.target.uom;
                                                                            }
                                                                            newW[index].quantityError = "";
                                                                            setWastages(newW);
                                                                        }}
                                                                        baseUoms={w.uom || "KG"}
                                                                        required
                                                                        error={w.quantityError}
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3 align-middle text-center w-[80px]">
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
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Returned Raw Materials */}
                        {(isFinalHour || stopPlanEarly) && (
                            <div className="mt-4 p-5 border border-slate-200 rounded-xl bg-slate-50/50">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-[15px] m-0 leading-tight">
                                                Returned Raw Materials
                                            </h4>
                                            <p className="text-xs text-slate-500 m-0">
                                                Log remaining raw materials returned to the warehouse.
                                            </p>
                                        </div>
                                    </div>
                                    <CustomButton
                                        size="sm"
                                        variant="secondary"
                                        icon={FaPlus}
                                        text=" Add Raw Material"
                                        onClick={() => {
                                            setRawMaterialsUsed([...rawMaterialsUsed, { storeId: "", rawMaterialId: "", quantity: "", uom: "", storeError: "", productError: "", quantityError: "" }]);
                                        }}
                                    />
                                </div>

                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-3">
                                    {rawMaterialsUsed.length === 0 ? (
                                        <div className="p-4 text-center text-slate-500 text-sm italic">
                                            No raw materials logged. Click '+ Add Raw Material' to add one.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                <thead>
                                                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                        <th className="px-4 py-3 bg-slate-50 min-w-[160px]">Store <span className="text-red-500">*</span></th>
                                                        <th className="px-4 py-3 bg-slate-50 min-w-[220px]">Raw Material <span className="text-red-500">*</span></th>
                                                        <th className="px-4 py-3 bg-slate-50 min-w-[180px]">Quantity <span className="text-red-500">*</span></th>
                                                        <th className="px-4 py-3 bg-slate-50 text-center w-[80px]">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {rawMaterialsUsed.map((rm, index) => (
                                                        <tr key={`rm-${index}`}>
                                                            <td className="px-4 py-3 align-top min-w-[160px]">
                                                                <SelectInput
                                                                    hideLabel={true}
                                                                    noMargin
                                                                    name={`rm-store-${index}`}
                                                                    value={rm.storeId}
                                                                    options={[
                                                                        { value: "", label: "-- Select Store --" },
                                                                        ...stores.map((s: any) => ({
                                                                            value: s.storeId,
                                                                            label: s.storeName || s.storeId
                                                                        }))
                                                                    ]}
                                                                    onChange={(e) => {
                                                                        const newRm = [...rawMaterialsUsed];
                                                                        newRm[index].storeId = e.target.value;
                                                                        newRm[index].storeError = "";
                                                                        newRm[index].rawMaterialId = ""; // Reset raw material when store changes
                                                                        setRawMaterialsUsed(newRm);
                                                                    }}
                                                                    error={rm.storeError}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 align-top min-w-[220px]">
                                                                <SelectInput
                                                                    hideLabel={true}
                                                                    name={`rm-id-${index}`}
                                                                    value={rm.rawMaterialId}
                                                                    options={[
                                                                        { value: "", label: "-- Select Raw Material --" },
                                                                        ...rawMaterialOptions
                                                                            .filter((r: any) => rm.storeId ? r.storeId === rm.storeId : true)
                                                                            .map((r: any) => ({
                                                                                value: r.rawMaterialId,
                                                                                label: `${r.rawMaterialId} - ${r.materialName}`
                                                                            }))
                                                                    ]}
                                                                    onChange={(e) => {
                                                                        const newRm = [...rawMaterialsUsed];
                                                                        newRm[index].rawMaterialId = e.target.value;
                                                                        newRm[index].productError = "";
                                                                        const matchedRm = rawMaterialOptions.find((r: any) => r.rawMaterialId === e.target.value);
                                                                        if (matchedRm) {
                                                                            const base = matchedRm.baseUom || "";
                                                                            const opts = getUomOptions(base);
                                                                            newRm[index].uom = opts.length > 0 ? opts[0].value : "";
                                                                        } else {
                                                                            newRm[index].uom = "";
                                                                        }
                                                                        setRawMaterialsUsed(newRm);
                                                                    }}
                                                                    error={rm.productError}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 align-top min-w-[180px]">
                                                                <QuantityInput
                                                                    label=""
                                                                    hideLabel
                                                                    name={`rm-qty-${index}`}
                                                                    value={rm.quantity}
                                                                    onChange={(e) => {
                                                                        const newRm = [...rawMaterialsUsed];
                                                                        newRm[index].quantity = e.target.value;
                                                                        if (e.target.uom) {
                                                                            newRm[index].uom = e.target.uom;
                                                                        }
                                                                        newRm[index].quantityError = "";
                                                                        setRawMaterialsUsed(newRm);
                                                                    }}
                                                                    baseUoms={
                                                                        rawMaterialOptions.find((r: any) => r.rawMaterialId === rm.rawMaterialId)?.baseUom || "KG"
                                                                    }
                                                                    uom={rm.uom}
                                                                    required
                                                                    error={rm.quantityError}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 align-middle text-center w-[80px]">
                                                                <DeleteButton
                                                                    onClick={() => {
                                                                        const newRm = [...rawMaterialsUsed];
                                                                        newRm.splice(index, 1);
                                                                        setRawMaterialsUsed(newRm);
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

            {/* ─────── New High Reached Modal ─────── */}
            <CommonModal
                show={showNewHighModal}
                onHide={() => {
                    setShowNewHighModal(false);
                    navigate("/daily-machine-planning");
                }}
                title={
                    <div className="flex items-center gap-2 text-indigo-600 font-bold">
                        <FaTrophy className="text-xl text-indigo-500 animate-pulse" />
                        <span>New Production High Reached!</span>
                    </div>
                }
                footer={
                    <CustomButton
                        text="Awesome!"
                        onClick={() => {
                            setShowNewHighModal(false);
                            navigate("/daily-machine-planning");
                        }}
                    />
                }
            >
                <div className="text-center py-4">
                    <div className="flex justify-center mb-5">
                        <div className="p-4 bg-indigo-50 rounded-full text-indigo-600 animate-bounce shadow-sm">
                            <FaCrown size={44} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Congratulations!</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
                        You have recorded a new highest production capacity for this product on this machine!
                    </p>

                    <div className="inline-block bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 mb-6 min-w-[240px]">
                        <div className="text-xs uppercase tracking-wider text-indigo-700 font-semibold mb-1">
                            New Capacity High
                        </div>
                        <div className="text-4xl font-extrabold text-indigo-600 flex items-center justify-center gap-2">
                            <span>{newHighDetails?.newCapacity}</span>
                            <span className="text-lg font-normal text-indigo-500">
                                {activePlan?.uom || "units"}
                            </span>
                        </div>
                        {newHighDetails?.previousCapacity > 0 && (
                            <div className="text-xs text-slate-500 mt-2 bg-indigo-100/50 py-1 px-3 rounded-full inline-block">
                                Previous High: <span className="font-semibold text-slate-700">{newHighDetails.previousCapacity} {activePlan?.uom || "units"}</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto bg-slate-50 p-5 rounded-2xl border border-slate-100 text-sm">
                        <div className="flex items-start gap-2.5">
                            <FaCalendarAlt className="text-indigo-500 mt-0.5 text-base flex-shrink-0" />
                            <div>
                                <span className="text-slate-400 text-xs block font-medium">Date</span>
                                <strong className="text-slate-700 font-semibold">{newHighDetails?.date}</strong>
                            </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <FaCogs className="text-indigo-500 mt-0.5 text-base flex-shrink-0" />
                            <div>
                                <span className="text-slate-400 text-xs block font-medium">Machine</span>
                                <strong className="text-slate-700 font-semibold truncate block max-w-[150px]" title={newHighDetails?.machineName}>{newHighDetails?.machineName}</strong>
                            </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <FaClock className="text-indigo-500 mt-0.5 text-base flex-shrink-0" />
                            <div>
                                <span className="text-slate-400 text-xs block font-medium">Shift</span>
                                <strong className="text-slate-700 font-semibold">{newHighDetails?.shiftName}</strong>
                            </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <FaUsers className="text-indigo-500 mt-0.5 text-base flex-shrink-0" />
                            <div>
                                <span className="text-slate-400 text-xs block font-medium">Operators</span>
                                <strong className="text-slate-700 font-semibold block truncate max-w-[150px]" title={newHighDetails?.operators}>
                                    {newHighDetails?.operators}
                                </strong>
                            </div>
                        </div>
                    </div>
                </div>
            </CommonModal>
        </div>
    );
};

export default HourlyWorkReportCreate;
