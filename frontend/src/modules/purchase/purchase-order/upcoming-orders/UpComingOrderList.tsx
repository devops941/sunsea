import React, { useState, useCallback, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSearch, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

//import EditButton from "../../../../components/ui/EditButton/EditButton";
import CommonViewModal from "../../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import type { PurchaseOrder, PurchaseOrderStatus } from "../../../../features/purchaseOrder/types";
import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../../components/ui/EditButton/EditButton";

import { useUsers } from "../../../../hooks/useUsers";

const ITEMS_PER_PAGE = 15;

const UpcomingOrderList: React.FC = () => {
    const navigate = useNavigate();
    const user = useSelector((state: any) => state?.auth?.user);
    const { users, loadUsers } = useUsers();
    const [data, setData] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<PurchaseOrder | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // ─── Fetch only PENDING purchase orders (awaiting MD approval) ────────
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await purchaseOrderService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
                status: "APPROVED,OPEN,PARTIALLY_RECEIVED" as any,
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
            console.error("❌ Delete error:", error);
            toast.error(error?.response?.data?.message || "Failed to delete order");
        }
    };

    // ─── Approve / Reject actions ───────────────────────────────────────
    const handleApprove = async (id: string) => {
        try {
            await purchaseOrderService.updateStatus(id, "APPROVED");
            setShowViewModal(false);
            toast.success("Purchase order approved!");
            fetchOrders();
        } catch (error: any) {
            console.error("❌ Approve error:", error);
            toast.error(error?.response?.data?.message || "Failed to approve order");
        }
    };

    const handleReject = async (id: string) => {
        try {
            await purchaseOrderService.updateStatus(id, "REJECTED");
            setShowViewModal(false);
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
            navigate(`/upcoming-orders/detail/${item.id}`, { state: item });
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
                                <h2 className="page-title">Upcoming Arrived List</h2>
                                
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


                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center p-4">
                                            <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-4 w-4 border-b-2 mr-2"></div>
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
                                        {
                                            title: "Actions",
                                            fields: selectedItem.status === "PENDING"
                                        ? [
                                            {
                                                label: "Actions",
                                                value: (
                                                    <>
                                                        <button
                                                            className="btn btn-sm btn-success me-1"
                                                            onClick={() => handleApprove(selectedItem?.id)}
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => handleReject(selectedItem?.id)}
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                ),
                                            },
                                        ]
                                        : [],
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
            </Container>
        </div>
    );
};

export default UpcomingOrderList;