// src/pages/sales/QuotationForm/QuotationForm.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { salesProductService } from "../../../services/salesProductService";
import { useEmployees } from "../../../hooks/useEmployees";
import { salesOrderService, type SalesOrder } from "../../../services/salesOrderService";
import { customerService } from "../../../services/customerService";
import {
    ORDER_SOURCE_NEEDS_EMPLOYEE,
    ORDER_SOURCE_NEEDS_REFERRAL,
    ORDER_SOURCE_NEEDS_DEALER,
} from "../../../constants/selectOption";
import { useAppSelector } from "../../../hooks/reduxHooks";
import { usePermission } from "../../../hooks/usePermission";



// ─── Zod Schema ─────────────────────────────────────────────────────────────

const componentSchema = z.object({
    componentProductId: z.string(),
    productName: z.string(),
    perUnit: z.number(),
    included: z.boolean(),
    quantity: z.string(),
});

type ComponentItem = z.infer<typeof componentSchema>;

const orderItemSchema = z.object({
    salesProductId: z.string().min(1, "Sales product is required"),
    orderQuantity: z.string().min(1, "Required"),
    unitPrice: z.string().optional(),
    gstRate: z.string().optional(),
    components: z.array(componentSchema),
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
    items: z.array(orderItemSchema).min(1, "At least one sales product is required"),
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
    items: [{ salesProductId: "", orderQuantity: "1", unitPrice: "", gstRate: "", components: [] }],
    remarks: "",
    internalNotes: "",
    orderDiscountType: "PERCENT",
    orderDiscountValue: "",
};

// ─── Build components from a SalesProduct ──
function buildComponents(sp: any, orderQty: number): ComponentItem[] {
    const comps = (sp?.components || []).filter(
        (c: any) => c.componentProduct?.productType === "SALES_PRODUCTION"
    );
    if (comps.length === 0) return [];
    return comps.map((c: any) => ({
        componentProductId: String(c.componentProductId),
        productName: c.componentProduct?.productName || c.componentProduct?.productCode || String(c.componentProductId),
        perUnit: Number(c.quantity || 1),
        included: true,
        quantity: String(Number(c.quantity || 1) * orderQty),
    }));
}

// ─── Compute unit price for a sales product from its component prices ──
function computeSalesProductUnitPrice(sp: any, products: any[]): number {
    const comps = (sp?.components || []).filter(
        (c: any) => c.componentProduct?.productType === "SALES_PRODUCTION"
    );
    if (comps.length === 0) return 0;
    return comps.reduce((sum: number, c: any) => {
        const prod = products.find((p: any) => String(p.id) === String(c.componentProductId));
        const rate = prod ? (Number(prod.rate) || Number(prod.b2b) || Number(prod.mrp) || 0) : 0;
        return sum + rate * Number(c.quantity || 1);
    }, 0);
}

// ─── Reconstruct quotation form items from saved order items ──
function reconstructQuotationItems(orderItems: any[], salesProds: any[], prods: any[]) {
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
        return [{ salesProductId: "", orderQuantity: "1", unitPrice: "", gstRate: "", components: [] }];
    }

    const result: Array<{ salesProductId: string; orderQuantity: string; unitPrice: string; gstRate: string; components: ComponentItem[] }> = [];
    const processedIds = new Set<any>();

    // Group by salesProductId
    const grouped = new Map<string, any[]>();
    orderItems.forEach(oi => {
        const spId = oi.salesProductId ? String(oi.salesProductId) : null;
        if (spId) {
            if (!grouped.has(spId)) grouped.set(spId, []);
            grouped.get(spId)!.push(oi);
        }
    });

    grouped.forEach((items, spIdStr) => {
        const sp = salesProds.find(s => String(s.id) === spIdStr);
        if (!sp) return;
        items.forEach(oi => processedIds.add(oi.id || oi.productId));

        const spComps = (sp?.components || []).filter(
            (c: any) => c.componentProduct?.productType === "SALES_PRODUCTION"
        );
        const firstMatch = items[0];
        const matchingComp = spComps.find((c: any) => String(c.componentProductId) === String(firstMatch.productId));
        const perUnit = Number(matchingComp?.quantity || 1);
        const calcOrderQty = Math.max(1, Math.round(Number(firstMatch.quantity || 1) / perUnit));

        // Get GST rate from first item
        const cgst = Number(firstMatch.cgstRate ?? 0);
        const sgst = Number(firstMatch.sgstRate ?? 0);
        const igst = Number(firstMatch.igstRate ?? 0);
        const gstRate = igst > 0 ? igst : cgst + sgst;

        // Calculate total unit price from component prices
        const totalPrice = items.reduce((sum: number, oi: any) => {
            return sum + (Number(oi.quotationUnitPrice ?? oi.unitPrice ?? 0) * Number(oi.quantity || 0));
        }, 0);
        const unitPricePerOrder = calcOrderQty > 0 ? totalPrice / calcOrderQty : 0;

        const components: ComponentItem[] = spComps.map((c: any) => {
            const oi = items.find(item => String(item.productId) === String(c.componentProductId));
            return {
                componentProductId: String(c.componentProductId),
                productName: c.componentProduct?.productName || c.componentProduct?.productCode || String(c.componentProductId),
                perUnit: Number(c.quantity || 1),
                included: Boolean(oi),
                quantity: oi ? String(oi.quantity) : String(Number(c.quantity || 1) * calcOrderQty),
            };
        });

        result.push({
            salesProductId: spIdStr,
            orderQuantity: String(calcOrderQty),
            unitPrice: unitPricePerOrder > 0 ? String(Math.round(unitPricePerOrder * 100) / 100) : "",
            gstRate: gstRate > 0 ? String(gstRate) : "",
            components,
        });
    });

    // Fallback for items without salesProductId
    const remaining = orderItems.filter(oi => !processedIds.has(oi.id || oi.productId));
    if (remaining.length > 0) {
        salesProds.forEach(sp => {
            const spComps = (sp?.components || []).filter(
                (c: any) => c.componentProduct?.productType === "SALES_PRODUCTION"
            );
            const matching = remaining.filter(oi =>
                !processedIds.has(oi.id || oi.productId) &&
                spComps.some((c: any) => String(c.componentProductId) === String(oi.productId))
            );
            if (matching.length > 0) {
                matching.forEach(oi => processedIds.add(oi.id || oi.productId));
                const first = matching[0];
                const comp = spComps.find((c: any) => String(c.componentProductId) === String(first.productId));
                const perUnit = Number(comp?.quantity || 1);
                const qty = Math.max(1, Math.round(Number(first.quantity || 1) / perUnit));
                const cgst = Number(first.cgstRate ?? 0);
                const sgst = Number(first.sgstRate ?? 0);
                const igst = Number(first.igstRate ?? 0);
                const gstRate = igst > 0 ? igst : cgst + sgst;

                result.push({
                    salesProductId: String(sp.id),
                    orderQuantity: String(qty),
                    unitPrice: "",
                    gstRate: gstRate > 0 ? String(gstRate) : "",
                    components: spComps.map((c: any) => {
                        const oi = matching.find(item => String(item.productId) === String(c.componentProductId));
                        return {
                            componentProductId: String(c.componentProductId),
                            productName: c.componentProduct?.productName || String(c.componentProductId),
                            perUnit: Number(c.quantity || 1),
                            included: Boolean(oi),
                            quantity: oi ? String(oi.quantity) : String(Number(c.quantity || 1) * qty),
                        };
                    }),
                });
            }
        });
    }

    return result.length > 0 ? result : [{ salesProductId: "", orderQuantity: "1", unitPrice: "", gstRate: "", components: [] }];
}

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
    const { can } = usePermission();
    const docNoPrefix = "QT";

    // ─── State ──────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(null);
    const [loadingOrder, setLoadingOrder] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [quotationId, setQuotationId] = useState<number | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string | null>(null);

    const [customerOrders, setCustomerOrders] = useState<SalesOrder[]>([]);
    const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);
    const [selectedPrevOrderId, setSelectedPrevOrderId] = useState<number | null>(null);

    // Used by populateFormFromOrder / load order flow (values set but not displayed)
    const [, setDispatchType] = useState<string | null>(null);
    const [, setOrderType] = useState<string | null>(null);
    const [, setSalesPersonId] = useState<string | null>(null);
    const [, setTransportName] = useState<string | null>(null);
    const [, setMobile] = useState<string | null>(null);
    const [, setDraftOrders] = useState<SalesOrder[]>([]);
    const [, setLoadingDraftOrders] = useState(false);
    const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);

    const [salesProducts, setSalesProducts] = useState<any[]>([]);
    const [salesProductsLoading, setSalesProductsLoading] = useState(false);
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
    const customerId = watch("customerId");
    const orderDiscountType = watch("orderDiscountType");
    const orderDiscountValue = watch("orderDiscountValue");
    const isInterState = watch("isInterState");
    const billingState = watch("billingState");
    const company = useAppSelector((state: any) => state.company.data);
    const companyState = company?.state;

    const salesProductOptions = useMemo(() => [
        { value: "", label: salesProductsLoading ? "Loading..." : "-- Select Sales Product --" },
        ...salesProducts.map((sp: any) => ({
            value: String(sp.id),
            label: sp.salesProductName || sp.salesProductCode || String(sp.id),
        })),
    ], [salesProducts, salesProductsLoading]);

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

        const items = reconstructQuotationItems(order.items || [], salesProducts, productsRef.current);

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

    // ─── Load Customers, Products, SalesProducts & Employees ──────────────
    useEffect(() => {
        loadCustomers();
        loadProducts();
        if (can("employees.view")) loadEmployees({ limit: 500 });
        setSalesProductsLoading(true);
        salesProductService.fetchAll()
            .then((data: any) => setSalesProducts(Array.isArray(data) ? data.filter((sp: any) => sp.isActive !== false) : []))
            .catch(() => setSalesProducts([]))
            .finally(() => setSalesProductsLoading(false));
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

        salesOrderService.getNextQuotationNo().then((quotationNo) => {
            setValue("quotationNo", quotationNo);
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

    // ─── Calculation: per-item base ──
    const calculateItemBase = (item: any) => {
        const orderQty = Number(item.orderQuantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const gstRate = Number(item.gstRate) || 0;
        const subtotal = orderQty * unitPrice;
        return { subtotal, unitPrice, gstRate };
    };

    const calculateItemDisplay = (item: any) => {
        const base = calculateItemBase(item);
        const gstAmount = (base.subtotal * base.gstRate) / 100;
        const totalWithGst = base.subtotal + gstAmount;
        return { ...base, gstAmount, totalWithGst };
    };

    const calculateOrderTotals = () => {
        const bases = (items || [])
            .filter((item: any) => item.salesProductId && item.orderQuantity)
            .map((item: any) => calculateItemBase(item));

        const subtotal = bases.reduce((sum, b) => sum + b.subtotal, 0);

        const discountValueNum = Number(orderDiscountValue) || 0;
        const rawDiscount = orderDiscountType === "PERCENT"
            ? (subtotal * discountValueNum) / 100
            : discountValueNum;
        const totalDiscount = Math.min(rawDiscount, subtotal);

        let totalGst = 0;
        if (subtotal > 0) {
            for (const b of bases) {
                const share = b.subtotal / subtotal;
                const itemDiscount = totalDiscount * share;
                const taxableValue = b.subtotal - itemDiscount;
                totalGst += (taxableValue * b.gstRate) / 100;
            }
        }

        const netAmount = subtotal - totalDiscount + totalGst;
        return { subtotal, totalDiscount, totalGst, netAmount };
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
            salesOrderService.getNextQuotationNo().then((quotationNo) => {
                setValue("quotationNo", quotationNo);
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
            setValue("quotationNo", order.orderNo);
            const newItems = reconstructQuotationItems(order.items || [], salesProducts, products);
            setValue("items", newItems);

            // ── Carry over order-level discount from the selected order ──
            if ((order as any).orderDiscountType) {
                setValue("orderDiscountType", (order as any).orderDiscountType);
            }
            if ((order as any).orderDiscountValue != null) {
                setValue("orderDiscountValue", String((order as any).orderDiscountValue));
            }

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

            // Expand sales products into component-level items
            const transformedItems: any[] = [];
            data.items.forEach(item => {
                const totalRate = Number(item.gstRate) || 0;
                const spId = item.salesProductId ? Number(item.salesProductId) : null;
                const orderQty = Number(item.orderQuantity) || 1;
                const unitPricePerOrder = Number(item.unitPrice) || 0;

                (item.components || [])
                    .filter(c => c.included && Number(c.quantity) > 0)
                    .forEach(c => {
                        // Distribute the unit price proportionally across components
                        const sp = salesProducts.find(s => String(s.id) === item.salesProductId);
                        const spComps = (sp?.components || []).filter((comp: any) => comp.componentProduct?.productType === "SALES_PRODUCTION");
                        const compDef = spComps.find((comp: any) => String(comp.componentProductId) === c.componentProductId);
                        const compRate = compDef?.componentProduct?.rate ?? 0;
                        const totalCompRate = spComps.reduce((sum: number, comp: any) => sum + (Number(comp.componentProduct?.rate ?? 0) * Number(comp.quantity || 1)), 0);
                        const share = totalCompRate > 0 ? (Number(compRate) * Number(compDef?.quantity || 1)) / totalCompRate : 1 / spComps.length;
                        const compUnitPrice = unitPricePerOrder > 0 ? (unitPricePerOrder * share) / (Number(compDef?.quantity || 1)) : undefined;

                        transformedItems.push({
                            productId: Number(c.componentProductId),
                            salesProductId: spId,
                            quantity: Number(c.quantity),
                            quotationUnitPrice: compUnitPrice && compUnitPrice > 0 ? Math.round(compUnitPrice * 100) / 100 : undefined,
                            cgstRate: data.isInterState ? 0 : totalRate / 2,
                            sgstRate: data.isInterState ? 0 : totalRate / 2,
                            igstRate: data.isInterState ? totalRate : 0,
                        });
                    });
            });

            // Use URL param first (survives refresh), fall back to refs
            // (set by handleDraftOrderSelect / populateFormFromOrder).
            const currentIsEditMode = Boolean(idParam) || isEditModeRef.current;
            const currentQuotationId = idParam ? Number(idParam) : quotationIdRef.current;

            const payload: any = {
                orderNo: data.quotationNo,
                orderDate: new Date(data.quotationDate).toISOString(),
                sourceSalesOrderId: selectedPrevOrderId || undefined,
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
                narration: null,
                items: transformedItems,
                orderDiscountType: data.orderDiscountType,
                orderDiscountValue: data.orderDiscountValue,
                status: confirm ? "CONFIRMED" : "DRAFT",
            };

            let response;

            const existingSalesOrderId = currentIsEditMode
                ? currentQuotationId
                : selectedPrevOrderId;

            if (existingSalesOrderId) {
                response = await salesOrderService.update(existingSalesOrderId, payload);
            } else {
                response = await salesOrderService.create(payload);
            }

            const orderId = existingSalesOrderId || response.id;

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
    const isLoading = customersLoading || productsLoading || salesProductsLoading || loadingOrder;
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
                    <div className="px-4 py-3 border-b border-line bg-card-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <h2 className="text-xl font-bold text-ink flex items-start">
                                {isEditMode ? "Edit Quotation" : "Create Quotation"}
                                <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{watch("quotationNo")}</span>
                            </h2>
                            <BackButton text="Back to List" />
                        </div>
                    </div>

                    <form className="p-4" onSubmit={handleSubmit((data) => onSubmit(data, false))} noValidate>
                        <div className="flex flex-col lg:flex-row gap-4">
                        {/* ── Left: Form (75%) ── */}
                        <div className="w-full lg:w-3/4 space-y-4">
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

                                {/* ── Order Info ── */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

                                {/* ── Billing Address (info display) ── */}
                                {(watch("billingAddressLine1") || watch("billingCity") || watch("billingState")) && (
                                    <div className="text-xs text-ink-subtle">
                                        <span className="font-semibold text-ink text-[11px] uppercase tracking-wide mr-2">Billing:</span>
                                        {[watch("billingAddressLine1"), watch("billingCity"), watch("billingState"), watch("billingPincode")].filter(Boolean).join(", ")}
                                    </div>
                                )}

                                {errors.items?.root && (
                                    <div className="text-red-500 text-sm mb-2">{errors.items.root.message}</div>
                                )}

                                {/* Add button when no sales order selected */}
                                {!selectedPrevOrderId && !isEditMode && (
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-semibold text-ink">Quotation Items</span>
                                        <CustomButton
                                            text="Add Sales Product"
                                            variant="secondary"
                                            onClick={() => append({ salesProductId: "", orderQuantity: "1", unitPrice: "", gstRate: "", components: [] })}
                                        />
                                    </div>
                                )}

                                {fields.length > 0 && (
                                    <div className="border border-line-soft rounded-xl overflow-hidden bg-card">
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="bg-card-2 border-b border-line-soft">
                                                    <th className="py-2 pl-3 pr-1 text-left text-[11px] font-bold text-ink-muted uppercase tracking-wide w-8">#</th>
                                                    <th className="py-2 px-1 text-left text-[11px] font-bold text-ink-muted uppercase tracking-wide">Sales Product</th>
                                                    <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-20">Qty</th>
                                                    <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-28">Unit Price</th>
                                                    <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-20">GST %</th>
                                                    <th className="py-2 px-1 text-right text-[11px] font-bold text-ink-muted uppercase tracking-wide w-28">Total</th>
                                                    {!selectedPrevOrderId && !isEditMode && (
                                                        <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-10"></th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {fields.map((field, index) => {
                                                    const itemValue = items?.[index];
                                                    const rowCalc = calculateItemDisplay(itemValue);
                                                    const components: ComponentItem[] = itemValue?.components || [];
                                                    const spName = salesProducts.find((s: any) => String(s.id) === itemValue?.salesProductId)?.salesProductName || "";
                                                    const hasOrder = !!selectedPrevOrderId || isEditMode;

                                                    const handleOrderQtyChange = (qty: string) => {
                                                        setValue(`items.${index}.orderQuantity`, qty);
                                                        const numQty = Math.max(1, Number(qty) || 1);
                                                        const updated = components.map(c => ({
                                                            ...c,
                                                            quantity: String(c.perUnit * numQty),
                                                        }));
                                                        setValue(`items.${index}.components`, updated);
                                                    };

                                                    const handleSalesProductChange = (e: any) => {
                                                        const spId = (e as any).target ? (e as any).target.value : String(e);
                                                        const sp = salesProducts.find((s: any) => String(s.id) === spId);
                                                        setValue(`items.${index}.salesProductId`, spId);
                                                        setValue(`items.${index}.orderQuantity`, "1");
                                                        setValue(`items.${index}.components`, sp ? buildComponents(sp, 1) : []);
                                                        const autoPrice = sp ? computeSalesProductUnitPrice(sp, products) : 0;
                                                        setValue(`items.${index}.unitPrice`, autoPrice > 0 ? String(autoPrice) : "");
                                                        setValue(`items.${index}.gstRate`, "");
                                                    };

                                                    return (
                                                        <React.Fragment key={field.id}>
                                                            <tr className="border-b border-line-soft bg-card hover:bg-card-2/40">
                                                                <td className="py-2 pl-3 pr-1 text-ink-subtle font-medium">{index + 1}</td>
                                                                <td className="py-1 px-1 text-ink font-medium">
                                                                    {hasOrder ? (
                                                                        <span className="flex items-center gap-1 py-1">
                                                                            {components.length > 0 && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setExpandedItemIndex(expandedItemIndex === index ? null : index)}
                                                                                    className="p-0.5 rounded text-ink-subtle hover:text-primary transition-colors"
                                                                                >
                                                                                    {expandedItemIndex === index ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                                </button>
                                                                            )}
                                                                            {spName || "—"}
                                                                        </span>
                                                                    ) : (
                                                                        <SelectInput
                                                                            hideLabel
                                                                            label=""
                                                                            name={`items.${index}.salesProductId`}
                                                                            value={itemValue?.salesProductId || ""}
                                                                            options={salesProductOptions}
                                                                            onChange={handleSalesProductChange}
                                                                            defaultOptionLabel="Select sales product"
                                                                            error={(errors.items as any)?.[index]?.salesProductId?.message}
                                                                            searchable
                                                                        />
                                                                    )}
                                                                </td>
                                                                <td className="py-1 px-1 w-20">
                                                                    <TextInput
                                                                        name={`items.${index}.orderQuantity`}
                                                                        type="number"
                                                                        value={itemValue?.orderQuantity ?? "1"}
                                                                        min="1"
                                                                        preventNegative
                                                                        onChange={e => handleOrderQtyChange(e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-1 w-28">
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
                                                                                value={f.value ?? ""}
                                                                                onChange={f.onChange}
                                                                                onBlur={f.onBlur}
                                                                                placeholder="0"
                                                                            />
                                                                        )}
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-1 w-20">
                                                                    <Controller
                                                                        name={`items.${index}.gstRate`}
                                                                        control={control}
                                                                        render={({ field: f }) => (
                                                                            <TextInput
                                                                                name={f.name}
                                                                                type="number"
                                                                                value={f.value ?? ""}
                                                                                onChange={f.onChange}
                                                                                min={0}
                                                                                max={100}
                                                                                step={0.01}
                                                                                placeholder="0"
                                                                            />
                                                                        )}
                                                                    />
                                                                </td>
                                                                <td className="py-2 px-1 text-right font-bold whitespace-nowrap">
                                                                    {rowCalc.subtotal > 0 ? (
                                                                        <div>
                                                                            <span className="text-emerald-500 text-sm">₹{rowCalc.totalWithGst.toFixed(2)}</span>
                                                                            {rowCalc.gstAmount > 0 && (
                                                                                <span className="block text-[10px] text-ink-subtle">(+₹{rowCalc.gstAmount.toFixed(2)})</span>
                                                                            )}
                                                                        </div>
                                                                    ) : "—"}
                                                                </td>
                                                                {!hasOrder && (
                                                                    <td className="py-1 px-1 w-10 text-center">
                                                                        <DeleteButton
                                                                            onClick={() => remove(index)}
                                                                            disabled={fields.length <= 1}
                                                                            disabledMessage="At least one item is required."
                                                                        />
                                                                    </td>
                                                                )}
                                                            </tr>
                                                            {/* Component sub-rows (toggle) */}
                                                            {components.length > 0 && expandedItemIndex === index && (
                                                                <tr className="bg-card-2/30">
                                                                    <td></td>
                                                                    <td colSpan={hasOrder ? 5 : 6} className="py-1 px-1">
                                                                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-subtle">
                                                                            {components.map(comp => (
                                                                                <span key={comp.componentProductId} className={comp.included ? "" : "line-through opacity-50"}>
                                                                                    {comp.productName} <span className="font-medium text-ink">{comp.included ? comp.quantity : "0"}</span>
                                                                                    {!comp.included && <span className="text-[10px] text-red-400 ml-0.5">(Excluded)</span>}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
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

                        </div>{/* end left column */}

                        {/* ── Right: Bill Summary (25%) ── */}
                        <div className="w-full lg:w-1/4">
                            <div className="border border-line rounded-xl p-4 bg-card-2 lg:sticky lg:top-4">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <span className="text-xs font-bold text-ink uppercase tracking-wide whitespace-nowrap">Discount (%)</span>
                                    <div className="w-24">
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

                                    {isInterState ? (
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
                                    )}

                                    <div className="flex justify-between pt-2 border-t border-line mt-2 text-ink">
                                        <span className="text-base font-bold">Net Amount</span>
                                        <span className="text-base font-bold text-blue-600">₹{totals.netAmount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>{/* end right column */}

                        </div>{/* end flex row */}

                    </form>


                </div>
            )}
        </div>
    );
};

export default QuotationForm;