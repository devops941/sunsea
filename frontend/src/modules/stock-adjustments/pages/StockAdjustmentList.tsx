import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FaPlus,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import {
  fetchStockAdjustments,
  deleteStockAdjustment,
  stockAdjustmentCreated,
  stockAdjustmentUpdated,
  stockAdjustmentDeleted,
} from "../../../features/stock-adjustments/stockAdjustmentSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

import CustomButton from "../../../components/ui/Button/Button";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
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

const getReasonLabel = (reasonStr?: string) => {
  if (!reasonStr) return "";
  const REASONS: Record<string, string> = {
    PHYSICAL_COUNT_VARIANCE: "Physical Count Variance",
    DAMAGED_GOODS: "Damaged Goods",
    EXPIRED_STOCK: "Expired Stock",
    PRODUCTION_CONSUMPTION: "Production Consumption",
    SUPPLIER_RETURN: "Supplier Return",
    CUSTOMER_RETURN: "Customer Return",
    WASTAGE: "Wastage",
    SCRAP: "Scrap",
    OPENING_STOCK: "Opening Stock",
    MANUAL_CORRECTION: "Manual Correction",
    OTHER: "Other",
  };
  return REASONS[reasonStr] || reasonStr;
};

const getAdjustmentDisplayReason = (item: any) => {
  const firstItem = item.items?.[0];
  
  if (firstItem?.remarks && firstItem.remarks.trim()) {
    const parts = firstItem.remarks.trim().split(" - ");
    return parts[0];
  }

  if (firstItem?.reason && firstItem.reason.trim()) {
    return getReasonLabel(firstItem.reason.trim());
  }

  if (item.remarks && item.remarks.trim()) {
    const parts = item.remarks.trim().split(" - ");
    return parts[0];
  }

  if (item.reason && item.reason.trim()) {
    const r = item.reason.trim();
    const label = getReasonLabel(r);
    if (label !== r || r.toLowerCase() === "other") {
      return label;
    }
  }

  return "—";
};

const getStockAdjustmentTypeInfo = (item: any) => {
  const diff = Number(item.items?.[0]?.difference || 0);
  const type = item.adjustmentType || "";

  if (diff < 0) {
    return { label: "Stock Decrease", variant: "danger" };
  }
  if (diff > 0) {
    return { label: "Stock Increase", variant: "success" };
  }
  
  if (
    type === "STOCK_DECREASE" ||
    type === "DAMAGE" ||
    type === "SCRAP" ||
    type === "PRODUCTION_MATERIAL_ISSUE"
  ) {
    return { label: "Stock Decrease", variant: "danger" };
  }
  
  return { label: "Stock Increase", variant: "success" };
};

