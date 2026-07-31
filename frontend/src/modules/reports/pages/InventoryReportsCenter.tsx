import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { FaFilter } from "react-icons/fa";
import { reportsService } from "../../../services/reportsService";
import { storeService } from "../../../services/storeService";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import type { DataTableColumn } from "../../../components/ui/table/DataTable";
import DataTable from "../../../components/ui/table/DataTable";
import { useSocketSync } from "../../../hooks/useSocketSync";

const InventoryReportsCenter: React.FC = () => {
  // Filters state
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [storeId, setStoreId] = useState("");
  const [search, setSearch] = useState("");

  const [draftDate, setDraftDate] = useState(date);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftStoreId, setDraftStoreId] = useState(storeId);
  const [draftSearch, setDraftSearch] = useState(search);

  // Backend direct reports loading
  const [backendReports, setBackendReports] = useState<any[]>([]);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [asOfDate, setAsOfDate] = useState("");

  useEffect(() => {
    const loadStores = async () => {
      try {
        const res = await storeService.fetchAll();
        const storeArray = res.stores || res.data?.stores || res.data || res || [];
        setStores(Array.isArray(storeArray) ? storeArray : []);
      } catch (err) {
        console.error("Failed to load stores", err);
      }
    };
    loadStores();
  }, []);

  // Load report data from backend
  const fetchReportData = useCallback(async () => {
    setLoadingBackend(true);
    try {
      const res = await reportsService.getInventoryReport({
        date,
        category,
        storeId,
        search,
        page,
        limit: 10
      });
      
      setBackendReports(res.data || []);
      if (res.asOf) {
          setAsOfDate(res.asOf);
      }
      if (res.pagination) {
          setTotalPages(Math.ceil(res.pagination.total / res.pagination.limit) || 1);
      } else if (res.total) {
          setTotalPages(Math.ceil(res.total / 10) || 1);
      }
    } catch (err) {
      console.error("Failed to load inventory report", err);
    } finally {
      setLoadingBackend(false);
    }
  }, [date, category, storeId, search, page]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  useSocketSync("inventorySnapshot", undefined, fetchReportData);

  // CSV Data Configuration
  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Item Code", accessor: (item: any) => item.itemCode },
      { header: "Item Name", accessor: (item: any) => item.itemName },
      { header: "Category", accessor: (item: any) => item.category },
      { header: "UOM", accessor: (item: any) => item.uom },
      { header: "Store", accessor: (item: any) => stores.find(s => String(s.storeId) === String(item.storeId))?.storeName || item.storeId },
      { header: "Start Qty", accessor: (item: any) => item.startQty },
      { header: "EOD Qty", accessor: (item: any) => item.eodQty }
    ];
    
    // For CSV, we ideally want all data, but here we just export the current page or loaded data
    return { csvData: backendReports, csvColumns: columns, csvFilename: `Inventory_Report_${date || asOfDate}.csv` };
  }, [backendReports, date, asOfDate, stores]);

  const handleApplyFilters = () => {
    setDate(draftDate);
    setCategory(draftCategory);
    setStoreId(draftStoreId);
    setSearch(draftSearch);
    setPage(1);
  };

  const handleClearFilters = () => {
    setDraftDate("");
    setDraftCategory("");
    setDraftStoreId("");
    setDraftSearch("");

    setDate("");
    setCategory("");
    setStoreId("");
    setSearch("");
    setPage(1);
  };

  const tableColumns: DataTableColumn<any>[] = [
    {
      header: "#",
      width: "60px",
      render: (_item, index) => ((page - 1) * 10) + index + 1,
    },
    {
      header: "ITEM CODE",
      render: (item: any) => <span className="font-semibold text-gray-800">{item.itemCode || "-"}</span>
    },
    {
      header: "ITEM NAME",
      render: (item: any) => item.itemName || "-"
    },
    {
      header: "CATEGORY",
      render: (item: any) => <span className="text-sm font-medium">{item.category}</span>
    },
    {
      header: "UOM",
      render: (item: any) => item.uom || "-"
    },
    {
      header: "STORE",
      render: (item: any) => {
        const st = stores.find(s => String(s.storeId) === String(item.storeId));
        return st ? st.storeName : item.storeId;
      }
    },
    {
      header: "START QTY",
      render: (item: any) => <span className="text-gray-600">{item.startQty}</span>
    },
    {
      header: "EOD Qty",
      render: (item: any) => <span className="text-blue-600 font-semibold">{item.eodQty}</span>
    }
  ];

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Inventory Reports</h2>
            {asOfDate && <p className="text-sm text-slate-500 mt-1">Data as of: {new Date(asOfDate).toLocaleDateString()}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            <ExportCSVButton
              data={csvData}
              columns={csvColumns}
              filename={csvFilename}
              text="Export CSV"
            />
          </div>
        </div>

        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Snapshot Date</label>
              <DatePickerCalendar
                name="draftDate"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Category</label>
              <SelectInput
                name="draftCategory"
                value={draftCategory}
                options={[
                  { label: "Raw Materials", value: "RAW_MATERIAL" },
                  { label: "Finished Products", value: "FINISHED_PRODUCT" }
                ]}
                defaultOptionLabel="All Categories"
                hideLabel={true}
                onChange={(e) => setDraftCategory(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Store</label>
              <SelectInput
                name="draftStoreId"
                value={draftStoreId}
                options={stores.map(s => ({ label: s.storeName, value: (s.storeId || s.id || '').toString() }))}
                defaultOptionLabel="All Stores"
                hideLabel={true}
                onChange={(e) => setDraftStoreId(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold">Search Item</label>
              <input type="text" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)} placeholder="Search code or name..." />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>

        <DataTable
          columns={tableColumns}
          data={backendReports}
          rowKey={(row) => row.id || row.itemId || Math.random().toString()}
          loading={loadingBackend}
          pagination={{
            currentPage: page,
            totalPages: totalPages,
            onPageChange: setPage,
          }}
          emptyMessage="No inventory data found for the selected filters."
        />
      </div>
    </div>
  );
};

export default InventoryReportsCenter;
