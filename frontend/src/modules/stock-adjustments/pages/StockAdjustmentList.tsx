import React, { useState, useEffect } from "react";
import { Container, Row, Col, Spinner, Badge } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaEye } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchStockAdjustments } from "../../../features/stock-adjustments/stockAdjustmentSlice";

import CustomButton from "../../../components/ui/Button/Button";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import { formatDate } from "../../../utils/dateUtils";

const ITEMS_PER_PAGE = 10;

const StockAdjustmentList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data, loading, error } = useAppSelector((state) => state.stockAdjustments);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    dispatch(fetchStockAdjustments({ search: debouncedSearch, status }));
  }, [dispatch, debouncedSearch, status]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT": return <Badge bg="secondary">Draft</Badge>;
      case "PENDING_APPROVAL": return <Badge bg="warning">Pending Approval</Badge>;
      case "APPROVED": return <Badge bg="success">Approved</Badge>;
      case "REJECTED": return <Badge bg="danger">Rejected</Badge>;
      default: return <Badge bg="secondary">{status}</Badge>;
    }
  };

  const totalPages = Math.ceil((data?.length || 0) / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = (data || []).slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="inner-container">
      <Container fluid>
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={4} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Stock Adjustments</h2>
                <div className="page-breadcrumb">Home / Inventory & Warehouse / Stock Adjustments</div>
              </div>
            </Col>
            <Col lg={8} md={12}>
              <div className="page-header-actions">
                <div className="page-search-wrap me-2" style={{ minWidth: "200px" }}>
                  <SelectInput
                    label="Filter Status"
                    hideLabel
                    name="statusFilter"
                    value={status}
                    options={[
                      { label: "All Statuses", value: "" },
                      { label: "Draft", value: "DRAFT" },
                      { label: "Pending Approval", value: "PENDING_APPROVAL" },
                      { label: "Approved", value: "APPROVED" },
                      { label: "Rejected", value: "REJECTED" },
                    ]}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <div className="page-search-wrap me-2">
                  <FaSearch className="page-search-icon" />
                  <input
                    type="text"
                    className="page-search-input"
                    placeholder="Search by ID or Reason..."
                    value={searchTerm}
                    onChange={handleSearch}
                  />
                </div>
                <CustomButton
                  text="New Adjustment"
                  icon={FaPlus}
                  onClick={() => navigate("/inventory/stock-adjustments/create")}
                />
              </div>
            </Col>
          </Row>
        </div>

        <div className="page-content">
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Adjustment No</th>
                  <th>Date</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4">
                      <Spinner animation="border" variant="primary" size="sm" className="me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((adj) => (
                    <tr key={adj.id}>
                      <td>{adj.adjustmentNumber}</td>
                      <td>{formatDate(adj.adjustmentDate)}</td>
                      <td>{adj.reason || "-"}</td>
                      <td>{getStatusBadge(adj.status)}</td>
                      <td>
                        <button
                          className="action-btn view-btn me-2"
                          onClick={() => navigate(`/inventory/stock-adjustments/view/${adj.id}`)}
                          title="View Details"
                        >
                          <FaEye />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      No stock adjustments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination-wrapper mt-3">
              <span className="pagination-info">
                Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, data?.length || 0)} of {data?.length} entries
              </span>
              <div className="pagination-controls">
                <button
                  className="page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                >
                  <FaChevronLeft />
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  className="page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                >
                  <FaChevronRight />
                </button>
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
};

export default StockAdjustmentList;
