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
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { COLOUR_OPTIONS, CUSTOMER_TYPE_OPTIONS, DISPATCH_TYPE_OPTIONS, ORDER_TYPE_OPTIONS } from "../../../constants/selectOption";

const orderItemSchema = z.object({
    productCode: z.string().min(1, "Product is required"),
    quantity: z
        .string()
        .min(1, "Required")
        .refine(v => !isNaN(Number(v)) && Number(v) > 0, { message: "Must be > 0" }),
});

const salesOrderSchema = z
    .object({
        id: z.number().optional(),
        orderNo: z.string().min(1, "Order No is required"),
        orderDate: z.string().min(1, "Order Date is required"),
        expectedCompletionDate: z.string().min(1, "Expected completion date is required"),
        customerId: z.string().min(1, "Customer is required"),
        mobile: z.string().optional().nullable(),
        orderType: z.string().optional(),
        dispatchType: z.string().optional(),
        referenceText: z.string().optional(),
        salesPersonName: z.string().optional(),
        transportName: z.string().optional(),
        paymentTermId: z.string().optional(),
        customerType: z.string().min(1, "Customer type is required"),
        isInterState: z.boolean(),  // <-- new field

        billingAddressLine1: z.string().min(1, "Billing address is required"),
        billingCity: z.string().min(1, "City is required"),
        billingState: z.string().min(1, "State is required"),
        billingPincode: z.string().min(1, "Pincode is required").regex(/^\d{6}$/, "Must be a 6-digit pincode"),

        shippingAddressLine1: z.string().optional(),
        shippingCity: z.string().optional(),
        shippingState: z.string().optional(),
        shippingPincode: z.string().optional(),

        items: z.array(orderItemSchema).min(1, "At least one item is required"),

        remarks: z.string().optional(),
        internalNotes: z.string().optional(),
    })
    .superRefine((data, ctx) => {
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

        if (data.expectedCompletionDate && data.orderDate && data.expectedCompletionDate < data.orderDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Must be on or after the order date",
                path: ["expectedCompletionDate"],
            });
        }

        if (data.orderType === "salesperson" && !data.salesPersonName?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Salesperson name is required",
                path: ["salesPersonName"],
            });
        }

        if (data.orderType === "reference" && !data.referenceText?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Reference text is required",
                path: ["referenceText"],
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
    mobile: "",
    salesPersonName: "",
    transportName: "",
    paymentTermId: "",
    billingAddressLine1: "",
    billingCity: "",
    billingState: "",
    dispatchType: "",
    orderType: "",
    referenceText: "",
    billingPincode: "",
    shippingAddressLine1: "",
    shippingCity: "",
    shippingState: "",
    shippingPincode: "",
    isInterState: false,   // <-- default false
    items: [{ productCode: "", quantity: "" }],
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
                }))
                : [{ productCode: "", quantity: "" }];

            reset({
                id: state.id,
                orderNo: state.orderNo || "",
                orderDate: state.orderDate?.split("T")[0] || today,
                dispatchType: state.dispatchType || "",
                orderType: state.orderType || "",
                expectedCompletionDate: state.expectedCompletionDate?.split("T")[0] || "",
                customerId: state.customerId != null ? String(state.customerId) : "",
                mobile: state.mobile || "",
                customerType: state.customerType ? String(state.customerType) : "",
                referenceText: state.referenceText || "",
                salesPersonName: state.salesPersonName || "",
                transportName: state.transportName || "",
                paymentTermId: state.paymentTermId != null ? String(state.paymentTermId) : "",
                billingAddressLine1: state.billingAddressLine1 || "",
                billingCity: state.billingCity || "",
                billingState: state.billingState || "",
                billingPincode: state.billingPincode || "",
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

    // ─── Watched fields ──────────────────────────────────────────────
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

    const [selectedShippingIndex, setSelectedShippingIndex] = useState<string>("");

    const selectedCustomer = useMemo(() => {
        if (!selectedCustomerId) return null;
        return customers.find(c => String(c.id) === selectedCustomerId);
    }, [selectedCustomerId, customers]);

    const mobileOptions = useMemo(() => {
        if (!selectedCustomer) return [];
        const mobile = selectedCustomer.mobile;
        if (Array.isArray(mobile)) {
            return mobile.map((m: any) => ({
                value: m.number,
                label: `${m.label || 'Mobile'}: ${m.number}`,
                selectedLabel: m.number,
            }));
        } else if (typeof mobile === "string" && mobile.trim()) {
            return [{
                value: mobile,
                label: `Primary: ${mobile}`,
                selectedLabel: mobile,
            }];
        }
        return [];
    }, [selectedCustomer]);

    useEffect(() => {
        if (isEditMode) return;
        if (mobileOptions.length > 0) {
            const currentMobile = watch("mobile");
            if (!currentMobile || !mobileOptions.some(opt => opt.value === currentMobile)) {
                setValue("mobile", mobileOptions[0].value, { shouldValidate: true });
            }
        } else {
            setValue("mobile", "", { shouldValidate: true });
        }
    }, [mobileOptions, setValue, isEditMode]);

    const transportOptions = useMemo(() => {
        if (!selectedCustomerId) return [];
        const customer = customers.find(c => String(c.id) === selectedCustomerId);
        if (!customer || !Array.isArray(customer.transports)) return [];
        return customer.transports
            .filter((t: any) => t && t.transportName)
            .map((t: any) => ({
                value: t.transportName,
                label: t.transportName,
            }));
    }, [selectedCustomerId, customers]);

    const shippingAddressOptions = useMemo(() => {
        if (!selectedCustomer?.addresses || selectedCustomer.addresses.length === 0) return [];
        return selectedCustomer.addresses.map((addr: any, idx: number) => {
            const a = addr.address || addr;
            const addressParts = [a?.addressLine1, a?.addressLine2, a?.city, a?.state, a?.pincode].filter(Boolean);
            const fullAddressStr = addressParts.join(", ");
            return {
                label: fullAddressStr || (addr.label && addr.label !== `Address ${idx + 1}` ? addr.label : `Address ${idx + 1}`),
                value: String(idx),
                original: a,
            };
        });
    }, [selectedCustomer]);

    const handleShippingAddressSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const idxStr = e.target.value;
        setSelectedShippingIndex(idxStr);
        if (!idxStr) {
            setValue("shippingAddressLine1", "", { shouldValidate: true });
            setValue("shippingCity", "", { shouldValidate: true });
            setValue("shippingState", "", { shouldValidate: true });
            setValue("shippingPincode", "", { shouldValidate: true });
            return;
        }
        if (!selectedCustomer?.addresses) return;
        const item = selectedCustomer.addresses[Number(idxStr)];
        const addrObj: any = (item as any)?.address || item;
        if (addrObj) {
            setValue("shippingAddressLine1", addrObj.addressLine1 || "", { shouldValidate: true });
            setValue("shippingCity", addrObj.city || "", { shouldValidate: true });
            setValue("shippingState", addrObj.state || "", { shouldValidate: true });
            setValue("shippingPincode", addrObj.pincode || "", { shouldValidate: true });
        }
    };

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
    // ─── Auto‑generate order number ──────────────────────────────────
    useEffect(() => {
        const state = location.state as any;
        if (state?.id) return;

        salesOrderService.getNextOrderNo().then((orderNo) => {
            setValue("orderNo", orderNo);
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Customer type options based on selected customer ──────────

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

    // ─── Clear sales person when order type changes ──────────────────
    useEffect(() => {
        if (justResetRef.current) {
            justResetRef.current = false;
            return;
        }
        if (orderType !== "salesperson") {
            setValue("salesPersonName", "", { shouldValidate: true });
        }
        if (orderType !== "reference") {
            setValue("referenceText", "", { shouldValidate: true });
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
                quantity: Number(item.quantity)
            }));
            const payload: any = {
                orderNo: data.orderNo,
                orderDate: new Date(data.orderDate).toISOString(),
                expectedCompletionDate: new Date(data.expectedCompletionDate).toISOString(),
                customerId: data.customerId,
                mobile: data.mobile || null,
                customerType: data.customerType,
                orderType: data.orderType,
                dispatchType: data.dispatchType,
                referenceText: data.referenceText || null,
                salesPersonName: data.salesPersonName || null,
                transportName: data.transportName || null,
                paymentTermId: data.paymentTermId ? Number(data.paymentTermId) : null,
                billingAddressLine1: data.billingAddressLine1 ?? '',
                billingCity: data.billingCity ?? '',
                billingState: data.billingState ?? '',
                billingPincode: data.billingPincode ?? '',
                shippingAddressLine1: data.shippingAddressLine1 ?? '',
                shippingCity: data.shippingCity ?? '',
                shippingState: data.shippingState ?? '',
                shippingPincode: data.shippingPincode ?? '',
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


                        </div>

                        <div>
                            <Controller name="mobile" control={control} render={({ field }) => (
                                <SelectInput label="Mobile Number" name={field.name} value={field.value ?? ""} options={mobileOptions} defaultOptionLabel={mobileOptions.length > 0 ? "Select Mobile Number" : "No mobile numbers found"} onChange={field.onChange} disabled={!selectedCustomerId} />
                            )} />
                            <Err message={errors.mobile?.message} />
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
                                <DatePickerCalendar label="Expected Completion Date" name={field.name} value={field.value} required onChange={field.onChange} />
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

                        {(orderType === "salesperson") && (
                            <div>
                                <Controller name="salesPersonName" control={control} render={({ field }) => (
                                    <TextInput label="Salesperson Name" name={field.name} value={field.value ?? ""} placeholder="Enter Salesperson Name" onChange={field.onChange} />
                                )} />
                                <Err message={errors.salesPersonName?.message} />
                            </div>
                        )}

                        {(orderType === "reference") && (
                            <div>
                                <Controller name="referenceText" control={control} render={({ field }) => (
                                    <TextInput label="Reference Name" name={field.name} value={field.value ?? ""} placeholder="Enter name or reference" onChange={field.onChange} />
                                )} />
                                <Err message={errors.referenceText?.message} />
                            </div>
                        )}

                        <div>
                            <Controller name="transportName" control={control} render={({ field }) => (
                                <SelectInput label="Transport" name={field.name} value={field.value ?? ""} options={transportOptions} defaultOptionLabel={transportOptions.length > 0 ? "Select Transport" : "No Transports found"} disabled={transportOptions.length === 0} onChange={field.onChange} />
                            )} />
                        </div>
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
                            </div>

                            <div className="mb-4">
                                    <SelectInput
                                        label="Select Saved Address"
                                        options={shippingAddressOptions}
                                        value={selectedShippingIndex}
                                        onChange={handleShippingAddressSelect}
                                        defaultOptionLabel={shippingAddressOptions.length > 0 ? "-- Select saved address --" : "No additional addresses saved"}
                                        disabled={shippingAddressOptions.length === 0}
                                    />
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
                                required
                                resetKey={shippingResetKey}
                            />
                        </div>
                    </div>

                    {/* ── Order Items ── */}

                    <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-semibold text-gray-800">Order Items</span>
                        <CustomButton text="Add Item" variant="secondary" icon={FaPlus} onClick={() => append({ productCode: "", quantity: "" })} />
                    </div>
                    {errors.items?.root && <Err message={errors.items.root.message} />}

                    <OrderItemsTable
                        control={control}
                        fields={fields}
                        errors={errors}
                        productOptions={productOptions}
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