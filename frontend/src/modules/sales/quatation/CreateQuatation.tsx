// src/pages/sales/QuotationForm/QuotationForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Container, Row, Col, Spinner, Alert } from "react-bootstrap";
import { FaSave, FaArrowLeft, FaPaperPlane, FaUser, FaMapMarkerAlt, FaBoxOpen } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import { useCustomers } from "../../../hooks/useCustomers";
import { useProducts } from "../../../hooks/useProducts";
import { useEmployees } from "../../../hooks/useEmployees";
import { salesOrderService, type SalesOrder } from "../../../services/salesOrderService";
import { DISPATCH_TYPE_OPTIONS, ORDER_TYPE_OPTIONS } from "../../../constants/selectOption";
import { fetchGstTaxes, selectActiveGstTaxes } from "../../../features/gst/gstSlice";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";

// ─── Options ────────────────────────────────────────────────────────────────
const COLOR_TYPE_LABELS: Record<string, string> = {
    sc: "Single Color",
    mc: "Multi Color",
};

// ─── Zod Schema ─────────────────────────────────────────────────────────────
// No per-item discount fields — discount is now ONLY at order level.
const orderItemSchema = z.object({
    productId: z.string().min(1, "Product is required"),
    quantity: z
        .string()
        .min(1, "Required")
        .refine(v => !isNaN(Number(v)) && Number(v) > 0, { message: "Must be > 0" }),
    colorType: z.string().optional(),
    mrp: z.string().optional(),
    b2b: z.string().optional(),
    b2c: z.string().optional(),
    exportPrice: z.string().optional(),
    gstRate: z.string().optional(),
    cessRate: z.string().optional(),
    gstTaxRateId: z.string().optional(),
});

const quotationSchema = z.object({
    id: z.number().optional(),
    quotationNo: z.string().min(1, "Quotation No is required"),
    quotationDate: z.string().min(1, "Quotation Date is required"),
    validUntil: z.string().min(1, "Valid until date is required"),
    customerId: z.string().min(1, "Customer is required"),
    customerType: z.string().optional(),
    paymentTermId: z.string().optional(),
    billingAddressLine1: z.string().optional(),
    billingCity: z.string().optional(),
    billingState: z.string().optional(),
    billingPincode: z.string().optional(),
    sameAsBilling: z.boolean(),
    shippingAddressLine1: z.string().optional(),
    shippingCity: z.string().optional(),
    shippingState: z.string().optional(),
    shippingPincode: z.string().optional(),
    items: z.array(orderItemSchema).min(1, "At least one item is required"),
    remarks: z.string().optional(),
    internalNotes: z.string().optional(),
    // ── Order-level discount (the ONLY discount input in this form) ──
    orderDiscountType: z.enum(['PERCENT', 'FLAT']),
    orderDiscountValue: z.string(),
});

type QuotationFormValues = z.infer<typeof quotationSchema>;

// ─── Default values ──────────────────────────────────────────────────────────
const today = new Date().toISOString().split("T")[0];
const nextMonth = new Date();
nextMonth.setMonth(nextMonth.getMonth() + 1);
const validUntilDefault = nextMonth.toISOString().split("T")[0];

const defaultValues: QuotationFormValues = {
    id: undefined,
    quotationNo: "",
    quotationDate: today,
    validUntil: validUntilDefault,
    customerId: "",
    customerType: "",
    paymentTermId: "",
    billingAddressLine1: "",
    billingCity: "",
    billingState: "",
    billingPincode: "",
    sameAsBilling: false,
    shippingAddressLine1: "",
    shippingCity: "",
    shippingState: "",
    shippingPincode: "",
    items: [{
        productId: "", quantity: "",
        colorType: "", mrp: "", b2b: "", b2c: "", exportPrice: "",
        gstRate: "", cessRate: "", gstTaxRateId: "",
    }],
    remarks: "",
    internalNotes: "",
    orderDiscountType: "PERCENT",
    orderDiscountValue: "",
};

// ─── CtrlText: bridges Controller field → TextInput ──
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

