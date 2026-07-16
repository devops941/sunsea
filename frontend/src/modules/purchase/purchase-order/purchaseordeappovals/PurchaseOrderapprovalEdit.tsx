import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { 
    FaInfoCircle, FaUser, FaMapMarkerAlt, FaBoxOpen, FaCheck, FaTimes, 
    FaArrowLeft, FaCheckCircle, FaExclamationTriangle, FaFileAlt, 
    FaCalendarAlt, FaCircleNotch 
} from "react-icons/fa";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Modal } from "react-bootstrap";

import CustomButton from "../../../../components/ui/Button/Button";
import BackButton from "../../../../components/ui/BackButton/BackButton";
import DetailBox from "../../../../components/ui/DetailBox/DetailBox";
import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import { useUsers } from "../../../../hooks/useUsers";

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

const STATUS_MODIFIER: Record<string, "active" | "inactive" | "hold"> = {
    DRAFT: "hold",
    OPEN: "active",
    PENDING: "hold",
    REJECTED: "inactive",
    CANCELLED: "inactive",
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

const PurchaseOrderViewPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const { suppliers, loadSuppliers } = useSuppliers();
    const { users, loadUsers } = useUsers();
    const { data: company } = useSelector((state: any) => state.company);
    const companyState = company?.state;

    const [po, setPo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // ── Unified approve/reject modal state ──
    const [actionMode, setActionMode] = useState<"approve" | "reject" | null>(null);
    const [reason, setReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    const isRejectReasonValid = reason.trim().length > 0;

    useEffect(() => {
        loadSuppliers();
        loadUsers();
    }, [loadSuppliers, loadUsers]);

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            try {
                if (location.state) {
                    if (mounted) setPo(location.state);
                } else if (id) {
                    const data = await purchaseOrderService.fetchById(id);
                    if (mounted) setPo(data);
                }
            } catch {
                toast.error("Failed to load purchase order");
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        return () => {
            mounted = false;
        };
    }, [id, location.state]);

    const handleConfirmAction = async () => {
        if (!po?.id) return;

        setActionLoading(true);
        try {
            if (actionMode === "approve") {
                await purchaseOrderService.updateStatus(po.id, "OPEN");
                toast.success("Purchase Order approved.");
                setPo((prev: any) => ({ ...prev, status: "OPEN" }));
                setActionMode(null);
                navigate("/purchase-order-approvals");
            } else if (actionMode === "reject") {
                if (!reason.trim()) return;
                await purchaseOrderService.updateStatus(po.id, "REJECTED", reason.trim());
                toast.success("Purchase Order rejected.");
                setPo((prev: any) => ({ ...prev, status: "REJECTED", rejectReason: reason.trim() }));
                setActionMode(null);
                navigate("/purchase-order-approvals");
                setReason("");
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || "Failed to update purchase order");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading || !po) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <FaCircleNotch className="animate-spin text-primary text-4xl mb-4" />
                <p className="text-gray-500">{loading ? "Loading order details..." : "Purchase order not found."}</p>
            </div>
        );
    }

    const supplier = suppliers.find((s) => String(s.id) === String(po.supplierId));
    const createdByUser = users.find((u: any) => u.userId === po.createdBy);
    const isInterState = companyState && supplier?.billingState
        ? companyState.toLowerCase().trim() !== supplier.billingState.toLowerCase().trim()
        : false;

    return (
        <div className="w-full mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* ── Page Header ── */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-xl font-bold text-gray-800 m-0">
                                {po.poNumber}
                            </h2>
                            <StatusPill status={po.status} modifierMap={STATUS_MODIFIER} />
                        </div>
                        <div>
                            <BackButton text="Back to List" to="/purchase-order-approvals" />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 space-y-6">
                    {/* ── Rejection reason banner ── */}
                    {po.status === "REJECTED" && po.rejectReason && (
                        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 flex items-start gap-2 rounded-r-lg">
                            <FaExclamationTriangle className="text-red-500 mt-0.5 text-sm" />
                            <div>
                                <div className="text-red-800 font-semibold text-xs uppercase tracking-wide">Order Rejected</div>
                                <p className="text-red-700 text-sm m-0">{po.rejectReason}</p>
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
                                    <DetailBox label="PO Number" value={po.poNumber} icon={<FaFileAlt />} />
                                    <DetailBox label="PO Date" value={formatDate(po.poDate)} icon={<FaCalendarAlt />} />
                                    <DetailBox label="Expected Delivery" value={formatDate(po.expectedDeliveryDate)} icon={<FaCalendarAlt />} />
                                    <DetailBox label="Created By" value={createdByUser?.username || "—"} icon={<FaUser />} />
                                    <DetailBox label="Store" value={po.store?.storeName || po.storeId || "—"} icon={<FaInfoCircle />} />
                                    {po.remarks && <DetailBox label="Remarks" value={po.remarks} />}
                                </div>
                            </div>

                            {/* ── Supplier ── */}
                            <div className="pt-4 border-t border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FaUser className="text-blue-500" /> Supplier
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <DetailBox 
                                        label="Name" 
                                        value={supplier ? `${supplier.supplierCode} - ${supplier.legalName || supplier.displayName || ""}` : po.supplierId} 
                                    />
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
                                        <div className="text-sm text-gray-900">{po.billingAddressLine1 || "—"}</div>
                                        {(po.billingCity || po.billingState || po.billingPincode) && (
                                            <div className="text-sm text-gray-900">{po.billingCity}, {po.billingState} — {po.billingPincode}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Shipping Address</div>
                                        {po.shippingAddressLine1 ? (
                                            <>
                                                <div className="text-sm text-gray-900">{po.shippingAddressLine1}</div>
                                                <div className="text-sm text-gray-900">{po.shippingCity}, {po.shippingState} — {po.shippingPincode}</div>
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
                                                <th className="py-3 px-2 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wide">UOM</th>
                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Qty</th>
                                                <th className="py-3 px-2 text-right text-[11px] font-bold text-gray-600 uppercase tracking-wide">Unit Price</th>
                                                {isInterState ? (
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
                                            {(po.items || []).map((item: any, idx: number) => (
                                                <tr key={idx} className="border-b border-gray-100 last:border-b-0 bg-white">
                                                    <td className="py-3 pl-4 pr-2 text-gray-700">{idx + 1}</td>
                                                    <td className="py-3 px-2">
                                                        <div className="font-medium text-gray-900">{item.product?.productName || item.productId}</div>
                                                    </td>
                                                    <td className="py-3 px-2 text-gray-700">{item.uom || "—"}</td>
                                                    <td className="py-3 px-2 text-right text-gray-900">{item.quantity}</td>
                                                    <td className="py-3 px-2 text-right text-gray-900">{formatMoney(item.unitPrice)}</td>
                                                    
                                                    {isInterState ? (
                                                        <td className="py-3 px-2 text-right text-gray-900">
                                                            {formatMoney(item.igstAmount || 0)}
                                                            <div className="text-gray-500 text-xs">({item.tax || 0}%)</div>
                                                        </td>
                                                    ) : (
                                                        <>
                                                            <td className="py-3 px-2 text-right text-gray-900">
                                                                {formatMoney(item.cgstAmount || 0)}
                                                                <div className="text-gray-500 text-xs">({Number(item.tax || 0) / 2}%)</div>
                                                            </td>
                                                            <td className="py-3 px-2 text-right text-gray-900">
                                                                {formatMoney(item.sgstAmount || 0)}
                                                                <div className="text-gray-500 text-xs">({Number(item.tax || 0) / 2}%)</div>
                                                            </td>
                                                        </>
                                                    )}

                                                    <td className="py-3 pr-4 pl-2 text-right font-medium text-gray-900">{formatMoney(item.lineTotal)}</td>
                                                </tr>
                                            ))}
                                            {(!po.items || po.items.length === 0) && (
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

                        {/* ── Right column: approval actions + totals ── */}
                        <div className="space-y-6">

                            {/* ── Approval Actions ── */}
                            {po.status === "PENDING" && (
                                <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                                    <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                                        <FaCheckCircle className="text-blue-500" /> Action Required
                                    </h3>
                                    <p className="text-sm text-blue-800 mb-4">
                                        This purchase order is pending approval. Please review the details and approve or reject it.
                                    </p>
                                    <div className="flex gap-3">
                                        <CustomButton
                                            text="Approve"
                                            icon={FaCheck}
                                            onClick={() => setActionMode("approve")}
                                            type="button"
                                            className="w-full justify-center bg-green-600 hover:bg-green-700 text-white"
                                        />
                                        <CustomButton
                                            text="Reject"
                                            icon={FaTimes}
                                            onClick={() => setActionMode("reject")}
                                            type="button"
                                            className="w-full justify-center bg-red-600 hover:bg-red-700 text-white"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ── Amount Summary ── */}
                            <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Amount Summary</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span className="text-gray-900">{formatMoney(po.subtotal)}</span>
                                    </div>

                                    {isInterState ? (
                                        <div className="flex justify-between text-green-700">
                                            <span>IGST</span>
                                            <span>+ {formatMoney(po.totalIgst || 0)}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between text-green-700">
                                                <span>CGST</span>
                                                <span>+ {formatMoney(po.totalCgst || 0)}</span>
                                            </div>
                                            <div className="flex justify-between text-green-700">
                                                <span>SGST</span>
                                                <span>+ {formatMoney(po.totalSgst || 0)}</span>
                                            </div>
                                        </>
                                    )}

                                    <div className="flex justify-between text-green-700 font-medium pt-1">
                                        <span>Total Tax</span>
                                        <span>+ {formatMoney(po.totalTax)}</span>
                                    </div>

                                    {Number(po.totalDiscount) !== 0 && (
                                        <div className="flex justify-between text-red-600 pt-1 border-t border-gray-100 mt-2">
                                            <span>Discount</span>
                                            <span>− {formatMoney(po.totalDiscount)}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between pt-3 mt-3 border-t border-gray-200">
                                        <span className="font-bold text-gray-800">Net Amount</span>
                                        <span className="font-bold text-lg text-blue-600">{formatMoney(po.netAmount)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ── Meta ── */}
                            <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                                <h3 className="text-sm font-semibold text-gray-800 mb-3">System Info</h3>
                                <div className="space-y-3">
                                    <DetailBox label="Created On" value={formatDateTime(po.createdAt)} />
                                    <DetailBox label="Last Updated" value={formatDateTime(po.updatedAt)} />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* ── Approve / Reject Modal ── */}
                <CommonConfirmModal
                    show={actionMode !== null}
                    onHide={() => setActionMode(null)}
                    onConfirm={handleConfirmAction}
                    title={actionMode === "approve" ? "Approve Purchase Order" : "Reject Purchase Order"}
                    message={
                        actionMode === "approve" ? (
                            "Are you sure you want to approve this purchase order?"
                        ) : (
                            <div className="text-left mt-2">
                                <label htmlFor="rejection-reason" className="block text-sm font-medium text-gray-700 mb-2">
                                    Enter the reason for rejection <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="rejection-reason"
                                    className="w-full border border-gray-300 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    rows={4}
                                    placeholder="Type your rejection reason here..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    required
                                />
                            </div>
                        )
                    }
                    confirmText={actionLoading ? "Processing..." : actionMode === "approve" ? "Confirm Approve" : "Confirm Reject"}
                    confirmVariant={actionMode === "approve" ? "primary" : "danger"}
                    confirmDisabled={actionLoading || (actionMode === "reject" && !isRejectReasonValid)}
                />
            </div>
        </div>
    );
};

export default PurchaseOrderViewPage;