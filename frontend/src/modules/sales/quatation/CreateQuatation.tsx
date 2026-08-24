// src/pages/sales/QuotationForm/QuotationForm.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { FaExclamationTriangle } from "react-icons/fa";
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
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { useCustomers } from "../../../hooks/useCustomers";
import { useProducts } from "../../../hooks/useProducts";
import { useEmployees } from "../../../hooks/useEmployees";
import { salesOrderService, type SalesOrder } from "../../../services/salesOrderService";
import { customerService } from "../../../services/customerService";
import {
    DISPATCH_TYPE_OPTIONS,
    ORDER_TYPE_OPTIONS,
    ORDER_SOURCE_OPTIONS,
    ORDER_SOURCE_NEEDS_EMPLOYEE,
    ORDER_SOURCE_NEEDS_REFERRAL,
    ORDER_SOURCE_NEEDS_DEALER,
} from "../../../constants/selectOption";
import { useAppSelector } from "../../../hooks/reduxHooks";
import { usePermission } from "../../../hooks/usePermission";
import AdditionalChargesTable, {
    type ChargeRow,
    DEFAULT_CHARGE_OPTIONS as CHARGE_OPTIONS,
    serializeChargeRowsToNarration,
    computeChargeTotals,
} from "../../../components/sales/AdditionalChargesTable";



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
});

