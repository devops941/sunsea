import { formatDate } from "../../../utils/dateUtils";
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { usePermission } from "../../../hooks/usePermission";
import { FaSave, FaEraser, FaCheck, FaArrowLeft } from "react-icons/fa";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import RecordAuditInfo, { type AuditData } from "../../../components/ui/RecordAuditInfo/RecordAuditInfo";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, Controller, useFieldArray, useWatch, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import BusyItemsTable, { type BusyColumn } from "../../../components/form/OrderItemsTable/BusyItemsTable";
import AutocompleteInput from "../../../components/form/AutocompleteInput/AutocompleteInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import DatePickerCalendar, { formatLocalDate } from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";

import { productionOrderService } from "../../../services/productionOrderService";
import { dailyPlanService } from "../../../services/dailyPlanService";
import { storeService } from "../../../services/storeService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { productService } from "../../../services/productService";
import { machineService } from "../../../services/machineService";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { useDirtyNavGuard } from "../../../hooks/useDirtyNavGuard";



interface RawMaterialOption {
    label: string;
    value: string;
    rawUom: string;
}

interface RowRawMaterialState {
    options: RawMaterialOption[];
    loading: boolean;
    fetchedForStoreId: string | null; // track which storeId we last fetched for
}

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





const productionOrderSchema = z.object({
    id: z.number().optional(),
    products: z.array(z.object({
        productItemId: z.string().min(1, "Product is required"),
        targetQty: z.number().min(0.01, "Target Quantity must be > 0"),
        damageQty: z.number().min(0, "Damage Quantity must be >= 0").optional().default(0),
        uom: z.string().min(1, "UOM is required"),
        sourceSalesOrderLineId: z.string().optional(),
        rawMaterials: z
            .array(
                z.object({
                    rawMaterialId: z.string().min(1, "Raw Material is required"),
                    requiredQty: z
                        .string()
                        .min(1, "Quantity is required")
                        .refine(
                            (val) => !isNaN(Number(val)) && Number(val) > 0,
                            { message: "Must be > 0" }
                        ),
                    uom: z.string().min(1, "UOM is required"),
                    storeId: z.string().min(1, "Store is required"),
                    remarks: z.string().optional(),
                })
            )
            .optional().default([]),
    })).min(1, "At least one product is required"),
    productionOrderId: z.string().min(1, "Order No is required"),
    orderDate: z.string().min(1, "Order Date is required"),
    dueDate: z.string().min(1, "Due Date is required"),
    priority: z.string().optional(),
    orderType: z.string().optional(),
    batchNo: z.string().optional(),
    sourceStoreId: z.string().optional(),
    machineMachineId: z.string().optional().nullable(),
    weekStartDate: z.string().optional().nullable(),
    weekEndDate: z.string().optional().nullable(),
    status: z.string().min(1, "Status is required"),
    remarks: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.dueDate && data.orderDate && data.dueDate < data.orderDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Due date must be on or after the order date",
            path: ["dueDate"],
        });
    }
    if (data.weekStartDate && data.weekEndDate && data.weekEndDate < data.weekStartDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Week End Date must be on or after Week Start Date",
            path: ["weekEndDate"],
        });
    }
});

type ProductionOrderFormValues = z.infer<typeof productionOrderSchema>;

// â”€â”€â”€ Defaults â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const today = new Date().toISOString().split("T")[0];
const nextWeek = new Date(
    new Date().setDate(new Date().getDate() + 7)
).toISOString().split("T")[0];

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

const newWeeklyGroup = (): WeeklyGroup => ({
    uid: crypto.randomUUID(),
    machineId: "",
    items: [{ uid: crypto.randomUUID(), productItemId: "", targetQty: 0, narration: "" }],
});

const defaultValues: ProductionOrderFormValues = {
    id: undefined,
    products: [{ productItemId: "", targetQty: 0, damageQty: 0, uom: "ea", sourceSalesOrderLineId: "", rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }] }],
    productionOrderId: "",
    orderDate: today,
    dueDate: nextWeek,
    priority: "",
    orderType: "",
    batchNo: "",
    sourceStoreId: "",
    machineMachineId: "",
    weekStartDate: "",
    weekEndDate: "",
    status: "CREATED",
    remarks: "",
};


// ————— Inline cell renderers for Raw Materials BusyItemsTable —————
// All inputs are borderless / transparent to match the Sales Order items table style.

const StoreCellRenderer: React.FC<{
    productIndex: number;
    index: number;
    control: any;
    storeOptions: { label: string; value: string }[];
    error?: string;
    onStoreChange: (idx: number, storeId: string) => void;
}> = React.memo(({ productIndex, index, control, storeOptions, error, onStoreChange }) => {
    const { field } = useController({
        control,
        name: `products.${productIndex}.rawMaterials.${index}.storeId` as const,
    });
    return (
        <AutocompleteInput
            inline
            name={field.name}
            value={field.value || ""}
            options={storeOptions}
            placeholder="Select Store"
            error={error}
            onChange={(v) => {
                field.onChange(v);
                onStoreChange(index, v);
                setTimeout(() => {
                    const rmCell = document.querySelector(`[data-r="${index}"][data-c="1"]`) as HTMLElement | null;
                    const rmInput = rmCell?.querySelector("input, [tabindex='0']") as HTMLElement | null;
                    if (rmInput) { rmInput.focus(); }
                }, 50);
            }}
        />
    );
});

const RawMaterialCellRenderer: React.FC<{
    productIndex: number;
    index: number;
    control: any;
    error?: string;
    rowState: RowRawMaterialState;
    onRmChange: (idx: number, rmValue: string) => void;
    fetchRawMaterialsForStore: (storeId: string, fieldId: string) => void;
}> = React.memo(({ productIndex, index, control, error, rowState, onRmChange, fetchRawMaterialsForStore }) => {
    const { field } = useController({
        control,
        name: `products.${productIndex}.rawMaterials.${index}.rawMaterialId` as const,
    });
    const storeId = useWatch({ control, name: `products.${productIndex}.rawMaterials.${index}.storeId` as const });
    const currentRawMaterials = useWatch({ control, name: `products.${productIndex}.rawMaterials` as const });

    // Key by storeId (stable business key) — safe to call on every storeId change because
    // fetchRawMaterialsForStore internally deduplicates via storeRmCacheRef.
    useEffect(() => {
        if (storeId) {
            fetchRawMaterialsForStore(storeId, storeId);
        }
    }, [storeId, fetchRawMaterialsForStore]);

    const { options, loading } = rowState;
    const noStore = !storeId;
    const filteredOptions = options
        .filter((opt) => !currentRawMaterials?.some(
            (rm: any, rmIdx: number) => rmIdx !== index && rm.rawMaterialId === opt.value
        ))
        .map((opt) => ({ value: opt.value, label: opt.label }));

    const placeholder = loading
        ? "Loading..."
        : noStore
            ? "Select Store first"
            : options.length === 0
                ? "No materials"
                : "Select Raw Material";

    return (
        <AutocompleteInput
            inline
            name={field.name}
            value={field.value || ""}
            options={filteredOptions}
            placeholder={placeholder}
            error={error}
            disabled={noStore || loading}
            onChange={(v) => {
                field.onChange(v);
                onRmChange(index, v);
                setTimeout(() => {
                    const qtyCell = document.querySelector(`[data-r="${index}"][data-c="2"]`) as HTMLElement | null;
                    const qtyInput = qtyCell?.querySelector("input") as HTMLInputElement | null;
                    if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
                }, 50);
            }}
        />
    );
});

