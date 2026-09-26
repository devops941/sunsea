import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
import {
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { useListCache, markStaleByPrefix } from "../../../hooks/useListCache";
import { stockAdjustmentService } from "../../../services/stockAdjustmentService";
import { usePermission } from "../../../hooks/usePermission";

import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import CustomButton from "../../../components/ui/Button/Button";
import DataTable from "../../../components/ui/table/DataTable";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import DeleteButton from "../../../components/ui/DeleteButton/DeleteButton";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { formatDate } from "../../../utils/dateUtils";

const ITEMS_PER_PAGE = 15;

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
    return getReasonLabel(item.reason.trim());
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
  if (l === "ea" || l === "each" || l === "piece" || l === "pcs" || l === "nos" || l === "no") return "pcs";
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

const SA_CACHE_PREFIX = "stockAdjustments:";

const StockAdjustmentList: React.FC = () => {
  const navigate = useNavigate();
  const { can } = usePermission();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Draft filter states for popover
  const [draftStatus, setDraftStatus] = useState("");
  const [draftSource, setDraftSource] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");

  const hasActiveFilters = !!(status || source || dateFrom || dateTo);
  const activeFilterCount = [status, source, dateFrom, dateTo].filter(Boolean).length;

  // Debounce search — 300 ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const cacheKey = `${SA_CACHE_PREFIX}${currentPage}:${ITEMS_PER_PAGE}:${debouncedSearch}:${status}:${source}:${dateFrom}:${dateTo}`;

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const res = await stockAdjustmentService.fetchAll({
      search: debouncedSearch,
      status,
      source,
      dateFrom,
      dateTo,
      page: currentPage,
      limit: ITEMS_PER_PAGE,
    });
    const list = Array.isArray(res) ? res : (res.data || []);
    const tot = Array.isArray(res) ? res.length : (res.meta?.total || res.total || list.length);
    return { data: list, total: tot };
  }, [debouncedSearch, status, source, dateFrom, dateTo, currentPage]);

  const { data, total, loading, refresh } = useListCache({
    cacheKey,
    socketModule: "stockAdjustment",
    fetcher,
  });

  usePageShortcuts({
    onRefresh: () => refresh(),
    onNew: () => can("stock-adjustments.create") && navigate("/inventory/stock-adjustments/create"),
    onSort: () => document.querySelector<HTMLElement>("[data-filter-trigger] button")?.click(),
  });

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleOpenFilter = useCallback(() => {
    setDraftStatus(status);
    setDraftSource(source);
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
  }, [status, source, dateFrom, dateTo]);

  const handleApplyFilters = useCallback(() => {
    setStatus(draftStatus);
    setSource(draftSource);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setCurrentPage(1);
  }, [draftStatus, draftSource, draftDateFrom, draftDateTo]);

  const handleClearFilters = useCallback(() => {
    setDraftStatus("");
    setDraftSource("");
    setDraftDateFrom("");
    setDraftDateTo("");
    setStatus("");
    setSource("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      await stockAdjustmentService.delete(deleteId);
      toast.success("Stock Adjustment deleted successfully");
      setDeleteId(null);
      markStaleByPrefix(SA_CACHE_PREFIX);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete stock adjustment");
    } finally {
      setIsDeleting(false);
    }
  }, [deleteId, isDeleting, refresh]);

  const getTypeBadge = (type: string) => (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider ${getTypeBadgeClass(type)}`}>
      {ADJUSTMENT_TYPE_LABELS[type] || type}
    </span>
  );

  const totalPages = Math.ceil((total || 0) / ITEMS_PER_PAGE) || 1;

  const tableRef = useRef<HTMLDivElement>(null);

  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    count: (data || []).length,
    onEnter: (i) => { const item = (data || [])[i]; if (item) navigate(`/inventory/stock-adjustments/view/${item.id}`); },
    onEdit: () => {},
    containerRef: tableRef,
  });

  return (
    <div className="w-full">
      <div className="w-full bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-5 py-3 border-b border-line">
          <div>
            <h2 className="text-base font-bold text-ink">Stock Adjustments</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
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
                    Source
                  </label>
                  <SelectInput
                    name="draftSource"
                    value={draftSource}
                    onChange={(e) => setDraftSource(e.target.value)}
                    options={[
                      { value: "PRODUCTION", label: "Production" },
                      { value: "PURCHASE", label: "Purchase" },
                      { value: "SALES", label: "Sales" },
                      { value: "MANUAL", label: "Manual" },
                    ]}
                    defaultOptionLabel="All Sources"
                    noMargin
                  />
                </div>

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

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 px-6 py-2.5 border-b border-line flex-wrap">
            <span className="text-xs text-ink-subtle">Active filters:</span>

            {source && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                Source: {
                  source === "PRODUCTION" ? "Production" :
                  source === "PURCHASE" ? "Purchase" :
                  source === "SALES" ? "Sales" :
                  source === "MANUAL" ? "Manual" : source
                }
                <FaTimes
                  className="cursor-pointer hover:text-indigo-200 ml-0.5"
                  onClick={() => { setSource(""); setDraftSource(""); setCurrentPage(1); }}
                />
              </span>
            )}

            {status && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                Status: {status}
                <FaTimes
                  className="cursor-pointer hover:text-indigo-200 ml-0.5"
                  onClick={() => { setStatus(""); setDraftStatus(""); setCurrentPage(1); }}
                />
              </span>
            )}

            {(dateFrom || dateTo) && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                Date: {dateFrom || "Start"} to {dateTo || "End"}
                <FaTimes
                  className="cursor-pointer hover:text-indigo-200 ml-0.5"
                  onClick={() => { setDateFrom(""); setDraftDateFrom(""); setDateTo(""); setDraftDateTo(""); setCurrentPage(1); }}
                />
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div ref={tableRef} tabIndex={0} data-table-nav className="outline-none">
        <DataTable
          data={data || []}
          rowKey={(item) => item.id}
          loading={loading}
          emptyMessage="No stock adjustments found."
          rowClassName={(_, i) => i === focusedIndex ? "bg-primary/8" : ""}
          onRowClick={(item, i) => { setFocusedIndex(i); navigate(`/inventory/stock-adjustments/view/${item.id}`); }}
          pagination={
            totalPages > 1
              ? { currentPage, totalPages, onPageChange: (page) => setCurrentPage(page) }
              : undefined
          }
          columns={[
            {
              header: "ADJUSTMENT NO",
              width: "minmax(180px, 1.2fr)",
              accessor: "adjustmentNumber",
              render: (item) => (
                <div className="whitespace-nowrap">
                  <div className="font-semibold text-ink">{item.adjustmentNumber}</div>
                  <div className="text-xs text-ink-subtle font-medium">{formatDate(item.adjustmentDate)}</div>
                </div>
              )
            },
            {
              header: "TYPE",
              width: "140px",
              render: (item) => {
                const info = getStockAdjustmentTypeInfo(item);
                return (
                  <StatusBadge
                    status={info.variant === "success" ? "ACTIVE" : "INACTIVE"}
                    customText={info.label}
                  />
                );
              }
            },
            {
              header: "SOURCE",
              width: "120px",
              render: (item) => {
                const src = getStockAdjustmentSourceInfo(item);
                return (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${src.badgeClass}`}>
                    {src.module}
                  </span>
                );
              }
            },
            {
              header: "PRODUCT",
              width: "minmax(160px, 1.3fr)",
              render: (item) => {
                const firstItem = item.items?.[0];
                const product = item.productionOrder?.productItem || firstItem?.product;
                const rawMaterial = firstItem?.rawMaterial;

                if (product?.productName) {
                  return (
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-ink truncate whitespace-nowrap" title={product.productName}>
                        {product.productName}
                      </div>
                      {item.items && item.items.length > 1 && (
                        <div className="text-[10px] text-ink-subtle mt-0.5 whitespace-nowrap">+{item.items.length - 1} more</div>
                      )}
                    </div>
                  );
                }
                if (rawMaterial?.materialName) {
                  return (
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-ink truncate whitespace-nowrap" title={rawMaterial.materialName}>
                        {rawMaterial.materialName}
                      </div>
                      {item.items && item.items.length > 1 && (
                        <div className="text-[10px] text-ink-subtle mt-0.5 whitespace-nowrap">+{item.items.length - 1} more</div>
                      )}
                    </div>
                  );
                }
                if (firstItem?.rawMaterialId) {
                  return (
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-ink truncate whitespace-nowrap">
                        {firstItem.rawMaterialId}
                      </div>
                      {item.items && item.items.length > 1 && (
                        <div className="text-[10px] text-ink-subtle mt-0.5 whitespace-nowrap">+{item.items.length - 1} more</div>
                      )}
                    </div>
                  );
                }
                if (firstItem?.productItemId) {
                  return (
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-ink truncate whitespace-nowrap">
                        Product #{String(firstItem.productItemId)}
                      </div>
                      {item.items && item.items.length > 1 && (
                        <div className="text-[10px] text-ink-subtle mt-0.5 whitespace-nowrap">+{item.items.length - 1} more</div>
                      )}
                    </div>
                  );
                }
                return <span className="text-ink-subtle text-sm">-</span>;
              }
            },
            {
              header: "ORIGINAL QTY",
              width: "minmax(130px, 1fr)",
              render: (item) => {
                const firstItem = item.items?.[0];
                if (!firstItem || firstItem.currentQty == null) return <span className="text-ink-subtle">—</span>;
                const qty = Number(firstItem.currentQty);
                const primaryUom = getItemPrimaryUom(firstItem);
                const uomStr = primaryUom ? ` ${primaryUom}` : "";
                return (
                  <div className="whitespace-nowrap">
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
              width: "minmax(180px, 1.2fr)",
              render: (item) => {
                const firstItem = item.items?.[0];
                if (!firstItem || firstItem.adjustedQty == null) return <span className="text-ink-subtle">—</span>;
                const qty = Number(firstItem.adjustedQty);
                const diff = Number(firstItem.difference || 0);
                const primaryUom = getItemPrimaryUom(firstItem);
                const uomStr = primaryUom ? ` ${primaryUom}` : "";
                const diffSign = diff > 0 ? `+${diff}${primaryUom ? ` ${primaryUom}` : ''}` : `${diff}${primaryUom ? ` ${primaryUom}` : ''}`;
                return (
                  <div className="whitespace-nowrap">
                    <div className="flex items-baseline gap-1.5 flex-nowrap whitespace-nowrap">
                      <span className="font-bold text-ink text-sm">{qty}{uomStr}</span>
                      {diff !== 0 && (
                        <span className={`text-xs font-semibold ${
                          diff > 0
                            ? "text-emerald-500 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        }`}>
                          ({diffSign})
                        </span>
                      )}
                    </div>
                    {item.items && item.items.length > 1 && (
                      <div className="text-[10px] text-ink-subtle mt-0.5 whitespace-nowrap">+{item.items.length - 1} more</div>
                    )}
                  </div>
                );
              }
            },
            {
              header: "REASON",
              width: "minmax(180px, 1.5fr)",
              render: (item) => {
                const firstItem = item.items?.[0];
                const displayReason = getAdjustmentDisplayReason(item);
                const fullTooltip = firstItem?.remarks || displayReason;

                return (
                  <div className="min-w-0">
                    <span
                      title={fullTooltip}
                      className="block truncate text-ink-muted font-medium text-sm"
                    >
                      {displayReason}
                    </span>
                    {item.items && item.items.length > 1 && (
                      <div className="text-[10px] text-ink-subtle mt-0.5 whitespace-nowrap">+{item.items.length - 1} more</div>
                    )}
                  </div>
                );
              }
            },
            {
              header: "ACTIONS",
              width: "90px",
              align: "center",
              render: (item: any) => (
                <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <ViewButton onClick={() => navigate(`/inventory/stock-adjustments/view/${item.id}`)} />
                  {can("stock-adjustments.delete") && item.status !== "APPROVED" && (
                    <DeleteButton onClick={() => setDeleteId(String(item.id))} />
                  )}
                </div>
              )
            },
          ]}
        />
        </div>

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
