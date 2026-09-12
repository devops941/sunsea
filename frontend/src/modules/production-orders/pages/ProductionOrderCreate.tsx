import { formatDate } from "../../../utils/dateUtils";
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { FaSave, FaEraser, FaPlus, FaCheck } from "react-icons/fa";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, Controller, useFieldArray, useWatch, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import BusyItemsTable, { type BusyColumn } from "../../../components/form/OrderItemsTable/BusyItemsTable";
import AutocompleteInput from "../../../components/form/AutocompleteInput/AutocompleteInput";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import TextArea from "../../../components/form/TextArea/TextArea";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";

import { productionOrderService } from "../../../services/productionOrderService";
import { storeService } from "../../../services/storeService";
import { salesOrderService } from "../../../services/salesOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { productService } from "../../../services/productService";
import { billOfMaterialService } from "../../../services/billOfMaterialService";
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




const salesOrderColumns: DataTableColumn<any>[] = [
    { header: "#", width: "60px", render: (_, index) => index + 1 },
    { header: "PRODUCT NAME", render: (item) => item.product?.productName || `Product ID: ${item.productId}` },
    { header: "PRODUCT CODE", render: (item) => item.product?.productCode || "-" },
    { header: "ORDERED QUANTITY", align: "right", render: (item) => item.quantity },
    { header: "UOM", render: (item) => item.product?.uom?.name || "PCS" },
];

const productionOrderSchema = z.object({
    id: z.number().optional(),
    sourceSalesOrderId: z.string().optional().nullable(),
    sourceSalesOrderLineId: z.string().optional().nullable(),
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
    lotNo: z.string().optional(),
    sourceStoreId: z.string().optional(),
    destinationStoreId: z.string().optional(),
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
});

type ProductionOrderFormValues = z.infer<typeof productionOrderSchema>;

// â”€â”€â”€ Defaults â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const today = new Date().toISOString().split("T")[0];
const nextWeek = new Date(
    new Date().setDate(new Date().getDate() + 7)
).toISOString().split("T")[0];

