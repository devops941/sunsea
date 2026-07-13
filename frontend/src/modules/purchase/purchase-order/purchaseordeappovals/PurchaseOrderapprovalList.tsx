import React, { useState, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner, Modal } from "react-bootstrap";
import { FaSearch, FaChevronLeft, FaChevronRight, FaCheck, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

//import EditButton from "../../../../components/ui/EditButton/EditButton";
import CommonViewModal from "../../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import StatusBadge from "../../../../components/ui/StatusBadge/Badge";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import type { PurchaseOrder, PurchaseOrderStatus } from "../../../../features/purchaseOrder/types";
import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import CustomButton from "../../../../components/ui/custombutton/CustomButton";
import TextInput from "../../../../components/form/TextInput/TextInput";
import EditButton from "../../../../components/ui/EditButton/EditButton";

const ITEMS_PER_PAGE = 10;

const POMDApproval: React.FC = () => {
    const user = useSelector((state: any) => state?.auth?.user);
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

    // ─── Fetch only PENDING purchase orders (awaiting MD approval) ────────
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
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch purchase orders");
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
            await purchaseOrderService.delete(itemToDelete);
            toast.success("Purchase order deleted successfully!");
            setShowDeleteModal(false);
            setItemToDelete(null);
            fetchOrders();
        } catch (error: any) {
            console.error("❌ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete order");
        }
    };

    // ─── Approve / Reject actions ───────────────────────────────────────
    const handleApprove = async (id: string) => {
        try {
            await purchaseOrderService.updateStatus(id, "OPEN");
            setShowViewModal(false);
            toast.success("Purchase order approved!");
            fetchOrders();
        } catch (error: any) {
            console.error("❌ Approve error:", error);
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
            console.error("❌ Reject error:", error);
            toast.error(error?.response?.data?.message || "Failed to reject order");
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
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">PO MD Approval List</h2>
                                <div className="page-breadcrumb">Home / MD Approval / PO MD Approval List</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <div className="page-search-wrap">
                                    <FaSearch className="page-search-icon" />
                                    <input
                                        type="text"
                                        className="page-search-input"
                                        placeholder="Search purchase orders..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
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
                                    <th>PO NO</th>
                                    <th>PO DATE</th>
                                    <th>SUPPLIER</th>
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
                                            Loading purchase orders...
                                        </td>
                                    </tr>
                                ) : data.length > 0 ? (
                                    data.map((item, index) => (
                                        <tr key={item.id} className="master-data-row">
                                            <td className="master-data-cell">
                                                {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                                            </td>
                                            <td className="master-data-cell">{item.poNumber}</td>
                                            <td className="master-data-cell">{formatDate(item.poDate)}</td>
                                            <td className="master-data-cell">
                                                {item.supplier?.supplierName || "N/A"}
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

                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center p-4">
                                            No purchase orders pending approval.
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
                                        { label: "Created by", value: user?.username || "N/A" },

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
            </Container>
        </div>
    );
};

export default POMDApproval;