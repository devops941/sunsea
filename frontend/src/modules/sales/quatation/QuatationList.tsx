import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { salesOrderService, type SalesOrder, type SalesOrderStatus } from "../../../services/salesOrderService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";

const ITEMS_PER_PAGE = 10;

const QuotationList: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get("search") || "";
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<SalesOrder | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    // ─── Fetch only CONFIRMED and MD_REJECTED orders ────────────────────────────
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await salesOrderService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
                status: ['CONFIRMED', 'MD_REJECTED'] as SalesOrderStatus[],
            });

            setData(response.data || []);
            setTotal((response.total ?? 0) / 10);
        } catch (error: any) {
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch orders");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchOrders]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null) return;
        try {
            await salesOrderService.delete(itemToDelete);
            toast.success("Sales order deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            fetchOrders();
        } catch (error: any) {
            console.error("❌ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete order");
        }
    };

    // const triggerDelete = useCallback((id: number) => {
    //     setItemToDelete(id);
    //     setShowDeleteModal(true);
    // }, []);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatCurrency = (amount: number) =>
        `₹${(amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    const handleOpenView = useCallback((item: SalesOrder) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenEdit = useCallback(
        (item: SalesOrder) => {
            navigate(`/quatation-order/edit/${item.id}`, { state: item });
        },
        [navigate]
    );

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Quotation List</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                    <SearchInput
                        value={searchTerm}
                        onChange={handleSearch}
                        placeholder="Search orders..."
                    />
                </div>
            </div>

            {/* Table */}
            <DataTable
                data={data}
                rowKey={(item) => item.id}
                loading={loading}
                emptyMessage="No orders pending for quotation."
                    pagination={{
                        currentPage,
                        totalPages: total,
                        onPageChange: (page) => setCurrentPage(page),
                    }}
                    columns={[
                        {
                            header: "#",
                            width: "60px",
                            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
                        },
                        { header: "ORDER NO", accessor: "orderNo" },
                        { header: "ORDER DATE", render: (item) => formatDate(item.orderDate) },
                        {
                            header: "CUSTOMER",
                            render: (item) => item.customer?.displayName || item.customer?.firmName || "N/A",
                        },
                        { header: "NET AMOUNT", render: (item) => formatCurrency(item.netAmount) },
                        { header: "STATUS", render: (item) => <StatusBadge status={item.status} /> },
                        {
                            header: "ACTIONS",
                            render: (item) => (
                                <div className="flex items-center gap-2">
                                    <ViewButton onClick={() => handleOpenView(item)} />
                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                    {/* <DeleteButton onClick={() => triggerDelete(item.id)} /> */}
                                </div>
                            ),
                        },
                    ]}
                />

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Sales order details"
                    avatarText={selectedItem ? selectedItem.orderNo.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.orderNo : ""}
                    headerSubtitle={
                        selectedItem
                            ? `Customer: ${selectedItem.customer?.displayName || selectedItem.customer?.firmName || "N/A"}`
                            : ""
                    }
                    sections={
                        selectedItem
                            ? [
                                {
                                    fields: [
                                        { label: "Order No", value: selectedItem.orderNo },
                                        { label: "Order Date", value: formatDate(selectedItem.orderDate) },
                                        {
                                            label: "Customer",
                                            value:
                                                selectedItem.customer?.displayName ||
                                                selectedItem.customer?.firmName ||
                                                "N/A",
                                        },
                                    ],
                                },
                                {
                                    title: "Address details",
                                    fields: [
                                        {
                                            label: "Billing address",
                                            value: selectedItem.billingAddressLine1
                                                ? [
                                                    selectedItem.billingAddressLine1,
                                                    selectedItem.billingCity,
                                                    selectedItem.billingState,
                                                    selectedItem.billingPincode,
                                                ]
                                                    .filter(Boolean)
                                                    .join(", ")
                                                : "N/A",
                                        },
                                        {
                                            label: "Shipping address",
                                            value: selectedItem.shippingAddressLine1
                                                ? [
                                                    selectedItem.shippingAddressLine1,
                                                    selectedItem.shippingCity,
                                                    selectedItem.shippingState,
                                                    selectedItem.shippingPincode,
                                                ]
                                                    .filter(Boolean)
                                                    .join(", ")
                                                : "Same as billing",
                                        },
                                    ],
                                },
                                {
                                    title: "Order summary",
                                    fields: [
                                        { label: "Total items", value: String(selectedItem.items?.length ?? 0) },
                                        { label: "Subtotal", value: formatCurrency(selectedItem.subtotal) },
                                        { label: "Total discount", value: formatCurrency(selectedItem.totalDiscount) },
                                        { label: "Net amount", value: formatCurrency(selectedItem.netAmount) },
                                        { label: "Status", value: selectedItem.status || "Draft" },
                                        { label: "Remarks", value: selectedItem.remarks || "N/A" },
                                        { label: "Internal notes", value: selectedItem.internalNotes || "N/A" },
                                    ],
                                },
                                {
                                    title: "Approval trail",
                                    fields: [
                                        { label: "MD approval", value: selectedItem.mdApprovalStatus },
                                        { label: "MD rejection reason", value: selectedItem.mdRejectionReason || "N/A" },
                                        { label: "Customer approval", value: selectedItem.customerApprovalStatus },
                                        {
                                            label: "Customer rejection reason",
                                            value: selectedItem.customerRejectionReason || "N/A",
                                        },
                                    ],
                                },
                                {
                                    title: "Timestamps",
                                    fields: [
                                        { label: "Created at", value: formatDate(selectedItem.createdAt) },
                                        { label: "Last updated", value: formatDate(selectedItem.updatedAt) },
                                    ],
                                },
                            ]
                            : []
                    }
                />

                {/* Delete Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm delete"
                    message="Are you sure you want to delete this sales order?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default QuotationList;
