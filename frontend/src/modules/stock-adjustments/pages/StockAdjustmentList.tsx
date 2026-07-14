import React, { useState, useEffect } from "react";
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
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
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



  const getTypeBadgeClass = (type: string) => {
    switch(ADJUSTMENT_TYPE_BADGE[type]) {
      case "primary": return "bg-blue-100 text-blue-800";
      case "info": return "bg-cyan-100 text-cyan-800";
      case "success": return "bg-green-100 text-green-800";
      case "warning": return "bg-yellow-100 text-yellow-800";
      case "danger": return "bg-red-100 text-red-800";
      case "dark": return "bg-gray-800 text-gray-100";
      case "light": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeBadge = (type: string) => (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider ${getTypeBadgeClass(type)}`}>
      {ADJUSTMENT_TYPE_LABELS[type] || type}
    </span>
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
    <div className="p-4 md:p-6 min-h-screen bg-slate-50">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Stock Adjustments</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            {/* Status Filter */}
            <div className="w-40">
              <SelectInput
                label="Filter Status"
                hideLabel
                noMargin
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
            <div className="w-52">
              <SelectInput
                label="Adjustment Type"
                hideLabel
                noMargin
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
              className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setShowFilters(!showFilters)}
              title="Date Filters"
            >
              <FaFilter size={18} />
            </button>

            {/* Search */}
            <SearchInput
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by No, Reason, PO..."
            />

            <CustomButton
              text="New Adjustment"
              icon={FaPlus}
              onClick={() => navigate("/inventory/stock-adjustments/create")}
            />
          </div>
        </div>

        {/* Advanced Date Filters */}
        {showFilters && (
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date From</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date To</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div>
              <button
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <DataTable
          data={data || []}
          rowKey={(item) => item.id}
          loading={loading}
          emptyMessage="No stock adjustments found."
          pagination={{
            currentPage,
            totalPages,
            onPageChange: (page) => setCurrentPage(page),
          }}
          columns={[
            {
              header: "ADJUSTMENT NO",
              accessor: "adjustmentNumber",
              render: (item) => <span className="font-semibold text-slate-700">{item.adjustmentNumber}</span>
            },
            {
              header: "TYPE",
              render: (item) => getTypeBadge(item.adjustmentType || "STOCK_INCREASE")
            },
            {
              header: "PRODUCTION ORDER",
              render: (item) => item.productionOrderId ? (
                <span className="text-blue-600 font-semibold">{item.productionOrderId}</span>
              ) : (
                <span className="text-slate-400">—</span>
              )
            },
            {
              header: "PRODUCT",
              render: (item) => item.productionOrder?.productItem?.productName ? (
                <div>
                  <div className="font-semibold text-sm text-slate-800">
                    {item.productionOrder.productItem.productName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.productionOrder.productItem.productCode}
                  </div>
                </div>
              ) : (
                <span className="text-slate-400">—</span>
              )
            },
            {
              header: "DATE",
              render: (item) => formatDate(item.adjustmentDate)
            },
            {
              header: "ITEMS",
              render: (item) => (
                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-semibold border border-slate-200">
                  {item.items?.length || 0} item{(item.items?.length || 0) !== 1 ? "s" : ""}
                </span>
              )
            },
            {
              header: "REASON",
              render: (item) => (
                <span
                  title={item.reason}
                  className="inline-block max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap text-slate-600"
                >
                  {item.reason || "—"}
                </span>
              )
            },
            {
              header: "CREATED BY",
              render: (item) => <span className="text-slate-500 text-sm">{item.createdBy || "—"}</span>
            },
            {
              header: "STATUS",
              render: (item) => <StatusBadge status={item.status} />
            },
            {
              header: "ACTIONS",
              render: (item) => (
                <div className="flex items-center gap-2">
                  <ViewButton onClick={() => navigate(`/inventory/stock-adjustments/view/${item.id}`)} />
                </div>
              )
            },
          ]}
        />
      </div>
    </div>
  );
};

export default StockAdjustmentList;
