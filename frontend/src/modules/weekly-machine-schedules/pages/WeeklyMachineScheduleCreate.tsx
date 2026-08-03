import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaSave, FaArrowLeft, FaCheck } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import TextInput from "../../../components/form/TextInput/TextInput";
import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

import { useAppDispatch } from "../../../hooks/reduxHooks";
import { createWeeklyProgram } from "../../../features/weekly-programs/weeklyProgramSlice";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import { productionOrderService } from "../../../services/productionOrderService";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { usePermission } from "../../../hooks/usePermission";

const WeeklyMachineScheduleCreate: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();
    const { can } = usePermission();

    const [weekStartDate, setWeekStartDate] = useState("");
    const [weekEndDate, setWeekEndDate] = useState("");

    const [productionOrders, setProductionOrders] = useState<any[]>([]);
    const [loadingPo, setLoadingPo] = useState(false);

    const [alreadyScheduled, setAlreadyScheduled] = useState<any[]>([]);

    const [selectedOrders, setSelectedOrders] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);



    useEffect(() => {

        const loadProductionOrders = async () => {
            setLoadingPo(true);
            try {
                const res: any = await productionOrderService.fetchAll({ limit: 10 } as any);
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

    const handleDateChange = useCallback((e: React.ChangeEvent<any>) => {
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
            try {
                const res: any = await weeklyProgramService.getAll({ weekStartDate });
                const list = res.data || res || [];
                setAlreadyScheduled(Array.isArray(list) ? list : (list.data || []));
            } catch (err) {
                console.error("Failed to load scheduled programs", err);
            }
        };

        fetchScheduled();
    }, [weekStartDate]);

    const displayOrders = useMemo(() => {
        const scheduledPoIds = new Set(alreadyScheduled.map((item: any) => item.productionOrderId));
        return productionOrders.filter((po: any) => {
            const isReadyStatus = po.status === "RM_AVAILABLE" || po.status === "READY_FOR_PLANNING" || po.status === "SCHEDULE_DELETED";
            return isReadyStatus && !scheduledPoIds.has(po.productionOrderId);
        });
    }, [productionOrders, alreadyScheduled]);

    const handleToggleSelect = (poId: string) => {
        setSelectedOrders(prev => ({ ...prev, [poId]: !prev[poId] }));
    };





    const handleSubmit = async () => {
        const selectedIds = Object.keys(selectedOrders).filter(id => selectedOrders[id]);

        if (selectedIds.length === 0) {
            toast.error("Please select at least one order to allocate.");
            return;
        }

        setIsSubmitting(true);
        try {


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
                    shiftId: null, // Shift remains null until production start
                    plannedQty: qty,
                    plannedHours: 0,
                    setupHours: 0,
                    sequenceNo: i + 1,
                    priority: mappedPriority,
                    status: "PLANNED"
                };

                await dispatch(createWeeklyProgram(payload)).unwrap();
            }

            toast.success("Orders successfully allocated to the week!");
            navigate("/weekly-machine-schedules");
        } catch (err: any) {
            console.error("CREATE ERROR =>", err);
            let errMsg = "Failed to save schedule.";
            if (typeof err === "string") {
                errMsg = err;
            } else if (err?.message && err.message !== "Rejected") {
                errMsg = err.message;
            } else if (err?.response?.data?.message) {
                errMsg = err.response.data.message;
            } else if (err?.response?.data?.errors?.length > 0) {
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
            <div className="p-4 md:p-6 min-h-screen bg-white"><div className="w-full">
                <div className="page-header mb-4">
                    <div className="flex flex-col md:flex-row items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Allocate Weekly Schedule</h2>

                        </div>
                        <div>
                            <BackButton text="Back to List" to="/weekly-machine-schedules" />
                        </div>
                    </div>
                </div>

                <div className="  mb-6">
                    <div className="p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                            <div className="md:col-span-6 lg:col-span-4">
                                <DatePickerCalendar
                                    label="Week Start Date"
                                    name="weekStartDate"
                                    value={weekStartDate ? new Date(weekStartDate) : null}
                                    required
                                    onChange={(e: any) => handleDateChange(e)}
                                />
                            </div>
                            <div className="md:col-span-6 lg:col-span-4">
                                <DatePickerCalendar
                                    label="Week End Date"
                                    name="weekEndDate"
                                    value={weekEndDate ? new Date(weekEndDate) : null}
                                    disabled
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {weekStartDate ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6">


                        <div className="p-0">
                            {loadingPo ? (
                                <div className="text-center p-10 text-slate-500">Loading...</div>
                            ) : (displayOrders.length > 0 || alreadyScheduled.length > 0) ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-slate-600">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                                            <tr>
                                                <th className="px-4 py-3" style={{ width: "50px", textAlign: "center" }}>
                                                    <FaCheck className="text-slate-500" />
                                                </th>
                                                <th className="px-4 py-3">Production Order</th>
                                                <th className="px-4 py-3">Product</th>

                                                <th className="px-4 py-3">Qty</th>
                                                <th className="px-4 py-3">Status / Priority</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {/* Render Pending Orders first */}
                                            {displayOrders.map((po: any) => {
                                                const targetQty = Number(po.targetQty);
                                                const isSelected = !!selectedOrders[po.productionOrderId];

                                                return (
                                                    <tr key={po.productionOrderId} className={`hover:bg-slate-50 transition-colors ${isSelected ? "bg-blue-50" : ""}`}>
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                className="form-check-input"
                                                                style={{ cursor: "pointer", width: "1.2rem", height: "1.2rem" }}
                                                                checked={isSelected}
                                                                onChange={() => handleToggleSelect(po.productionOrderId)}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 font-bold text-slate-800">{po.productionOrderId}</td>
                                                        <td className="px-4 py-3">{po.productItem?.productName || "-"}</td>

                                                        <td className="px-4 py-3">{targetQty} <span className="small text-slate-500">PCS</span></td>
                                                        <td className="px-4 py-3"><StatusBadge status={po.priority || 'MEDIUM'} /></td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Render Already Scheduled Orders below them if week is selected */}
                                            {weekStartDate && alreadyScheduled.length > 0 && alreadyScheduled.map((program: any) => (
                                                <tr key={`sched-${program.weeklyProgramId}`} className="hover:bg-slate-50 transition-colors text-slate-500 bg-white">
                                                    <td className="px-4 py-3 text-center">
                                                        {/* No checkbox for already scheduled items */}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-slate-800 opacity-70">{program.productionOrderId}</td>
                                                    <td className="px-4 py-3 opacity-70">{program.productionOrder?.productItem?.productName || "-"}</td>

                                                    <td className="px-4 py-3 opacity-70">{Number(program.plannedQty)} <span className="small">PCS</span></td>
                                                    <td className="px-4 py-3 opacity-70"><StatusBadge status={program.status || 'SCHEDULED'} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center p-5 text-slate-500">
                                    No ready production orders (RM_AVAILABLE) found for scheduling.
                                </div>
                            )}
                        </div>
                        {selectedCount > 0 && (
                            <div className="flex justify-end items-center gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                                <span className="font-bold text-primary">{selectedCount} Selected</span>
                                {can("weekly_programs.create") && (
                                    <CustomButton
                                        text={isSubmitting ? "Saving..." : "Confirm & Save Allocation"}
                                        icon={FaSave}
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center p-10 border-2 border-dashed border-slate-300 rounded-2xl bg-white text-slate-500 mb-6 shadow-sm">
                        <div className="text-lg font-medium mb-1">Waiting for Week Start Date</div>
                        <div className="text-sm opacity-80">Please select a Week Start Date above to view and allocate ready production orders.</div>
                    </div>
                )}
            </div></div>
        </div>
    );
};

export default WeeklyMachineScheduleCreate;