const defaultValues: ProductionOrderFormValues = {
    id: undefined,
    sourceSalesOrderId: "",
    sourceSalesOrderLineId: "",
    products: [{ productItemId: "", targetQty: 0, damageQty: 0, uom: "ea", sourceSalesOrderLineId: "", rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }] }],
    productionOrderId: "",
    orderDate: today,
    dueDate: nextWeek,
    priority: "",
    orderType: "",
    batchNo: "",
    lotNo: "",
    sourceStoreId: "",
    destinationStoreId: "",
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

    // ── Generic state ─────────────────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [orderId, setOrderId] = useState<number | string | null>(null);

    const [stores, setStores] = useState<any[]>([]);
    const [boms, setBoms] = useState<any[]>([]);

    const [selectedSalesOrder, setSelectedSalesOrder] = useState<any>(null);
    const [selectedSalesOrderItems, setSelectedSalesOrderItems] = useState<any[]>([]);
    const [isFetchingSalesOrder, setIsFetchingSalesOrder] = useState(false);
    const [isCalculatingRM, setIsCalculatingRM] = useState(false);

    // ── Per-row raw material state ────────────────────────────────────────────────
    const [rowRmStates, setRowRmStates] = useState<Record<string, RowRawMaterialState>>({});
    const storeRmCacheRef = useRef<Record<string, { options: any[]; loading: boolean; promise?: Promise<any> }>>({});

    const formRef = useRef<HTMLFormElement>(null);
    const isDirtyRef = useRef(false);
    const saveConfirmOpenRef = useRef(false);
    const lastFocusedRef = useRef<HTMLElement | null>(null);
    const handleSubmitRef = useRef<() => void>(() => {});
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

    handleSubmitRef.current = () => {
        handleSubmit((data) => {
            const targetStatus = (isEditMode && (data.status === "DRAFT" || data.status === "CREATED"))
                ? "READY_FOR_PLANNING"
                : data.status === "DRAFT"
                    ? "CREATED"
                    : data.status;
            onSubmit({ ...data, status: targetStatus });
        })();
    };

    const handleFormKeyDown = useFormKeyboardNav(formRef);

    useFormShortcuts({
        onSave: () => handleSubmitRef.current(),
        onDelete: () => {
            if (!isEditMode) {
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
        formState: { errors, isDirty: rhfIsDirty },
    } = useForm<ProductionOrderFormValues>({
        resolver: zodResolver(productionOrderSchema) as any,
        defaultValues,
    });

    // Ref to remember blocker's proceed()/reset() from the current block-attempt
    // so the existing discard modal can drive them from its buttons.
    const proceedRef = useRef<(() => void) | null>(null);
    const resetRef = useRef<(() => void) | null>(null);
    useDirtyNavGuard(rhfIsDirty, (proceed, reset) => {
        proceedRef.current = proceed;
        resetRef.current = reset;
        setSaveConfirmOpen(true);
    });

    const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({
        control,
        name: "products",
    });

    const watchSalesOrderId = useWatch({ control, name: "sourceSalesOrderId" });
    const watchProducts = useWatch({ control, name: "products" });
    const watchStatus = useWatch({ control, name: "status" });
    // DRAFT or CREATED edit → promote to READY_FOR_PLANNING on main submit
    const isDraftEdit = isEditMode && (watchStatus === "DRAFT" || watchStatus === "CREATED");

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

    const fetchBomsData = useCallback(() => {
        billOfMaterialService.fetchAll().then((r) => setBoms(extractArray(r))).catch(() => { });
    }, [extractArray]);

    const refreshRmStates = useCallback(() => {
        storeRmCacheRef.current = {};
        setRowRmStates({});
    }, []);

    useSocketSync("store", undefined, fetchStoresData);
    useSocketSync("product", undefined, fetchProductsData);
    useSocketSync("billOfMaterial", undefined, fetchBomsData);
    useSocketSync("rawMaterial", undefined, refreshRmStates);

    useEffect(() => {
        fetchStoresData();
        fetchProductsData();
        fetchBomsData();
    }, [fetchStoresData, fetchProductsData, fetchBomsData]);

    // â”€â”€ Sales Order watch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ————————————————————————————————————————————————————————————————————————————————
    useEffect(() => {
        if (!watchSalesOrderId) {
            setSelectedSalesOrder(null);
            setSelectedSalesOrderItems([]);
            setValue("sourceSalesOrderLineId", "");
            setValue("products", [{ productItemId: "", targetQty: 0, damageQty: 0, uom: "PCS", rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }] }]);
            return;
        }

        const fetchSODetails = async () => {
            setIsFetchingSalesOrder(true);
            try {
                const so = await salesOrderService.fetchById(watchSalesOrderId);
                const items = so?.items || [];
                setSelectedSalesOrder(so);
                setSelectedSalesOrderItems(items);

                if (!isEditMode) {
                    if (items.length > 0) {
                        const newProducts = items.map((item: any) => {
                            return {
                                productItemId: item.productId?.toString() || "",
                                targetQty: item.quantity ? Number(item.quantity) : 0,
                                damageQty: 0,
                                uom: item.product?.uom?.name || "PCS",
                                sourceSalesOrderLineId: item.id?.toString() || "",
                                rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }]
                            };
                        });
                        setValue("products", newProducts);
                        setValue("sourceSalesOrderLineId", ""); // clear line ID
                    }
                    if (so?.orderDate) {
                        setValue("orderDate", so.orderDate.split("T")[0]);
                    }
                    if ((so as any)?.expectedCompletionDate) {
                        setValue("dueDate", (so as any).expectedCompletionDate.split("T")[0]);
                    }
                    if (so?.dispatchType) {
                        setValue("priority", so.dispatchType);
                    } else {
                        setValue("priority", "standard");
                    }
                    if (so?.orderType) {
                        setValue("orderType", so.orderType);
                    } else {
                        setValue("orderType", "STANDARD");
                    }
                    if (so?.remarks) {
                        setValue("remarks", so.remarks);
                    }
                }
            } catch {
                toast.error("Failed to fetch Sales Order details");
                setSelectedSalesOrder(null);
                setSelectedSalesOrderItems([]);
            } finally {
                setIsFetchingSalesOrder(false);
            }
        };

        fetchSODetails();
    }, [watchSalesOrderId, setValue, getValues, isEditMode]);

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
    }, [watchProducts, selectedSalesOrderItems, products, boms, watchSalesOrderId, setValue, getValues, initialTargetQtyLoaded, isEditMode]);

    const { id } = useParams<{ id: string }>();

    // â”€â”€ Edit mode: hydrate form from route parameter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        if (id) {
            setIsEditMode(true);
            setOrderId(id);
            productionOrderService.getById(id)
                .then((fullOrder) => {
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

                    reset({
                        id: fullOrder.id,
                        sourceSalesOrderId: fullOrder.sourceSalesOrderId?.toString() || "",
                        sourceSalesOrderLineId: fullOrder.sourceSalesOrderLineId?.toString() || "",
                        productionOrderId: fullOrder.productionOrderId || "",
                        orderDate: fullOrder.orderDate?.split("T")[0] || today,
                        dueDate: fullOrder.dueDate?.split("T")[0] || nextWeek,
                        priority: fullOrder.priority || "MEDIUM",
                        orderType: fullOrder.orderType || "STANDARD",
                        batchNo: fullOrder.batchNo || "",
                        lotNo: fullOrder.lotNo || "",
                        sourceStoreId: fullOrder.sourceStoreId?.toString() || "",
                        destinationStoreId: fullOrder.destinationStoreId?.toString() || "",
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
                })
                .catch(() => {
                    toast.error("Failed to load production order details");
                });
        } else {
            setIsEditMode(false);
            setOrderId(null);
            setRowRmStates({});

            reset({
                ...defaultValues,
                sourceSalesOrderId:
                    (location.state as any)?.sourceSalesOrderId?.toString() || "",
                products: [{ productItemId: "", targetQty: 0, damageQty: 0, uom: "PCS", rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }] }],
            });

            productionOrderService
                .fetchNextId()
                .then((orderNo) => setValue("productionOrderId", orderNo))
                .catch(() => { });


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
                    reset({
                        id: fullOrder.id,
                        sourceSalesOrderId: fullOrder.sourceSalesOrderId?.toString() || "",
                        sourceSalesOrderLineId: fullOrder.sourceSalesOrderLineId?.toString() || "",
                        productionOrderId: fullOrder.productionOrderId || "",
                        orderDate: fullOrder.orderDate?.split("T")[0] || today,
                        dueDate: fullOrder.dueDate?.split("T")[0] || nextWeek,
                        priority: fullOrder.priority || "MEDIUM",
                        orderType: fullOrder.orderType || "STANDARD",
                        batchNo: fullOrder.batchNo || "",
                        lotNo: fullOrder.lotNo || "",
                        sourceStoreId: fullOrder.sourceStoreId?.toString() || "",
                        destinationStoreId: fullOrder.destinationStoreId?.toString() || "",
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
                    toast.info("Production order details refreshed");
                } catch {
                    toast.error("Failed to reload production order details");
                }
            } else if (!isEditMode) {
                reset({ ...defaultValues });
                setRowRmStates({});
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
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (document.querySelector("[data-select-portal], [aria-expanded='true'][data-nav]")) return;
            e.preventDefault(); e.stopPropagation();
            if (saveConfirmOpenRef.current) { setSaveConfirmOpen(false); return; }
            if (isDirtyRef.current) { lastFocusedRef.current = document.activeElement as HTMLElement; setSaveConfirmOpen(true); }
            else { navigate(-1); }
        };
        window.addEventListener("keydown", handleEscape, { capture: true });
        return () => window.removeEventListener("keydown", handleEscape, { capture: true });
    }, [navigate]);

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
                    lotNo: data.lotNo || null,
                    sourceSalesOrderId: data.sourceSalesOrderId || null,
                    sourceSalesOrderLineId: data.sourceSalesOrderLineId || null,
                    sourceStoreId: data.sourceStoreId || null,
                    destinationStoreId: data.destinationStoreId || null,
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
                        lotNo: data.lotNo || null,
                        sourceSalesOrderId: data.sourceSalesOrderId || null,
                        sourceSalesOrderLineId: prod.sourceSalesOrderLineId || null,
                        sourceStoreId: data.sourceStoreId || null,
                        destinationStoreId: data.destinationStoreId || null,
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

    return (
        <>
        <div className="max-w-[1024px] xl:mr-auto">
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
                    <h2 className="text-xl font-bold text-ink flex items-start">
                        {isEditMode && !isDraftEdit ? "Edit Production Order" : "Create Production Order"}
                        <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{watch("productionOrderId")}</span>
                    </h2>
                    <BackButton text="Back to List" />
                </div>

                <form
                    ref={formRef}
                    onSubmit={handleSubmit(onSubmit)}
                    onKeyDown={handleFormKeyDown}
                    data-escape-guarded
                    className="p-4 lg:p-5 space-y-4"
                    noValidate
                >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

                        {/* ── 1. Source Information ─────────────────────────── */}
                        {watchSalesOrderId && (
                            <>
                                <div className="md:col-span-12">
                                    <h3 className="text-xs font-semibold text-ink-subtle uppercase tracking-wider mb-2">
                                        1. Selected Sales Order
                                    </h3>
                                    <div className="p-0" >
                                        {isFetchingSalesOrder ? (
                                            <div className="text-ink-muted">
                                                Fetching Sales Order details…
                                            </div>
                                        ) : selectedSalesOrder ? (
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-card-2 p-4 rounded-xl border border-line-soft">
                                                <div className="md:col-span-3">
                                                    <div className="text-ink-muted text-sm">
                                                        Sales Order No
                                                    </div>
                                                    <div className="font-bold text-ink">
                                                        {selectedSalesOrder.orderNo || "-"}
                                                    </div>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <div className="text-ink-muted text-sm">
                                                        Customer
                                                    </div>
                                                    <div className="font-bold text-ink">
                                                        {selectedSalesOrder.customer
                                                            ?.firmName || "-"}
                                                    </div>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <div className="text-ink-muted text-sm">
                                                        Order Date
                                                    </div>
                                                    <div className="font-bold text-ink">
                                                        {selectedSalesOrder.orderDate
                                                            ? formatDate(
                                                                selectedSalesOrder.orderDate
                                                            )
                                                            : "-"}
                                                    </div>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <div className="text-ink-muted text-sm">
                                                        Due Date
                                                    </div>
                                                    <div className="font-bold text-ink">
                                                        {selectedSalesOrder.expectedCompletionDate
                                                            ? formatDate(
                                                                selectedSalesOrder.expectedCompletionDate
                                                            )
                                                            : "-"}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-red-500">
                                                No Sales Order selected. Please navigate
                                                from Approved Sales Orders.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {selectedSalesOrderItems.length > 0 && (
                                    <div className="md:col-span-12 mt-2 mb-2">
                                        <h3 className="text-xs font-semibold text-ink-subtle uppercase tracking-wider mb-2">
                                            Sales Order Items
                                        </h3>
                                        <div className="mt-1 mb-2 border rounded-lg border-line-soft shadow-sm overflow-hidden">
                                            <DataTable
                                                columns={salesOrderColumns}
                                                data={selectedSalesOrderItems}
                                                rowKey={(item: any) => item.productId}
                                                emptyMessage="No sales order items found."
                                                className="border-0"
                                                minHeightClassName="min-h-0"
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        <div className="md:col-span-12">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xs font-extrabold text-ink uppercase tracking-wider">
                                    {watchSalesOrderId ? "2. Production Item Details" : "1. Direct Production Item Details"}
                                </h3>
                                {!watchSalesOrderId && (
                                    <CustomButton
                                        text="Add Production"
                                        icon={FaPlus}
                                        type="button"
                                        variant="secondary"
                                        onClick={() => appendProduct({ productItemId: "", targetQty: 0, damageQty: 0, uom: "PCS", rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }] })}
                                    />
                                )}
                            </div>
                            <div className="p-0">
                                {productFields.map((prodItem, index) => (
                                    <div key={prodItem.id} className={index > 0 ? "mt-3 pt-3 border-t border-line-soft" : ""}>
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="text-sm font-bold text-ink-muted">Product {index + 1}</h3>
                                            {!watchSalesOrderId && productFields.length > 1 && (
                                                <DeleteButton onClick={() => removeProduct(index)} />
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 md:gap-y-3">
                                            <Controller
                                                name={`products.${index}.productItemId` as const}
                                                control={control}
                                                render={({ field }) => (
                                                    <SelectInput
                                                        label="Finished Product"
                                                        name={field.name}
                                                        value={field.value}
                                                        options={products.map((p) => {
                                                            const isSelected = watchProducts?.some(
                                                                (wp: any, wpIdx: number) => wpIdx !== index && wp.productItemId === p.id?.toString()
                                                            );
                                                            return {
                                                                label: p.productName || p.productCode || p.id?.toString(),
                                                                value: p.id?.toString() || "",
                                                                disabled: isSelected
                                                            };
                                                        })}
                                                        defaultOptionLabel="Select Finished Product"
                                                        onChange={async (e) => {
                                                            field.onChange(e);
                                                            const p = products.find((x) => x.id?.toString() === e.target.value);
                                                            if (p) {
                                                                setValue(`products.${index}.uom` as any, p.uom?.name || p.uom?.uomCode || "ea");
                                                            }
                                                        }}
                                                        required
                                                        horizontal
                                                        disabled={!!watchSalesOrderId}
                                                        error={errors.products?.[index]?.productItemId?.message}
                                                    />
                                                )}
                                            />
                                            <Controller
                                                name={`products.${index}.targetQty` as const}
                                                control={control}
                                                render={({ field }) => (
                                                    <TextInput
                                                        label="Target Qty"
                                                        name={field.name}
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={field.value !== undefined ? String(field.value) : ""}
                                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                                        required
                                                        horizontal
                                                        disabled={!!watchSalesOrderId}
                                                        error={errors.products?.[index]?.targetQty?.message}
                                                    />
                                                )}
                                            />
                                            <Controller
                                                name={`products.${index}.uom` as const}
                                                control={control}
                                                render={({ field }) => (
                                                    <input type="hidden" name={field.name} value={field.value || "ea"} />
                                                )}
                                            />
                                            <div className="sm:col-span-2">
                                                <ProductRawMaterialsSection
                                                    productIndex={index}
                                                    productName={products.find(p => p.id?.toString() === watchProducts?.[index]?.productItemId)?.productName}
                                                    control={control}
                                                    errors={errors.products?.[index]}
                                                    storeOptions={storeOptions}
                                                    rowRmStates={rowRmStates}
                                                    handleStoreChange={handleStoreChange}
                                                    handleRmChange={handleRmChange}
                                                    fetchRawMaterialsForStore={fetchRawMaterialsForStore}
                                                    setValue={setValue}
                                                    isCalculatingRM={isCalculatingRM}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 md:gap-y-3 mt-3 pt-3 border-t border-line-soft">
                                    <Controller
                                        name="orderDate"
                                        control={control}
                                        render={({ field }) => (
                                            <DatePickerCalendar
                                                label="Order Date"
                                                name={field.name}
                                                value={field.value ? field.value.substring(0, 10) : ""}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                required
                                                horizontal
                                                disabled={!!watchSalesOrderId}
                                                error={errors.orderDate?.message}
                                            />
                                        )}
                                    />
                                    <Controller
                                        name="dueDate"
                                        control={control}
                                        render={({ field }) => (
                                            <DatePickerCalendar
                                                label="Due Date"
                                                name={field.name}
                                                value={field.value ? field.value.substring(0, 10) : ""}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                required
                                                horizontal
                                                minDate={watch("orderDate")}
                                                error={errors.dueDate?.message}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </div>


                        {/* ── 2. General Details ──────────────────────────── */}
                        <div className="md:col-span-12">
                            
                            <Controller
                                name="remarks"
                                control={control}
                                render={({ field }) => (
                                    <TextArea
                                        label="Narration "
                                        name={field.name}
                                        value={field.value ?? ""}
                                        placeholder="Any remarks for this order"
                                        rows={2}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    {/* ── Form Actions ──────────────────────────────────────── */}
                    <div className="flex justify-end gap-3 px-5 py-4 border-t border-line -mx-5 lg:-mx-6 -mb-6">
                        <CustomButton
                            text="Clear Form"
                            icon={FaEraser}
                            variant="secondary"
                            onClick={() => {
                                reset(defaultValues);
                                setRowRmStates({});
                            }}
                            disabled={isSubmitting}
                        />
                        <div className="ml-2">
                            <CustomButton
                                text={isSubmitting ? "Saving..." : "Save as Draft"}
                                onClick={handleSubmit((data) => onSubmit({ ...data, status: "DRAFT" }))}
                                disabled={isSubmitting}

                            />
                        </div>
                        <div className="ml-2">
                            <CustomButton
                                text={
                                    isSubmitting
                                        ? (isEditMode && !isDraftEdit ? "Updating" : "Creating")
                                        : (isEditMode && !isDraftEdit ? "Update Order" : "Create Production Order")
                                }
                                icon={isSubmitting ? undefined : FaSave}
                                onClick={handleSubmit((data) => {
                                    const targetStatus = (isEditMode && (data.status === "DRAFT" || data.status === "CREATED"))
                                        ? "READY_FOR_PLANNING"
                                        : data.status === "DRAFT"
                                            ? "CREATED"
                                            : data.status;
                                    onSubmit({ ...data, status: targetStatus });
                                })}
                                type="button"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </form>
            </div>
        </div>
        <CommonConfirmModal
            show={saveConfirmOpen}
            onHide={() => {
                setSaveConfirmOpen(false);
                if (resetRef.current) { const r = resetRef.current; proceedRef.current = null; resetRef.current = null; r(); }
                setTimeout(() => { lastFocusedRef.current?.focus() ?? formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])")?.focus(); }, 50);
            }}
            onConfirm={() => { setSaveConfirmOpen(false); setTimeout(() => handleSubmitRef.current(), 150); }}
            title="Unsaved Changes"
            message="You have unsaved changes. Do you want to save before leaving?"
            confirmText="Save"
            cancelText="Discard"
            confirmVariant="primary"
            confirmIcon={FaCheck}
            onCancel={() => {
                setSaveConfirmOpen(false);
                if (proceedRef.current) { const p = proceedRef.current; proceedRef.current = null; resetRef.current = null; p(); return; }
                navigate(-1);
            }}
        />
    </>
    );
};

export default ProductionOrderCreate;
