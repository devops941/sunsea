import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { FaSave, FaCheck } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";

import { useAppDispatch } from "../../../hooks/reduxHooks";
import { createWeeklyProgram } from "../../../features/weekly-programs/weeklyProgramSlice";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import { productionOrderService } from "../../../services/productionOrderService";
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
    const [isDirty, setIsDirty] = useState(false);
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
    const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

    const formRef = useRef<HTMLDivElement>(null);
    const tableBodyRef = useRef<HTMLTableSectionElement>(null);
    const datePickerRef = useRef<HTMLDivElement>(null);
    const isDirtyRef = useRef(false);
    const saveConfirmOpenRef = useRef(false);
    const lastFocusedRef = useRef<HTMLElement | null>(null);

    // Auto-focus Week Start Date input on mount
    useEffect(() => {
        const t = setTimeout(() => {
            datePickerRef.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus();
        }, 200);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
    useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

    useFormShortcuts({ onSave: () => { if (!isSubmitting) handleSubmit(); } });

    const handleFormKeyDown = useFormKeyboardNav(formRef);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (document.querySelector("[data-select-portal]")) return;
            e.preventDefault();
            e.stopPropagation();
            if (saveConfirmOpenRef.current) {
                setSaveConfirmOpen(false);
                setTimeout(() => lastFocusedRef.current?.focus(), 50);
            } else if (isDirtyRef.current) {
                lastFocusedRef.current = document.activeElement as HTMLElement;
                setSaveConfirmOpen(true);
            } else {
                navigate(-1);
            }
        };
        window.addEventListener("keydown", handleEscape, { capture: true });
        return () => window.removeEventListener("keydown", handleEscape, { capture: true });
    }, [navigate]);

    useEffect(() => {
        const loadProductionOrders = async () => {
            setLoadingPo(true);
            try {
                const res: any = await productionOrderService.fetchAll({ limit: 10 } as any);
                const list = res.data || res || [];
                const poList = Array.isArray(list) ? list : (list.data || []);
                setProductionOrders(poList);
            } catch {
                // silently fail
            } finally {
                setLoadingPo(false);
            }
        };
        loadProductionOrders();
    }, [dispatch]);

    useEffect(() => {
        if (location.state) {
            const item = location.state as any;
            if (item.weekStartDate) setWeekStartDate(item.weekStartDate.split('T')[0]);
            if (item.weekEndDate) setWeekEndDate(item.weekEndDate.split('T')[0]);
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
                setWeekStartDate(`${yyyy}-${mm}-${dd}`);
                const endDate = new Date(mondayDate);
                endDate.setDate(mondayDate.getDate() + 6);
                setWeekEndDate(`${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`);
                setIsDirty(true);
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
            } catch {
                // silently fail
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

    const handleToggleSelect = useCallback((poId: string) => {
        setSelectedOrders(prev => ({ ...prev, [poId]: !prev[poId] }));
        setIsDirty(true);
    }, []);

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
                const mappedPriority = (po.priority && validPriorities.includes(po.priority.toUpperCase()))
                    ? po.priority.toUpperCase()
                    : "MEDIUM";
                await dispatch(createWeeklyProgram({
                    weeklyProgramId: actualId,
                    productionOrderId: po.productionOrderId,
                    weekStartDate,
                    weekEndDate,
                    machineId: null,
                    dayOfWeek: 1,
                    shiftId: null,
                    plannedQty: qty,
                    plannedHours: 0,
                    setupHours: 0,
                    sequenceNo: i + 1,
                    priority: mappedPriority,
                    status: "PLANNED"
                })).unwrap();
            }
            toast.success("Orders successfully allocated to the week!");
            setSelectedOrders({});
            setWeekStartDate("");
            setWeekEndDate("");
            setIsDirty(false);
            setTimeout(() => {
                datePickerRef.current?.querySelector<HTMLInputElement>("input:not([disabled])")?.focus();
            }, 100);
        } catch (err: any) {
            let errMsg = "Failed to save schedule.";
            if (typeof err === "string") errMsg = err;
            else if (err?.message && err.message !== "Rejected") errMsg = err.message;
            else if (err?.response?.data?.message) errMsg = err.response.data.message;
            toast.error(errMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedCount = Object.values(selectedOrders).filter(Boolean).length;

    // When week is selected and orders exist → highlight row 0 and focus table
    // When week is cleared → reset
    useEffect(() => {
        if (weekStartDate && displayOrders.length > 0) {
            const active = document.activeElement as HTMLElement | null;
            if (active instanceof HTMLInputElement || active instanceof HTMLSelectElement) {
                active.blur();
            }
            setFocusedRowIndex(0);
            const t = setTimeout(() => tableBodyRef.current?.focus(), 100);
            return () => clearTimeout(t);
        } else {
            setFocusedRowIndex(-1);
        }
    }, [weekStartDate, displayOrders.length]);

    // Table keyboard navigation — arrow keys + Space to select
    useEffect(() => {
        const handleTableKey = (e: KeyboardEvent) => {
            const active = document.activeElement as HTMLElement | null;
            const inField = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || active?.isContentEditable;
            if (inField) return;
            if (!tableBodyRef.current || displayOrders.length === 0) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocusedRowIndex(i => (i < 0 ? 0 : Math.min(i + 1, displayOrders.length - 1)));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocusedRowIndex(i => Math.max(i - 1, 0));
            } else if ((e.key === " " || e.key === "Enter") && focusedRowIndex >= 0) {
                e.preventDefault();
                const po = displayOrders[focusedRowIndex];
                if (po) handleToggleSelect(po.productionOrderId);
            }
        };
        window.addEventListener("keydown", handleTableKey);
        return () => window.removeEventListener("keydown", handleTableKey);
    }, [focusedRowIndex, displayOrders, handleToggleSelect]);

    // Scroll focused row into view
    useEffect(() => {
        if (focusedRowIndex < 0 || !tableBodyRef.current) return;
        const rows = tableBodyRef.current.querySelectorAll<HTMLTableRowElement>("tr[data-order-row]");
        rows[focusedRowIndex]?.scrollIntoView({ block: "nearest" });
    }, [focusedRowIndex]);

    return (
        <>
        <div ref={formRef} onKeyDown={handleFormKeyDown} onInput={() => setIsDirty(true)} data-escape-guarded className="w-full bg-card rounded-2xl shadow-sm border border-line" style={{ maxWidth: 1200 }}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b border-line">
                <div>
                    <h2 className="text-xl font-bold text-ink">Allocate Weekly Schedule</h2>
                    <p className="text-xs text-ink-subtle mt-0.5">Select a week and assign ready production orders</p>
                </div>
                <BackButton text="Back to List" to="/weekly-machine-schedules" />
            </div>

            {/* Date Filters */}
            <div className="p-6 border-b border-line bg-card-2/40 overflow-visible">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                    <div ref={datePickerRef}>
                    <DatePickerCalendar
                        label="Week Start Date"
                        name="weekStartDate"
                        value={weekStartDate ? new Date(weekStartDate) : null}
                        required
                        onChange={(e: any) => handleDateChange(e)}
                    />
                    </div>
                    <DatePickerCalendar
                        label="Week End Date"
                        name="weekEndDate"
                        value={weekEndDate ? new Date(weekEndDate) : null}
                        disabled
                    />
                </div>
            </div>

            {/* Content Area */}
            {weekStartDate ? (
                <>
                    {loadingPo ? (
                        <div className="text-center py-12 text-ink-subtle text-sm font-medium">
                            Loading production orders...
                        </div>
                    ) : (displayOrders.length > 0 || alreadyScheduled.length > 0) ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-ink">
                                <thead className="bg-card-2 border-b border-line-soft text-xs font-extrabold text-ink uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 text-center" style={{ width: 48 }}>
                                            <FaCheck className="text-ink-subtle mx-auto" size={11} />
                                        </th>
                                        <th className="px-4 py-3">Production Order</th>
                                        <th className="px-4 py-3">Product</th>
                                        <th className="px-4 py-3">Qty</th>
                                        <th className="px-4 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody ref={tableBodyRef} tabIndex={-1} className="divide-y divide-line-soft outline-none">
                                    {displayOrders.map((po: any, rowIdx: number) => {
                                        const isSelected = !!selectedOrders[po.productionOrderId];
                                        const isFocused = rowIdx === focusedRowIndex;
                                        return (
                                            <tr
                                                key={po.productionOrderId}
                                                data-order-row
                                                className={`transition-colors cursor-pointer ${
                                                    isFocused
                                                        ? "bg-primary/8 ring-1 ring-inset ring-primary/30"
                                                        : isSelected
                                                            ? "bg-primary/10 border-l-4 border-l-primary"
                                                            : "hover:bg-card-2"
                                                }`}
                                                onClick={() => { setFocusedRowIndex(rowIdx); handleToggleSelect(po.productionOrderId); }}
                                            >
                                                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input accent-primary"
                                                        style={{ cursor: "pointer", width: "1.1rem", height: "1.1rem" }}
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelect(po.productionOrderId)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-bold text-ink">{po.productionOrderId}</td>
                                                <td className="px-4 py-3 font-medium text-ink">{po.productItem?.productName || "-"}</td>
                                                <td className="px-4 py-3 font-semibold text-ink">
                                                    {Number(po.targetQty)} <span className="text-ink-muted text-xs">PCS</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge status={po.status || 'CREATED'} />
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {alreadyScheduled.length > 0 && alreadyScheduled.map((program: any) => (
                                        <tr key={`sched-${program.weeklyProgramId}`} className="bg-card-2/40 text-ink-subtle">
                                            <td className="px-4 py-3" />
                                            <td className="px-4 py-3 font-bold opacity-60">{program.productionOrderId}</td>
                                            <td className="px-4 py-3 opacity-60">{program.productionOrder?.productItem?.productName || "-"}</td>
                                            <td className="px-4 py-3 opacity-60">
                                                {Number(program.plannedQty)} <span className="text-xs">PCS</span>
                                            </td>
                                            <td className="px-4 py-3 opacity-60">
                                                <StatusBadge status={program.status || 'SCHEDULED'} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-ink-subtle text-sm font-medium">
                            No ready production orders found for this week.
                        </div>
                    )}

                    {/* Footer Actions */}
                    {selectedCount > 0 && (
                        <div className="flex justify-end items-center gap-3 p-5 border-t border-line bg-card-2/40">
                            <span className="text-sm font-bold text-primary">{selectedCount} order{selectedCount > 1 ? "s" : ""} selected</span>
                            {can("weekly_programs.create") && (
                                <CustomButton
                                    text={isSubmitting ? "Saving..." : "Confirm & Allocate"}
                                    icon={FaSave}
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                />
                            )}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-16 text-ink-subtle">
                    <div className="text-base font-semibold mb-1">Waiting for Week Start Date</div>
                    <div className="text-sm opacity-70">Select a Week Start Date above to view ready production orders.</div>
                </div>
            )}
        </div>
        <CommonConfirmModal
            show={saveConfirmOpen}
            onHide={() => { setSaveConfirmOpen(false); setTimeout(() => lastFocusedRef.current?.focus(), 50); }}
            onConfirm={() => { setSaveConfirmOpen(false); navigate(-1); }}
            title="Discard Changes?"
            message="You have unsaved changes. Are you sure you want to leave without saving?"
            confirmText="Discard"
            confirmVariant="danger"
            onCancel={() => { setSaveConfirmOpen(false); setTimeout(() => lastFocusedRef.current?.focus(), 50); }}
        />
        </>
    );
};

export default WeeklyMachineScheduleCreate;
