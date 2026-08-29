import React, { useState, useEffect } from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchGoodsDispatches, goodsDispatchCreated, goodsDispatchUpdated, goodsDispatchDeleted } from "../../../features/goods-dispatch/goodsDispatchSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";

import CustomButton from "../../../components/ui/Button/Button";
import DataTable from "../../../components/ui/table/DataTable";
import type { DataTableColumn } from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import EditButton from "../../../components/ui/EditButton/EditButton";
import FilterPopover from "../../../components/ui/FilterPopover/FilterPopover";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { formatDate } from "../../../utils/dateUtils";

import { usePermission } from "../../../hooks/usePermission";

const ITEMS_PER_PAGE = 15;

const GoodsDispatchList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { can } = usePermission();

  const { dispatches, meta, loading, error } = useAppSelector((state) => state.goodsDispatch);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filter states (applied)
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Draft filter states (for popover)
  const [draftFilterStatus, setDraftFilterStatus] = useState("");
  const [draftFilterDateFrom, setDraftFilterDateFrom] = useState("");
  const [draftFilterDateTo, setDraftFilterDateTo] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const hasActiveFilters = !!(filterStatus || filterDateFrom || filterDateTo);
  const activeFilterCount = [filterStatus, filterDateFrom, filterDateTo].filter(Boolean).length;

  // Handle search debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Backend-driven fetch
  useEffect(() => {
    dispatch(
      fetchGoodsDispatches({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: debouncedSearch,
        status: filterStatus || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      })
    );
  }, [dispatch, currentPage, debouncedSearch, filterStatus, filterDateFrom, filterDateTo]);

  useSocketSync("goodsDispatch", {
    created: goodsDispatchCreated,
    updated: goodsDispatchUpdated,
    deleted: goodsDispatchDeleted,
  });

  const handleApplyFilters = () => {
    setFilterStatus(draftFilterStatus);
    setFilterDateFrom(draftFilterDateFrom);
    setFilterDateTo(draftFilterDateTo);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setDraftFilterStatus("");
    setDraftFilterDateFrom("");
    setDraftFilterDateTo("");
    setFilterStatus("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setCurrentPage(1);
  };

  const handleOpenFilter = () => {
    setDraftFilterStatus(filterStatus);
    setDraftFilterDateFrom(filterDateFrom);
    setDraftFilterDateTo(filterDateTo);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Stats computed from current filtered data on current page (showing what's on screen)
  // Or we could compute from allData if we had it. For now use meta totals.
  // const totalCount = meta?.total || 0;

  const columns: DataTableColumn<any>[] = [
    {
      header: "Dispatch No",
      accessor: "dispatchNumber",
      render: (item: any) => <span className="font-bold text-ink tracking-tight">{item.dispatchNumber}</span>,
    },
    {
      header: "Date",
      accessor: "dispatchDate",
      render: (item: any) => <span className="text-ink font-semibold">{formatDate(item.dispatchDate)}</span>,
    },
    {
      header: "Vehicle",
      accessor: "vehicleNumber",
      render: (item: any) => <span className="text-ink font-semibold">{item.vehicleNumber}</span>,
    },
    {
      header: "Driver",
      accessor: "driverName",
      render: (item: any) => <span className="text-ink font-semibold">{item.driverName}</span>,
    },
    {
      header: "Items",
      accessor: "items",
      render: (item: any) => (
        <span className="text-ink-subtle font-bold">{item.items?.length || 0} PO(s)</span>
      ),
    },
    {
      header: "Status",
      accessor: "status",
      render: (item: any) => {
        return <StatusBadge status={item.status} />;
      },
    },
    {
      header: "Action",
      accessor: "id",
      render: (item: any) => (
        <div className="flex items-center gap-2">
          {can("goods-dispatch.view") && (
            <ViewButton onClick={() => navigate(`/production/goods-dispatch/detail/${item.id}`)} />
          )}
          {item.status === "PENDING_GATE_APPROVAL" && can("goods-dispatch.edit") && (
            <EditButton onClick={() => navigate(`/production/goods-dispatch/gate-approval/${item.id}`)} />
          )}
          {item.status === "PENDING_STORE_RECEIPT" && can("goods-dispatch.edit") && (
            <EditButton onClick={() => navigate(`/production/goods-dispatch/store-approval/${item.id}`)} />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-card rounded-2xl border border-line-soft shadow-xs">
      <div className="w-full">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-ink tracking-tight">Goods Dispatch</h2>
            <div className="text-sm font-semibold text-ink-subtle mt-1">Manage finished goods dispatches to warehouse</div>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <div className="w-full lg:w-auto">
              <SearchInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Dispatch No, Vehicle, Driver..."
              />
            </div>
            <FilterPopover
              activeFilterCount={activeFilterCount}
              hasActiveFilters={hasActiveFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              onOpen={handleOpenFilter}
            >
              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">
                  Status
                </label>
                <select
                  className="w-full border border-line-soft rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-card-2 text-ink font-semibold"
                  value={draftFilterStatus}
                  onChange={(e) => setDraftFilterStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING_GATE_APPROVAL">Pending Gate Approval</option>
                  <option value="PENDING_STORE_RECEIPT">Pending Store Receipt</option>
                  <option value="WAREHOUSE_RECEIVED">Warehouse Received</option>
                  <option value="GATE_REJECTED">Gate Rejected</option>
                  <option value="STORE_REJECTED">Store Rejected</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">
                  Date From
                </label>
                <DatePickerCalendar
                  name="dateFrom"
                  value={draftFilterDateFrom}
                  onChange={(e) => setDraftFilterDateFrom(e.target.value)}
                  placeholder="Select date"
                />
              </div>

              <div className="mb-4">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">
                  Date To
                </label>
                <DatePickerCalendar
                  name="dateTo"
                  value={draftFilterDateTo}
                  onChange={(e) => setDraftFilterDateTo(e.target.value)}
                  placeholder="Select date"
                />
              </div>
            </FilterPopover>

            {can("goods-dispatch.create") && (
              <CustomButton
                text="Create Dispatch"
                icon={FaPlus}
                onClick={() => navigate("/production/goods-dispatch/create")}
              />
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/15 border-l-4 border-red-500 p-4 mb-6 rounded-r-xl">
            <p className="text-red-400 font-semibold">{error}</p>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-card rounded-2xl shadow-xs border border-line-soft overflow-hidden">
          <DataTable
            columns={columns}
            data={dispatches || []}
            loading={loading}
            rowKey={(item) => item.id.toString()}
            emptyMessage="No dispatches found"
            pagination={meta && meta.totalPages > 1 ? {
              currentPage,
              totalPages: meta.totalPages,
              onPageChange: handlePageChange
            } : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default GoodsDispatchList;
