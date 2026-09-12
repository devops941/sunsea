import { formatDate } from "../../../utils/dateUtils";
import { formatAmountOnBlur } from "../../../utils/pricingUtils";
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { FaExclamationTriangle } from "react-icons/fa";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import BusyItemsTable, { DEFAULT_SUNDRY_OPTIONS } from "../../../components/form/OrderItemsTable/BusyItemsTable";
import type { BusyColumn, SundryRow } from "../../../components/form/OrderItemsTable/BusyItemsTable";
import TextInput from "../../../components/form/TextInput/TextInput";
import DateInput from "../../../components/form/DateInput/DateInput";
import BackButton from "../../../components/ui/BackButton/BackButton";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { useCustomers } from "../../../hooks/useCustomers";
import { useProducts } from "../../../hooks/useProducts";
import { salesProductService } from "../../../services/salesProductService";
import { useEmployees } from "../../../hooks/useEmployees";
import { salesOrderService, type SalesOrder } from "../../../services/salesOrderService";
import { markStaleByPrefix } from "../../../hooks/useListCache";
import { customerService } from "../../../services/customerService";
import {
    ORDER_SOURCE_NEEDS_EMPLOYEE,
    ORDER_SOURCE_NEEDS_REFERRAL,
    ORDER_SOURCE_NEEDS_DEALER,
} from "../../../constants/selectOption";
import { useAppSelector } from "../../../hooks/reduxHooks";
import { usePermission } from "../../../hooks/usePermission";
import AutocompleteInput from "../../../components/form/AutocompleteInput/AutocompleteInput";
import type { AutocompleteOption } from "../../../components/form/AutocompleteInput/AutocompleteInput";


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
    quotationNo: z.string(),
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

/** Compute live available stock for a SalesProduct based on its component products */
function computeSalesProductLiveStock(sp: any): number {
    if (!sp) return 0;
    const comps = (sp.components || []).filter((c: any) => c?.componentProduct);
    if (comps.length === 0) {
        return (sp.stocks || []).reduce((sum: number, s: any) => sum + Number(s.onHandQty || 0), 0);
    }
    const possibleQuantities = comps.map((c: any) => {
        const prodStocks = c.componentProduct?.finishedGoodsStocks || [];
        const totalCompStock = prodStocks.reduce((sum: number, s: any) => sum + Number(s.onHandQty || 0), 0);
        const perUnit = Number(c.quantity || 1);
        return perUnit > 0 ? Math.floor(totalCompStock / perUnit) : 0;
    });
    return Math.max(0, Math.min(...possibleQuantities));
}

