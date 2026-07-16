import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FaSave, FaEraser, FaArrowLeft, FaPlus } from "react-icons/fa";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, Controller, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import Button from "../../../components/ui/Button/Button";
import TextArea from "../../../components/form/TextArea/TextArea";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";

import { productionOrderService } from "../../../services/productionOrderService";
import { storeService } from "../../../services/storeService";
import { salesOrderService } from "../../../services/salesOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { productService } from "../../../services/productService";
import { billOfMaterialService } from "../../../services/billOfMaterialService";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DISPATCH_TYPE_OPTIONS = [
    { label: "Priority", value: "priority" },
    { label: "Standard", value: "standard" },
];

const ORDER_TYPE_OPTIONS = [
    { label: "STANDARD", value: "STANDARD" },
    { label: "REWORK", value: "REWORK" },
    { label: "SPECIAL", value: "SPECIAL" },
    { label: "B2B (GST Registered)", value: "B2B" },
    { label: "B2C (Consumer)", value: "B2C" },
    { label: "Export", value: "Export" },
    { label: "Telephonic Enquiry", value: "telephone" },
];

// â”€â”€â”€ Zod Schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const productionOrderSchema = z.object({
    id: z.number().optional(),
    sourceSalesOrderId: z.string().optional().nullable(),
    sourceSalesOrderLineId: z.string().optional().nullable(),
    products: z.array(z.object({
        productItemId: z.string().min(1, "Product is required"),
        targetQty: z.number().min(0.01, "Target Quantity must be > 0"),
        damageQty: z.number().min(0, "Damage Quantity must be >= 0").optional().default(100),
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
        colorType: z.string().optional(),
    })).min(1, "At least one product is required"),
    productionOrderId: z.string().min(1, "Order No is required"),
    orderDate: z.string().min(1, "Order Date is required"),
    dueDate: z.string().min(1, "Due Date is required"),
    priority: z.string().min(1, "Priority is required"),
    orderType: z.string().min(1, "Order Type is required"),
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
    products: [{ productItemId: "", targetQty: 0, damageQty: 100, uom: "PCS", sourceSalesOrderLineId: "", rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }], colorType: "sc" }],
    productionOrderId: "",
    orderDate: today,
    dueDate: nextWeek,
    priority: "",
    orderType: "",
    batchNo: "",
    lotNo: "",
    sourceStoreId: "",
    destinationStoreId: "",
    status: "PLANNED",
    remarks: "",
};

// â”€â”€â”€ CtrlText helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type CtrlTextProps = {
    label?: string;
    placeholder?: string;
    required?: boolean;
    type?: string;
    disabled?: boolean;
    error?: string;
    field: {
        name: string;
        value: any;
        onChange: React.ChangeEventHandler<HTMLInputElement>;
        onBlur: React.FocusEventHandler<HTMLInputElement>;
    };
};

const CtrlText: React.FC<CtrlTextProps> = ({
    field, label, placeholder, required, type, disabled, error,
}) => (
    <TextInput
        label={label || ""}
        name={field.name}
        value={
            field.value !== undefined && field.value !== null
                ? String(field.value)
                : ""
        }
        onChange={field.onChange}
        onBlur={field.onBlur}
        placeholder={placeholder}
        required={required}
        type={type}
        disabled={disabled}
        error={error}
    />
);

// â”€â”€â”€ RawMaterialRow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
//  Each row owns its own options/loading/fetchedForStoreId state via the
//  `rowState` prop (a slice of the parent's `rowRmStates` array).
//  The parent passes `onStoreChange` and `onRmChange` so it can update that
//  slice without touching other rows.
//

interface RawMaterialRowInnerProps {
    productIndex: number;
    index: number;
    control: any;
    remove: (index: number) => void;
    storeOptions: { label: string; value: string }[];
    errors: any;
    watch: (name: string) => any;
    rowState: RowRawMaterialState;
    onStoreChange: (index: number, newStoreId: string) => void;
    onRmChange: (index: number, newRmValue: string) => void;
    fetchRawMaterialsForStore: (storeId: string, fieldId: string) => void;
    fieldId: string;
    setValue: any;
}

