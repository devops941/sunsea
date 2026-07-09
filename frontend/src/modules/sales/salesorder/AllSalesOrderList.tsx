import React, { useState, useCallback, useEffect, useRef } from "react";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaFilter, FaTimes } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CustomButton from "../../../components/ui/Button/Button";
import { salesOrderService } from "../../../services/salesOrderService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { DISPATCH_TYPE_OPTIONS } from "../../../constants/selectOption";

const ITEMS_PER_PAGE = 10;



const AllSalesOrderList: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get("search") || "";
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    // ─── Filters ────────────────────────────────────────────────
    const [showFilterPopover, setShowFilterPopover] = useState(false);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [dispatchType, setDispatchType] = useState("");

    // ── Draft values inside the popover (only applied on "Apply") ──
    const [draftFromDate, setDraftFromDate] = useState("");
    const [draftToDate, setDraftToDate] = useState("");
    const [draftDispatchType, setDraftDispatchType] = useState("");

    const filterBtnRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const hasActiveFilters = !!(fromDate || toDate || dispatchType);
    const activeFilterCount = [fromDate, toDate, dispatchType].filter(Boolean).length;

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const response = await salesOrderService.fetchAll({
                page: currentPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchTerm || undefined,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined,
                dispatchType: dispatchType || undefined,
            });

            setData(response.data || []);
            setTotal((response.total ?? 0) / 10);
        } catch (error: any) {
            console.error("❌ Fetch error:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch orders");
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm, fromDate, toDate, dispatchType]);

    // ─── Load Data on Mount & Dependencies ─────────────────────
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchOrders]);

    // ── Close popover on outside click ──
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node) &&
                filterBtnRef.current &&
                !filterBtnRef.current.contains(e.target as Node)
            ) {
                setShowFilterPopover(false);
            }
        };
        if (showFilterPopover) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showFilterPopover]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleToggleFilterPopover = () => {
        if (!showFilterPopover) {
            // sync drafts with currently-applied filters when opening
            setDraftFromDate(fromDate);
            setDraftToDate(toDate);
            setDraftDispatchType(dispatchType);
        }
        setShowFilterPopover(!showFilterPopover);
    };

    const handleApplyFilters = () => {
        setFromDate(draftFromDate);
        setToDate(draftToDate);
        setDispatchType(draftDispatchType);
        setCurrentPage(1);
        setShowFilterPopover(false);
    };

    const handleClearFilters = () => {
        setDraftFromDate("");
        setDraftToDate("");
        setDraftDispatchType("");
        setFromDate("");
        setToDate("");
        setDispatchType("");
        setCurrentPage(1);
        setShowFilterPopover(false);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const handleOpenView = (id: number) => {
        navigate(`/sales-order/details/${id}`);
    };

    const handleOpenAdd = () => {
        navigate("/sales-order/create");
    };

    return (
        <div className="inner-container">
            <Container fluid>
                {/* Page Header */}
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Sales Order Management</h2>
                                <div className="page-breadcrumb">Home / Sales / Sales Orders</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions" style={{ position: "relative" }}>
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

                                {/* ── Filter trigger button ── */}
                                <div ref={filterBtnRef} style={{ position: "relative" }}>
                                    <CustomButton
                                        text={activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
                                        icon={FaFilter}
                                        onClick={handleToggleFilterPopover}
                                        className={hasActiveFilters ? "btn-success" : ""}
                                    />

                                    {/* ── Popover card ── */}
                                    {showFilterPopover && (
                                        <div
                                            ref={popoverRef}
                                            style={{
                                                position: "absolute",
                                                top: "calc(100% + 8px)",
                                                right: 0,
                                                width: 300,
                                                background: "var(--color-surface)",
                                                border: "1px solid var(--color-border)",
                                                borderRadius: "var(--radius-md)",
                                                boxShadow: "var(--shadow-md)",
                                                padding: "16px",
                                                zIndex: 1000,
                                            }}
                                        >
                                            <div className="d-flex align-items-center justify-content-between mb-3">
                                                <span
                                                    className="fw-bold"
                                                    style={{ color: "var(--color-primary)", fontFamily: "var(--font-head)", fontSize: "0.95rem" }}
                                                >
                                                    Filter Orders
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowFilterPopover(false)}
                                                    style={{ border: "none", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" }}
                                                >
                                                    <FaTimes />
                                                </button>
                                            </div>

                                            <div className="mb-3">
                                                <label
                                                    className="d-block mb-1 small text-uppercase"
                                                    style={{ fontSize: "0.7rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                                >
                                                    From Date
                                                </label>
                                                <input
                                                    type="date"
                                                    className="form-control form-control-sm"
                                                    value={draftFromDate}
                                                    max={draftToDate || undefined}
                                                    onChange={(e) => setDraftFromDate(e.target.value)}
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label
                                                    className="d-block mb-1 small text-uppercase"
                                                    style={{ fontSize: "0.7rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                                >
                                                    To Date
                                                </label>
                                                <input
                                                    type="date"
                                                    className="form-control form-control-sm"
                                                    value={draftToDate}
                                                    min={draftFromDate || undefined}
                                                    onChange={(e) => setDraftToDate(e.target.value)}
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label
                                                    className="d-block mb-1 small text-uppercase"
                                                    style={{ fontSize: "0.7rem", letterSpacing: "0.05em", color: "var(--color-text-muted)", fontWeight: 600 }}
                                                >
                                                    Dispatch Type
                                                </label>
                                                <select
                                                    className="form-select form-select-sm"
                                                    value={draftDispatchType}
                                                    onChange={(e) => setDraftDispatchType(e.target.value)}
                                                >
                                                    <option value="">All</option>
                                                    {DISPATCH_TYPE_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="d-flex gap-2 mt-3 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
                                                <CustomButton text="Clear" onClick={handleClearFilters} />
                                                <CustomButton text="Apply" onClick={handleApplyFilters} className="btn-success" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <CustomButton
                                    text="Add Sales Order"
                                    icon={FaPlus}
                                    onClick={handleOpenAdd}
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
                                    <th>ORDER NO</th>
                                    <th>ORDER DATE</th>
                                    <th>CUSTOMER</th>
                                    <th>DISPATCH</th>
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
                                            <td className="master-data-cell">
                                                {item?.dispatchType}
                                            </td>
                                            <td className="master-data-cell">
                                                <StatusBadge status={item.status} />
                                            </td>
                                            <td className="master-data-cell">
                                                <div className="table-action-group">
                                                    <ViewButton onClick={() => handleOpenView(item.id)} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="text-center p-4">
                                            No sales orders found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {total > 1 && (
                            <div className="pagination-wrap">
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                >
                                    <FaChevronLeft />
                                </button>
                                <div className="pagination-info">Page {currentPage} of {total}</div>
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === total}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </Container>
        </div>
    );
};

export default AllSalesOrderList;