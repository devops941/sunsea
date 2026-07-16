import React, { useState, useCallback, useEffect } from "react";
import { FaPlus, FaTrash, FaEye } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import CommonViewModal from "../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { salesInvoiceService } from "../../services/salesInvoiceService";
import CustomButton from "../../components/ui/Button/Button";
import ViewButton from "../../components/ui/viewbutton/ViewButton";
import DeleteButton from "../../components/ui/DeleteButton/DeleteButton";
import StatusBadge from "../../components/ui/StatusBadge/Badge";
import DataTable, { type DataTableColumn } from "../../components/ui/table/DataTable";
import SearchInput from "../../components/ui/SearchInput/SearchInput";

const ITEMS_PER_PAGE = 10;

const SalesInvoiceList: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const response = await salesInvoiceService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
            });

            setData(response.data || []);
            setTotal(response.total || 0);
        } catch (error: any) {
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch invoices");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleDeleteConfirm = async () => {
        if (itemToDelete === null) return;

        try {
            await salesInvoiceService.delete(itemToDelete);
            toast.success("Invoice deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            fetchInvoices();
        } catch (error: any) {
            console.error("❌ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete invoice");
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatCurrency = (amount: number) =>
        `₹${(amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    const handleOpenView = async (item: any) => {
        try {
            const details = await salesInvoiceService.fetchById(item.id);
            setSelectedItem(details);
            setShowViewModal(true);
        } catch (error) {
            toast.error("Failed to load invoice details");
        }
    };

    const columns: DataTableColumn<any>[] = [
        {
            header: "#",
            width: "60px",
            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
        },
        {
            header: "INVOICE NO",
            render: (item) => <span className="font-semibold text-slate-800">{item.invoiceNo}</span>,
        },
        {
            header: "INVOICE DATE",
            render: (item) => <span className="text-slate-600">{formatDate(item.invoiceDate)}</span>,
        },
        {
            header: "DUE DATE",
            render: (item) => <span className="text-slate-600">{formatDate(item.dueDate)}</span>,
        },
        {
            header: "CUSTOMER",
            render: (item) => <span className="font-medium text-slate-700">{item.customer?.displayName || item.customer?.firmName || "N/A"}</span>,
        },
        {
            header: "SUB TOTAL",
            render: (item) => <span className="font-semibold text-slate-700">{formatCurrency(item.subTotal)}</span>,
        },
        {
            header: "TAX AMOUNT",
            render: (item) => <span className="font-medium text-slate-400">{formatCurrency(item.taxTotal)}</span>,
        },
        {
            header: "NET AMOUNT",
            render: (item) => <span className="font-bold text-emerald-600">{formatCurrency(item.grandTotal)}</span>,
        },
        {
            header: "STATUS",
            render: (item) => <StatusBadge status={item.status} />,
        },
        {
            header: "ACTIONS",
            width: "120px",
            render: (item) => (
                <div className="flex justify-start gap-2">
                    <ViewButton onClick={() => handleOpenView(item)} />
                    <DeleteButton onClick={() => {
                        setItemToDelete(item.id);
                        setShowDeleteModal(true);
                    }} />
                </div>
            ),
            align: "left"
        },
    ];

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Sales Invoice List</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search invoices..."
                        />
                        <CustomButton
                            text="Create Invoice"
                            icon={FaPlus}
                            onClick={() => navigate("/sales-invoices/create")}
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    columns={columns}
                    data={data}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No invoices found."
                    pagination={{
                        currentPage,
                        totalPages,
                        onPageChange: setCurrentPage,
                    }}
                />
            </div>

            {/* View Modal */}
            <CommonViewModal
                show={showViewModal}
                onHide={() => setShowViewModal(false)}
                modalTitle="Sales Invoice details"
                avatarText={selectedItem ? selectedItem.invoiceNo.charAt(0).toUpperCase() : ""}
                headerTitle={selectedItem ? selectedItem.invoiceNo : ""}
                headerSubtitle={
                    selectedItem ? `Customer: ${selectedItem.customer?.displayName || selectedItem.customer?.firmName || "N/A"}` : ""
                }
                sections={
                    selectedItem
                        ? [
                            {
                                fields: [
                                    { label: "Invoice No", value: selectedItem.invoiceNo },
                                    { label: "Invoice Date", value: formatDate(selectedItem.invoiceDate) },
                                    { label: "Due Date", value: formatDate(selectedItem.dueDate) },
                                ],
                            },
                            {
                                title: "Billing & Shipping Details",
                                fields: [
                                    {
                                        label: "Billing address",
                                        value: [
                                            selectedItem.customer?.billingAddressLine1,
                                            selectedItem.customer?.billingCity,
                                            selectedItem.customer?.billingState,
                                            selectedItem.customer?.billingPincode,
                                        ]
                                            .filter(Boolean)
                                            .join(", ") || "N/A",
                                    },
                                    {
                                        label: "Shipping address",
                                        value: [
                                            selectedItem.customer?.shippingAddressLine1,
                                            selectedItem.customer?.shippingCity,
                                            selectedItem.customer?.shippingState,
                                            selectedItem.customer?.shippingPincode,
                                        ]
                                            .filter(Boolean)
                                            .join(", ") || "N/A",
                                    },
                                ],
                            },
                            {
                                title: "Invoice Summary",
                                fields: [
                                    { label: "Total items", value: String(selectedItem.items?.length ?? 0) },
                                    { label: "Subtotal", value: formatCurrency(selectedItem.subTotal) },
                                    { label: "Total tax", value: formatCurrency(selectedItem.taxTotal) },
                                    { label: "Grand Total", value: formatCurrency(selectedItem.grandTotal) },
                                    { label: "Notes", value: selectedItem.notes || "N/A" },
                                ],
                            },
                        ]
                        : []
                }
            />

            {/* Delete Confirmation Modal */}
            <CommonConfirmModal
                show={showDeleteModal}
                onHide={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Invoice"
                message="Are you sure you want to delete this invoice? This action cannot be undone."
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
};

export default SalesInvoiceList;
