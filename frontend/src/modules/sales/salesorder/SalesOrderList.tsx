import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { salesOrderService } from "../../../services/salesOrderService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";

const ITEMS_PER_PAGE = 10;

const SalesOrderList: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get("search") || "";
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await salesOrderService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
                status: 'DRAFT',
            });

            setData(response.data || []);
            setTotal(Math.ceil((response.total ?? 0) / ITEMS_PER_PAGE));
        } catch (error: any) {
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch orders");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm]);

    // ─── Load Data on Mount & Dependencies ─────────────────────
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

    const triggerDelete = useCallback((id: number) => {
        setItemToDelete(id);
        setShowDeleteModal(true);
    }, []);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatCurrency = (amount: number) =>
        `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    const handleOpenView = useCallback((item: any) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);

    const handleOpenEdit = useCallback((item: any) => {
        navigate(`/draft-order/edit/${item.id}`, { state: item });
    }, [navigate]);

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Draft Orders List</h2>
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
                    emptyMessage="No draft orders found."
                    pagination={{
                        currentPage,
                        totalPages: total,
                        onPageChange: (page) => setCurrentPage(page),
                    }}
                    columns={[
                        {
                            header: "#",

                            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
                        },
                        { header: "ORDER NO", accessor: "orderNo" },
                        { header: "ORDER DATE", render: (item) => formatDate(item.orderDate) },
                        {
                            header: "CUSTOMER",
                            render: (item) => item.customer?.displayName || item.customer?.firmName || "N/A",
                        },
                        { header: "STATUS", render: (item) => <StatusBadge status={item.status} /> },
                        {
                            header: "ACTIONS",
                            render: (item) => (
                                <div className="flex justify-end items-center gap-2">
                                    <ViewButton onClick={() => handleOpenView(item)} />
                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                    <DeleteButton onClick={() => triggerDelete(item.id)} />
                                </div>
                            ),
                        },
                    ]}
                />

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="Sales Order Details"
                    avatarText={selectedItem ? selectedItem.orderNo.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.orderNo : ""}
                    headerSubtitle={selectedItem ? `Customer: ${selectedItem.customerName || selectedItem.customer?.displayName || selectedItem.customer?.firmName}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Order No", value: selectedItem.orderNo },
                                { label: "Order Date", value: formatDate(selectedItem.orderDate) },
                                { label: "Customer", value: selectedItem.customerName || selectedItem.customer?.displayName || selectedItem.customer?.firmName },
                                { label: "Sales Person", value: selectedItem.salesPersonName || "N/A" },
                                { label: "Payment Term", value: selectedItem.paymentTermName || "N/A" },
                            ]
                        },
                        {
                            title: "Address Details",
                            fields: [
                                { label: "Billing Address", value: selectedItem.billingAddress || "N/A" },
                                { label: "Shipping Address", value: selectedItem.shippingAddress || "N/A" },
                            ]
                        },
                        {
                            title: "Order Summary",
                            fields: [
                                { label: "Total Items", value: String(selectedItem.totalItems || 0) },
                                { label: "Total Amount", value: formatCurrency(selectedItem.totalAmount || 0) },
                                { label: "Status", value: selectedItem.status },
                                { label: "Remarks", value: selectedItem.remarks || "N/A" },
                                { label: "Internal Notes", value: selectedItem.internalNotes || "N/A" },
                            ]
                        },
                        {
                            title: "Timestamps",
                            fields: [
                                { label: "Created At", value: formatDate(selectedItem.createdAt) },
                                { label: "Last Updated", value: formatDate(selectedItem.updatedAt) },
                            ]
                        }
                    ] : []}
                />

                {/* Delete Modal */}
                <CommonConfirmModal
                    show={showDeleteModal}
                    onHide={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Confirm Delete"
                    message="Are you sure you want to delete this sales order?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default SalesOrderList;