import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Container, Row, Col } from "react-bootstrap";
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
import Button from "../../../components/ui/custombutton/CustomButton";
import TextArea from "../../../components/form/TextArea/TextArea";
import UOMSelect from "../../../components/form/SelectInput/UOMSelect";
import QuantityInput from "../../../components/form/QuantityInput/QuantityInput";

import { productionOrderService } from "../../../services/productionOrderService";
import { storeService } from "../../../services/storeService";
import { salesOrderService } from "../../../services/salesOrderService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { productService } from "../../../services/productService";
import { billOfMaterialService } from "../../../services/billOfMaterialService";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Options ─────────────────────────────────────────────────────────────────

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

// ─── Zod Schema ──────────────────────────────────────────────────────────────

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

// ─── Defaults ────────────────────────────────────────────────────────────────

const today = new Date().toISOString().split("T")[0];
const nextWeek = new Date(
    new Date().setDate(new Date().getDate() + 7)
).toISOString().split("T")[0];

const defaultValues: ProductionOrderFormValues = {
    id: undefined,
    sourceSalesOrderId: "",
    sourceSalesOrderLineId: "",
    products: [{ productItemId: "", targetQty: 0, damageQty: 100, uom: "PCS", sourceSalesOrderLineId: "", rawMaterials: [], colorType: "sc" }],
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

// ─── CtrlText helper ─────────────────────────────────────────────────────────

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

// ─── RawMaterialRow ───────────────────────────────────────────────────────────
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
            <td className="master-data-cell">
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
            <td className="master-data-cell">
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
                                <div className="text-muted small mt-1">
                                    Fetching raw materials…
                                </div>
                            )}
                            {showEmpty && (
                                <div className="text-danger small mt-1">
                                    No Raw Materials available in this Store.
                                </div>
                            )}
                        </>
                    )}
                />
            </td>

            {/* REQUIRED QTY & UOM */}
            <td className="master-data-cell">
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
            <td className="master-data-cell">
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
            <td className="master-data-cell text-center align-middle">
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
        <Col md={12} className="mt-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="section-title border-bottom-0 ">
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

            {fields.length === 0 ? (
                <div className="text-muted text-center p-3 border rounded bg-light">
                    No raw materials added. Click 'Add Material Row' to include materials.
                </div>
            ) : (
                <div className="master-table-body table-wrap mt-2 mb-2">
                    <table className="master-data-table">
                        <thead>
                            <tr>
                                <th>
                                    STORE{" "}
                                    <span className="text-danger">
                                        *
                                    </span>
                                </th>
                                <th>
                                    RAW MATERIAL{" "}
                                    <span className="text-danger">
                                        *
                                    </span>
                                </th>
                                <th>
                                    REQUIRED QTY & UOM{" "}
                                    <span className="text-danger">
                                        *
                                    </span>
                                </th>
                                <th>REMARKS</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
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
            )}
        </Col>
    );
});

// ─── Main Component ───────────────────────────────────────────────────────────

