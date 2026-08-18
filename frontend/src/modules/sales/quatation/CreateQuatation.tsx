// src/pages/sales/QuotationForm/QuotationForm.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { FaSave, FaPaperPlane, FaCircleNotch, FaExclamationTriangle, FaUser, FaCalendarAlt, FaTruck, FaGlobe, FaMapMarkerAlt, FaFileAlt, FaPhone } from "react-icons/fa";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DetailBox from "../../../components/ui/DetailBox/DetailBox";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { useCustomers } from "../../../hooks/useCustomers";
import { useProducts } from "../../../hooks/useProducts";
import { useEmployees } from "../../../hooks/useEmployees";
import { salesOrderService, type SalesOrder } from "../../../services/salesOrderService";
import { customerService } from "../../../services/customerService";
import { DISPATCH_TYPE_OPTIONS, ORDER_TYPE_OPTIONS } from "../../../constants/selectOption";
import { fetchGstTaxes, selectActiveGstTaxes } from "../../../features/gst/gstSlice";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { useSelector } from "react-redux";
import { usePermission } from "../../../hooks/usePermission";



// ─── Zod Schema ─────────────────────────────────────────────────────────────
// No per-item discount fields — discount is now ONLY at order level.
const orderItemSchema = z.object({
    productId: z.string().min(1, "Product is required"),
    quantity: z
        .string()
        .min(1, "Required")
        .refine(v => !isNaN(Number(v)) && Number(v) > 0, { message: "Must be > 0" }),

    unitPrice: z.string().optional(),
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
    validUntil: z.string().optional(),
    customerId: z.string().min(1, "Customer is required"),
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

const defaultValues: QuotationFormValues = {
    id: undefined,
    quotationNo: "",
    quotationDate: today,
    validUntil: undefined,
    customerId: "",
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
        productId: "", quantity: "", unitPrice: "",
        mrp: "", b2b: "", b2c: "", exportPrice: "",
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
    bottom?: boolean;
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

const CtrlText: React.FC<CtrlTextProps> = ({ field, label, placeholder, required, type, disabled, error, bottom }) => (
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
        bottom={bottom}
    />
);

// ─── Component ─────────────────────────────────────────────────────────────
const QuotationForm: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: idParam } = useParams<{ id: string }>();
    const { can, isSuperAdmin, permissions } = usePermission();

    // ── Estimate User: Holds sales-orders.view-estimate AND NOT sales-orders.view-gst ──
    //    Estimate users get Create Estimate, DO No, DO Date, Estimate Items, WITH Include GST checkbox.
    const isEstimateUser = !isSuperAdmin && permissions.includes("sales-orders.view-estimate") && !permissions.includes("sales-orders.view-gst");

    // ── GST User: Everyone else (Super Admin, GST users, or non-estimate users) ──
    //    GST users get Create Quotation, Quotation No, Quotation Date, Quotation Items, NO Include GST checkbox, compulsory GST.
    const isGstUser = !isEstimateUser;

    // ── GST toggle — only relevant for estimated users. GST users always have GST on.
    const [includeGstInEstimate, setIncludeGstInEstimate] = useState(false);
    const gstEnabled = isGstUser || includeGstInEstimate;

    // ── Doc number label: estimated users see "DO No", GST users see "Quotation No"
    const docNoLabel = isEstimateUser ? "DO No" : "Quotation No";
    const docNoPrefix = isEstimateUser ? "DO" : "QT";

    // ─── State ──────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingOrder, setLoadingOrder] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [quotationId, setQuotationId] = useState<number | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string | null>(null);
    const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);
    const [mobile, setMobile] = useState<string | null>(null);
    const [customerOrders, setCustomerOrders] = useState<SalesOrder[]>([]);
    const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);
    const [selectedPrevOrderId, setSelectedPrevOrderId] = useState<number | null>(null);

    // ── Read-only order metadata ──
    const [dispatchType, setDispatchType] = useState<string | null>(null);
    const [orderType, setOrderType] = useState<string | null>(null);
    const [salesPersonId, setSalesPersonId] = useState<string | null>(null);
    const [transportName, setTransportName] = useState<string | null>(null);

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

    const { fields, append, remove } = useFieldArray({
        control,
        name: "items",
    });

    const { loadCustomers, customers, loading: customersLoading } = useCustomers();
    const { loadProducts, products, loading: productsLoading } = useProducts();
    const { employees, loadEmployees } = useEmployees();

    // Always-current ref so async callbacks (loadOrder, handleDraftOrderSelect)
    // read the latest products even if they captured a stale closure.
    const productsRef = useRef(products);
    useEffect(() => { productsRef.current = products; }, [products]);

    // Refs for isEditMode and quotationId — prevents stale-closure bugs in onSubmit
    // (same pattern as productsRef above).
    const isEditModeRef = useRef(isEditMode);
    const quotationIdRef = useRef<number | null>(quotationId);
    useEffect(() => { isEditModeRef.current = isEditMode; }, [isEditMode]);
    useEffect(() => { quotationIdRef.current = quotationId; }, [quotationId]);

    // ── Watch values ──
    const items = watch("items");
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

    const productsOptions = useMemo(() => [
        { value: "", label: productsLoading ? "Loading products..." : "-- Select Product --" },
        ...products.map((p: any) => ({
            value: String(p.id),
            label: p.productName || p.productCode || String(p.id),
        })),
    ], [products, productsLoading]);

    const customerOptions = useMemo(() => [
        { value: "", label: customersLoading ? "Loading customers..." : "-- Select Customer --" },
        ...customers.map((c: any) => {
            const name = c.displayName || c.firmName || String(c.id);
            const type = c.customerType?.name;
            const grade = c.customerGrade?.name;
            const location = c.billingCity || c.billingState;
            const tags = [
                type ? `(${type})` : null,
                grade ? `[${grade.charAt(0).toUpperCase()}]` : null,
                location || null,
            ].filter(Boolean).join(" · ");
            return { value: String(c.id), label: tags ? `${name} ${tags}` : name };
        }),
    ], [customers, customersLoading]);

    const prevOrderOptions = useMemo(() => [
        {
            value: "",
            label: loadingCustomerOrders
                ? "Loading previous orders..."
                : customerOrders.length > 0
                ? "-- Select a previous order --"
                : "-- No previous orders found --"
        },
        ...customerOrders.map((o: any) => ({
            value: String(o.id),
            label: `${o.orderNo} — ${o.status}`,
        })),
    ], [customerOrders, loadingCustomerOrders]);

    // Default GST tax (18%) — auto-applied when a product is selected
    const defaultGstTax = useMemo(
        () => (gstTaxes || []).find((t: any) => Number(t.taxRate) === 18) || null,
        [gstTaxes]
    );

    const formatDate = (val?: string | null) => {
        if (!val) return "—";
        return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    const extractBillingAddress = (custOrOrder: any) => {
        if (!custOrOrder) return { line1: "", city: "", state: "", pincode: "" };

        const cust = custOrOrder.customer || custOrOrder;
        const isValid = (val?: any) => val && typeof val === "string" && val.trim() !== "" && val.trim() !== "-";

        let line1 = custOrOrder.billingAddressLine1 || cust?.billingAddressLine1 || "";
        let city = custOrOrder.billingCity || cust?.billingCity || "";
        let state = custOrOrder.billingState || cust?.billingState || "";
        let pincode = custOrOrder.billingPincode || cust?.billingPincode || "";

        if (!isValid(line1) && Array.isArray(cust?.addresses) && cust.addresses.length > 0) {
            const billingObj = cust.addresses.find((a: any) => a.addressType === "BILLING" || a.type === "BILLING") || cust.addresses[0];
            const addr = billingObj?.address || billingObj;
            if (addr) {
                if (!isValid(line1)) line1 = addr.addressLine1 || addr.addressLine || addr.street || "";
                if (!isValid(city)) city = addr.city || "";
                if (!isValid(state)) state = addr.state || "";
                if (!isValid(pincode)) pincode = addr.pincode || addr.zipCode || "";
            }
        }

        return {
            line1: isValid(line1) ? String(line1) : "",
            city: isValid(city) ? String(city) : "",
            state: isValid(state) ? String(state) : "",
            pincode: isValid(pincode) ? String(pincode) : "",
        };
    };

    // ─── Helper: populate form from an order ──────────────────
    const populateFormFromOrder = (order: SalesOrder) => {
        const billing = extractBillingAddress(order);
        const shipping = {
            addressLine1: order.shippingAddressLine1 || "",
            city: order.shippingCity || "",
            state: order.shippingState || "",
            pincode: order.shippingPincode || "",
        };

        const items = order.items && order.items.length > 0
            ? order.items.map((item: any) => {
                // Use productsRef so we always read the latest loaded products
                // even when this function is called inside an async callback.
                const product = productsRef.current.find((p: any) => String(p.id) === String(item.productId));
                const gradedPrice = product ? resolveGradedUnitPrice(product) : 0;
                const itemRate = item.unitPrice ?? item.rate ?? item.estimatedRate ?? (Number(item.quantity) > 0 && Number(item.lineTotal) > 0 ? Number(item.lineTotal) / Number(item.quantity) : gradedPrice);
                // Reconstruct combined GST rate from stored item tax columns
                // (cgst+sgst intra-state, igst inter-state)
                const cgst = Number(item.cgstRate ?? 0);
                const sgst = Number(item.sgstRate ?? 0);
                const igst = Number(item.igstRate ?? 0);
                const combinedGstRate = igst > 0 ? igst : cgst + sgst;
                return {
                    productId: String(item.productId || ""),
                    quantity: String(item.quantity || ""),
                    unitPrice: itemRate > 0 ? String(itemRate) : (gradedPrice > 0 ? String(gradedPrice) : ""),
                    mrp: item.mrp != null ? String(item.mrp) : "",
                    b2b: item.b2b != null ? String(item.b2b) : "",
                    b2c: item.b2c != null ? String(item.b2c) : "",
                    exportPrice: item.exportPrice != null ? String(item.exportPrice) : "",
                    gstRate: combinedGstRate > 0
                        ? String(combinedGstRate)
                        : (item.gstRate != null ? String(item.gstRate) : "0"),
                    cessRate: item.cessRate != null ? String(item.cessRate) : "0",
                    gstTaxRateId: item.gstTaxRateId != null ? String(item.gstTaxRateId) : "",
                };
            })
            : [{
                productId: "", quantity: "", unitPrice: "",
                mrp: "", b2b: "", b2c: "", exportPrice: "",
                gstRate: "", cessRate: "", gstTaxRateId: "",
            }];

        reset({
            id: order.id,
            quotationNo: order.orderNo,
            quotationDate: order.orderDate?.split("T")[0] || today,
            validUntil: order.expectedCompletionDate?.split("T")[0] || "",
            customerId: String(order.customerId || ""),
            paymentTermId: order.paymentTermId?.toString() || "",
            billingAddressLine1: billing.line1,
            billingCity: billing.city,
            billingState: billing.state,
            billingPincode: billing.pincode,
            sameAsBilling: order.sameAsBilling || false,
            isInterState: (order as any).isInterState ?? false,
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
        setTransportName(order.transportName || null);
        setMobile(order.mobile || null);
    };

    // ── Load order ──
    useEffect(() => {
        const state = location.state as any;
        dispatch(fetchGstTaxes({ status: "ACTIVE" }));

        // Edit target: prefer the URL param (survives refresh), fall back to nav state
        const editId = idParam ? Number(idParam) : (state?.id ? Number(state.id) : null);

        if (!editId) {
            setIsEditMode(false);
            setQuotationId(null);
            setRejectionReason(null);
            setDispatchType(null);
            setOrderType(null);
            setSalesPersonId(null);
            setMobile(null);
            reset(defaultValues);
            setSelectedDraftId(null);
            return;
        }

        const loadOrder = async () => {
            setLoadingOrder(true);
            try {
                // Always fetch the FULL order from the API — the list-row state
                // lacks item pricing / customer addresses needed by the form.
                const order = await salesOrderService.fetchById(editId);
                populateFormFromOrder(order);
            } catch (error) {
                toast.error("Failed to load quotation");
                navigate("/quatation-order");
            } finally {
                setLoadingOrder(false);
            }
        };

        loadOrder();
    }, [location, idParam, reset, navigate, dispatch]);

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
        if (can("employees.view")) loadEmployees({});
    }, [loadCustomers, loadProducts, loadEmployees, can]);

    // ─── Fetch customer's previous orders on customer change (create mode only) ──
    useEffect(() => {
        if (!customerId || isEditMode) {
            setCustomerOrders([]);
            setSelectedPrevOrderId(null);
            return;
        }
        const fetchPrevOrders = async () => {
            setLoadingCustomerOrders(true);
            try {
                const res = await salesOrderService.fetchAll({
                    customerId,
                    pageSize: 50,
                });
                setCustomerOrders((res.data || []).filter((o: any) =>
                    ['CONFIRMED', 'QUOTATION_IN_PROGRESS', 'QUOTATION_COMPLETED', 'CUSTOMER_APPROVED', 'MD_APPROVED'].includes(o.status)
                ));
            } catch (_) {
                setCustomerOrders([]);
            } finally {
                setLoadingCustomerOrders(false);
            }
        };
        fetchPrevOrders();
    }, [customerId, isEditMode]);

    // ─── Get Next Quotation Number (Create Mode) ──────────────
    useEffect(() => {
        const state = location.state as any;
        if (state?.id || isEditMode) return;

        salesOrderService.getNextOrderNo().then((orderNo) => {
            const qtNo = orderNo.replace('SO', docNoPrefix);
            setValue("quotationNo", qtNo);
        });
    }, [location, setValue, isEditMode, docNoPrefix]);

    const computedIsInterState = useMemo(() => {
        if (!companyState || !billingState) return false;
        return companyState.toLowerCase().trim() !== billingState.toLowerCase().trim();
    }, [companyState, billingState]);

    useEffect(() => {
        setValue("isInterState", computedIsInterState, { shouldValidate: true });
    }, [computedIsInterState, setValue]);

    // ─── Auto-fill billing from selected customer (create mode) ──
    useEffect(() => {
        if (isEditMode || !customerId) return;

        let isMounted = true;
        const applyAddress = (target: any) => {
            const addr = extractBillingAddress(target);
            if (addr.line1) setValue("billingAddressLine1", addr.line1, { shouldValidate: true });
            if (addr.city) setValue("billingCity", addr.city, { shouldValidate: true });
            if (addr.state) setValue("billingState", addr.state, { shouldValidate: true });
            if (addr.pincode) setValue("billingPincode", addr.pincode, { shouldValidate: true });
        };

        const localCustomer = customers.find((c: any) => String(c.id) === customerId);
        if (localCustomer) {
            applyAddress(localCustomer);
        }

        customerService.fetchById(customerId)
            .then((fullCust) => {
                if (isMounted && fullCust) {
                    applyAddress(fullCust);
                }
            })
            .catch(() => {});

        return () => {
            isMounted = false;
        };
    }, [customerId, customers, isEditMode, setValue]);

    // ─── Calculate totals ────────────────────────────────────
    const resolveUnitPrice = (
        pricing: { b2b?: number | null; mrp?: number | null; b2c?: number | null; exportPrice?: number | null }
    ) => {
        return pricing.b2b ?? pricing.mrp ?? pricing.b2c ?? pricing.exportPrice ?? 0;
    };

    // ─── Resolve customer-grade unit price ───────────────────────────────────────
    // Mirrors the backend's computeLineTotals(): gradeRates[grade] → product.rate → b2b/mrp fallback
    const resolveGradedUnitPrice = useCallback((product: any) => {
        if (!product) return 0;
        const selectedCustomer = customers.find(c => String(c.id) === customerId);
        const customerGrade = (selectedCustomer as any)?.customerGrade;
        const rawGrade = typeof customerGrade === "object" ? (customerGrade?.name || customerGrade?.gradeName || "") : String(customerGrade || "");

        if (rawGrade && product.gradeRates && typeof product.gradeRates === "object") {
            const rates = product.gradeRates as Record<string, number>;
            const gClean = rawGrade.toUpperCase().replace(/[^A-Z0-9]/g, "");
            for (const [k, val] of Object.entries(rates)) {
                const kClean = k.toUpperCase().replace(/[^A-Z0-9]/g, "");
                if (kClean === gClean || kClean.endsWith(gClean) || gClean.endsWith(kClean)) {
                    if (val != null && !isNaN(Number(val)) && Number(val) > 0) {
                        return Number(val);
                    }
                }
            }
        }
        if (product.rate != null && Number(product.rate) > 0) return Number(product.rate);
        return resolveUnitPrice({ b2b: product.b2b, mrp: product.mrp, b2c: product.b2c, exportPrice: product.exportPrice });
    }, [customers, customerId]);

    // ─── Update unit prices for current items when Customer changes ──
    // Skip in edit mode — the saved unit prices from the order must not be
    // overwritten by grade prices when the form first loads.
    useEffect(() => {
        if (idParam) return;   // edit mode: keep saved prices
        if (customerId && items && items.length > 0 && products.length > 0) {
            items.forEach((item: any, index: number) => {
                if (item.productId) {
                    const product = products.find((p: any) => String(p.id) === String(item.productId));
                    if (product) {
                        const gradedPrice = resolveGradedUnitPrice(product);
                        if (gradedPrice > 0) {
                            setValue(`items.${index}.unitPrice`, String(gradedPrice));
                        }
                    }
                }
            });
        }
    }, [idParam, customerId, products, resolveGradedUnitPrice, setValue]);

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

        // Custom entered unit price takes priority; falls back to grade price / rate
        const customUnitPrice = item.unitPrice !== undefined && item.unitPrice !== "" ? Number(item.unitPrice) : NaN;
        const product = products.find((p: any) => String(p.id) === item.productId);
        const gradedPrice = resolveGradedUnitPrice(product);
        const resolvedAutoPrice = gradedPrice > 0
            ? gradedPrice
            : resolveUnitPrice({ b2b, mrp, b2c, exportPrice });

        const unitPrice = !isNaN(customUnitPrice) ? customUnitPrice : resolvedAutoPrice;
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

        // Estimated mode without the "Include GST" checkbox → amount-only calculation
        if (gstEnabled && subtotal > 0) {
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
            setTransportName(null);
            setMobile(null);
            reset(defaultValues);
            salesOrderService.getNextOrderNo().then((orderNo) => {
                const qtNo = orderNo.replace('SO', docNoPrefix);
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

    // ─── Load items from a previous order ────────────────────────────────────────
    const handleLoadFromPrevOrder = async (orderId: number | null) => {
        setSelectedPrevOrderId(orderId);
        if (!orderId) return;
        try {
            const order = await salesOrderService.fetchById(orderId);

            // Populate Billing Address from loaded order / customer
            const billing = extractBillingAddress(order);
            if (billing.line1) setValue("billingAddressLine1", billing.line1, { shouldValidate: true });
            if (billing.city) setValue("billingCity", billing.city, { shouldValidate: true });
            if (billing.state) setValue("billingState", billing.state, { shouldValidate: true });
            if (billing.pincode) setValue("billingPincode", billing.pincode, { shouldValidate: true });

            if (!order.items || order.items.length === 0) {
                toast.info("Selected order has no items.");
                return;
            }
            const newItems = order.items.map((item: any) => {
                const product = products.find((p: any) => String(p.id) === String(item.productId));
                const gradedPrice = product ? resolveGradedUnitPrice(product) : 0;
                const itemRate = gradedPrice > 0
                    ? gradedPrice
                    : (item.unitPrice ?? item.rate ?? item.estimatedRate ?? (Number(item.quantity) > 0 && Number(item.lineTotal) > 0 ? Number(item.lineTotal) / Number(item.quantity) : 0));
                return {
                    productId: String(item.productId || ""),
                    quantity: String(item.quantity || "1"),
                    unitPrice: itemRate > 0 ? String(itemRate) : "",
                    mrp: product ? String(product.mrp ?? gradedPrice) : "",
                    b2b: product ? String(product.b2b ?? gradedPrice) : "",
                    b2c: product ? String(product.b2c ?? "") : "",
                    exportPrice: product ? String(product.exportPrice ?? "") : "",
                    gstRate: item.gstRate != null ? String(item.gstRate) : (product ? String(product.gstRate ?? "") : ""),
                    cessRate: item.cessRate != null ? String(item.cessRate) : (product ? String(product.cess ?? "") : ""),
                    // Keep the order's GST rate if it had one; otherwise default to 18%
                    gstTaxRateId: item.gstTaxRateId != null
                        ? String(item.gstTaxRateId)
                        : (defaultGstTax ? String(defaultGstTax.id) : ""),
                };
            });
            setValue("items", newItems);
            toast.success(`Loaded ${newItems.length} item(s) from order ${order.orderNo}`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to load order items");
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

            // Pass unitPrice if manually specified.
            // When GST is disabled (estimated mode without "Include GST"), strip GST entirely.
            const transformedItems = data.items.map(item => ({
                productId: Number(item.productId),
                quantity: Number(item.quantity),
                unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
                gstTaxRateId: gstEnabled ? (item.gstTaxRateId || undefined) : undefined,
            }));

            // idParam from the URL is the single source of truth for edit mode.
            // State/refs can lag on HMR remounts; the URL param never lies.
            const currentIsEditMode = Boolean(idParam);
            const currentQuotationId = idParam ? Number(idParam) : null;

            const payload: any = {
                orderNo: data.quotationNo,
                orderDate: new Date(data.quotationDate).toISOString(),
                expectedCompletionDate: data.validUntil ? new Date(data.validUntil).toISOString() : undefined,
                customerId: data.customerId,
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
                // Quotations always start in QUOTATION_IN_PROGRESS so they appear
                // in the Quotation List and not in the Sales Order list.
                status: currentIsEditMode ? undefined : "QUOTATION_IN_PROGRESS",
            };

            let response;

            if (currentIsEditMode && currentQuotationId) {
                response = await salesOrderService.update(currentQuotationId, payload);
            } else {
                response = await salesOrderService.create(payload);
            }

            const orderId = currentIsEditMode ? currentQuotationId! : response.id;

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
                await salesOrderService.submitForApproval(orderId);
                toast.success("Quotation submitted for MD approval!");
            } else {
                toast.success(currentIsEditMode ? "Quotation updated successfully!" : "Quotation created successfully as DRAFT!");
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
    const isLoading = customersLoading || productsLoading || loadingOrder;
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
                <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">

                    {/* Page Header */}
                    <div className="px-6 py-4 border-b border-line bg-card-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-ink">
                                    {isEditMode
                                        ? (isEstimateUser ? "Edit Estimate" : "Edit Quotation")
                                        : (isEstimateUser ? "Create Estimate" : "Create Quotation")}
                                </h2>
                            </div>
                            <div>
                                <BackButton text="Back to List" />
                            </div>
                        </div>
                    </div>

                    <form className="p-6 space-y-6" onSubmit={handleSubmit((data) => onSubmit(data, false))} noValidate>
                        {/* ── Rejection banner (edit mode only) ── */}
                        {isEditMode && rejectionReason && (
                            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 flex items-start gap-2">
                                <FaExclamationTriangle className="text-red-500 mt-0.5 text-sm" />
                                <div>
                                    <div className="text-red-800 font-semibold text-xs uppercase tracking-wide">Rejection Reason</div>
                                    <p className="text-red-700 text-sm m-0">{rejectionReason}</p>
                                </div>
                            </div>
                        )}

                        {/* ── Full Editable Form (create & edit) ── */}
                        {(
                            <>
                                {/* ── Order Info ── */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Controller
                                        name="quotationNo"
                                        control={control}
                                        render={({ field: f }) => (
                                            <CtrlText field={f} label={docNoLabel} disabled error={errors.quotationNo?.message} />
                                        )}
                                    />
                                    <Controller
                                        name="quotationDate"
                                        control={control}
                                        render={({ field: f }) => (
                                            <CtrlText field={f} label={isEstimateUser ? "DO Date" : "Quotation Date"} type="date" disabled error={errors.quotationDate?.message} />
                                        )}
                                    />
                                </div>

                                {/* ── Customer & Load from Previous Order (Same Row) ── */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Controller
                                        name="customerId"
                                        control={control}
                                        render={({ field: f }) => (
                                            <SelectInput
                                                label="Customer"
                                                name={f.name}
                                                value={f.value ?? ""}
                                                options={customerOptions}
                                                onChange={f.onChange}
                                                searchable
                                                required
                                                disabled={isEditMode}
                                                error={errors.customerId?.message}
                                            />
                                        )}
                                    />

                                    {!isEditMode && (
                                        <SelectInput
                                            label="Load from previous order"
                                            name="selectedPrevOrderId"
                                            value={selectedPrevOrderId ? String(selectedPrevOrderId) : ""}
                                            options={prevOrderOptions}
                                            onChange={(e: any) => {
                                                const val = typeof e === "object" && e?.target ? e.target.value : String(e);
                                                handleLoadFromPrevOrder(val ? Number(val) : null);
                                            }}
                                            disabled={!customerId || customerOrders.length === 0}
                                        />
                                    )}
                                </div>

                                {/* ── Billing Address ── */}
                                <div>
                                    <h3 className="text-base font-semibold text-ink mb-3">Billing Address</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <Controller name="billingAddressLine1" control={control} render={({ field: f }) => (
                                            <CtrlText field={f} label="Address Line" placeholder="Street / locality" />
                                        )} />
                                        <Controller name="billingCity" control={control} render={({ field: f }) => (
                                            <CtrlText field={f} label="City" placeholder="City" />
                                        )} />
                                        <Controller name="billingState" control={control} render={({ field: f }) => (
                                            <CtrlText field={f} label="State" placeholder="State" />
                                        )} />
                                        <Controller name="billingPincode" control={control} render={({ field: f }) => (
                                            <CtrlText field={f} label="Pincode" placeholder="Pincode" />
                                        )} />
                                    </div>
                                </div>

                                {/* ── Items Table Header with Top-Right Add Product Button ── */}
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-base font-semibold text-ink">{isEstimateUser ? "Estimate Items" : "Quotation Items"}</h3>
                                    <div className="flex items-center gap-4">
                                        {/* GST toggle — estimated users only. GST users always calculate GST. */}
                                        {isEstimateUser && (
                                            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={includeGstInEstimate}
                                                    onChange={(e) => setIncludeGstInEstimate(e.target.checked)}
                                                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                                                />
                                                Include GST
                                            </label>
                                        )}
                                        <CustomButton
                                            text="Add Product"
                                            variant="secondary"
                                            onClick={() => append({ productId: "", quantity: "1", unitPrice: "", mrp: "", b2b: "", b2c: "", exportPrice: "", gstRate: "", cessRate: "", gstTaxRateId: defaultGstTax ? String(defaultGstTax.id) : "" })}
                                        />
                                    </div>
                                </div>
                                {errors.items?.root && (
                                    <div className="text-red-500 text-sm mb-3">{errors.items.root.message}</div>
                                )}
                                <div className="border border-gray-200 rounded-lg overflow-visible mb-4">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="py-3 pl-4 pr-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide w-[4%]">#</th>
                                                <th className="py-3 px-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide w-[28%]">Product</th>
                                                <th className="py-3 px-2 text-center text-[11px] font-bold text-gray-600 uppercase tracking-wide w-[10%]">Qty</th>
                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide w-[12%]">Unit Price</th>
                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide w-[13%]">Subtotal</th>
                                                {gstEnabled && (
                                                    <th className="py-3 px-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide w-[23%]">GST Rate</th>
                                                )}
                                                <th className="py-3 px-2 text-center text-[11px] font-bold text-gray-600 uppercase tracking-wide w-[10%]">Remove</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fields.map((field, index) => {
                                                const itemValue = items?.[index];
                                                const rowProduct = products.find((p: any) => String(p.id) === String(itemValue?.productId));
                                                const rowCalc = calculateItemDisplay(itemValue);
                                                const rowUnitPrice = rowCalc.unitPrice;
                                                const rowQty = Number(itemValue?.quantity) || 0;
                                                const rowSubtotal = rowCalc.subtotal;
                                                return (
                                                    <tr key={field.id} className="border-b border-gray-100 last:border-b-0 bg-white">
                                                        <td className="py-3 pl-4 pr-2 text-gray-700">{index + 1}</td>
                                                        <td className="py-2 px-2 min-w-[12rem]">
                                                            <Controller
                                                                name={`items.${index}.productId`}
                                                                control={control}
                                                                render={({ field: f }) => (
                                                                    <SelectInput
                                                                        hideLabel
                                                                        label=""
                                                                        name={f.name}
                                                                        value={f.value ?? ""}
                                                                        options={productsOptions}
                                                                        onChange={(e) => {
                                                                            f.onChange(e);
                                                                            const productId = (e as any).target ? (e as any).target.value : String(e);
                                                                            const product = products.find((p: any) => String(p.id) === productId);
                                                                            if (product) {
                                                                                const gradedPrice = resolveGradedUnitPrice(product);
                                                                                const autoPrice = gradedPrice > 0 ? gradedPrice : resolveUnitPrice({ b2b: product.b2b, mrp: product.mrp, b2c: product.b2c, exportPrice: product.exportPrice });
                                                                                setValue(`items.${index}.unitPrice`, autoPrice > 0 ? String(autoPrice) : "");
                                                                                setValue(`items.${index}.mrp`, String(product.mrp ?? ""));
                                                                                setValue(`items.${index}.b2b`, String(product.b2b ?? gradedPrice));
                                                                                setValue(`items.${index}.b2c`, String(product.b2c ?? ""));
                                                                                setValue(`items.${index}.exportPrice`, String(product.exportPrice ?? ""));
                                                                                setValue(`items.${index}.gstRate`, String(product.gstRate ?? ""));
                                                                                setValue(`items.${index}.cessRate`, String(product.cess ?? ""));
                                                                                // Default GST to 18% if not already chosen
                                                                                const currentGst = (items?.[index] as any)?.gstTaxRateId;
                                                                                if (!currentGst && defaultGstTax) {
                                                                                    setValue(`items.${index}.gstTaxRateId`, String(defaultGstTax.id));
                                                                                }
                                                                            }
                                                                        }}
                                                                        searchable
                                                                    />
                                                                )}
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2 w-28">
                                                            <Controller
                                                                name={`items.${index}.quantity`}
                                                                control={control}
                                                                render={({ field: f }) => (
                                                                    <TextInput
                                                                        name={f.name}
                                                                        type="number"
                                                                        min="1"
                                                                        preventNegative
                                                                        value={f.value ?? ""}
                                                                        onChange={f.onChange}
                                                                        onBlur={f.onBlur}
                                                                        placeholder="Qty"
                                                                    />
                                                                )}
                                                            />
                                                        </td>
                                                        {/* Unit price — editable input with full text contrast & grade fallback */}
                                                        <td className="py-2 px-2 w-32">
                                                            <Controller
                                                                name={`items.${index}.unitPrice`}
                                                                control={control}
                                                                render={({ field: f }) => (
                                                                    <TextInput
                                                                        name={f.name}
                                                                        type="number"
                                                                        min="0"
                                                                        step="1"
                                                                        preventNegative
                                                                        value={f.value !== undefined && f.value !== "" ? f.value : (rowUnitPrice > 0 ? String(rowUnitPrice) : "")}
                                                                        onChange={f.onChange}
                                                                        onBlur={f.onBlur}
                                                                        placeholder={rowUnitPrice > 0 ? String(rowUnitPrice) : "0.00"}
                                                                    />
                                                                )}
                                                            />
                                                        </td>
                                                        <td className="py-3 px-2 text-right font-medium text-gray-900">
                                                            {rowSubtotal > 0 ? `₹${rowSubtotal.toFixed(2)}` : "—"}
                                                        </td>
                                                        {gstEnabled && (
                                                            <td className="py-2 px-2 min-w-[12rem]">
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
                                                            </td>
                                                        )}
                                                        <td className="py-2 px-2 text-center">
                                                            <DeleteButton
                                                                onClick={() => remove(index)}
                                                                disabled={fields.length <= 1}
                                                                disabledMessage="At least one item is required."
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* ── Discount + Totals ── */}
                                {fields.length > 0 && (
                                    <div className="flex justify-end mb-4">
                                        <div className="w-full max-w-sm border border-line rounded-xl p-4 bg-card-2">
                                            <div className="flex items-end gap-2 mb-3 justify-end">
                                                <div className="w-36">
                                                    <Controller
                                                        name="orderDiscountValue"
                                                        control={control}
                                                        render={({ field: f }) => (
                                                            <CtrlText
                                                                field={{ ...f, value: String(f.value ?? "") }}
                                                                label="Discount (%)"
                                                                type="number"
                                                                placeholder="0"
                                                                bottom={true}
                                                                error={errors.orderDiscountValue?.message}
                                                            />
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 text-sm border-t border-line-soft pt-3">
                                                <div className="flex justify-between text-ink-subtle">
                                                    <span>Subtotal</span>
                                                    <span className="text-ink font-medium">₹{totals.subtotal.toFixed(2)}</span>
                                                </div>

                                                {totals.totalDiscount > 0 && (
                                                    <>
                                                        <div className="flex justify-between text-red-600 font-medium">
                                                            <span>Discount ({orderDiscountValue || 0}%)</span>
                                                            <span>- ₹{totals.totalDiscount.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-ink-subtle text-xs">
                                                            <span>Taxable Amount</span>
                                                            <span className="text-ink font-medium">₹{(totals.subtotal - totals.totalDiscount).toFixed(2)}</span>
                                                        </div>
                                                    </>
                                                )}

                                                {gstEnabled && (isInterState ? (
                                                    <div className="flex justify-between text-ink-subtle">
                                                        <span>IGST</span>
                                                        <span className="text-ink font-medium">+ ₹{totals.totalGst.toFixed(2)}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex justify-between text-ink-subtle">
                                                            <span>CGST</span>
                                                            <span className="text-ink font-medium">+ ₹{(totals.totalGst / 2).toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-ink-subtle">
                                                            <span>SGST</span>
                                                            <span className="text-ink font-medium">+ ₹{(totals.totalGst / 2).toFixed(2)}</span>
                                                        </div>
                                                    </>
                                                ))}

                                                <div className="flex justify-between pt-2 border-t border-line mt-2 text-ink">
                                                    <span className="text-base font-bold">Net Amount</span>
                                                    <span className="text-base font-bold text-blue-600">₹{totals.netAmount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── Form Actions ── */}
                                <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-line-soft">
                                    <CustomButton
                                        text={isSubmitting ? (isEditMode ? "Updating..." : "Saving...") : (isEditMode ? "Update Draft" : "Save as Draft")}
                                        variant="secondary"
                                        type="submit"
                                        disabled={isSubmitting || isSubmittingForApproval}
                                    />
                                    <CustomButton
                                        text={isSubmittingForApproval ? "Submitting..." : "Submit for Approval"}
                                        variant="primary"
                                        type="button"
                                        onClick={handleSubmit((data) => onSubmit(data, true))}
                                        disabled={isSubmitting || isSubmittingForApproval}
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