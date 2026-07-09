import React, { useState, useCallback, useEffect } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { salesOrderService } from "../../../services/salesOrderService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

const ITEMS_PER_PAGE = 10;

type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

interface SalesOrder {
    id: number;
    orderNo: string;
    orderDate: string;
    customerId: number;
    customerName: string;
    salesPersonId?: number;
    salesPersonName?: string;
    paymentTermId?: number;
    paymentTermName?: string;
    billingAddress?: string;
    shippingAddress?: string;
    status: SalesOrderStatus;
    remarks?: string;
    internalNotes?: string;
    createdAt: string;
    updatedAt: string;
    totalItems: number;
    totalAmount: number;
}



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
            setTotal(response.total || 0);
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
            // Refresh the list
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

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);


    const handleOpenView = useCallback((item: SalesOrder) => {
        setSelectedItem(item);
        setShowViewModal(true);
    }, []);



    const handleOpenEdit = useCallback((item: SalesOrder) => {
        navigate(`/draft-order/edit/${item.id}`, { state: item });
    }, [navigate]);



    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Draft Orders List</h2>
                                <div className="page-breadcrumb">Home / Sales / Draft Orders</div>
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
                                    {/* <th>SALES PERSON</th>
                                    <th>PAYMENT TERM</th> */}
                                    {/* <th>ITEMS</th> */}
                                    {/* <th>TOTAL QUANTITY</th> */}
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">
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
                                            {/* <td className="master-data-cell">{"N/A"}</td>
                                            <td className="master-data-cell">{"N/A"}</td> */}
                                            {/* <td className="master-data-cell">{item.items?.length || 0}</td> */}
                                            {/* <td className="master-data-cell">
                                                {item.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0}
                                            </td> */}
                                            <td className="master-data-cell">
                                                {/* <span className={`status-pill ${item.status as SalesOrderStatus || 'DRAFT'}`}>
                                                    {item.status as SalesOrderStatus || 'DRAFT'}
                                                </span> */}
                                                <StatusBadge status={item.status} />
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(item.id)} />
                                                    <EditButton
                                                        onClick={() => handleOpenEdit(item)}
                                                    // disabled={item.mdApprovalStatus === 'APPROVED'}
                                                    />
                                                    <DeleteButton
                                                        onClick={() => triggerDelete(item.id)}
                                                    // disabled={item.mdApprovalStatus === 'APPROVED'}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">
                                            No draft orders found.
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
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                >
                                    <FaChevronLeft />
                                </button>
                                <div className="pagination-info">Page {currentPage} of {totalPages}</div>
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
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
                    modalTitle="Sales Order Details"
                    avatarText={selectedItem ? selectedItem.orderNo.charAt(0).toUpperCase() : ""}
                    headerTitle={selectedItem ? selectedItem.orderNo : ""}
                    headerSubtitle={selectedItem ? `Customer: ${selectedItem.customerName}` : ""}
                    sections={selectedItem ? [
                        {
                            fields: [
                                { label: "Order No", value: selectedItem.orderNo },
                                { label: "Order Date", value: formatDate(selectedItem.orderDate) },
                                { label: "Customer", value: selectedItem.customerName },
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
                                { label: "Total Items", value: String(selectedItem.totalItems) },
                                { label: "Total Amount", value: formatCurrency(selectedItem.totalAmount) },
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
            </Container>
        </div>
    );
};

export default SalesOrderList;