const QtyUomCellRenderer: React.FC<{
    productIndex: number;
    index: number;
    control: any;
    error?: string;
    rowState: RowRawMaterialState;
    setValue: any;
}> = React.memo(({ productIndex, index, control, rowState, setValue }) => {
    const { field: qtyField } = useController({
        control,
        name: `products.${productIndex}.rawMaterials.${index}.requiredQty` as const,
    });
    const { field: uomField } = useController({
        control,
        name: `products.${productIndex}.rawMaterials.${index}.uom` as const,
    });
    const currentRm = useWatch({ control, name: `products.${productIndex}.rawMaterials.${index}.rawMaterialId` as const });
    const { options } = rowState;
    const selectedRmOption = options.find((opt) => opt.value === currentRm);
    const baseUoms = selectedRmOption ? (selectedRmOption as any).rawUom : (uomField.value || "kg");
    const uomList = baseUoms ? baseUoms.split(",").map((u: string) => u.trim()).filter(Boolean) : ["kg"];
    const primaryUom = uomList[0] || "kg";

    useEffect(() => {
        if (primaryUom && primaryUom !== uomField.value) {
            setValue(`products.${productIndex}.rawMaterials.${index}.uom`, primaryUom);
        }
    }, [primaryUom, productIndex, index, setValue]);

    return (
        <div className="flex items-center w-full h-full gap-1">
            <input
                type="number"
                data-nav
                value={qtyField.value || ""}
                onChange={(e) => qtyField.onChange(e.target.value)}
                placeholder="0.000"
                step="any"
                min="0"
                className="flex-1 min-w-0 bg-transparent text-[13px] text-ink outline-none border-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-ink-subtle placeholder:font-normal"
            />
            {uomList.length > 1 ? (
                <select
                    value={uomField.value || primaryUom}
                    onChange={(e) => uomField.onChange(e.target.value)}
                    className="bg-transparent border-none outline-none text-[11px] text-ink-muted cursor-pointer shrink-0 p-0"
                >
                    {uomList.map((u: string) => (
                        <option key={u} value={u} style={{ background: "var(--color-card)", color: "var(--color-ink)" }}>
                            {u.toLowerCase() === "ea" ? "pcs" : u}
                        </option>
                    ))}
                </select>
            ) : (
                <span className="text-[11px] text-ink-muted shrink-0">
                    {primaryUom.toLowerCase() === "ea" ? "pcs" : primaryUom}
                </span>
            )}
        </div>
    );
});

const RemarksCellRenderer: React.FC<{
    productIndex: number;
    index: number;
    control: any;
}> = React.memo(({ productIndex, index, control }) => {
    const { field } = useController({
        control,
        name: `products.${productIndex}.rawMaterials.${index}.remarks` as const,
    });
    return (
        <input
            type="text"
            data-nav
            value={field.value || ""}
            onChange={(e) => field.onChange(e.target.value)}
            placeholder="Narration"
            className="w-full bg-transparent text-[13px] text-ink outline-none border-none p-0 placeholder:text-ink-subtle placeholder:font-normal"
        />
    );
});

interface ProductRawMaterialsSectionProps {
    productIndex: number;
    productName?: string;
    control: any;
    errors: any;
    storeOptions: { label: string; value: string }[];
    rowRmStates: Record<string, RowRawMaterialState>;
    handleStoreChange: (productIndex: number, idx: number, storeId: string, fieldId: string) => void;
    handleRmChange: (productIndex: number, idx: number, rmValue: string, fieldId: string) => void;
    fetchRawMaterialsForStore: (storeId: string, fieldId: string) => void;
    setValue: any;
    isCalculatingRM?: boolean;
}

