import React, { useEffect, useMemo, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { FaSave, FaEraser, FaArrowLeft, FaPlus, FaTrash, FaCalendarAlt, FaPaperPlane } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import TextArea from "../../../components/form/TextArea/TextArea";
import DateInput from "../../../components/form/DateInput/DateInput";
import AddressForm from "../../../components/form/AddressFrom/AddressFrom";
import OrderItemsTable from "../../../components/form/OrderItemsTable/OrderItemsTable";
import { useCustomers } from "../../../hooks/useCustomers";
import { useProducts } from "../../../hooks/useProducts";
import { salesOrderService } from "../../../services/salesOrderService";
import { useEmployees } from "../../../hooks/useEmployees";
import { customerService } from "../../../services/customerService";
import { COLOUR_OPTIONS, CUSTOMER_TYPE_OPTIONS, DISPATCH_TYPE_OPTIONS, ORDER_TYPE_OPTIONS } from "../../../constants/selectOption";

const orderItemSchema = z.object({
    productCode: z.string().min(1, "Product is required"),
    quantity: z
        .string()
        .min(1, "Required")
        .refine(v => !isNaN(Number(v)) && Number(v) > 0, { message: "Must be > 0" }),
    colorType: z.string().min(1, "Color type is required"),
});

const salesOrderSchema = z
    .object({
        id: z.number().optional(),
        orderNo: z.string().min(1, "Order No is required"),
        orderDate: z.string().min(1, "Order Date is required"),
        expectedCompletionDate: z.string().min(1, "Expected completion date is required"),
        customerId: z.string().min(1, "Customer is required"),
        orderType: z.string().optional(),
        dispatchType: z.string().optional(),
        salesPersonId: z.string().optional(),
        paymentTermId: z.string().optional(),
        customerType: z.string().min(1, "Customer type is required"),
        isInterState: z.boolean(),  // <-- new field

        billingAddressLine1: z.string().min(1, "Billing address is required"),
        billingCity: z.string().min(1, "City is required"),
        billingState: z.string().min(1, "State is required"),
        billingPincode: z.string().min(1, "Pincode is required").regex(/^\d{6}$/, "Must be a 6-digit pincode"),

        sameAsBilling: z.boolean(),
        shippingAddressLine1: z.string().optional(),
        shippingCity: z.string().optional(),
        shippingState: z.string().optional(),
        shippingPincode: z.string().optional(),

        items: z.array(orderItemSchema).min(1, "At least one item is required"),

        remarks: z.string().optional(),
        internalNotes: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        if (!data.sameAsBilling) {
            if (!data.shippingAddressLine1?.trim())
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Shipping address is required", path: ["shippingAddressLine1"] });
            if (!data.shippingCity?.trim())
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "City is required", path: ["shippingCity"] });
            if (!data.shippingState?.trim())
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "State is required", path: ["shippingState"] });
            if (!data.shippingPincode?.trim())
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pincode is required", path: ["shippingPincode"] });
            else if (!/^\d{6}$/.test(data.shippingPincode))
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a 6-digit pincode", path: ["shippingPincode"] });
        }

        if (data.expectedCompletionDate && data.orderDate && data.expectedCompletionDate < data.orderDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Must be on or after the order date",
                path: ["expectedCompletionDate"],
            });
        }

        if (data.orderType === "salesperson" && !data.salesPersonId?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Sales person is required",
                path: ["salesPersonId"],
            });
        }
    });

type SalesOrderFormValues = z.infer<typeof salesOrderSchema> & {
    billingAddress?: {
        addressLine1?: string;
        city?: string;
        state?: string;
        pincode?: string;
    } | null;
    shippingAddress?: {
        addressLine1?: string;
        city?: string;
        state?: string;
        pincode?: string;
    } | null;
    customer?: {
        id: string;
        firmName: string;
        displayName: string;
    } | null;
    items?: Array<{
        id?: string | number;
        salesOrderId?: number;
        productId?: string | number;
        productCode?: string | number;
        colorType?: string;
        quantity?: string | number;
        product?: {
            id?: string | number;
            productCode: string;
            productName: string;
        };
    }>;
};