// ─── Inline error ──────────────────────────────────────────────────────────
const Err: React.FC<{ message?: string }> = ({ message }) =>
    message ? <div className="text-danger mt-1 small">{message}</div> : null;

// ─── Report-style read-only Field (matches QuotationReport / SalesOrderDetail) ──
const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="mb-3">
        <div
            className="small text-uppercase"
            style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
        >
            {label}
        </div>
        <div className="fw-semibold" style={{ color: "var(--color-text-primary)" }}>{value ?? "—"}</div>
    </div>
);

// ─── Report-style Section wrapper (matches QuotationReport / SalesOrderDetail) ──
const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div
        className="mb-4 p-4"
        style={{
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
        }}
    >
        <div className="d-flex align-items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
            {icon && (
                <span
                    className="d-inline-flex align-items-center justify-content-center"
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(203, 122, 33, 0.1)",
                        color: "var(--color-secondary)",
                    }}
                >
                    {icon}
                </span>
            )}
            <h6 className="mb-0 fw-bold" style={{ color: "var(--color-primary)", fontFamily: "var(--font-head)" }}>{title}</h6>
        </div>
        {children}
    </div>
);

// ─── Component ─────────────────────────────────────────────────────────────
const QuotationForm: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // ─── State ──────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [quotationId, setQuotationId] = useState<number | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string | null>(null);
    const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);

    // ── Read-only order metadata ──
    const [dispatchType, setDispatchType] = useState<string | null>(null);
    const [orderType, setOrderType] = useState<string | null>(null);
    const [salesPersonId, setSalesPersonId] = useState<string | null>(null);

    // ── Draft orders dropdown ──
    const [draftOrders, setDraftOrders] = useState<SalesOrder[]>([]);
    const [loadingDraftOrders, setLoadingDraftOrders] = useState(false);
    const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
    const dispatch = useAppDispatch();

    const {
        control,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
        getValues,
    } = useForm<QuotationFormValues>({
        resolver: zodResolver(quotationSchema),
        defaultValues,
    });

    const { fields } = useFieldArray({
        control,
        name: "items",
    });

    const { loadCustomers, customers, loading: customersLoading } = useCustomers();
    const { loadProducts, products, loading: productsLoading } = useProducts();
    const { employees, loadEmployees } = useEmployees();

    // ── Watch values ──
    const items = watch("items");
    const watchedCustomerType = watch("customerType");
    const quotationNo = watch("quotationNo");
    const quotationDate = watch("quotationDate");
    const validUntil = watch("validUntil");
    const customerId = watch("customerId");
    const remarks = watch("remarks");
    const internalNotes = watch("internalNotes");
    const orderDiscountType = watch("orderDiscountType");
    const orderDiscountValue = watch("orderDiscountValue");

    const gstTaxes = useAppSelector(selectActiveGstTaxes);
    const gstLoading = useAppSelector((state) => state.gst.loading);

    const customerName = useMemo(() => {
        const c = customers.find(c => String(c.id) === customerId);
        return c?.displayName || c?.firmName || null;
    }, [customers, customerId]);

    const salesPersonName = useMemo(() => {
        if (!salesPersonId) return null;
        const emp = employees.find(e => String(e?.id) === salesPersonId);
        return emp?.fullName || null;
    }, [employees, salesPersonId]);

    const orderTypeLabel = useMemo(
        () => ORDER_TYPE_OPTIONS.find(o => o.value === orderType)?.label || orderType,
        [orderType]
    );
    const dispatchTypeLabel = useMemo(
        () => DISPATCH_TYPE_OPTIONS.find(o => o.value === dispatchType)?.label || dispatchType,
        [dispatchType]
    );

    const gstOptions = useMemo(() => [
        { value: "", label: gstLoading ? "Loading GST rates..." : "-- Select GST Rate --" },
        ...(gstTaxes || []).map((t: any) => ({
            value: String(t.id),
            label: `${t.taxName} (${t.taxRate}%)`,
        })),
    ], [gstTaxes, gstLoading]);

    const formatDate = (val?: string | null) => {
        if (!val) return "—";
        return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    // ─── Helper: populate form from an order ──────────────────
    const populateFormFromOrder = (order: SalesOrder) => {
        const billing = {
            addressLine1: order.billingAddressLine1 || "",
            city: order.billingCity || "",
            state: order.billingState || "",
            pincode: order.billingPincode || "",
        };
        const shipping = {
            addressLine1: order.shippingAddressLine1 || "",
            city: order.shippingCity || "",
            state: order.shippingState || "",
            pincode: order.shippingPincode || "",
        };

        const items = order.items && order.items.length > 0
            ? order.items.map((item: any) => ({
                productId: String(item.productId || ""),
                quantity: String(item.quantity || ""),
                colorType: item.colorType || "",
                mrp: item.mrp != null ? String(item.mrp) : "",
                b2b: item.b2b != null ? String(item.b2b) : "",
                b2c: item.b2c != null ? String(item.b2c) : "",
                exportPrice: item.exportPrice != null ? String(item.exportPrice) : "",
                gstRate: item.gstRate != null ? String(item.gstRate) : "0",
                cessRate: item.cessRate != null ? String(item.cessRate) : "0",
                gstTaxRateId: item.gstTaxRateId != null ? String(item.gstTaxRateId) : "",
            }))
            : [{
                productId: "", quantity: "",
                colorType: "", mrp: "", b2b: "", b2c: "", exportPrice: "",
                gstRate: "", cessRate: "", gstTaxRateId: "",
            }];

        reset({
            id: order.id,
            quotationNo: order.orderNo,
            quotationDate: order.orderDate?.split("T")[0] || today,
            validUntil: order.expectedCompletionDate?.split("T")[0] || validUntilDefault,
            customerId: String(order.customerId || ""),
            customerType: (order as any).customerType || "",
            paymentTermId: order.paymentTermId?.toString() || "",
            billingAddressLine1: billing?.addressLine1 || "",
            billingCity: billing?.city || "",
            billingState: billing?.state || "",
            billingPincode: billing?.pincode || "",
            sameAsBilling: order.sameAsBilling || false,
            shippingAddressLine1: shipping?.addressLine1 || "",
            shippingCity: shipping?.city || "",
            shippingState: shipping?.state || "",
            shippingPincode: shipping?.pincode || "",
            remarks: order.remarks || "",
            internalNotes: order.internalNotes || "",
            items: items,
            // 👇 pull the previously-saved order-level discount back in on edit
            orderDiscountType: (order as any).orderDiscountType || "PERCENT",
            orderDiscountValue: (order as any).orderDiscountValue != null
                ? String((order as any).orderDiscountValue)
                : "",
        });

        setRejectionReason(order.mdRejectionReason || null);
        setIsEditMode(true);
        setQuotationId(order.id);

        setDispatchType((order as any).dispatchType || null);
        setOrderType((order as any).orderType || null);
        setSalesPersonId((order as any).salesPersonId != null ? String((order as any).salesPersonId) : null);
    };

    // ── Load order ──
    useEffect(() => {
        const state = location.state as any;
        dispatch(fetchGstTaxes({ status: "ACTIVE" }));

        if (!state?.id) {
            setIsEditMode(false);
            setQuotationId(null);
            setRejectionReason(null);
            setDispatchType(null);
            setOrderType(null);
            setSalesPersonId(null);
            reset(defaultValues);
            setSelectedDraftId(null);
            return;
        }

        const loadOrder = async () => {
            try {
                let order = state as SalesOrder;
                populateFormFromOrder(order);
            } catch (error) {
                toast.error("Failed to load quotation");
                navigate("/quotations");
            }
        };

        loadOrder();
    }, [location, reset, navigate, dispatch]);

    // ─── Load draft orders (only in create mode) ──────────────
    useEffect(() => {
        if (isEditMode) return;

        const loadDraftOrders = async () => {
            setLoadingDraftOrders(true);
            try {
                const res = await salesOrderService.fetchAll({
                    status: 'CONFIRMED',
                    pageSize: 100,
                });
                setDraftOrders(res.data || []);
            } catch (error) {
                toast.error("Failed to load draft orders");
            } finally {
                setLoadingDraftOrders(false);
            }
        };
        loadDraftOrders();
    }, [isEditMode]);

    // ─── Load Customers, Products & Employees ────────────────────────────
    useEffect(() => {
        loadCustomers();
        loadProducts();
        loadEmployees({ designationId: 6 });
    }, [loadCustomers, loadProducts, loadEmployees]);

    // ─── Get Next Quotation Number (Create Mode) ──────────────
    useEffect(() => {
        const state = location.state as any;
        if (state?.id || isEditMode) return;

        salesOrderService.getNextOrderNo().then((orderNo) => {
            const qtNo = orderNo.replace('SO', 'QT');
            setValue("quotationNo", qtNo);
        });
    }, [location, setValue, isEditMode]);

    // ─── Re-populate product IDs when products load ──
    useEffect(() => {
        if (products.length > 0 && quotationId && items && items.length > 0) {
            items.forEach((item: any, index: number) => {
                if (item.productId) {
                    setValue(`items.${index}.productId`, item.productId);
                }
            });
        }
    }, [products, quotationId, items, setValue]);

    // ─── Calculate totals ────────────────────────────────────
    const resolveUnitPrice = (
        customerType: string | undefined,
        tiers: { b2b: number; mrp: number; b2c: number; exportPrice: number }
    ): number => {
        switch (customerType) {
            case "B2C":
                return tiers.b2c || tiers.mrp || tiers.b2b || tiers.exportPrice || 0;
            case "EXPORT":
                return tiers.exportPrice || tiers.mrp || tiers.b2b || tiers.b2c || 0;
            case "B2B":
            default:
                return tiers.b2b || tiers.mrp || tiers.b2c || tiers.exportPrice || 0;
        }
    };

    // Per-item base calc — NO discount applied here anymore. That's the
    // whole point: only quantity × unit price + GST rate per item.
    const calculateItemBase = (item: any) => {
        const quantity = Number(item.quantity) || 0;

        let gstRate = item.gstRate !== undefined && item.gstRate !== "" ? Number(item.gstRate) : NaN;
        let cessRate = item.cessRate !== undefined && item.cessRate !== "" ? Number(item.cessRate) : NaN;

        let mrp = item.mrp !== undefined && item.mrp !== "" ? Number(item.mrp) : NaN;
        let b2b = item.b2b !== undefined && item.b2b !== "" ? Number(item.b2b) : NaN;
        let b2c = item.b2c !== undefined && item.b2c !== "" ? Number(item.b2c) : NaN;
        let exportPrice = item.exportPrice !== undefined && item.exportPrice !== "" ? Number(item.exportPrice) : NaN;

        if (isNaN(b2b) && isNaN(mrp) && isNaN(b2c) && isNaN(exportPrice)) {
            const product = products.find(p => String(p.id) === item.productId);
            if (product) {
                mrp = Number(product.mrp) || 0;
                b2b = Number(product.b2b) || 0;
                b2c = Number(product.b2c) || 0;
                exportPrice = Number(product.exportPrice) || 0;

                if (isNaN(Number(item.gstRate)) || item.gstRate === "" || item.gstRate === undefined) {
                    gstRate = Number(product.gstRate) || 0;
                }
                if (isNaN(Number(item.cessRate)) || item.cessRate === "" || item.cessRate === undefined) {
                    cessRate = Number(product.cess) || 0;
                }
            }
        }

        if (isNaN(mrp)) mrp = 0;
        if (isNaN(b2b)) b2b = 0;
        if (isNaN(b2c)) b2c = 0;
        if (isNaN(exportPrice)) exportPrice = 0;
        if (isNaN(gstRate)) gstRate = 0;
        if (isNaN(cessRate)) cessRate = 0;

        if (item.gstTaxRateId) {
            const selectedTax = (gstTaxes || []).find((t: any) => String(t.id) === item.gstTaxRateId);
            if (selectedTax) {
                gstRate = Number(selectedTax.taxRate) || 0;
            }
        }

        const unitPrice = resolveUnitPrice(watchedCustomerType, { b2b, mrp, b2c, exportPrice });
        const subtotal = quantity * unitPrice;

        return { subtotal, unitPrice, gstRate, cessRate };
    };

    // Kept for the per-row "GST AMT" column display — computes each row's
    // OWN gst amount ignoring order discount (matches what backend shows
    // pre-discount too, since GST recompute happens after discount is
    // distributed server-side).
    const calculateItemDisplay = (item: any) => {
        const base = calculateItemBase(item);
        const gstAmount = (base.subtotal * base.gstRate) / 100;
        const cessAmount = (base.subtotal * base.cessRate) / 100;
        return { ...base, gstAmount, cessAmount, discountAmount: 0 };
    };

    // Order-level totals — the ONE discount is applied here, proportionally
    // distributed across each item's share of the subtotal (mirrors the
    // backend's updateOrderDiscount()).
    const calculateOrderTotals = () => {
        const bases = (items || [])
            .filter((item: any) => item.productId && item.quantity)
            .map((item: any) => calculateItemBase(item));

        const subtotal = bases.reduce((sum, b) => sum + b.subtotal, 0);

        const discountValueNum = Number(orderDiscountValue) || 0;
        const rawDiscount = orderDiscountType === "PERCENT"
            ? (subtotal * discountValueNum) / 100
            : discountValueNum;
        const totalDiscount = Math.min(rawDiscount, subtotal);

        let totalGst = 0;
        let totalCess = 0;

        if (subtotal > 0) {
            for (const b of bases) {
                const share = b.subtotal / subtotal;
                const itemDiscount = totalDiscount * share;
                const taxableValue = b.subtotal - itemDiscount;
                totalGst += (taxableValue * b.gstRate) / 100;
                totalCess += (taxableValue * b.cessRate) / 100;
            }
        }

        const netAmount = subtotal - totalDiscount + totalGst + totalCess;

        return { subtotal, totalDiscount, totalGst, totalCess, netAmount };
    };

    const totals = calculateOrderTotals();

    // ─── Handle draft order selection ──────────────────────────
    const handleDraftOrderSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value ? Number(e.target.value) : null;
        setSelectedDraftId(id);
        if (!id) {
            setIsEditMode(false);
            setQuotationId(null);
            setRejectionReason(null);
            setDispatchType(null);
            setOrderType(null);
            setSalesPersonId(null);
            reset(defaultValues);
            salesOrderService.getNextOrderNo().then((orderNo) => {
                const qtNo = orderNo.replace('SO', 'QT');
                setValue("quotationNo", qtNo);
            });
            return;
        }

        try {
            const order = await salesOrderService.fetchById(id);
            populateFormFromOrder(order);
        } catch (error) {
            toast.error("Failed to load draft order");
        }
    };

    // ─── Submit Handler ────────────────────────────────────────
    const onSubmit = async (data: QuotationFormValues, submitForApproval: boolean = false) => {
        if (submitForApproval) {
            setIsSubmittingForApproval(true);
        } else {
            setIsSubmitting(true);
        }

        try {

            // No per-item discountType/discountValue sent anymore.
            const transformedItems = data.items.map(item => ({
                productId: Number(item.productId),
                quantity: Number(item.quantity),
                colorTypeId: item.colorType || undefined,
                gstTaxRateId: item.gstTaxRateId || undefined,
            }));

            const payload = {
                orderNo: data.quotationNo,
                orderDate: new Date(data.quotationDate).toISOString(),
                expectedCompletionDate: new Date(data.validUntil).toISOString(),
                customerId: data.customerId,
                customerType: data.customerType || undefined,
                paymentTermId: data.paymentTermId ? Number(data.paymentTermId) : null,
                billingAddressLine1: data.billingAddressLine1 ?? "",
                billingCity: data.billingCity ?? "",
                billingState: data.billingState ?? "",
                billingPincode: data.billingPincode ?? "",
                sameAsBilling: data.sameAsBilling,
                shippingAddressLine1: data.sameAsBilling ? (data.billingAddressLine1 ?? "") : (data.shippingAddressLine1 ?? ""),
                shippingCity: data.sameAsBilling ? (data.billingCity ?? "") : (data.shippingCity ?? ""),
                shippingState: data.sameAsBilling ? (data.billingState ?? "") : (data.shippingState ?? ""),
                shippingPincode: data.sameAsBilling ? (data.billingPincode ?? "") : (data.shippingPincode ?? ""),
                remarks: data.remarks,
                internalNotes: data.internalNotes,
                items: transformedItems,
            };

            let response;

            if (isEditMode && quotationId) {
                response = await salesOrderService.update(quotationId, payload);
            } else {
                response = await salesOrderService.create(payload);
            }

            const orderId = isEditMode ? quotationId! : response.id;

            // Apply the single order-level discount (if any) — this replaces
            // the old per-item updateDiscounts call entirely.
            const discountValueNum = Number(data.orderDiscountValue) || 0;
            // if (discountValueNum > 0) {
            //     await salesOrderService.updateOrderDiscount(orderId, {
            //         discountType: data.orderDiscountType,
            //         discountValue: discountValueNum,
            //     });
            // }

            if (submitForApproval) {
                await salesOrderService.submitForMdApproval(orderId);
                toast.success("Quotation submitted for MD approval!");
            } else {
                toast.success(isEditMode ? "Quotation updated successfully!" : "Quotation created successfully as DRAFT!");
            }

            navigate("/quatation-order");
        } catch (error: any) {
            console.error("❌ Submit Error:", error);
            toast.error(error?.response?.data?.message || "Failed to save quotation");
        } finally {
            setIsSubmitting(false);
            setIsSubmittingForApproval(false);
        }
    };

    // ─── Render ──────────────────────────────────────────────────
    const isLoading = customersLoading || productsLoading;
    const billing = {
        addressLine1: watch("billingAddressLine1"),
        city: watch("billingCity"),
        state: watch("billingState"),
        pincode: watch("billingPincode"),
    };
    const shipping = {
        addressLine1: watch("shippingAddressLine1"),
        city: watch("shippingCity"),
        state: watch("shippingState"),
        pincode: watch("shippingPincode"),
    };

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">
                                    {isEditMode ? "Edit Quotation" : "Create Quotation"}
                                </h2>
                                <div className="page-breadcrumb">Home / Sales / Quotation / {isEditMode ? "Edit" : "Create"}</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/quotations")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {isLoading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-3">Loading data...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit((data) => onSubmit(data, false))} className="form-inner" noValidate>
                        {/* ── Draft Order Selector (only in create mode) ── */}
                        {!isEditMode && (
                            <Row className="mb-3">
                                <Col md={6}>
                                    <label className="form-label">Select Order</label>
                                    <select
                                        className="form-select"
                                        value={selectedDraftId || ""}
                                        onChange={handleDraftOrderSelect}
                                        disabled={loadingDraftOrders}
                                    >
                                        <option value=""> Select quotation </option>
                                        {draftOrders.map((order) => (
                                            <option key={order.id} value={order.id}>
                                                {order.orderNo} - {order.customer?.displayName || order.customer?.firmName || "N/A"}
                                            </option>
                                        ))}
                                    </select>
                                    {loadingDraftOrders && <Spinner animation="border" size="sm" className="ms-2" />}
                                </Col>
                            </Row>
                        )}

                        {/* ── Form Fields (only when edit mode) ── */}
                        {isEditMode && (
                            <>
                                {/* ── Order Information — read-only ── */}
                                <Section title="Order Information">
                                    <Row>
                                        <Col md={4}><Field label="Quotation No" value={quotationNo} /></Col>
                                        <Col md={4}><Field label="Quotation Date" value={formatDate(quotationDate)} /></Col>
                                        <Col md={4}><Field label="Valid Until" value={formatDate(validUntil)} /></Col>
                                        <Col md={4}><Field label="Order Source Platform" value={orderTypeLabel} /></Col>
                                        <Col md={4}><Field label="Dispatch Type" value={dispatchTypeLabel} /></Col>
                                        {orderType === "salesperson" && (
                                            <Col md={4}><Field label="Sales Person" value={salesPersonName} /></Col>
                                        )}
                                    </Row>
                                </Section>

                                {/* ── Customer — read-only ── */}
                                <Section title="Customer" icon={<FaUser />}>
                                    <Row>
                                        <Col md={4}><Field label="Name" value={customerName} /> </Col >
                                        <Col md={4}><Field label="Type" value={watchedCustomerType} /> </Col >
                                    </Row>
                                </Section>

                                {/* ── Addresses — read-only ── */}
                                <Section title="Addresses" icon={<FaMapMarkerAlt />}>
                                    <Row>
                                        <Col md={6}>
                                            <div
                                                className="small text-uppercase mb-2"
                                                style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                            >
                                                Billing Address
                                            </div>
                                            <div>{billing.addressLine1 || "—"}</div>
                                            <div>{billing.city}, {billing.state} — {billing.pincode}</div>
                                        </Col>
                                        <Col md={6}>
                                            <div
                                                className="small text-uppercase mb-2"
                                                style={{ fontSize: "0.72rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                            >
                                                Shipping Address
                                            </div>
                                            <div>{shipping.addressLine1 || "—"}</div>
                                            <div>{shipping.city}, {shipping.state} — {shipping.pincode}</div>
                                        </Col>
                                    </Row>
                                </Section>

                                {rejectionReason && (
                                    <Alert variant="danger" className="mt-3">
                                        <strong>Rejection Reason:</strong> {rejectionReason}
                                    </Alert>
                                )}

                                {/* ── Order Items — fully read-only except GST rate; NO per-item
                                    discount UI here anymore — discount is entered once, below,
                                    for the whole order. ── */}
                                <Section title="Quotation Items" icon={<FaBoxOpen />}>
                                    {errors.items?.root && <Err message={errors.items.root.message} />}

                                    <div className="table-wrap">
                                        <table className="master-data-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: "40px" }}>#</th>
                                                    <th style={{ width: "200px" }}>PRODUCT</th>
                                                    <th style={{ width: "100px" }}>COLOR TYPE</th>
                                                    <th style={{ width: "70px" }} className="text-end">QTY</th>
                                                    <th style={{ width: "100px" }} className="text-end">UNIT PRICE</th>
                                                    <th style={{ width: "100px" }} className="text-end">SUBTOTAL</th>
                                                    <th style={{ width: "180px" }}>GST RATE</th>
                                                    <th style={{ width: "100px" }} className="text-end">GST AMT</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {fields.map((field, index) => {
                                                    const itemValue = getValues(`items.${index}`);
                                                    const product = products.find(p => String(p.id) === String(itemValue?.productId));
                                                    const calc = itemValue?.productId && itemValue?.quantity
                                                        ? calculateItemDisplay(itemValue)
                                                        : { subtotal: 0, unitPrice: 0, gstRate: 0, cessRate: 0, gstAmount: 0, cessAmount: 0 };

                                                    return (
                                                        <tr key={field.id} className="master-data-row">
                                                            <td className="master-data-cell">{index + 1}</td>

                                                            <td className="master-data-cell">
                                                                <div className="fw-semibold">{product?.productName || "—"}</div>
                                                                <div className="text-muted small">{product?.productCode}</div>
                                                            </td>

                                                            <td className="master-data-cell">
                                                                {COLOR_TYPE_LABELS[itemValue?.colorType || ''] || itemValue?.colorType || '—'}
                                                            </td>

                                                            <td className="master-data-cell text-end">
                                                                {itemValue?.quantity || 0}
                                                            </td>

                                                            <td className="master-data-cell text-end">
                                                                ₹{calc.unitPrice.toFixed(2)}
                                                            </td>

                                                            <td className="master-data-cell text-end">
                                                                ₹{calc.subtotal.toFixed(2)}
                                                            </td>

                                                            <td className="master-data-cell">
                                                                <Controller
                                                                    name={`items.${index}.gstTaxRateId`}
                                                                    control={control}
                                                                    render={({ field: f }) => (
                                                                        <SelectInput
                                                                            label=""
                                                                            name={f.name}
                                                                            value={f.value ?? ""}
                                                                            options={gstOptions}
                                                                            onChange={f.onChange}
                                                                        />
                                                                    )}
                                                                />
                                                            </td>

                                                            <td className="master-data-cell text-end">
                                                                <span>₹{calc.gstAmount.toFixed(2)}</span>
                                                                {calc.gstRate > 0 && (
                                                                    <div className="text-muted small">({calc.gstRate}%)</div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* ── Single order-level discount input + totals ── */}
                                    {fields.length > 0 && (
                                        <div className="d-flex justify-content-end mt-3">
                                            <div style={{ minWidth: "340px" }}>
                                                <div className="d-flex align-items-end gap-2 mb-3 justify-content-end">
                                                    <div style={{ width: "130px" }}>
                                                        <Controller
                                                            name="orderDiscountType"
                                                            control={control}
                                                            render={({ field: f }) => (
                                                                <SelectInput
                                                                    label="Order Discount"
                                                                    name={f.name}
                                                                    value={f.value}
                                                                    options={[
                                                                        { label: 'Percent', value: 'PERCENT' },
                                                                        { label: 'Flat', value: 'FLAT' },
                                                                    ]}
                                                                    onChange={f.onChange}
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                    <div style={{ width: "140px" }}>
                                                        <Controller
                                                            name="orderDiscountValue"
                                                            control={control}
                                                            render={({ field: f }) => (
                                                                <CtrlText
                                                                    field={{ ...f, value: String(f.value ?? "") }}
                                                                    label=" "
                                                                    type="number"
                                                                    placeholder="0"
                                                                    error={errors.orderDiscountValue?.message}
                                                                />
                                                            )}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="d-flex justify-content-between py-1">
                                                    <span className="text-muted">Subtotal</span>
                                                    <span>₹{totals.subtotal.toFixed(2)}</span>
                                                </div>
                                                {totals.totalDiscount > 0 && (
                                                    <div className="d-flex justify-content-between py-1">
                                                        <span className="text-muted">Discount</span>
                                                        <span>- ₹{totals.totalDiscount.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                <div className="d-flex justify-content-between py-1">
                                                    <span className="text-muted">GST</span>
                                                    <span>+ ₹{totals.totalGst.toFixed(2)}</span>
                                                </div>

                                                <hr className="my-2" />
                                                <div className="d-flex justify-content-between py-1 fw-bold">
                                                    <span>Net Amount</span>
                                                    <span>₹{totals.netAmount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Section>

                                {/* ── Remarks — read-only ── */}
                                {(remarks || internalNotes) && (
                                    <Section title="Notes">
                                        <Row>
                                            {remarks && <Col md={6}><Field label="Remarks" value={remarks} /></Col>}
                                            {internalNotes && <Col md={6}><Field label="Internal Notes" value={internalNotes} /></Col>}
                                        </Row>
                                    </Section>
                                )}

                                {/* ── Form Actions ── */}
                                <div className="form-actions d-flex justify-content-end gap-3 mt-4" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}>
                                    <CustomButton
                                        text={isSubmitting ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update Draft" : "Save as Draft")}
                                        icon={isSubmitting ? undefined : FaSave}
                                        type="submit"
                                        disabled={isSubmitting || isSubmittingForApproval}
                                    />
                                    <CustomButton
                                        text={isSubmittingForApproval ? "Submitting..." : "Submit for Approval"}
                                        icon={isSubmittingForApproval ? undefined : FaPaperPlane}
                                        onClick={handleSubmit((data) => onSubmit(data, true))}
                                        disabled={isSubmitting || isSubmittingForApproval}
                                        className="btn-success"
                                    />
                                </div>
                            </>
                        )}
                    </form>
                )}
            </Container>
        </div>
    );
};

export default QuotationForm;