// src/pages/sales/QuotationForm/QuotationForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { FaSave, FaPaperPlane, FaCircleNotch, FaExclamationTriangle, FaUser, FaCalendarAlt, FaTruck, FaGlobe, FaMapMarkerAlt, FaFileAlt } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DetailBox from "../../../components/ui/DetailBox/DetailBox";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { useCustomers } from "../../../hooks/useCustomers";
import { useProducts } from "../../../hooks/useProducts";
import { useEmployees } from "../../../hooks/useEmployees";
import { salesOrderService, type SalesOrder } from "../../../services/salesOrderService";
import { DISPATCH_TYPE_OPTIONS, ORDER_TYPE_OPTIONS } from "../../../constants/selectOption";
import { fetchGstTaxes, selectActiveGstTaxes } from "../../../features/gst/gstSlice";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { useSelector } from "react-redux";

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
    isInterState: z.boolean(),
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
    isInterState: false,
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
    const isInterState = watch("isInterState");
    const billingState = watch("billingState");
    const { data: company } = useSelector((state: any) => state.company);
    const companyState = company?.state;

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
                const order = state as SalesOrder;
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
        loadEmployees({});
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

    const computedIsInterState = useMemo(() => {
        if (!companyState || !billingState) return false;
        return companyState.toLowerCase().trim() !== billingState.toLowerCase().trim();
    }, [companyState, billingState]);

    useEffect(() => {
        setValue("isInterState", computedIsInterState, { shouldValidate: true });
    }, [computedIsInterState, setValue]);

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
                isInterState: data.isInterState,
                remarks: data.remarks,
                internalNotes: data.internalNotes,
                items: transformedItems,
                orderDiscountType: data.orderDiscountType,
                orderDiscountValue: data.orderDiscountValue,
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
        <div className="w-full mx-auto">
            {isLoading ? (
                <CommonLoader text="Loading data..." fullScreen={false} />
            ) : (
                <div className="bg-white  border border-gray-200">


                    {/* Page Header */}
                    <div className="px-6 py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">
                                    {isEditMode ? "Edit Quotation" : "Create Quotation"}
                                </h2>
                            </div>
                            <div>
                                <BackButton text="Back to List" />
                            </div>
                        </div>
                    </div>


                    <form className="px-6 py-3 space-y-4" onSubmit={handleSubmit((data) => onSubmit(data, false))} noValidate>
                        {/* ── Draft Order Selector (only in create mode) ── */}
                        {!isEditMode && (
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Select Order</label>
                                <div className="relative max-w-md">
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
                                        value={selectedDraftId || ""}
                                        onChange={handleDraftOrderSelect}
                                        disabled={loadingDraftOrders}
                                    >
                                        <option value=""> -- Select a Draft Order -- </option>
                                        {draftOrders.map((order) => (
                                            <option key={order.id} value={order.id}>
                                                {order.orderNo} - {order.customer?.displayName || order.customer?.firmName || "N/A"}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                                        {loadingDraftOrders ? <FaCircleNotch className="animate-spin" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Report Page (only when edit mode) ── */}
                        {isEditMode && (
                            <>
                                {rejectionReason && (
                                    <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 flex items-start gap-2">
                                        <FaExclamationTriangle className="text-red-500 mt-0.5 text-sm" />
                                        <div>
                                            <div className="text-red-800 font-semibold text-xs uppercase tracking-wide">Rejection Reason</div>
                                            <p className="text-red-700 text-sm m-0">{rejectionReason}</p>
                                        </div>
                                    </div>
                                )}

                                {/* ── Order Info + Customer ── */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                                    <DetailBox label="Quotation No" value={quotationNo} icon={<FaFileAlt />} />
                                    <DetailBox label="Customer" value={customerName} icon={<FaUser />} />
                                    <DetailBox label="Quotation Date" value={formatDate(quotationDate)} icon={<FaCalendarAlt />} />
                                    <DetailBox label="Valid Until" value={formatDate(validUntil)} icon={<FaCalendarAlt />} />
                                    <DetailBox label="Dispatch Type" value={dispatchTypeLabel} icon={<FaTruck />} />
                                    <DetailBox label="Order Source Platform" value={orderTypeLabel} icon={<FaGlobe />} />
                                    <DetailBox label="Customer Type" value={watchedCustomerType} icon={<FaUser />} />
                                    {orderType === "salesperson" && (
                                        <DetailBox label="Sales Person" value={salesPersonName} icon={<FaUser />} />
                                    )}
                                </div>

                                {/* ── Billing ── */}
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><FaMapMarkerAlt className="text-blue-500" /> Billing</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">

                                    <DetailBox label="Address Line" value={billing.addressLine1} />

                                    <DetailBox label="State" value={billing.state} />
                                    <DetailBox label="City" value={billing.city} />
                                    <DetailBox label="Pincode" value={billing.pincode} />
                                </div>

                                {/* ── Shipping ── */}
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><FaMapMarkerAlt className="text-blue-500" /> Shipping</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">

                                    <DetailBox label="Address Line" value={shipping.addressLine1} />

                                    <DetailBox label="State" value={shipping.state} />
                                    <DetailBox label="City" value={shipping.city} />
                                    <DetailBox label="Pincode" value={shipping.pincode} />
                                </div>

                                {/* ── Items ── */}
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Quotation Items</h3>
                                {errors.items?.root && (
                                    <div className="text-red-500 text-sm mb-3">{errors.items.root.message}</div>
                                )}

                                <div className="border border-gray-200 rounded-lg overflow-visible mb-4">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="py-3 pl-4 pr-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide w-8">#</th>
                                                <th className="py-3 px-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide">Product</th>
                                                <th className="py-3 px-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide">Color Type</th>
                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Qty</th>
                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Unit Price</th>
                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Subtotal</th>
                                                <th className="py-3 px-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide w-56 min-w-[14rem]">GST Rate</th>
                                                <th className="py-3 pr-4 pl-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">GST Amt</th>
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
                                                    <tr key={field.id} className="border-b border-gray-100 last:border-b-0 bg-white">
                                                        <td className="py-3 pl-4 pr-2 text-gray-700">{index + 1}</td>

                                                        <td className="py-3 px-2">
                                                            <div className="font-medium text-gray-900">{product?.productName || "—"}</div>
                                                            <div className="text-gray-500 text-xs">{product?.productCode}</div>
                                                        </td>

                                                        <td className="py-3 px-2 text-gray-700">
                                                            {COLOR_TYPE_LABELS[itemValue?.colorType || ''] || itemValue?.colorType || '—'}
                                                        </td>

                                                        <td className="py-3 px-2 text-right text-gray-900">
                                                            {itemValue?.quantity || 0}
                                                        </td>

                                                        <td className="py-3 px-2 text-right text-gray-900">
                                                            ₹{calc.unitPrice.toFixed(2)}
                                                        </td>

                                                        <td className="py-3 px-2 text-right font-medium text-gray-900">
                                                            ₹{calc.subtotal.toFixed(2)}
                                                        </td>

                                                        <td className="py-2 px-2 w-56 min-w-[14rem]">
                                                            <div className="w-full">
                                                                <Controller
                                                                    name={`items.${index}.gstTaxRateId`}
                                                                    control={control}
                                                                    render={({ field: f }) => (
                                                                        <SelectInput
                                                                            hideLabel
                                                                            noMargin={true}
                                                                            label=""
                                                                            name={f.name}
                                                                            value={f.value ?? ""}
                                                                            options={gstOptions}
                                                                            onChange={f.onChange}
                                                                        />
                                                                    )}
                                                                />
                                                            </div>
                                                        </td>

                                                        <td className="py-3 pr-4 pl-2 text-right text-gray-900">
                                                            <div className="font-medium">₹{calc.gstAmount.toFixed(2)}</div>
                                                            {calc.gstRate > 0 && (
                                                                <div className="text-gray-500 text-xs">({calc.gstRate}%)</div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {fields.length === 0 && (
                                                <tr>
                                                    <td colSpan={8} className="py-8 text-center text-gray-500 text-sm">
                                                        No items found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* ── Discount input + totals ── */}
                                {fields.length > 0 && (
                                    <div className="flex justify-end mb-4">
                                        <div className="w-full max-w-sm border border-gray-200 rounded-lg p-4 bg-gray-50">
                                            <div className="flex items-end gap-2 mb-3 justify-end">
                                                <div className="w-28">
                                                    <Controller
                                                        name="orderDiscountType"
                                                        control={control}
                                                        render={({ field: f }) => (
                                                            <SelectInput
                                                                label="Discount Type"
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
                                                <div className="w-28">
                                                    <Controller
                                                        name="orderDiscountValue"
                                                        control={control}
                                                        render={({ field: f }) => (
                                                            <CtrlText
                                                                field={{ ...f, value: String(f.value ?? "") }}
                                                                label="Value"
                                                                type="number"
                                                                placeholder="0"
                                                                error={errors.orderDiscountValue?.message}
                                                            />
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5 text-sm border-t border-gray-200 pt-3">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Subtotal</span>
                                                    <span className="text-gray-900">₹{totals.subtotal.toFixed(2)}</span>
                                                </div>

                                                {totals.totalDiscount > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Discount</span>
                                                        <span className="text-red-600">- ₹{totals.totalDiscount.toFixed(2)}</span>
                                                    </div>
                                                )}

                                                {isInterState ? (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">IGST</span>
                                                        <span className="text-gray-900">+ ₹{totals.totalGst.toFixed(2)}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">CGST</span>
                                                            <span className="text-gray-900">+ ₹{(totals.totalGst / 2).toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">SGST</span>
                                                            <span className="text-gray-900">+ ₹{(totals.totalGst / 2).toFixed(2)}</span>
                                                        </div>
                                                    </>
                                                )}

                                                <div className="flex justify-between pb-2 border-b border-gray-300">
                                                    <span className="text-gray-500">Total GST</span>
                                                    <span className="text-gray-900">+ ₹{totals.totalGst.toFixed(2)}</span>
                                                </div>

                                                <div className="flex justify-between pt-2">
                                                    <span className="text-base font-bold text-gray-900">Net Amount</span>
                                                    <span className="text-base font-bold text-gray-900">₹{totals.netAmount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── Notes ── */}
                                {(remarks || internalNotes) && (
                                    <>
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Notes</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                            {remarks && <DetailBox label="Remarks" value={remarks} />}
                                            {internalNotes && <DetailBox label="Internal Notes" value={internalNotes} />}
                                        </div>
                                    </>
                                )}

                                {/* ── Form Actions ── */}
                                <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
                                    <CustomButton
                                        text={isSubmitting ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update Draft" : "Save as Draft")}
                                        icon={isSubmitting ? undefined : FaSave}
                                        type="submit"
                                        disabled={isSubmitting || isSubmittingForApproval}
                                        className="!bg-white !text-blue-600 border border-blue-600 hover:!bg-blue-50"
                                    />
                                    <CustomButton
                                        text={isSubmittingForApproval ? "Submitting..." : "Submit for Approval"}
                                        icon={isSubmittingForApproval ? undefined : FaPaperPlane}
                                        type="button"
                                        onClick={handleSubmit((data) => onSubmit(data, true))}
                                        disabled={isSubmitting || isSubmittingForApproval}
                                        className="!bg-blue-600 !text-white hover:!bg-blue-700"
                                    />
                                </div>
                            </>
                        )}
                    </form>


                </div>
            )}
        </div>
    );
};

export default QuotationForm;