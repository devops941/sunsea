import React, { useState, useEffect } from "react";
import { Container, Row, Col, Spinner, Badge } from "react-bootstrap";
import {
  FaSearch,
  FaPlus,
  FaChevronLeft,
  FaChevronRight,
  FaEye,
  FaFilter,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchStockAdjustments } from "../../../features/stock-adjustments/stockAdjustmentSlice";

import CustomButton from "../../../components/ui/Button/Button";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import { formatDate } from "../../../utils/dateUtils";

const ITEMS_PER_PAGE = 10;

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  PRODUCTION_MATERIAL_ISSUE: "Prod. Material Issue",
  PRODUCTION_MATERIAL_RETURN: "Prod. Material Return",
  STOCK_INCREASE: "Stock Increase",
  STOCK_DECREASE: "Stock Decrease",
  DAMAGE: "Damage",
  SCRAP: "Scrap",
  OPENING_STOCK: "Opening Stock",
  MANUAL_CORRECTION: "Manual Correction",
  OTHER: "Other",
};

const ADJUSTMENT_TYPE_BADGE: Record<string, string> = {
  PRODUCTION_MATERIAL_ISSUE: "primary",
  PRODUCTION_MATERIAL_RETURN: "info",
  STOCK_INCREASE: "success",
  STOCK_DECREASE: "warning",
  DAMAGE: "danger",
  SCRAP: "secondary",
  OPENING_STOCK: "dark",
  MANUAL_CORRECTION: "light",
  OTHER: "secondary",
};

const StockAdjustmentList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data, meta, loading, error } = useAppSelector(
    (state) => state.stockAdjustments
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    dispatch(
      fetchStockAdjustments({
        search: debouncedSearch,
        status,
        adjustmentType,
        dateFrom,
        dateTo,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      })
    );
  }, [dispatch, debouncedSearch, status, adjustmentType, dateFrom, dateTo, currentPage]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);



  const getTypeBadge = (type: string) => (
    <Badge bg={ADJUSTMENT_TYPE_BADGE[type] || "secondary"} style={{ fontSize: "0.75rem" }}>
      {ADJUSTMENT_TYPE_LABELS[type] || type}
    </Badge>
  );

  const totalPages = meta?.totalPages || Math.ceil((data?.length || 0) / ITEMS_PER_PAGE);

  const clearFilters = () => {
    setSearchTerm("");
    setStatus("");
    setAdjustmentType("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  return (
    <div className="inner-container">
      <Container fluid>
        {/* PAGE HEADER */}
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={4} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Stock Adjustments</h2>

              </div>
            </Col>
            <Col lg={8} md={12}>
              <div className="page-header-actions">
                {/* Status Filter */}
                <div className="page-search-wrap me-2" style={{ minWidth: "160px" }}>
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

                {/* Type Filter */}
                <div className="page-search-wrap me-2" style={{ minWidth: "200px" }}>
                  <SelectInput
                    label="Adjustment Type"
                    hideLabel
                    name="typeFilter"
                    value={adjustmentType}
                    options={[
                      { label: "All Types", value: "" },
                      { label: "Production Material Issue", value: "PRODUCTION_MATERIAL_ISSUE" },
                      { label: "Production Material Return", value: "PRODUCTION_MATERIAL_RETURN" },
                      { label: "Stock Increase", value: "STOCK_INCREASE" },
                      { label: "Stock Decrease", value: "STOCK_DECREASE" },
                      { label: "Damage", value: "DAMAGE" },
                      { label: "Scrap", value: "SCRAP" },
                      { label: "Opening Stock", value: "OPENING_STOCK" },
                      { label: "Manual Correction", value: "MANUAL_CORRECTION" },
                      { label: "Other", value: "OTHER" },
                    ]}
                    onChange={(e) => {
                      setAdjustmentType(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                {/* Advanced Filters Toggle */}
                <button
                  className={`btn btn-sm me-2 ${showFilters ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setShowFilters(!showFilters)}
                  title="Date Filters"
                >
                  <FaFilter />
                </button>

                {/* Search */}
                <div className="page-search-wrap me-2">
                  <FaSearch className="page-search-icon" />
                  <input
                    type="text"
                    className="page-search-input"
                    placeholder="Search by No, Reason, PO..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
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

          {/* Advanced Date Filters */}
          {showFilters && (
            <Row className="mt-3 g-2 align-items-center">
              <Col xs="auto">
                <label className="form-label text-muted small mb-1">Date From</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                />
              </Col>
              <Col xs="auto">
                <label className="form-label text-muted small mb-1">Date To</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                />
              </Col>
              <Col xs="auto" className="mt-3">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={clearFilters}
                >
                  Clear All
                </button>
              </Col>
            </Row>
          )}
        </div>

        <div className="page-content">
          <div className="master-table-body table-wrap">
            <table className="master-data-table">
              <thead>
                <tr>
                  <th>ADJUSTMENT NO</th>
                  <th>TYPE</th>
                  <th>PRODUCTION ORDER</th>
                  <th>PRODUCT</th>
                  <th>DATE</th>
                  <th>ITEMS</th>
                  <th>REASON</th>
                  <th>CREATED BY</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-4">
                      <Spinner animation="border" variant="primary" size="sm" className="me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : data.length > 0 ? (
                  data.map((adj: any) => (
                    <tr key={adj.id} className="master-data-row">
                      <td className="master-data-cell fw-semibold">{adj.adjustmentNumber}</td>
                      <td className="master-data-cell">{getTypeBadge(adj.adjustmentType || "STOCK_INCREASE")}</td>
                      <td className="master-data-cell">
                        {adj.productionOrderId ? (
                          <span className="text-primary fw-semibold">{adj.productionOrderId}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="master-data-cell">
                        {adj.productionOrder?.productItem?.productName ? (
                          <div>
                            <div className="fw-semibold" style={{ fontSize: "0.85rem" }}>
                              {adj.productionOrder.productItem.productName}
                            </div>
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                              {adj.productionOrder.productItem.productCode}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="master-data-cell">{formatDate(adj.adjustmentDate)}</td>
                      <td className="master-data-cell">
                        <Badge bg="light" text="dark" className="border">
                          {adj.items?.length || 0} item{(adj.items?.length || 0) !== 1 ? "s" : ""}
                        </Badge>
                      </td>
                      <td className="master-data-cell">
                        <span
                          title={adj.reason}
                          style={{
                            maxWidth: 150,
                            display: "inline-block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {adj.reason || "—"}
                        </span>
                      </td>
                      <td className="master-data-cell text-muted small">{adj.createdBy || "—"}</td>
                      <td className="master-data-cell">
                        <StatusBadge status={adj.status} />
                      </td>
                      <td className="master-data-cell">
                        <ViewButton
                          onClick={() =>
                            navigate(`/inventory/stock-adjustments/view/${adj.id}`)
                          }
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="text-center py-4 text-muted">
                      No stock adjustments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination-wrapper mt-3">
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
                {meta?.total ? ` · ${meta.total} total` : ""}
              </span>
              <div className="pagination-controls">
                <button
                  className="page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                >
                  <FaChevronLeft />
                </button>
                {[...Array(Math.min(totalPages, 7))].map((_, i) => (
                  <button
                    key={i}
                    className={`page-btn ${currentPage === i + 1 ? "active" : ""}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  className="page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
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
