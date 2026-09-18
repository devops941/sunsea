import React, { useState, useEffect, useRef } from "react";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import { useTableKeyboardNav } from "../../../hooks/useTableKeyboardNav";
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

  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [draftFilterStatus, setDraftFilterStatus] = useState("");
  const [draftFilterDateFrom, setDraftFilterDateFrom] = useState("");
  const [draftFilterDateTo, setDraftFilterDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const hasActiveFilters = !!(filterStatus || filterDateFrom || filterDateTo);
  const activeFilterCount = [filterStatus, filterDateFrom, filterDateTo].filter(Boolean).length;

  usePageShortcuts({
    onRefresh: () => dispatch(fetchGoodsDispatches({ page: currentPage, limit: ITEMS_PER_PAGE })),
    onNew: () => can("goods-dispatch.create") && navigate("/production/goods-dispatch/create"),
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

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

  const displayDispatches = dispatches || [];
  const tableRef = useRef<HTMLDivElement>(null);

  const { focusedIndex, setFocusedIndex } = useTableKeyboardNav({
    count: displayDispatches.length,
    onEnter: (i) => { const item = displayDispatches[i]; if (item) navigate(`/production/goods-dispatch/view/${item.id}`); },
    onEdit: (i) => {
      const item = displayDispatches[i];
      const isDirect = item?.items?.length > 0 && item.items.every((it: any) => it.bypassGate);
      if (item && !isDirect && (item.status === "PENDING_GATE_APPROVAL" || item.status === "PENDING_STORE_RECEIPT")) {
        navigate(`/production/goods-dispatch/edit/${item.id}`);
      }
    },
    containerRef: tableRef,
  });

  const columns: DataTableColumn<any>[] = [
    {
      header: "Dispatch No",
      width: "130px",
      accessor: "dispatchNumber",
      render: (item: any) => <span className="font-bold text-ink tracking-tight">{item.dispatchNumber}</span>,
    },
    {
      header: "DC No",
      width: "120px",
      accessor: "dcNumber",
      render: (item: any) => <span className="font-semibold text-ink font-mono">{item.dcNumber || "—"}</span>,
    },
    {
      header: "Date",
      width: "110px",
      accessor: "dispatchDate",
      render: (item: any) => <span className="text-ink font-semibold">{formatDate(item.dispatchDate)}</span>,
    },
    {
      header: "Vehicle",
      width: "minmax(100px, 1fr)",
      accessor: "vehicleNumber",
      render: (item: any) => <span className="text-ink font-semibold">{item.vehicleNumber}</span>,
    },
    {
      header: "Driver",
      width: "minmax(100px, 1fr)",
      accessor: "driverName",
      render: (item: any) => <span className="text-ink font-semibold">{item.driverName}</span>,
    },
    {
      header: "Items",
      width: "80px",
      accessor: "items",
      render: (item: any) => (
        <span className="text-ink-subtle font-bold">{item.items?.length || 0} PO(s)</span>
      ),
    },
    {
      header: "Status",
      width: "185px",
      accessor: "status",
      render: (item: any) => <StatusBadge status={item.status} />,
    },
    {
      header: "Action",
      width: "90px",
      accessor: "id",
      render: (item: any) => {
        const isDirect = item.items?.length > 0 && item.items.every((it: any) => it.bypassGate);
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {can("goods-dispatch.view") && (
              <ViewButton onClick={() => navigate(`/production/goods-dispatch/view/${item.id}`)} />
            )}
            {!isDirect && (item.status === "PENDING_GATE_APPROVAL" || item.status === "PENDING_STORE_RECEIPT") && can("goods-dispatch.edit") && (
              <EditButton onClick={() => navigate(`/production/goods-dispatch/edit/${item.id}`)} />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="w-full bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
          <div>
            <h2 className="text-2xl font-bold text-ink">Goods Dispatch</h2>
            <p className="text-sm text-ink-subtle mt-0.5">Manage finished goods dispatches to warehouse</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Dispatch No, DC No, Vehicle, Driver..."
            />
            <FilterPopover
              activeFilterCount={activeFilterCount}
              hasActiveFilters={hasActiveFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
              onOpen={handleOpenFilter}
            >
              <div className="mb-3">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Status</label>
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
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Date From</label>
                <DatePickerCalendar
                  name="dateFrom"
                  value={draftFilterDateFrom}
                  onChange={(e) => setDraftFilterDateFrom(e.target.value)}
                  placeholder="Select date"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Date To</label>
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

        {error && (
          <div className="bg-red-500/15 border-l-4 border-red-500 p-4 m-4 rounded-r-xl">
            <p className="text-red-400 font-semibold">{error}</p>
          </div>
        )}

        <div ref={tableRef} tabIndex={0} data-table-nav className="outline-none">
          <DataTable
            columns={columns}
            data={displayDispatches}
            loading={loading}
            rowKey={(item) => item.id.toString()}
            rowClassName={(_, i) => i === focusedIndex ? "bg-primary/8" : ""}
            onRowClick={(item, i) => { setFocusedIndex(i); navigate(`/production/goods-dispatch/view/${item.id}`); }}
            emptyMessage="No dispatches found"
            pagination={meta && meta.totalPages > 1 ? {
              currentPage,
              totalPages: meta.totalPages,
              onPageChange: setCurrentPage,
            } : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default GoodsDispatchList;
