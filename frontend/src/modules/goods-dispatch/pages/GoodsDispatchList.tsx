import React, { useState, useEffect } from "react";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchGoodsDispatches } from "../../../features/goods-dispatch/goodsDispatchSlice";

import CustomButton from "../../../components/ui/Button/Button";
import DataTable from "../../../components/ui/table/DataTable";
import type { DataTableColumn } from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import { formatDate } from "../../../utils/dateUtils";

const ITEMS_PER_PAGE = 10;

const GoodsDispatchList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { dispatches, meta, loading, error } = useAppSelector((state) => state.goodsDispatch);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Handle search debouncing
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
        status,
      })
    );
  }, [dispatch, currentPage, debouncedSearch, status]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const columns: DataTableColumn<any>[] = [
    {
      header: "Dispatch No",
      accessor: "dispatchNumber",
      render: (item: any) => <span className="font-medium text-gray-900">{item.dispatchNumber}</span>,
    },
    {
      header: "Date",
      accessor: "dispatchDate",
      render: (item: any) => formatDate(item.dispatchDate),
    },
    {
      header: "Vehicle",
      accessor: "vehicleNumber",
    },
    {
      header: "Driver",
      accessor: "driverName",
    },
    {
      header: "Items",
      accessor: "items",
      render: (item: any) => (
        <span className="text-gray-600 font-medium">{item.items?.length || 0} PO(s)</span>
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
        <ViewButton onClick={() => navigate(`/production/goods-dispatch/view/${item.id}`)} />
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 min-h-screen ">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b border-slate-200 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Goods Dispatch</h2>
            <div className="text-sm text-slate-500 mt-1">Manage finished goods dispatches to warehouse</div>
          </div>
          <div className="flex items-center space-x-4">
            <CustomButton
              text="Create Dispatch"
              icon={FaPlus}
              onClick={() => navigate("/production/goods-dispatch/create")}
            />
          </div>
        </div>

        {/* Filters section */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Dispatch No, Vehicle, Driver..."
            />
          </div>
          <div className="w-full md:w-64">
            <SelectInput
              name="status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: "", label: "All Statuses" },
                { value: "PENDING_GATE_APPROVAL", label: "Pending Gate Approval" },
                { value: "PENDING_STORE_RECEIPT", label: "Pending Store Receipt" },
                { value: "WAREHOUSE_RECEIVED", label: "Warehouse Received" },
                { value: "GATE_REJECTED", label: "Gate Rejected" },
                { value: "STORE_REJECTED", label: "Store Rejected" },
              ]}
              label=""
            />
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 m-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Data Table */}
      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          data={dispatches || []}
          loading={loading}
          rowKey={(item) => item.id.toString()}
          emptyMessage="No dispatches found"
        />
      </div>

      {/* Pagination */}
      {!loading && meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-t border-slate-100">
          <div className="text-sm text-slate-500">
            Showing {(meta.page - 1) * meta.limit + 1} to{" "}
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FaChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                  currentPage === page
                    ? "bg-primary text-white border-primary hover:bg-primary-dark"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === meta.totalPages}
              className="p-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FaChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default GoodsDispatchList;
