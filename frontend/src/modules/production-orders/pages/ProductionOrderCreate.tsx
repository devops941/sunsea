import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { usePermission } from "../../../hooks/usePermission";
import { FaSave, FaEraser, FaCheck, FaArrowLeft } from "react-icons/fa";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import RecordAuditInfo, { type AuditData } from "../../../components/ui/RecordAuditInfo/RecordAuditInfo";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import BusyItemsTable from "../../../components/form/OrderItemsTable/BusyItemsTable";
import AutocompleteInput from "../../../components/form/AutocompleteInput/AutocompleteInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import DatePickerCalendar, { formatLocalDate } from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";

import { productionOrderService } from "../../../services/productionOrderService";
import { dailyPlanService } from "../../../services/dailyPlanService";
import { productService } from "../../../services/productService";
import { machineService } from "../../../services/machineService";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";

interface WeeklyGroupItem {
    uid: string;
    productItemId: string;
    targetQty: number;
    narration: string;
    existingPoId?: string;
    isLocked?: boolean;
    lockReason?: string;
}

interface WeeklyGroup {
    uid: string;
    machineId: string;
    items: WeeklyGroupItem[];
}

const weeklyPlanSchema = z.object({
    productionOrderId: z.string().min(1, "Order No is required"),
    weekStartDate: z.string().optional().nullable(),
    weekEndDate: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
    if (data.weekStartDate && data.weekEndDate && data.weekEndDate < data.weekStartDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Week End Date must be on or after Week Start Date",
            path: ["weekEndDate"],
        });
    }
});

type WeeklyPlanFormValues = z.infer<typeof weeklyPlanSchema>;

const today = new Date().toISOString().split("T")[0];

/** Add N days to a YYYY-MM-DD string */
function addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
}

/** Safely extract YYYY-MM-DD string from ISO string, date string, or Date object */
function toDateInputString(val: any, fallback: string): string {
    if (!val) return fallback;
    if (typeof val === "string") {
        if (val.includes("T")) return val.split("T")[0];
        if (val.length >= 10) return val.substring(0, 10);
    }
    try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return formatLocalDate(d);
    } catch {}
    return fallback;
}

function getBaseId(poId: string): string {
    const match = poId.match(/^(.+)-M\d+-\d+$/);
    return match ? match[1] : (poId.includes("-") ? poId.split("-")[0] : poId);
}

const newWeeklyGroup = (): WeeklyGroup => ({
    uid: crypto.randomUUID(),
    machineId: "",
    items: [{ uid: crypto.randomUUID(), productItemId: "", targetQty: 0, narration: "" }],
});

const defaultValues: WeeklyPlanFormValues = {
    productionOrderId: "",
    weekStartDate: "",
    weekEndDate: "",
};

