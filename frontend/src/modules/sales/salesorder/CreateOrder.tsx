import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import TextArea from "../../../components/form/TextArea/TextArea";
import DateInput from "../../../components/form/DateInput/DateInput";
import { useCustomers } from "../../../hooks/useCustomers";
import { salesOrderService } from "../../../services/salesOrderService";
import { useEmployees } from "../../../hooks/useEmployees";
import { salesProductService } from "../../../services/salesProductService";
import { ORDER_TYPE_OPTIONS } from "../../../constants/selectOption";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const componentSchema = z.object({
    componentProductId: z.string(),
    productName: z.string(),
    perUnit: z.number(),
    included: z.boolean(),
    quantity: z.string(),
});

const orderItemSchema = z.object({
    salesProductId: z.string().min(1, "Sales product is required"),
    orderQuantity: z.string(),
    components: z.array(componentSchema),
});

const salesOrderSchema = z
    .object({
        id: z.number().optional(),
        orderNo: z.string().min(1, "Order No is required"),
        orderDate: z.string().min(1, "Order Date is required"),
        customerId: z.string().min(1, "Customer is required"),
        mobile: z.string().optional().nullable(),
        orderType: z.string().optional(),
        referenceText: z.string().optional(),
        salesPersonName: z.string().optional(),
        isInterState: z.boolean(),

        items: z.array(orderItemSchema).min(1, "At least one item is required"),

        narration: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.orderType === "salesperson" && !data.salesPersonName?.trim()) {
            ctx.addIssue({ code: "custom", message: "Salesperson name is required", path: ["salesPersonName"] });
        }
        if (data.orderType === "reference" && !data.referenceText?.trim()) {
            ctx.addIssue({ code: "custom", message: "Reference text is required", path: ["referenceText"] });
        }
    });

// ─── Types ────────────────────────────────────────────────────────────────────

type ComponentItem = {
    componentProductId: string;
    productName: string;
    perUnit: number;
    included: boolean;
    quantity: string;
};

type SalesOrderFormValues = {
    id?: number;
    orderNo: string;
    orderDate: string;
    customerId: string;
    mobile?: string | null;
    orderType?: string;
    referenceText?: string;
    salesPersonName?: string;
    isInterState: boolean;
    items: Array<{ salesProductId: string; orderQuantity: string; components: ComponentItem[] }>;
    narration?: string;
};

const today = new Date().toISOString().split("T")[0];

const defaultValues: SalesOrderFormValues = {
    id: undefined,
    orderNo: "",
    orderDate: today,
    customerId: "",
    mobile: "",
    salesPersonName: "",
    orderType: "",
    referenceText: "",
    isInterState: false,
    items: [{ salesProductId: "", orderQuantity: "1", components: [] }],
    narration: "",
};

// ─── Helper ───────────────────────────────────────────────────────────────────

const Err: React.FC<{ message?: string }> = ({ message }) =>
    message ? <div className="text-red-500 mt-1 text-sm">{message}</div> : null;

/** Build components list from a SalesProduct, filtered to SALES_PRODUCTION only */
function buildComponents(sp: any, orderQty: number = 1): ComponentItem[] {
    return (sp?.components || [])
        .filter((comp: any) => comp.componentProduct?.productType === "SALES_PRODUCTION")
        .map((comp: any) => {
            const perUnit = Number(comp.quantity ?? 1);
            return {
                componentProductId: String(comp.componentProductId),
                productName: comp.componentProduct?.productName || comp.componentProduct?.productCode || String(comp.componentProductId),
                perUnit,
                included: true,
                quantity: String(perUnit * orderQty),
            };
        });
}