const getStockAdjustmentSourceInfo = (item: any) => {
  const poId = item.productionOrderId;
  const srcDoc = (item.sourceDocument || "").toLowerCase();
  const type = (item.adjustmentType || "").toLowerCase();

  if (poId || type.includes("production") || type.includes("pmi") || srcDoc.includes("prod") || srcDoc.includes("pmi")) {
    return {
      module: "Production",
      detail: poId ? `PO: ${poId}` : (item.sourceDocId ? `#${item.sourceDocId}` : ""),
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }

  if (srcDoc.includes("purchase") || srcDoc.includes("grn") || srcDoc.includes("po-rec")) {
    return {
      module: "Purchase",
      detail: item.sourceDocId ? `#${item.sourceDocId}` : "",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    };
  }

  if (srcDoc.includes("sales") || srcDoc.includes("so") || srcDoc.includes("dispatch")) {
    return {
      module: "Sales",
      detail: item.sourceDocId ? `#${item.sourceDocId}` : "",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  return {
    module: "Manual",
    detail: "",
    badgeClass: "bg-card-2 text-ink-muted border-line",
  };
};

const getTypeBadgeClass = (type: string) => {
  switch (ADJUSTMENT_TYPE_BADGE[type]) {
    case "primary": return "bg-blue-100 text-blue-800";
    case "info": return "bg-cyan-100 text-cyan-800";
    case "success": return "bg-green-100 text-green-800";
    case "warning": return "bg-yellow-100 text-yellow-800";
    case "danger": return "bg-red-100 text-red-800";
    case "dark": return "bg-gray-800 text-gray-100";
    case "light": return "bg-card-2 text-ink";
    default: return "bg-card-2 text-ink";
  }
};

const getPrimaryUom = (uomStr?: string) => {
  if (!uomStr) return "";
  const first = uomStr.split(",")[0].trim();
  const l = first.toLowerCase();
  if (l === "ea" || l === "each" || l === "piece" || l === "pcs") return "pcs";
  return first;
};

const getItemPrimaryUom = (item: any) => {
  if (!item) return "";
  if (item.uom) {
    const raw = typeof item.uom === "object" ? (item.uom.uomCode || item.uom.uomName || item.uom.code || item.uom.name) : String(item.uom);
    if (raw) return getPrimaryUom(raw);
  }
  const isProduct = item.itemType === "PRODUCT" || item.itemType === "FINISHED_GOODS" || !!item.product || !!item.productItemId;
  if (isProduct) {
    const pUom = item.product?.uom;
    const prodUom = typeof pUom === "object"
      ? (pUom.uomCode || pUom.uomName || pUom.code || pUom.name)
      : (pUom || item.product?.baseUom || item.product?.unit);
    if (prodUom) return getPrimaryUom(String(prodUom));
    return "pcs";
  }
  const rmUom = item.rawMaterial?.baseUom || item.rawMaterial?.uom;
  if (rmUom) return getPrimaryUom(String(rmUom));
  return "";
};

const StockAdjustmentList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { can } = usePermission();

  const { data, meta, loading, error } = useAppSelector(
    (state) => state.stockAdjustments
  );

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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

  // Debounce search — 300 ms
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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

  useSocketSync("stockAdjustment", {
    created: stockAdjustmentCreated,
    updated: stockAdjustmentUpdated,
    deleted: stockAdjustmentDeleted,
  });

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleOpenFilter = useCallback(() => {
    setDraftStatus(status);
    setDraftAdjustmentType(adjustmentType);
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
  }, [status, adjustmentType, dateFrom, dateTo]);

  const handleApplyFilters = useCallback(() => {
    setStatus(draftStatus);
    setAdjustmentType(draftAdjustmentType);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setCurrentPage(1);
  }, [draftStatus, draftAdjustmentType, draftDateFrom, draftDateTo]);

  const handleClearFilters = useCallback(() => {
    setDraftStatus("");
    setDraftAdjustmentType("");
    setDraftDateFrom("");
    setDraftDateTo("");
    setStatus("");
    setAdjustmentType("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      await dispatch(deleteStockAdjustment(deleteId)).unwrap();
      toast.success("Stock Adjustment deleted successfully");
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err || "Failed to delete stock adjustment");
    } finally {
      setIsDeleting(false);
    }
  }, [deleteId, isDeleting, dispatch]);

  const getTypeBadge = (type: string) => (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider ${getTypeBadgeClass(type)}`}>
      {ADJUSTMENT_TYPE_LABELS[type] || type}
    </span>
  );

  const totalPages = meta?.totalPages || 1;

  return (
    <div className="p-4 md:p-1 ">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
          <div>
            <h2 className="text-2xl font-bold text-ink">Stock Adjustments</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            {/* Search */}
            <SearchInput
              value={searchTerm}
              onChange={handleSearch}
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
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                    Status
                  </label>
                  <SelectInput
                    name="draftStatus"
                    value={draftStatus}
                    onChange={(e) => setDraftStatus(e.target.value)}
                    options={[
                      { value: "DRAFT", label: "Draft" },
                      { value: "PENDING_APPROVAL", label: "Pending Approval" },
                      { value: "APPROVED", label: "Approved" },
                      { value: "REJECTED", label: "Rejected" },
                    ]}
                    defaultOptionLabel="All Statuses"
                    noMargin
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                    Adjustment Type
                  </label>
                  <SelectInput
                    name="draftAdjustmentType"
                    value={draftAdjustmentType}
                    onChange={(e) => setDraftAdjustmentType(e.target.value)}
                    options={[
                      { value: "PRODUCTION_MATERIAL_ISSUE", label: "Production Material Issue" },
                      { value: "PRODUCTION_MATERIAL_RETURN", label: "Production Material Return" },
                      { value: "STOCK_INCREASE", label: "Stock Increase" },
                      { value: "STOCK_DECREASE", label: "Stock Decrease" },
                      { value: "DAMAGE", label: "Damage" },
                      { value: "SCRAP", label: "Scrap" },
                      { value: "OPENING_STOCK", label: "Opening Stock" },
                      { value: "MANUAL_CORRECTION", label: "Manual Correction" },
                      { value: "OTHER", label: "Other" },
                    ]}
                    defaultOptionLabel="All Types"
                    noMargin
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                    From Date
                  </label>
                  <DatePickerCalendar
                    name="fromDate"
                    value={draftDateFrom}
                    maxDate={draftDateTo || undefined}
                    onChange={(e) => setDraftDateFrom(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                    To Date
                  </label>
                  <DatePickerCalendar
                    name="toDate"
                    value={draftDateTo}
                    minDate={draftDateFrom || undefined}
                    onChange={(e) => setDraftDateTo(e.target.value)}
                  />
                </div>
              </div>
            </FilterPopover>

            {can("stock-adjustments.create") && (
              <CustomButton
                text="New Adjustment"
                icon={FaPlus}
                onClick={() => navigate("/inventory/stock-adjustments/create")}
              />
            )}
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
              render: (item) => (
                <div>
                  <div className="font-semibold text-ink-muted">{item.adjustmentNumber}</div>
                  <div className="text-xs text-ink-subtle font-medium">{formatDate(item.adjustmentDate)}</div>
                </div>
              )
            },
            {
              header: "TYPE",
              render: (item) => {
                const info = getStockAdjustmentTypeInfo(item);
                return (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      info.variant === "success"
                        ? "bg-green-100 text-green-700 border border-green-200"
                        : "bg-red-100 text-red-700 border border-red-200"
                    }`}
                  >
                    {info.label}
                  </span>
                );
              }
            },
            {
              header: "SOURCE",
              render: (item) => {
                const src = getStockAdjustmentSourceInfo(item);
                return (
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${src.badgeClass}`}>
                      {src.module}
                    </span>
                    {src.detail && (
                      <div className="text-xs text-ink-subtle font-mono mt-0.5 font-medium">
                        {src.detail}
                      </div>
                    )}
                  </div>
                );
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
                      <div className="font-semibold text-sm text-ink">
                        {product.productName}
                      </div>
                      <div className="text-xs text-ink-subtle">
                        {product.productCode}
                      </div>
                      {item.items && item.items.length > 1 && (
                        <div className="text-[10px] text-ink-subtle mt-0.5">+{item.items.length - 1} more</div>
                      )}
                    </div>
                  );
                }
                if (rawMaterial?.materialName) {
                  return (
                    <div>
                      <div className="font-semibold text-sm text-ink">
                        {rawMaterial.materialName}
                      </div>
                      {item.items && item.items.length > 1 && (
                        <div className="text-[10px] text-ink-subtle mt-0.5">+{item.items.length - 1} more</div>
                      )}
                    </div>
                  );
                }
                return <span className="text-ink-subtle">—</span>;
              }
            },
            {
              header: "ORIGINAL QTY",
              render: (item) => {
                const firstItem = item.items?.[0];
                if (!firstItem || firstItem.currentQty == null) return <span className="text-ink-subtle">—</span>;
                const qty = Number(firstItem.currentQty);
                const primaryUom = getItemPrimaryUom(firstItem);
                const uomStr = primaryUom ? ` ${primaryUom}` : "";
                return (
                  <div>
                    <span className="font-semibold text-ink-muted text-sm">{qty}{uomStr}</span>
                    {item.items && item.items.length > 1 && (
                      <div className="text-[10px] text-ink-subtle mt-0.5">+{item.items.length - 1} more</div>
                    )}
                  </div>
                );
              }
            },
            {
              header: "ADJUSTED QTY",
              render: (item) => {
                const firstItem = item.items?.[0];
                if (!firstItem || firstItem.adjustedQty == null) return <span className="text-ink-subtle">—</span>;
                const qty = Number(firstItem.adjustedQty);
                const diff = Number(firstItem.difference || 0);
                const primaryUom = getItemPrimaryUom(firstItem);
                const uomStr = primaryUom ? ` ${primaryUom}` : "";
                const diffColor = diff > 0 ? "text-green-600 bg-green-50 border border-green-200" : diff < 0 ? "text-red-600 bg-red-50 border border-red-200" : "text-ink-subtle bg-card-2";
                const diffSign = diff > 0 ? `+${diff}${primaryUom ? ` ${primaryUom}` : ''}` : `${diff}${primaryUom ? ` ${primaryUom}` : ''}`;
                return (
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-ink text-sm">{qty}{uomStr}</span>
                      {diff !== 0 && (
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${diffColor}`}>
                          {diffSign}
                        </span>
                      )}
                    </div>
                    {item.items && item.items.length > 1 && (
                      <div className="text-[10px] text-ink-subtle mt-0.5">+{item.items.length - 1} more</div>
                    )}
                  </div>
                );
              }
            },
            {
              header: "REASON",
              render: (item) => {
                const firstItem = item.items?.[0];
                const displayReason = getAdjustmentDisplayReason(item);
                const fullTooltip = firstItem?.remarks || displayReason;

                return (
                  <div>
                    <span
                      title={fullTooltip}
                      className="inline-block max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap text-ink-muted font-medium"
                    >
                      {displayReason}
                    </span>
                    {item.items && item.items.length > 1 && (
                      <div className="text-[10px] text-ink-subtle mt-0.5">+{item.items.length - 1} more</div>
                    )}
                  </div>
                );
              }
            },
            {
              header: "ACTIONS",
              render: (item: any) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <ViewButton onClick={() => navigate(`/inventory/stock-adjustments/view/${item.id}`)} />
                  {can("stock-adjustments.delete") && item.status !== "APPROVED" && (
                    <DeleteButton onClick={() => setDeleteId(String(item.id))} />
                  )}
                </div>
              )
            },
          ]}
        />

        <CommonConfirmModal
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Stock Adjustment"
          message="Are you sure you want to delete this stock adjustment? This action cannot be undone."
          isDangerous
          isLoading={isDeleting}
        />
      </div>
    </div>
  );
};

export default StockAdjustmentList;