const ProductionOrderCreate: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // ── Generic state ───────────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [orderId, setOrderId] = useState<number | string | null>(null);

    const [stores, setStores] = useState<any[]>([]);
    const [boms, setBoms] = useState<any[]>([]);

    const [selectedSalesOrder, setSelectedSalesOrder] = useState<any>(null);
    const [selectedSalesOrderItems, setSelectedSalesOrderItems] = useState<any[]>([]);
    const [isFetchingSalesOrder, setIsFetchingSalesOrder] = useState(false);

    // ── Per-row raw material state ──────────────────────────────────────────
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

    // ── React Hook Form ─────────────────────────────────────────────────────
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

    // ── Store changed for a specific row ────────────────────────────────────
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

    // ── Load Dependencies ───────────────────────────────────────────────────
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

    // ── Sales Order watch ───────────────────────────────────────────────────
    useEffect(() => {
        if (!watchSalesOrderId) {
            setSelectedSalesOrder(null);
            setSelectedSalesOrderItems([]);
            setValue("sourceSalesOrderLineId", "");
            setValue("products", [{ productItemId: "", targetQty: 0, damageQty: 100, uom: "PCS", rawMaterials: [] }]);
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
                                rawMaterials: [],
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

    // ── Recalculate Raw Material Required Qty when Target Qty/Damage Qty changes ────────────
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

    // ── Edit mode: hydrate form from route parameter ────────────────────────────
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
                        products: [{
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
                    console.error("❌ Failed to fetch order details for edit:", err);
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
                products: [{ productItemId: "", targetQty: 0, damageQty: 100, uom: "PCS", rawMaterials: [], colorType: "sc" }],
            });

            productionOrderService
                .fetchNextId()
                .then((orderNo) => setValue("productionOrderId", orderNo))
                .catch(() => { });

            const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            setValue("batchNo", `BAT-${dateStr}-${suffix}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, reset, setValue]);

    // ── Memoised select option lists ────────────────────────────────────────
    const storeOptions = useMemo(
        () =>
            stores.map((s) => ({
                label: s.storeName || s.name || s.storeId?.toString() || s.id?.toString(),
                value: (s.storeId ?? s.id)?.toString(),
            })),
        [stores]
    );

    // ── Submit ──────────────────────────────────────────────────────────────
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
                toast.success("Production Order updated successfully!");
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
                toast.success("Production Order(s) created successfully!");
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

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">
                                    {isEditMode
                                        ? "Edit Production Order"
                                        : "Create Production Order"}
                                </h2>
                                <div className="page-breadcrumb">
                                    Home / Production / Orders /{" "}
                                    {isEditMode ? "Edit" : "Create"}
                                    {isEditMode && orderId && (
                                        <span className="ms-2 text-muted">
                                            (ID: {orderId})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/production-orders")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="form-inner"
                    noValidate
                >
                    <Row className="g-3">

                        {/* ── 1. Source Information ─────────────────────────── */}
                        {watchSalesOrderId && (
                            <>
                                <Col md={12}>
                                    <h6 className="section-title border-bottom-0 ">
                                        1. Selected Sales Order
                                    </h6>
                                    <div className="p-3 border rounded" style={{ backgroundColor: "rgba(203, 122, 33, 0.08)" }}>
                                        {isFetchingSalesOrder ? (
                                            <div className="text-muted">
                                                Fetching Sales Order details…
                                            </div>
                                        ) : selectedSalesOrder ? (
                                            <Row>
                                                <Col md={3}>
                                                    <div className="text-muted small">
                                                        Sales Order No
                                                    </div>
                                                    <div className="fw-bold">
                                                        {selectedSalesOrder.orderNo || "-"}
                                                    </div>
                                                </Col>
                                                <Col md={3}>
                                                    <div className="text-muted small">
                                                        Customer
                                                    </div>
                                                    <div className="fw-bold">
                                                        {selectedSalesOrder.customer
                                                            ?.firmName || "-"}
                                                    </div>
                                                </Col>
                                                <Col md={3}>
                                                    <div className="text-muted small">
                                                        Order Date
                                                    </div>
                                                    <div className="fw-bold">
                                                        {selectedSalesOrder.orderDate
                                                            ? new Date(
                                                                selectedSalesOrder.orderDate
                                                            ).toLocaleDateString("en-IN")
                                                            : "-"}
                                                    </div>
                                                </Col>
                                                <Col md={3}>
                                                    <div className="text-muted small">
                                                        Due Date
                                                    </div>
                                                    <div className="fw-bold">
                                                        {selectedSalesOrder.expectedCompletionDate
                                                            ? new Date(
                                                                selectedSalesOrder.expectedCompletionDate
                                                            ).toLocaleDateString("en-IN")
                                                            : "-"}
                                                    </div>
                                                </Col>
                                            </Row>
                                        ) : (
                                            <div className="text-danger">
                                                No Sales Order selected. Please navigate
                                                from Approved Sales Orders.
                                            </div>
                                        )}
                                    </div>
                                </Col>
                                {/* ── Sales Order Items read-only table ───────────── */}
                                {selectedSalesOrderItems.length > 0 && (
                                    <Col md={12} className="mt-3 mb-3">
                                        <h6 className="fw-semibold mb-3">
                                            Sales Order Items
                                        </h6>
                                        <div className="master-table-body table-wrap mt-2 mb-4">
                                            <table className="master-data-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: 60 }}>#</th>
                                                        <th>PRODUCT NAME</th>
                                                        <th>PRODUCT CODE</th>
                                                        <th>COLOR</th>
                                                        <th>ORDERED QUANTITY</th>
                                                        <th>UOM</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedSalesOrderItems.map(
                                                        (item, i) => (
                                                            <tr
                                                                key={i}
                                                                className="master-data-row"
                                                            >
                                                                <td className="master-data-cell">
                                                                    {i + 1}
                                                                </td>
                                                                <td className="master-data-cell fw-medium">
                                                                    {item.product
                                                                        ?.productName ||
                                                                        `Product ID: ${item.productId}`}
                                                                </td>
                                                                <td className="master-data-cell">
                                                                    {item.product
                                                                        ?.productCode ||
                                                                        "-"}
                                                                </td>
                                                                <td className="master-data-cell">
                                                                    {item.colorType === 'mc' ? 'Multi Color' : (item.colorType === 'sc' ? 'Single Color' : '-')}
                                                                </td>
                                                                <td className="master-data-cell">
                                                                    {item.quantity}
                                                                </td>
                                                                <td className="master-data-cell">
                                                                    {item.product?.uom
                                                                        ?.name || "PCS"}
                                                                </td>
                                                            </tr>
                                                        )
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Col>
                                )}
                            </>
                        )}
                        <Col md={12}>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h6 className="mb-0 border-bottom-0 section-title">
                                    {watchSalesOrderId ? "2. Production Item Details" : "1. Direct Production Item Details"}
                                </h6>
                                {!watchSalesOrderId && (
                                    <CustomButton
                                        text="Add Production"
                                        icon={FaPlus}
                                        type="button"
                                        onClick={() => appendProduct({ productItemId: "", targetQty: 0, damageQty: 100, uom: "PCS", rawMaterials: [] })}
                                    />
                                )}
                            </div>
                            <div className="p-3 border rounded">
                                {productFields.map((prodItem, index) => (
                                    <div key={prodItem.id} className={index > 0 ? "mt-4 pt-4 border-top" : ""}>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <span className=" section-title border-bottom-0 ">Product {index + 1}</span>
                                            {!watchSalesOrderId && productFields.length > 1 && (
                                                <DeleteButton onClick={() => removeProduct(index)} />
                                            )}
                                        </div>
                                        <Row className="g-3">
                                            <Col md={5}>
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
                                            </Col>
                                            <Col md={3}>
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
                                            </Col>
                                            <Col md={2}>
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
                                            </Col>
                                            <Col md={2}>
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
                                            </Col>
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
                                        </Row>
                                    </div>
                                ))}
                                <Row className="g-3 mt-2">
                                    <Col md={3}>
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
                                    </Col>
                                    <Col md={3}>
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
                                    </Col>
                                    <Col md={3}>
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
                                    </Col>
                                    <Col md={3}>
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
                                    </Col>
                                </Row>
                            </div>
                        </Col>
                        <Col md={12}>
                            <hr />
                        </Col>

                        {/* ── 2. General Details ──────────────────────────── */}
                        <Col md={12}>
                            <hr />
                            <h6 className="section-title border-bottom-0 ">
                                2. General Details
                            </h6>
                        </Col>

                        <Col md={6}>
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
                        </Col>

                        {/* ── 3. Tracking ─────────────────────────────────── */}
                        <Col lg={12} className="mt-4">
                            <h6 className="section-title border-bottom-0 ">
                                3. Tracking & Assignments
                            </h6>
                            <Row className="g-3">
                                <Col md={6}>
                                    <Controller
                                        name="batchNo"
                                        control={control}
                                        render={({ field }) => (
                                            <CtrlText
                                                field={field}
                                                label="Batch No"
                                                placeholder="Auto Generated"
                                                disabled
                                            />
                                        )}
                                    />
                                </Col>
                                <Col md={6}>
                                    <Controller
                                        name="lotNo"
                                        control={control}
                                        render={({ field }) => (
                                            <CtrlText
                                                field={field}
                                                label="Lot No"
                                                placeholder="Enter Lot No"
                                            />
                                        )}
                                    />
                                </Col>
                            </Row>
                        </Col>



                        {/* ── Remarks ──────────────────────────────────────── */}
                        <Col md={12} className="mt-3">
                            <Controller
                                name="remarks"
                                control={control}
                                render={({ field }) => (
                                    <TextArea
                                        label="Remarks"
                                        name={field.name}
                                        value={field.value ?? ""}
                                        placeholder="Any remarks for this order…"
                                        rows={2}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </Col>
                    </Row>

                    {/* ── Form Actions ──────────────────────────────────────── */}
                    <div className="form-actions d-flex justify-content-end gap-3 mt-4 pt-3 border-top">
                        <CustomButton
                            text="Clear Form"
                            icon={FaEraser}
                            onClick={() => {
                                reset(defaultValues);
                                setRowRmStates({});
                            }}
                            disabled={isSubmitting}
                        />
                        <div className="ms-2">
                            <CustomButton
                                text={isSubmitting ? "Saving..." : "Save as Draft"}
                                onClick={handleSubmit((data) => onSubmit({ ...data, status: "DRAFT" }))}
                                disabled={isSubmitting}
                                className="btn-secondary"
                            />
                        </div>
                        <div className="ms-2">
                            <Button
                                text={
                                    isSubmitting
                                        ? isEditMode
                                            ? "Updating…"
                                            : "Creating…"
                                        : isEditMode
                                            ? "Update Order"
                                            : "Create Production Order"
                                }
                                icon={isSubmitting ? undefined : FaSave}
                                onClick={handleSubmit(onSubmit)}
                                type="button"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </form>
            </Container>
        </div >
    );
};

export default ProductionOrderCreate;