/** Reconstruct form items from saved SalesOrder items and SalesProducts */
function reconstructFormItems(orderItems: any[], salesProducts: any[]): Array<{ salesProductId: string; orderQuantity: string; components: ComponentItem[] }> {
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
        return [{ salesProductId: "", orderQuantity: "1", components: [] }];
    }

    const result: Array<{ salesProductId: string; orderQuantity: string; components: ComponentItem[] }> = [];
    const processedOrderItemIds = new Set<any>();

    salesProducts.forEach(sp => {
        const spComps = (sp?.components || []).filter(
            (comp: any) => comp.componentProduct?.productType === "SALES_PRODUCTION"
        );

        const matchingOrderItems = orderItems.filter(oi =>
            spComps.some((c: any) => String(c.componentProductId) === String(oi.productId))
        );

        if (matchingOrderItems.length > 0) {
            matchingOrderItems.forEach(oi => processedOrderItemIds.add(oi.id || oi.productId));

            const firstMatch = matchingOrderItems[0];
            const matchingSpComp = spComps.find(
                (c: any) => String(c.componentProductId) === String(firstMatch.productId)
            );
            const perUnit = Number(matchingSpComp?.quantity || 1);
            const calcOrderQty = Math.max(1, Math.round(Number(firstMatch.quantity || 1) / perUnit));

            const components: ComponentItem[] = spComps.map((c: any) => {
                const compPerUnit = Number(c.quantity || 1);
                const oi = matchingOrderItems.find(
                    item => String(item.productId) === String(c.componentProductId)
                );
                return {
                    componentProductId: String(c.componentProductId),
                    productName: c.componentProduct?.productName || c.componentProduct?.productCode || String(c.componentProductId),
                    perUnit: compPerUnit,
                    included: Boolean(oi),
                    quantity: oi ? String(oi.quantity) : String(compPerUnit * calcOrderQty),
                };
            });

            result.push({
                salesProductId: String(sp.id),
                orderQuantity: String(calcOrderQty),
                components,
            });
        }
    });

    const remainingItems = orderItems.filter(oi => !processedOrderItemIds.has(oi.id || oi.productId));
    remainingItems.forEach(oi => {
        const directSp = salesProducts.find(s => String(s.id) === String(oi.productId));
        if (directSp) {
            const qty = Math.max(1, Number(oi.quantity) || 1);
            result.push({
                salesProductId: String(directSp.id),
                orderQuantity: String(qty),
                components: buildComponents(directSp, qty),
            });
        }
    });

    return result.length > 0 ? result : [{ salesProductId: "", orderQuantity: "1", components: [] }];
}

// ─── Per-Item Row ─────────────────────────────────────────────────────────────

interface ItemRowProps {
    control: any;
    index: number;
    errors: any;
    salesProducts: any[];
    salesProductOptions: { value: string; label: string }[];
    remove: (index: number) => void;
    canRemove: boolean;
    setValue: any;
}

