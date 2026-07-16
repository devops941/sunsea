import React, { useState, useCallback, useEffect, useRef } from "react";

import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight, FaFilter, FaTimes } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CustomButton from "../../../components/ui/Button/Button";
import { salesOrderService } from "../../../services/salesOrderService";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { DISPATCH_TYPE_OPTIONS } from "../../../constants/selectOption";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";

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
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [dispatchType, setDispatchType] = useState("");

    // ── Draft values inside the popover (only applied on "Apply") ──
    const [draftFromDate, setDraftFromDate] = useState("");
    const [draftToDate, setDraftToDate] = useState("");
    const [draftDispatchType, setDraftDispatchType] = useState("");

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
            setTotal(Math.ceil((response.total ?? 0) / ITEMS_PER_PAGE));
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

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleOpenFilter = () => {
        setDraftFromDate(fromDate);
        setDraftToDate(toDate);
        setDraftDispatchType(dispatchType);
    };

    const handleApplyFilters = () => {
        setFromDate(draftFromDate);
        setToDate(draftToDate);
        setDispatchType(draftDispatchType);
        setCurrentPage(1);
    };

    const handleClearFilters = () => {
        setDraftFromDate("");
        setDraftToDate("");
        setDraftDispatchType("");
        setFromDate("");
        setToDate("");
        setDispatchType("");
        setCurrentPage(1);
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
        <div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Sales Order Management</h2>
                </div>

                    <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
                        <SearchInput
                            value={searchTerm}
                            onChange={handleSearch}
                            placeholder="Search orders..."
                        />

                        {/* ── Filter trigger button ── */}
                        <FilterPopover
                            activeFilterCount={activeFilterCount}
                            hasActiveFilters={hasActiveFilters}
                            onApply={handleApplyFilters}
                            onClear={handleClearFilters}
                            onOpen={handleOpenFilter}
                        >
                            <div className="mb-3">
                                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                                    From Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                    value={draftFromDate}
                                    max={draftToDate || undefined}
                                    onChange={(e) => setDraftFromDate(e.target.value)}
                                />
                            </div>

                            <div className="mb-3">
                                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                                    To Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                    value={draftToDate}
                                    min={draftFromDate || undefined}
                                    onChange={(e) => setDraftToDate(e.target.value)}
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block mb-1 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                                    Dispatch Type
                                </label>
                                <select
                                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
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
                        </FilterPopover>

                        <CustomButton
                            text="Add Sales Order"
                            icon={FaPlus}
                            onClick={handleOpenAdd}
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={data}
                    rowKey={(item) => item.id}
                    loading={loading}
                    emptyMessage="No sales orders found."
                    pagination={{
                        currentPage,
                        totalPages: total,
                        onPageChange: (page) => setCurrentPage(page),
                    }}
                    columns={[
                        {
                            header: "#",
                            width: "60px",
                            render: (_item, index) => (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
                        },
                        { header: "ORDER NO", accessor: "orderNo" },
                        { header: "ORDER DATE", render: (item) => formatDate(item.orderDate) },
                        {
                            header: "CUSTOMER",
                            render: (item) => item.customer?.displayName || item.customer?.firmName || "N/A",
                        },
                        { header: "DISPATCH", render: (item) => item?.dispatchType },
                        { header: "STATUS", render: (item) => <StatusBadge status={item.status} /> },
                        { header: "ACTIONS", render: (item) => <ViewButton onClick={() => handleOpenView(item.id)} /> },
                    ]}
                />
            </div>
        </div>
    );
};

export default AllSalesOrderList;