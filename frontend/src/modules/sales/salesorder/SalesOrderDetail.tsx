// src/pages/sales/SalesOrderDetail/SalesOrderDetail.tsx
import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaUser, FaMapMarkerAlt, FaBoxOpen, FaCheckCircle, FaCircleNotch, FaExclamationTriangle, FaFileAlt, FaCalendarAlt, FaTruck, FaGlobe, FaInfoCircle } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import CustomButton from "../../../components/ui/Button/Button";
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

const COLOR_TYPE_LABELS: Record<string, string> = {
    sc: "Single Color",
    mc: "Multi Color",
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
    if (modifier === "active") return "bg-green-100 text-green-800 border-green-200";
    if (modifier === "inactive") return "bg-red-100 text-red-800 border-red-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
};

const StatusPill: React.FC<{ status?: string | null; modifierMap: Record<string, "active" | "inactive" | "hold"> }> = ({ status, modifierMap }) => {
    if (!status) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">—</span>;
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
            navigate("/quatation-order");
            return;
        }

        const load = async () => {
            try {
                const data = await salesOrderService.fetchById(id);
                setOrder(data);
            } catch (error) {
                toast.error("Failed to load order details");
                navigate("/quatation-order");
            } finally {
                setLoading(false);
            }
        };

        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idParam]);

    if (loading || !order) {
        return <CommonLoader text="Loading order details..." fullScreen={false} />;
    }
    return (
        <div className="w-full mx-auto">
            <div className="bg-white  border border-gray-200">
                {/* ── Page Header ── */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-xl font-bold text-gray-800 m-0">
                                {order.orderNo}
                            </h2>
                            <StatusPill status={order.status} modifierMap={STATUS_MODIFIER} />
                        </div>
                        <div>
                            <BackButton text="Back to List" />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 space-y-6">
                    {/* ── Rejection reason banner ── */}
                    {order.status === "MD_REJECTED" && order.mdRejectionReason && (
                        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 flex items-start gap-2 rounded-r-lg">
                            <FaExclamationTriangle className="text-red-500 mt-0.5 text-sm" />
                            <div>
                                <div className="text-red-800 font-semibold text-xs uppercase tracking-wide">MD Rejected this order</div>
                                <p className="text-red-700 text-sm m-0">{order.mdRejectionReason}</p>
                            </div>
                        </div>
                    )}
                    {order.status === "CUSTOMER_REJECTED" && order.customerRejectionReason && (
                        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 flex items-start gap-2 rounded-r-lg">
                            <FaExclamationTriangle className="text-red-500 mt-0.5 text-sm" />
                            <div>
                                <div className="text-red-800 font-semibold text-xs uppercase tracking-wide">Customer Rejected this order</div>
                                <p className="text-red-700 text-sm m-0">{order.customerRejectionReason}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* ── Left column: main details ── */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* ── Order Info ── */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FaFileAlt className="text-blue-500" /> Order Information
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                                    <DetailBox label="Order No" value={order.orderNo} icon={<FaFileAlt />} />
                                    <DetailBox label="Order Date" value={formatDate(order.orderDate)} icon={<FaCalendarAlt />} />
                                    <DetailBox label="Expected Completion" value={formatDate(order.expectedCompletionDate)} icon={<FaCalendarAlt />} />
                                    <DetailBox label="Order Type" value={order.orderType} icon={<FaGlobe />} />
                                    {order.referenceText && <DetailBox label="Reference Name" value={order.referenceText} icon={<FaUser />} />}
                                    <DetailBox label="Dispatch Type" value={order.dispatchType} icon={<FaTruck />} />
                                    <DetailBox
                                        label="Production Status"
                                        icon={<FaInfoCircle />}
                                        value={<div className="mt-1"><StatusPill status={(order as any).productionStatus} modifierMap={PRODUCTION_MODIFIER} /></div>}
                                    />
                                    {order.remarks && <DetailBox label="Remarks" value={order.remarks} />}
                                    {order.internalNotes && <DetailBox label="Internal Notes" value={order.internalNotes} />}
                                </div>
                            </div>

                            {/* ── Customer ── */}
                            <div className="pt-4 border-t border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FaUser className="text-blue-500" /> Customer
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <DetailBox label="Name" value={order.customer?.displayName || order.customer?.firmName} />
                                    <DetailBox label="Type" value={order.customerType ? order.customerType.toLowerCase() : ''} />
                                </div>
                            </div>

                            {/* ── Addresses ── */}
                            <div className="pt-4 border-t border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FaMapMarkerAlt className="text-blue-500" /> Addresses
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Billing Address</div>
                                        <div className="text-sm text-gray-900">{order.billingAddressLine1}</div>
                                        <div className="text-sm text-gray-900">{order.billingCity}, {order.billingState} — {order.billingPincode}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Shipping Address</div>
                                        {order.shippingAddressLine1 ? (
                                            <>
                                                <div className="text-sm text-gray-900">{order.shippingAddressLine1}</div>
                                                <div className="text-sm text-gray-900">{order.shippingCity}, {order.shippingState} — {order.shippingPincode}</div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-gray-500 italic">Same as Billing Address</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── Items ── */}
                            <div className="pt-4 border-t border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FaBoxOpen className="text-blue-500" /> Order Items
                                </h3>
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="py-3 pl-4 pr-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide w-8">#</th>
                                                <th className="py-3 px-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide">Product</th>

                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Qty</th>
                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Unit Price</th>
                                                {order.isInterState ? (
                                                    <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">IGST</th>
                                                ) : (
                                                    <>
                                                        <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">CGST</th>
                                                        <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">SGST</th>
                                                    </>
                                                )}
                                                {/* <th className="py-3 pr-4 pl-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Line Total</th> */}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {order.items?.map((item: any, idx: number) => (
                                                <tr key={item.id} className="border-b border-gray-100 last:border-b-0 bg-white">
                                                    <td className="py-3 pl-4 pr-2 text-gray-700">{idx + 1}</td>
                                                    <td className="py-3 px-2">
                                                        <div className="font-medium text-gray-900">{item.product?.productName}</div>
                                                        <div className="text-gray-500 text-xs">{item.product?.productCode}</div>
                                                    </td>

                                                    <td className="py-3 px-2 text-right text-gray-900">{item.quantity}</td>
                                                    <td className="py-3 px-2 text-right text-gray-900">{formatMoney(getUnitPrice(item, order.customerType))}</td>

                                                    {order.isInterState ? (
                                                        <td className="py-3 px-2 text-right text-gray-900">
                                                            {formatMoney(item.igstAmount || item.gstAmount || 0)}
                                                            <div className="text-gray-500 text-xs">({item.igstRate || item.gstRate || 0}%)</div>
                                                        </td>
                                                    ) : (
                                                        <>
                                                            <td className="py-3 px-2 text-right text-gray-900">
                                                                {formatMoney(item.cgstAmount || (Number(item.gstAmount || 0) / 2))}
                                                                <div className="text-gray-500 text-xs">({item.cgstRate || (Number(item.gstRate || 0) / 2)}%)</div>
                                                            </td>
                                                            <td className="py-3 px-2 text-right text-gray-900">
                                                                {formatMoney(item.sgstAmount || (Number(item.gstAmount || 0) / 2))}
                                                                <div className="text-gray-500 text-xs">({item.sgstRate || (Number(item.gstRate || 0) / 2)}%)</div>
                                                            </td>
                                                        </>
                                                    )}

                                                    {/* <td className="py-3 pr-4 pl-2 text-right font-medium text-gray-900">{formatMoney(item.lineTotal)}</td> */}
                                                </tr>
                                            ))}
                                            {(!order.items || order.items.length === 0) && (
                                                <tr>
                                                    <td colSpan={10} className="py-8 text-center text-gray-500 text-sm">
                                                        No items found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* ── Right column: approval trail + totals ── */}
                        <div className="space-y-6">

                            {/* ── Approval Status ── */}
                            <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FaCheckCircle className="text-blue-500" /> Approval Status
                                </h3>

                                <div className="mb-4">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">MD Approval</span>
                                        <StatusPill status={order.mdApprovalStatus} modifierMap={APPROVAL_MODIFIER} />
                                    </div>
                                    {order.mdApprovedAt && (
                                        <div className="text-gray-500 text-xs">Decided on {formatDateTime(order.mdApprovedAt)}</div>
                                    )}
                                    {order.mdRejectionReason && (
                                        <div className="text-red-500 text-xs mt-1">Reason: {order.mdRejectionReason}</div>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-gray-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Customer Approval</span>
                                        <StatusPill status={order.customerApprovalStatus} modifierMap={APPROVAL_MODIFIER} />
                                    </div>
                                    {order.customerApprovedAt && (
                                        <div className="text-gray-500 text-xs">Decided on {formatDateTime(order.customerApprovedAt)}</div>
                                    )}
                                    {order.customerRejectionReason && (
                                        <div className="text-red-500 text-xs mt-1">Reason: {order.customerRejectionReason}</div>
                                    )}
                                </div>
                            </div>

                            {/* ── Amount Summary ── */}
                            <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Amount Summary</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span className="text-gray-900">{formatMoney(order.subtotal)}</span>
                                    </div>

                                    {order.isInterState ? (
                                        <div className="flex justify-between text-green-700">
                                            <span>IGST</span>
                                            <span>+ {formatMoney(order.totalIgst || order.totalGst || 0)}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between text-green-700">
                                                <span>CGST</span>
                                                <span>+ {formatMoney(order.totalCgst || (Number(order.totalGst || 0) / 2))}</span>
                                            </div>
                                            <div className="flex justify-between text-green-700">
                                                <span>SGST</span>
                                                <span>+ {formatMoney(order.totalSgst || (Number(order.totalGst || 0) / 2))}</span>
                                            </div>
                                        </>
                                    )}

                                    {Number(order.totalDiscount) !== 0 && (
                                        <div className="flex justify-between text-red-600">
                                            <span>Discount</span>
                                            <span>− {formatMoney(order.totalDiscount)}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between pt-3 mt-3 border-t border-gray-200">
                                        <span className="font-bold text-gray-800">Net Amount</span>
                                        <span className="font-bold text-lg text-blue-600">{formatMoney(order.netAmount)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ── Meta ── */}
                            <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                                <h3 className="text-sm font-semibold text-gray-800 mb-3">System Info</h3>
                                <div className="space-y-3">
                                    <DetailBox label="Created On" value={formatDateTime((order as any).createdAt)} />
                                    <DetailBox label="Last Updated" value={formatDateTime((order as any).updatedAt)} />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesOrderDetail;