const RawMaterialRowInner: React.FC<RawMaterialRowInnerProps> = React.memo(({
    productIndex,
    index,
    control,
    remove,
    storeOptions,
    errors,
    watch,
    rowState,
    onStoreChange,
    onRmChange,
    fetchRawMaterialsForStore,
    fieldId,
    setValue,
}) => {
    const { options, loading } = rowState;
    const storeId = watch(`products.${productIndex}.rawMaterials.${index}.storeId`);

    // Fetch raw materials when storeId changes
    useEffect(() => {
        if (storeId) {
            fetchRawMaterialsForStore(storeId, fieldId);
        }
    }, [storeId, fieldId, fetchRawMaterialsForStore]);

    const noStore = !storeId;
    const rmDisabled = noStore || loading || options.length === 0;
    const showEmpty = storeId && !loading && options.length === 0;

    const rmPlaceholder = loading
        ? "Loading..."
        : noStore
            ? "Select Store first"
            : options.length === 0
                ? "No materials available"
                : "Select Raw Material";

    const currentRawMaterials = watch(`products.${productIndex}.rawMaterials`);
    const filteredOptions = options.map((opt) => {
        const isSelected = currentRawMaterials?.some(
            (rm: any, rmIdx: number) => rmIdx !== index && rm.rawMaterialId === opt.value
        );
        return {
            ...opt,
            disabled: isSelected,
        };
    });

    const currentRm = watch(`products.${productIndex}.rawMaterials.${index}.rawMaterialId`);
    const currentUom = watch(`products.${productIndex}.rawMaterials.${index}.uom`);
    const selectedRmOption = options.find((opt) => opt.value === currentRm);
    const baseUoms = selectedRmOption ? (selectedRmOption as any).rawUom : (currentUom || "");
    const primaryUom = baseUoms ? baseUoms.split(",").map((u: string) => u.trim()).filter(Boolean)[0] : "";

    useEffect(() => {
        if (primaryUom) {
            setValue(`products.${productIndex}.rawMaterials.${index}.uom`, primaryUom);
        }
    }, [primaryUom, productIndex, index, setValue]);

    return (
        <tr className="master-data-row">
            {/* STORE */}
            <td className="px-4 py-3">
                <Controller
                    name={`products.${productIndex}.rawMaterials.${index}.storeId` as const}
                    control={control}
                    render={({ field }) => (
                        <SelectInput
                            label=""
                            name={field.name}
                            value={field.value}
                            options={storeOptions}
                            defaultOptionLabel="Select Store"
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                field.onChange(e);
                                onStoreChange(index, e.target.value);
                            }}
                            error={errors?.storeId?.message}
                        />
                    )}
                />
            </td>

            {/* RAW MATERIAL */}
            <td className="px-4 py-3">
                <Controller
                    name={`products.${productIndex}.rawMaterials.${index}.rawMaterialId` as const}
                    control={control}
                    render={({ field }) => (
                        <>
                            <SelectInput
                                label=""
                                name={field.name}
                                value={field.value}
                                options={filteredOptions}
                                defaultOptionLabel={rmPlaceholder}
                                disabled={rmDisabled}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                    field.onChange(e);
                                    onRmChange(index, e.target.value);
                                }}
                                error={errors?.rawMaterialId?.message}
                            />
                            {loading && (
                                <div className="text-slate-500 text-sm mt-1">
                                    Fetching raw materialsâ€¦
                                </div>
                            )}
                            {showEmpty && (
                                <div className="text-red-500 text-sm mt-1">
                                    No Raw Materials available in this Store.
                                </div>
                            )}
                        </>
                    )}
                />
            </td>

            {/* REQUIRED QTY & UOM */}
            <td className="px-4 py-3">
                <Controller
                    name={`products.${productIndex}.rawMaterials.${index}.requiredQty` as const}
                    control={control}
                    render={({ field }) => (
                        <QuantityInput
                            label=""
                            name={field.name}
                            value={field.value}
                            baseUoms={baseUoms}
                            error={errors?.requiredQty?.message || errors?.uom?.message}
                            onChange={(e: any) => field.onChange(e.target.value)}
                        />
                    )}
                />
                <Controller
                    name={`products.${productIndex}.rawMaterials.${index}.uom` as const}
                    control={control}
                    render={({ field }) => (
                        <input type="hidden" name={field.name} value={field.value || ""} />
                    )}
                />
            </td>

            {/* REMARKS */}
            <td className="px-4 py-3">
                <Controller
                    name={`products.${productIndex}.rawMaterials.${index}.remarks` as const}
                    control={control}
                    render={({ field }) => (
                        <TextInput
                            label=""
                            name={field.name}
                            placeholder="Remarks"
                            value={field.value}
                            onChange={field.onChange}
                        />
                    )}
                />
            </td>

            {/* DELETE */}
            <td className="px-4 py-3 text-center align-middle">
                <DeleteButton onClick={() => remove(index)} />
            </td>
        </tr>
    );
});

