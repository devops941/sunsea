import React, { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Spinner, Modal } from "react-bootstrap";
import {
  FaSearch,
  FaPlus,
  FaChevronLeft,
  FaChevronRight,
  FaEye,
  FaDownload,
} from "react-icons/fa";
import { toast } from "react-toastify";

import ViewButton from "../../components/ui/viewbutton/ViewButton";
import EditButton from "../../components/ui/EditButton/EditButton";
import DeleteButton from "../../components/ui/DeleteButton/DeleteButton";
import CustomButton from "../../components/ui/custombutton/CustomButton";
import CommonConfirmModal from "../../components/ui/CommonConfirmModal/CommonConfirmModal";
import ExpensesCreate from "./Expensescreate";
import { useExpenses } from "../../hooks/useExpenses";

const ITEMS_PER_PAGE = 10;

interface Expense {
  id: string;
  expenseNumber: string;
  expenseCategory: string;
  date: string;
  expense: string;
  amount: string;
  description: string;
  supplier?: { legalName: string; supplierCode: string } | any;
  paymentMethod: string;
  status: string;
  notes: string;
  receiptInvoice: string;
}

const ExpensesList: React.FC = () => {
  const { expenses, loading, error, loadExpenses, removeExpense } = useExpenses();

  // Page views: "list" | "create" | "edit"
  const [viewMode, setViewMode] = useState<"list" | "create" | "edit">("list");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // Fetch expenses with search term debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadExpenses(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, loadExpenses]);

  // Error toast observer
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleView = useCallback((expense: Expense) => {
    setSelectedExpense(expense);
    setShowViewModal(true);
  }, []);

  const handleEdit = useCallback((expense: Expense) => {
    setSelectedExpense(expense);
    setViewMode("edit");
  }, []);

  const triggerDelete = useCallback((id: string) => {
    setExpenseToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (expenseToDelete !== null) {
      try {
        await removeExpense(expenseToDelete);
        toast.success("Expense deleted successfully!");
        loadExpenses(searchTerm);
      } catch (err: any) {
        toast.error(err.message || "Failed to delete expense.");
      } finally {
        setShowDeleteModal(false);
        setExpenseToDelete(null);
      }
    }
  };

  const handleSaveComplete = () => {
    setViewMode("list");
    setSelectedExpense(null);
    loadExpenses(searchTerm);
  };

  const handleCancel = () => {
    setViewMode("list");
    setSelectedExpense(null);
  };

  // Filter Logic (Category and Status filters are done on filtered list)
  const filteredExpenses = (expenses || []).filter((exp) => {
    const matchesCategory = filterCategory ? exp.expenseCategory === filterCategory : true;
    const matchesStatus = filterStatus ? exp.status === filterStatus : true;
    return matchesCategory && matchesStatus;
  });

  const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedExpenses = filteredExpenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Categories list extracted from data
  const categories = Array.from(new Set((expenses || []).map((e) => e.expenseCategory)));
  const statuses = ["Draft", "Pending", "Approved", "Rejected"];

  // Helper to format date strings cleanly
  const formatDateString = (isoString: string) => {
    if (!isoString) return "N/A";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  if (viewMode === "create") {
    return <ExpensesCreate onSaveComplete={handleSaveComplete} onCancel={handleCancel} />;
  }

  if (viewMode === "edit" && selectedExpense) {
    return (
      <ExpensesCreate
        onSaveComplete={handleSaveComplete}
        onCancel={handleCancel}
        initialData={selectedExpense}
      />
    );
  }

  return (
    <div className="inner-container">
      <Container fluid>
        {/* Page Header */}
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={4} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Expense Management</h2>
                
              </div>
            </Col>
            <Col lg={8} md={12}>
              <div className="page-header-actions d-flex flex-wrap gap-2 justify-content-lg-end">
                <div className="page-search-wrap">
                  <FaSearch className="page-search-icon" />
                  <input
                    type="text"
                    className="page-search-input"
                    placeholder="Search expenses..."
                    value={searchTerm}
                    onChange={handleSearch}
                  />
                </div>

                <div className="d-flex gap-2 align-items-center">
                  <select
                    className="form-select select-input-control"
                    style={{ width: "160px", padding: "6px 12px", borderRadius: "8px", fontSize: "0.9rem" }}
                    value={filterCategory}
                    onChange={(e) => {
                      setFilterCategory(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat, idx) => (
                      <option key={idx} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    className="form-select select-input-control"
                    style={{ width: "140px", padding: "6px 12px", borderRadius: "8px", fontSize: "0.9rem" }}
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">All Statuses</option>
                    {statuses.map((stat, idx) => (
                      <option key={idx} value={stat}>
                        {stat === "Pending" ? "Pending Approval" : stat}
                      </option>
                    ))}
                  </select>

                  <CustomButton
                    text="Add Expense"
                    icon={FaPlus}
                    onClick={() => setViewMode("create")}
                    variant="primary"
                  />
                </div>
              </div>
            </Col>
          </Row>
        </div>

        {/* View Table */}
        <div className="master-table-body table-wrap">
          <div className="master-table-body">
            {loading && filteredExpenses.length === 0 ? (
              <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
              </div>
            ) : (
              <table className="master-data-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>#</th>
                    <th>EXPENSE NUMBER</th>
                    <th>CATEGORY</th>
                    <th>DATE</th>
                    <th>EXPENSE</th>
                    <th className="text-end">AMOUNT</th>
                    <th>SUPPLIER</th>
                    <th>PAYMENT METHOD</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.length > 0 ? (
                    paginatedExpenses.map((exp, index) => (
                      <tr key={exp.id} className="master-data-row">
                        <td className="master-data-cell">
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>

                        <td className="master-data-cell">{exp.expenseNumber}</td>

                        <td className="master-data-cell">
                          <span className="badge bg-light text-dark p-2 border">{exp.expenseCategory}</span>
                        </td>

                        <td className="master-data-cell">{formatDateString(exp.date)}</td>

                        <td className="master-data-cell">{exp.expense}</td>

                        <td className="master-data-cell text-end fw-semibold text-primary">
                          ₹{parseFloat(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="master-data-cell">
                          {exp.supplier?.legalName || exp.supplier || "N/A"}
                        </td>

                        <td className="master-data-cell">{exp.paymentMethod}</td>

                        <td className="master-data-cell">
                          <span
                            className={`status-pill status-pill--${
                              exp.status === "Approved"
                                ? "active"
                                : exp.status === "Pending"
                                ? "pending"
                                : exp.status === "Rejected"
                                ? "inactive"
                                : "draft"
                            }`}
                            style={{
                              backgroundColor:
                                exp.status === "Pending"
                                  ? "#fff3cd"
                                  : exp.status === "Draft"
                                  ? "#e2e3e5"
                                  : undefined,
                              color:
                                exp.status === "Pending"
                                  ? "#856404"
                                  : exp.status === "Draft"
                                  ? "#383d41"
                                  : undefined,
                              border:
                                exp.status === "Pending"
                                  ? "1px solid #ffeeba"
                                  : exp.status === "Draft"
                                  ? "1px solid #d6d8db"
                                  : undefined,
                            }}
                          >
                            {exp.status === "Pending" ? "Pending Approval" : exp.status}
                          </span>
                        </td>

                        <td className="master-data-cell">
                          <div className="table-action-group">
                            <ViewButton onClick={() => handleView(exp)} />
                            <EditButton onClick={() => handleEdit(exp)} />
                            <DeleteButton onClick={() => triggerDelete(exp.id)} />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="text-center p-4">
                        No expenses found.
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

        {/* View Modal */}
        <Modal
          show={showViewModal}
          onHide={() => setShowViewModal(false)}
          size="lg"
          centered
          className="expense-view-modal"
        >
          <Modal.Header closeButton style={{ background: "#f8f9fa", borderBottom: "1px solid #e9ecef" }}>
            <Modal.Title className="fw-bold text-dark d-flex align-items-center gap-2">
              <FaEye className="text-primary" />
              <span>Expense Details: {selectedExpense?.expenseNumber}</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
            {selectedExpense && (
              <div className="expense-details-grid">
                <Row className="g-4">
                  <Col md={6}>
                    <div className="mb-3">
                      <span className="text-muted d-block small">Expense Number</span>
                      <strong className="fs-5">{selectedExpense.expenseNumber}</strong>
                    </div>
                    <div className="mb-3">
                      <span className="text-muted d-block small">Category</span>
                      <span className="badge bg-light text-dark border p-2 mt-1">
                        {selectedExpense.expenseCategory}
                      </span>
                    </div>
                    <div className="mb-3">
                      <span className="text-muted d-block small">Expense Date</span>
                      <strong>{formatDateString(selectedExpense.date)}</strong>
                    </div>
                    <div className="mb-3">
                      <span className="text-muted d-block small">Expense Name</span>
                      <strong>{selectedExpense.expense}</strong>
                    </div>
                    <div className="mb-3">
                      <span className="text-muted d-block small">Amount</span>
                      <strong className="fs-5 text-primary">
                        ₹{parseFloat(selectedExpense.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="mb-3">
                      <span className="text-muted d-block small">Supplier</span>
                      <strong>{selectedExpense.supplier?.legalName || selectedExpense.supplier || "N/A"}</strong>
                    </div>
                    <div className="mb-3">
                      <span className="text-muted d-block small">Payment Method</span>
                      <strong>{selectedExpense.paymentMethod}</strong>
                    </div>
                    <div className="mb-3">
                      <span className="text-muted d-block small">Status</span>
                      <span
                        className={`status-pill status-pill--${
                          selectedExpense.status === "Approved"
                            ? "active"
                            : selectedExpense.status === "Pending"
                            ? "pending"
                            : selectedExpense.status === "Rejected"
                            ? "inactive"
                            : "draft"
                        } mt-1 d-inline-block`}
                      >
                        {selectedExpense.status === "Pending" ? "Pending Approval" : selectedExpense.status}
                      </span>
                    </div>
                    <div className="mb-3">
                      <span className="text-muted d-block small">Receipt / Invoice</span>
                      {selectedExpense.receiptInvoice ? (
                        <div className="d-flex align-items-center gap-2 mt-1">
                          <span className="text-success small fw-semibold">
                            {selectedExpense.receiptInvoice}
                          </span>
                          <CustomButton
                            text="Download"
                            icon={FaEye}
                            size="sm"
                            onClick={() => toast.info(`Downloading file: ${selectedExpense.receiptInvoice}`)}
                            variant="dark"
                          />
                        </div>
                      ) : (
                        <span className="text-muted">No attachment</span>
                      )}
                    </div>
                  </Col>
                  <Col md={12}>
                    <hr className="my-2" />
                    <div className="mb-3">
                      <span className="text-muted d-block small">Description</span>
                      <p className="bg-light p-3 rounded border text-secondary" style={{ whiteSpace: "pre-wrap" }}>
                        {selectedExpense.description || "No description provided."}
                      </p>
                    </div>
                    <div className="mb-0">
                      <span className="text-muted d-block small">Internal Notes</span>
                      <p className="bg-light p-3 rounded border text-secondary" style={{ whiteSpace: "pre-wrap" }}>
                        {selectedExpense.notes || "No internal notes."}
                      </p>
                    </div>
                  </Col>
                </Row>
              </div>
            )}
          </Modal.Body>
        </Modal>

        {/* Delete Confirm Modal */}
        <CommonConfirmModal
          show={showDeleteModal}
          onHide={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          title="Confirm Delete"
          message="Are you sure you want to delete this expense?"
          confirmText="Delete"
          confirmVariant="danger"
        />
      </Container>
    </div>
  );
};

export default ExpensesList;