const ProductionOrderCreate: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams<{ id: string }>();
    const { can } = usePermission();

    // ── Weekly Plan State ────────────────────────────────────────────────────────
    const [machines, setMachines] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [existingOrders, setExistingOrders] = useState<any[]>([]);

    const [weeklyGroups, setWeeklyGroups] = useState<WeeklyGroup[]>([newWeeklyGroup()]);
    const [isWeeklySubmitting, setIsWeeklySubmitting] = useState(false);
    const [isWeeklyEditMode, setIsWeeklyEditMode] = useState(false);
    const [weeklyErrors, setWeeklyErrors] = useState<{ weekStart?: string; weekEnd?: string; schedules?: string }>({});

    const [auditInfo, setAuditInfo] = useState<AuditData | null>(null);
    const initialWeeklySnapshotRef = useRef<string>("");

    const formRef = useRef<HTMLFormElement>(null);
    const isDirtyRef = useRef(false);
    const saveConfirmOpenRef = useRef(false);
    const lastFocusedRef = useRef<HTMLElement | null>(null);
    const handleWeeklySubmitRef = useRef<(status?: "WEEKLY_SCHEDULED" | "DRAFT") => void>(() => {});
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

    const handleFormKeyDown = useFormKeyboardNav(formRef);

    // ── React Hook Form ─────────────────────────────────────────────────────────────
    const {
        control,
        watch,
        setValue,
        getValues,
        reset,
        formState: { isDirty: rhfIsDirty },
    } = useForm<WeeklyPlanFormValues>({
        resolver: zodResolver(weeklyPlanSchema),
        defaultValues,
    });

    const watchProductionOrderId = watch("productionOrderId");

    // Clear and reset form helper
    const handleClear = useCallback(() => {
        if (machines.length > 0) {
            const initial = machines.map((m) => ({
                uid: crypto.randomUUID(),
                machineId: m.machineId,
                items: [{ uid: crypto.randomUUID(), productItemId: "", targetQty: 0, narration: "" }],
            }));
            setWeeklyGroups(initial);
            initialWeeklySnapshotRef.current = JSON.stringify(
                initial.map((g) => ({
                    machineId: g.machineId,
                    items: g.items.map((it) => ({
                        productItemId: it.productItemId,
                        targetQty: it.targetQty,
                        narration: it.narration,
                    })),
                }))
            );
        } else {
            const initial = [newWeeklyGroup()];
            setWeeklyGroups(initial);
            initialWeeklySnapshotRef.current = JSON.stringify(
                initial.map((g) => ({
                    machineId: g.machineId,
                    items: g.items.map((it) => ({
                        productItemId: it.productItemId,
                        targetQty: it.targetQty,
                        narration: it.narration,
                    })),
                }))
            );
        }
        reset({
            productionOrderId: getValues("productionOrderId"),
            weekStartDate: "",
            weekEndDate: "",
        });
        setWeeklyErrors({});
        if (!isWeeklyEditMode) {
            productionOrderService
                .fetchNextId()
                .then((orderNo) => setValue("productionOrderId", orderNo))
                .catch(() => {});
        }
        setTimeout(() => {
            formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus();
        }, 100);
    }, [machines, reset, getValues, setValue, isWeeklyEditMode]);

    useFormShortcuts({
        onSave: () => {
            handleWeeklySubmitRef.current("WEEKLY_SCHEDULED");
        },
        onDelete: () => {
            handleClear();
        },
    });

    // Ref to remember blocker's proceed()/reset()
    const proceedRef = useRef<(() => void) | null>(null);
    const resetRef = useRef<(() => void) | null>(null);

    const isWeeklyDirty = useMemo(() => {
        if (!initialWeeklySnapshotRef.current) return false;
        const currentSnapshot = JSON.stringify(
            weeklyGroups.map((g) => ({
                machineId: g.machineId,
                items: g.items.map((it) => ({
                    productItemId: it.productItemId,
                    targetQty: it.targetQty,
                    narration: it.narration,
                })),
            }))
        );
        return currentSnapshot !== initialWeeklySnapshotRef.current;
    }, [weeklyGroups]);

    const isDirty = rhfIsDirty || isWeeklyDirty;

    useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);

    useEffect(() => {
        saveConfirmOpenRef.current = saveConfirmOpen;
    }, [saveConfirmOpen]);

    useDirtyNavGuard(isDirty, (proceed, resetGuard) => {
        proceedRef.current = proceed;
        resetRef.current = resetGuard;
        lastFocusedRef.current = document.activeElement as HTMLElement | null;
        setSaveConfirmOpen(true);
    });

    const hasAnyLockedWeeklyOrder = useMemo(() => {
        return isWeeklyEditMode && weeklyGroups.some((g) => g.items.some((it) => it.isLocked));
    }, [isWeeklyEditMode, weeklyGroups]);

    // ── Load Dependencies ─────────────────────────────────────────────────────────
    const extractArray = useCallback((d: any): any[] => {
        if (Array.isArray(d)) return d;
        if (Array.isArray(d?.data)) return d.data;
        if (Array.isArray(d?.data?.data)) return d.data.data;
        return [];
    }, []);

    const fetchProductsData = useCallback(() => {
        productService.fetchAll().then((r) => setProducts(extractArray(r))).catch(() => {});
    }, [extractArray]);

    const fetchMachinesData = useCallback(() => {
        machineService.getAll({ limit: 500 }).then((r) => {
            const arr = Array.isArray(r) ? r : (r?.machines ?? r?.data ?? []);
            setMachines(arr);
        }).catch(() => {});
    }, []);

    const fetchExistingOrdersData = useCallback(() => {
        productionOrderService.fetchAll({ pageSize: 1000 })
            .then((r) => {
                const arr = extractArray(r);
                setExistingOrders(arr);
            })
            .catch(() => {});
    }, [extractArray]);

    useSocketSync("product", undefined, fetchProductsData);
    useSocketSync("machine", undefined, fetchMachinesData);
    useSocketSync("productionOrder", undefined, fetchExistingOrdersData);

    useEffect(() => {
        fetchProductsData();
        fetchMachinesData();
        fetchExistingOrdersData();
    }, [fetchProductsData, fetchMachinesData, fetchExistingOrdersData]);

    // Compute set of all dates belonging to already planned weeks
    const bookedDatesSet = useMemo(() => {
        const set = new Set<string>();
        const currentOrderId = watchProductionOrderId || (id ? String(id) : "");
        const currentBaseId = getBaseId(currentOrderId);

        existingOrders.forEach((po: any) => {
            if (po.status?.toUpperCase() === "CANCELLED") return;

            const poId = po.productionOrderId || "";
            const poBaseId = getBaseId(poId);

            // In weekly edit mode, do not disable the dates belonging to the order/group currently being edited
            if (isWeeklyEditMode) {
                if (
                    poId === currentOrderId ||
                    (currentBaseId && poBaseId === currentBaseId) ||
                    (id && String(po.id) === String(id))
                ) {
                    return;
                }
            }

            const startRaw = po.weekStartDate || po.orderDate;
            const startStr = toDateInputString(startRaw, "");
            if (!startStr) return;

            const endRaw = po.weekEndDate || po.dueDate;
            const endStr = toDateInputString(endRaw, startStr);

            let curr = startStr;
            let count = 0;
            while (curr <= endStr && count < 60) {
                set.add(curr);
                curr = addDays(curr, 1);
                count++;
            }
        });

        return set;
    }, [existingOrders, isWeeklyEditMode, id, watchProductionOrderId]);

    const isDateDisabled = useCallback((date: Date): boolean => {
        const dateStr = formatLocalDate(date);
        return bookedDatesSet.has(dateStr);
    }, [bookedDatesSet]);

    // Clear schedules error when any product with qty > 0 is entered
    useEffect(() => {
        if (weeklyErrors.schedules) {
            const hasAny = weeklyGroups.some(g => g.items.some(it => it.productItemId && it.targetQty > 0));
            if (hasAny) setWeeklyErrors(prev => ({ ...prev, schedules: undefined }));
        }
    }, [weeklyGroups, weeklyErrors.schedules]);

    // Helper function to build weekly groups from a list of PO children
    const populateWeeklyPlan = useCallback((baseId: string, children: any[], weekStart?: string, weekEnd?: string) => {
        setIsWeeklyEditMode(true);
        setValue("productionOrderId", baseId || "");
        if (weekStart) setValue("weekStartDate", toDateInputString(weekStart, today));
        if (weekEnd) setValue("weekEndDate", toDateInputString(weekEnd, ""));

        const groupMap = new Map<string, WeeklyGroup>();
        children.forEach((child: any) => {
            const machineId = child.machineMachineId || child.Machine?.machineId || "";
            if (!groupMap.has(machineId)) {
                groupMap.set(machineId, { uid: crypto.randomUUID(), machineId, items: [] });
            }
            const isLocked = child._editRestrictions
                ? (!child._editRestrictions.canEditProductQty || !child._editRestrictions.canEditDates || !child._editRestrictions.canDelete)
                : (child.status && !["DRAFT", "WEEKLY_SCHEDULED"].includes(child.status.toUpperCase()));

            groupMap.get(machineId)!.items.push({
                uid: crypto.randomUUID(),
                productItemId: child.productItem?.id?.toString() || child.productId?.toString() || "",
                targetQty: Number(child.targetQty || 0),
                narration: child.remarks || "",
                existingPoId: child.productionOrderId,
                isLocked: Boolean(isLocked),
                lockReason: child._editRestrictions?.reason || (isLocked ? "Assigned to Daily Production Plan" : undefined),
            });
        });

        // Also include any other known machines so all machines are visible
        machines.forEach((m) => {
            if (m.machineId && !groupMap.has(m.machineId)) {
                groupMap.set(m.machineId, {
                    uid: crypto.randomUUID(),
                    machineId: m.machineId,
                    items: [{ uid: crypto.randomUUID(), productItemId: "", targetQty: 0, narration: "", isLocked: false }],
                });
            }
        });

        const machineOrderMap = new Map<string, number>();
        machines.forEach((m, idx) => {
            if (m.machineId) machineOrderMap.set(m.machineId, idx);
        });

        const sortedGroups = Array.from(groupMap.values()).sort((a, b) => {
            const orderA = machineOrderMap.has(a.machineId) ? machineOrderMap.get(a.machineId)! : 999;
            const orderB = machineOrderMap.has(b.machineId) ? machineOrderMap.get(b.machineId)! : 999;
            return orderA - orderB;
        });

        setWeeklyGroups(sortedGroups);
        initialWeeklySnapshotRef.current = JSON.stringify(
            sortedGroups.map((g) => ({
                machineId: g.machineId,
                items: g.items.map((it) => ({
                    productItemId: it.productItemId,
                    targetQty: it.targetQty,
                    narration: it.narration,
                })),
            }))
        );

        const firstChildPo = children[0];
        if (firstChildPo?.productionOrderId) {
            productionOrderService.getById(firstChildPo.productionOrderId).then((fullOrder) => {
                setAuditInfo({
                    createdAt: fullOrder.createdAt,
                    createdBy: (fullOrder as any).createdUserName || (fullOrder as any).createdUser?.fullName || (fullOrder as any).createdBy,
                    editHistory: (fullOrder as any).editHistory || (fullOrder as any).statusHistory,
                });
            }).catch(() => {
                setAuditInfo({
                    createdAt: firstChildPo.createdAt,
                    createdBy: firstChildPo.createdUserName || firstChildPo.createdBy,
                    editHistory: firstChildPo.editHistory || firstChildPo.statusHistory,
                });
            });
        }

        // Live check against daily plans API to ensure all assigned items are locked
        dailyPlanService.getAll().then((plansRes: any) => {
            const rawList = plansRes?.data?.data || plansRes?.data || (Array.isArray(plansRes) ? plansRes : []);
            const allPlans: any[] = Array.isArray(rawList) ? rawList : [];
            const assignedPoIds = new Set(
                allPlans
                    .filter((p: any) => p.status !== "CANCELLED" && p.productionOrderId)
                    .map((p: any) => p.productionOrderId)
            );

            if (assignedPoIds.size > 0) {
                setWeeklyGroups((prev) =>
                    prev.map((g) => ({
                        ...g,
                        items: g.items.map((it) => {
                            if (it.existingPoId && assignedPoIds.has(it.existingPoId)) {
                                return {
                                    ...it,
                                    isLocked: true,
                                    lockReason: "Assigned to Daily Production Plan",
                                };
                            }
                            return it;
                        }),
                    }))
                );
            }
        }).catch(() => {});
    }, [machines, setValue]);

    // Auto-populate all machine groups in create mode
    useEffect(() => {
        if (machines.length > 0 && !isWeeklyEditMode) {
            setWeeklyGroups((prev) => {
                const isInitial =
                    prev.length === 0 ||
                    (prev.length === 1 &&
                        !prev[0].machineId &&
                        prev[0].items.every((it) => !it.productItemId && !it.targetQty));
                if (isInitial) {
                    const initial = machines.map((m) => ({
                        uid: crypto.randomUUID(),
                        machineId: m.machineId,
                        items: [{ uid: crypto.randomUUID(), productItemId: "", targetQty: 0, narration: "" }],
                    }));
                    if (!initialWeeklySnapshotRef.current) {
                        initialWeeklySnapshotRef.current = JSON.stringify(
                            initial.map((g) => ({
                                machineId: g.machineId,
                                items: g.items.map((it) => ({
                                    productItemId: it.productItemId,
                                    targetQty: it.targetQty,
                                    narration: it.narration,
                                })),
                            }))
                        );
                    }
                    return initial;
                }

                // If some machines are missing, append missing machines as empty groups
                const existingMachineIds = new Set(prev.map((g) => g.machineId).filter(Boolean));
                const missingMachines = machines.filter((m) => !existingMachineIds.has(m.machineId));
                if (missingMachines.length > 0) {
                    const extraGroups = missingMachines.map((m) => ({
                        uid: crypto.randomUUID(),
                        machineId: m.machineId,
                        items: [{ uid: crypto.randomUUID(), productItemId: "", targetQty: 0, narration: "" }],
                    }));
                    return [...prev, ...extraGroups];
                }

                return prev;
            });
        }
    }, [machines, isWeeklyEditMode]);

    // Hydrate form on mount (from route param :id or from location.state)
    useEffect(() => {
        const locState = (location.state || {}) as {
            editWeeklyPlan?: boolean;
            baseId?: string;
            children?: any[];
            weekStart?: string;
            weekEnd?: string;
        };

        if (locState.editWeeklyPlan && locState.children && locState.children.length > 0) {
            populateWeeklyPlan(locState.baseId || "", locState.children, locState.weekStart, locState.weekEnd);
        } else if (id) {
            // URL parameter /production-orders/edit/:id support
            const baseId = getBaseId(id);
            productionOrderService.fetchAll({ pageSize: 1000 }).then((res) => {
                const arr = extractArray(res);
                const related = arr.filter((po: any) => {
                    const poBaseId = getBaseId(po.productionOrderId || "");
                    return poBaseId === baseId || po.productionOrderId === id || String(po.id) === String(id);
                });
                if (related.length > 0) {
                    const first = related[0];
                    populateWeeklyPlan(baseId, related, first.weekStartDate, first.weekEndDate);
                } else {
                    // Fallback to fetch by single ID
                    productionOrderService.getById(id).then((singlePo) => {
                        populateWeeklyPlan(singlePo.productionOrderId || baseId, [singlePo], (singlePo as any).weekStartDate, (singlePo as any).weekEndDate);
                    }).catch(() => {
                        toast.error("Failed to load production order");
                    });
                }
            }).catch(() => {
                toast.error("Failed to load production orders");
            });
        } else {
            setIsWeeklyEditMode(false);
            setAuditInfo(null);
            reset(defaultValues);
            productionOrderService
                .fetchNextId()
                .then((orderNo) => setValue("productionOrderId", orderNo))
                .catch(() => {});
        }
    }, [id, location.state, populateWeeklyPlan, extractArray, reset, setValue]);

    const machineOptions = useMemo(
        () =>
            machines.map((m) => ({
                label: m.machineName || m.machineId,
                value: m.machineId,
            })),
        [machines]
    );

    const productOptions = useMemo(
        () =>
            products.map((p) => ({
                label: p.productName || "",
                value: p.id?.toString() || "",
            })),
        [products]
    );

    // F5 Refresh handler
    useEffect(() => {
        const handleRefresh = async () => {
            if (!isWeeklyEditMode) {
                handleClear();
                toast.info("Form reset");
            }
        };
        window.addEventListener("fkey-refresh", handleRefresh);
        return () => window.removeEventListener("fkey-refresh", handleRefresh);
    }, [isWeeklyEditMode, handleClear]);

    const openDiscardModal = useCallback(() => {
        lastFocusedRef.current = document.activeElement as HTMLElement | null;
        setSaveConfirmOpen(true);
    }, []);

    const handleResume = useCallback(() => {
        setSaveConfirmOpen(false);
        if (resetRef.current) {
            const r = resetRef.current;
            proceedRef.current = null;
            resetRef.current = null;
            r();
        }
        setTimeout(() => {
            if (lastFocusedRef.current && typeof lastFocusedRef.current.focus === "function") {
                lastFocusedRef.current.focus();
            } else {
                formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus();
            }
        }, 50);
    }, []);

    const handleDiscard = useCallback(() => {
        setSaveConfirmOpen(false);
        if (proceedRef.current) {
            const p = proceedRef.current;
            proceedRef.current = null;
            resetRef.current = null;
            p();
            return;
        }
        navigate(-1);
    }, [navigate]);

    const handleBack = useCallback(() => {
        if (isDirtyRef.current) {
            openDiscardModal();
        } else {
            navigate(-1);
        }
    }, [openDiscardModal, navigate]);

    const handleConfirmSave = useCallback(() => {
        setSaveConfirmOpen(false);
        handleWeeklySubmitRef.current("WEEKLY_SCHEDULED");
    }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (document.querySelector("[data-select-portal], [aria-expanded='true'][data-nav]")) return;
            e.preventDefault();
            e.stopPropagation();

            if (saveConfirmOpenRef.current) {
                handleResume();
            } else if (isDirtyRef.current) {
                openDiscardModal();
            } else {
                navigate(-1);
            }
        };
        window.addEventListener("keydown", handleEscape, { capture: true });
        return () => window.removeEventListener("keydown", handleEscape, { capture: true });
    }, [handleResume, openDiscardModal, navigate]);

    // Auto-focus first navigable field on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            const first = formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled]), input:not([disabled])");
            first?.focus();
        }, 250);
        return () => clearTimeout(timer);
    }, []);

    // ── Weekly Plan Submit ───────────────────────────────────────────────────────
    const onWeeklySubmit = async (targetStatus: "WEEKLY_SCHEDULED" | "DRAFT" = "WEEKLY_SCHEDULED") => {
        const weekStart = (getValues("weekStartDate") ?? "") as string;
        const weekEnd = (getValues("weekEndDate") ?? "") as string;
        const baseOrderId = getValues("productionOrderId");

        const allOrders: Array<{ group: WeeklyGroup; item: WeeklyGroup["items"][number]; gIdx: number; iIdx: number }> = [];
        weeklyGroups.forEach((group, gIdx) => {
            group.items.forEach((item, iIdx) => {
                if (item.productItemId && item.targetQty > 0) {
                    allOrders.push({ group, item, gIdx, iIdx });
                }
            });
        });

        const validationErrors: { weekStart?: string; weekEnd?: string; schedules?: string } = {};
        if (!weekStart) validationErrors.weekStart = "Week Start Date is required";
        if (!weekEnd) validationErrors.weekEnd = "Week End Date is required";
        else if (weekEnd < weekStart) validationErrors.weekEnd = "Week End Date must be on or after Week Start Date";
        if (allOrders.length === 0) validationErrors.schedules = "At least one product with quantity > 0 is required";
        if (Object.keys(validationErrors).length > 0) {
            setWeeklyErrors(validationErrors);
            return;
        }
        setWeeklyErrors({});

        setIsWeeklySubmitting(true);
        try {
            const locState = (location.state || {}) as { children?: any[]; order?: any };
            const existingOrderDate = locState.order?.orderDate || locState.children?.[0]?.orderDate;
            const orderDate = existingOrderDate ? new Date(existingOrderDate).toISOString() : new Date(weekStart || new Date()).toISOString();
            const dueDate = new Date(weekEnd || weekStart || new Date()).toISOString();

            // Track all used PO IDs across existingOrders, locState.children, and all current groups
            const usedPoIds = new Set<string>();
            existingOrders.forEach((o: any) => {
                if (o.productionOrderId) usedPoIds.add(o.productionOrderId);
            });
            (locState.children || []).forEach((c: any) => {
                if (c.productionOrderId) usedPoIds.add(c.productionOrderId);
            });
            weeklyGroups.forEach((g) => {
                g.items.forEach((it) => {
                    if (it.existingPoId) usedPoIds.add(it.existingPoId);
                });
            });

            // Helper to get consistent machine number (mNum) for a group
            const getMachineIndex = (group: WeeklyGroup, gIdx: number): number => {
                for (const it of group.items) {
                    if (it.existingPoId) {
                        const match = it.existingPoId.match(/-M(\d+)-/);
                        if (match) return parseInt(match[1], 10);
                    }
                }
                const mIndex = machines.findIndex((m) => m.machineId === group.machineId);
                if (mIndex >= 0) return mIndex + 1;
                return gIdx + 1;
            };

            // Helper to generate a unique, non-colliding PO ID
            const generateUniquePoId = (group: WeeklyGroup, gIdx: number): string => {
                const mNum = getMachineIndex(group, gIdx);
                let itemNum = 1;
                let candidateId = `${baseOrderId}-M${mNum}-${itemNum}`.slice(0, 20);
                while (usedPoIds.has(candidateId)) {
                    itemNum++;
                    candidateId = `${baseOrderId}-M${mNum}-${itemNum}`.slice(0, 20);
                }
                usedPoIds.add(candidateId);
                return candidateId;
            };

            const payloads = allOrders.map(({ group, item, gIdx }) => {
                const product = products.find((p) => p.id?.toString() === item.productItemId);
                const rawUom = product?.uom?.uomCode || product?.uom?.name || "PCS";
                const uom = rawUom.slice(0, 10);
                const orderId = generateUniquePoId(group, gIdx);
                return {
                    productionOrderId: orderId,
                    orderDate,
                    dueDate,
                    priority: "MEDIUM",
                    orderType: "STANDARD",
                    machineMachineId: group.machineId || null,
                    weekStartDate: weekStart,
                    weekEndDate: weekEnd,
                    status: targetStatus,
                    productItemId: item.productItemId,
                    targetQty: Number(item.targetQty),
                    uom,
                    remarks: item.narration || null,
                    rawMaterials: [],
                };
            });

            if (isWeeklyEditMode) {
                // Update existing POs (skip locked ones that are assigned to daily planning)
                const updatePromises = allOrders
                    .filter(({ item }) => item.existingPoId && !item.isLocked)
                    .map(({ group, item }) => {
                        return productionOrderService.update(item.existingPoId!, {
                            targetQty: Number(item.targetQty),
                            remarks: item.narration || null,
                            status: targetStatus,
                            machineMachineId: group.machineId || null,
                            productItemId: item.productItemId,
                            weekStartDate: weekStart,
                            weekEndDate: weekEnd,
                            orderDate,
                            dueDate,
                        } as any);
                    });

                // Create new POs added during edit mode
                const createPromises = allOrders
                    .filter(({ item }) => !item.existingPoId)
                    .map(({ group, item, gIdx }) => {
                        const product = products.find((p) => p.id?.toString() === item.productItemId);
                        const rawUom = product?.uom?.uomCode || product?.uom?.name || "PCS";
                        const uom = rawUom.slice(0, 10);
                        const orderId = generateUniquePoId(group, gIdx);
                        return productionOrderService.create({
                            productionOrderId: orderId,
                            orderDate,
                            dueDate,
                            priority: "MEDIUM",
                            orderType: "STANDARD",
                            machineMachineId: group.machineId || null,
                            weekStartDate: weekStart,
                            weekEndDate: weekEnd,
                            status: targetStatus,
                            productItemId: item.productItemId,
                            targetQty: Number(item.targetQty),
                            uom,
                            remarks: item.narration || null,
                            rawMaterials: [],
                        } as any);
                    });

                // Delete POs that were removed during edit
                const keptPoIds = new Set(allOrders.map(({ item }) => item.existingPoId).filter(Boolean));
                const initialPoIds: string[] = (locState.children || []).map((c: any) => c.productionOrderId).filter(Boolean);
                const removedPoIds = initialPoIds.filter((poId: string) => !keptPoIds.has(poId));
                const deletePromises = removedPoIds.map((poId: string) => productionOrderService.delete(poId).catch(() => {}));

                await Promise.all([...updatePromises, ...createPromises, ...deletePromises]);
                toast.success(targetStatus === "DRAFT"
                    ? "Weekly plan saved as draft — updated successfully!"
                    : "Weekly plan updated successfully!");
            } else {
                await Promise.all(payloads.map((p) => productionOrderService.create(p as any)));
                toast.success(targetStatus === "DRAFT"
                    ? `Weekly plan saved as draft — ${allOrders.length} order(s) saved!`
                    : `Weekly plan created — ${allOrders.length} order(s) generated!`);
            }

            if (proceedRef.current) {
                const p = proceedRef.current;
                proceedRef.current = null;
                resetRef.current = null;
                p();
                return;
            }
            navigate("/production-orders");
        } catch (err: any) {
            const data = err?.response?.data;
            const apiErrors: Array<{ path: string; message: string }> = data?.errors || [];
            const detail = apiErrors.length
                ? apiErrors.map((e) => `${e.path}: ${e.message}`).join(" | ")
                : data?.message || err?.message || "Failed to create weekly plan";
            toast.error(detail);
        } finally {
            setIsWeeklySubmitting(false);
        }
    };

    handleWeeklySubmitRef.current = onWeeklySubmit;

    return (
        <>
            <div className="w-full">
                <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                    {/* Page Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-5 py-4 border-b border-line">
                        <div className="flex flex-col">
                            <h3 className="text-lg font-bold text-ink flex items-start">
                                {isWeeklyEditMode ? "Edit Weekly Plan" : "Create Production Order"}
                                <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{watchProductionOrderId}</span>
                            </h3>
                            {isWeeklyEditMode && <RecordAuditInfo auditData={auditInfo} title="Production Order" />}
                        </div>
                        <div className="flex items-center gap-2">
                            <CustomButton
                                text="Back to List"
                                icon={FaArrowLeft}
                                variant="secondary"
                                onClick={handleBack}
                            />
                        </div>
                    </div>

                    <form
                        ref={formRef}
                        onSubmit={(e) => {
                            e.preventDefault();
                            onWeeklySubmit("WEEKLY_SCHEDULED");
                        }}
                        onKeyDown={handleFormKeyDown}
                        data-escape-guarded
                        className="p-4 lg:p-5 space-y-4"
                        noValidate
                    >
                        {/* Week Dates */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2">
                            <Controller
                                name="weekStartDate"
                                control={control}
                                render={({ field }) => (
                                    <DatePickerCalendar
                                        label="Week Start"
                                        name={field.name}
                                        value={field.value ? field.value.substring(0, 10) : ""}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            field.onChange(val);
                                            if (weeklyErrors.weekStart) setWeeklyErrors(prev => ({ ...prev, weekStart: undefined }));
                                            const currentWeekEnd = getValues("weekEndDate");
                                            if (currentWeekEnd && val && currentWeekEnd < val) {
                                                setValue("weekEndDate", "", { shouldDirty: true, shouldValidate: true });
                                            }
                                        }}
                                        isDateDisabled={isDateDisabled}
                                        disabled={hasAnyLockedWeeklyOrder}
                                        error={weeklyErrors.weekStart}
                                        horizontal
                                    />
                                )}
                            />
                            <Controller
                                name="weekEndDate"
                                control={control}
                                render={({ field }) => (
                                    <DatePickerCalendar
                                        label="Week End"
                                        name={field.name}
                                        value={field.value ? field.value.substring(0, 10) : ""}
                                        onChange={(e) => {
                                            field.onChange(e.target.value);
                                            if (weeklyErrors.weekEnd) setWeeklyErrors(prev => ({ ...prev, weekEnd: undefined }));
                                        }}
                                        minDate={watch("weekStartDate") ? watch("weekStartDate")?.substring(0, 10) : undefined}
                                        isDateDisabled={isDateDisabled}
                                        disabled={hasAnyLockedWeeklyOrder}
                                        error={weeklyErrors.weekEnd}
                                        horizontal
                                    />
                                )}
                            />
                        </div>

                        {/* Machine Groups / Production Schedules */}
                        <div className="flex items-center justify-between mb-1">
                            <div>
                                <h3 className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Production Schedules</h3>
                                {weeklyErrors.schedules && (
                                    <p className="text-red-400 text-xs font-medium mt-0.5">{weeklyErrors.schedules}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {weeklyGroups.map((group, gIdx) => {
                                const hasLockedItems = group.items.some((it) => it.isLocked);
                                const usedMachineIds = new Set(
                                    weeklyGroups
                                        .filter((_, i) => i !== gIdx)
                                        .map((g) => g.machineId)
                                        .filter(Boolean)
                                );
                                const filteredMachineOptions = machineOptions.map((opt) => ({
                                    ...opt,
                                    disabled: usedMachineIds.has(String(opt.value)),
                                }));

                                return (
                                    <div key={group.uid} id={`weekly-group-${group.uid}`} className="border border-line rounded-xl p-4">
                                        {/* Machine selector */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="flex-1">
                                                <SelectInput
                                                    label="Machine"
                                                    horizontal
                                                    name={`weekly-machine-${group.uid}`}
                                                    value={group.machineId}
                                                    options={filteredMachineOptions}
                                                    defaultOptionLabel="Select Machine"
                                                    disabled={hasLockedItems}
                                                    onChange={(e) =>
                                                        setWeeklyGroups((prev) =>
                                                            prev.map((g, i) => i === gIdx ? { ...g, machineId: e.target.value } : g)
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>

                                        {/* Product + Qty Table */}
                                        <BusyItemsTable
                                            columns={[
                                                {
                                                    key: "productItemId",
                                                    header: "Product",
                                                    width: "1fr",
                                                    render: (row: any, iIdx: number) => {
                                                        const isRowLocked = Boolean(row.isLocked);
                                                        const usedIds = new Set(
                                                            group.items
                                                                .filter((_, j) => j !== iIdx)
                                                                .map((it) => it.productItemId)
                                                                .filter(Boolean)
                                                        );
                                                        const opts = productOptions.map((o) => ({
                                                            ...o,
                                                            disabled: usedIds.has(o.value),
                                                        }));
                                                        return (
                                                            <div className="w-full">
                                                                <AutocompleteInput
                                                                    inline
                                                                    name={`weekly-${group.uid}-product-${iIdx}`}
                                                                    value={group.items[iIdx]?.productItemId || ""}
                                                                    options={opts}
                                                                    placeholder="Type to search..."
                                                                    disabled={isRowLocked}
                                                                    onChange={(v) => {
                                                                        setWeeklyGroups((prev) =>
                                                                            prev.map((g, gi) =>
                                                                                gi !== gIdx ? g : {
                                                                                    ...g,
                                                                                    items: g.items.map((it, ii) =>
                                                                                        ii === iIdx ? { ...it, productItemId: v } : it
                                                                                    )
                                                                                }
                                                                            )
                                                                        );
                                                                        // Auto-focus Qty cell so user can enter quantity immediately
                                                                        const focusQty = () => {
                                                                            const groupEl = document.getElementById(`weekly-group-${group.uid}`);
                                                                            const qtyCell = groupEl?.querySelector(`[data-r="${iIdx}"][data-c="1"]`) as HTMLElement | null;
                                                                            const qtyInput = qtyCell?.querySelector("input") as HTMLInputElement | null;
                                                                            if (qtyInput) {
                                                                                qtyInput.focus();
                                                                                qtyInput.select();
                                                                                return true;
                                                                            }
                                                                            return false;
                                                                        };
                                                                        if (!focusQty()) {
                                                                            setTimeout(focusQty, 50);
                                                                            setTimeout(focusQty, 120);
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        );
                                                    },
                                                },
                                                {
                                                    key: "targetQty",
                                                    header: "Qty",
                                                    width: "100px",
                                                    align: "center" as const,
                                                    render: (row: any, iIdx: number) => {
                                                        const isRowLocked = Boolean(row.isLocked);
                                                        return (
                                                            <input
                                                                type="text"
                                                                data-nav
                                                                inputMode="numeric"
                                                                value={row.targetQty || ""}
                                                                disabled={isRowLocked}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/[^0-9.]/g, "");
                                                                    setWeeklyGroups((prev) =>
                                                                        prev.map((g, gi) =>
                                                                            gi !== gIdx ? g : {
                                                                                ...g,
                                                                                items: g.items.map((it, ii) =>
                                                                                    ii === iIdx ? { ...it, targetQty: Number(val) } : it
                                                                                )
                                                                            }
                                                                        )
                                                                    );
                                                                }}
                                                                placeholder="0"
                                                                className="w-full bg-transparent text-[13px] text-ink text-center outline-none border-none p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            />
                                                        );
                                                    },
                                                },
                                                {
                                                    key: "narration",
                                                    header: "Narration",
                                                    width: "1fr",
                                                    render: (row: any, iIdx: number) => {
                                                        const isRowLocked = Boolean(row.isLocked);
                                                        return (
                                                            <input
                                                                type="text"
                                                                data-nav
                                                                value={row.narration || ""}
                                                                disabled={isRowLocked}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setWeeklyGroups((prev) =>
                                                                        prev.map((g, gi) =>
                                                                            gi !== gIdx ? g : {
                                                                                ...g,
                                                                                items: g.items.map((it, ii) =>
                                                                                    ii === iIdx ? { ...it, narration: val } : it
                                                                                )
                                                                            }
                                                                        )
                                                                    );
                                                                }}
                                                                placeholder="Notes..."
                                                                className="w-full bg-transparent text-[13px] text-ink outline-none border-none p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            />
                                                        );
                                                    },
                                                },
                                            ]}
                                            rows={group.items}
                                            isRowDeletable={(row) => !row.isLocked}
                                            rowDeleteDisabledMessage={(row) => row.lockReason || "Cannot delete: This order is assigned to Daily Production Plan"}
                                            onAdd={() =>
                                                setWeeklyGroups((prev) =>
                                                    prev.map((g, gi) =>
                                                        gi !== gIdx ? g : {
                                                            ...g,
                                                            items: [...g.items, { uid: crypto.randomUUID(), productItemId: "", targetQty: 0, narration: "", isLocked: false }],
                                                        }
                                                    )
                                                )
                                            }
                                            onRemove={(iIdx) => {
                                                const item = group.items[iIdx];
                                                if (item?.isLocked) {
                                                    toast.warning(item.lockReason || "Cannot delete: This order is assigned to Daily Production Plan");
                                                    return;
                                                }
                                                setWeeklyGroups((prev) =>
                                                    prev.map((g, gi) =>
                                                        gi !== gIdx ? g : {
                                                            ...g,
                                                            items: g.items.filter((_, ii) => ii !== iIdx),
                                                        }
                                                    )
                                                );
                                            }}
                                            editable
                                            visibleRows={6}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── Form Actions ──────────────────────────────────────── */}
                        <div className="flex justify-end gap-2 pt-4 border-t border-line">
                            <CustomButton
                                text="Clear"
                                icon={FaEraser}
                                variant="secondary"
                                onClick={handleClear}
                                disabled={isWeeklySubmitting}
                            />
                            <CustomButton
                                text={isWeeklySubmitting ? "Saving..." : "Save as Draft"}
                                icon={isWeeklySubmitting ? undefined : FaSave}
                                variant="secondary"
                                type="button"
                                onClick={() => onWeeklySubmit("DRAFT")}
                                disabled={isWeeklySubmitting || !(isWeeklyEditMode ? can("production_orders.edit") : can("production_orders.create"))}
                            />
                            <CustomButton
                                text={isWeeklySubmitting ? (isWeeklyEditMode ? "Updating..." : "Creating...") : (isWeeklyEditMode ? "Update Weekly Plan" : "Create Weekly Plan")}
                                icon={isWeeklySubmitting ? undefined : FaSave}
                                type="button"
                                onClick={() => onWeeklySubmit("WEEKLY_SCHEDULED")}
                                disabled={isWeeklySubmitting || !(isWeeklyEditMode ? can("production_orders.edit") : can("production_orders.create"))}
                            />
                        </div>
                    </form>
                </div>
            </div>

            <CommonConfirmModal
                show={saveConfirmOpen}
                onHide={handleResume}
                onConfirm={handleConfirmSave}
                title="Unsaved Changes"
                message="You have unsaved changes. Do you want to save before leaving?"
                confirmText="Save"
                cancelText="Discard"
                confirmVariant="primary"
                confirmIcon={FaCheck}
                onCancel={handleDiscard}
            />
        </>
    );
};

export default ProductionOrderCreate;
