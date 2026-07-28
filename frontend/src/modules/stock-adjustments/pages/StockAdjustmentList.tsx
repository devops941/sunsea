import React, { useState, useEffect } from "react";
import {
  FaPlus,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchStockAdjustments } from "../../../features/stock-adjustments/stockAdjustmentSlice";

import CustomButton from "../../../components/ui/Button/Button";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
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

const getPrimaryUom = (uomStr?: string) => {
  if (!uomStr) return "";
  const first = uomStr.split(",")[0].trim();
  const l = first.toLowerCase();
  if (l === "ea" || l === "each" || l === "piece" || l === "pcs") return "pcs";
  return first;
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

  // Draft filter states for popover
  const [draftStatus, setDraftStatus] = useState("");
  const [draftAdjustmentType, setDraftAdjustmentType] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");

  const hasActiveFilters = !!(status || adjustmentType || dateFrom || dateTo);
  const activeFilterCount = [status, adjustmentType, dateFrom, dateTo].filter(Boolean).length;

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

  const handleOpenFilter = () => {
    setDraftStatus(status);
    setDraftAdjustmentType(adjustmentType);
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
  };

  const handleApplyFilters = () => {
    setStatus(draftStatus);
    setAdjustmentType(draftAdjustmentType);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setDraftStatus("");
    setDraftAdjustmentType("");
    setDraftDateFrom("");
    setDraftDateTo("");
    setStatus("");
    setAdjustmentType("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const getTypeBadgeClass = (type: string) => {
    switch (ADJUSTMENT_TYPE_BADGE[type]) {
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

  return (
    <div className="p-4 md:p-1 min-h-screen ">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Stock Adjustments</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            {/* Search */}
            <SearchInput
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by No, Reason, PO..."
            />

            {/* Filter Popover */}
            <FilterPopover
              activeFilterCount={activeFilterCount}
              hasActiveFilters={hasActiveFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              onOpen={handleOpenFilter}
            >
              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Status
                </label>
                <select
                  className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white text-slate-700 font-medium"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Adjustment Type
                </label>
                <select
                  className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white text-slate-700 font-medium"
                  value={draftAdjustmentType}
                  onChange={(e) => setDraftAdjustmentType(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="PRODUCTION_MATERIAL_ISSUE">Production Material Issue</option>
                  <option value="PRODUCTION_MATERIAL_RETURN">Production Material Return</option>
                  <option value="STOCK_INCREASE">Stock Increase</option>
                  <option value="STOCK_DECREASE">Stock Decrease</option>
                  <option value="DAMAGE">Damage</option>
                  <option value="SCRAP">Scrap</option>
                  <option value="OPENING_STOCK">Opening Stock</option>
                  <option value="MANUAL_CORRECTION">Manual Correction</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  From Date
                </label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                  value={draftDateFrom}
                  max={draftDateTo || undefined}
                  onChange={(e) => setDraftDateFrom(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  To Date
                </label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-slate-700"
                  value={draftDateTo}
                  min={draftDateFrom || undefined}
                  onChange={(e) => setDraftDateTo(e.target.value)}
                />
              </div>
            </FilterPopover>

            <CustomButton
              text="New Adjustment"
              icon={FaPlus}
              onClick={() => navigate("/inventory/stock-adjustments/create")}
            />
          </div>
        </div>

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
              render: (item) => {
                const poId = item.productionOrderId;
                if (poId) {
                  return <span className="text-blue-600 font-semibold">{poId}</span>;
                }
                return <span className="text-slate-400">—</span>;
              }
            },
            {
              header: "PRODUCT",
              render: (item) => {
                const product = item.productionOrder?.productItem || item.items?.[0]?.product;
                const rawMaterial = item.items?.[0]?.rawMaterial;

                if (product?.productName) {
                  return (
                    <div>
                      <div className="font-semibold text-sm text-slate-800">
                        {product.productName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {product.productCode}
                      </div>
                      {item.items && item.items.length > 1 && (
                        <div className="text-[10px] text-slate-400 mt-0.5">+{item.items.length - 1} more</div>
                      )}
                    </div>
                  );
                }
                if (rawMaterial?.materialName) {
                  return (
                    <div>
                      <div className="font-semibold text-sm text-slate-800">
                        {rawMaterial.materialName}
                      </div>
                      {item.items && item.items.length > 1 && (
                        <div className="text-[10px] text-slate-400 mt-0.5">+{item.items.length - 1} more</div>
                      )}
                    </div>
                  );
                }
                return <span className="text-slate-400">—</span>;
              }
            },
            {
              header: "ORIGINAL QTY",
              render: (item) => {
                const firstItem = item.items?.[0];
                if (!firstItem || firstItem.currentQty == null) return <span className="text-slate-400">—</span>;
                const qty = Number(firstItem.currentQty);
                const uom = firstItem.product?.baseUom || firstItem.rawMaterial?.baseUom || firstItem.uom || "";
                const uomStr = uom ? ` ${getPrimaryUom(uom)}` : "";
                return (
                  <div>
                    <span className="font-semibold text-slate-700 text-sm">{qty}{uomStr}</span>
                    {item.items && item.items.length > 1 && (
                      <div className="text-[10px] text-slate-400 mt-0.5">+{item.items.length - 1} more</div>
                    )}
                  </div>
                );
              }
            },
            {
              header: "ADJUSTED QTY",
              render: (item) => {
                const firstItem = item.items?.[0];
                if (!firstItem || firstItem.adjustedQty == null) return <span className="text-slate-400">—</span>;
                const qty = Number(firstItem.adjustedQty);
                const diff = Number(firstItem.difference || 0);
                const uom = firstItem.product?.baseUom || firstItem.rawMaterial?.baseUom || firstItem.uom || "";
                const uomStr = uom ? ` ${getPrimaryUom(uom)}` : "";
                const diffColor = diff > 0 ? "text-green-600 bg-green-50 border border-green-200" : diff < 0 ? "text-red-600 bg-red-50 border border-red-200" : "text-slate-500 bg-slate-50";
                const diffSign = diff > 0 ? `+${diff}` : `${diff}`;
                return (
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{qty}{uomStr}</span>
                      {diff !== 0 && (
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${diffColor}`}>
                          {diffSign}
                        </span>
                      )}
                    </div>
                    {item.items && item.items.length > 1 && (
                      <div className="text-[10px] text-slate-400 mt-0.5">+{item.items.length - 1} more</div>
                    )}
                  </div>
                );
              }
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
              render: (item) => <span className="text-slate-500 text-sm">{item.createdByUser?.fullName || item.createdBy || "—"}</span>
            },
            {
              header: "STATUS",
              render: (item) => <StatusBadge status={item.status} />
            },
            {
              header: "ACTIONS",
              render: (item: any) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