/** Get total on-hand stock for a component product across all stores */
function getComponentProductStock(componentProduct: any): number {
    const prodStocks = componentProduct?.finishedGoodsStocks || [];
    return prodStocks.reduce((sum: number, s: any) => sum + Number(s.onHandQty || 0), 0);
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
            unitPrice: unitPricePerOrder > 0 ? unitPricePerOrder.toFixed(2) : "",
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

    const [sundryRows, setSundryRows] = useState<SundryRow[]>([]);
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

    const formRef = useRef<HTMLFormElement>(null);
    const itemsTableRef = useRef<HTMLDivElement>(null);
    const sundryTableRef = useRef<HTMLDivElement>(null);
    const handleFormKeyDown = useFormKeyboardNav(formRef);

    useFormShortcuts({
        onSave: () => {
            if (!isSubmitting && !isConfirming) {
                handleSubmit((data) => onSubmit(data, false))();
            }
        },
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
    const watchedItems = useWatch({ control, name: "items" });
    const customerId = watch("customerId");
    const orderDiscountType = watch("orderDiscountType");
    const orderDiscountValue = watch("orderDiscountValue");
    const isInterState = watch("isInterState");
    const billingState = watch("billingState");
    const company = useAppSelector((state: any) => state.company.data);
    const companyState = company?.state;

    const salesProductOptions = useMemo(() => [
        { value: "", label: salesProductsLoading ? "Loading..." : "" },
        ...salesProducts.map((sp: any) => {
            const liveStock = computeSalesProductLiveStock(sp);
            const name = sp.salesProductName || sp.salesProductCode || String(sp.id);
            const badge = (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${liveStock > 0
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                    }`}>
                    {liveStock} pcs
                </span>
            );
            return {
                value: String(sp.id),
                selectedLabel: name,
                badge,
                label: (
                    <div className="flex items-center justify-between w-full gap-2">
                        <span className="truncate">{name}</span>
                        {badge}
                    </div>
                ),
            };
        }),
    ], [salesProducts, salesProductsLoading]);

    const customerAutocompleteOptions = useMemo(() =>
        customers.map((c: any) => {
            const name = c.displayName || c.firmName || String(c.id);
            const group = c.customerType?.name || "—";
            const grade = c.customerGrade?.name || "—";
            const bal = Number(c.balanceAmount ?? c.netBalance ?? c.openingBalance ?? 0);
            const bType = (c.balanceType || c.openingBalanceType || "").toString().toUpperCase();
            const isDr = bType.startsWith("D");
            const balLabel = `₹${bal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${isDr ? "Dr" : bType.startsWith("C") ? "Cr" : "—"}`;

            return {
                value: String(c.id),
                label: name,
                selectedLabel: `${name} · ${group} · ${grade} · ${balLabel}`,
                info: (
                    <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-ink-subtle">{group}</span>
                        <span className="text-ink-subtle">{grade}</span>
                        <span className={`font-semibold ${isDr ? "text-rose-500" : "text-emerald-500"}`}>{balLabel}</span>
                    </div>
                ),
            };
        }),
        [customers]
    );

    const prevOrderAutocompleteOptions = useMemo(() =>
        customerOrders.map((o: any) => {
            const dateStr = o.orderDate
                ? formatDate(o.orderDate)
                : null;
            const itemCount = Array.isArray(o.items) ? o.items.length : null;
            const itemsStr = itemCount != null ? `(${itemCount} ${itemCount === 1 ? "Item" : "Items"})` : "";
            const formattedDate = dateStr ? ` · ${dateStr}` : "";
            return {
                value: String(o.id),
                label: `${o.orderNo}${formattedDate}${itemsStr}`,
            };
        }),
        [customerOrders]
    );

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

        // Load bill sundry from order
        if (Array.isArray((order as any).billSundry) && (order as any).billSundry.length > 0) {
            setSundryRows((order as any).billSundry.map((r: any) => ({
                ...r,
                rate: r.rate ? Number(r.rate).toFixed(2) : r.rate,
                amount: r.amount ? Number(r.amount).toFixed(2) : r.amount,
            })));
        } else {
            setSundryRows([]);
        }

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
    // Wait for salesProducts to finish loading before populating form (avoids race condition
    // where reconstructQuotationItems gets an empty salesProducts array)
    useEffect(() => {
        if (salesProductsLoading) return;

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
                    // Reset to create mode with the same SO number
                    setIsEditMode(false);
                    setQuotationId(null);
                    setValue("quotationNo", order.orderNo);
                    setValue("quotationDate", new Date().toISOString().split("T")[0]);
                    setSelectedPrevOrderId(reuseId);
                    toast.info(`Quotation details loaded from ${order.orderNo}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location, idParam, reset, navigate, salesProductsLoading]);

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
        loadCustomers({ limit: 1000 });
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
                if (!getValues("mobile") && mob) {
                    setValue("mobile", mob);
                }
            }
        }
    }, [customerId, customers, getValues, setValue]);

    // ── Loading state ─────────────────────────────────────────────
    const isLoading = customersLoading || productsLoading || salesProductsLoading || loadingOrder;

    // Auto-focus the first navigable field once loading finishes.
    // useFormKeyboardNav's own mount effect fires while the form is not yet
    // rendered (loader is shown), so formRef.current is null at that point.
    // This effect re-triggers the auto-focus when loading → false.
    useEffect(() => {
        if (!isLoading) {
            const timer = setTimeout(() => {
                const first = formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])");
                first?.focus();
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

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
            .catch(() => { });

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

                const includedComps = (item.components || []).filter(c => c.included && Number(c.quantity) > 0);
                const sp = salesProducts.find(s => String(s.id) === item.salesProductId);
                const spComps = (sp?.components || []).filter((comp: any) => comp.componentProduct?.productType === "SALES_PRODUCTION");

                // Calculate total rate across INCLUDED components only for proportional distribution
                const includedCompDefs = includedComps.map(c => {
                    const def = spComps.find((comp: any) => String(comp.componentProductId) === c.componentProductId);
                    const rate = Number(def?.componentProduct?.rate ?? 0);
                    const perUnit = Number(def?.quantity || 1);
                    return { c, def, rate, perUnit, rateWeight: rate * perUnit };
                });
                const totalWeight = includedCompDefs.reduce((sum, d) => sum + d.rateWeight, 0);

                includedCompDefs.forEach(({ c, def, perUnit, rateWeight }) => {
                    // Distribute unit price proportionally across included components
                    const share = totalWeight > 0 ? rateWeight / totalWeight : 1 / includedCompDefs.length;
                    const compUnitPrice = unitPricePerOrder > 0 ? (unitPricePerOrder * share) / perUnit : undefined;

                    transformedItems.push({
                        productId: Number(c.componentProductId),
                        salesProductId: spId,
                        quantity: Number(c.quantity),
                        quotationUnitPrice: compUnitPrice != null && !isNaN(compUnitPrice) ? Math.max(0, Math.round(compUnitPrice * 100) / 100) : 0,
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
                orderNo: data.quotationNo || undefined,
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
                billSundry: sundryRows.length > 0 ? sundryRows : null,
                status: confirm ? "QUOTED" : "DRAFT",
                isQuotation: true,
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

            // Invalidate caches so lists immediately show newly created / updated quotations
            markStaleByPrefix("quotations:");
            markStaleByPrefix("salesOrders:");

            if (confirm) {
                if (currentIsEditMode) {
                    toast.success("Quotation confirmed successfully!");
                    navigate(-1);
                } else {
                    reset(defaultValues);
                    toast.success("Saved");
                    setTimeout(() => {
                        const first = formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])");
                        first?.focus();
                    }, 200);
                }
            } else {
                if (currentIsEditMode) {
                    toast.success("Quotation updated as draft!");
                    navigate(-1);
                } else {
                    reset(defaultValues);
                    toast.success("Saved");
                    setTimeout(() => {
                        const first = formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])");
                        first?.focus();
                    }, 200);
                }
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to save quotation");
        } finally {
            setIsSubmitting(false);
            setIsConfirming(false);
        }
    };

    // ─── Autocomplete options for Excel-style cell ─────────────────
    const autocompleteOptions: AutocompleteOption[] = useMemo(() =>
        salesProducts.map(sp => {
            const stock = computeSalesProductLiveStock(sp);
            return {
                value: String(sp.id),
                label: sp.salesProductName || sp.salesProductCode || String(sp.id),
                info: (
                    <span className={`text-[11px] font-semibold ${stock > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {stock} pcs
                    </span>
                ),
            };
        }),
        [salesProducts]
    );

    // ─── Quotation item columns for BusyItemsTable ─────────────
    const quotationColumns: BusyColumn<any>[] = useMemo(() => [
        {
            key: "salesProductId",
            header: "Sales Product",
            width: "1fr",
            render: (_row: any, index: number) => {
                const itemValue = watchedItems?.[index];
                const hasOrder = !!selectedPrevOrderId || isEditMode;

                if (hasOrder && itemValue?.salesProductId) {
                    const sp = salesProducts.find((s: any) => String(s.id) === itemValue?.salesProductId);
                    const spName = sp?.salesProductName || "—";
                    const stock = sp ? computeSalesProductLiveStock(sp) : 0;
                    return (
                        <div className="flex items-center justify-between w-full gap-2 text-[13px]">
                            <span className="text-ink font-medium truncate">{spName}</span>
                            <span className={`text-[11px] font-semibold shrink-0 ${stock > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {stock} pcs
                            </span>
                        </div>
                    );
                }

                const allItems = watchedItems || [];
                const selectedInOtherRows = new Set(
                    allItems.filter((_: any, i: number) => i !== index).map((item: any) => String(item?.salesProductId)).filter(Boolean)
                );
                const opts = autocompleteOptions.map(o => ({
                    ...o,
                    disabled: selectedInOtherRows.has(o.value),
                }));

                return (
                    <AutocompleteInput
                        inline
                        name={`items.${index}.salesProductId`}
                        value={itemValue?.salesProductId || ""}
                        options={opts}
                        placeholder="Type to search..."
                        error={(errors.items as any)?.[index]?.salesProductId?.message}
                        onChange={(spId) => {
                            const sp = salesProducts.find((s: any) => String(s.id) === spId);
                            setValue(`items.${index}.salesProductId`, spId);
                            setValue(`items.${index}.orderQuantity`, "1");
                            setValue(`items.${index}.components`, sp ? buildComponents(sp, 1) : []);
                            const autoPrice = sp ? computeSalesProductUnitPrice(sp, products) : 0;
                            setValue(`items.${index}.unitPrice`, autoPrice > 0 ? autoPrice.toFixed(2) : "");
                            setValue(`items.${index}.gstRate`, "");
                            // Auto-focus Qty cell so user can enter quantity immediately
                            setTimeout(() => {
                                const qtyCell = itemsTableRef.current?.querySelector(`[data-r="${index}"][data-c="1"]`) as HTMLElement | null;
                                const qtyInput = qtyCell?.querySelector("input") as HTMLInputElement | null;
                                if (qtyInput) {
                                    qtyInput.focus();
                                    qtyInput.select();
                                }
                            }, 50);
                        }}
                    />
                );
            },
        },
        {
            key: "orderQuantity",
            header: "Qty",
            width: "80px",
            align: "center" as const,
            render: (_row: any, index: number) => {
                const itemValue = watchedItems?.[index];
                const components: ComponentItem[] = itemValue?.components || [];
                return (
                    <input
                        type="text"
                        inputMode="numeric"
                        value={itemValue?.orderQuantity ?? ""}
                        onChange={(e) => {
                            const qty = e.target.value;
                            setValue(`items.${index}.orderQuantity`, qty);
                            const numQty = Math.max(1, Number(qty) || 1);
                            const updated = components.map(c => ({
                                ...c,
                                quantity: String(c.perUnit * numQty),
                            }));
                            setValue(`items.${index}.components`, updated);
                        }}
                        className="w-full bg-transparent text-[13px] text-ink text-center outline-none border-none p-0 h-full"
                        placeholder="0"
                    />
                );
            },
        },
        {
            key: "unitPrice",
            header: "Unit Price",
            width: "100px",
            align: "right" as const,
            render: (_row: any, index: number) => {
                const itemValue = watchedItems?.[index];
                return (
                    <input
                        type="text"
                        inputMode="decimal"
                        value={itemValue?.unitPrice ?? ""}
                        onChange={(e) => setValue(`items.${index}.unitPrice`, e.target.value)}
                        onBlur={formatAmountOnBlur((v) => setValue(`items.${index}.unitPrice`, v))}
                        className="w-full bg-transparent text-[13px] text-ink text-right outline-none border-none p-0 h-full"
                        placeholder="0.00"
                    />
                );
            },
        },
        {
            key: "total",
            header: "Total",
            width: "110px",
            align: "right" as const,
            render: (_row: any, index: number) => {
                const itemValue = watchedItems?.[index];
                if (!itemValue) return null;
                const orderQty = Number(itemValue.orderQuantity) || 0;
                const unitPrice = Number(itemValue.unitPrice) || 0;
                const subtotal = orderQty * unitPrice;
                const displayTotal = subtotal > 0 ? subtotal.toFixed(2) : "";
                return (
                    <input
                        type="text"
                        inputMode="decimal"
                        key={`total-${index}-${displayTotal}`}
                        defaultValue={displayTotal}
                        onBlur={(e) => {
                            const newTotal = Number(e.target.value) || 0;
                            const qty = Number(watchedItems?.[index]?.orderQuantity) || 1;
                            const newUnitPrice = qty > 0 ? newTotal / qty : 0;
                            setValue(`items.${index}.unitPrice`, newUnitPrice.toFixed(2));
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                        className="w-full bg-transparent text-[13px] text-emerald-500 font-bold text-right outline-none border-none p-0 h-full"
                        placeholder="0"
                    />
                );
            },
        },
    ], [watchedItems, autocompleteOptions, salesProducts, products, errors.items, isEditMode, selectedPrevOrderId, setValue]);

    // ─── Bill Sundry columns for BusyItemsTable ───────────────
    const sundryColumns: BusyColumn<SundryRow>[] = useMemo(() => {
        return [
            {
                key: "type",
                header: "Bill Sundry",
                width: "1fr",
                render: (row: SundryRow, index: number, update: (patch: Partial<SundryRow>) => void) => {
                    const opts: AutocompleteOption[] = DEFAULT_SUNDRY_OPTIONS.map(o => ({
                        value: o.value,
                        label: o.label,
                    }));

                    return (
                        <div style={{ display: "contents" }} data-enter-opens-autocomplete="true">
                            <AutocompleteInput
                                inline
                                name={`sundry.${index}.type`}
                                value={row.type || ""}
                                options={opts}
                                placeholder="Select bill sundry..."
                                onChange={val => {
                                    update({ type: val });
                                    setTimeout(() => {
                                        const hasRate = val.startsWith("BILL_TAX") || val.startsWith("DISCOUNT");
                                        const targetCol = hasRate ? 1 : 2;
                                        const cell = sundryTableRef.current?.querySelector(`[data-r="${index}"][data-c="${targetCol}"]`) as HTMLElement | null;
                                        const input = cell?.querySelector("input") as HTMLInputElement | null;
                                        if (input) {
                                            input.focus();
                                            input.select?.();
                                        }
                                    }, 50);
                                }}
                            />
                        </div>
                    );
                },
            },
            {
                key: "rate",
                header: "@",
                width: "100px",
                align: "right" as const,
                render: (row: SundryRow, _index: number, update: (patch: Partial<SundryRow>) => void) => {
                    const hasRate = Boolean(row.type && (row.type.startsWith("BILL_TAX") || row.type.startsWith("DISCOUNT")));
                    if (!hasRate) return null;
                    return (
                        <div className="flex items-center gap-0.5 w-full justify-end">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={row.rate}
                                onChange={e => {
                                    const rate = e.target.value.replace(/[^0-9.]/g, "");
                                    const rateNum = Number(rate) || 0;
                                    const calcAmount = (totals.subtotal * rateNum / 100).toFixed(2);
                                    update({ rate, amount: rateNum > 0 ? calcAmount : "" });
                                }}
                                placeholder="0.000"
                                className="w-full bg-transparent text-[13px] outline-none border-none p-0 h-full text-right"
                            />
                            <span className="text-[11px] text-ink-subtle">%</span>
                        </div>
                    );
                },
            },
            {
                key: "amount",
                header: "Amount (₹)",
                width: "120px",
                align: "right" as const,
                render: (row: SundryRow, _index: number, update: (patch: Partial<SundryRow>) => void) => {
                    const isNeg = DEFAULT_SUNDRY_OPTIONS.find(o => o.value === row.type)?.sign === -1;
                    return (
                        <input
                            type="text"
                            inputMode="decimal"
                            value={row.amount}
                            onChange={e => update({ amount: e.target.value.replace(/[^0-9.]/g, ""), rate: "" })}
                            placeholder="0.00"
                            className="w-full bg-transparent text-[13px] outline-none border-none p-0 h-full text-right font-semibold"
                            style={{ color: isNeg ? "#ef4444" : "var(--color-ink)" }}
                        />
                    );
                },
            },
        ];
    }, [totals.subtotal]);

    const sundryEmptyRow: SundryRow = useMemo(() => {
        return { id: `${Date.now()}-${Math.random()}`, type: "", rate: "", amount: "" };
    }, []);

    // ─── Expanded Components for BusyItemsTable ──────────────
    const renderExpandedComponents = useCallback((_row: any, index: number) => {
        const itemValue = watchedItems?.[index];
        const components: ComponentItem[] = itemValue?.components || [];
        const sp = salesProducts.find((s: any) => String(s.id) === itemValue?.salesProductId);

        if (components.length === 0) return null;

        return (
            <div className="px-4 py-2">
                <div className="ml-6 rounded-md border border-line-soft overflow-hidden">
                    <div className="grid grid-cols-[auto_1fr_auto_80px_80px] gap-2 px-3 py-1.5 bg-card-2 border-b border-line-soft">
                        <div className="w-4" />
                        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Component Product</span>
                        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider text-center w-12">Per Unit</span>
                        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider text-center">Live Stock</span>
                        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider text-center">Qty</span>
                    </div>
                    {components.map((comp, compIdx) => {
                        const spComp = sp?.components?.find((c: any) => String(c.componentProductId) === String(comp.componentProductId));
                        const compStock = spComp ? getComponentProductStock(spComp.componentProduct) : null;
                        return (
                            <div
                                key={comp.componentProductId}
                                className={`grid grid-cols-[auto_1fr_auto_80px_80px] gap-2 items-center px-3 py-1.5 border-b border-line-soft last:border-b-0 ${comp.included ? "bg-card" : "bg-card-2 opacity-60"}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={comp.included}
                                    onChange={() => {
                                        const updated = components.map((c, i) =>
                                            i === compIdx ? { ...c, included: !c.included } : c
                                        );
                                        setValue(`items.${index}.components`, updated);
                                    }}
                                    className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                                />
                                <span className={`text-xs ${comp.included ? "text-ink font-medium" : "line-through text-ink-subtle"}`}>
                                    {comp.productName}
                                </span>
                                <span className="text-[11px] text-ink-subtle text-center w-12">x{comp.perUnit}</span>
                                <span className="text-xs font-semibold text-center text-ink-subtle">
                                    {compStock != null ? `${compStock} pcs` : "—"}
                                </span>
                                <span className="text-xs text-ink font-medium text-center">
                                    {comp.included ? comp.quantity : "0"}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }, [watchedItems, salesProducts, setValue]);

    // ─── Render ──────────────────────────────────────────────────
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

    if (isLoading) {
        return <CommonLoader text="Loading quotation..." fullScreen={false} />;
    }

    return (
        <div className="w-full xl:mr-auto">
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-visible">

                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3 border-b border-line">
                    <h2 className="text-lg font-bold text-ink flex items-start">
                        {isEditMode ? " Quotation" : " Quotation"}
                        <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{watch("quotationNo")}</span>
                    </h2>
                    <BackButton text="Back to List" />
                </div>

                <form
                    ref={formRef}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(-1);
                            return;
                        }
                        handleFormKeyDown(e);
                    }}
                    data-escape-guarded
                    className="px-5 py-2 space-y-2"
                    onSubmit={handleSubmit((data) => onSubmit(data, false))}
                    noValidate
                >
                    <div className="flex flex-col lg:flex-row gap-2">
                        {/* ── Left: Form ── */}
                        <div className="w-full space-y-2">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                                {/* Row 1: Date | Quotation No | Valid Until */}
                                <Controller
                                    name="quotationDate"
                                    control={control}
                                    render={({ field: f }) => (
                                        <DateInput
                                            label="Quotation Date"
                                            name={f.name}
                                            value={f.value}
                                            onChange={f.onChange}
                                            required
                                            disabled={isEditMode}
                                        />
                                    )}
                                />
                                <Controller
                                    name="validUntil"
                                    control={control}
                                    render={({ field: f }) => (
                                        <DateInput
                                            label="Valid Until"
                                            name={f.name}
                                            value={f.value ?? ""}
                                            onChange={f.onChange}
                                        />
                                    )}
                                />

                                {/* Row 2: Customer | Select Sales Order (create mode only) */}
                                <Controller
                                    name="customerId"
                                    control={control}
                                    render={({ field: f }) => (
                                        <AutocompleteInput
                                            label="Customer"
                                            name={f.name}
                                            value={f.value ?? ""}
                                            options={customerAutocompleteOptions}
                                            onChange={(val) => f.onChange({ target: { name: f.name, value: val } })}
                                            required
                                            disabled={isEditMode}
                                            error={errors.customerId?.message}
                                            placeholder="Type to search customer..."
                                        />
                                    )}
                                />
                                {!isEditMode && (
                                    <AutocompleteInput
                                        label="Select Sales Order"
                                        name="selectedPrevOrderId"
                                        value={selectedPrevOrderId ? String(selectedPrevOrderId) : ""}
                                        options={prevOrderAutocompleteOptions}
                                        onChange={(val) => handleLoadFromPrevOrder(val ? Number(val) : null)}
                                        placeholder={
                                            !customerId
                                                ? "Select a customer first"
                                                : loadingCustomerOrders
                                                ? "Loading orders..."
                                                : customerOrders.length > 0
                                                ? "Type to search order..."
                                                : "No pending sales orders"
                                        }
                                        disabled={!customerId}
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

                            {/* ── Quotation Items (65%) + Bill Sundry (35%) ── */}
                            <div className="flex gap-3">
                                <div ref={itemsTableRef} className="w-[65%]">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-semibold text-ink">Quotation Items</span>
                                    </div>
                                    <BusyItemsTable
                                        columns={quotationColumns}
                                        rows={fields}
                                        onAdd={() => append({ salesProductId: "", orderQuantity: "", unitPrice: "", gstRate: "", components: [] })}
                                        onRemove={(i) => remove(i)}
                                        editable={fields.length > 1}
                                        expandable
                                        canExpand={(_row, i) => Boolean(watchedItems?.[i]?.salesProductId)}
                                        expandedIndex={expandedItemIndex}
                                        onExpandToggle={(i) => setExpandedItemIndex(expandedItemIndex === i ? null : i)}
                                        renderExpandedRow={renderExpandedComponents}
                                        showTotals={[
                                            { colKey: "orderQuantity", value: (watchedItems || []).reduce((s: number, it: any) => s + (Number(it?.orderQuantity) || 0), 0) },
                                            { colKey: "total", value: `₹${totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                                        ]}
                                        visibleRows={10}
                                        getFieldBeforeTable={() => {
                                            const selOrder = document.getElementById("selectedPrevOrderId") as HTMLElement | null;
                                            if (selOrder && !selOrder.hasAttribute("disabled") && !(selOrder as any).disabled) return selOrder;
                                            const cust = document.getElementById("customerId") as HTMLElement | null;
                                            if (cust && !cust.hasAttribute("disabled") && !(cust as any).disabled) return cust;
                                            return document.querySelector('input[name="quotationDate"]') as HTMLElement | null;
                                        }}
                                        getFieldAfterTable={() => document.getElementById("btn-save-draft") || null}
                                        onNavigateRight={(row) => {
                                            const st = sundryTableRef.current;
                                            if (!st) return false;
                                            if (sundryRows.length === 0) {
                                                setSundryRows([{ ...sundryEmptyRow }]);
                                                setTimeout(() => {
                                                    const firstCell = st.querySelector(`[data-r="0"][data-c="0"]`) as HTMLElement | null;
                                                    const input = firstCell?.querySelector("input, [tabindex]:not([tabindex='-1'])") as HTMLElement | null;
                                                    if (input) { input.focus(); }
                                                    else if (firstCell) { firstCell.focus(); }
                                                }, 40);
                                                return true;
                                            }
                                            const targetRow = Math.min(row, Math.max(0, sundryRows.length - 1));
                                            const cell = st.querySelector(`[data-r="${targetRow}"][data-c="0"]`) as HTMLElement | null;
                                            const input = cell?.querySelector("input, select, [tabindex]:not([tabindex='-1'])") as HTMLElement | null;
                                            if (input) { input.focus(); return true; }
                                            if (cell) { cell.focus(); return true; }
                                            return false;
                                        }}
                                    />
                                </div>
                                <div ref={sundryTableRef} className="w-[35%]">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-semibold text-ink">Bill Sundry</span>
                                    </div>
                                    <BusyItemsTable
                                        columns={sundryColumns}
                                        rows={sundryRows}
                                        onChange={setSundryRows}
                                        emptyRow={sundryEmptyRow}
                                        editable={false}
                                        visibleRows={5}
                                        showTotals={[
                                            {
                                                colKey: "amount",
                                                value: (() => {
                                                    const t = sundryRows.reduce((s, r) => {
                                                        if (!r.type) return s;
                                                        const a = Number(r.amount) || 0;
                                                        const o = DEFAULT_SUNDRY_OPTIONS.find(x => x.value === r.type);
                                                        return s + (o?.sign === -1 ? -a : a);
                                                    }, 0);
                                                    return t !== 0 ? `${t > 0 ? "+" : "-"} ₹${Math.abs(t).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "0.00";
                                                })(),
                                            },
                                        ]}
                                        getFieldBeforeTable={() => {
                                            const selOrder = document.getElementById("selectedPrevOrderId") as HTMLElement | null;
                                            if (selOrder && !selOrder.hasAttribute("disabled") && !(selOrder as any).disabled) return selOrder;
                                            const cust = document.getElementById("customerId") as HTMLElement | null;
                                            return cust || null;
                                        }}
                                        getFieldAfterTable={() => document.getElementById("btn-save-draft") || null}
                                        onNavigateLeft={(row) => {
                                            const it = itemsTableRef.current;
                                            if (!it) return false;
                                            const targetRow = Math.min(row, Math.max(0, fields.length - 1));
                                            const cell = it.querySelector(`[data-r="${targetRow}"][data-c="2"]`) as HTMLElement | null;
                                            const input = cell?.querySelector("input, [tabindex]:not([tabindex='-1'])") as HTMLElement | null;
                                            if (input) { input.focus(); if (input instanceof HTMLInputElement) input.select(); return true; }
                                            if (cell) { cell.focus(); return true; }
                                            return false;
                                        }}
                                    />
                                    {/* ── Full Amount ── */}
                                    <div className="flex justify-end mt-2 px-2 py-2 border border-line rounded-md bg-card-2">
                                        <div className="text-right">
                                            <span className="text-base font-bold text-blue-600">
                                                ₹{(() => {
                                                    const sundryTotal = sundryRows.reduce((s, r) => {
                                                        if (!r.type) return s;
                                                        const a = Number(r.amount) || 0;
                                                        const o = DEFAULT_SUNDRY_OPTIONS.find(x => x.value === r.type);
                                                        return s + (o?.sign === -1 ? -a : a);
                                                    }, 0);
                                                    return (totals.subtotal + sundryTotal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>


                        </div>{/* end left column */}

                    </div>{/* end flex row */}

                </form>

                {/* ── Form Actions ── */}
                <div className="flex justify-end gap-3 px-5 py-3 border-t border-line">
                    <button
                        id="btn-save-draft"
                        type="button"
                        data-nav
                        onClick={handleSubmit((data) => onSubmit(data, false))}
                        disabled={isSubmitting || isConfirming}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowRight") {
                                e.preventDefault();
                                document.getElementById("btn-confirm-order")?.focus();
                            } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                const sundryCell = sundryTableRef.current?.querySelector(`[data-r="${Math.max(0, sundryRows.length - 1)}"][data-c="2"] input, [data-r="${Math.max(0, sundryRows.length - 1)}"][data-c="0"] select`) as HTMLElement | null;
                                if (sundryCell) { sundryCell.focus(); return; }
                                const itemCell = itemsTableRef.current?.querySelector(`[data-r="${Math.max(0, fields.length - 1)}"][data-c="2"] input`) as HTMLElement | null;
                                itemCell?.focus();
                            }
                        }}
                        className={`inline-flex items-center justify-center gap-2 border-none outline-none font-semibold transition-all duration-250 rounded-lg focus-visible:ring-2 focus-visible:ring-accent h-[38px] px-3.5 text-[13px] bg-card-2 text-ink border border-line-soft hover:bg-card hover:border-line shadow-xs ${isSubmitting || isConfirming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                        {isSubmitting ? "Saving..." : (isEditMode ? "Update Draft" : "Save as Draft")}
                    </button>
                    <button
                        id="btn-confirm-order"
                        type="button"
                        data-nav
                        onClick={handleSubmit((data) => onSubmit(data, true))}
                        disabled={isSubmitting || isConfirming}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                document.getElementById("btn-save-draft")?.focus();
                            } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                const sundryCell = sundryTableRef.current?.querySelector(`[data-r="${Math.max(0, sundryRows.length - 1)}"][data-c="2"] input, [data-r="${Math.max(0, sundryRows.length - 1)}"][data-c="0"] select`) as HTMLElement | null;
                                if (sundryCell) { sundryCell.focus(); return; }
                                const itemCell = itemsTableRef.current?.querySelector(`[data-r="${Math.max(0, fields.length - 1)}"][data-c="2"] input`) as HTMLElement | null;
                                itemCell?.focus();
                            }
                        }}
                        className={`inline-flex items-center justify-center gap-2 border-none outline-none font-semibold transition-all duration-250 rounded-lg focus-visible:ring-2 focus-visible:ring-accent h-[38px] px-3.5 text-[13px] bg-gradient-to-r from-accent to-emerald-500 hover:from-accent/90 hover:to-emerald-500/90 text-white shadow-md shadow-accent/20 ${isSubmitting || isConfirming ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                        {isConfirming ? "Confirming..." : "Confirm Order"}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default QuotationForm;