interface ProductRawMaterialsSectionProps {
    productIndex: number;
    productName?: string;
    control: any;
    watch: any;
    errors: any;
    storeOptions: { label: string; value: string }[];
    rowRmStates: Record<string, RowRawMaterialState>;
    handleStoreChange: (productIndex: number, idx: number, storeId: string, fieldId: string) => void;
    handleRmChange: (productIndex: number, idx: number, rmValue: string, fieldId: string) => void;
    fetchRawMaterialsForStore: (storeId: string, fieldId: string) => void;
    setValue: any;
}

const ProductRawMaterialsSection: React.FC<ProductRawMaterialsSectionProps> = React.memo(({
    productIndex,
    productName,
    control,
    watch,
    errors,
    storeOptions,
    rowRmStates,
    handleStoreChange,
    handleRmChange,
    fetchRawMaterialsForStore,
    setValue,
}) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `products.${productIndex}.rawMaterials` as const,
    });

    return (
        <div className="md:col-span-12 mt-3">
            <div className="flex justify-between items-center mb-2">
                <h6 className="text-lg font-bold text-slate-800 mb-6">
                    Manual Raw Materials ({productName || `Product ${productIndex + 1}`})
                </h6>
                <CustomButton
                    text="Add Material Row"
                    icon={FaPlus}
                    type="button"
                    size="sm"
                    onClick={() =>
                        append({
                            rawMaterialId: "",
                            requiredQty: "",
                            uom: "",
                            storeId: "",
                            remarks: "",
                        })
                    }
                />
            </div>

            <div className="mt-2 mb-2">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-slate-700">
                        <tr>
                            <th>
                                STORE{" "}
                                <span className="text-red-500">
                                    *
                                </span>
                            </th>
                            <th>
                                RAW MATERIAL{" "}
                                <span className="text-red-500">
                                    *
                                </span>
                            </th>
                            <th>
                                REQUIRED QTY & UOM{" "}
                                <span className="text-red-500">
                                    *
                                </span>
                            </th>
                            <th>REMARKS</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {fields.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-3 text-center text-slate-500 bg-white rounded">
                                    No raw materials added. Click 'Add Material Row' to include materials.
                                </td>
                            </tr>
                        )}
                        {fields.map((item, index) => (
                            <RawMaterialRowInner
                                key={item.id}
                                productIndex={productIndex}
                                index={index}
                                control={control}
                                remove={remove}
                                storeOptions={storeOptions}
                                errors={errors?.rawMaterials?.[index]}
                                watch={watch}
                                rowState={
                                    rowRmStates[item.id] ?? {
                                        options: [],
                                        loading: false,
                                        fetchedForStoreId: null,
                                    }
                                }
                                onStoreChange={(idx, storeId) => handleStoreChange(productIndex, idx, storeId, item.id)}
                                onRmChange={(idx, rmValue) => handleRmChange(productIndex, idx, rmValue, item.id)}
                                fetchRawMaterialsForStore={fetchRawMaterialsForStore}
                                fieldId={item.id}
                                setValue={setValue}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ProductionOrderCreate: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // â”€â”€ Generic state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [orderId, setOrderId] = useState<number | string | null>(null);

    const [stores, setStores] = useState<any[]>([]);
    const [boms, setBoms] = useState<any[]>([]);

    const [selectedSalesOrder, setSelectedSalesOrder] = useState<any>(null);
    const [selectedSalesOrderItems, setSelectedSalesOrderItems] = useState<any[]>([]);
    const [isFetchingSalesOrder, setIsFetchingSalesOrder] = useState(false);

    // â”€â”€ Per-row raw material state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Each element corresponds to one rawMaterials field-array row.
    const [rowRmStates, setRowRmStates] = useState<Record<string, RowRawMaterialState>>({});

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

    // â”€â”€ React Hook Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const {
        control,
        handleSubmit,
        watch,
        setValue,
        getValues,
        reset,
        formState: { errors },
    } = useForm<ProductionOrderFormValues>({
        resolver: zodResolver(productionOrderSchema) as any,
        defaultValues,
    });

    const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({
        control,
        name: "products",
    });

    const watchSalesOrderId = useWatch({ control, name: "sourceSalesOrderId" });
    const watchProducts = useWatch({ control, name: "products" });

    // â”€â”€ Store changed for a specific row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        // Avoid duplicate fetches for the same storeId
        let skip = false;
        setRowRmStates((prev) => {
            if (prev[fieldId]?.fetchedForStoreId === storeId && !prev[fieldId]?.loading) {
                skip = true;
            }
            return prev;
        });
        if (skip) return;

        updateRowState(fieldId, { loading: true, options: [], fetchedForStoreId: storeId });

        try {
            // Using existing API to fetch raw materials by storeId
            const res = await rawMaterialService.fetchAll({ storeId } as any);

            const all: any[] = Array.isArray(res) ? res : (res as any)?.data ?? [];

            // Only keep materials belonging to the selected store (redundant but safe)
            const filtered = all.filter(
                (rm) => String(rm.storeId) === String(storeId)
            );

            const opts = filtered.map((rm) => {
                const available = (Number(rm.onHandQty) || 0) - (Number(rm.reservedQty) || 0);
                return {
                    label: `${rm.materialName || rm.name || rm.rawMaterialId} (Available: ${available})`,
                    value: (rm.rawMaterialId ?? rm.id)?.toString() ?? "",
                    rawUom: rm.baseUom || "KG",
                };
            });

            updateRowState(fieldId, { options: opts, loading: false });
        } catch {
            updateRowState(fieldId, { options: [], loading: false });
            toast.error("Failed to load raw materials for store");
        }
    }, []);

    // Called by RawMaterialRowInner when user picks a new Store
    const handleStoreChange = (productIndex: number, index: number, newStoreId: string, fieldId: string) => {
        // Clear the raw material and UOM fields for this row
        setValue(`products.${productIndex}.rawMaterials.${index}.rawMaterialId` as any, "");
        setValue(`products.${productIndex}.rawMaterials.${index}.uom` as any, "KG");

        // Fetch materials for the new store
        fetchRawMaterialsForStore(newStoreId, fieldId);
    };

    // Called by RawMaterialRowInner when user picks a Raw Material
    const handleRmChange = (productIndex: number, index: number, rmValue: string, fieldId: string) => {
        const selected = rowRmStates[fieldId]?.options.find(
            (o) => o.value === rmValue
        );
        if (selected?.rawUom) {
            setValue(`products.${productIndex}.rawMaterials.${index}.uom` as any, selected.rawUom);
        }
    };

    // â”€â”€ Load Dependencies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        const extractArray = (d: any): any[] => {
            if (Array.isArray(d)) return d;
            if (Array.isArray(d?.data)) return d.data;
            if (Array.isArray(d?.data?.data)) return d.data.data;
            if (Array.isArray(d?.stores)) return d.stores;
            return [];
        };

        storeService.fetchAll({ limit: 1000 }).then((r) => setStores(extractArray(r))).catch(() => { });
        productService.fetchAll().then((r) => setProducts(extractArray(r))).catch(() => { });
        billOfMaterialService.fetchAll().then((r) => setBoms(extractArray(r))).catch(() => { });
    }, []);

    // â”€â”€ Sales Order watch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        if (!watchSalesOrderId) {
            setSelectedSalesOrder(null);
            setSelectedSalesOrderItems([]);
            setValue("sourceSalesOrderLineId", "");
            setValue("products", [{ productItemId: "", targetQty: 0, damageQty: 100, uom: "PCS", rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }] }]);
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
                            const targetQty = Number(item.quantity) || 0;
                            return {
                                productItemId: item.productId?.toString() || "",
                                targetQty: targetQty,
                                damageQty: 100,
                                uom: item.product?.uom?.name || "PCS",
                                sourceSalesOrderLineId: item.id?.toString() || "",
                                rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }],
                                colorType: item.colorType || "sc"
                            };
                        });
                        setValue("products", newProducts);
                        setValue("sourceSalesOrderLineId", ""); // clear line ID
                    }
                    if (so?.orderDate) {
                        setValue("orderDate", so.orderDate.split("T")[0]);
                    }
                    if (so?.expectedCompletionDate) {
                        setValue("dueDate", so.expectedCompletionDate.split("T")[0]);
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

    // â”€â”€ Recalculate Raw Material Required Qty when Target Qty/Damage Qty changes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [initialTargetQtyLoaded, setInitialTargetQtyLoaded] = useState(false);
    const lastCalculatedProductStates = React.useRef<Record<number, string>>({});
    useEffect(() => {
        if (isEditMode && !initialTargetQtyLoaded) {
            // First time it runs in edit mode, skip recalculation so we don't wipe draft RM qtys
            setInitialTargetQtyLoaded(true);
            return;
        }

        if (watchProducts && watchProducts.length > 0) {
            watchProducts.forEach((prod, pIdx) => {
                if (!prod.productItemId) return;
                const targetQty = Number(prod.targetQty) || 0;

                // Do not auto-calculate or add raw materials until a target quantity is entered
                if (targetQty === 0) return;

                const product = products.find(p => p.id?.toString() === prod.productItemId);
                const damageQty = prod.damageQty !== undefined ? Number(prod.damageQty) : 100;
                const totalQty = targetQty + damageQty;

                // Create a state key based on product ID and quantities
                const currentStateKey = `${prod.productItemId}-${targetQty}-${damageQty}`;

                // If the state key hasn't changed, skip recalculation (allows manual edits to requiredQty)
                if (lastCalculatedProductStates.current[pIdx] === currentStateKey) {
                    return;
                }

                // Update the ref to the current state
                lastCalculatedProductStates.current[pIdx] = currentStateKey;

                const bom = boms.find(b => Number(b.productId) === Number(prod.productItemId));
                const currentRms = getValues(`products.${pIdx}.rawMaterials`) || [];

                if (bom && bom.items && bom.items.length > 0) {
                    const expectedRms = bom.items.map((bomItem: any) => {
                        const reqQty = totalQty * (Number(bomItem.requiredQuantity) || 0);
                        return {
                            rawMaterialId: bomItem.rawMaterialId?.toString() || "",
                            requiredQty: String(reqQty.toFixed(3)),
                            uom: bomItem.uom || "KG",
                            remarks: ""
                        };
                    });

                    let updated = false;
                    const newRms = [...currentRms];
                    expectedRms.forEach((expected: any, idx: number) => {
                        if (newRms[idx]) {
                            if (newRms[idx].requiredQty !== expected.requiredQty || newRms[idx].remarks !== expected.remarks || newRms[idx].rawMaterialId !== expected.rawMaterialId) {
                                setValue(`products.${pIdx}.rawMaterials.${idx}.requiredQty`, expected.requiredQty);
                                setValue(`products.${pIdx}.rawMaterials.${idx}.remarks`, expected.remarks);
                                if (!newRms[idx].rawMaterialId) {
                                    setValue(`products.${pIdx}.rawMaterials.${idx}.rawMaterialId`, expected.rawMaterialId);
                                }
                                updated = true;
                            }
                        } else {
                            newRms.push({
                                rawMaterialId: expected.rawMaterialId,
                                requiredQty: expected.requiredQty,
                                uom: expected.uom,
                                storeId: "",
                                remarks: expected.remarks
                            });
                            updated = true;
                        }
                    });

                    if (updated) {
                        setValue(`products.${pIdx}.rawMaterials`, newRms);
                    }
                } else {
                    const weight = product ? (Number(product.weightPerPiece) || 0) : 0;
                    const reqQty = totalQty * weight;

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

                    if (updated) {
                        setValue(`products.${pIdx}.rawMaterials`, newRms);
                    }
                }
            });
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
                    const nonEditableStatuses = ["SCHEDULED", "IN_PROGRESS", "COMPLETED"];
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
                        status: fullOrder.status || "PLANNED",
                        remarks: fullOrder.remarks || "",
                        products: (fullOrder as any).products ? (fullOrder as any).products.map((p: any) => ({
                            productItemId: p.productItemId?.toString() || p.productId?.toString() || "",
                            targetQty: Number(p.targetQty || p.quantity || 0),
                            damageQty: Number((fullOrder as any).damageQty) || 100,
                            uom: fullOrder.uom || "PCS",
                            sourceSalesOrderLineId: fullOrder.sourceSalesOrderLineId || "",
                            rawMaterials: rmRows,
                            colorType: fullOrder.colorType || "sc",
                        })) : [{
                            productItemId: fullOrder.productItemId?.toString() || "",
                            targetQty: Number(fullOrder.targetQty) || 0,
                            damageQty: Number((fullOrder as any).damageQty) || 100,
                            uom: fullOrder.uom || "PCS",
                            sourceSalesOrderLineId: fullOrder.sourceSalesOrderLineId || "",
                            rawMaterials: rmRows,
                            colorType: fullOrder.colorType || "sc",
                        }],
                    });
                    setRowRmStates({});
                })
                .catch((err) => {
                    console.error("âŒ Failed to fetch order details for edit:", err);
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
                products: [{ productItemId: "", targetQty: 0, damageQty: 100, uom: "PCS", rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }], colorType: "sc" }],
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

    // â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const onSubmit = async (data: ProductionOrderFormValues) => {
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
                    damageQty: data.products?.[0]?.damageQty !== undefined ? Number(data.products[0].damageQty) : 100,
                    uom: data.products?.[0]?.uom || "PCS",
                    colorType: data.products?.[0]?.colorType || "sc",
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
                        damageQty: prod.damageQty !== undefined ? Number(prod.damageQty) : 100,
                        uom: prod.uom,
                        colorType: prod.colorType || "sc",
                        rawMaterials: productRawMaterials,
                    };
                    return productionOrderService.create(payload as any);
                }));
                toast.success(data.status === "DRAFT" ? "Production Order saved as draft successfully!" : "Production Order(s) created successfully!");
            }

            navigate("/production-orders");
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message ||
                error?.message ||
                "Failed to save production order"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return (
        <div className="p-4 md:p-6 min-h-screen bg-white">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 ">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">
                            {isEditMode
                                ? "Edit Production Order"
                                : "Create Production Order"}
                        </h2>
                    </div>
                    <div>
                        <CustomButton
                            text="Back to List"
                            icon={FaArrowLeft}
                            onClick={() => navigate("/production-orders")}
                        />
                    </div>
                </div>

                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-6"
                    noValidate
                >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

                        {/* â”€â”€ 1. Source Information â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                        {watchSalesOrderId && (
                            <>
                                <div className="md:col-span-12">
                                    <h6 className="text-lg font-bold text-slate-800 mb-6">
                                        1. Selected Sales Order
                                    </h6>
                                    <div className="p-0" >
                                        {isFetchingSalesOrder ? (
                                            <div className="text-slate-500">
                                                Fetching Sales Order detailsâ€¦
                                            </div>
                                        ) : selectedSalesOrder ? (
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                <div className="md:col-span-3">
                                                    <div className="text-slate-500 text-sm">
                                                        Sales Order No
                                                    </div>
                                                    <div className="font-bold text-slate-800">
                                                        {selectedSalesOrder.orderNo || "-"}
                                                    </div>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <div className="text-slate-500 text-sm">
                                                        Customer
                                                    </div>
                                                    <div className="font-bold text-slate-800">
                                                        {selectedSalesOrder.customer
                                                            ?.firmName || "-"}
                                                    </div>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <div className="text-slate-500 text-sm">
                                                        Order Date
                                                    </div>
                                                    <div className="font-bold text-slate-800">
                                                        {selectedSalesOrder.orderDate
                                                            ? new Date(
                                                                selectedSalesOrder.orderDate
                                                            ).toLocaleDateString("en-IN")
                                                            : "-"}
                                                    </div>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <div className="text-slate-500 text-sm">
                                                        Due Date
                                                    </div>
                                                    <div className="font-bold text-slate-800">
                                                        {selectedSalesOrder.expectedCompletionDate
                                                            ? new Date(
                                                                selectedSalesOrder.expectedCompletionDate
                                                            ).toLocaleDateString("en-IN")
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
                                {/* â”€â”€ Sales Order Items read-only table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                                {selectedSalesOrderItems.length > 0 && (
                                    <div className="md:col-span-12 mt-3 mb-3">
                                        <h6 className="font-semibold text-slate-800 mb-3">
                                            Sales Order Items
                                        </h6>
                                        <div className="overflow-x-auto mt-2 mb-4">
                                            <table className="w-full text-left text-sm text-slate-600">
                                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                                                    <tr>
                                                        <th style={{ width: 60 }}>#</th>
                                                        <th>PRODUCT NAME</th>
                                                        <th>PRODUCT CODE</th>
                                                        <th>COLOR</th>
                                                        <th>ORDERED QUANTITY</th>
                                                        <th>UOM</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {selectedSalesOrderItems.map(
                                                        (item, i) => (
                                                            <tr
                                                                key={i}
                                                                className="master-data-row"
                                                            >
                                                                <td className="px-4 py-3">
                                                                    {i + 1}
                                                                </td>
                                                                <td className="px-4 py-3 font-medium">
                                                                    {item.product
                                                                        ?.productName ||
                                                                        `Product ID: ${item.productId}`}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {item.product
                                                                        ?.productCode ||
                                                                        "-"}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {item.colorType === 'mc' ? 'Multi Color' : (item.colorType === 'sc' ? 'Single Color' : '-')}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {item.quantity}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {item.product?.uom
                                                                        ?.name || "PCS"}
                                                                </td>
                                                            </tr>
                                                        )
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        <div className="md:col-span-12 p-4 md:p-6">
                            <div className="flex justify-between items-center mb-3">
                                <h6 className="text-lg font-bold text-slate-800 mb-6 ">
                                    {watchSalesOrderId ? "2. Production Item Details" : "1. Direct Production Item Details"}
                                </h6>
                                {!watchSalesOrderId && (
                                    <CustomButton
                                        text="Add Production"
                                        icon={FaPlus}
                                        type="button"
                                        onClick={() => appendProduct({ productItemId: "", targetQty: 0, damageQty: 100, uom: "PCS", rawMaterials: [{ rawMaterialId: "", requiredQty: "", uom: "", storeId: "", remarks: "" }] })}
                                    />
                                )}
                            </div>
                            <div className="p-0">
                                {productFields.map((prodItem, index) => (
                                    <div key={prodItem.id} className={index > 0 ? "mt-4 pt-4 border-t border-slate-200" : ""}>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 grow">Product {index + 1}</h3>
                                            {!watchSalesOrderId && productFields.length > 1 && (
                                                <DeleteButton onClick={() => removeProduct(index)} />
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                            <div className="md:col-span-5">
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
                                                            onChange={(e) => {
                                                                field.onChange(e);
                                                                const p = products.find((x) => x.id?.toString() === e.target.value);
                                                                if (p) {
                                                                    setValue(`products.${index}.uom` as any, p.uom?.name || p.uom?.uomCode || "PCS");
                                                                }
                                                            }}
                                                            required
                                                            disabled={!!watchSalesOrderId}
                                                            error={errors.products?.[index]?.productItemId?.message}
                                                        />
                                                    )}
                                                />
                                            </div>
                                            <div className="md:col-span-3">
                                                <Controller
                                                    name={`products.${index}.targetQty` as const}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <TextInput
                                                            label="Target Quantity"
                                                            name={field.name}
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={field.value !== undefined ? String(field.value) : ""}
                                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                                            required
                                                            disabled={!!watchSalesOrderId}
                                                            error={errors.products?.[index]?.targetQty?.message}
                                                        />
                                                    )}
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <Controller
                                                    name={`products.${index}.colorType` as const}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <SelectInput
                                                            label="Color"
                                                            name={field.name}
                                                            value={field.value || "sc"}
                                                            options={[
                                                                { label: "Single Color", value: "sc" },
                                                                { label: "Multi Color", value: "mc" },
                                                            ]}
                                                            onChange={field.onChange}
                                                            disabled={!!watchSalesOrderId}
                                                            error={errors.products?.[index]?.colorType?.message}
                                                        />
                                                    )}
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <Controller
                                                    name={`products.${index}.uom` as const}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <UOMSelect
                                                            label="UOM"
                                                            name={field.name}
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            required
                                                            disabled={!!watchSalesOrderId}
                                                            error={errors.products?.[index]?.uom?.message}
                                                            category={["length", "mass", "each"]}
                                                            allowedCodes={[
                                                                // "kg", "g", "t", "ton",
                                                                // "l", "ml", "ltr",
                                                                // "m", "cm", "mtr",
                                                                "ea"
                                                                // , "dz"
                                                            ]}
                                                        />
                                                    )}
                                                />
                                            </div>
                                            <ProductRawMaterialsSection
                                                productIndex={index}
                                                productName={products.find(p => p.id?.toString() === watchProducts?.[index]?.productItemId)?.productName}
                                                control={control}
                                                watch={watch}
                                                errors={errors.products?.[index]}
                                                storeOptions={storeOptions}
                                                rowRmStates={rowRmStates}
                                                handleStoreChange={handleStoreChange}
                                                handleRmChange={handleRmChange}
                                                fetchRawMaterialsForStore={fetchRawMaterialsForStore}
                                                setValue={setValue}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-2">
                                    <div className="md:col-span-3">
                                        <Controller
                                            name="orderDate"
                                            control={control}
                                            render={({ field }) => (
                                                <TextInput
                                                    label="Order Date"
                                                    name={field.name}
                                                    type="date"
                                                    value={field.value ? field.value.substring(0, 10) : ""}
                                                    onChange={field.onChange}
                                                    required
                                                    error={errors.orderDate?.message}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <Controller
                                            name="dueDate"
                                            control={control}
                                            render={({ field }) => (
                                                <TextInput
                                                    label="Due Date"
                                                    name={field.name}
                                                    type="date"
                                                    value={field.value ? field.value.substring(0, 10) : ""}
                                                    onChange={field.onChange}
                                                    required
                                                    error={errors.dueDate?.message}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <Controller
                                            name="priority"
                                            control={control}
                                            render={({ field }) => (
                                                <SelectInput
                                                    label="Dispatch Type"
                                                    name={field.name}
                                                    value={field.value}
                                                    options={DISPATCH_TYPE_OPTIONS}
                                                    defaultOptionLabel="Select Dispatch Type"
                                                    onChange={field.onChange}
                                                    required
                                                    disabled={!!watchSalesOrderId}
                                                    error={errors.priority?.message}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <Controller
                                            name="orderType"
                                            control={control}
                                            render={({ field }) => (
                                                <SelectInput
                                                    label="Order Type"
                                                    name={field.name}
                                                    value={field.value}
                                                    options={ORDER_TYPE_OPTIONS}
                                                    defaultOptionLabel="Select Order Type"
                                                    onChange={field.onChange}
                                                    required
                                                    disabled={!!watchSalesOrderId}
                                                    error={errors.orderType?.message}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* â”€â”€ 2. General Details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                        <div className="md:col-span-12 lg:col-span-4 p-4 md:p-6">

                            <h6 className="text-lg font-bold text-slate-800 mb-6">
                                2. General Details
                            </h6>

                            <Controller
                                name="productionOrderId"
                                control={control}
                                render={({ field }) => (
                                    <CtrlText
                                        field={field}
                                        label="Production Order ID"
                                        placeholder="Auto Generated"
                                        required
                                        disabled
                                        error={
                                            errors.productionOrderId?.message
                                        }
                                    />
                                )}
                            />

                            <Controller
                                name="remarks"
                                control={control}
                                render={({ field }) => (
                                    <TextArea
                                        label="Remarks"
                                        name={field.name}
                                        value={field.value ?? ""}
                                        placeholder="Any remarks for this orderâ€¦"
                                        rows={2}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    {/* â”€â”€ Form Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    <div className="form-actions pb-4 pr-3 flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
                        <CustomButton
                            text="Clear Form"
                            icon={FaEraser}
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
                                        ? isEditMode
                                            ? "Updatingâ€¦"
                                            : "Creatingâ€¦"
                                        : isEditMode
                                            ? "Update Order"
                                            : "Create Production Order"
                                }
                                icon={isSubmitting ? undefined : FaSave}
                                onClick={handleSubmit((data) => onSubmit({ ...data, status: data.status === "DRAFT" ? "PLANNED" : data.status }))}
                                type="button"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </form>
            </div>
        </div >
    );
};

export default ProductionOrderCreate;
