import React, { useState, useCallback, useEffect } from "react";
import { FaPlus, FaFilePdf } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import CommonViewModal from "../../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { grnInvoiceService } from "../../../../services/grnInvoiceService";
import CustomButton from "../../../../components/ui/Button/Button";
import DataTable from "../../../../components/ui/table/DataTable";
import SearchInput from "../../../../components/ui/SearchInput/SearchInput";
import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import DeleteButton from "../../../../components/ui/DeleteButton/DeleteButton";

const ITEMS_PER_PAGE = 10;

const InvoiceList: React.FC = () => {
    const navigate = useNavigate();
    const user = useSelector((state: any) => state?.auth?.user);
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
            const response = await grnInvoiceService.fetchAll({
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
            await grnInvoiceService.delete(itemToDelete);
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
            const details = await grnInvoiceService.fetchById(item.id);
            setSelectedItem(details);
            setShowViewModal(true);
        } catch (error) {
            toast.error("Failed to load invoice details");
        }
    };

    return (
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Invoice List</h2>

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
                            onClick={() => navigate("/invoice/create")}
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={data}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No invoices found."
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
                        { header: "GRN NO", accessor: "grnNumber" },
                        { header: "INVOICE NO", accessor: "invoiceNo" },
                        { header: "GRN DATE", render: (item) => formatDate(item.grnDate) },
                        {
                            header: "SUPPLIER",
                            render: (item) => item.supplier?.displayName || item.supplier?.legalName || "N/A",
                        },
                        {
                            header: "NET AMOUNT",
                            render: (item) => (
                                <span className="font-semibold text-green-600">
                                    {formatCurrency(item.netAmount)}
                                </span>
                            ),
                        },
                        {
                            header: "ACTIONS",
                            render: (item) => (
                                <div className="flex items-center gap-2">
                                    <ViewButton onClick={() => handleOpenView(item)} />
                                    <DeleteButton onClick={() => {
                                        setItemToDelete(item.id);
                                        setShowDeleteModal(true);
                                    }} />
                                </div>
                            ),
                        },
                    ]}
                />

                {/* View Modal */}
                <CommonViewModal
                    show={showViewModal}
                    onHide={() => setShowViewModal(false)}
                    modalTitle="GRN Invoice details"
                    avatarText={selectedItem ? selectedItem.grnNumber.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.grnNumber : ""}
                    headerSubtitle={
                        selectedItem ? `Supplier: ${selectedItem.supplier?.displayName || selectedItem.supplier?.legalName || "N/A"}` : ""
                    }
                    sections={
                        selectedItem
                            ? [
                                {
                                    fields: [
                                        { label: "GRN No", value: selectedItem.grnNumber },
                                        { label: "Invoice No", value: selectedItem.invoiceNo },
                                        { label: "GRN Date", value: formatDate(selectedItem.grnDate) },
                                        { label: "Store", value: selectedItem.store?.storeName || "N/A" },
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
                                    title: "Invoice summary",
                                    fields: [
                                        { label: "Total items", value: String(selectedItem.items?.length ?? 0) },
                                        { label: "Subtotal", value: formatCurrency(selectedItem.subtotal) },
                                        { label: "Total discount", value: formatCurrency(selectedItem.totalDiscount) },
                                        { label: "Total tax", value: formatCurrency(selectedItem.totalTax) },
                                        { label: "Net amount", value: formatCurrency(selectedItem.netAmount) },
                                        { label: "Payment Status", value: selectedItem.paymentStatus || "Unpaid" },
                                        { label: "Remarks", value: selectedItem.remarks || "N/A" },
                                    ],
                                },
                                {
                                    title: "Attachment",
                                    fields: [
                                        {
                                            label: "Invoice Copy",
                                            value: selectedItem.invoiceImage ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                                                    {selectedItem.invoiceImage.toLowerCase().endsWith(".pdf") ? (
                                                        <a
                                                            href={selectedItem.invoiceImage}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="btn btn-outline-primary btn-sm"
                                                            style={{ display: "inline-flex", alignItems: "center", gap: "6px", width: "fit-content" }}
                                                        >
                                                            <FaFilePdf /> View PDF Document
                                                        </a>
                                                    ) : (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                                            <img
                                                                src={selectedItem.invoiceImage}
                                                                alt="Invoice Copy"
                                                                style={{
                                                                    maxWidth: "100%",
                                                                    maxHeight: "300px",
                                                                    objectFit: "contain",
                                                                    border: "1px solid var(--color-border)",
                                                                    borderRadius: "6px"
                                                                }}
                                                            />
                                                            <a
                                                                href={selectedItem.invoiceImage}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="btn btn-link btn-sm text-decoration-none p-0 text-start"
                                                                style={{ width: "fit-content" }}
                                                            >
                                                                Open in New Tab
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                "No file uploaded"
                                            )
                                        }
                                    ]
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
                    message="Are you sure you want to delete this GRN Invoice?"
                    confirmText="Delete"
                    confirmVariant="danger"
                />
            </div>
        </div>
    );
};

export default InvoiceList;