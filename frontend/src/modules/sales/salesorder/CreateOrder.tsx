import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { FaCheck } from "react-icons/fa";
import { ChevronDown, ChevronUp } from "lucide-react";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import BusyItemsTable from "../../../components/form/OrderItemsTable/BusyItemsTable";
import type { BusyColumn } from "../../../components/form/OrderItemsTable/BusyItemsTable";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import AutocompleteInput from "../../../components/form/AutocompleteInput/AutocompleteInput";
import type { AutocompleteOption } from "../../../components/form/AutocompleteInput/AutocompleteInput";
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
    unit: z.string().optional(),
    unitPrice: z.string().optional(),
    components: z.array(componentSchema),
});

const salesOrderSchema = z
    .object({
        id: z.number().optional(),
        orderNo: z.string().min(1, "Order No is required"),
        orderDate: z.string().min(1, "Order Date is required"),
        customerId: z.string().min(1, "Customer is required"),
        mobile: z.string().optional().nullable(),
        orderSource: z.string().optional().default(""),
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
    items: Array<{ salesProductId: string; orderQuantity: string; unit?: string; unitPrice?: string; components: ComponentItem[] }>;
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
    items: [{ salesProductId: "", orderQuantity: "", unit: "Pcs.", unitPrice: "", components: [] }],
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

/** Reconstruct form items from saved SalesOrder items and SalesProducts */
type FormItem = { salesProductId: string; orderQuantity: string; unit?: string; unitPrice?: string; components: ComponentItem[] };

function reconstructFormItems(orderItems: any[], salesProducts: any[]): FormItem[] {
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
        return [{ salesProductId: "", orderQuantity: "", unit: "Pcs.", unitPrice: "", components: [] }];
    }

    const result: FormItem[] = [];
    const processedOrderItemIds = new Set<any>();

    // Group order items by salesProductId when available
    const groupedBySp = new Map<string, any[]>();
    const ungroupedItems: any[] = [];

    orderItems.forEach(oi => {
        const spId = oi.salesProductId ? String(oi.salesProductId) : null;
        if (spId) {
            if (!groupedBySp.has(spId)) groupedBySp.set(spId, []);
            groupedBySp.get(spId)!.push(oi);
        } else {
            ungroupedItems.push(oi);
        }
    });

    // Process items that have salesProductId — exact grouping
    groupedBySp.forEach((items, spIdStr) => {
        const sp = salesProducts.find(s => String(s.id) === spIdStr);
        if (!sp) return;

        items.forEach(oi => processedOrderItemIds.add(oi.id || oi.productId));

        const spComps = (sp?.components || []).filter(
            (comp: any) => comp.componentProduct?.productType === "SALES_PRODUCTION"
        );

        const firstMatch = items[0];
        const matchingSpComp = spComps.find(
            (c: any) => String(c.componentProductId) === String(firstMatch.productId)
        );
        const perUnit = Number(matchingSpComp?.quantity || 1);
        const calcOrderQty = Math.max(1, Math.round(Number(firstMatch.quantity || 1) / perUnit));

        const components: ComponentItem[] = spComps.map((c: any) => {
            const compPerUnit = Number(c.quantity || 1);
            const oi = items.find(
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
            salesProductId: spIdStr,
            orderQuantity: String(calcOrderQty),
            unit: "Pcs.",
            unitPrice: String(items[0]?.unitPrice ?? items[0]?.rate ?? ""),
            components,
        });
    });

    // Fallback for items without salesProductId (legacy data)
    const remainingItems = [...ungroupedItems, ...orderItems.filter(oi => !processedOrderItemIds.has(oi.id || oi.productId) && !oi.salesProductId)];

    salesProducts.forEach(sp => {
        const spComps = (sp?.components || []).filter(
            (comp: any) => comp.componentProduct?.productType === "SALES_PRODUCTION"
        );

        const matchingOrderItems = remainingItems.filter(oi =>
            !processedOrderItemIds.has(oi.id || oi.productId) &&
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

    return result.length > 0 ? result : [{ salesProductId: "", orderQuantity: "", unit: "Pcs.", unitPrice: "", components: [] }];
}

// ─── Expanded Row Content ─────────────────────────────────────────────────────

const ExpandedComponents: React.FC<{
    index: number;
    control: any;
    setValue: any;
    salesProducts: any[];
}> = ({ index, control, setValue, salesProducts }) => {
    const itemValue = useWatch({ control, name: `items.${index}` });
    const components: ComponentItem[] = itemValue?.components || [];
    const selectedSp = salesProducts.find(s => String(s.id) === itemValue?.salesProductId);

    const toggleIncluded = (compIdx: number) => {
        const updated = components.map((c, i) =>
            i === compIdx ? { ...c, included: !c.included } : c
        );
        setValue(`items.${index}.components`, updated);
    };

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
                    const spComp = selectedSp?.components?.find((c: any) => String(c.componentProductId) === String(comp.componentProductId));
                    const compStock = spComp ? getComponentProductStock(spComp.componentProduct) : null;
                    return (
                        <div
                            key={comp.componentProductId}
                            className={`grid grid-cols-[auto_1fr_auto_80px_80px] gap-2 items-center px-3 py-1.5 border-b border-line-soft last:border-b-0 ${comp.included ? "bg-card" : "bg-card-2 opacity-60"}`}
                        >
                            <input type="checkbox" checked={comp.included} onChange={() => toggleIncluded(compIdx)} className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer" />
                            <span className={`text-xs ${comp.included ? "text-ink font-medium" : "line-through text-ink-subtle"}`}>{comp.productName}</span>
                            <span className="text-[11px] text-ink-subtle text-center w-12">×{comp.perUnit}</span>
                            <span className="text-xs font-semibold text-center text-ink-subtle">{compStock != null ? `${compStock} pcs` : "—"}</span>
                            <span className="text-xs text-ink font-medium text-center">{comp.quantity}</span>
                        </div>
                    );
                })}
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

    // Zero-loading Edit: list page navigates with `state: item`, so we can
    // pre-fill the scalar fields (customer, orderNo, date, source, narration)
    // instantly on mount — no network wait. The items array still needs
    // salesProducts to reconstruct, so the useEffect below handles that
    // and does the final full `reset()` once both are available.
    const preloadedOrder = (location.state && typeof location.state === "object")
        ? (location.state as any)
        : null;

    const { customers, loadCustomers } = useCustomers();
    const { employees, loadEmployees } = useEmployees();

    const [salesProducts, setSalesProducts] = useState<any[]>([]);
    const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(null);
    const [companyState, setCompanyState] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const justResetRef = React.useRef(false);
    const editValuesRef = React.useRef<SalesOrderFormValues | null>(null);

    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const handleSaveRef = useRef<() => void>(() => {});
    const isDirtyRef = useRef(false);
    const saveConfirmOpenRef = useRef(false);
    const lastFocusedRef = useRef<HTMLElement | null>(null);

    // Derive an initial form-values snapshot from the router-state preload.
    // Items are left as a placeholder because reconstructing them requires
    // salesProducts (loaded async) — the useEffect below fills them in.
    const initialFormValues: SalesOrderFormValues = React.useMemo(() => {
        if (!isEditMode || !preloadedOrder) return defaultValues;
        return {
            id: preloadedOrder.id,
            orderNo: preloadedOrder.orderNo || "",
            orderDate: preloadedOrder.orderDate ? String(preloadedOrder.orderDate).split("T")[0] : today,
            customerId: preloadedOrder.customerId != null ? String(preloadedOrder.customerId) : "",
            mobile: preloadedOrder.mobile || "",
            orderSource: preloadedOrder.orderSource || "",
            sourceEmployeeId: preloadedOrder.sourceEmployeeId != null ? String(preloadedOrder.sourceEmployeeId) : null,
            referredByCustomerId: preloadedOrder.referredByCustomerId || null,
            referredByName: preloadedOrder.referredByName || null,
            narration: preloadedOrder.narration || preloadedOrder.remarks || preloadedOrder.internalNotes || "",
            items: [{ salesProductId: "", orderQuantity: "1", components: [] }],
            isInterState: Boolean(preloadedOrder.isInterState),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const {
        control,
        handleSubmit,
        watch,
        setValue,
        getValues,
        reset,
        formState: { errors, isDirty },
    } = useForm<SalesOrderFormValues>({
        resolver: zodResolver(salesOrderSchema),
        defaultValues: initialFormValues,
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });

    useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
    useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

    useFormShortcuts({ onSave: () => handleSaveRef.current() });

    const handleFormKeyDown = useFormKeyboardNav(formRef);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (saveConfirmOpenRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            if (isDirtyRef.current) {
                lastFocusedRef.current = document.activeElement as HTMLElement;
                setSaveConfirmOpen(true);
            } else {
                navigate("/sales-order");
            }
        };
        document.addEventListener("keydown", handleEscape, true);
        return () => document.removeEventListener("keydown", handleEscape, true);
    }, [navigate]);

    // ─── Load company info for inter-state ───────────────────────────
    useEffect(() => {
        companyService.getCompany()
            .then(c => setCompanyState(c?.state || ""))
            .catch(() => setCompanyState(""));
    }, []);

    // ─── Load sales products & order data ────────────────────────────
    useEffect(() => {
        let isMounted = true;

        const buildEditValues = (orderData: any, activeProducts: any[]): SalesOrderFormValues => ({
            id: orderData.id,
            orderNo: orderData.orderNo || "",
            orderDate: orderData.orderDate ? String(orderData.orderDate).split("T")[0] : today,
            customerId: orderData.customerId != null ? String(orderData.customerId) : "",
            mobile: orderData.mobile || "",
            orderSource: orderData.orderSource || "",
            sourceEmployeeId: orderData.sourceEmployeeId != null ? String(orderData.sourceEmployeeId) : null,
            referredByCustomerId: orderData.referredByCustomerId || null,
            referredByName: orderData.referredByName || null,
            narration: orderData.narration || orderData.remarks || orderData.internalNotes || "",
            items: reconstructFormItems(orderData.items || [], activeProducts),
            isInterState: Boolean(orderData.isInterState),
        });

        const loadData = async () => {
            try {
                const productsData = await salesProductService.fetchAll();
                const activeProducts = Array.isArray(productsData) ? productsData.filter((sp: any) => sp.isActive !== false) : [];
                if (isMounted) setSalesProducts(activeProducts);

                if (targetId) {
                    // Zero-loading path: if the list navigated us here with the
                    // full order in router state AND it already carries items,
                    // reset the form INSTANTLY with those items. Then still
                    // fetch fresh data in the background to reconcile any
                    // server-side changes since the list was loaded.
                    if (preloadedOrder && Array.isArray(preloadedOrder.items) && preloadedOrder.items.length > 0) {
                        const initialEdit = buildEditValues(preloadedOrder, activeProducts);
                        editValuesRef.current = initialEdit;
                        justResetRef.current = true;
                        reset(initialEdit);
                    }

                    const orderData = await salesOrderService.fetchById(targetId);
                    if (!isMounted) return;

                    const editValues = buildEditValues(orderData, activeProducts);
                    editValuesRef.current = editValues;
                    justResetRef.current = true;
                    reset(editValues);
                } else {
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
    }, [targetId, reset, setValue, preloadedOrder]);

    // ─── Load on mount ───────────────────────────────────────────────
    useEffect(() => {
        loadCustomers({ limit: 1000 });
        if (can("employees.view")) loadEmployees({ limit: 500 });
    }, [loadCustomers, loadEmployees, can]);

    // ─── Auto-focus Order Items table in Edit Mode ───────────────────
    useEffect(() => {
        if (!isEditMode) return;
        const timer = setTimeout(() => {
            const tableFirstCell = formRef.current?.querySelector<HTMLElement>(
                '[data-busy-table] [data-r="0"][data-c="0"] [tabindex="0"], [data-busy-table] [data-r="0"][data-c="0"] input, [data-busy-table] [data-r="0"][data-c="0"]'
            );
            if (tableFirstCell) {
                tableFirstCell.focus();
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [isEditMode, salesProducts.length, targetId]);

    // ─── Options ─────────────────────────────────────────────────────
    const customerOptions = useMemo(() =>
        customers.map(d => ({
            value: String(d.id),
            label: d.displayName || d.firmName || String(d.id),
        })),
        [customers]
    );

    const customerAutocompleteOptions = useMemo(() =>
        customers.map(d => {
            const name = d.displayName || d.firmName;
            const group = d.customerType?.name || "—";
            const grade = d.customerGrade?.name || "—";
            const bal = Number(d.balanceAmount ?? d.netBalance ?? d.openingBalance ?? 0);
            const bType = (d.balanceType || d.openingBalanceType || "").toString().toUpperCase();
            const isDr = bType.startsWith("D");
            const balLabel = `₹${bal.toLocaleString("en-IN")} ${isDr ? "Dr" : bType.startsWith("C") ? "Cr" : "—"}`;

            return {
                value: String(d.id),
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

    const salesProductOptions = useMemo(() =>
        salesProducts.map(sp => {
            const liveStock = computeSalesProductLiveStock(sp);
            const name = sp.salesProductName || sp.salesProductCode;
            const badge = (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                    liveStock > 0
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

    // ─── Autocomplete options for Excel-style cell ─────────────────
    const watchedItems = watch("items");
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

    // ─── Helper: get product rate ──────────────────────────────────
    const getProductRate = useCallback((sp: any): string => {
        if (!sp) return "";
        if (sp.rate) return String(sp.rate);
        const comp = (sp.components || []).find((c: any) => c.componentProduct?.rate);
        return comp ? String(comp.componentProduct.rate) : "";
    }, []);

    // ─── Order item columns for BusyItemsTable ────────────────────
    const orderItemColumns: BusyColumn<any>[] = useMemo(() => [
        {
            key: "salesProductId",
            header: "Item",
            width: "1fr",
            render: (_row: any, index: number) => {
                const itemValue = watchedItems?.[index];
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
                        dataNavDefault={isEditMode && index === 0}
                        name={`items.${index}.salesProductId`}
                        value={itemValue?.salesProductId || ""}
                        options={opts}
                        placeholder="Type to search..."
                        error={(errors.items as any)?.[index]?.salesProductId?.message}
                        onChange={(spId) => {
                            const sp = salesProducts.find(s => String(s.id) === spId);
                            setValue(`items.${index}.salesProductId`, spId);
                            setValue(`items.${index}.orderQuantity`, "");
                            setValue(`items.${index}.components`, sp ? buildComponents(sp, 1) : []);
                            // Auto-focus Qty cell so user can type quantity immediately
                            setTimeout(() => {
                                const qtyCell = document.querySelector(`[data-r="${index}"][data-c="1"]`) as HTMLElement | null;
                                const qtyInput = qtyCell?.querySelector("input") as HTMLInputElement | null;
                                if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
                            }, 50);
                        }}
                    />
                );
            },
        },
        {
            key: "orderQuantity",
            header: "Qty",
            width: "100px",
            align: "center" as const,
            render: (_row: any, index: number) => {
                const itemValue = watchedItems?.[index];
                const orderQty = itemValue?.orderQuantity ?? "";
                return (
                    <input
                        type="text"
                        inputMode="numeric"
                        value={orderQty}
                        onChange={e => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            const qty = raw || "";
                            setValue(`items.${index}.orderQuantity`, qty);
                            const numQty = Math.max(1, Number(qty) || 1);
                            const comps = itemValue?.components || [];
                            const updated = comps.map((c: any) => ({ ...c, quantity: String(c.perUnit * numQty) }));
                            setValue(`items.${index}.components`, updated);
                        }}
                        placeholder="0"
                        className="w-full bg-transparent text-[13px] text-ink text-center outline-none border-none p-0"
                    />
                );
            },
        },
    ], [watchedItems, autocompleteOptions, salesProducts, errors.items, setValue, getProductRate]);

    // ─── Remove empty rows before submit ───────────────────────────
    const cleanEmptyRows = useCallback(() => {
        const currentItems = getValues("items");
        const emptyIndices = currentItems
            .map((item, i) => (!item.salesProductId ? i : -1))
            .filter(i => i >= 0)
            .reverse();
        emptyIndices.forEach(i => remove(i));
        if (currentItems.length === emptyIndices.length) {
            append({ salesProductId: "", orderQuantity: "", unit: "Pcs.", unitPrice: "", components: [] });
        }
    }, [getValues, remove, append]);

    // ─── Submit ──────────────────────────────────────────────────────
    const onSubmit = async (data: SalesOrderFormValues, action: "draft" | "quotation" | "order") => {
        setIsSubmitting(true);
        try {
            const expandedItems: { productId: number; quantity: number; salesProductId: number | null }[] = [];

            data.items.forEach(item => {
                const spId = item.salesProductId ? Number(item.salesProductId) : null;
                (item.components || [])
                    .filter(c => c.included && Number(c.quantity) > 0)
                    .forEach(c => {
                        expandedItems.push({
                            productId: Number(c.componentProductId),
                            quantity: Number(c.quantity),
                            salesProductId: spId,
                        });
                    });
            });

            const mergedItems = expandedItems;

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

    // ─── Wire save shortcut (after cleanEmptyRows / onSubmit are defined) ──
    handleSaveRef.current = () => {
        if (!isSubmitting) {
            cleanEmptyRows();
            handleSubmit((data) => onSubmit(data as unknown as SalesOrderFormValues, "order"))();
        }
    };

    // ─── Render ──────────────────────────────────────────────────────
    return (
        <>
        <div className="max-w-[1400px] xl:mr-auto">
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-visible">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3 border-b border-line">
                    <h2 className="text-lg font-bold text-ink flex items-start">
                        {isEditMode ? "Edit Sales Order" : "Create Sales Order"}
                        <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{watch("orderNo")}</span>
                    </h2>
                    <BackButton text="Back to List" />
                </div>

                <form ref={formRef} onKeyDown={handleFormKeyDown} data-escape-guarded className="px-5 py-3 space-y-3" noValidate>
                    {/* ── Main Fields ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                        <div className="sm:col-span-2">
                            <Controller name="customerId" control={control} render={({ field }) => (
                                <AutocompleteInput horizontal label="Customer" name={field.name} value={field.value} options={customerAutocompleteOptions} required onChange={(val) => field.onChange({ target: { name: field.name, value: val } })} placeholder="Type to search customer..." disabled={isEditMode} dataNavDefault={!isEditMode} error={errors.customerId?.message} />
                            )} />
                        </div>

                        <div>
                            <Controller name="orderDate" control={control} render={({ field }) => (
                                <AutocompleteInput horizontal label="Order Date" name={field.name} value={field.value} options={[]} required onChange={() => {}} placeholder={field.value} disabled />
                            )} />
                        </div>

                        <div>
                            <Controller name="mobile" control={control} render={({ field }) => (
                                <AutocompleteInput horizontal label="Mobile" name={field.name} value={field.value ?? ""} options={mobileOptions.map(o => ({ value: o.value, label: o.selectedLabel || o.label }))} onChange={(val) => field.onChange({ target: { name: field.name, value: val } })} placeholder={mobileOptions.length > 0 ? "Select Mobile" : "No mobile numbers"} disabled={!selectedCustomerId} />
                            )} />
                        </div>

                        <div>
                            <Controller name="orderSource" control={control} render={({ field }) => (
                                <AutocompleteInput horizontal label="Order Source" name={field.name} value={field.value ?? ""} options={ORDER_SOURCE_OPTIONS} required onChange={(val) => field.onChange({ target: { name: field.name, value: val } })} placeholder="Type to search..." error={errors.orderSource?.message} />
                            )} />
                        </div>

                        {/* Employee dropdown — shown for SALES_PERSON, TELE_CALLING, WALK_IN, WHATSAPP */}
                        {ORDER_SOURCE_NEEDS_EMPLOYEE.includes(orderSource ?? "") && (
                            <div>
                                <Controller name="sourceEmployeeId" control={control} render={({ field }) => (
                                    <AutocompleteInput
                                        horizontal
                                        label="Employee"
                                        name={field.name}
                                        value={field.value ?? ""}
                                        options={employeeOptions}
                                        required
                                        onChange={(val) => field.onChange({ target: { name: field.name, value: val } })}
                                        placeholder="Type to search..."
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
                                            horizontal
                                            label="Referred By"
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
                                        <TextInput horizontal label="Referral Name" name={field.name} value={field.value ?? ""} placeholder="Or enter referral name" onChange={field.onChange} onBlur={field.onBlur} />
                                    )} />
                                    <Err message={errors.referredByName?.message} />
                                </div>
                            </>
                        )}

                        {/* Dealer / Agent name — shown for DEALER_AGENT */}
                        {ORDER_SOURCE_NEEDS_DEALER.includes(orderSource ?? "") && (
                            <div>
                                <Controller name="referredByName" control={control} render={({ field }) => (
                                    <TextInput horizontal label="Dealer / Agent" name={field.name} value={field.value ?? ""} placeholder="Enter dealer or agent name" onChange={field.onChange} onBlur={field.onBlur} required />
                                )} />
                                <Err message={errors.referredByName?.message} />
                            </div>
                        )}
                    </div>

                    {/* ── Order Items ── */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-semibold text-ink">Order Items</span>
                        </div>

                        {typeof errors.items?.message === "string" && <Err message={errors.items.message} />}

                        <BusyItemsTable
                            columns={orderItemColumns}
                            rows={fields}
                            onAdd={() => append({ salesProductId: "", orderQuantity: "", unit: "Pcs.", unitPrice: "", components: [] })}
                            onRemove={(i) => remove(i)}
                            editable={false}
                            expandable
                            canExpand={(_row, i) => Boolean(watchedItems?.[i]?.salesProductId)}
                            expandedIndex={expandedItemIndex}
                            onExpandToggle={(i) => setExpandedItemIndex(expandedItemIndex === i ? null : i)}
                            renderExpandedRow={(_row, i) => (
                                <ExpandedComponents index={i} control={control} setValue={setValue} salesProducts={salesProducts} />
                            )}
                            showTotals={[
                                { colKey: "orderQuantity", value: (watchedItems || []).reduce((s: number, it: any) => s + (Number(it?.orderQuantity) || 0), 0) },
                            ]}
                            visibleRows={10}
                        />
                    </div>

                    {/* ── Narration ── */}
                    <div className="w-full sm:w-1/2">
                        <Controller name="narration" control={control} render={({ field }) => (
                            <TextArea label="Narration" name="narration" value={field.value ?? ""} placeholder="Enter narration..." rows={2} onChange={field.onChange} />
                        )} />
                    </div>

                </form>

                {/* ── Actions ── */}
                <div className="flex justify-end gap-3 px-5 py-3 border-t border-line">
                    <CustomButton text="Clear" variant="danger" onClick={() => reset(isEditMode && editValuesRef.current ? editValuesRef.current : defaultValues)} disabled={isSubmitting} />
                    <CustomButton variant="secondary" text={isSubmitting ? "Saving..." : "Save as Draft"} type="button" onClick={() => { cleanEmptyRows(); handleSubmit((data) => onSubmit(data as unknown as SalesOrderFormValues, "draft"))(); }} disabled={isSubmitting} />
                    <CustomButton text={isSubmitting ? "Saving..." : "Save Order"} type="button" onClick={() => { cleanEmptyRows(); handleSubmit((data) => onSubmit(data as unknown as SalesOrderFormValues, "order"))(); }} disabled={isSubmitting} />
                </div>
            </div>
        </div>
        <CommonConfirmModal
            show={saveConfirmOpen}
            onHide={() => { setSaveConfirmOpen(false); setTimeout(() => lastFocusedRef.current?.focus(), 50); }}
            onConfirm={() => { setSaveConfirmOpen(false); handleSaveRef.current(); }}
            onCancel={() => { setSaveConfirmOpen(false); navigate("/sales-order"); }}
            title="Discard Changes?"
            message="Are you sure you want to leave? Any unsaved order details will be lost."
            warningText="Save to keep your changes, or Discard to leave."
            cancelText="Discard"
            cancelVariant="danger"
            confirmText="Save"
            confirmVariant="primary"
            confirmIcon={FaCheck}
            isDangerous={false}
        />
        </>
    );
};

export default SalesOrderForm;
