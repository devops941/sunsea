import React, { useEffect, useMemo, useState } from "react";
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
import { ORDER_SOURCE_OPTIONS, ORDER_SOURCE_NEEDS_EMPLOYEE, ORDER_SOURCE_NEEDS_REFERRAL, ORDER_SOURCE_NEEDS_DEALER } from "../../../constants/selectOption";
import { companyService } from "../../../services/companyService";
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
        orderSource: z.string().optional(),
        sourceEmployeeId: z.string().optional().nullable(),   // Employee BigInt as string
        referredByCustomerId: z.string().optional().nullable(),
        referredByName: z.string().optional().nullable(),
        isInterState: z.boolean(),
        items: z.array(orderItemSchema).min(1, "At least one item is required"),
        narration: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        if (ORDER_SOURCE_NEEDS_EMPLOYEE.includes(data.orderSource ?? "") && !data.sourceEmployeeId) {
            ctx.addIssue({ code: "custom", message: "Please select the responsible employee", path: ["sourceEmployeeId"] });
        }
        if (ORDER_SOURCE_NEEDS_REFERRAL.includes(data.orderSource ?? "") && !data.referredByCustomerId && !data.referredByName?.trim()) {
            ctx.addIssue({ code: "custom", message: "Please select a customer or enter a referral name", path: ["referredByName"] });
        }
        if (ORDER_SOURCE_NEEDS_DEALER.includes(data.orderSource ?? "") && !data.referredByName?.trim()) {
            ctx.addIssue({ code: "custom", message: "Please enter dealer / agent name", path: ["referredByName"] });
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
    orderSource?: string;
    sourceEmployeeId?: string | null;
    referredByCustomerId?: string | null;
    referredByName?: string | null;
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
    orderSource: "",
    sourceEmployeeId: null,
    referredByCustomerId: null,
    referredByName: null,
    isInterState: false,
    items: [{ salesProductId: "", orderQuantity: "1", components: [] }],
    narration: "",
};

// ─── Helper ───────────────────────────────────────────────────────────────────

const Err: React.FC<{ message?: string }> = ({ message }) =>
    message ? <div className="text-red-500 mt-1 text-sm">{message}</div> : null;

