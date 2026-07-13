import React, { useState, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaChevronLeft, FaChevronRight, FaPlus, FaTrash, FaEye, FaFilePdf } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import CommonViewModal from "../../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { grnInvoiceService } from "../../../../services/grnInvoiceService";
import CustomButton from "../../../../components/ui/custombutton/CustomButton";

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
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Invoice List</h2>
                                <div className="page-breadcrumb">Home / Purchase / Invoice List</div>

                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search invoices..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                <CustomButton
                                    text="Create Invoice"
                                    icon={FaPlus}
                                    onClick={() => navigate("/invoice/create")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Table */}
                <div className="master-table-body table-wrap">
                    <div className="master-table-body">
                        <table className="master-data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "60px" }}>#</th>
                                    <th>GRN NO</th>
                                    <th>INVOICE NO</th>
                                    <th>GRN DATE</th>
                                    <th>SUPPLIER</th>
                                    <th>NET AMOUNT</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center p-4">
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            Loading invoices...
                                        </td>
                                    </tr>
                                ) : data.length > 0 ? (
                                    data.map((item, index) => (
                                        <tr key={item.id} className="master-data-row">
                                            <td className="master-data-cell">
                                                {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                                            </td>
                                            <td className="master-data-cell fw-semibold">{item.grnNumber}</td>
                                            <td className="master-data-cell">{item.invoiceNo}</td>
                                            <td className="master-data-cell">{formatDate(item.grnDate)}</td>
                                            <td className="master-data-cell">
                                                {item.supplier?.displayName || item.supplier?.legalName || "N/A"}
                                            </td>
                                            <td className="master-data-cell fw-semibold text-success">
                                                {formatCurrency(item.netAmount)}
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group d-flex gap-2">
                                                    <CustomButton text="" icon={FaEye} variant="info" size="sm" onClick={() => handleOpenView(item)} />
                                                    <CustomButton text="" icon={FaTrash} variant="danger" size="sm" onClick={() => {
                                                        setItemToDelete(item.id);
                                                        setShowDeleteModal(true);
                                                    }} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center p-4">
                                            No invoices found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {totalPages > 1 && (
                            <div className="pagination-wrap">
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((prev) => prev - 1)}
                                >
                                    <FaChevronLeft />
                                </button>
                                <div className="pagination-info">
                                    Page {currentPage} of {totalPages}
                                </div>
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((prev) => prev + 1)}
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

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
            </Container>
        </div>
    );
};

export default InvoiceList;