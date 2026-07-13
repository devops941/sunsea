import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import ViewButton from "../../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import PurchaseOrderViewModal from "../components/PurchaseOrderViewModal";
import { usePurchaseOrders } from "../../../../hooks/usePurchaseOrder";
import { hasPermission } from "../../../../utils/permission";
import type { PurchaseOrder, PurchaseOrderStatus } from "../../../../features/purchaseOrder/types";

const ITEMS_PER_PAGE = 10;

const STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "secondary",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  COMPLETED: "info",
  CANCELLED: "dark",
  RECEIVED: "info",
  OPEN: "success",
  PARTIALLY_RECEIVED: "warning",
  CLOSED: "secondary",
};

const PurchaseOrderListPage: React.FC = () => {
  const navigate = useNavigate();

  // Get user from Redux
  const user = useSelector((state: any) => state?.auth?.user);




  // TEMPORARY: Force show button for testing
  // Change this to true to ALWAYS show the Create button
  const FORCE_SHOW_BUTTON = true; // ← SET THIS TO true TO SHOW BUTTON

  // Real permission check
  const canCreate = FORCE_SHOW_BUTTON || hasPermission("purchase_orders.create") || user?.role === "admin";
  const canEdit = FORCE_SHOW_BUTTON || hasPermission("purchase_orders.edit") || user?.role === "admin";
  const canDelete = FORCE_SHOW_BUTTON || hasPermission("purchase_orders.delete") || user?.role === "admin";


  const {
    purchaseOrders,
    loading,
    error,
    loadPurchaseOrders,
    removePurchaseOrder,
  } = usePurchaseOrders();

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "">("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [poToDelete, setPoToDelete] = useState<string | number | null>(null);

  useEffect(() => {
    loadPurchaseOrders();
  }, [loadPurchaseOrders]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as PurchaseOrderStatus | "");
    setCurrentPage(1);
  };

  const handleView = useCallback((po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowViewModal(true);
  }, []);

  const handleEdit = useCallback(
    (po: PurchaseOrder) => {
      navigate(`/purchase-orders/edit/${po.id}`, { state: po });
    },
    [navigate]
  );

  const triggerDelete = useCallback((id: string | number) => {
    setPoToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!poToDelete) return;

    try {
      await removePurchaseOrder(poToDelete);
      toast.success("Purchase Order deleted successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete purchase order");
    } finally {
      setShowDeleteModal(false);
      setPoToDelete(null);
    }
  };

  const filteredPOs = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return (purchaseOrders || []).filter((po) => {
      const poNumber = po.poNumber?.toLowerCase() ?? "";
      const supplierName = po.supplier?.supplierName?.toLowerCase() ?? "";
      const supplierCode = po.supplier?.supplierCode?.toLowerCase() ?? "";

      const matchesSearch =
        poNumber.includes(term) ||
        supplierName.includes(term) ||
        supplierCode.includes(term);

      const matchesStatus = statusFilter === "" || po.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredPOs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPOs = filteredPOs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getStatusBadgeClass = (status: PurchaseOrderStatus) =>
    `badge bg-${STATUS_COLORS[status] || "secondary"}`;

  return (
    <div className="inner-container">
      <Container fluid>
        {/* Page Header */}
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Purchase Orders</h2>
                <div className="page-breadcrumb">Home / Purchase / Purchase Orders</div>
              </div>
            </Col>
            <Col lg={6} md={12}>
              <div className="page-header-actions">
                <div className="page-filter-wrap" style={{ minWidth: "150px" }}>
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={handleStatusFilter}
                  >
                    <option value="">All Status</option>
                    <option value="DRAFT">Draft</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="OPEN">Open</option>
                    <option value="PARTIALLY_RECEIVED">Partially Received</option>
                    <option value="CLOSED">Closed</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div className="page-search-wrap">
                  <FaSearch className="page-search-icon" />
                  <input
                    type="text"
                    className="page-search-input"
                    placeholder="Search by PO # or Supplier..."
                    value={searchTerm}
                    onChange={handleSearch}
                  />
                </div>

                {/* ✅ CREATE BUTTON - With debug text */}
                {canCreate ? (
                  <CustomButton
                    text="Create PO"
                    icon={FaPlus}
                    onClick={() => navigate("/purchase-orders/create")}
                  />
                ) : (
                  // Debug: Show if button is hidden
                  <span style={{ color: 'red', fontSize: '12px' }}>
                    ⚠️ Create button hidden (canCreate = false)
                  </span>
                )}
              </div>
            </Col>
          </Row>
        </div>

        {/* Table */}
        <div className="master-table-body table-wrap">
          <div className="master-table-body">
            {loading && (purchaseOrders?.length ?? 0) === 0 ? (
              <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
              </div>
            ) : (
              <table className="master-data-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>#</th>
                    <th>PO NUMBER</th>
                    <th>PO DATE</th>
                    <th>SUPPLIER</th>
                    <th>NET AMOUNT</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPOs.length > 0 ? (
                    paginatedPOs.map((po, index) => (
                      <tr key={po.id} className="master-data-row">
                        <td className="master-data-cell">
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>
                        <td className="master-data-cell">
                          <strong>{po.poNumber || "-"}</strong>
                        </td>
                        <td className="master-data-cell">
                          {po.poDate ? new Date(po.poDate).toLocaleDateString() : "-"}
                        </td>
                        <td className="master-data-cell">
                          {po.supplier?.supplierName || "N/A"}
                        </td>
                        <td className="master-data-cell">
                          ₹{(po.netAmount ?? 0).toLocaleString()}
                        </td>
                        <td className="master-data-cell">
                          <span className={getStatusBadgeClass(po.status)}>
                            {po.status}
                          </span>
                        </td>
                        <td className="master-data-cell">
                          <div className="table-action-group">
                            <ViewButton onClick={() => handleView(po)} />
                            {canEdit && po.status !== "COMPLETED" && po.status !== "CANCELLED" && (
                              <EditButton onClick={() => handleEdit(po)} />
                            )}
                            {canDelete && po.status === "DRAFT" && (
                              <DeleteButton onClick={() => triggerDelete(po.id)} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center p-4">
                        No purchase orders found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination-wrap">
                <button
                  className="pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <FaChevronLeft />
                </button>
                <div className="pagination-info">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  className="pagination-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <FaChevronRight />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <PurchaseOrderViewModal
          show={showViewModal}
          onHide={() => setShowViewModal(false)}
          purchaseOrder={selectedPO}
        />

        <CommonConfirmModal
          show={showDeleteModal}
          onHide={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          title="Confirm Delete"
          message="Are you sure you want to delete this purchase order?"
          confirmText="Delete"
          confirmVariant="danger"
        />
      </Container>
    </div>
  );
};

export default PurchaseOrderListPage;