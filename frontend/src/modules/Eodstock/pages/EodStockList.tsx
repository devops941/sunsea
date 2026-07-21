import React, { useState, useEffect, useMemo } from "react";
import {
  FaSearch,
  FaFilter,
  FaInfoCircle,
  FaDownload,
  FaRegCalendarAlt,
  FaHistory,
  FaSyncAlt
} from "react-icons/fa";
import DataTable from "../../../components/ui/table/DataTable";
import apiClient from "../../../api/apiClient";
import { storeService } from "../../../services/storeService";
import { formatDateTime, formatDate } from "../../../utils/dateUtils";
import { toast } from "react-toastify";

type EodCategory = 'RAW_MATERIAL' | 'FINISHED_PRODUCT' | 'WASTAGE';

interface EodStockItem {
  id: string;
  category: EodCategory;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string | null;
  storeId: string;
  snapshotDate: string;
  startQty: number;
  eodQty: number;
  recordedAt: string;
}

const ITEMS_PER_PAGE = 10;

const EodStockList: React.FC = () => {
  const [data, setData] = useState<EodStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [asOfDate, setAsOfDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [storeIdFilter, setStoreIdFilter] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [simulateEmptyState, setSimulateEmptyState] = useState(false);
  const [stores, setStores] = useState<any[]>([]);

  // Fetch stores list on mount
  useEffect(() => {
    const fetchStoresList = async () => {
      try {
        const res = await storeService.fetchAll();
        const allStores = res?.stores || res || [];
        setStores(allStores.filter((s: any) => s.isActive));
      } catch (err) {
        console.error("Failed to fetch stores", err);
      }
    };
    fetchStoresList();
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch live EOD stock snapshots from the backend database
  const fetchEodStock = async () => {
    if (simulateEmptyState) {
      setData([]);
      setTotalItems(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get("/inventory/eod-stock", {
        params: {
          date: selectedDate,
          category: categoryFilter || undefined,
          storeId: storeIdFilter || undefined,
          search: debouncedSearch || undefined,
          page: currentPage,
          limit: ITEMS_PER_PAGE
        }
      });
      if (response.data) {
        setData(response.data.data || []);
        setTotalItems(response.data.pagination?.total || 0);
        setAsOfDate(response.data.asOf || "");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to fetch EOD stock data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEodStock();
  }, [debouncedSearch, categoryFilter, storeIdFilter, selectedDate, currentPage, simulateEmptyState]);

  // Resolve storeName from storeId
  const getStoreName = (storeId: string) => {
    const store = stores.find((s) => s.storeId === storeId);
    return store ? store.storeName : storeId || "-";
  };

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  // Category tags custom styling
  const renderCategoryBadge = (category: EodCategory) => {
    switch (category) {
      case "RAW_MATERIAL":
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
            Raw Material
          </span>
        );
      case "FINISHED_PRODUCT":
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-md">
            Finished Product
          </span>
        );
      case "WASTAGE":
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-md">
            Wastage
          </span>
        );
      default:
        return null;
    }
  };

  // Resolve visual labels
  const getCategoryLabel = (categoryVal: string) => {
    if (categoryVal === "RAW_MATERIAL") return "Raw Material";
    if (categoryVal === "FINISHED_PRODUCT") return "Finished Product";
    if (categoryVal === "WASTAGE") return "Wastage";
    return "";
  };

  // Dynamic empty messages based on filters
  const emptyMessage = useMemo(() => {
    if (simulateEmptyState) {
      return "No EOD stock data available yet. First snapshot will be generated soon.";
    }

    const parts: string[] = [];
    if (categoryFilter) {
      parts.push(getCategoryLabel(categoryFilter));
    }
    if (storeIdFilter) {
      parts.push(`in ${getStoreName(storeIdFilter)}`);
    }

    if (parts.length > 0) {
      return `No ${parts.join(" ")} stock data found for this date.`;
    }
    return "No EOD stock data available yet. First snapshot will be generated soon.";
  }, [simulateEmptyState, categoryFilter, storeIdFilter, stores]);

  const handleExport = () => {
    alert("Export feature is a cosmetic placeholder for EOD Stock list.");
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("");
    setStoreIdFilter("");
    setSelectedDate("2026-07-18");
    setSimulateEmptyState(false);
    setCurrentPage(1);
  };

  return (
    <div className="p-4 md:p-6 bg-white">
      {/* Container Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Card Header Row */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
          {/* Left: Title + Orange Logo Badge */}
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">EOD Stock</h2>
            <span className="px-2 py-0.5 text-[10px] font-extrabold text-orange-600 bg-orange-50 border border-orange-200 rounded-md tracking-wider uppercase shadow-sm">
              INV
            </span>
          </div>

          {/* Right: Interactive Filter Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            
            {/* Category Dropdown Filter */}
            <div className="w-full sm:w-44">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">All Categories</option>
                <option value="RAW_MATERIAL">Raw Material</option>
                <option value="FINISHED_PRODUCT">Finished Product</option>
                <option value="WASTAGE">Wastage</option>
              </select>
            </div>

            {/* Store Dropdown Filter */}
            <div className="w-full sm:w-44">
              <select
                value={storeIdFilter}
                onChange={(e) => {
                  setStoreIdFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">All Stores</option>
                {stores.map((store) => (
                  <option key={store.storeId} value={store.storeId}>
                    {store.storeName}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <input
                type="text"
                placeholder="Search item code or name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-slate-700"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <FaSearch size={13} />
              </span>
            </div>

            {/* QA/Demo Empty State Toggle Button */}
            <button
              onClick={() => setSimulateEmptyState(!simulateEmptyState)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-all duration-200 ${
                simulateEmptyState
                  ? "bg-orange-50 border-orange-200 text-orange-600"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
              title="Toggle Empty State for QA"
            >
              <span>QA: {simulateEmptyState ? "Show Data" : "Empty State"}</span>
            </button>

            {/* Styled Date Picker Input */}
            <div className="relative w-full sm:w-38">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <FaRegCalendarAlt size={13} />
              </span>
            </div>

            {/* Outlined Export Button */}
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer"
            >
              <FaDownload size={13} />
              <span>Export</span>
            </button>

          </div>
        </div>

        {/* Info Banner Strip */}
        <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2.5 text-slate-700 text-sm">
          <FaInfoCircle size={15} className="text-[#3B82F6] flex-shrink-0" />
          <span className="font-medium">
            Stock shown as of last EOD run: <span className="text-slate-900 font-semibold">{asOfDate ? formatDate(asOfDate) : formatDate(selectedDate)}, 11:00 PM</span>
          </span>
        </div>

        {/* Table Body / Loading / Empty State */}
        {loading ? (
          <div className="p-6 space-y-4">
            <div className="h-4 bg-slate-100 rounded-lg w-1/4 animate-pulse" />
            <div className="space-y-3">
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="h-10 bg-slate-100 rounded-lg flex-1 animate-pulse" />
                  <div className="h-10 bg-slate-100 rounded-lg flex-1 animate-pulse" />
                  <div className="h-10 bg-slate-100 rounded-lg flex-1 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white px-4">
            <FaHistory size={40} className="text-slate-300 mb-4 animate-pulse" />
            <p className="text-slate-600 font-bold text-base">
              {emptyMessage}
            </p>
            {simulateEmptyState && (
              <button
                onClick={() => setSimulateEmptyState(false)}
                className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-blue-600 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Exit Empty State Simulation
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <DataTable
              data={data}
              rowKey={(item) => item.id}
              rowClassName={(_, index) => (index % 2 === 0 ? "bg-white" : "bg-slate-50/40")}
              columns={[
                {
                  header: "ITEM CODE",
                  render: (item) => (
                    <span className="font-semibold text-slate-800 tracking-tight">{item.itemCode}</span>
                  )
                },
                {
                  header: "ITEM NAME",
                  render: (item) => (
                    <span className="font-medium text-slate-800">{item.itemName}</span>
                  )
                },
                {
                  header: "CATEGORY",
                  render: (item) => renderCategoryBadge(item.category)
                },
                {
                  header: "STORE",
                  render: (item) => (
                    <span className="text-slate-600 text-sm font-medium">{getStoreName(item.storeId)}</span>
                  )
                },
                {
                  header: "UOM",
                  render: (item) => <span className="text-slate-600 text-sm font-medium">{item.uom || "-"}</span>
                },
                {
                  header: "START QTY",
                  align: "right",
                  render: (item) => (
                    <span className="text-slate-600 font-mono text-sm">
                      {item.startQty.toLocaleString()}
                    </span>
                  )
                },
                {
                  header: "EOD QTY",
                  align: "right",
                  render: (item) => (
                    <span className="font-bold text-slate-900 font-mono text-sm">
                      {item.eodQty.toLocaleString()}
                    </span>
                  )
                },
                {
                  header: "TIME",
                  render: (item) => (
                    <span className="text-slate-500 text-xs font-medium">
                      {formatDateTime(item.recordedAt)}
                    </span>
                  )
                }
              ]}
              pagination={{
                currentPage,
                totalPages,
                onPageChange: (page) => setCurrentPage(page)
              }}
            />
          </div>
        )}

      </div>
    </div>
  );
};

export default EodStockList;