const ItemRow: React.FC<ItemRowProps> = ({
    control, index, errors, salesProducts, salesProductOptions, remove, canRemove, setValue,
}) => {
    const itemValue = useWatch({ control, name: `items.${index}` });
    const allItems = useWatch({ control, name: "items" }) || [];
    const components: ComponentItem[] = itemValue?.components || [];
    const orderQty = itemValue?.orderQuantity ?? "1";

    const filteredOptions = useMemo(() => {
        const selectedInOtherRows = new Set(
            allItems
                .filter((_: any, i: number) => i !== index)
                .map((item: any) => String(item?.salesProductId))
                .filter(Boolean)
        );

        return salesProductOptions.map(opt => ({
            ...opt,
            disabled: selectedInOtherRows.has(String(opt.value)),
        }));
    }, [salesProductOptions, allItems, index]);

    const toggleIncluded = (compIdx: number) => {
        const updated = components.map((c, i) =>
            i === compIdx ? { ...c, included: !c.included } : c
        );
        setValue(`items.${index}.components`, updated);
    };

    const setCompQty = (compIdx: number, qty: string) => {
        const updated = components.map((c, i) =>
            i === compIdx ? { ...c, quantity: qty } : c
        );
        setValue(`items.${index}.components`, updated);
    };

    const handleOrderQtyChange = (qty: string) => {
        setValue(`items.${index}.orderQuantity`, qty);
        const numQty = Math.max(1, Number(qty) || 1);
        const updated = components.map(c => ({
            ...c,
            quantity: String(c.perUnit * numQty),
        }));
        setValue(`items.${index}.components`, updated);
    };

    const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const spId = e.target.value;
        const sp = salesProducts.find(s => String(s.id) === spId);
        setValue(`items.${index}.salesProductId`, spId);
        setValue(`items.${index}.orderQuantity`, "1");
        setValue(`items.${index}.components`, sp ? buildComponents(sp, 1) : []);
    };

    const hasComponents = components.length > 0;
    const hasNoSalesProductionComponents = itemValue?.salesProductId &&
        salesProducts.find(s => String(s.id) === itemValue.salesProductId)?.components?.length > 0 &&
        components.length === 0;

    return (
        <div className="border border-line-soft rounded-xl p-4 bg-card mb-3">
            {/* ── Top row: number + product + qty + delete ── */}
            <div className="flex items-end gap-3">
                <span className="text-sm font-medium text-ink-subtle pb-2 w-5 shrink-0">{index + 1}</span>

                <div className="flex-1 min-w-0">
                    <SelectInput
                        label="Sales Product"
                        name={`items.${index}.salesProductId`}
                        value={itemValue?.salesProductId || ""}
                        options={filteredOptions}
                        onChange={handleProductChange}
                        defaultOptionLabel="Select sales product"
                        error={(errors.items as any)?.[index]?.salesProductId?.message}
                        searchable
                    />
                </div>

                {/* Order Quantity */}
                <div className="shrink-0 w-32">
                    <TextInput
                        label="Order Qty"
                        name={`items.${index}.orderQuantity`}
                        type="number"
                        value={orderQty}
                        min="1"
                        preventNegative
                        onChange={e => handleOrderQtyChange(e.target.value)}
                    />
                </div>

                {/* Remove */}
                <div className="pb-1 shrink-0">
                    <DeleteButton
                        onClick={() => remove(index)}
                        disabled={!canRemove}
                        disabledMessage="At least one item is required."
                    />
                </div>
            </div>

            {/* ── Warning / Components ── */}
            <div className="ml-8 mt-2">
                {hasNoSalesProductionComponents && (
                    <p className="text-xs text-amber-500">
                        This product has no "Sales Production" type components.
                    </p>
                )}

                {hasComponents && (
                    <div className="rounded-md border border-line-soft overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-[auto_1fr_auto_120px] gap-2 px-3 py-2 bg-card-2 border-b border-line-soft">
                            <div className="w-5" />
                            <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">Component</span>
                            <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider text-center w-16">Per Unit</span>
                            <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider text-center">Quantity</span>
                        </div>

                        {/* Component rows */}
                        {components.map((comp, compIdx) => (
                            <div
                                key={comp.componentProductId}
                                className={`grid grid-cols-[auto_1fr_auto_120px] gap-2 items-center px-3 py-2 border-b border-line-soft last:border-b-0 transition-colors ${comp.included ? "bg-card" : "bg-card-2 opacity-60"}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={comp.included}
                                    onChange={() => toggleIncluded(compIdx)}
                                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                                />

                                <span className={`text-sm ${comp.included ? "text-ink font-medium" : "line-through text-ink-subtle"}`}>
                                    {comp.productName}
                                </span>

                                {/* Per-unit badge */}
                                <span className="text-xs text-ink-subtle text-center w-16">×{comp.perUnit}</span>

                                {/* Per-component Qty input */}
                                <input
                                    type="number"
                                    min="0"
                                    value={comp.quantity}
                                    disabled={!comp.included}
                                    onChange={e => setCompQty(compIdx, e.target.value)}
                                    className={`w-full text-sm border border-line-soft rounded px-2 py-1 text-center bg-card-2 text-ink focus:outline-none focus:border-primary transition
                                        ${!comp.included ? "cursor-not-allowed opacity-50" : ""}
                                    `}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Form Component ──────────────────────────────────────────────────────

const SalesOrderForm: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: routeId } = useParams<{ id?: string }>();
    const { can } = usePermission();
    const targetId = routeId ? Number(routeId) : null;
    const isEditMode = Boolean(targetId);

    const { customers, loadCustomers } = useCustomers();
    const { loadEmployees } = useEmployees();
    const { socket } = useSocketSync();

    const [salesProducts, setSalesProducts] = useState<any[]>([]);
    const [orderId, setOrderId] = useState<number | null>(null);
    const [companyState, setCompanyState] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const justResetRef = React.useRef(false);

    const {
        control,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm<SalesOrderFormValues>({
        resolver: zodResolver(salesOrderSchema),
        defaultValues,
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });

    // ─── Socket Sync ─────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;
        const handleOrderUpdated = (data: { orderId: number }) => {
            if (targetId && Number(data.orderId) === Number(targetId)) {
                toast.info("This sales order was updated elsewhere. Refreshing...");
                salesOrderService.fetchById(targetId).then(orderData => {
                    const formItems = reconstructFormItems(orderData.items || [], salesProducts);
                    reset({
                        id: orderData.id,
                        orderNo: orderData.orderNo || "",
                        orderDate: orderData.orderDate ? orderData.orderDate.split("T")[0] : today,
                        orderType: orderData.orderType || "",
                        customerId: orderData.customerId != null ? String(orderData.customerId) : "",
                        mobile: orderData.mobile || "",
                        referenceText: orderData.referenceText || "",
                        salesPersonName: orderData.salesPersonName || "",
                        narration: orderData.remarks || orderData.internalNotes || "",
                        items: formItems,
                        isInterState: Boolean(orderData.isInterState),
                    });
                });
            }
        };
        socket.on("salesOrder:updated", handleOrderUpdated);
        return () => { socket.off("salesOrder:updated", handleOrderUpdated); };
    }, [socket, targetId, salesProducts, reset]);

    // ─── Load company info for inter-state ───────────────────────────
    useEffect(() => {
        salesOrderService.fetchCompanyState()
            .then(st => setCompanyState(st || ""))
            .catch(() => setCompanyState(""));
    }, []);

    // ─── Load sales products & order data ────────────────────────────
    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            try {
                const productsData = await salesProductService.fetchAll();
                const activeProducts = Array.isArray(productsData) ? productsData.filter((sp: any) => sp.isActive !== false) : [];
                if (isMounted) setSalesProducts(activeProducts);

                if (targetId) {
                    setOrderId(targetId);
                    const orderData = await salesOrderService.fetchById(targetId);
                    if (!isMounted) return;

                    const formItems = reconstructFormItems(orderData.items || [], activeProducts);

                    justResetRef.current = true;
                    reset({
                        id: orderData.id,
                        orderNo: orderData.orderNo || "",
                        orderDate: orderData.orderDate ? orderData.orderDate.split("T")[0] : today,
                        orderType: orderData.orderType || "",
                        customerId: orderData.customerId != null ? String(orderData.customerId) : "",
                        mobile: orderData.mobile || "",
                        referenceText: orderData.referenceText || "",
                        salesPersonName: orderData.salesPersonName || "",
                        narration: orderData.remarks || orderData.internalNotes || "",
                        items: formItems,
                        isInterState: Boolean(orderData.isInterState),
                    });
                } else {
                    setOrderId(null);
                    reset(defaultValues);
                    try {
                        const nextCode = await salesOrderService.getNextOrderNo();
                        if (isMounted && nextCode) {
                            setValue("orderNo", nextCode);
                        }
                    } catch (err) {
                        console.error("❌ Failed to fetch next order number:", err);
                    }
                }
            } catch (err) {
                console.error("❌ Failed to load sales order edit data:", err);
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, [targetId, reset, setValue]);

    // ─── Load on mount ───────────────────────────────────────────────
    useEffect(() => {
        loadCustomers();
        if (can("employees.view")) loadEmployees({});
    }, [loadCustomers, loadEmployees, can]);

    // ─── Options ─────────────────────────────────────────────────────
    const customerOptions = useMemo(() =>
        customers.map(d => {
            const name = d.displayName || d.firmName;
            const type = d.customerType?.name;
            const grade = d.customerGrade?.name;
            const location = d.billingCity || d.billingState;
            const tags = [
                type ? `(${type})` : null,
                grade ? `[${grade.charAt(0).toUpperCase()}]` : null,
                location || null,
            ].filter(Boolean).join(" · ");
            return { value: String(d.id), label: tags ? `${name} ${tags}` : name };
        }),
        [customers]
    );

    const salesProductOptions = useMemo(() =>
        salesProducts.map(sp => ({
            value: String(sp.id),
            label: sp.salesProductName || sp.salesProductCode,
        })),
        [salesProducts]
    );

    // ─── Watched fields ──────────────────────────────────────────────
    const selectedCustomerId = watch("customerId");
    const orderType = watch("orderType");

    const selectedCustomer = useMemo(() =>
        customers.find(c => String(c.id) === selectedCustomerId) || null,
        [selectedCustomerId, customers]
    );

    const mobileOptions = useMemo(() => {
        if (!selectedCustomer) return [];
        const mobile = selectedCustomer.mobile;
        if (Array.isArray(mobile)) {
            return mobile.map((m: any) => ({ value: m.number, label: `${m.label || "Mobile"}: ${m.number}`, selectedLabel: m.number }));
        } else if (typeof mobile === "string" && mobile.trim()) {
            return [{ value: mobile, label: `Primary: ${mobile}`, selectedLabel: mobile }];
        }
        return [];
    }, [selectedCustomer]);

    useEffect(() => {
        if (isEditMode) return;
        if (mobileOptions.length > 0) {
            const cur = watch("mobile");
            if (!cur || !mobileOptions.some(o => o.value === cur)) {
                setValue("mobile", mobileOptions[0].value, { shouldValidate: true });
            }
        } else {
            setValue("mobile", "", { shouldValidate: true });
        }
    }, [mobileOptions, setValue, isEditMode, watch]);

    // ─── Clear salesperson/reference ────────────────────────────────
    useEffect(() => {
        if (justResetRef.current) { justResetRef.current = false; return; }
        if (orderType !== "salesperson") setValue("salesPersonName", "", { shouldValidate: true });
        if (orderType !== "reference") setValue("referenceText", "", { shouldValidate: true });
    }, [orderType, setValue]);

    // ─── Inter-state calc ────────────────────────────────────────────
    const computedIsInterState = useMemo(() => {
        const custBillingState = selectedCustomer?.billingState;
        if (!companyState || !custBillingState) return false;
        return companyState.toLowerCase().trim() !== custBillingState.toLowerCase().trim();
    }, [companyState, selectedCustomer]);

    useEffect(() => {
        setValue("isInterState", computedIsInterState, { shouldValidate: true });
    }, [computedIsInterState, setValue]);

    // ─── Submit ──────────────────────────────────────────────────────
    const onSubmit = async (data: SalesOrderFormValues, action: "draft" | "quotation") => {
        setIsSubmitting(true);
        try {
            const expandedMap = new Map<number, number>();

            data.items.forEach(item => {
                (item.components || [])
                    .filter(c => c.included && Number(c.quantity) > 0)
                    .forEach(c => {
                        const id = Number(c.componentProductId);
                        expandedMap.set(id, (expandedMap.get(id) || 0) + Number(c.quantity));
                    });
            });

            const mergedItems = Array.from(expandedMap.entries()).map(([productId, quantity]) => ({
                productId,
                quantity,
            }));

            if (mergedItems.length === 0) {
                toast.error("At least one component product must be included with a quantity > 0.");
                setIsSubmitting(false);
                return;
            }

            const payload: any = {
                orderNo: data.orderNo,
                orderDate: data.orderDate,
                customerId: Number(data.customerId),
                mobile: data.mobile || null,
                orderType: data.orderType || null,
                salesPersonName: data.orderType === "salesperson" ? data.salesPersonName : null,
                referenceText: data.orderType === "reference" ? data.referenceText : null,
                remarks: data.narration || null,
                status: action === "draft" ? "DRAFT" : "SUBMITTED",
                isInterState: data.isInterState,
                items: mergedItems,
            };

            if (targetId) {
                await salesOrderService.update(targetId, payload);
                toast.success("Sales Order updated successfully!");
            } else {
                await salesOrderService.create(payload);
                toast.success(payload.status === "DRAFT" ? "Sales Order Draft created successfully!" : "Sales Order created successfully!");
            }

            navigate(-1);
        } catch (error: any) {
            console.error("❌ Submit Error:", error);
            toast.error(error?.response?.data?.message || "Failed to save sales order");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── Render ──────────────────────────────────────────────────────
    return (
        <div className="w-full mx-auto">
            <div className="bg-card rounded-xl border border-line-soft shadow-xs">
                {/* Header */}
                <div className="px-6 py-4 border-b border-line-soft">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-ink">
                            {isEditMode ? "Edit Sales Order" : "Create Sales Order"}
                        </h2>
                        <BackButton text="Back to List" />
                    </div>
                </div>

                <form className="px-6 py-3 space-y-4" noValidate>
                    {/* ── Main Fields ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        <div>
                            <Controller name="orderNo" control={control} render={({ field }) => (
                                <TextInput label="Order No" name={field.name} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} required disabled error={errors.orderNo?.message} />
                            )} />
                        </div>

                        <div>
                            <Controller name="customerId" control={control} render={({ field }) => (
                                <SelectInput label="Customer" name={field.name} value={field.value} options={customerOptions} required searchable onChange={field.onChange} defaultOptionLabel="Select Customer" disabled={isEditMode} />
                            )} />
                            <Err message={errors.customerId?.message} />
                        </div>

                        <div>
                            <Controller name="mobile" control={control} render={({ field }) => (
                                <SelectInput label="Mobile Number" name={field.name} value={field.value ?? ""} options={mobileOptions} defaultOptionLabel={mobileOptions.length > 0 ? "Select Mobile Number" : "No mobile numbers found"} onChange={field.onChange} disabled={!selectedCustomerId} />
                            )} />
                        </div>

                        <div>
                            <Controller name="orderDate" control={control} render={({ field }) => (
                                <DateInput label="Order Date" name={field.name} value={field.value} required disabled onChange={field.onChange} />
                            )} />
                            <Err message={errors.orderDate?.message} />
                        </div>

                        <div>
                            <Controller name="orderType" control={control} render={({ field }) => (
                                <SelectInput label="Order Source Platform" name={field.name} value={field.value ?? ""} options={ORDER_TYPE_OPTIONS} defaultOptionLabel="select order type" onChange={field.onChange} />
                            )} />
                        </div>

                        {orderType === "salesperson" && (
                            <div>
                                <Controller name="salesPersonName" control={control} render={({ field }) => (
                                    <TextInput label="Salesperson Name" name={field.name} value={field.value ?? ""} placeholder="Enter Salesperson Name" onChange={field.onChange} onBlur={field.onBlur} />
                                )} />
                                <Err message={errors.salesPersonName?.message} />
                            </div>
                        )}

                        {orderType === "reference" && (
                            <div>
                                <Controller name="referenceText" control={control} render={({ field }) => (
                                    <TextInput label="Reference Name" name={field.name} value={field.value ?? ""} placeholder="Enter name or reference" onChange={field.onChange} onBlur={field.onBlur} />
                                )} />
                                <Err message={errors.referenceText?.message} />
                            </div>
                        )}
                    </div>

                    {/* ── Order Items ── */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-lg font-semibold text-ink">Order Items</span>
                            <CustomButton
                                text="Add Sales Product"
                                variant="secondary"
                                onClick={() => append({ salesProductId: "", orderQuantity: "1", components: [] })}
                            />
                        </div>

                        {typeof errors.items?.message === "string" && <Err message={errors.items.message} />}

                        {fields.map((field, index) => (
                            <ItemRow
                                key={field.id}
                                control={control}
                                index={index}
                                errors={errors}
                                salesProducts={salesProducts}
                                salesProductOptions={salesProductOptions}
                                remove={remove}
                                canRemove={fields.length > 1}
                                setValue={setValue}
                            />
                        ))}
                    </div>

                    {/* ── Narration ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <div>
                            <Controller name="narration" control={control} render={({ field }) => (
                                <TextArea label="Narration" name="narration" value={field.value ?? ""} placeholder="Enter narration..." rows={3} onChange={field.onChange} />
                            )} />
                        </div>
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-line-soft">
                        <CustomButton text="Clear" variant="danger" onClick={() => reset(defaultValues)} disabled={isSubmitting} />
                        <CustomButton variant="secondary" text={isSubmitting ? "Saving..." : "Save as Draft"} type="button" onClick={handleSubmit((data) => onSubmit(data as SalesOrderFormValues, "draft"))} disabled={isSubmitting} />
                        <CustomButton text={isSubmitting ? "Saving..." : "Save Order"} type="button" onClick={handleSubmit((data) => onSubmit(data as SalesOrderFormValues, "order"))} disabled={isSubmitting} />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SalesOrderForm;