const quotationSchema = z.object({
    id: z.number().optional(),
    quotationNo: z.string().min(1, "Quotation No is required"),
    quotationDate: z.string().min(1, "Quotation Date is required"),
    validUntil: z.string().optional(),
    customerId: z.string().min(1, "Customer is required"),
    mobile: z.string().optional().nullable(),
    orderSource: z.string().optional().nullable(),
    sourceEmployeeId: z.string().optional().nullable(),
    referredByCustomerId: z.string().optional().nullable(),
    referredByName: z.string().optional().nullable(),
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
    mobile: "",
    orderSource: "",
    sourceEmployeeId: null,
    referredByCustomerId: null,
    referredByName: null,
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
        gstRate: "", cessRate: "",
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

    const docNoLabel = "Quotation No";
    const docNoPrefix = "QT";
    const [gstEnabled, setGstEnabled] = useState<boolean>(true);

    // ─── State ──────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingOrder, setLoadingOrder] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [quotationId, setQuotationId] = useState<number | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string | null>(null);

    const [mobile, setMobile] = useState<string | null>(null);
    const [customerOrders, setCustomerOrders] = useState<SalesOrder[]>([]);
    const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);
    const [selectedPrevOrderId, setSelectedPrevOrderId] = useState<number | null>(null);

    // ── Read-only order metadata ──
    const [dispatchType, setDispatchType] = useState<string | null>(null);
    const [orderType, setOrderType] = useState<string | null>(null);
    const [salesPersonId, setSalesPersonId] = useState<string | null>(null);
    const [transportName, setTransportName] = useState<string | null>(null);

    // ── Additional charges / deductions (dynamic rows) ──
    const [chargeRows, setChargeRows] = useState<ChargeRow[]>([]);

    // ── Draft orders dropdown ──
    const [draftOrders, setDraftOrders] = useState<SalesOrder[]>([]);
    const [loadingDraftOrders, setLoadingDraftOrders] = useState(false);
    const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
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
    const company = useAppSelector((state: any) => state.company.data);
    const companyState = company?.state;

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

    const employeeOptions = useMemo(() =>
        employees.map((e: any) => ({
            value: String(e.id),
            label: `${e.fullName || e.name || 'Employee'} (${e.empCode || `EMP #${e.id}`})`,
        })),
        [employees]
    );

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
                ? "Loading sales orders..."
                : customerOrders.length > 0
                ? "-- Select Sales Order --"
                : "-- No pending sales orders --"
        },
        ...customerOrders.map((o: any) => {
            const dateStr = o.orderDate
                ? new Date(o.orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                : null;
            const itemCount = Array.isArray(o.items) ? o.items.length : null;
            const itemsStr = itemCount != null ? ` (${itemCount} ${itemCount === 1 ? "Item" : "Items"})` : "";
            const formattedDate = dateStr ? ` · ${dateStr}` : "";
            return {
                value: String(o.id),
                label: `${o.orderNo}${formattedDate}${itemsStr}`,
            };
        }),
    ], [customerOrders, loadingCustomerOrders]);

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
                const finalGst = combinedGstRate > 0
                    ? combinedGstRate
                    : (item.gstRate != null && Number(item.gstRate) > 0
                        ? Number(item.gstRate)
                        : (product?.gstRate && Number(product.gstRate) > 0 ? Number(product.gstRate) : 18));
                return {
                    productId: String(item.productId || ""),
                    quantity: String(item.quantity || ""),
                    unitPrice: itemRate > 0 ? String(itemRate) : (gradedPrice > 0 ? String(gradedPrice) : ""),
                    mrp: item.mrp != null ? String(item.mrp) : "",
                    b2b: item.b2b != null ? String(item.b2b) : "",
                    b2c: item.b2c != null ? String(item.b2c) : "",
                    exportPrice: item.exportPrice != null ? String(item.exportPrice) : "",
                    gstRate: String(finalGst),
                    cessRate: item.cessRate != null ? String(item.cessRate) : "0",
                };
            })
            : [{
                productId: "", quantity: "", unitPrice: "",
                mrp: "", b2b: "", b2c: "", exportPrice: "",
                gstRate: "", cessRate: "",
            }];

        reset({
            id: order.id,
            quotationNo: order.orderNo,
            quotationDate: order.orderDate?.split("T")[0] || today,
            validUntil: (order as any).expectedCompletionDate?.split("T")[0] || "",
            customerId: String(order.customerId || ""),
            mobile: order.mobile || "",
            orderSource: (order as any).orderSource || "",
            sourceEmployeeId: (order as any).sourceEmployeeId ? String((order as any).sourceEmployeeId) : null,
            referredByCustomerId: (order as any).referredByCustomerId ? String((order as any).referredByCustomerId) : null,
            referredByName: (order as any).referredByName || "",
            paymentTermId: (order as any).paymentTermId?.toString() || "",
            billingAddressLine1: billing.line1,
            billingCity: billing.city,
            billingState: billing.state,
            billingPincode: billing.pincode,
            sameAsBilling: (order as any).sameAsBilling || false,
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

        // Restore additional charges stored in narration JSON
        try {
            const raw = (order as any).narration || "";
            const parsed = raw.startsWith("{") ? JSON.parse(raw) : null;
            if (parsed?.__chargeRows__) {
                setChargeRows(
                    (parsed.__chargeRows__ as { type: string; amount: number }[]).map(r => ({
                        id: `${Date.now()}-${Math.random()}`,
                        type: r.type,
                        amount: String(r.amount),
                    }))
                );
            } else if (parsed?.__charges__) {
                const ch = parsed.__charges__ as Record<string, number>;
                const MAP: { key: string; type: string }[] = [
                    { key: 'lorryFreight',  type: 'LORRY_FREIGHT'   },
                    { key: 'othersPlus',    type: 'OTHERS_PLUS'     },
                    { key: 'othersMinus',   type: 'OTHERS_MINUS'    },
                    { key: 'roundOffPlus',  type: 'ROUND_OFF_PLUS'  },
                    { key: 'roundOffMinus', type: 'ROUND_OFF_MINUS' },
                    { key: 'tds',           type: 'TDS'             },
                ];
                const rows: ChargeRow[] = MAP.filter(m => Number(ch[m.key]) > 0).map(m => ({
                    id: `${Date.now()}-${Math.random()}`,
                    type: m.type,
                    amount: String(ch[m.key]),
                }));
                setChargeRows(rows);
            } else {
                setChargeRows([]);
            }
        } catch { /* ignore parse errors */ }

        setRejectionReason((order as any).mdRejectionReason || null);
        setIsEditMode(true);
        setQuotationId(order.id);

        setDispatchType((order as any).dispatchType || null);
        setOrderType((order as any).orderType || null);
        setSalesPersonId((order as any).salesPersonId != null ? String((order as any).salesPersonId) : null);
        setTransportName((order as any).transportName || null);
        setMobile(order.mobile || null);
    };

    // ── Load order ──
    useEffect(() => {
        const state = location.state as any;
        // Edit target: prefer the URL param (survives refresh), fall back to nav state
        const editId = idParam ? Number(idParam) : (state?.id ? Number(state.id) : null);
        const reuseId = !idParam && state?.reuseOrderId ? Number(state.reuseOrderId) : null;

        if (reuseId) {
            setIsEditMode(false);
            setQuotationId(null);
            setRejectionReason(null);
            setDispatchType(null);
            setOrderType(null);
            setSalesPersonId(null);
            setMobile(null);
            setSelectedDraftId(null);

            const loadReuseOrder = async () => {
                setLoadingOrder(true);
                try {
                    const order = await salesOrderService.fetchById(reuseId);
                    populateFormFromOrder(order);
                    // Reset to create mode with fresh quotation number
                    setIsEditMode(false);
                    setQuotationId(null);
                    const orderNo = await salesOrderService.getNextOrderNo();
                    const qtNo = orderNo.replace('SO', docNoPrefix);
                    setValue("quotationNo", qtNo);
                    setValue("quotationDate", new Date().toISOString().split("T")[0]);
                    toast.info(`Quotation details reused from ${order.orderNo}`);
                } catch (error) {
                    toast.error("Failed to load quotation for reuse");
                } finally {
                    setLoadingOrder(false);
                }
            };
            loadReuseOrder();
            return;
        }

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
    }, [location, idParam, reset, navigate]);

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
        if (can("employees.view")) loadEmployees({ limit: 500 });
    }, [loadCustomers, loadProducts, loadEmployees, can]);

    // ─── Clear source sub-fields when orderSource changes ───
    const orderSource = watch("orderSource");
    useEffect(() => {
        if (!ORDER_SOURCE_NEEDS_EMPLOYEE.includes(orderSource ?? "")) {
            setValue("sourceEmployeeId", null);
        }
        if (!ORDER_SOURCE_NEEDS_REFERRAL.includes(orderSource ?? "")) {
            setValue("referredByCustomerId", null);
        }
        if (!ORDER_SOURCE_NEEDS_REFERRAL.includes(orderSource ?? "") && !ORDER_SOURCE_NEEDS_DEALER.includes(orderSource ?? "")) {
            setValue("referredByName", null);
        }
    }, [orderSource, setValue]);

    // Auto-fill mobile from selected customer if empty
    useEffect(() => {
        if (customerId) {
            const cust = customers.find(c => String(c.id) === customerId);
            if (cust) {
                const mob = Array.isArray(cust.mobile) && cust.mobile.length > 0
                    ? cust.mobile[0].number
                    : typeof cust.mobile === "string" ? cust.mobile : "";
                if (mob && !getValues("mobile")) {
                    setValue("mobile", mob);
                }
            }
        }
    }, [customerId, customers, getValues, setValue]);

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
                // getSourceOrders always queries the GST SalesOrder table and
                // returns only CONFIRMED orders — so already-quoted orders
                // (QUOTATION_IN_PROGRESS, etc.) are never shown here.
                const orders = await salesOrderService.getSourceOrders(customerId);
                setCustomerOrders(orders);
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
                    gstRate = Number(product.gstRate) > 0 ? Number(product.gstRate) : 18;
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
        if (isNaN(gstRate)) gstRate = 18;
        if (isNaN(cessRate)) cessRate = 0;

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
        const gstAmount = gstEnabled ? (base.subtotal * base.gstRate) / 100 : 0;
        const cessAmount = gstEnabled ? (base.subtotal * base.cessRate) / 100 : 0;
        const totalWithGst = base.subtotal + gstAmount + cessAmount;
        return { ...base, gstAmount, cessAmount, totalWithGst, discountAmount: 0 };
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

        if (gstEnabled && subtotal > 0) {
            for (const b of bases) {
                const share = b.subtotal / subtotal;
                const itemDiscount = totalDiscount * share;
                const taxableValue = b.subtotal - itemDiscount;
                totalGst += (taxableValue * b.gstRate) / 100;
                totalCess += (taxableValue * b.cessRate) / 100;
            }
        }

        const { additions, deductions } = computeChargeTotals(chargeRows);
        const netAmount = subtotal - totalDiscount + totalGst + totalCess + additions - deductions;

        return { subtotal, totalDiscount, totalGst, totalCess, netAmount, additions, deductions };
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

            if ((order as any).orderSource) setValue("orderSource", (order as any).orderSource);
            if ((order as any).sourceEmployeeId) setValue("sourceEmployeeId", String((order as any).sourceEmployeeId));
            if ((order as any).referredByCustomerId) setValue("referredByCustomerId", String((order as any).referredByCustomerId));
            if ((order as any).referredByName) setValue("referredByName", (order as any).referredByName);
            if (order.mobile) setValue("mobile", order.mobile);

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
                const itemGst = item.gstRate != null && Number(item.gstRate) > 0
                    ? Number(item.gstRate)
                    : (product?.gstRate && Number(product.gstRate) > 0 ? Number(product.gstRate) : 18);
                return {
                    productId: String(item.productId || ""),
                    quantity: String(item.quantity || "1"),
                    unitPrice: itemRate > 0 ? String(itemRate) : "",
                    mrp: product ? String(product.mrp ?? gradedPrice) : "",
                    b2b: product ? String(product.b2b ?? gradedPrice) : "",
                    b2c: product ? String(product.b2c ?? "") : "",
                    exportPrice: product ? String(product.exportPrice ?? "") : "",
                    gstRate: String(itemGst),
                    cessRate: item.cessRate != null ? String(item.cessRate) : (product ? String(product.cess ?? "") : ""),
                };
            });
            setValue("items", newItems);

            // ── Carry over order-level discount from the selected order ──
            if ((order as any).orderDiscountType) {
                setValue("orderDiscountType", (order as any).orderDiscountType);
            }
            if ((order as any).orderDiscountValue != null) {
                setValue("orderDiscountValue", String((order as any).orderDiscountValue));
            }

            // ── Carry over additional charges stored in narration ──
            try {
                const raw = (order as any).narration || "";
                const parsed = raw.startsWith("{") ? JSON.parse(raw) : null;
                if (parsed?.__chargeRows__) {
                    setChargeRows(
                        (parsed.__chargeRows__ as { type: string; amount: number }[]).map(r => ({
                            id: `${Date.now()}-${Math.random()}`,
                            type: r.type,
                            amount: String(r.amount),
                        }))
                    );
                } else if (parsed?.__charges__) {
                    const ch = parsed.__charges__;
                    const MAP: { key: string; type: string }[] = [
                        { key: 'lorryFreight',  type: 'LORRY_FREIGHT'   },
                        { key: 'othersPlus',    type: 'OTHERS_PLUS'     },
                        { key: 'othersMinus',   type: 'OTHERS_MINUS'    },
                        { key: 'roundOffPlus',  type: 'ROUND_OFF_PLUS'  },
                        { key: 'roundOffMinus', type: 'ROUND_OFF_MINUS' },
                        { key: 'tds',           type: 'TDS'             },
                    ];
                    const rows: ChargeRow[] = MAP.filter(m => Number(ch[m.key]) > 0).map(m => ({
                        id: `${Date.now()}-${Math.random()}`,
                        type: m.type,
                        amount: String(ch[m.key]),
                    }));
                    setChargeRows(rows);
                } else {
                    setChargeRows([]);
                }
            } catch { /* ignore parse errors */ }

            toast.success(`Loaded ${newItems.length} item(s) from order ${order.orderNo}`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to load order items");
        }
    };

    // ─── Submit Handler ────────────────────────────────────────
    const [isConfirming, setIsConfirming] = useState(false);

    const onSubmit = async (data: QuotationFormValues, confirm: boolean = false) => {
        if (confirm) setIsConfirming(true);
        else setIsSubmitting(true);

        try {

            // Pass unitPrice if manually specified.
            // When GST is disabled (estimated mode without "Include GST"), strip GST entirely.
            const transformedItems = data.items.map(item => {
                const totalRate = gstEnabled ? (Number(item.gstRate) || 0) : 0;
                return {
                    productId: Number(item.productId),
                    quantity: Number(item.quantity),
                    unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
                    ...(gstEnabled && totalRate > 0 && {
                        cgstRate: data.isInterState ? 0 : totalRate / 2,
                        sgstRate: data.isInterState ? 0 : totalRate / 2,
                        igstRate: data.isInterState ? totalRate : 0,
                    }),
                };
            });

            // idParam from the URL is the single source of truth for edit mode.
            // State/refs can lag on HMR remounts; the URL param never lies.
            const currentIsEditMode = Boolean(idParam);
            const currentQuotationId = idParam ? Number(idParam) : null;

            const payload: any = {
                orderNo: data.quotationNo,
                orderDate: new Date(data.quotationDate).toISOString(),
                sourceSalesOrderId: (!currentIsEditMode && selectedPrevOrderId) ? selectedPrevOrderId : undefined,
                expectedCompletionDate: data.validUntil ? new Date(data.validUntil).toISOString() : undefined,
                customerId: data.customerId,
                mobile: data.mobile || null,
                orderSource: data.orderSource || null,
                sourceEmployeeId: (ORDER_SOURCE_NEEDS_EMPLOYEE.includes(data.orderSource ?? "") && data.sourceEmployeeId)
                    ? String(data.sourceEmployeeId)
                    : null,
                referredByCustomerId: (ORDER_SOURCE_NEEDS_REFERRAL.includes(data.orderSource ?? "") && data.referredByCustomerId)
                    ? String(data.referredByCustomerId)
                    : null,
                referredByName: (ORDER_SOURCE_NEEDS_REFERRAL.includes(data.orderSource ?? "") || ORDER_SOURCE_NEEDS_DEALER.includes(data.orderSource ?? ""))
                    ? (data.referredByName?.trim() || null)
                    : null,
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
                narration: serializeChargeRowsToNarration(chargeRows),
                items: transformedItems,
                orderDiscountType: data.orderDiscountType,
                orderDiscountValue: data.orderDiscountValue,
                status: confirm ? "CONFIRMED" : "DRAFT",
            };

            let response;

            if (currentIsEditMode && currentQuotationId) {
                response = await salesOrderService.update(currentQuotationId, payload);
            } else {
                response = await salesOrderService.create(payload);
            }

            const orderId = currentIsEditMode ? currentQuotationId! : response.id;

            if (confirm) {
                toast.success("Quotation confirmed successfully!");
                navigate("/quatation-order");
            } else {
                toast.success(currentIsEditMode ? "Quotation updated as draft!" : "Quotation saved as draft!");
                navigate("/quatation-order");
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to save quotation");
        } finally {
            setIsSubmitting(false);
            setIsConfirming(false);
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
                                    {isEditMode ? "Edit Quotation" : "Create Quotation"}
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
                                <div className={`grid grid-cols-1 sm:grid-cols-2 ${!isEditMode ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}>
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
                                            <CtrlText field={f} label="Quotation Date" type="date" disabled error={errors.quotationDate?.message} />
                                        )}
                                    />
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
                                            label="Select Sales Order"
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

                                {/* ── Items Table Header with Include GST Checkbox ── */}
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-base font-semibold text-ink">Quotation Items</h3>
                                    <label className="inline-flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg bg-card-2 border border-line-soft hover:bg-card transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={gstEnabled}
                                            onChange={(e) => setGstEnabled(e.target.checked)}
                                            className="w-4 h-4 rounded text-primary focus:ring-primary focus:ring-offset-0 bg-transparent border-line cursor-pointer"
                                        />
                                        <span className="text-sm font-medium text-ink">Include GST</span>
                                    </label>
                                </div>
                                {errors.items?.root && (
                                    <div className="text-red-500 text-sm mb-3">{errors.items.root.message}</div>
                                )}
                                <div className="border border-line-soft rounded-xl overflow-visible mb-4 bg-card shadow-xs">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-card-2 border-b border-line-soft">
                                                <th className="py-3 pl-4 pr-2 text-left text-[11px] font-bold text-ink-muted uppercase tracking-wide w-[4%]">#</th>
                                                <th className="py-3 px-2 text-left text-[11px] font-bold text-ink-muted uppercase tracking-wide w-[24%]">Product</th>
                                                <th className="py-3 px-2 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-[10%]">Qty</th>
                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-ink-muted uppercase tracking-wide w-[11%]">Unit Price</th>
                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-ink-muted uppercase tracking-wide w-[11%]">Subtotal</th>
                                                {gstEnabled && (
                                                    <th className="py-3 px-2 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-[11%]">GST (%)</th>
                                                )}
                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-ink-muted uppercase tracking-wide w-[15%]">
                                                    {gstEnabled ? "Total (Inc. GST)" : "Total"}
                                                </th>
                                                <th className="py-3 px-2 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-[8%]">Remove</th>
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
                                                const rowGstAmount = rowCalc.gstAmount;
                                                const rowTotalWithGst = rowCalc.totalWithGst;
                                                return (
                                                    <tr key={field.id} className="border-b border-line-soft last:border-b-0 bg-card hover:bg-card-2/40">
                                                        <td className="py-3 pl-4 pr-2 text-ink font-medium">{index + 1}</td>
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
                                                                                const prodGst = product.gstRate != null && Number(product.gstRate) > 0 ? String(product.gstRate) : "18";
                                                                                setValue(`items.${index}.gstRate`, prodGst);
                                                                                setValue(`items.${index}.cessRate`, String(product.cess ?? ""));
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
                                                        <td className="py-3 px-2 text-right font-semibold text-ink">
                                                            {rowSubtotal > 0 ? `₹${rowSubtotal.toFixed(2)}` : "—"}
                                                        </td>
                                                        {gstEnabled && (
                                                            <td className="py-2 px-2 min-w-[7rem]">
                                                                <Controller
                                                                    name={`items.${index}.gstRate`}
                                                                    control={control}
                                                                    render={({ field: f }) => (
                                                                        <TextInput
                                                                            name={f.name}
                                                                            type="number"
                                                                            value={f.value !== undefined && f.value !== "" ? f.value : "18"}
                                                                            onChange={f.onChange}
                                                                            min={0}
                                                                            max={100}
                                                                            step={0.01}
                                                                            placeholder="0"
                                                                        />
                                                                    )}
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="py-3 px-2 text-right font-bold text-ink whitespace-nowrap">
                                                            {rowSubtotal > 0 ? (
                                                                <div>
                                                                    <span className="text-emerald-500 font-semibold">
                                                                        ₹{rowTotalWithGst.toFixed(2)}
                                                                    </span>
                                                                    {gstEnabled && rowGstAmount > 0 && (
                                                                        <span className="block text-[10px] text-ink-subtle font-normal">
                                                                            (+₹{rowGstAmount.toFixed(2)} GST)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </td>
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
                                {/* ── Additional Charges + Discount + Totals ── */}
                                {fields.length > 0 && (
                                    <div className="flex flex-row gap-4 mb-4 items-start">
                                        {/* ── Left: Additional Charges Table ── */}
                                        <AdditionalChargesTable
                                            rows={chargeRows}
                                            onChange={setChargeRows}
                                        />

                                        {/* ── Right: Discount + Totals Summary ── */}
                                        <div className="w-80 shrink-0 border border-line rounded-xl p-4 bg-card-2 self-start">
                                            <div className="flex items-center justify-between gap-4 mb-3">
                                                <span className="text-xs font-bold text-ink uppercase tracking-wide">Discount (%)</span>
                                                <div className="w-32">
                                                    <Controller
                                                        name="orderDiscountValue"
                                                        control={control}
                                                        render={({ field: f }) => (
                                                            <TextInput
                                                                name={f.name}
                                                                type="number"
                                                                value={String(f.value ?? "")}
                                                                onChange={f.onChange}
                                                                onBlur={f.onBlur}
                                                                placeholder="0"
                                                                min={0}
                                                                max={100}
                                                                step={1}
                                                                inputClassName="!bg-card !border !border-line hover:!border-primary/60 focus:!border-primary text-ink font-bold text-right px-3 py-1.5 shadow-sm rounded-lg"
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

                                                {/* ── Active charge row summaries ── */}
                                                {chargeRows.filter(r => Number(r.amount) > 0).map(row => {
                                                    const opt = CHARGE_OPTIONS.find(o => o.value === row.type);
                                                    const isAdd = opt?.sign === 1;
                                                    return (
                                                        <div key={row.id} className={`flex justify-between text-xs ${isAdd ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            <span>{opt?.label ?? row.type}</span>
                                                            <span>{isAdd ? '+ ' : '- '}₹{Number(row.amount).toFixed(2)}</span>
                                                        </div>
                                                    );
                                                })}

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
                                        text={isSubmitting ? "Saving..." : (isEditMode ? "Update Draft" : "Save as Draft")}
                                        variant="secondary"
                                        type="submit"
                                        disabled={isSubmitting || isConfirming}
                                    />
                                    <CustomButton
                                        text={isConfirming ? "Confirming..." : "Confirm Order"}
                                        variant="primary"
                                        type="button"
                                        onClick={handleSubmit((data) => onSubmit(data, true))}
                                        disabled={isSubmitting || isConfirming}
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