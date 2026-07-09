import React, { useState, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { salesOrderService, type SalesOrder, type SalesOrderStatus } from "../../../services/salesOrderService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

const ITEMS_PER_PAGE = 10;



const PendingQuotationList: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<SalesOrder | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);



    // ─── Fetch only PENDING_MD_APPROVAL orders ────────────────────────────
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await salesOrderService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
                status: "PENDING_MD_APPROVAL" as SalesOrderStatus, // Always filter
            });

            setData(response.data || []);
            setTotal(response.total || 0);
        } catch (error: any) {
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch orders");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm]);

    useEffect(() => {
        fetchOrders();
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



    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatCurrency = (amount: number) =>
        `₹${(amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    const handleOpenView = useCallback((item: SalesOrder) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);



    const handleOpenEdit = useCallback(
        (item: SalesOrder) => {
            navigate(`/pending-quotations/edit/${item.id}`, { state: item });
        },
        [navigate]
    );

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">MD Approval List</h2>
                                <div className="page-breadcrumb">Home / MD Approval / MD Approval List</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search orders..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                                {/* <CustomButton text="Add Quotation order" icon={FaPlus} onClick={handleOpenAdd} /> */}
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
                                    <th>ORDER NO</th>
                                    <th>ORDER DATE</th>
                                    <th>CUSTOMER</th>
                                    <th>NET AMOUNT</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center p-4">
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            Loading orders...
                                        </td>
                                    </tr>
                                ) : data.length > 0 ? (
                                    data.map((item, index) => (
                                        <tr key={item.id} className="master-data-row">
                                            <td className="master-data-cell">
                                                {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                                            </td>
                                            <td className="master-data-cell">{item.orderNo}</td>
                                            <td className="master-data-cell">{formatDate(item.orderDate)}</td>
                                            <td className="master-data-cell">
                                                {item.customer?.displayName || item.customer?.firmName || "N/A"}
                                            </td>
                                            <td className="master-data-cell">
                                                {formatCurrency(item.netAmount)}
                                            </td>
                                            <td className="master-data-cell">
                                                <StatusBadge status={item.status ?? ""} />
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(item)} />
                                                    <EditButton onClick={() => handleOpenEdit(item)} />
                                                    {/* <DeleteButton onClick={() => triggerDelete(item.id)} /> */}

                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center p-4">
                                            No orders found.
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

                {/* View Modal – unchanged */}
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
            </Container>
        </div>
    );
};

export default PendingQuotationList;