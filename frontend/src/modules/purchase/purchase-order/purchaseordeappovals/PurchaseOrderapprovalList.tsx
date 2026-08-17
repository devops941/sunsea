import React, { useState, useCallback, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import CommonViewModal from "../../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../../components/ui/StatusBadge/Badge";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import type { PurchaseOrder, PurchaseOrderStatus } from "../../../../features/purchaseOrder/types";
import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import CustomButton from "../../../../components/ui/Button/Button";
import TextInput from "../../../../components/form/TextInput/TextInput";
import EditButton from "../../../../components/ui/EditButton/EditButton";
import DataTable from "../../../../components/ui/table/DataTable";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import { useUsers } from "../../../../hooks/useUsers";
import { useSocketSync } from "../../../../hooks/useSocketSync";

const ITEMS_PER_PAGE = 10;

const POMDApproval: React.FC = () => {
    const user = useSelector((state: any) => state?.auth?.user);
    const { users, loadUsers } = useUsers();
    const navigate = useNavigate();
    const [data, setData] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<PurchaseOrder | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReasonText, setRejectReasonText] = useState("");
    const [poToReject, setPoToReject] = useState<string | null>(null);

    // â”€â”€â”€ Fetch only PENDING purchase orders (awaiting MD approval) â”€â”€â”€â”€â”€â”€â”€â”€
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await purchaseOrderService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
                status: "PENDING" as PurchaseOrderStatus, // Always filter to pending approval
            });

            setData(response.data || []);
            setTotal(response.total || 0);
        } catch (error: any) {
            console.error("âŒ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch purchase orders");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm]);

    useSocketSync("purchaseOrder", undefined, fetchOrders);

    useEffect(() => {
        fetchOrders();
        loadUsers();
    }, [fetchOrders, loadUsers]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null) return;

        try {
            await purchaseOrderService.delete(itemToDelete);
            toast.success("Purchase order deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            fetchOrders();
        } catch (error: any) {
            console.error("âŒ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete order");
        }
    };

    // â”€â”€â”€ Approve / Reject actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleApprove = async (id: string) => {
        try {
            await purchaseOrderService.updateStatus(id, "OPEN");
            setShowViewModal(false);
            toast.success("Purchase order approved!");
            fetchOrders();
        } catch (error: any) {
            console.error("âŒ Approve error:", error);
            toast.error(error?.response?.data?.message || "Failed to approve order");
        }
    };

    const triggerReject = (id: string) => {
        setPoToReject(id);
        setRejectReasonText("");
        setShowRejectModal(true);
    };

    const handleReject = async (id: string, reason: string) => {
        if (!reason.trim()) {
            toast.error("Please enter a rejection reason");
            return;
        }
        try {
            await purchaseOrderService.updateStatus(id, "REJECTED", reason);
            setShowViewModal(false);
            setShowRejectModal(false);
            toast.success("Purchase order rejected!");
            fetchOrders();
        } catch (error: any) {
            console.error("âŒ Reject error:", error);
            toast.error(error?.response?.data?.message || "Failed to reject order");
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatCurrency = (amount: number) =>
        `₹${Number(amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    const handleOpenView = useCallback((item: PurchaseOrder) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenEdit = useCallback(
        (item: PurchaseOrder) => {
            navigate(`/purchase-orders/view/${item.id}`, { state: item });
        },
        [navigate]
    );

    return (
        <div>
            <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
                    <div>
                        <h2 className="text-2xl font-bold text-ink">PO MD Approval List</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search purchase orders..."
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={data}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No purchase orders pending approval."
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: (page) => setCurrentPage(page),
                    }}
                    columns={[
                        {
                            header: "#",
                            width: "60px",
                            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
                        },
                        { header: "PO NO", accessor: "poNumber" },
                        { header: "PO DATE", render: (item) => formatDate(item.poDate) },
                        {
                            header: "SUPPLIER",
                            render: (item) => item.supplier?.supplierName || "N/A",
                        },
                        {
                            header: "NET AMOUNT",
                            render: (item) => formatCurrency(item.netAmount),
                        },
                        { header: "STATUS", render: (item) => <StatusBadge status={item.status ?? ""} /> },
                        {
                            header: "ACTIONS",
                            render: (item) => (
                                <div className="flex items-center gap-2">
                                    <ViewButton onClick={() => handleOpenView(item)} />
                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                </div>
                            ),
                        },
                    ]}
                />

                {/* View Modal */}
                {(() => {
                    const viewCreatedByUser = selectedItem ? users.find((u: any) => u.userId === selectedItem.createdBy || u.id === selectedItem.createdBy) : null;
                    const viewCreatedByName = viewCreatedByUser?.username || (selectedItem?.createdBy?.startsWith("admin_") ? "admin" : (selectedItem?.createdBy || "N/A"));
                    return (
                        <CommonViewModal
                            show={showViewModal}
                            onHide={() => setShowViewModal(false)}
                            modalTitle="Purchase order details"
                            avatarText={selectedItem ? selectedItem.poNumber.charAt(0).toUpperCase() : ""}
                            headerTitle={selectedItem ? selectedItem.poNumber : ""}
                            headerSubtitle={
                                selectedItem ? `Supplier: ${selectedItem.supplier?.supplierName || "N/A"}` : ""
                            }
                            sections={
                                selectedItem
                                    ? [
                                        {
                                            fields: [
                                                { label: "PO No", value: selectedItem.poNumber },
                                                { label: "PO Date", value: formatDate(selectedItem.poDate) },
                                                {
                                                    label: "Expected Delivery",
                                                    value: formatDate(selectedItem.expectedDeliveryDate),
                                                },
                                                {
                                                    label: "Supplier",
                                                    value: selectedItem.supplier?.supplierName || "N/A",
                                                },
                                            ],
                                        },
                                        {
                                            title: "Address details",
                                            fields: [
                                                {
                                                    label: "Billing address",
                                                    value: [
                                                        selectedItem.billingAddressLine1,
                                                        selectedItem.billingCity,
                                                        selectedItem.billingState,
                                                        selectedItem.billingPincode,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(", ") || "N/A",
                                                },
                                                {
                                                    label: "Shipping address",
                                                    value: selectedItem.sameAsBilling
                                                        ? "Same as billing"
                                                        : [
                                                            selectedItem.shippingAddressLine1,
                                                            selectedItem.shippingCity,
                                                            selectedItem.shippingState,
                                                            selectedItem.shippingPincode,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(", ") || "N/A",
                                                },
                                            ],
                                        },
                                        {
                                            title: "Order summary",
                                            fields: [
                                                { label: "Total items", value: String(selectedItem.items?.length ?? 0) },
                                                { label: "Subtotal", value: formatCurrency(selectedItem.subtotal) },
                                                { label: "Total discount", value: formatCurrency(selectedItem.totalDiscount) },
                                                { label: "Total tax", value: formatCurrency(selectedItem.totalTax) },
                                                ...(Number((selectedItem as any).roundingAdjust || 0) !== 0 ? [
                                                    {
                                                        label: "Round Off",
                                                        value: `${Number((selectedItem as any).roundingAdjust) > 0 ? "+" : ""}${formatCurrency((selectedItem as any).roundingAdjust)}`
                                                    }
                                                ] : []),
                                                { label: "Net amount", value: formatCurrency(selectedItem.netAmount) },
                                                { label: "Status", value: selectedItem.status || "Draft" },
                                                { label: "Remarks", value: selectedItem.remarks || "N/A" },
                                                ...(selectedItem.status === "REJECTED" ? [
                                                    { label: "Rejection Reason", value: selectedItem.rejectReason || "N/A" }
                                                ] : []),
                                            ],
                                        },
                                        {
                                            title: "Timestamps",
                                            fields: [
                                                { label: "Created at", value: formatDate(selectedItem.createdAt) },
                                                { label: "Last updated", value: formatDate(selectedItem.updatedAt) },
                                                { label: "Created by", value: viewCreatedByName },
                                            ],
                                        },
                                    ]
                                    : []
                            }
                        />
                    );
                })()}

                {/* Delete Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm delete"
                    message="Are you sure you want to delete this purchase order?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />

                {/* Reject Modal */}
                <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered>
                    <Modal.Header closeButton>
                        <Modal.Title className="fw-bold text-danger">Reject Purchase Order</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <TextInput
                            label="Reason for Rejection"
                            name="rejectReason"
                            as="textarea"
                            rows={3}
                            value={rejectReasonText}
                            onChange={(e) => setRejectReasonText(e.target.value)}
                            required
                            placeholder="Please enter the reason for rejecting this purchase order..."
                        />
                    </Modal.Body>
                    <Modal.Footer>
                        <CustomButton
                            text="Cancel"
                            icon={FaTimes}
                            variant="secondary"
                            onClick={() => setShowRejectModal(false)}
                            type="button"
                        />
                        <CustomButton
                            text="Reject"
                            icon={FaTimes}
                            variant="danger"
                            onClick={() => poToReject && handleReject(poToReject, rejectReasonText)}
                            type="button"
                        />
                    </Modal.Footer>
                </Modal>
            </div>
        </div>
    );
};

export default POMDApproval;