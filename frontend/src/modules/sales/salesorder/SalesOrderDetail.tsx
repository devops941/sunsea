// src/pages/sales/SalesOrderDetail/SalesOrderDetail.tsx
import React, { useEffect, useState } from "react";
import { FaExclamationTriangle } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import BackButton from "../../../components/ui/BackButton/BackButton";
import DetailBox from "../../../components/ui/DetailBox/DetailBox";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { salesOrderService, type SalesOrder } from "../../../services/salesOrderService";
import { getUnitPrice } from "../../../utils/pricingUtils";

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

// ─── Status → pill modifier map ──
const STATUS_MODIFIER: Record<string, "active" | "inactive" | "hold"> = {
    DRAFT: "hold",
    CONFIRMED: "active",
    PENDING_MD_APPROVAL: "hold",
    MD_REJECTED: "inactive",
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

const PRODUCTION_MODIFIER: Record<string, "active" | "inactive" | "hold"> = {
    NOT_STARTED: "hold",
    IN_PROGRESS: "hold",
    COMPLETED: "active",
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
                const data = await salesOrderService.fetchById(id);
                setOrder(data);
            } catch (error) {
                toast.error("Failed to load order details");
                navigate("/sales-order");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [idParam, location.state, navigate]);

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

    const isEstimated = (order as any)._source === "estimated";
    // Amounts are calculated only when the order is submitted for approval (Send to Quotation).
    // Both DRAFT and CONFIRMED are pre-quotation states — hide all pricing.
    const showPricing = !["DRAFT", "CONFIRMED"].includes(order.status ?? "");

    return (
        <div className="w-full mx-auto space-y-6">
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* ── Page Header ── */}
                <div className="px-6 py-4 border-b border-line bg-card-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-2xl font-bold text-ink m-0">
                                {order.orderNo}
                            </h2>
                            <StatusPill status={order.status} modifierMap={STATUS_MODIFIER} />
                        </div>
                        <div>
                            <BackButton text="Back to List" />
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* ── Rejection reason banner ── */}
                    {order.status === "MD_REJECTED" && order.mdRejectionReason && (
                        <div className="bg-red-500/10 border-l-4 border-red-500 p-4 flex items-start gap-3 rounded-r-lg">
                            <FaExclamationTriangle className="text-red-500 mt-0.5 text-base shrink-0" />
                            <div>
                                <div className="text-red-500 font-semibold text-xs uppercase tracking-wide">MD Rejected this order</div>
                                <p className="text-ink text-sm m-0 mt-0.5">{order.mdRejectionReason}</p>
                            </div>
                        </div>
                    )}
                    {order.status === "CUSTOMER_REJECTED" && order.customerRejectionReason && (
                        <div className="bg-red-500/10 border-l-4 border-red-500 p-4 flex items-start gap-3 rounded-r-lg">
                            <FaExclamationTriangle className="text-red-500 mt-0.5 text-base shrink-0" />
                            <div>
                                <div className="text-red-500 font-semibold text-xs uppercase tracking-wide">Customer Rejected this order</div>
                                <p className="text-ink text-sm m-0 mt-0.5">{order.customerRejectionReason}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* ── Left column: main details ── */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* ── Order Information ── */}
                            <div className="bg-card-2 p-5 rounded-xl border border-line-soft">
                                <h3 className="text-base font-semibold text-ink mb-4">
                                    Order Information
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <DetailBox label="Order No" value={order.orderNo} />
                                    <DetailBox label="Order Date" value={formatDate(order.orderDate)} />
                                    <DetailBox label="Order Source Platform" value={order.orderType || "—"} />
                                    <DetailBox label="Salesperson Name" value={order.salesPersonName || "—"} />
                                    {order.referenceText && <DetailBox label="Reference Name" value={order.referenceText} />}
                                    <DetailBox
                                        label="Production Status"
                                        value={<div className="mt-1"><StatusPill status={(order as any).productionStatus} modifierMap={PRODUCTION_MODIFIER} /></div>}
                                    />
                                    {(order as any).narration && (
                                        <div className="col-span-2 sm:col-span-3">
                                            <DetailBox label="Narration" value={(order as any).narration} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Customer Details ── */}
                            <div className="bg-card-2 p-5 rounded-xl border border-line-soft">
                                <h3 className="text-base font-semibold text-ink mb-4">
                                    Customer Details
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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

                            {/* ── Addresses ── */}
                            <div className="bg-card-2 p-5 rounded-xl border border-line-soft">
                                <h3 className="text-base font-semibold text-ink mb-4">
                                    Addresses
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-3 bg-card rounded-lg border border-line-soft">
                                        <div className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1">Billing Address</div>
                                        <div className="text-sm font-semibold text-ink">{billingLine}</div>
                                        {(billingCity || billingState || billingPincode) && (
                                            <div className="text-xs text-ink-muted mt-0.5">
                                                {[billingCity, billingState].filter(Boolean).join(", ")} {billingPincode ? `— ${billingPincode}` : ""}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 bg-card rounded-lg border border-line-soft">
                                        <div className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider mb-1">Shipping Address</div>
                                        {shippingLine ? (
                                            <>
                                                <div className="text-sm font-semibold text-ink">{shippingLine}</div>
                                                <div className="text-xs text-ink-muted mt-0.5">
                                                    {[shippingCity, shippingState].filter(Boolean).join(", ")} {shippingPincode ? `— ${shippingPincode}` : ""}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-xs text-ink-subtle italic">Same as Billing Address</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── Order Items Table ── */}
                            <div className="bg-card-2 p-5 rounded-xl border border-line-soft">
                                <h3 className="text-base font-semibold text-ink mb-4">
                                    Order Items
                                </h3>
                                <div className="border border-line rounded-lg overflow-hidden">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-head border-b border-line text-ink">
                                                <th className="py-3 pl-4 pr-2 text-left text-[11px] font-bold uppercase tracking-wider w-8">#</th>
                                                <th className="py-3 px-2 text-left text-[11px] font-bold uppercase tracking-wider">Product</th>
                                                <th className="py-3 px-2 text-right text-[11px] font-bold uppercase tracking-wider">Qty</th>
                                                {showPricing && isEstimated && (
                                                    <>
                                                        <th className="py-3 px-2 text-right text-[11px] font-bold uppercase tracking-wider">Est. Rate</th>
                                                        <th className="py-3 pr-4 pl-2 text-right text-[11px] font-bold uppercase tracking-wider">Line Total</th>
                                                    </>
                                                )}
                                                {showPricing && !isEstimated && (
                                                    <>
                                                        <th className="py-3 px-2 text-right text-[11px] font-bold uppercase tracking-wider">Unit Price</th>
                                                        {order.isInterState ? (
                                                            <th className="py-3 px-2 text-right text-[11px] font-bold uppercase tracking-wider">IGST</th>
                                                        ) : (
                                                            <>
                                                                <th className="py-3 px-2 text-right text-[11px] font-bold uppercase tracking-wider">CGST</th>
                                                                <th className="py-3 px-2 text-right text-[11px] font-bold uppercase tracking-wider">SGST</th>
                                                            </>
                                                        )}
                                                        <th className="py-3 pr-4 pl-2 text-right text-[11px] font-bold uppercase tracking-wider">Line Total</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line-soft">
                                            {order.items?.map((item: any, idx: number) => {
                                                const unitPrice = getUnitPrice(item);
                                                const qty = Number(item.quantity || 0);
                                                const lineSubtotal = Number(item.lineTotal || (Number(unitPrice) * qty));
                                                return (
                                                    <tr key={item.id} className="hover:bg-card/50 transition-colors">
                                                        <td className="py-3 pl-4 pr-2 text-ink-subtle">{idx + 1}</td>
                                                        <td className="py-3 px-2">
                                                            <div className="font-semibold text-ink">{item.product?.productName || `Product #${item.productId}`}</div>
                                                            {item.product?.productCode && (
                                                                <div className="text-ink-subtle text-xs">{item.product.productCode}</div>
                                                            )}
                                                        </td>

                                                        <td className="py-3 px-2 text-right text-ink font-medium">{qty}</td>

                                                        {/* Estimated order columns */}
                                                        {showPricing && isEstimated && (
                                                            <>
                                                                <td className="py-3 px-2 text-right text-ink font-medium">
                                                                    {formatMoney(item.estimatedRate ?? 0)}
                                                                </td>
                                                                <td className="py-3 pr-4 pl-2 text-right font-semibold text-ink">
                                                                    {formatMoney(item.lineTotal ?? (Number(item.estimatedRate ?? 0) * qty))}
                                                                </td>
                                                            </>
                                                        )}

                                                        {/* GST order columns */}
                                                        {showPricing && !isEstimated && (
                                                            <>
                                                                <td className="py-3 px-2 text-right text-ink font-medium">{formatMoney(unitPrice)}</td>
                                                                {order.isInterState ? (
                                                                    <td className="py-3 px-2 text-right text-ink">
                                                                        {formatMoney(item.igstAmount || 0)}
                                                                        <div className="text-ink-subtle text-xs">({item.igstRate || 0}%)</div>
                                                                    </td>
                                                                ) : (
                                                                    <>
                                                                        <td className="py-3 px-2 text-right text-ink">
                                                                            {formatMoney(item.cgstAmount || 0)}
                                                                            <div className="text-ink-subtle text-xs">({item.cgstRate || 0}%)</div>
                                                                        </td>
                                                                        <td className="py-3 px-2 text-right text-ink">
                                                                            {formatMoney(item.sgstAmount || 0)}
                                                                            <div className="text-ink-subtle text-xs">({item.sgstRate || 0}%)</div>
                                                                        </td>
                                                                    </>
                                                                )}
                                                                <td className="py-3 pr-4 pl-2 text-right font-semibold text-ink">{formatMoney(lineSubtotal)}</td>
                                                            </>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                            {(!order.items || order.items.length === 0) && (
                                                <tr>
                                                    <td colSpan={10} className="py-8 text-center text-ink-subtle text-sm">
                                                        No items found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* ── Right column: sticky approval status + totals ── */}
                        <div className="space-y-6 sticky top-6 self-start">

                            {/* ── Approval Status ── */}
                            <div className="bg-card-2 rounded-xl p-5 border border-line-soft">
                                <h3 className="text-base font-semibold text-ink mb-4">
                                    Approval Status
                                </h3>

                                <div className="mb-4">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">MD Approval</span>
                                        <StatusPill status={order.mdApprovalStatus} modifierMap={APPROVAL_MODIFIER} />
                                    </div>
                                    {order.mdApprovedAt && (
                                        <div className="text-ink-subtle text-xs mt-1">Decided on {formatDateTime(order.mdApprovedAt)}</div>
                                    )}
                                    {order.mdRejectionReason && (
                                        <div className="text-red-500 text-xs mt-1">Reason: {order.mdRejectionReason}</div>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-line-soft">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">Customer Approval</span>
                                        <StatusPill status={order.customerApprovalStatus} modifierMap={APPROVAL_MODIFIER} />
                                    </div>
                                    {order.customerApprovedAt && (
                                        <div className="text-ink-subtle text-xs mt-1">Decided on {formatDateTime(order.customerApprovedAt)}</div>
                                    )}
                                    {order.customerRejectionReason && (
                                        <div className="text-red-500 text-xs mt-1">Reason: {order.customerRejectionReason}</div>
                                    )}
                                </div>
                            </div>

                            {/* ── Amount Summary ── */}
                            {showPricing && (
                                <div className="bg-card-2 rounded-xl p-5 border border-line-soft">
                                    <h3 className="text-base font-semibold text-ink mb-4">Amount Summary</h3>
                                    <div className="space-y-2.5 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-ink-muted">Subtotal</span>
                                            <span className="text-ink font-semibold">{formatMoney(order.subtotal)}</span>
                                        </div>

                                        {order.isInterState ? (
                                            <div className="flex justify-between text-green-500">
                                                <span>IGST</span>
                                                <span className="font-semibold">+ {formatMoney(order.totalIgst || order.totalGst || 0)}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between text-green-500">
                                                    <span>CGST</span>
                                                    <span className="font-semibold">+ {formatMoney(order.totalCgst || (Number(order.totalGst || 0) / 2))}</span>
                                                </div>
                                                <div className="flex justify-between text-green-500">
                                                    <span>SGST</span>
                                                    <span className="font-semibold">+ {formatMoney(order.totalSgst || (Number(order.totalGst || 0) / 2))}</span>
                                                </div>
                                            </>
                                        )}

                                        {Number(order.totalDiscount) !== 0 && (
                                            <div className="flex justify-between text-red-500">
                                                <span>Discount</span>
                                                <span className="font-semibold">− {formatMoney(order.totalDiscount)}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between pt-3 mt-3 border-t border-line-soft">
                                            <span className="font-bold text-ink text-base">Net Amount</span>
                                            <span className="font-bold text-xl text-primary">{formatMoney(order.netAmount)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesOrderDetail;
