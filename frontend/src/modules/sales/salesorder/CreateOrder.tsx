import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft, FaPlus, FaTrash, FaCalendarAlt, FaPaperPlane } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import TextArea from "../../../components/form/TextArea/TextArea";
import DateInput from "../../../components/form/DateInput/DateInput";
import CityStateSelect from "../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../components/ui/CityStateSelect/CityStateSelect";
import { useCustomers } from "../../../hooks/useCustomers";
import { useProducts } from "../../../hooks/useProducts";
import { salesOrderService } from "../../../services/salesOrderService";
import { useEmployees } from "../../../hooks/useEmployees";
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
    message ? <div className="text-danger mt-1 small">{message}</div> : null;

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

    const handleBillingStateChange = (stateData: StateCityOption) => {
        setValue("billingState", stateData.name, { shouldValidate: true });
        setValue("billingCity", "", { shouldValidate: true });
    };

    const handleBillingCityChange = (cityData: StateCityOption) => {
        setValue("billingCity", cityData.name, { shouldValidate: true });
    };

    const handleShippingStateChange = (stateData: StateCityOption) => {
        setValue("shippingState", stateData.name, { shouldValidate: true });
        setValue("shippingCity", "", { shouldValidate: true });
    };

    const handleShippingCityChange = (cityData: StateCityOption) => {
        setValue("shippingCity", cityData.name, { shouldValidate: true });
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
        loadEmployees({ designationId: 6 });
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
            label: `${d.productCode} - ${d.productName}`,
        }));
    }, [products]);

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
    const shippingState = watch("shippingState");
    const shippingCity = watch("shippingCity");
    const selectedCustomerId = watch("customerId");
    const orderType = watch("orderType");

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
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">
                                    {isEditMode ? "Edit Sales Order" : "Create Sales Order"}
                                </h2>
                                <div className="page-breadcrumb">
                                    Home / Sales / Sales Orders / {isEditMode ? "Edit" : "Create"}
                                </div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/sales-order")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form className="form-inner" noValidate>
                    {/* ── Main Fields ── */}
                    <Row className="g-3">
                        <Col md={6}>
                            <Controller name="orderNo" control={control} render={({ field }) => (
                                <CtrlText
                                    field={field}
                                    label="Order No"
                                    placeholder="e.g. SO-2024-001"
                                    required
                                    error={errors.orderNo?.message}
                                    disabled
                                />
                            )} />
                        </Col>

                        <Col md={6}>
                            <Controller name="customerId" control={control} render={({ field }) => (
                                <SelectInput
                                    label="Customer"
                                    name={field.name}
                                    value={field.value}
                                    options={customerOptions}
                                    required
                                    onChange={field.onChange}
                                    defaultOptionLabel="Select Customer"
                                    disabled={isEditMode}
                                />
                            )} />
                            <Err message={errors.customerId?.message} />
                        </Col>

                        {customerTypeOptions.length >= 1 && (
                            <Col md={6}>
                                <Controller name="customerType" control={control} render={({ field }) => (
                                    <SelectInput
                                        label="Customer Type"
                                        name={field.name}
                                        value={field.value}
                                        options={customerTypeOptions}
                                        required
                                        onChange={field.onChange}
                                        disabled={customerTypeOptions.length === 1}
                                        defaultOptionLabel={
                                            !selectedCustomerId
                                                ? "Select a customer first"
                                                : "Select Customer Type"
                                        }
                                    />
                                )} />
                            </Col>
                        )}

                        <Col md={6}>
                            <Controller name="orderDate" control={control} render={({ field }) => (
                                <DateInput
                                    label="Order Date"
                                    name={field.name}
                                    value={field.value}
                                    icon={<FaCalendarAlt />}
                                    required
                                    disabled={true}
                                    onChange={field.onChange}
                                />
                            )} />
                            <Err message={errors.orderDate?.message} />
                        </Col>

                        <Col md={6}>
                            <Controller name="expectedCompletionDate" control={control} render={({ field }) => (
                                <DateInput
                                    label="Expected Completion Date"
                                    name={field.name}
                                    value={field.value}
                                    min={today}
                                    icon={<FaCalendarAlt />}
                                    required
                                    onChange={field.onChange}
                                />
                            )} />
                            <Err message={errors.expectedCompletionDate?.message} />
                        </Col>

                        <Col md={6}>
                            <Controller name="dispatchType" control={control} render={({ field }) => (
                                <SelectInput
                                    label="Dispatch Type"
                                    name={field.name}
                                    value={field.value || ''}
                                    options={DISPATCH_TYPE_OPTIONS}
                                    defaultOptionLabel="select dispatch type"
                                    onChange={field.onChange}
                                />
                            )} />
                        </Col>

                        <Col md={6}>
                            <Controller name="orderType" control={control} render={({ field }) => (
                                <SelectInput
                                    label="Order Source Platform"
                                    name={field.name}
                                    value={field.value ?? ""}
                                    options={ORDER_TYPE_OPTIONS}
                                    defaultOptionLabel="select order type"
                                    onChange={field.onChange}
                                />
                            )} />
                        </Col>

                        {orderType === "salesperson" && (
                            <Col md={6}>
                                <Controller name="salesPersonId" control={control} render={({ field }) => (
                                    <SelectInput
                                        label="Sales Person"
                                        name={field.name}
                                        value={field.value ?? ""}
                                        options={salesPersonOptions}
                                        defaultOptionLabel="select sales person"
                                        onChange={field.onChange}
                                    />
                                )} />
                                <Err message={errors.salesPersonId?.message} />
                            </Col>
                        )}

                        {/* ── NEW: Inter‑State GST toggle ── */}
                        <Col md={6}>
                            <Controller
                                name="isInterState"
                                control={control}
                                render={({ field }) => (
                                    <div className="d-flex align-items-center gap-2" style={{ paddingTop: "10px" }}>
                                        <input
                                            type="checkbox"
                                            id="isInterState"
                                            checked={field.value || false}
                                            disabled
                                        />
                                        <label htmlFor="isInterState" className="mb-0">
                                            Inter‑State GST (IGST)
                                        </label>
                                    </div>
                                )}
                            />
                        </Col>
                    </Row>

                    {/* ── Billing & Shipping ── */}
                    <div className="form-section-title mt-4"></div>
                    <Row className="g-3">
                        {/* Billing */}
                        <Col lg={6}>
                            <h6 className="mb-3 fw-semibold">Billing</h6>
                            <Row className="g-3">
                                <Col md={12}>
                                    <Controller name="billingAddressLine1" control={control} render={({ field }) => (
                                        <CtrlText
                                            field={field}
                                            label="Address Line"
                                            placeholder="Street / Building / Area"
                                            required
                                            error={errors.billingAddressLine1?.message}
                                        />
                                    )} />
                                </Col>
                                <CityStateSelect
                                    stateLabel="State"
                                    cityLabel="City"
                                    stateValue={billingState}
                                    cityValue={billingCity}
                                    onStateChange={handleBillingStateChange}
                                    onCityChange={handleBillingCityChange}
                                    stateError={errors.billingState?.message}
                                    cityError={errors.billingCity?.message}
                                    required
                                />
                                <Col md={4}>
                                    <Controller name="billingPincode" control={control} render={({ field }) => (
                                        <CtrlText
                                            field={field}
                                            label="Pincode"
                                            placeholder="6-digit pincode"
                                            required
                                            error={errors.billingPincode?.message}
                                        />
                                    )} />
                                </Col>
                            </Row>
                        </Col>

                        {/* Shipping */}
                        <Col lg={6}>
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <h6 className="mb-0 fw-semibold">Shipping</h6>
                                <Controller name="sameAsBilling" control={control} render={({ field }) => (
                                    <label className="d-flex align-items-center gap-2 mb-0" style={{ cursor: "pointer", fontSize: "0.875rem" }}>
                                        <input
                                            type="checkbox"
                                            checked={field.value}
                                            onChange={e => field.onChange(e.target.checked)}
                                        />
                                        Same as billing
                                    </label>
                                )} />
                            </div>
                            <Row className="g-3">
                                <Col md={12}>
                                    <Controller name="shippingAddressLine1" control={control} render={({ field }) => (
                                        <CtrlText
                                            field={field}
                                            label="Address Line"
                                            placeholder="Street / Building / Area"
                                            disabled={sameAsBilling}
                                            error={errors.shippingAddressLine1?.message}
                                        />
                                    )} />
                                </Col>
                                <CityStateSelect
                                    stateLabel="State"
                                    cityLabel="City"
                                    stateValue={shippingState || ""}
                                    cityValue={shippingCity || ""}
                                    onStateChange={handleShippingStateChange}
                                    onCityChange={handleShippingCityChange}
                                    stateError={errors.shippingState?.message}
                                    cityError={errors.shippingCity?.message}
                                    required={!sameAsBilling}
                                    disabled={sameAsBilling}
                                    resetKey={shippingResetKey}
                                />
                                <Col md={4}>
                                    <Controller name="shippingPincode" control={control} render={({ field }) => (
                                        <CtrlText
                                            field={field}
                                            label="Pincode"
                                            placeholder="6-digit pincode"
                                            disabled={sameAsBilling}
                                            error={errors.shippingPincode?.message}
                                        />
                                    )} />
                                </Col>
                            </Row>
                        </Col>
                    </Row>

                    {/* ── Order Items ── */}
                    <div className="form-section-title mt-4 d-flex justify-content-between align-items-center">
                        <span>Order Items</span>
                        <CustomButton
                            text="Add Item"
                            icon={FaPlus}
                            onClick={() => append({ productCode: "", quantity: "", colorType: "" })}
                        />
                    </div>
                    {errors.items?.root && <Err message={errors.items.root.message} />}

                    <div className="master-table-body table-wrap mt-2">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "50px" }}>#</th>
                                    <th>PRODUCT</th>
                                    <th>COLOR TYPE</th>
                                    <th style={{ width: "180px" }}>QUANTITY</th>
                                    <th style={{ width: "60px" }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {fields.map((field, index) => (
                                    <tr key={field.id} className="master-data-row">
                                        <td className="master-data-cell">{index + 1}</td>

                                        <td className="master-data-cell">
                                            <Controller
                                                name={`items.${index}.productCode`}
                                                control={control}
                                                render={({ field: f }) => (
                                                    <SelectInput
                                                        label=""
                                                        name={f.name}
                                                        value={String(f.value || "")}
                                                        options={productOptions}
                                                        onChange={f.onChange}
                                                        defaultOptionLabel="Select Product"
                                                        error={errors.items?.[index]?.productCode?.message}
                                                    />
                                                )}
                                            />
                                        </td>

                                        <td className="master-data-cell">
                                            <Controller
                                                name={`items.${index}.colorType`}
                                                control={control}
                                                render={({ field: f }) => (
                                                    <SelectInput
                                                        label=""
                                                        name={f.name}
                                                        value={f.value || ""}
                                                        options={COLOUR_OPTIONS}
                                                        onChange={f.onChange}
                                                        defaultOptionLabel="Select Color"
                                                        error={errors.items?.[index]?.colorType?.message}
                                                    />
                                                )}
                                            />
                                        </td>

                                        <td className="master-data-cell">
                                            <Controller
                                                name={`items.${index}.quantity`}
                                                control={control}
                                                render={({ field: f }) => (
                                                    <CtrlText
                                                        field={{
                                                            ...f,
                                                            value: String(f.value || "")
                                                        }}
                                                        label=""
                                                        type="number"
                                                        placeholder="0"
                                                        error={errors.items?.[index]?.quantity?.message}
                                                    />
                                                )}
                                            />
                                        </td>

                                        <td className="master-data-cell">
                                            <button
                                                type="button"
                                                className="btn-remove-row"
                                                onClick={() => remove(index)}
                                                disabled={fields.length === 1}
                                                title="Remove item"
                                            >
                                                <FaTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Remarks ── */}
                    <Row className="g-3 mt-2">
                        <Col md={6}>
                            <Controller name="remarks" control={control} render={({ field }) => (
                                <TextArea
                                    label="Remarks"
                                    name="remarks"
                                    value={field.value ?? ""}
                                    placeholder="Any remarks for the customer..."
                                    rows={2}
                                    onChange={field.onChange}
                                />
                            )} />
                        </Col>
                        <Col md={6}>
                            <Controller name="internalNotes" control={control} render={({ field }) => (
                                <TextArea
                                    label="Internal Notes"
                                    name="internalNotes"
                                    value={field.value ?? ""}
                                    placeholder="Internal notes (not visible to customer)..."
                                    rows={2}
                                    onChange={field.onChange}
                                />
                            )} />
                        </Col>
                    </Row>

                    {/* ── Form Actions ── */}
                    <div className="form-actions d-flex justify-content-end gap-3 mt-4">
                        <CustomButton
                            text="Clear"
                            icon={FaEraser}
                            onClick={() => reset(defaultValues)}
                            disabled={isSubmitting}
                        />

                        <CustomButton
                            text={isSubmitting ? "Saving..." : "Save Order"}
                            icon={isSubmitting ? undefined : FaSave}
                            type="button"
                            onClick={handleSubmit((data) => onSubmit(data, "draft"))}
                            disabled={isSubmitting}
                        />

                        <CustomButton
                            text={isSubmitting ? "Sending..." : "Send to Quotation"}
                            icon={isSubmitting ? undefined : FaPaperPlane}
                            type="button"
                            onClick={handleSubmit((data) => onSubmit(data, "quotation"))}
                            disabled={isSubmitting}
                        />
                    </div>
                </form>
            </Container>
        </div>
    );
};

export default SalesOrderForm;