const ProductRawMaterialsSection: React.FC<ProductRawMaterialsSectionProps> = React.memo(({
    productIndex,
    productName,
    control,
    errors,
    storeOptions,
    rowRmStates,
    handleStoreChange,
    handleRmChange,
    fetchRawMaterialsForStore,
    setValue,
    isCalculatingRM,
}) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `products.${productIndex}.rawMaterials` as const,
    });

    const emptyRmRow = { id: "", rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" };

    const columns: BusyColumn<any>[] = useMemo(() => [
        {
            key: "storeId",
            header: "STORE *",
            width: "minmax(150px, 1.2fr)",
            render: (_row: any, index: number) => (
                <StoreCellRenderer
                    productIndex={productIndex}
                    index={index}
                    control={control}
                    storeOptions={storeOptions}
                    error={errors?.rawMaterials?.[index]?.storeId?.message}
                    // Pass storeId as the fieldId so rowRmStates is keyed by storeId (stable)
                    onStoreChange={(idx: number, sid: string) => handleStoreChange(productIndex, idx, sid, sid)}
                />
            ),
        },
        {
            key: "rawMaterialId",
            header: "RAW MATERIAL *",
            width: "minmax(200px, 1.5fr)",
            render: (row: any, index: number) => (
                <RawMaterialCellRenderer
                    productIndex={productIndex}
                    index={index}
                    control={control}
                    error={errors?.rawMaterials?.[index]?.rawMaterialId?.message}
                    // Key by storeId — survives field-array UUID regeneration
                    rowState={rowRmStates[row.storeId] ?? { options: [], loading: false, fetchedForStoreId: null }}
                    onRmChange={(idx: number, rmValue: string) => handleRmChange(productIndex, idx, rmValue, row.storeId)}
                    fetchRawMaterialsForStore={fetchRawMaterialsForStore}
                />
            ),
        },
        {
            key: "requiredQty",
            header: "REQUIRED QTY & UOM *",
            width: "minmax(170px, 1fr)",
            render: (row: any, index: number) => (
                <QtyUomCellRenderer
                    productIndex={productIndex}
                    index={index}
                    control={control}
                    error={errors?.rawMaterials?.[index]?.requiredQty?.message || errors?.rawMaterials?.[index]?.uom?.message}
                    // Same key — storeId
                    rowState={rowRmStates[row.storeId] ?? { options: [], loading: false, fetchedForStoreId: null }}
                    setValue={setValue}
                />
            ),
        },
        {
            key: "remarks",
            header: "NARRATION",
            width: "minmax(140px, 1fr)",
            render: (_, index) => (
                <RemarksCellRenderer
                    productIndex={productIndex}
                    index={index}
                    control={control}
                />
            ),
        },
    ], [productIndex, control, storeOptions, errors, rowRmStates, handleStoreChange, handleRmChange, fetchRawMaterialsForStore, setValue]);

    return (
        <div className="md:col-span-12 mt-3 relative">
            {isCalculatingRM && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-[2px] rounded-lg overflow-hidden">
                    <div className="scale-[0.6] origin-center -mt-6">
                        <CommonLoader text="Calculating..." fullScreen={false} />
                    </div>
                </div>
            )}
            <div className="mb-2">
                <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">
                    Manual Raw Materials ({productName || `Product ${productIndex + 1}`})
                </h3>
            </div>

            <BusyItemsTable
                columns={columns}
                rows={fields}
                emptyRow={emptyRmRow as any}
                onAdd={() => append({ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" })}
                onRemove={(i) => remove(i)}
                editable={true}
                visibleRows={Math.max(fields.length, 5)}
            />
        </div>
    );
});

// ————————————————————————————————————————————————————————————————————————————————

const ProductionOrderCreate: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams<{ id: string }>();
    const { can } = usePermission();

    // ── Generic state ─────────────────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [orderId, setOrderId] = useState<number | string | null>(null);

    const [stores, setStores] = useState<any[]>([]);
    const [machines, setMachines] = useState<any[]>([]);
    const [isCalculatingRM, setIsCalculatingRM] = useState(false);

    // ── Weekly Plan State ────────────────────────────────────────────────────────
    const [weeklyGroups, setWeeklyGroups] = useState<WeeklyGroup[]>([newWeeklyGroup()]);
    const [isWeeklySubmitting, setIsWeeklySubmitting] = useState(false);
    const [isWeeklyEditMode, setIsWeeklyEditMode] = useState(false);
    const [weeklyErrors, setWeeklyErrors] = useState<{ weekStart?: string; weekEnd?: string; schedules?: string }>({});

    // ── Per-row raw material state ────────────────────────────────────────────────
    const [rowRmStates, setRowRmStates] = useState<Record<string, RowRawMaterialState>>({});
    const storeRmCacheRef = useRef<Record<string, { options: any[]; loading: boolean; promise?: Promise<any> }>>({});

    const [auditInfo, setAuditInfo] = useState<AuditData | null>(null);
    const initialWeeklySnapshotRef = useRef<string>("");

    const formRef = useRef<HTMLFormElement>(null);
    const isDirtyRef = useRef(false);
    const saveConfirmOpenRef = useRef(false);
    const lastFocusedRef = useRef<HTMLElement | null>(null);
    const handleSubmitRef = useRef<() => void>(() => {});
    const handleWeeklySubmitRef = useRef<(status?: "WEEKLY_SCHEDULED" | "DRAFT") => void>(() => {});
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

    handleSubmitRef.current = () => {
        handleSubmit((data) => {
            const targetStatus = data.status === "DRAFT" ? "WEEKLY_SCHEDULED" : data.status;
            onSubmit({ ...data, status: targetStatus });
        })();
    };

    const handleFormKeyDown = useFormKeyboardNav(formRef);

    useFormShortcuts({
        onSave: () => {
            if (!isEditMode && !isWeeklyEditMode) {
                handleWeeklySubmitRef.current("WEEKLY_SCHEDULED");
            } else if (isWeeklyEditMode) {
                handleWeeklySubmitRef.current("WEEKLY_SCHEDULED");
            } else {
                handleSubmitRef.current();
            }
        },
        onDelete: () => {
            if (!isEditMode && !isWeeklyEditMode) {
                reset(defaultValues);
                setRowRmStates({});
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
                productionOrderService
                    .fetchNextId()
                    .then((orderNo) => setValue("productionOrderId", orderNo))
                    .catch(() => {});
                setTimeout(() => {
                    formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus();
                }, 100);
            }
        },
    });

    // Helper: update a single row's state
    const updateRowState = (
        fieldId: string,
        patch: Partial<RowRawMaterialState>
    ) => {
        setRowRmStates((prev) => ({
            ...prev,
            [fieldId]: {
                ...(prev[fieldId] || { options: [], loading: false, fetchedForStoreId: null }),
                ...patch,
            },
        }));
    };

    // ── React Hook Form ─────────────────────────────────────────────────────────────
    const {
        control,
        handleSubmit,
        watch,
        setValue,
        getValues,
        reset,
        formState: { isDirty: rhfIsDirty },
    } = useForm<ProductionOrderFormValues>({
        resolver: zodResolver(productionOrderSchema) as any,
        defaultValues,
    });

    // Ref to remember blocker's proceed()/reset() from the current block-attempt
    // so the existing discard modal can drive them from its buttons.
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

    useDirtyNavGuard(isDirty, (proceed, reset) => {
        proceedRef.current = proceed;
        resetRef.current = reset;
        lastFocusedRef.current = document.activeElement as HTMLElement | null;
        setSaveConfirmOpen(true);
    });

    const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({
        control,
        name: "products",
    });

    const watchProducts = useWatch({ control, name: "products" });
    const watchStatus = useWatch({ control, name: "status" });
    // DRAFT or CREATED edit → promote to READY_FOR_PLANNING on main submit
    const isDraftEdit = isEditMode && (watchStatus === "DRAFT" || watchStatus === "CREATED");

    const hasAnyLockedWeeklyOrder = useMemo(() => {
        return isWeeklyEditMode && weeklyGroups.some((g) => g.items.some((it) => it.isLocked));
    }, [isWeeklyEditMode, weeklyGroups]);

    // ── Store changed for a specific row ───────────────────────────────────────────
    const fetchRawMaterialsForStore = useCallback(async (
        storeId: string,
        fieldId: string
    ) => {
        if (!storeId) {
            updateRowState(fieldId, {
                options: [],
                loading: false,
                fetchedForStoreId: null,
            });
            return;
        }

        const cache = storeRmCacheRef.current[storeId];

        // 1. If options are already cached for this storeId, reuse immediately without API call
        if (cache && !cache.loading && cache.options.length >= 0 && cache.promise === undefined) {
            updateRowState(fieldId, {
                options: cache.options,
                loading: false,
                fetchedForStoreId: storeId,
            });
            return;
        }

        // 2. If a request is currently in flight for this storeId, reuse its promise
        if (cache && cache.promise) {
            updateRowState(fieldId, { loading: true, options: [], fetchedForStoreId: storeId });
            try {
                const opts = await cache.promise;
                updateRowState(fieldId, { options: opts, loading: false, fetchedForStoreId: storeId });
            } catch {
                updateRowState(fieldId, { options: [], loading: false, fetchedForStoreId: storeId });
            }
            return;
        }

        // 3. Otherwise initiate a single API request for storeId
        updateRowState(fieldId, { loading: true, options: [], fetchedForStoreId: storeId });

        const fetchPromise = (async () => {
            try {
                const res = await rawMaterialService.fetchAll({ storeId } as any);
                const all: any[] = Array.isArray(res) ? res : (res as any)?.rawMaterials ?? [];
                const filtered = all.filter(
                    (rm) => String(rm.storeId) === String(storeId)
                );
                const opts = filtered.map((rm) => {
                    const availableVal = (Number(rm.onHandQty) || 0) - (Number(rm.reservedQty) || 0);
                    const available = Math.round(availableVal * 100) / 100;
                    return {
                        label: `${rm.materialName || rm.name || rm.rawMaterialId} (Available: ${available})`,
                        value: (rm.rawMaterialId ?? rm.id)?.toString() ?? "",
                        rawUom: rm.baseUom || "KG",
                    };
                });
                storeRmCacheRef.current[storeId] = { options: opts, loading: false };
                return opts;
            } catch (err) {
                storeRmCacheRef.current[storeId] = { options: [], loading: false };
                throw err;
            }
        })();

        storeRmCacheRef.current[storeId] = {
            options: [],
            loading: true,
            promise: fetchPromise,
        };

        try {
            const opts = await fetchPromise;
            updateRowState(fieldId, { options: opts, loading: false, fetchedForStoreId: storeId });
        } catch {
            updateRowState(fieldId, { options: [], loading: false, fetchedForStoreId: storeId });
            toast.error("Failed to load raw materials for store");
        }
    }, []);

    // Called by RawMaterialRowInner when user picks a new Store
    const handleStoreChange = useCallback((productIndex: number, index: number, newStoreId: string, fieldId: string) => {
        // Clear the raw material and UOM fields for this row
        setValue(`products.${productIndex}.rawMaterials.${index}.rawMaterialId` as any, "");
        setValue(`products.${productIndex}.rawMaterials.${index}.uom` as any, "KG");

        // Fetch materials for the new store
        fetchRawMaterialsForStore(newStoreId, fieldId);
    }, [setValue, fetchRawMaterialsForStore]);

    // Called by RawMaterialRowInner when user picks a Raw Material
    const handleRmChange = useCallback((productIndex: number, index: number, rmValue: string, fieldId: string) => {
        const selected = rowRmStates[fieldId]?.options.find(
            (o) => o.value === rmValue
        );
        if (selected?.rawUom) {
            setValue(`products.${productIndex}.rawMaterials.${index}.uom` as any, selected.rawUom);
        }
    }, [rowRmStates, setValue]);

    // â”€â”€ Load Dependencies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [products, setProducts] = useState<any[]>([]);

    const extractArray = useCallback((d: any): any[] => {
        if (Array.isArray(d)) return d;
        if (Array.isArray(d?.data)) return d.data;
        if (Array.isArray(d?.data?.data)) return d.data.data;
        if (Array.isArray(d?.stores)) return d.stores;
        return [];
    }, []);

    const fetchStoresData = useCallback(() => {
        storeService.fetchAll({ storeCategory: "RAW_MATERIAL" }).then((r) => setStores(extractArray(r))).catch(() => { });
    }, [extractArray]);

    const fetchProductsData = useCallback(() => {
        productService.fetchAll().then((r) => setProducts(extractArray(r))).catch(() => { });
    }, [extractArray]);

    const fetchMachinesData = useCallback(() => {
        machineService.getAll({ limit: 500 }).then((r) => {
            const arr = Array.isArray(r) ? r : (r?.machines ?? r?.data ?? []);
            setMachines(arr);
        }).catch(() => { });
    }, []);

    const refreshRmStates = useCallback(() => {
        storeRmCacheRef.current = {};
        setRowRmStates({});
    }, []);

    // ── Existing Production Orders (for disabling already booked weeks/dates) ────
    const [existingOrders, setExistingOrders] = useState<any[]>([]);

    const fetchExistingOrdersData = useCallback(() => {
        productionOrderService.fetchAll({ pageSize: 1000 })
            .then((r) => {
                const arr = extractArray(r);
                setExistingOrders(arr);
            })
            .catch(() => { });
    }, [extractArray]);

    useSocketSync("store", undefined, fetchStoresData);
    useSocketSync("product", undefined, fetchProductsData);
    useSocketSync("rawMaterial", undefined, refreshRmStates);
    useSocketSync("machine", undefined, fetchMachinesData);
    useSocketSync("productionOrder", undefined, fetchExistingOrdersData);

    useEffect(() => {
        fetchStoresData();
        fetchProductsData();
        fetchMachinesData();
        fetchExistingOrdersData();
    }, [fetchStoresData, fetchProductsData, fetchMachinesData, fetchExistingOrdersData]);

    const watchProductionOrderId = watch("productionOrderId");

    // Compute set of all dates belonging to already planned weeks
    const bookedDatesSet = useMemo(() => {
        const set = new Set<string>();
        const currentOrderId = watchProductionOrderId || (isEditMode && id ? String(id) : "");
        const currentBaseId = currentOrderId.includes("-") ? currentOrderId.split("-")[0] : currentOrderId;

        existingOrders.forEach((po: any) => {
            if (po.status?.toUpperCase() === "CANCELLED") return;

            const poId = po.productionOrderId || "";
            const poBaseId = poId.includes("-") ? poId.split("-")[0] : poId;

            // In edit mode (standalone or weekly), do not disable the dates belonging to the order/group currently being edited
            if (isWeeklyEditMode || isEditMode) {
                if (
                    poId === currentOrderId ||
                    poBaseId === currentBaseId ||
                    (id && String(po.id) === String(id)) ||
                    (orderId && String(po.id) === String(orderId))
                ) {
                    return;
                }
            }

            // Extract start date from weekStartDate or orderDate
            const startRaw = po.weekStartDate || po.orderDate;
            const startStr = toDateInputString(startRaw, "");
            if (!startStr) return;

            const endRaw = po.weekEndDate || po.dueDate;
            const endStr = toDateInputString(endRaw, startStr);

            // Disable all dates from startStr to endStr (inclusive)
            let curr = startStr;
            let count = 0;
            while (curr <= endStr && count < 60) {
                set.add(curr);
                curr = addDays(curr, 1);
                count++;
            }
        });

        return set;
    }, [existingOrders, isWeeklyEditMode, isEditMode, id, orderId, watchProductionOrderId]);

    const isDateDisabled = useCallback((date: Date): boolean => {
        const dateStr = formatLocalDate(date);
        return bookedDatesSet.has(dateStr);
    }, [bookedDatesSet]);

    // ── Clear schedules error when any product with qty > 0 is entered ──────────
    useEffect(() => {
        if (weeklyErrors.schedules) {
            const hasAny = weeklyGroups.some(g => g.items.some(it => it.productItemId && it.targetQty > 0));
            if (hasAny) setWeeklyErrors(prev => ({ ...prev, schedules: undefined }));
        }
    }, [weeklyGroups, weeklyErrors.schedules]);

    // ── Auto-populate / ensure all machine groups in weekly plan mode ───────
    useEffect(() => {
        if (machines.length > 0 && (!isEditMode || isWeeklyEditMode)) {
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

                // If in weekly mode and some machines are missing, append missing machines as empty groups
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
    }, [machines, isEditMode, isWeeklyEditMode]);


    // ── Recalculate Raw Material Required Qty when Target Qty/Damage Qty changes ──────────────────
    const [initialTargetQtyLoaded, setInitialTargetQtyLoaded] = useState(false);
    const lastCalculatedProductStates = React.useRef<Record<number, string>>({});
    useEffect(() => {
        if (isEditMode && !initialTargetQtyLoaded) {
            setInitialTargetQtyLoaded(true);
            return;
        }

        if (watchProducts && watchProducts.length > 0) {
            let needsCalculation = false;
            watchProducts.forEach((prod, pIdx) => {
                if (!prod.productItemId) return;
                const targetQty = Number(prod.targetQty) || 0;
                const damageQty = prod.damageQty !== undefined ? Number(prod.damageQty) : 0;
                const currentStateKey = `${prod.productItemId}-${targetQty}-${damageQty}`;
                if (lastCalculatedProductStates.current[pIdx] !== currentStateKey) {
                    needsCalculation = true;
                }
            });

            if (!needsCalculation) return;

            setIsCalculatingRM(true);

            setTimeout(() => {
                watchProducts.forEach((prod, pIdx) => {
                    if (!prod.productItemId) return;
                    const targetQty = Number(prod.targetQty) || 0;
                    const damageQty = prod.damageQty !== undefined ? Number(prod.damageQty) : 0;
                    const totalQty = targetQty + damageQty;
                    const currentStateKey = `${prod.productItemId}-${targetQty}-${damageQty}`;
                    
                    if (lastCalculatedProductStates.current[pIdx] === currentStateKey) {
                        return;
                    }
                    lastCalculatedProductStates.current[pIdx] = currentStateKey;

                    const product = products.find(p => p.id?.toString() === prod.productItemId);
                    const currentRms = getValues(`products.${pIdx}.rawMaterials`) || [];
                    const productBoms = product?.billOfMaterials || [];

                    if (productBoms && productBoms.length > 0) {
                        const rawWeight = product ? (Number(product.weightPerPiece) || 0) : 0;
                        const weightUom = (product?.weightUom || "kg").toLowerCase().trim();
                        // Always work in kg — convert g → kg if needed
                        const weightInKg = weightUom === "g" ? rawWeight / 1000 : rawWeight;
                        const totalWeight = totalQty * weightInKg;
                        
                        const expectedRms = productBoms.map((bomItem: any) => {
                            let reqQty = 0;
                            const rawPercentage = Number(bomItem.percentage);
                            if (rawPercentage > 0) {
                                reqQty = totalWeight * (rawPercentage / 100);
                            } else {
                                const perPieceQty = Number(bomItem.requiredQuantity) || 0;
                                reqQty = totalQty * perPieceQty;
                            }
                            return {
                                rawMaterialId: bomItem.rawMaterialId?.toString() || "",
                                requiredQty: String(reqQty.toFixed(3)),
                                uom: bomItem.rawMaterial?.baseUom || "KG",
                                storeId: bomItem.rawMaterial?.storeId?.toString() || "",
                                remarks: ""
                            };
                        });

                        let updated = false;
                        const newRms = [...currentRms];
                        expectedRms.forEach((expected: any, idx: number) => {
                            if (newRms[idx]) {
                                // Row already exists — only recalculate required quantity
                                if (newRms[idx].requiredQty !== expected.requiredQty) {
                                    setValue(`products.${pIdx}.rawMaterials.${idx}.requiredQty`, expected.requiredQty);
                                    updated = true;
                                }
                                if (!newRms[idx].uom && expected.uom) {
                                    setValue(`products.${pIdx}.rawMaterials.${idx}.uom`, expected.uom);
                                    updated = true;
                                }
                                // Only populate storeId or rawMaterialId if currently empty
                                if (!newRms[idx].storeId && expected.storeId) {
                                    setValue(`products.${pIdx}.rawMaterials.${idx}.storeId`, expected.storeId);
                                    updated = true;
                                }
                                if (!newRms[idx].rawMaterialId && expected.rawMaterialId) {
                                    setValue(`products.${pIdx}.rawMaterials.${idx}.rawMaterialId`, expected.rawMaterialId);
                                    updated = true;
                                }
                            } else {
                                newRms.push({
                                    rawMaterialId: expected.rawMaterialId,
                                    requiredQty: expected.requiredQty,
                                    uom: expected.uom,
                                    storeId: expected.storeId,
                                    remarks: expected.remarks || ""
                                });
                                updated = true;
                            }
                        });

                        if (newRms.length > expectedRms.length) {
                            newRms.length = expectedRms.length;
                            updated = true;
                        }

                        if (updated) {
                            setValue(`products.${pIdx}.rawMaterials`, newRms);
                        }
                    } else {
                        const rawWeight = product ? (Number(product.weightPerPiece) || 0) : 0;
                        const weightUom = (product?.weightUom || "kg").toLowerCase().trim();
                        const weightInKg = weightUom === "g" ? rawWeight / 1000 : rawWeight;
                        const reqQty = totalQty * weightInKg;

                        let updated = false;
                        const newRms = [...currentRms];
                        const expected = {
                            rawMaterialId: "",
                            requiredQty: String(reqQty.toFixed(3)),
                            uom: "KG",
                            remarks: ""
                        };

                        if (newRms[0]) {
                            if (newRms[0].requiredQty !== expected.requiredQty || newRms[0].remarks !== expected.remarks) {
                                setValue(`products.${pIdx}.rawMaterials.0.requiredQty`, expected.requiredQty);
                                setValue(`products.${pIdx}.rawMaterials.0.remarks`, expected.remarks);
                                updated = true;
                            }
                        } else {
                            newRms.push({
                                rawMaterialId: "",
                                requiredQty: expected.requiredQty,
                                uom: expected.uom,
                                storeId: "",
                                remarks: expected.remarks
                            });
                            updated = true;
                        }

                        if (newRms.length > 1) {
                            newRms.length = 1;
                            updated = true;
                        }

                        if (updated) {
                            setValue(`products.${pIdx}.rawMaterials`, newRms);
                        }
                    }
                });
                setIsCalculatingRM(false);
            }, 50);
        }
    }, [watchProducts, products, setValue, getValues, initialTargetQtyLoaded, isEditMode]);

    // ── Edit mode: hydrate form from route parameter ────────────────────────
    useEffect(() => {
        if (id) {
            setIsEditMode(true);
            setOrderId(id);
            productionOrderService.getById(id)
                .then((fullOrder) => {
                    setAuditInfo({
                        createdAt: fullOrder.createdAt,
                        createdBy: (fullOrder as any).createdUserName || (fullOrder as any).createdUser?.fullName || (fullOrder as any).createdBy,
                        editHistory: (fullOrder as any).editHistory || (fullOrder as any).statusHistory,
                    });
                    let rmRows: any[];
                    const nonEditableStatuses = ["DAILY_PLANNED", "IN_PRODUCTION", "POST_PRODUCTION", "PARTIAL_COMPLETED", "COMPLETED_WITH_SHORTFALL", "CLOSED", "READY_FOR_DISPATCH", "DISPATCHED", "CANCELLED"];
                    if (!nonEditableStatuses.includes(fullOrder.status) && (fullOrder as any).draftRawMaterials) {
                        rmRows = ((fullOrder as any).draftRawMaterials as any[]).map((rm: any) => ({
                            rawMaterialId: rm.rawMaterialId?.toString() || "",
                            requiredQty: rm.requiredQty?.toString() || "",
                            uom: rm.uom || "KG",
                            storeId: rm.storeId?.toString() || "",
                            remarks: rm.remarks || "",
                        }));
                    } else {
                        rmRows = ((fullOrder as any).products ?? []).flatMap((p: any) => p.rawMaterials ?? []).map((rm: any) => ({
                            rawMaterialId: rm.rawMaterialId?.toString() || "",
                            requiredQty: rm.requiredQty?.toString() || "",
                            uom: rm.uom || "KG",
                            storeId: rm.storeId?.toString() || "",
                            remarks: rm.remarks || "",
                        }));
                    }

                    const parsedOrderDate = toDateInputString(fullOrder.orderDate, today);
                    const parsedDueDate = toDateInputString(fullOrder.dueDate, nextWeek);
                    const parsedWeekStart = toDateInputString((fullOrder as any).weekStartDate, parsedOrderDate);
                    const parsedWeekEnd = toDateInputString((fullOrder as any).weekEndDate, "");

                    reset({
                        id: fullOrder.id,
                        productionOrderId: fullOrder.productionOrderId || "",
                        orderDate: parsedOrderDate,
                        dueDate: parsedDueDate,
                        priority: fullOrder.priority || "MEDIUM",
                        orderType: fullOrder.orderType || "STANDARD",
                        batchNo: fullOrder.batchNo || "",
                        sourceStoreId: fullOrder.sourceStoreId?.toString() || "",
                        machineMachineId: (fullOrder as any).machineMachineId || "",
                        weekStartDate: parsedWeekStart,
                        weekEndDate: parsedWeekEnd,
                        status: fullOrder.status || "CREATED",
                        remarks: fullOrder.remarks || "",
                        products: (fullOrder as any).products ? (fullOrder as any).products.map((p: any) => ({
                            productItemId: p.productItemId?.toString() || p.productId?.toString() || "",
                            targetQty: Number(p.targetQty || p.quantity || 0),
                            damageQty: Number(p.damageQty || (fullOrder as any).damageQty) || 0,
                            uom: p.uom || fullOrder.uom || "PCS",
                            sourceSalesOrderLineId: p.sourceSalesOrderLineId?.toString() || fullOrder.sourceSalesOrderLineId || "",
                            rawMaterials: rmRows
                        })) : [{
                            productItemId: fullOrder.productItemId?.toString() || "",
                            targetQty: Number(fullOrder.targetQty) || 0,
                            damageQty: Number((fullOrder as any).damageQty) || 0,
                            uom: fullOrder.uom || "PCS",
                            sourceSalesOrderLineId: fullOrder.sourceSalesOrderLineId || "",
                            rawMaterials: rmRows
                        }],
                    });
                    setRowRmStates({});
                    // Stamp current product states so BOM recalculation doesn't overwrite
                    // saved raw materials when the products list loads asynchronously
                    const loadedProds = (fullOrder as any).products || [{
                        productId: fullOrder.productItemId,
                        quantity: fullOrder.targetQty,
                        damageQty: (fullOrder as any).damageQty || 0,
                    }];
                    loadedProds.forEach((p: any, pIdx: number) => {
                        const pid = p.productItemId?.toString() || p.productId?.toString() || "";
                        const tQty = Number(p.targetQty || p.quantity || 0);
                        const dQty = Number(p.damageQty || (fullOrder as any).damageQty) || 0;
                        lastCalculatedProductStates.current[pIdx] = `${pid}-${tQty}-${dQty}`;
                    });
                })
                .catch(() => {
                    toast.error("Failed to load production order details");
                });
        } else {
            setIsEditMode(false);
            setOrderId(null);
            setRowRmStates({});
            setAuditInfo(null);

            reset({
                ...defaultValues,
                products: [{ productItemId: "", targetQty: 0, damageQty: 0, uom: "PCS", rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }] }],
            });

            // Check if navigated from list's Edit button for a DRAFT weekly plan
            const locState = (location.state || {}) as {
                editWeeklyPlan?: boolean;
                baseId?: string;
                children?: any[];
                weekStart?: string;
                weekEnd?: string;
            };

            if (locState.editWeeklyPlan && locState.children && locState.children.length > 0) {
                setIsWeeklyEditMode(true);
                setValue("productionOrderId", locState.baseId || "");
                if (locState.weekStart) setValue("weekStartDate", toDateInputString(locState.weekStart, today));
                if (locState.weekEnd) setValue("weekEndDate", toDateInputString(locState.weekEnd, ""));

                // Group children by machine and build weeklyGroups
                const groupMap = new Map<string, WeeklyGroup>();
                locState.children.forEach((child: any) => {
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

                const firstChildPo = locState.children[0];
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
            } else {
                setIsWeeklyEditMode(false);
                productionOrderService
                    .fetchNextId()
                    .then((orderNo) => setValue("productionOrderId", orderNo))
                    .catch(() => { });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, reset, setValue]);

    // â”€â”€ Memoised select option lists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const storeOptions = useMemo(
        () =>
            stores.map((s) => ({
                label: s.storeName || s.name || s.storeId?.toString() || s.id?.toString(),
                value: (s.storeId ?? s.id)?.toString(),
            })),
        [stores]
    );

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



    useEffect(() => { isDirtyRef.current = rhfIsDirty; }, [rhfIsDirty]);
    useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

    // F5 — Edit: reload from API; Create: reset form + fetch next ID
    useEffect(() => {
        const handleRefresh = async () => {
            if (isEditMode && id) {
                try {
                    const fullOrder = await productionOrderService.getById(id);
                    const rmRows = ((fullOrder as any).draftRawMaterials || (fullOrder as any).products?.flatMap((p: any) => p.rawMaterials) || []).map((rm: any) => ({
                        rawMaterialId: rm.rawMaterialId?.toString() || "",
                        requiredQty: rm.requiredQty?.toString() || "",
                        uom: rm.uom || "KG",
                        storeId: rm.storeId?.toString() || "",
                        remarks: rm.remarks || "",
                    }));
                    const parsedOrderDate = toDateInputString(fullOrder.orderDate, today);
                    const parsedDueDate = toDateInputString(fullOrder.dueDate, nextWeek);
                    const parsedWeekStart = toDateInputString((fullOrder as any).weekStartDate, parsedOrderDate);
                    const parsedWeekEnd = toDateInputString((fullOrder as any).weekEndDate, "");

                    reset({
                        id: fullOrder.id,
                        productionOrderId: fullOrder.productionOrderId || "",
                        orderDate: parsedOrderDate,
                        dueDate: parsedDueDate,
                        priority: fullOrder.priority || "MEDIUM",
                        orderType: fullOrder.orderType || "STANDARD",
                        batchNo: fullOrder.batchNo || "",
                        sourceStoreId: fullOrder.sourceStoreId?.toString() || "",
                        machineMachineId: (fullOrder as any).machineMachineId || "",
                        weekStartDate: parsedWeekStart,
                        weekEndDate: parsedWeekEnd,
                        status: fullOrder.status || "CREATED",
                        remarks: fullOrder.remarks || "",
                        products: (fullOrder as any).products ? (fullOrder as any).products.map((p: any) => ({
                            productItemId: p.productItemId?.toString() || p.productId?.toString() || "",
                            targetQty: Number(p.targetQty || p.quantity || 0),
                            damageQty: Number(p.damageQty || (fullOrder as any).damageQty) || 0,
                            uom: p.uom || fullOrder.uom || "PCS",
                            sourceSalesOrderLineId: p.sourceSalesOrderLineId?.toString() || "",
                            rawMaterials: rmRows,
                        })) : [{
                            productItemId: fullOrder.productItemId?.toString() || "",
                            targetQty: Number(fullOrder.targetQty) || 0,
                            damageQty: Number((fullOrder as any).damageQty) || 0,
                            uom: fullOrder.uom || "PCS",
                            sourceSalesOrderLineId: fullOrder.sourceSalesOrderLineId || "",
                            rawMaterials: rmRows,
                        }],
                    });
                    setRowRmStates({});
                    // Stamp product states to prevent BOM from overwriting after refresh
                    const refreshedProds = (fullOrder as any).products || [{
                        productId: fullOrder.productItemId,
                        quantity: fullOrder.targetQty,
                        damageQty: (fullOrder as any).damageQty || 0,
                    }];
                    refreshedProds.forEach((p: any, pIdx: number) => {
                        const pid = p.productItemId?.toString() || p.productId?.toString() || "";
                        const tQty = Number(p.targetQty || p.quantity || 0);
                        const dQty = Number(p.damageQty || (fullOrder as any).damageQty) || 0;
                        lastCalculatedProductStates.current[pIdx] = `${pid}-${tQty}-${dQty}`;
                    });
                    toast.info("Production order details refreshed");
                } catch {
                    toast.error("Failed to reload production order details");
                }
            } else if (!isEditMode) {
                reset({ ...defaultValues });
                setRowRmStates({});
                if (machines.length > 0) {
                    setWeeklyGroups(
                        machines.map((m) => ({
                            uid: crypto.randomUUID(),
                            machineId: m.machineId,
                            items: [{ uid: crypto.randomUUID(), productItemId: "", targetQty: 0, narration: "" }],
                        }))
                    );
                } else {
                    setWeeklyGroups([newWeeklyGroup()]);
                }
                productionOrderService
                    .fetchNextId()
                    .then((orderNo) => setValue("productionOrderId", orderNo))
                    .catch(() => {});
                toast.info("Form reset");
            }
        };
        window.addEventListener("fkey-refresh", handleRefresh);
        return () => window.removeEventListener("fkey-refresh", handleRefresh);
    }, [id, isEditMode, reset, setValue]);
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
        if (!isEditMode && !isWeeklyEditMode) {
            handleWeeklySubmitRef.current("WEEKLY_SCHEDULED");
        } else if (isWeeklyEditMode) {
            handleWeeklySubmitRef.current("WEEKLY_SCHEDULED");
        } else {
            setTimeout(() => handleSubmitRef.current(), 150);
        }
    }, [isEditMode, isWeeklyEditMode]);

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

    // Auto-focus the first navigable field on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            const first = formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled]), input:not([disabled])");
            first?.focus();
        }, 250);
        return () => clearTimeout(timer);
    }, []);

    const submitLock = React.useRef(false);

    // ── Submit ──────────────────────────────────────────────────────────────────
    const onSubmit = async (data: ProductionOrderFormValues) => {
        if (submitLock.current) return;
        submitLock.current = true;
        setIsSubmitting(true);
        try {
            if (isEditMode && orderId) {
                const payload = {
                    productionOrderId: data.productionOrderId,
                    orderDate: new Date(data.orderDate).toISOString(),
                    dueDate: new Date(data.dueDate).toISOString(),
                    priority: data.priority,
                    orderType: data.orderType,
                    batchNo: data.batchNo || null,
                    sourceStoreId: data.sourceStoreId || null,
                    machineMachineId: data.machineMachineId || null,
                    weekStartDate: data.weekStartDate ? new Date(data.weekStartDate).toISOString() : null,
                    weekEndDate: data.weekEndDate ? new Date(data.weekEndDate).toISOString() : null,
                    status: data.status,
                    remarks: data.remarks || null,
                    productItemId: data.products?.[0]?.productItemId || "",
                    targetQty: data.products?.[0]?.targetQty || 0,
                    damageQty: data.products?.[0]?.damageQty !== undefined ? Number(data.products[0].damageQty) : 0,
                    uom: data.products?.[0]?.uom || "PCS",
                    rawMaterials: (data.products?.[0]?.rawMaterials ?? []).map((rm) => ({
                        rawMaterialId: rm.rawMaterialId,
                        requiredQty: Number(rm.requiredQty),
                        uom: rm.uom,
                        storeId: rm.storeId,
                        remarks: rm.remarks || "",
                    })),
                };
                await productionOrderService.update(orderId, payload as any);
                toast.success(data.status === "DRAFT" ? "Production Order draft updated successfully!" : "Production Order updated successfully!");
            } else {
                await Promise.all(data.products.map(async (prod, index) => {
                    const productRawMaterials = (prod.rawMaterials ?? []).map((rm) => ({
                        rawMaterialId: rm.rawMaterialId,
                        requiredQty: Number(rm.requiredQty),
                        uom: rm.uom,
                        storeId: rm.storeId,
                        remarks: rm.remarks || "",
                    }));

                    const payload = {
                        productionOrderId: `${data.productionOrderId}-${index + 1}`,
                        orderDate: new Date(data.orderDate).toISOString(),
                        dueDate: new Date(data.dueDate).toISOString(),
                        priority: data.priority,
                        orderType: data.orderType,
                        batchNo: data.batchNo || null,
                        sourceStoreId: data.sourceStoreId || null,
                        machineMachineId: data.machineMachineId || null,
                        weekStartDate: data.weekStartDate ? new Date(data.weekStartDate).toISOString() : null,
                        weekEndDate: data.weekEndDate ? new Date(data.weekEndDate).toISOString() : null,
                        status: data.status,
                        remarks: data.remarks || null,
                        productItemId: prod.productItemId,
                        targetQty: prod.targetQty,
                        damageQty: prod.damageQty !== undefined ? Number(prod.damageQty) : 0,
                        uom: prod.uom,
                        rawMaterials: productRawMaterials,
                    };
                    return productionOrderService.create(payload as any);
                }));
                toast.success(data.status === "DRAFT" ? "Production Order saved as draft successfully!" : "Production Order(s) created successfully!");
            }

            if (isEditMode) {
                if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
                navigate(-1);
            } else {
                if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
                reset(defaultValues);
                setRowRmStates({});
                productionOrderService
                    .fetchNextId()
                    .then((orderNo) => setValue("productionOrderId", orderNo))
                    .catch(() => {});
                setTimeout(() => {
                    formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus();
                }, 100);
            }
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                error?.message ||
                "Failed to save production order"
            );
        } finally {
            submitLock.current = false;
            setIsSubmitting(false);
        }
    };

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
            const orderDate = new Date().toISOString();
            const dueDate = new Date(weekEnd).toISOString();

            // Track all used PO IDs across existingOrders, locState.children, and all current groups
            const usedPoIds = new Set<string>();
            existingOrders.forEach((o: any) => {
                if (o.productionOrderId) usedPoIds.add(o.productionOrderId);
            });
            const locState = (location.state || {}) as { children?: any[] };
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
                const locState = (location.state || {}) as { children?: any[] };
                const keptPoIds = new Set(allOrders.map(({ item }) => item.existingPoId).filter(Boolean));
                const initialPoIds: string[] = (locState.children || []).map((c: any) => c.productionOrderId).filter(Boolean);
                const removedPoIds = initialPoIds.filter((poId: string) => !keptPoIds.has(poId));
                const deletePromises = removedPoIds.map((poId: string) => productionOrderService.delete(poId).catch(() => {}));

                await Promise.all([...updatePromises, ...createPromises, ...deletePromises]);
                toast.success(targetStatus === "DRAFT"
                    ? `Weekly plan saved as draft — updated successfully!`
                    : `Weekly plan updated successfully!`);
            } else {
                await Promise.all(payloads.map((p) => productionOrderService.create(p as any)));
                toast.success(targetStatus === "DRAFT"
                    ? `Weekly plan saved as draft — ${allOrders.length} order(s) saved!`
                    : `Weekly plan created — ${allOrders.length} order(s) generated!`);
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
                            {isWeeklyEditMode ? "Edit Weekly Plan" : isEditMode && !isDraftEdit ? "Edit Production Order" : "Create Production Order"}
                            <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{watch("productionOrderId")}</span>
                        </h3>
                        {(isEditMode || isWeeklyEditMode) && <RecordAuditInfo auditData={auditInfo} title="Production Order" />}
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
                    onSubmit={handleSubmit(onSubmit)}
                    onKeyDown={handleFormKeyDown}
                    data-escape-guarded
                    className="p-4 lg:p-5 space-y-4"
                    noValidate
                >


                    {/* ── Weekly Plan Mode ─────────────────────────────────── */}
                    {(!isEditMode || isWeeklyEditMode) && (
                        <div className="space-y-4">
                            {/* Week dates */}
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

                            {/* Machine groups */}
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

                                        {/* Product + Qty table */}
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
                                                                        // Auto-focus Qty cell so user can enter quantity immediately (referencing Sales Order CreateOrder.tsx)
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
                        </div>
                    )}

                    {/* ── Form Actions ──────────────────────────────────────── */}
                    <div className="flex justify-end gap-2 pt-4 border-t border-line">
                        {!isEditMode && (
                            <>
                                <CustomButton
                                    text="Clear"
                                    icon={FaEraser}
                                    variant="secondary"
                                    onClick={() => {
                                        if (machines.length > 0) {
                                            setWeeklyGroups(
                                                machines.map((m) => ({
                                                    uid: crypto.randomUUID(),
                                                    machineId: m.machineId,
                                                    items: [{ uid: crypto.randomUUID(), productItemId: "", targetQty: 0, narration: "" }],
                                                }))
                                            );
                                        } else {
                                            setWeeklyGroups([newWeeklyGroup()]);
                                        }
                                    }}
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
                            </>
                        )}
                        {isEditMode && (
                            <>
                                <CustomButton
                                    text="Clear Form"
                                    icon={FaEraser}
                                    variant="secondary"
                                    onClick={() => { reset(defaultValues); setRowRmStates({}); }}
                                    disabled={isSubmitting}
                                />
                                {watchStatus === "DRAFT" && (
                                    <CustomButton
                                        text={isSubmitting ? "Saving..." : "Save as Draft"}
                                        variant="secondary"
                                        onClick={handleSubmit((data) => onSubmit({ ...data, status: "DRAFT" }))}
                                        disabled={isSubmitting || !can("production_orders.edit")}
                                    />
                                )}
                                <CustomButton
                                    text={isSubmitting ? "Updating..." : (watchStatus === "DRAFT" ? "Finalize Order" : "Update Order")}
                                    icon={isSubmitting ? undefined : FaSave}
                                    onClick={handleSubmit((data) => {
                                        const targetStatus = data.status === "DRAFT"
                                            ? "WEEKLY_SCHEDULED"
                                            : data.status;
                                        onSubmit({ ...data, status: targetStatus });
                                    })}
                                    type="button"
                                    disabled={isSubmitting || !can("production_orders.edit")}
                                />
                            </>
                        )}
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
