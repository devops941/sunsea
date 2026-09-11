import { formatDate } from "../../../utils/dateUtils";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { reportsService } from "../../../services/reportsService";
import { storeService } from "../../../services/storeService";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import Button from "../../../components/ui/Button/Button";
import ColumnToggle from "../../../components/ui/ColumnToggle/ColumnToggle";
import DataTable from "../../../components/ui/table/DataTable";
import type { DataTableColumn } from "../../../components/ui/table/DataTable";
import { useListCache } from "../../../hooks/useListCache";
import { usePermission } from "../../../hooks/usePermission";


const InventoryReportsCenter: React.FC = () => {
  const { can } = usePermission();
  // Filters state
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [storeId, setStoreId] = useState("");
  const [search, setSearch] = useState("");

  const [draftDate, setDraftDate] = useState(date);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftStoreId, setDraftStoreId] = useState(storeId);
  const [draftSearch, setDraftSearch] = useState(search);

  const [stores, setStores] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const LIMIT = 10;
  const [asOfDate, setAsOfDate] = useState("");

  const DEFAULT_COLUMNS = [
    "#", "DATE", "ITEM CODE", "ITEM NAME", "CATEGORY", "STORE", "START QTY", "EOD QTY"
  ];

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("inventoryReportVisibleColumns");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_COLUMNS;
      }
    }
    return DEFAULT_COLUMNS;
  });

  useEffect(() => {
    localStorage.setItem("inventoryReportVisibleColumns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

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

  // Load report data via useListCache
  const cacheKey = `inventoryReport:${page}:${LIMIT}:${date}:${category}:${storeId}:${search}`;

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    const res = await reportsService.getInventoryReport({
      date, category, storeId, search,
      page, limit: LIMIT,
    });
    if (res.asOf) setAsOfDate(res.asOf);
    const data = res.data || [];
    let tot = data.length;
    if (res.pagination) {
      tot = res.pagination.total || tot;
    } else if (res.total) {
      tot = res.total;
    }
    return { data, total: tot };
  }, [date, category, storeId, search, page]);

  const { data: backendReports, total, loading: loadingBackend } = useListCache({
    cacheKey,
    socketModule: "inventorySnapshot",
    fetcher,
  });

  const totalPages = Math.ceil((total || 0) / LIMIT) || 1;

  // CSV Data Configuration
  const { csvData, csvColumns, csvFilename } = useMemo(() => {
    const columns = [
      { header: "Item Code", accessor: (item: any) => item.itemCode },
      { header: "Item Name", accessor: (item: any) => item.itemName },
      { header: "Category", accessor: (item: any) => item.category },
      { header: "Store", accessor: (item: any) => stores.find(s => String(s.storeId) === String(item.storeId))?.storeName || item.storeId },
      { header: "Date", accessor: (item: any) => item.snapshotDate ? formatDate(item.snapshotDate) : "-" },
      { header: "Start Qty", accessor: (item: any) => (item.startQty !== null && item.startQty !== undefined && item.startQty !== '') ? `${item.startQty} ${item.uom ? item.uom.split(',')[0] : ''}`.trim() : "-" },
      { header: "EOD Qty", accessor: (item: any) => (item.eodQty !== null && item.eodQty !== undefined && item.eodQty !== '') ? `${item.eodQty} ${item.uom ? item.uom.split(',')[0] : ''}`.trim() : "-" }
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
      header: "DATE",
      render: (item: any) => <span className="text-ink-subtle font-medium">{item.snapshotDate ? formatDate(item.snapshotDate) : "-"}</span>
    },
    {
      header: "ITEM CODE",
      render: (item: any) => <span className="font-semibold text-ink">{item.itemCode || "-"}</span>
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
      header: "STORE",
      render: (item: any) => {
        const st = stores.find(s => String(s.storeId) === String(item.storeId));
        return st ? st.storeName : item.storeId;
      }
    },

    {
      header: "START QTY",
      render: (item: any) => <span className="text-ink-muted">{(item.startQty !== null && item.startQty !== undefined && item.startQty !== '') ? `${item.startQty} ${item.uom ? item.uom.split(',')[0] : ''}` : "-"}</span>
    },
    {
      header: "EOD QTY",
      render: (item: any) => <span className="text-blue-600 font-semibold">{(item.eodQty !== null && item.eodQty !== undefined && item.eodQty !== '') ? `${item.eodQty} ${item.uom ? item.uom.split(',')[0] : ''}` : "-"}</span>
    }
  ];

  const finalColumns = tableColumns.filter(c => visibleColumns.includes(c.header as string));

  return (
    <div className="w-full">
      <div className="max-w-[1024px] xl:mr-auto bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 border-b border-line">
          <div>
            <h2 className="text-2xl font-bold text-ink">Inventory Reports</h2>
            {asOfDate && <p className="text-sm text-ink-subtle mt-1">Data as of: {formatDate(asOfDate)}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3 relative w-full lg:w-auto">
            {can("inventory-reports.export") && (
              <ExportCSVButton
                data={csvData}
                columns={csvColumns.filter(c => visibleColumns.map(v => v.toLowerCase()).includes(c.header.toLowerCase()))}
                filename={csvFilename}
                text="Export CSV"
              />
            )}
          </div>
        </div>

        <div className="p-6 border-b border-line bg-card-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Snapshot Date</label>
              <DatePickerCalendar
                name="draftDate"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Category</label>
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
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Store</label>
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
              <label className="block mb-1 text-[11px] uppercase tracking-wider text-ink-subtle font-bold">Search Item</label>
              <input type="text" className="w-full border border-line rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm" value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)} placeholder="Search code or name..." />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-line">
            <div>
              <ColumnToggle
                columns={tableColumns}
                visibleColumns={visibleColumns}
                setVisibleColumns={setVisibleColumns}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                text="Clear All"
                variant="secondary"
                size="sm"
                onClick={handleClearFilters}
              />
              <Button
                text="Apply Filters"
                variant="primary"
                size="sm"
                onClick={handleApplyFilters}
              />
            </div>
          </div>
        </div>

        <DataTable
          columns={finalColumns}
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
