// src/pages/sales/QuotationForm/QuotationReport.tsx
import React, { useEffect, useState } from "react";
import { FaArrowLeft, FaCheck, FaTimes, FaUser, FaMapMarkerAlt, FaBoxOpen, FaCalendarAlt, FaTruck, FaGlobe, FaFileAlt, FaCircleNotch, FaExclamationTriangle } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import CustomButton from "../../../components/ui/Button/Button";
import BackButton from "../../../components/ui/BackButton/BackButton";
import DetailBox from "../../../components/ui/DetailBox/DetailBox";
import {
    salesOrderService,
    type SalesOrder,
    type MdApprovalDecisionDto,
} from "../../../services/salesOrderService";
import { getUnitPrice } from "../../../utils/pricingUtils";
import CommonModal from "../../../components/ui/Modal/CommonModal";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";

// ─── Formatting helpers ─────────────────────────────────────────────────
const formatMoney = (val: string | number | null | undefined) => {
    const n = Number(val ?? 0);
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (val?: string | null) => {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const COLOR_TYPE_LABELS: Record<string, string> = {
    sc: "Single Color",
    mc: "Multi Color",
};

// ─── Component ────────────────────────────────────────────────────────────
const QuotationReport: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [order, setOrder] = useState<SalesOrder | null>(null);
    const [loading, setLoading] = useState(true);

    const [actionMode, setActionMode] = useState<"approve" | "reject" | null>(null);
    const user = useSelector((state: any) => state.auth.user);
    const [reason, setReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const state = location.state as any;
        const load = async () => {
            setLoading(true);
            try {
                if (state?.id) {
                    const fresh = await salesOrderService.fetchById(state.id);
                    setOrder(fresh);
                } else if (state) {
                    setOrder(state as SalesOrder);
                }
            } catch {
                toast.error("Failed to load quotation");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [location]);

    const billing = {
        addressLine1: order?.billingAddressLine1 || "",
        city: order?.billingCity || "",
        state: order?.billingState || "",
        pincode: order?.billingPincode || "",
    };
    const shipping = {
        addressLine1: order?.shippingAddressLine1 || "",
        city: order?.shippingCity || "",
        state: order?.shippingState || "",
        pincode: order?.shippingPincode || "",
    };

    // ── Approve / Reject handler ──
    const handleConfirmAction = async () => {
        if (!order?.id) return;
        if (actionMode === "reject" && !reason.trim()) return;

        const payload: MdApprovalDecisionDto = {
            decision: actionMode === "approve" ? "APPROVED" : "REJECTED",
            approverId: user?.userId,
            rejectionReason: actionMode === "reject" ? reason.trim() : undefined,
        };

        setActionLoading(true);
        try {
            await salesOrderService.approveMd(order.id, payload);
            toast.success(actionMode === "approve" ? "Quotation approved" : "Quotation rejected");
            setActionMode(null);
            setReason("");
            navigate("/pending-quotations");
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Action failed");
        } finally {
            setActionLoading(false);
        }
    };

    const isRejectReasonValid = reason.trim().length > 0;

    if (loading) {
        return <CommonLoader text="Loading data..." fullScreen={false} />;
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <p className="text-gray-500">No quotation data found.</p>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto">
            <div className="bg-white border border-gray-200">
                {/* ── Page Header ── */}
                <div className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {order.orderNo}
                            </h2>
                        </div>
                        <div>
                            <BackButton text="Back to List" />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-3 space-y-4">
                    {/* ── Rejection reason banner ── */}
                    {order.status === "MD_REJECTED" && (order as any).mdRejectionReason && (
                        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 flex items-start gap-2">
                            <FaExclamationTriangle className="text-red-500 mt-0.5 text-sm" />
                            <div>
                                <div className="text-red-800 font-semibold text-xs uppercase tracking-wide">MD Rejected this order</div>
                                <p className="text-red-700 text-sm m-0">{(order as any).mdRejectionReason}</p>
                            </div>
                        </div>
                    )}
                    {(order.status as string) === "CUSTOMER_REJECTED" && (order as any).customerRejectionReason && (
                        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 flex items-start gap-2">
                            <FaExclamationTriangle className="text-red-500 mt-0.5 text-sm" />
                            <div>
                                <div className="text-red-800 font-semibold text-xs uppercase tracking-wide">Customer Rejected this order</div>
                                <p className="text-red-700 text-sm m-0">{(order as any).customerRejectionReason}</p>
                            </div>
                        </div>
                    )}

                    {/* ── Order Info + Customer ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                        <DetailBox label="Quotation No" value={order.orderNo} icon={<FaFileAlt />} />
                        <DetailBox label="Customer" value={order.customer?.displayName || order.customer?.firmName} icon={<FaUser />} />
                        <DetailBox label="Quotation Date" value={formatDate(order.orderDate)} icon={<FaCalendarAlt />} />
                        <DetailBox label="Valid Until" value={formatDate(order.expectedCompletionDate)} icon={<FaCalendarAlt />} />
                        <DetailBox label="Customer Type" value={order.customerType ? order.customerType.toLowerCase() : ""} icon={<FaUser />} />
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
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><FaBoxOpen className="text-blue-500" /> Quotation Items</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="py-3 pl-4 pr-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide w-8">#</th>
                                    <th className="py-3 px-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide">Product</th>
                                    <th className="py-3 px-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide">Color</th>
                                    <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Qty</th>
                                    <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Unit Price</th>
                                    <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Discount</th>
                                    <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Taxable</th>
                                    {order.isInterState ? (
                                        <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">IGST</th>
                                    ) : (
                                        <>
                                            <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">CGST</th>
                                            <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">SGST</th>
                                        </>
                                    )}
                                    <th className="py-3 pr-4 pl-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Line Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(order.items || []).map((item: any, idx: number) => (
                                    <tr key={item.id || idx} className="border-b border-gray-100 last:border-b-0 bg-white">
                                        <td className="py-3 pl-4 pr-2 text-gray-700">{idx + 1}</td>
                                        <td className="py-3 px-2">
                                            <div className="font-medium text-gray-900">{item.product?.productName || item.productId}</div>
                                            <div className="text-gray-500 text-xs">{item.product?.productCode}</div>
                                        </td>
                                        <td className="py-3 px-2 text-gray-700">{COLOR_TYPE_LABELS[item.colorType] || item.colorType || "—"}</td>
                                        <td className="py-3 px-2 text-right text-gray-900">{item.quantity}</td>
                                        <td className="py-3 px-2 text-right text-gray-900">{formatMoney(getUnitPrice(item, order.customerType))}</td>
                                        <td className="py-3 px-2 text-right text-gray-900">
                                            {formatMoney(item.discountAmount)}
                                            <div className="text-gray-500 text-xs">
                                                ({item.discountType === "PERCENT" ? `${item.discountValue}%` : "flat"})
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-right text-gray-900">{formatMoney(item.taxableAmount || item.taxableValue)}</td>

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
                                        <td className="py-3 pr-4 pl-2 text-right font-medium text-gray-900">{formatMoney(item.lineTotal)}</td>
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

                    {/* ── Summary totals ── */}
                    {order.items && order.items.length > 0 && (
                        <div className="flex justify-end mb-4">
                            <div className="w-full max-w-sm border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span className="text-gray-900">{formatMoney(order.subtotal)}</span>
                                    </div>

                                    {order.totalDiscount > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Discount</span>
                                            <span className="text-red-600">- {formatMoney(order.totalDiscount)}</span>
                                        </div>
                                    )}

                                    {order.isInterState ? (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">IGST</span>
                                            <span className="text-gray-900">+ {formatMoney(order.totalIgst || order.totalGst || 0)}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">CGST</span>
                                                <span className="text-gray-900">+ {formatMoney(order.totalCgst || (Number(order.totalGst || 0) / 2))}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">SGST</span>
                                                <span className="text-gray-900">+ {formatMoney(order.totalSgst || (Number(order.totalGst || 0) / 2))}</span>
                                            </div>
                                        </>
                                    )}

                                    <div className="flex justify-between pt-2 border-t border-gray-300">
                                        <span className="text-base font-bold text-gray-900">Net Amount</span>
                                        <span className="text-base font-bold text-gray-900">{formatMoney(order.netAmount)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Notes ── */}
                    {(order.remarks || order.internalNotes) && (
                        <>
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Notes</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                {order.remarks && <DetailBox label="Remarks" value={order.remarks} />}
                                {order.internalNotes && <DetailBox label="Internal Notes" value={order.internalNotes} />}
                            </div>
                        </>
                    )}

                    {/* ── Approve / Reject actions (only while pending MD approval) ── */}
                    {order.status === "PENDING_MD_APPROVAL" && (
                        <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
                            <CustomButton
                                text="Reject"
                                icon={FaTimes}
                                className="!bg-white !text-red-600 border border-red-600 hover:!bg-red-50"
                                onClick={() => {
                                    setReason("");
                                    setActionMode("reject");
                                }}
                            />
                            <CustomButton
                                text="Approve"
                                icon={FaCheck}
                                className="!bg-green-600 !text-white hover:!bg-green-700"
                                onClick={() => setActionMode("approve")}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Confirmation Modal ── */}
            <CommonModal
                show={actionMode !== null}
                onHide={() => setActionMode(null)}
                title={actionMode === "approve" ? "Approve Quotation" : "Reject Quotation"}
                footer={
                    <>
                        <CustomButton text="Cancel" onClick={() => setActionMode(null)} disabled={actionLoading} className="!bg-white !text-gray-700 border border-gray-300 hover:!bg-gray-50" />
                        <CustomButton
                            text={actionLoading ? "Processing..." : actionMode === "approve" ? "Confirm Approve" : "Confirm Reject"}
                            className={actionMode === "approve" ? "!bg-green-600 !text-white hover:!bg-green-700" : "!bg-red-600 !text-white hover:!bg-red-700"}
                            onClick={handleConfirmAction}
                            disabled={actionLoading || (actionMode === "reject" && !isRejectReasonValid)}
                        />
                    </>
                }
            >
                {actionMode === "approve" ? (
                    <p className="text-gray-700">Are you sure you want to approve this quotation?</p>
                ) : (
                    <div className="flex flex-col">
                        <label htmlFor="rejection-reason" className="text-gray-700 font-medium mb-2 text-sm">
                            Enter the reason for rejection <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="rejection-reason"
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={4}
                            placeholder="Type your rejection reason here..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                        />
                    </div>
                )}
            </CommonModal>
        </div>
    );
};

export default QuotationReport;
