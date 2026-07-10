import React, { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../../components/ui/Button/Button";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { useCustomers } from "../../../hooks/useCustomers";
import { hasPermission } from "../../../utils/permission";
import CustomerViewModal from "../components/CustomerViewModal";

const ITEMS_PER_PAGE = 10;

const CustomerListPage: React.FC = () => {
  const navigate = useNavigate();
  const { customers, loading, error, loadCustomers, removeCustomer } = useCustomers();
  //const canCreateCustomer = hasPermission("customers.create");
  const canEditCustomer = hasPermission("customers.edit");
  const canDeleteCustomer = hasPermission("customers.delete");

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialSearch = searchParams.get("search") || "";

  const [searchTerm, setSearchTerm] = useState(initialSearch);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, loadCustomers]);

  // Custom confirm delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  // Initial load is now handled by the search effect above

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleView = useCallback((customer: any) => {
    setSelectedCustomer(customer);
    setShowViewModal(true);
  }, []);

  const handleEdit = useCallback((customer: any) => {
    navigate(`/customers/edit/${customer.id}`, {
      state: customer,
    });
  }, [navigate]);

  const triggerDelete = useCallback((id: string) => {
    setCustomerToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (customerToDelete !== null) {
      try {
        await removeCustomer(customerToDelete);
        toast.success("Customer deleted successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete customer");
      } finally {
        setShowDeleteModal(false);
        setCustomerToDelete(null);
      }
    }
  };
  const filteredCustomers = customers ?? [];

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="inner-container">
      <Container fluid>
        {/* Page Header */}
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Customer Management</h2>
                <div className="page-breadcrumb">Home / Customers</div>
              </div>
            </Col>
            <Col lg={6} md={12}>
              <div className="page-header-actions">
                <div className="page-search-wrap">
                  <FaSearch className="page-search-icon" />
                  <input
                    type="text"
                    className="page-search-input"
                    placeholder="Search customer..."
                    value={searchTerm}
                    onChange={handleSearch}
                  />
                </div>
                {/* {canCreateCustomer && */}
                <CustomButton
                  text="Add Customer"
                  icon={FaPlus}
                  onClick={() => navigate("/customers/create")}
                />
                {/* } */}
              </div>
            </Col>
          </Row>
        </div>

        {/* View Table */}
        <div className="master-table-body table-wrap">
          <div className="master-table-body">
            {loading && (customers ?? []).length === 0 ? (
              <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
              </div>
            ) : (
              <table className="master-data-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>#</th>
                    <th>CUSTOMER CODE</th>
                    <th>FIRM NAME</th>
                    <th>MOBILE</th>
                    <th>GMAIL</th>
                    <th>GST TYPE</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.length > 0 ? (
                    paginatedCustomers.map((customer: any, index: number) => (
                      <tr key={customer.id} className="master-data-row">
                        <td className="master-data-cell">
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>

                        <td className="master-data-cell">
                          {customer.customerCode}
                        </td>

                        <td className="master-data-cell">
                          {customer.firmName}
                        </td>

                        <td className="master-data-cell">
                          {customer.mobile || "N/A"}
                        </td>

                        <td className="master-data-cell">
                          {customer.email || "N/A"}
                        </td>

                        <td className="master-data-cell">
                          {customer.gstRegType || "N/A"}
                        </td>

                        <td className="master-data-cell">
                          <span
                            className={`status-pill status-pill--${customer.status === "Active"
                              ? "active"
                              : "inactive"
                              }`}
                          >
                            {customer.status}
                          </span>
                        </td>

                        <td className="master-data-cell">
                          <div className="table-action-group">
                            <ViewButton
                              onClick={() => handleView(customer)}
                            />

                            {canEditCustomer && (
                              <EditButton
                                onClick={() => handleEdit(customer)}
                              />
                            )}

                            {canDeleteCustomer && (
                              <DeleteButton
                                onClick={() =>
                                  triggerDelete(customer.id)
                                }
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center p-4">
                        No customers found.
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

        <CustomerViewModal
          show={showViewModal}
          onHide={() => setShowViewModal(false)}
          customer={selectedCustomer}
        />

        {/* Custom Delete Confirm Modal */}
        <CommonConfirmModal
          show={showDeleteModal}
          onHide={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          title="Confirm Delete"
          message="Are you sure you want to delete this customer?"
          confirmText="Delete"
          confirmVariant="danger"
        />
      </Container>
    </div>
  );
};

export default CustomerListPage;