const today = new Date().toISOString().split("T")[0];

const defaultValues: SalesOrderFormValues = {
    id: undefined,
    orderNo: "",
    customerType: "",
    orderDate: today,
    expectedCompletionDate: "",
    customerId: "",
    salesPersonId: "",
    paymentTermId: "",
    billingAddressLine1: "",
    billingCity: "",
    billingState: "",
    dispatchType: "",
    orderType: "",
    billingPincode: "",
    sameAsBilling: false,
    shippingAddressLine1: "",
    shippingCity: "",
    shippingState: "",
    shippingPincode: "",
    isInterState: false,   // <-- default false
    items: [{ productCode: "", quantity: "", colorType: "" }],
    remarks: "",
    internalNotes: "",
};

// ─── Helper Components ──────────────────────────────────────────────────

type CtrlTextProps = {
    label: string;
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

const CtrlText: React.FC<CtrlTextProps> = ({ field, label, placeholder, required, type, disabled, error }) => (
    <TextInput
        label={label}
        name={field.name}
        value={field.value ?? ""}
        onChange={field.onChange}
        onBlur={field.onBlur}
        placeholder={placeholder}
        required={required}
        type={type}
        disabled={disabled}
        error={error}
    />
);

const Err: React.FC<{ message?: string }> = ({ message }) =>
    message ? <div className="text-red-500 mt-1 text-sm">{message}</div> : null;

// ─── Main Component ─────────────────────────────────────────────────────

const SalesOrderForm: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderId, setOrderId] = useState<number | null>(null);
    const isEditMode = useMemo(() => Boolean((location.state as any)?.id), [location.state]);
    const [shippingResetKey, setShippingResetKey] = useState(0);
    const { data: company } = useSelector((state: any) => state.company);
    const companyState = company?.state;

    const [creditStatus, setCreditStatus] = useState<any | null>(null);
    const [fetchingCredit, setFetchingCredit] = useState(false);
    const [blockingOrder, setBlockingOrder] = useState<{ id: number; orderNo: string } | null>(null);
    const [isBlocked, setIsBlocked] = useState(false);

    const handleBillingStateChange = (stateName: string) => {
        setValue("billingState", stateName, { shouldValidate: true });
        setValue("billingCity", "", { shouldValidate: true });
    };

    const handleBillingCityChange = (cityName: string) => {
        setValue("billingCity", cityName, { shouldValidate: true });
    };

    const handleShippingStateChange = (stateName: string) => {
        setValue("shippingState", stateName, { shouldValidate: true });
        setValue("shippingCity", "", { shouldValidate: true });
    };

    const handleShippingCityChange = (cityName: string) => {
        setValue("shippingCity", cityName, { shouldValidate: true });
    };

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

    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    const { loadCustomers, customers } = useCustomers();
    const { loadProducts, products } = useProducts();
    const { employees, loadEmployees } = useEmployees();
    const justResetRef = React.useRef(false);

    // ─── Reset form when location state changes ──────────────────────
    useEffect(() => {
        const state = location.state as any;
        justResetRef.current = true;

        if (state?.id) {
            setOrderId(state.id);


            const items = state.items && Array.isArray(state.items) && state.items.length > 0
                ? state.items.map((item: any) => ({
                    productCode: String(
                        item.productId ?? item.product?.id ?? item.productCode ?? ""
                    ),
                    quantity: String(item.quantity ?? ""),
                    colorType: String(item.colorType ?? ""),
                }))
                : [{ productCode: "", quantity: "", colorType: "" }];

            reset({
                id: state.id,
                orderNo: state.orderNo || "",
                orderDate: state.orderDate?.split("T")[0] || today,
                dispatchType: state.dispatchType || "",
                orderType: state.orderType || "",
                expectedCompletionDate: state.expectedCompletionDate?.split("T")[0] || "",
                customerId: state.customerId != null ? String(state.customerId) : "",
                customerType: state.customerType ? String(state.customerType) : "",
                salesPersonId: state.salesPersonId != null ? String(state.salesPersonId) : "",
                paymentTermId: state.paymentTermId != null ? String(state.paymentTermId) : "",
                billingAddressLine1: state.billingAddressLine1 || "",
                billingCity: state.billingCity || "",
                billingState: state.billingState || "",
                billingPincode: state.billingPincode || "",
                sameAsBilling: state.sameAsBilling || false,
                shippingAddressLine1: state.shippingAddressLine1 || "",
                shippingCity: state.shippingCity || "",
                shippingState: state.shippingState || "",
                shippingPincode: state.shippingPincode || "",
                remarks: state.remarks || "",
                internalNotes: state.internalNotes || "",
                items: items,
            });
        } else {
            setOrderId(null);
            reset(defaultValues);
        }
    }, [location, reset]);

    // ─── Load data on mount ──────────────────────────────────────────
    useEffect(() => {
        loadCustomers();
        loadProducts();
        loadEmployees({});
    }, [loadCustomers, loadProducts, loadEmployees]);

    // ─── Memoized options ────────────────────────────────────────────
    const customerOptions = useMemo(() => {
        return customers.map((d) => ({
            value: String(d.id),
            label: d.displayName || d.firmName,
        }));
    }, [customers]);



    const productOptions = useMemo(() => {
        return products.map((d) => ({
            value: String(d?.id),
            label: `${d.productName}`,
        }));
    }, [products]);

    console.log(productOptions, "kjlk")

    const salesPersonOptions = useMemo(() => {
        return employees.map((d) => ({
            value: String(d?.id),
            label: `${d.fullName}`,
        }));
    }, [employees]);

    // ─── Watched fields ──────────────────────────────────────────────
    const sameAsBilling = watch("sameAsBilling");
    useEffect(() => {
        setShippingResetKey((k) => k + 1);
    }, [sameAsBilling]);
    const billingAddressLine1 = watch("billingAddressLine1");
    const billingCity = watch("billingCity");
    const billingState = watch("billingState");
    const billingPincode = watch("billingPincode");
    const shippingAddressLine1 = watch("shippingAddressLine1");
    const shippingState = watch("shippingState");
    const shippingCity = watch("shippingCity");
    const shippingPincode = watch("shippingPincode");
    const selectedCustomerId = watch("customerId");
    const orderType = watch("orderType");

    useEffect(() => {
        if (!selectedCustomerId) {
            setCreditStatus(null);
            setIsBlocked(false);
            setBlockingOrder(null);
            return;
        }
        setFetchingCredit(true);
        customerService.fetchCreditStatus(selectedCustomerId)
            .then((res) => {
                setCreditStatus(res);
            })
            .catch((err) => {
                console.error("Failed to fetch credit status:", err);
            })
            .finally(() => {
                setFetchingCredit(false);
            });

        salesOrderService.checkCreditBlock(selectedCustomerId)
            .then((res) => {
                setIsBlocked(res.blocked);
                setBlockingOrder(res.blockingOrder || null);
            })
            .catch((err) => {
                console.error("Failed to check credit block:", err);
            });
    }, [selectedCustomerId]);

    const formItems = watch("items");
    const customerType = watch("customerType");

    const proposedTotal = useMemo(() => {
        if (!formItems || !Array.isArray(formItems)) return 0;
        let sum = 0;
        formItems.forEach((item) => {
            if (!item.productCode || !item.quantity) return;
            const p = products.find((prod) => String(prod.id) === String(item.productCode));
            if (!p) return;

            let unitPrice = 0;
            if (customerType === "MRP") {
                unitPrice = p.mrp ?? p.b2b ?? p.b2c ?? p.exportPrice ?? 0;
            } else if (customerType === "B2C") {
                unitPrice = p.b2c ?? p.mrp ?? p.b2b ?? p.exportPrice ?? 0;
            } else if (customerType === "EXPORT") {
                unitPrice = p.exportPrice ?? p.mrp ?? p.b2b ?? p.b2c ?? 0;
            } else {
                unitPrice = p.b2b ?? p.mrp ?? p.b2c ?? p.exportPrice ?? 0;
            }

            const qty = Number(item.quantity) || 0;
            const lineSubtotal = unitPrice * qty;
            const gstRate = p.gstRate ?? 0;
            const lineGst = (lineSubtotal * gstRate) / 100;
            sum += lineSubtotal + lineGst;
        });
        return sum;
    }, [formItems, customerType, products]);
    const limitExceeded = useMemo(() => {
        if (!creditStatus) return false;
        const totalExposure = creditStatus.outstanding + proposedTotal;
        return totalExposure > creditStatus.creditLimit;
    }, [creditStatus, proposedTotal]);

    const lastExceededRef = useRef<boolean>(false);
    const lastCustomerIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!selectedCustomerId) {
            lastExceededRef.current = false;
            lastCustomerIdRef.current = null;
            return;
        }

        if (selectedCustomerId !== lastCustomerIdRef.current) {
            lastExceededRef.current = false;
            lastCustomerIdRef.current = selectedCustomerId;
        }

        if (limitExceeded && !lastExceededRef.current && creditStatus) {
            const availableCredit = creditStatus.creditLimit - creditStatus.outstanding;
            toast.warning(
                `Credit Limit Exceeded! Available Credit: ₹${availableCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}. Outstanding: ₹${creditStatus.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}.`
            );
            lastExceededRef.current = true;
        } else if (!limitExceeded) {
            lastExceededRef.current = false;
        }
    }, [limitExceeded, selectedCustomerId, creditStatus]);

    // ─── Auto‑generate order number ──────────────────────────────────
    useEffect(() => {
        const state = location.state as any;
        if (state?.id) return;

        salesOrderService.getNextOrderNo().then((orderNo) => {
            setValue("orderNo", orderNo);
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Customer type options based on selected customer ──────────
    const selectedCustomer = useMemo(() => {
        return customers.find(c => String(c.id) === selectedCustomerId);
    }, [customers, selectedCustomerId]);

    const customerTypeOptions = useMemo(() => {
        const raw = selectedCustomer?.customerType;
        if (!raw) return [];

        const allowedTypes = String(raw)
            .split(",")
            .map((t: string) => t.trim().toUpperCase())
            .filter(Boolean);

        return CUSTOMER_TYPE_OPTIONS.filter(opt => allowedTypes.includes(opt.value.toUpperCase()));
    }, [selectedCustomer]);

    // ─── Auto‑select customer type when only one option ─────────────
    useEffect(() => {
        if (isEditMode) return;

        if (customerTypeOptions.length === 1) {
            setValue("customerType", customerTypeOptions[0].value, { shouldValidate: true });
        } else {
            setValue("customerType", "", { shouldValidate: true });
        }
    }, [customerTypeOptions, isEditMode, setValue]);

    // ─── Populate addresses when customer changes ────────────────────
    useEffect(() => {
        if (isEditMode || !selectedCustomerId) return;

        const selected = customers.find(c => String(c.id) === selectedCustomerId);
        if (!selected) return;

        setValue("billingAddressLine1", selected.billingAddressLine1 || "", { shouldValidate: true });
        setValue("billingCity", selected.billingCity || "", { shouldValidate: true });
        setValue("billingState", selected.billingState || "", { shouldValidate: true });
        setValue("billingPincode", selected.billingPincode || "", { shouldValidate: true });

        setValue("shippingAddressLine1", selected.shippingAddressLine1 || "", { shouldValidate: true });
        setValue("shippingCity", selected.shippingCity || "", { shouldValidate: true });
        setValue("shippingState", selected.shippingState || "", { shouldValidate: true });
        setValue("shippingPincode", selected.shippingPincode || "", { shouldValidate: true });
    }, [selectedCustomerId, customers, setValue, isEditMode]);

    // ─── Copy billing to shipping when checkbox toggled ──────────────
    useEffect(() => {
        if (sameAsBilling) {
            setValue("shippingAddressLine1", billingAddressLine1, { shouldValidate: true });
            setValue("shippingCity", billingCity, { shouldValidate: true });
            setValue("shippingState", billingState, { shouldValidate: true });
            setValue("shippingPincode", billingPincode, { shouldValidate: true });
        }
    }, [sameAsBilling, billingAddressLine1, billingCity, billingState, billingPincode, setValue]);

    // ─── Clear sales person when order type changes ──────────────────
    useEffect(() => {
        if (justResetRef.current) {
            justResetRef.current = false;
            return;
        }
        if (orderType !== "salesperson") {
            setValue("salesPersonId", "", { shouldValidate: true });
        }
    }, [orderType, setValue]);

    const computedIsInterState = useMemo(() => {
        if (!companyState || !billingState) return false;
        return companyState.toLowerCase().trim() !== billingState.toLowerCase().trim();
    }, [companyState, billingState]);

    useEffect(() => {
        setValue("isInterState", computedIsInterState, { shouldValidate: true });
    }, [computedIsInterState, setValue]);

    // ─── Submit handler ──────────────────────────────────────────────
    const onSubmit = async (data: SalesOrderFormValues, action: "draft" | "quotation") => {
        setIsSubmitting(true);
        try {
            const transformedItems = data.items.map(item => ({
                productId: Number(item.productCode),
                quantity: Number(item.quantity),
                colorTypeId: item.colorType
            }));

            const payload = {
                orderNo: data.orderNo,
                orderDate: new Date(data.orderDate).toISOString(),
                expectedCompletionDate: new Date(data.expectedCompletionDate).toISOString(),
                customerId: data.customerId,
                customerType: data.customerType,
                orderType: data.orderType,
                dispatchType: data.dispatchType,
                salesPersonId: data.orderType === "salesperson" && data.salesPersonId ? Number(data.salesPersonId) : null,
                paymentTermId: data.paymentTermId ? Number(data.paymentTermId) : null,
                billingAddressLine1: data.billingAddressLine1 ?? '',
                billingCity: data.billingCity ?? '',
                billingState: data.billingState ?? '',
                billingPincode: data.billingPincode ?? '',
                shippingAddressLine1: data.sameAsBilling ? (data.billingAddressLine1 ?? '') : (data.shippingAddressLine1 ?? ''),
                shippingCity: data.sameAsBilling ? (data.billingCity ?? '') : (data.shippingCity ?? ''),
                shippingState: data.sameAsBilling ? (data.billingState ?? '') : (data.shippingState ?? ''),
                shippingPincode: data.sameAsBilling ? (data.billingPincode ?? '') : (data.shippingPincode ?? ''),
                sameAsBilling: data.sameAsBilling,
                isInterState: data.isInterState,   // <-- include the flag
                remarks: data.remarks,
                internalNotes: data.internalNotes,
                items: transformedItems,
                status: action === "quotation" ? "CONFIRMED" : "DRAFT",
            };

            if (isEditMode && orderId) {
                await salesOrderService.update(orderId, payload);
                toast.success(`Sales Order updated successfully!`);
            } else {
                await salesOrderService.create(payload);
                toast.success(`Sales Order created successfully!`);
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
            <div className="bg-white border border-gray-200">
                {/* Page Header */}
                <div className="px-6 py-4 ">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {isEditMode ? "Edit Sales Order" : "Create Sales Order"}
                            </h2>
                        </div>
                        <div>
                            <BackButton text="Back to List" />
                        </div>
                    </div>
                </div>

                <form className="px-6 py-3 space-y-4" noValidate>
                    {/* ── Main Fields ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        <div>
                            <Controller name="orderNo" control={control} render={({ field }) => (
                                <CtrlText field={field} label="Order No" placeholder="e.g. SO-2024-001" required error={errors.orderNo?.message} disabled />
                            )} />
                        </div>

                        <div>
                            <Controller name="customerId" control={control} render={({ field }) => (
                                <SelectInput label="Customer" name={field.name} value={field.value} options={customerOptions} required onChange={field.onChange} defaultOptionLabel="Select Customer" disabled={isEditMode} />
                            )} />
                            <Err message={errors.customerId?.message} />

                            {isBlocked && blockingOrder && (
                                <div
                                    className="alert alert-danger mt-2 mb-0 d-flex flex-column gap-2"
                                    style={{ borderRadius: "var(--radius-md)" }}
                                >
                                    <span className="fw-semibold text-red-400">
                                        ⚠️ This customer has a pending credit approval (Order #{blockingOrder.orderNo}) — new orders are blocked until it's resolved.
                                    </span>
                                    <div>
                                        <CustomButton
                                            text="View Pending Order"
                                            className="btn-sm btn-danger text-white border-0"
                                            onClick={() => navigate(`/pending-quotations/edit/${blockingOrder.id}`, { state: { id: blockingOrder.id } })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {customerTypeOptions.length >= 1 && (
                            <div>
                                <Controller name="customerType" control={control} render={({ field }) => (
                                    <SelectInput label="Customer Type" name={field.name} value={field.value} options={customerTypeOptions} required onChange={field.onChange} disabled={customerTypeOptions.length === 1} defaultOptionLabel={!selectedCustomerId ? "Select a customer first" : "Select Customer Type"} />
                                )} />
                            </div>
                        )}

                        <div>
                            <Controller name="orderDate" control={control} render={({ field }) => (
                                <DateInput label="Order Date" name={field.name} value={field.value} icon={<FaCalendarAlt />} required disabled={true} onChange={field.onChange} />
                            )} />
                            <Err message={errors.orderDate?.message} />
                        </div>

                        <div>
                            <Controller name="expectedCompletionDate" control={control} render={({ field }) => (
                                <DateInput label="Expected Completion Date" name={field.name} value={field.value} min={today} icon={<FaCalendarAlt />} required onChange={field.onChange} />
                            )} />
                            <Err message={errors.expectedCompletionDate?.message} />
                        </div>

                        <div>
                            <Controller name="dispatchType" control={control} render={({ field }) => (
                                <SelectInput label="Dispatch Type" name={field.name} value={field.value || ''} options={DISPATCH_TYPE_OPTIONS} defaultOptionLabel="select dispatch type" onChange={field.onChange} />
                            )} />
                        </div>

                        <div>
                            <Controller name="orderType" control={control} render={({ field }) => (
                                <SelectInput label="Order Source Platform" name={field.name} value={field.value ?? ""} options={ORDER_TYPE_OPTIONS} defaultOptionLabel="select order type" onChange={field.onChange} />
                            )} />
                        </div>

                        {orderType === "salesperson" && (
                            <div>
                                <Controller name="salesPersonId" control={control} render={({ field }) => (
                                    <SelectInput label="Sales Person" name={field.name} value={field.value ?? ""} options={salesPersonOptions} defaultOptionLabel="select sales person" onChange={field.onChange} />
                                )} />
                                <Err message={errors.salesPersonId?.message} />
                            </div>
                        )}
                    </div>



                    <div className="grid grid-cols-1  gap-4">
                        {/* Billing */}
                        <div>
                            <h6 className="text-lg font-semibold text-gray-800 mb-4">Billing</h6>
                            <AddressForm
                                addressValue={billingAddressLine1 || ""}
                                onAddressChange={(val) => setValue("billingAddressLine1", val, { shouldValidate: true })}
                                addressError={errors.billingAddressLine1?.message}
                                stateValue={billingState || ""}
                                onStateChange={handleBillingStateChange}
                                stateError={errors.billingState?.message}
                                cityValue={billingCity || ""}
                                onCityChange={handleBillingCityChange}
                                cityError={errors.billingCity?.message}
                                pincodeValue={billingPincode || ""}
                                onPincodeChange={(val) => setValue("billingPincode", val, { shouldValidate: true })}
                                pincodeError={errors.billingPincode?.message}
                                required
                            />
                        </div>

                        {/* Shipping */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h6 className="text-lg font-semibold text-gray-800 mb-0">Shipping</h6>
                                <Controller name="sameAsBilling" control={control} render={({ field }) => (
                                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 mb-0">
                                        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300" checked={field.value} onChange={e => field.onChange(e.target.checked)} />
                                        <span>Same as billing</span>
                                    </label>
                                )} />
                            </div>
                            <AddressForm
                                addressValue={shippingAddressLine1 || ""}
                                onAddressChange={(val) => setValue("shippingAddressLine1", val, { shouldValidate: true })}
                                addressError={errors.shippingAddressLine1?.message}
                                stateValue={shippingState || ""}
                                onStateChange={handleShippingStateChange}
                                stateError={errors.shippingState?.message}
                                cityValue={shippingCity || ""}
                                onCityChange={handleShippingCityChange}
                                cityError={errors.shippingCity?.message}
                                pincodeValue={shippingPincode || ""}
                                onPincodeChange={(val) => setValue("shippingPincode", val, { shouldValidate: true })}
                                pincodeError={errors.shippingPincode?.message}
                                required={!sameAsBilling}
                                disabled={sameAsBilling}
                                resetKey={shippingResetKey}
                            />
                        </div>
                    </div>

                    {/* ── Order Items ── */}

                    <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-semibold text-gray-800">Order Items</span>
                        <CustomButton text="Add Item" variant="secondary" icon={FaPlus} onClick={() => append({ productCode: "", quantity: "", colorType: "" })} />
                    </div>
                    {errors.items?.root && <Err message={errors.items.root.message} />}

                    <OrderItemsTable
                        control={control}
                        fields={fields}
                        errors={errors}
                        productOptions={productOptions}
                        colorOptions={COLOUR_OPTIONS}
                        remove={remove}
                        editable={true}
                    />

                    {/* ── Remarks ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                        <div>
                            <Controller name="remarks" control={control} render={({ field }) => (
                                <TextArea label="Remarks" name="remarks" value={field.value ?? ""} placeholder="Any remarks for the customer..." rows={2} onChange={field.onChange} />
                            )} />
                        </div>
                        <div>
                            <Controller name="internalNotes" control={control} render={({ field }) => (
                                <TextArea label="Internal Notes" name="internalNotes" value={field.value ?? ""} placeholder="Internal notes (not visible to customer)..." rows={2} onChange={field.onChange} />
                            )} />
                        </div>
                    </div>



                    {/* Credit block warning banner */}
                    {isBlocked && (
                        <div
                            className="alert alert-danger d-flex align-items-center gap-2 mt-3"
                            style={{ borderRadius: "var(--radius-md)" }}
                        >
                            <span>🚫</span>
                            <span>Customer is currently blocked due to overdue payments. Please contact accounts.</span>
                        </div>
                    )}

                    {/* ── Form Actions ── */}
                    <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
                        <CustomButton text="Clear" variant="danger" icon={FaEraser} onClick={() => reset(defaultValues)} disabled={isSubmitting} />
                        <CustomButton variant="secondary" text={isSubmitting ? "Saving..." : "Save Order"} icon={isSubmitting ? undefined : FaSave} type="button" onClick={handleSubmit((data) => onSubmit(data, "draft"))} disabled={isSubmitting} />
                        <CustomButton text={isSubmitting ? "Sending..." : "Send to Quotation"} icon={isSubmitting ? undefined : FaPaperPlane} type="button" onClick={handleSubmit((data) => onSubmit(data, "quotation"))} disabled={isSubmitting} />
                    </div>
                </form>
            </div >
        </div >
    );
};

export default SalesOrderForm;