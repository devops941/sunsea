import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import BackButton from "../../../components/ui/BackButton/BackButton";
import DetailBox from "../../../components/ui/DetailBox/DetailBox";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { salesOrderService, type SalesOrder } from "../../../services/salesOrderService";
import { salesProductService } from "../../../services/salesProductService";
import { parseChargeRowsFromNarration, DEFAULT_CHARGE_OPTIONS as CHARGE_OPTIONS } from "../../../components/sales/AdditionalChargesTable";

// ─── Formatting helpers ─────────────────────────────────────────────────
const formatMoney = (val: string | number | null | undefined) => {
    const n = Number(val ?? 0);
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (val: string | null | undefined) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (val: string | null | undefined) => {
    if (!val) return "—";
    return new Date(val).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const getOrderSourceLabel = (src?: string | null, legacyType?: string | null) => {
    if (!src && !legacyType) return "—";
    const map: Record<string, string> = {
        SALES_PERSON: "Sales Person",
        TELE_CALLING: "Tele Calling",
        WALK_IN: "Walk-in",
        WHATSAPP: "WhatsApp",
        REFERRAL: "Referral",
        REPEAT_ORDER: "Repeat Order",
        DEALER_AGENT: "Dealer / Agent",
        salesperson: "Sales Person",
        telephone: "Telephonic Enquiry",
        website: "Website",
        reference: "Reference",
    };
    if (src && map[src]) return map[src];
    if (legacyType && map[legacyType]) return map[legacyType];
    return src || legacyType || "—";
};

const getResponsiblePerson = (order: any) => {
    if (order.sourceEmployee) {
        const emp = order.sourceEmployee;
        return emp.fullName || emp.name || emp.empCode || `Employee #${emp.id}`;
    }
    if (order.salesPersonName) {
        return order.salesPersonName;
    }
    return null;
};

const getReferralInfo = (order: any) => {
    if (order.referredByCustomer) {
        const refCust = order.referredByCustomer;
        return refCust.displayName || refCust.firmName;
    }
    if (order.referredByName) {
        return order.referredByName;
    }
    if (order.referenceText) {
        return order.referenceText;
    }
    return null;
};

// ─── Status → pill modifier map ──
const STATUS_MODIFIER: Record<string, "active" | "inactive" | "hold"> = {
    DRAFT: "hold",
    CONFIRMED: "active",
    IN_PRODUCTION: "hold",
    PENDING_CUSTOMER_APPROVAL: "hold",
    CUSTOMER_REJECTED: "inactive",
    COMPLETED: "active",
};

const APPROVAL_MODIFIER: Record<string, "active" | "inactive" | "hold"> = {
    PENDING: "hold",
    APPROVED: "active",
    REJECTED: "inactive",
};

const getBadgeColor = (status: string | null | undefined, modifierMap: Record<string, "active" | "inactive" | "hold">) => {
    const modifier = modifierMap[status || ""] || "hold";
    if (modifier === "active") return "bg-green-500/10 text-green-500 border-green-500/20";
    if (modifier === "inactive") return "bg-red-500/10 text-red-500 border-red-500/20";
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
};

const StatusPill: React.FC<{ status?: string | null; modifierMap: Record<string, "active" | "inactive" | "hold"> }> = ({ status, modifierMap }) => {
    if (!status) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-card-2 text-ink-subtle border border-line-soft">—</span>;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeColor(status, modifierMap)}`}>
            {status.replace(/_/g, " ")}
        </span>
    );
};

// ─── Component ─────────────────────────────────────────────────────────
const SalesOrderDetail: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: idParam } = useParams<{ id: string }>();

    const [order, setOrder] = useState<SalesOrder | null>((location.state as SalesOrder) || null);
    const [salesProducts, setSalesProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(!location.state);

    useEffect(() => {
        const id = idParam ? Number(idParam) : (location.state as SalesOrder)?.id;
        if (!id) {
            toast.error("No order specified");
            navigate("/sales-order");
            return;
        }

        const load = async () => {
            try {
                const [data, spData] = await Promise.all([
                    salesOrderService.fetchById(id),
                    salesProductService.fetchAll().catch(() => []),
                ]);
                setOrder(data);
                setSalesProducts(Array.isArray(spData) ? spData : []);
            } catch (error) {
                toast.error("Failed to load order details");
                navigate("/sales-order");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [idParam, location.state, navigate]);

    const isInterState = Boolean((order as any)?.isInterState);

    const groupedItems = useMemo(() => {
        if (!order?.items || order.items.length === 0) return [];
        const orderItems = order.items;

        if (!salesProducts || salesProducts.length === 0) {
            return orderItems.map((item: any) => {
                const qty = Number(item.quantity || 0);
                const unitPrice = Number(item.unitPrice ?? item.rate ?? 0);
                const lineTotal = Number(item.lineTotal ?? item.taxableAmount ?? (qty * unitPrice));
                const cgst = Number(item.cgstAmount ?? 0);
                const sgst = Number(item.sgstAmount ?? 0);
                const igst = Number(item.igstAmount ?? 0);
                const gstRate = Number(item.igstRate || (Number(item.cgstRate || 0) + Number(item.sgstRate || 0)) || 0);
                const gstAmount = igst > 0 ? igst : (cgst + sgst);
                return {
                    id: item.id || item.productId,
                    productName: item.product?.productName || `Product #${item.productId}`,
                    productCode: item.product?.productCode,
                    quantity: qty,
                    unitPrice,
                    subtotal: lineTotal,
                    cgstAmount: cgst > 0 ? cgst : (gstAmount > 0 && !isInterState ? gstAmount / 2 : 0),
                    sgstAmount: sgst > 0 ? sgst : (gstAmount > 0 && !isInterState ? gstAmount / 2 : 0),
                    igstAmount: igst > 0 ? igst : (gstAmount > 0 && isInterState ? gstAmount : 0),
                    cgstRate: Number(item.cgstRate || (gstRate / 2) || 0),
                    sgstRate: Number(item.sgstRate || (gstRate / 2) || 0),
                    igstRate: Number(item.igstRate || gstRate || 0),
                    gstRate,
                    gstAmount,
                    totalAmount: lineTotal + gstAmount,
                    components: [],
                };
            });
        }

        const result: Array<{
            id: any;
            productName: string;
            productCode?: string;
            quantity: number;
            unitPrice: number;
            subtotal: number;
            cgstAmount: number;
            sgstAmount: number;
            igstAmount: number;
            cgstRate: number;
            sgstRate: number;
            igstRate: number;
            gstRate: number;
            gstAmount: number;
            totalAmount: number;
            components: Array<{ name: string; code?: string; perUnit: number; totalQty: number; included: boolean }>;
        }> = [];
        const processedItemIds = new Set<any>();

        // Group order items by salesProductId for exact matching
        const groupedBySp = new Map<string, any[]>();
        orderItems.forEach(oi => {
            const spId = oi.salesProductId ? String(oi.salesProductId) : null;
            if (spId) {
                if (!groupedBySp.has(spId)) groupedBySp.set(spId, []);
                groupedBySp.get(spId)!.push(oi);
            }
        });

        // Process items grouped by salesProductId first
        groupedBySp.forEach((items, spIdStr) => {
            const sp = salesProducts.find(s => String(s.id) === spIdStr);
            if (!sp) return;

            const spComps = (sp?.components || []).filter(
                (comp: any) => comp.componentProduct?.productType === "SALES_PRODUCTION"
            );
            if (spComps.length === 0) return;

            items.forEach(oi => processedItemIds.add(oi.id || oi.productId));
            const matchingOrderItems = items;

            {

                const calcOrderQty = Math.max(...matchingOrderItems.map(oi => {
                    const matchingSpComp = spComps.find((c: any) => String(c.componentProductId) === String(oi.productId));
                    const perUnit = Number(matchingSpComp?.quantity || 1);
                    return Math.round(Number(oi.quantity || 1) / perUnit);
                }), 1);

                const itemSubtotal = matchingOrderItems.reduce((s, oi) => s + Number(oi.lineTotal ?? oi.taxableAmount ?? (Number(oi.quantity || 0) * Number(oi.unitPrice ?? oi.rate ?? 0))), 0);
                const itemCgst = matchingOrderItems.reduce((s, oi) => s + Number(oi.cgstAmount || 0), 0);
                const itemSgst = matchingOrderItems.reduce((s, oi) => s + Number(oi.sgstAmount || 0), 0);
                const itemIgst = matchingOrderItems.reduce((s, oi) => s + Number(oi.igstAmount || 0), 0);
                const itemGstAmount = itemIgst > 0 ? itemIgst : (itemCgst + itemSgst);
                const itemUnitPrice = calcOrderQty > 0 ? (itemSubtotal / calcOrderQty) : 0;
                const maxGstRate = Math.max(...matchingOrderItems.map(oi => Number(oi.igstRate || (Number(oi.cgstRate || 0) + Number(oi.sgstRate || 0)) || 0)), 0);

                const components = spComps.map((c: any) => {
                    const compPerUnit = Number(c.quantity || 1);
                    const oi = matchingOrderItems.find(
                        item => String(item.productId) === String(c.componentProductId)
                    );
                    const totalQty = oi ? Number(oi.quantity || 0) : 0;
                    const included = Boolean(oi && totalQty > 0);
                    return {
                        name: c.componentProduct?.productName || c.componentProduct?.productCode || `Product #${c.componentProductId}`,
                        code: c.componentProduct?.productCode,
                        perUnit: compPerUnit,
                        totalQty,
                        included,
                    };
                });

                result.push({
                    id: `sp-${sp.id}`,
                    productName: sp.salesProductName || sp.salesProductCode,
                    productCode: sp.salesProductCode,
                    quantity: calcOrderQty,
                    unitPrice: itemUnitPrice,
                    subtotal: itemSubtotal,
                    cgstAmount: itemCgst > 0 ? itemCgst : (itemGstAmount > 0 && !isInterState ? itemGstAmount / 2 : 0),
                    sgstAmount: itemSgst > 0 ? itemSgst : (itemGstAmount > 0 && !isInterState ? itemGstAmount / 2 : 0),
                    igstAmount: itemIgst > 0 ? itemIgst : (itemGstAmount > 0 && isInterState ? itemGstAmount : 0),
                    cgstRate: itemCgst > 0 && itemSubtotal > 0 ? (itemCgst / itemSubtotal) * 100 : (maxGstRate / 2),
                    sgstRate: itemSgst > 0 && itemSubtotal > 0 ? (itemSgst / itemSubtotal) * 100 : (maxGstRate / 2),
                    igstRate: itemIgst > 0 && itemSubtotal > 0 ? (itemIgst / itemSubtotal) * 100 : maxGstRate,
                    gstRate: maxGstRate,
                    gstAmount: itemGstAmount,
                    totalAmount: itemSubtotal + itemGstAmount,
                    components,
                });
            }
        });

        // Fallback: match remaining items without salesProductId using old component-matching logic
        salesProducts.forEach(sp => {
            const spComps = (sp?.components || []).filter(
                (comp: any) => comp.componentProduct?.productType === "SALES_PRODUCTION"
            );
            if (spComps.length === 0) return;

            const matchingOrderItems = orderItems.filter(oi =>
                !processedItemIds.has(oi.id || oi.productId) &&
                !oi.salesProductId &&
                spComps.some((c: any) => String(c.componentProductId) === String(oi.productId))
            );

            if (matchingOrderItems.length > 0) {
                matchingOrderItems.forEach(oi => processedItemIds.add(oi.id || oi.productId));

                const calcOrderQty = Math.max(...matchingOrderItems.map(oi => {
                    const matchingSpComp = spComps.find((c: any) => String(c.componentProductId) === String(oi.productId));
                    const perUnit = Number(matchingSpComp?.quantity || 1);
                    return Math.round(Number(oi.quantity || 1) / perUnit);
                }), 1);

                const itemSubtotal = matchingOrderItems.reduce((s, oi) => s + Number(oi.lineTotal ?? oi.taxableAmount ?? (Number(oi.quantity || 0) * Number(oi.unitPrice ?? oi.rate ?? 0))), 0);
                const itemCgst = matchingOrderItems.reduce((s, oi) => s + Number(oi.cgstAmount || 0), 0);
                const itemSgst = matchingOrderItems.reduce((s, oi) => s + Number(oi.sgstAmount || 0), 0);
                const itemIgst = matchingOrderItems.reduce((s, oi) => s + Number(oi.igstAmount || 0), 0);
                const itemGstAmount = itemIgst > 0 ? itemIgst : (itemCgst + itemSgst);
                const itemUnitPrice = calcOrderQty > 0 ? (itemSubtotal / calcOrderQty) : 0;
                const maxGstRate = Math.max(...matchingOrderItems.map(oi => Number(oi.igstRate || (Number(oi.cgstRate || 0) + Number(oi.sgstRate || 0)) || 0)), 0);

                const components = spComps.map((c: any) => {
                    const compPerUnit = Number(c.quantity || 1);
                    const oi = matchingOrderItems.find(
                        item => String(item.productId) === String(c.componentProductId)
                    );
                    const totalQty = oi ? Number(oi.quantity || 0) : 0;
                    return {
                        name: c.componentProduct?.productName || c.componentProduct?.productCode || `Product #${c.componentProductId}`,
                        code: c.componentProduct?.productCode,
                        perUnit: compPerUnit,
                        totalQty,
                        included: Boolean(oi && totalQty > 0),
                    };
                });

                result.push({
                    id: `sp-${sp.id}`,
                    productName: sp.salesProductName || sp.salesProductCode,
                    productCode: sp.salesProductCode,
                    quantity: calcOrderQty,
                    unitPrice: itemUnitPrice,
                    subtotal: itemSubtotal,
                    cgstAmount: itemCgst > 0 ? itemCgst : (itemGstAmount > 0 && !isInterState ? itemGstAmount / 2 : 0),
                    sgstAmount: itemSgst > 0 ? itemSgst : (itemGstAmount > 0 && !isInterState ? itemGstAmount / 2 : 0),
                    igstAmount: itemIgst > 0 ? itemIgst : (itemGstAmount > 0 && isInterState ? itemGstAmount : 0),
                    cgstRate: itemCgst > 0 && itemSubtotal > 0 ? (itemCgst / itemSubtotal) * 100 : (maxGstRate / 2),
                    sgstRate: itemSgst > 0 && itemSubtotal > 0 ? (itemSgst / itemSubtotal) * 100 : (maxGstRate / 2),
                    igstRate: itemIgst > 0 && itemSubtotal > 0 ? (itemIgst / itemSubtotal) * 100 : maxGstRate,
                    gstRate: maxGstRate,
                    gstAmount: itemGstAmount,
                    totalAmount: itemSubtotal + itemGstAmount,
                    components,
                });
            }
        });

        // Any remaining items that don't belong to a composite sales product
        const remainingItems = orderItems.filter(oi => !processedItemIds.has(oi.id || oi.productId));
        remainingItems.forEach(oi => {
            const qty = Number(oi.quantity || 0);
            const unitPrice = Number(oi.unitPrice ?? oi.rate ?? 0);
            const lineTotal = Number(oi.lineTotal ?? oi.taxableAmount ?? (qty * unitPrice));
            const cgst = Number(oi.cgstAmount ?? 0);
            const sgst = Number(oi.sgstAmount ?? 0);
            const igst = Number(oi.igstAmount ?? 0);
            const gstRate = Number(oi.igstRate || (Number(oi.cgstRate || 0) + Number(oi.sgstRate || 0)) || 0);
            const gstAmount = igst > 0 ? igst : (cgst + sgst);
            result.push({
                id: oi.id || oi.productId,
                productName: oi.product?.productName || `Product #${oi.productId}`,
                productCode: oi.product?.productCode,
                quantity: qty,
                unitPrice,
                subtotal: lineTotal,
                cgstAmount: cgst > 0 ? cgst : (gstAmount > 0 && !isInterState ? gstAmount / 2 : 0),
                sgstAmount: sgst > 0 ? sgst : (gstAmount > 0 && !isInterState ? gstAmount / 2 : 0),
                igstAmount: igst > 0 ? igst : (gstAmount > 0 && isInterState ? gstAmount : 0),
                cgstRate: Number(oi.cgstRate || (gstRate / 2) || 0),
                sgstRate: Number(oi.sgstRate || (gstRate / 2) || 0),
                igstRate: Number(oi.igstRate || gstRate || 0),
                gstRate,
                gstAmount,
                totalAmount: lineTotal + gstAmount,
                components: [],
            });
        });

        return result;
    }, [order?.items, salesProducts, isInterState]);

    // ── Financial Totals ────────────────────────────────────────────────
    // ── All totals read directly from backend — no frontend recalculation ──
    const calcSubtotal = Number(order?.subtotal || 0);
    const calcDiscount = Number(order?.totalDiscount || 0);
    const discValue = Number((order as any)?.orderDiscountValue || 0);
    const discType = (order as any)?.orderDiscountType || "PERCENT";
    const taxableAmount = Math.max(0, calcSubtotal - calcDiscount);
    const calcCgst = Number(order?.totalCgst || 0);
    const calcSgst = Number(order?.totalSgst || 0);
    const calcIgst = Number(order?.totalIgst || 0);
    const calcTotalTax = Number(order?.totalTax || 0);
    const calcNetAmount = Number(order?.netAmount || 0);
    const hasGst = calcTotalTax > 0;

    // Parse extra charges from narration (display only)
    const chargeRows = useMemo(() => {
        if (!order) return [];
        return parseChargeRowsFromNarration((order as any).narration);
    }, [order]);

    const hasAnyPricing = calcSubtotal > 0 || calcNetAmount > 0;

    if (loading || !order) {
        return <CommonLoader text="Loading order details..." fullScreen={false} />;
    }

    const customer = order.customer as any;

    const isValidAddr = (val: any) => Boolean(val && typeof val === "string" && val.trim() !== "" && val.trim() !== "-");

    const billingLine = isValidAddr(order.billingAddressLine1)
        ? order.billingAddressLine1
        : customer?.billingAddressLine1 || customer?.addresses?.[0]?.address?.addressLine1 || "—";

    const billingCity = isValidAddr(order.billingCity)
        ? order.billingCity
        : customer?.billingCity || customer?.addresses?.[0]?.address?.city || "";

    const billingState = isValidAddr(order.billingState)
        ? order.billingState
        : customer?.billingState || customer?.addresses?.[0]?.address?.state || "";

    const billingPincode = isValidAddr(order.billingPincode)
        ? order.billingPincode
        : customer?.billingPincode || customer?.addresses?.[0]?.address?.pincode || "";

    const shippingLine = isValidAddr(order.shippingAddressLine1)
        ? order.shippingAddressLine1
        : customer?.shippingAddressLine1 || customer?.addresses?.[1]?.address?.addressLine1 || "";

    const shippingCity = isValidAddr(order.shippingCity)
        ? order.shippingCity
        : customer?.shippingCity || customer?.addresses?.[1]?.address?.city || "";

    const shippingState = isValidAddr(order.shippingState)
        ? order.shippingState
        : customer?.shippingState || customer?.addresses?.[1]?.address?.state || "";

    const shippingPincode = isValidAddr(order.shippingPincode)
        ? order.shippingPincode
        : customer?.shippingPincode || customer?.addresses?.[1]?.address?.pincode || "";

    return (
        <div className="w-full mx-auto space-y-3">
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* ── Page Header ── */}
                <div className="px-4 py-3 border-b border-line bg-card-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-2xl font-bold text-ink m-0">
                                {order.orderNo}
                            </h2>
                            <StatusPill status={order.status} modifierMap={STATUS_MODIFIER} />
                        </div>
                        <div className="flex items-center gap-2">
                            <BackButton text="Back to List" />
                        </div>
                    </div>
                </div>

                <div className="p-4 space-y-3">

                    {/* ── Customer Rejection banner ── */}
                    {order.status === "CUSTOMER_REJECTED" && order.customerRejectionReason && (
                        <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-lg">
                            <div className="text-red-500 font-semibold text-xs uppercase tracking-wide mb-0.5">Customer Rejected this order</div>
                            <p className="text-ink text-sm m-0">{order.customerRejectionReason}</p>
                        </div>
                    )}

                    {/* ── Order Information, Customer Details & Addresses ── */}
                    <div className="bg-card-2 p-3 rounded-xl border border-line-soft space-y-3">
                        {/* ── 1. Order Information ── */}
                        <div>
                            <h3 className="text-sm font-semibold text-ink mb-2">Order Information</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                <DetailBox label="Order No" value={order.orderNo} />
                                <DetailBox label="Order Date" value={formatDate(order.orderDate)} />
                                <DetailBox label="Order Source" value={getOrderSourceLabel((order as any).orderSource, order.orderType)} />
                                {getResponsiblePerson(order) && (
                                    <DetailBox label="Responsible Employee" value={getResponsiblePerson(order)!} />
                                )}
                                {getReferralInfo(order) && (
                                    <DetailBox label="Referral / Dealer" value={getReferralInfo(order)!} />
                                )}
                                {(order as any).narration && (
                                    <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                                        <DetailBox label="Narration" value={(order as any).narration} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-line-soft" />

                        {/* ── 2. Customer Details ── */}
                        <div>
                            <h3 className="text-sm font-semibold text-ink mb-2">Customer Details</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                <DetailBox label="Firm / Legal Name" value={customer?.firmName || customer?.displayName || "—"} />
                                <DetailBox label="Display Name" value={customer?.displayName || "—"} />
                                <DetailBox label="Customer Grade" value={customer?.customerGrade?.name || "—"} />
                                <DetailBox label="Customer Type" value={customer?.customerType?.name || "—"} />
                                <DetailBox
                                    label="Mobile Number"
                                    value={
                                        order.mobile ||
                                        (Array.isArray(customer?.mobile)
                                            ? customer.mobile.map((m: any) => m.number).join(", ")
                                            : typeof customer?.mobile === "string" ? customer.mobile : "—")
                                    }
                                />
                                <DetailBox label="Email" value={customer?.email || "—"} />
                                <DetailBox label="GSTIN" value={customer?.gstin || "—"} />
                                <DetailBox label="Credit Limit" value={customer?.creditLimit ? formatMoney(customer.creditLimit) : "—"} />
                            </div>
                        </div>

                        <div className="border-t border-line-soft" />

                        {/* ── 3. Addresses ── */}
                        <div>
                            <h3 className="text-sm font-semibold text-ink mb-2">Addresses</h3>
                            <div className={`grid grid-cols-1 ${["QUOTED", "INVOICED"].includes(order.status || "") ? "sm:grid-cols-2" : ""} gap-3`}>
                                <div className="p-3 bg-card rounded-lg border border-line-soft">
                                    <div className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-2">Billing Address</div>
                                    <div className="text-sm font-semibold text-ink">{billingLine}</div>
                                    {(billingCity || billingState || billingPincode) && (
                                        <div className="text-xs text-ink-muted mt-1">
                                            {[billingCity, billingState].filter(Boolean).join(", ")}{billingPincode ? ` — ${billingPincode}` : ""}
                                        </div>
                                    )}
                                </div>
                                {["QUOTED", "INVOICED"].includes(order.status || "") && (
                                    <div className="p-3 bg-card rounded-lg border border-line-soft">
                                        <div className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1">Shipping Address</div>
                                        {shippingLine ? (
                                            <>
                                                <div className="text-sm font-semibold text-ink">{shippingLine}</div>
                                                <div className="text-xs text-ink-muted mt-1">
                                                    {[shippingCity, shippingState].filter(Boolean).join(", ")}{shippingPincode ? ` — ${shippingPincode}` : ""}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-xs text-ink-subtle italic">Same as Billing Address</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Order Items ── */}
                    <div className="bg-card-2 p-3 rounded-xl border border-line-soft">
                        <h3 className="text-sm font-semibold text-ink mb-2">Order Items</h3>
                        <div className="border border-line rounded-lg overflow-hidden">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="bg-head border-b border-line text-ink">
                                        <th className="py-3 pl-4 pr-2 text-left text-[11px] font-bold uppercase tracking-wider w-10">#</th>
                                        <th className="py-3 px-3 text-left text-[11px] font-bold uppercase tracking-wider">Sales Product</th>
                                        <th className="py-3 px-3 text-center text-[11px] font-bold uppercase tracking-wider w-20">Qty</th>
                                        {hasAnyPricing && (
                                            <>
                                                <th className="py-3 px-3 text-right text-[11px] font-bold uppercase tracking-wider w-28">Unit Price</th>
                                                <th className="py-3 px-3 text-right text-[11px] font-bold uppercase tracking-wider w-28">Subtotal</th>
                                                {hasGst && (
                                                    order.isInterState ? (
                                                        <th className="py-3 px-3 text-right text-[11px] font-bold uppercase tracking-wider w-28">IGST</th>
                                                    ) : (
                                                        <>
                                                            <th className="py-3 px-3 text-right text-[11px] font-bold uppercase tracking-wider w-28">CGST</th>
                                                            <th className="py-3 px-3 text-right text-[11px] font-bold uppercase tracking-wider w-28">SGST</th>
                                                        </>
                                                    )
                                                )}
                                                <th className="py-3 pr-4 pl-3 text-right text-[11px] font-bold uppercase tracking-wider w-32">Total</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line-soft">
                                    {groupedItems.map((item: any, idx: number) => (
                                        <tr key={item.id} className="hover:bg-card/50 transition-colors">
                                            <td className="py-3.5 pl-4 pr-2 text-ink-subtle text-left align-middle">{idx + 1}</td>
                                            <td className="py-3.5 px-3 align-middle">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="font-semibold text-ink text-[15px]">{item.productName}</span>
                                                    {item.components && item.components.length > 0 && (
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {item.components.map((c: any, cIdx: number) => {
                                                                const isExcluded = !c.included || c.totalQty <= 0;
                                                                return (
                                                                    <div
                                                                        key={cIdx}
                                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs border ${
                                                                            isExcluded
                                                                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                                                                : "bg-card text-ink border-line-soft shadow-sm"
                                                                        }`}
                                                                    >
                                                                        <span className={isExcluded ? "line-through opacity-80" : "font-medium"}>
                                                                            {c.name}
                                                                        </span>
                                                                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                                                            isExcluded
                                                                                ? "bg-red-500/20 text-red-400"
                                                                                : "bg-primary/15 text-primary"
                                                                        }`}>
                                                                            {isExcluded ? "0 (Excluded)" : `${c.totalQty}`}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-3 text-center font-bold text-ink text-sm align-middle">{item.quantity}</td>
                                            {hasAnyPricing && (
                                                <>
                                                    <td className="py-3.5 px-3 text-right font-medium text-ink text-sm align-middle">
                                                        {item.unitPrice > 0 ? formatMoney(item.unitPrice) : "—"}
                                                    </td>
                                                    <td className="py-3.5 px-3 text-right font-medium text-ink text-sm align-middle">
                                                        {item.subtotal > 0 ? formatMoney(item.subtotal) : "—"}
                                                    </td>
                                                    {hasGst && (
                                                        order.isInterState ? (
                                                            <td className="py-3.5 px-3 text-right text-sm align-middle">
                                                                <div className="font-medium text-ink">
                                                                    {item.igstAmount > 0 ? formatMoney(item.igstAmount) : (item.gstAmount > 0 ? formatMoney(item.gstAmount) : "—")}
                                                                </div>
                                                                {item.igstRate > 0 && (
                                                                    <div className="text-[11px] text-ink-muted">({Number(item.igstRate).toFixed(2).replace(/\.00$/, "")}%)</div>
                                                                )}
                                                            </td>
                                                        ) : (
                                                            <>
                                                                <td className="py-3.5 px-3 text-right text-sm align-middle">
                                                                    <div className="font-medium text-ink">
                                                                        {item.cgstAmount > 0 ? formatMoney(item.cgstAmount) : (item.gstAmount > 0 ? formatMoney(item.gstAmount / 2) : "—")}
                                                                    </div>
                                                                    {item.cgstRate > 0 && (
                                                                        <div className="text-[11px] text-ink-muted">({Number(item.cgstRate).toFixed(2).replace(/\.00$/, "")}%)</div>
                                                                    )}
                                                                </td>
                                                                <td className="py-3.5 px-3 text-right text-sm align-middle">
                                                                    <div className="font-medium text-ink">
                                                                        {item.sgstAmount > 0 ? formatMoney(item.sgstAmount) : (item.gstAmount > 0 ? formatMoney(item.gstAmount / 2) : "—")}
                                                                    </div>
                                                                    {item.sgstRate > 0 && (
                                                                        <div className="text-[11px] text-ink-muted">({Number(item.sgstRate).toFixed(2).replace(/\.00$/, "")}%)</div>
                                                                    )}
                                                                </td>
                                                            </>
                                                        )
                                                    )}
                                                    <td className="py-3.5 pr-4 pl-3 text-right font-bold text-ink text-sm align-middle">
                                                        {item.totalAmount > 0 ? formatMoney(item.totalAmount) : "—"}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                    {groupedItems.length === 0 && (
                                        <tr>
                                            <td colSpan={hasAnyPricing ? (hasGst ? (order.isInterState ? 7 : 8) : 6) : 3} className="py-10 text-center text-ink-subtle text-sm">No items found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* ── Totals / Summary Card ── */}
                        {hasAnyPricing && (
                            <div className="flex justify-end mt-5">
                                <div className="w-full max-w-sm border border-line rounded-xl p-4 bg-card shadow-xs">
                                    <h4 className="text-xs font-bold text-ink uppercase tracking-wide mb-3 pb-2 border-b border-line-soft">
                                        {order.status === "QUOTED" ? "Quotation Summary" : "Sales Order Summary"}
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between text-ink-subtle">
                                            <span>Subtotal</span>
                                            <span className="text-ink font-semibold">{formatMoney(calcSubtotal)}</span>
                                        </div>

                                        {calcDiscount > 0 && (
                                            <>
                                                <div className="flex justify-between text-red-500 font-medium">
                                                    <span>Discount {discValue > 0 ? `(${discValue}${discType === "PERCENT" ? "%" : " Flat"})` : ""}</span>
                                                    <span>- {formatMoney(calcDiscount)}</span>
                                                </div>
                                                <div className="flex justify-between text-ink-subtle text-xs">
                                                    <span>Taxable Amount</span>
                                                    <span className="text-ink font-medium">{formatMoney(taxableAmount)}</span>
                                                </div>
                                            </>
                                        )}

                                        {hasGst && (order.isInterState ? (
                                            <div className="flex justify-between text-ink-subtle">
                                                <span>IGST</span>
                                                <span className="text-ink font-medium">+ {formatMoney(calcIgst || calcTotalTax)}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between text-ink-subtle">
                                                    <span>CGST</span>
                                                    <span className="text-ink font-medium">+ {formatMoney(calcCgst || (calcTotalTax / 2))}</span>
                                                </div>
                                                <div className="flex justify-between text-ink-subtle">
                                                    <span>SGST</span>
                                                    <span className="text-ink font-medium">+ {formatMoney(calcSgst || (calcTotalTax / 2))}</span>
                                                </div>
                                            </>
                                        ))}

                                        {chargeRows.filter(r => Number(r.amount) > 0).map(row => {
                                            const opt = CHARGE_OPTIONS.find(o => o.value === row.type);
                                            const isAdd = opt?.sign === 1;
                                            return (
                                                <div key={row.id} className={`flex justify-between text-xs ${isAdd ? "text-emerald-600" : "text-red-600"}`}>
                                                    <span>{opt?.label ?? row.type}</span>
                                                    <span>{isAdd ? "+ " : "- "}{formatMoney(Number(row.amount))}</span>
                                                </div>
                                            );
                                        })}

                                        <div className="flex justify-between pt-3 border-t border-line mt-2 text-ink items-center">
                                            <span className="text-base font-bold">Net Amount</span>
                                            <span className="text-lg font-bold text-primary">{formatMoney(calcNetAmount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default SalesOrderDetail;