/** Build components list from a SalesProduct, filtered to SALES_PRODUCTION only */
function buildComponents(sp: any, orderQty: number = 1): ComponentItem[] {
    const list = (sp?.components || [])
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
    if (list.length === 0 && sp?.id) {
        return [{
            componentProductId: String(sp.id),
            productName: sp.salesProductName || sp.salesProductCode || String(sp.id),
            perUnit: 1,
            included: true,
            quantity: String(orderQty),
        }];
    }
    return list;
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
                                <TextInput
                                    name={`comp-qty-${compIdx}`}
                                    type="number"
                                    value={comp.quantity}
                                    min="0"
                                    disabled={!comp.included}
                                    onChange={e => setCompQty(compIdx, e.target.value)}
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
    const { employees, loadEmployees } = useEmployees();

    const [salesProducts, setSalesProducts] = useState<any[]>([]);
    const [orderId, setOrderId] = useState<number | null>(null);
    const [companyState, setCompanyState] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const justResetRef = React.useRef(false);
    const editValuesRef = React.useRef<SalesOrderFormValues | null>(null);

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

    // ─── Load company info for inter-state ───────────────────────────
    useEffect(() => {
        companyService.getCompany()
            .then(c => setCompanyState(c?.state || ""))
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

                    const editValues: SalesOrderFormValues = {
                        id: orderData.id,
                        orderNo: orderData.orderNo || "",
                        orderDate: orderData.orderDate ? orderData.orderDate.split("T")[0] : today,
                        customerId: orderData.customerId != null ? String(orderData.customerId) : "",
                        mobile: orderData.mobile || "",
                        orderSource: orderData.orderSource || "",
                        sourceEmployeeId: orderData.sourceEmployeeId != null ? String(orderData.sourceEmployeeId) : null,
                        referredByCustomerId: orderData.referredByCustomerId || null,
                        referredByName: orderData.referredByName || null,
                        narration: orderData.narration || orderData.remarks || orderData.internalNotes || "",
                        items: formItems,
                        isInterState: Boolean(orderData.isInterState),
                    };
                    editValuesRef.current = editValues;
                    justResetRef.current = true;
                    reset(editValues);
                } else {
                    setOrderId(null);
                    reset(defaultValues);
                    try {
                        const nextCode = await salesOrderService.getNextOrderNo();
                        if (isMounted && nextCode) {
                            setValue("orderNo", nextCode);
                        }
                    } catch {
                        // next order number fetch failed — form will remain with empty orderNo
                    }
                }
            } catch {
                // order load failed — navigate back handled by toast in the caller
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
        if (can("employees.view")) loadEmployees({ limit: 500 });
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

    const employeeOptions = useMemo(() =>
        employees.map((e: any) => ({
            value: String(e.id),
            label: e.fullName || e.name || e.empName || e.empCode || `Employee #${e.id}`,
        })),
        [employees]
    );

    // ─── Watched fields ──────────────────────────────────────────────
    const selectedCustomerId = watch("customerId");
    const orderSource = watch("orderSource");

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

    // ─── Clear source sub-fields when orderSource changes ───────────
    useEffect(() => {
        if (justResetRef.current) { justResetRef.current = false; return; }
        if (!ORDER_SOURCE_NEEDS_EMPLOYEE.includes(orderSource ?? "")) {
            setValue("sourceEmployeeId", null, { shouldValidate: false });
        }
        if (!ORDER_SOURCE_NEEDS_REFERRAL.includes(orderSource ?? "")) {
            setValue("referredByCustomerId", null, { shouldValidate: false });
        }
        if (!ORDER_SOURCE_NEEDS_REFERRAL.includes(orderSource ?? "") && !ORDER_SOURCE_NEEDS_DEALER.includes(orderSource ?? "")) {
            setValue("referredByName", null, { shouldValidate: false });
        }
    }, [orderSource, setValue]);

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
    const onSubmit = async (data: SalesOrderFormValues, action: "draft" | "quotation" | "order") => {
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
                customerId: data.customerId,
                mobile: data.mobile || null,
                orderSource: data.orderSource || null,
                sourceEmployeeId: ORDER_SOURCE_NEEDS_EMPLOYEE.includes(data.orderSource ?? "") && data.sourceEmployeeId
                    ? Number(data.sourceEmployeeId)
                    : null,
                referredByCustomerId: ORDER_SOURCE_NEEDS_REFERRAL.includes(data.orderSource ?? "") && data.referredByCustomerId
                    ? data.referredByCustomerId
                    : null,
                referredByName: (ORDER_SOURCE_NEEDS_REFERRAL.includes(data.orderSource ?? "") || ORDER_SOURCE_NEEDS_DEALER.includes(data.orderSource ?? ""))
                    ? (data.referredByName || null)
                    : null,
                narration: data.narration || null,
                status: action === "draft" ? "DRAFT" : "CONFIRMED",
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
            const backendMsg = error?.response?.data?.message
                || (Array.isArray(error?.response?.data?.errors) ? error.response.data.errors.map((e: any) => e.message).join(", ") : null)
                || error?.message;
            toast.error(backendMsg || "Failed to save sales order");
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
                                <SelectInput label="Customer" name={field.name} value={field.value} options={customerOptions} required searchable onChange={field.onChange} defaultOptionLabel="Select Customer" disabled={isEditMode} error={errors.customerId?.message} />
                            )} />
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
                            <Controller name="orderSource" control={control} render={({ field }) => (
                                <SelectInput label="Order Source" name={field.name} value={field.value ?? ""} options={ORDER_SOURCE_OPTIONS} defaultOptionLabel="Select Order Source" onChange={field.onChange} />
                            )} />
                        </div>

                        {/* Employee dropdown — shown for SALES_PERSON, TELE_CALLING, WALK_IN, WHATSAPP */}
                        {ORDER_SOURCE_NEEDS_EMPLOYEE.includes(orderSource ?? "") && (
                            <div>
                                <Controller name="sourceEmployeeId" control={control} render={({ field }) => (
                                    <SelectInput
                                        label="Responsible Employee"
                                        name={field.name}
                                        value={field.value ?? ""}
                                        options={employeeOptions}
                                        defaultOptionLabel="Select Employee"
                                        onChange={field.onChange}
                                        searchable
                                        required
                                    />
                                )} />
                                <Err message={errors.sourceEmployeeId?.message} />
                            </div>
                        )}

                        {/* Customer + free-text referral — shown for REFERRAL */}
                        {ORDER_SOURCE_NEEDS_REFERRAL.includes(orderSource ?? "") && (
                            <>
                                <div>
                                    <Controller name="referredByCustomerId" control={control} render={({ field }) => (
                                        <SelectInput
                                            label="Referred By Customer"
                                            name={field.name}
                                            value={field.value ?? ""}
                                            options={customerOptions}
                                            defaultOptionLabel="Select Customer (optional)"
                                            onChange={field.onChange}
                                            searchable
                                        />
                                    )} />
                                </div>
                                <div>
                                    <Controller name="referredByName" control={control} render={({ field }) => (
                                        <TextInput label="Referral Name" name={field.name} value={field.value ?? ""} placeholder="Or enter referral name" onChange={field.onChange} onBlur={field.onBlur} />
                                    )} />
                                    <Err message={errors.referredByName?.message} />
                                </div>
                            </>
                        )}

                        {/* Dealer / Agent name — shown for DEALER_AGENT */}
                        {ORDER_SOURCE_NEEDS_DEALER.includes(orderSource ?? "") && (
                            <div>
                                <Controller name="referredByName" control={control} render={({ field }) => (
                                    <TextInput label="Dealer / Agent Name" name={field.name} value={field.value ?? ""} placeholder="Enter dealer or agent name" onChange={field.onChange} onBlur={field.onBlur} required />
                                )} />
                                <Err message={errors.referredByName?.message} />
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
                        <CustomButton text="Clear" variant="danger" onClick={() => reset(isEditMode && editValuesRef.current ? editValuesRef.current : defaultValues)} disabled={isSubmitting} />
                        <CustomButton variant="secondary" text={isSubmitting ? "Saving..." : "Save as Draft"} type="button" onClick={handleSubmit((data) => onSubmit(data as SalesOrderFormValues, "draft"))} disabled={isSubmitting} />
                        <CustomButton text={isSubmitting ? "Saving..." : "Save Order"} type="button" onClick={handleSubmit((data) => onSubmit(data as SalesOrderFormValues, "order"))} disabled={isSubmitting} />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SalesOrderForm;
