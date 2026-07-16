import React, { useState, useEffect } from "react";
import { FaSearch, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchGoodsDispatches } from "../../../features/goods-dispatch/goodsDispatchSlice";

import CustomButton from "../../../components/ui/Button/Button";
import DataTable from "../../../components/ui/table/DataTable";
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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch data
  useEffect(() => {
    dispatch(
      fetchGoodsDispatches({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: debouncedSearch || undefined,
        status: status || undefined,
      })
    );
  }, [dispatch, currentPage, debouncedSearch, status]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= (meta?.totalPages || 1)) {
      setCurrentPage(newPage);
    }
  };

  const columns = [
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
        let variant: "default" | "success" | "warning" | "danger" | "primary" | "info" = "default";
        if (item.status === "PENDING_GATE_APPROVAL") variant = "warning";
        else if (item.status === "PENDING_STORE_RECEIPT") variant = "info";
        else if (item.status === "WAREHOUSE_RECEIVED") variant = "success";
        else if (item.status.includes("REJECTED")) variant = "danger";

        return <StatusBadge status={item.status} variant={variant} />;
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
    <div className="container mx-auto px-4 py-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Goods Dispatch</h1>
          <p className="text-gray-500 mt-2">Manage finished goods dispatches to warehouse</p>
        </div>
        <div className="flex items-center space-x-4">
          <CustomButton
            variant="primary"
            icon={FaPlus}
            text="Create Dispatch"
            onClick={() => navigate("/production/goods-dispatch/create")}
          />
        </div>
      </div>

      {/* Filters section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
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
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <DataTable
          columns={columns}
          data={dispatches || []}
          loading={loading}
          rowKey={(item) => item.id.toString()}
          emptyMessage="No dispatches found"
        />

        {/* Pagination */}
        {!loading && meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              Showing {(meta.page - 1) * meta.limit + 1} to{" "}
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FaChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    currentPage === page
                      ? "bg-primary-600 text-white border-primary-600 hover:bg-primary-700"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === meta.totalPages}
                className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
