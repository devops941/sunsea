import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FaInfoCircle, FaHistory, FaLock, FaBroadcastTower } from "react-icons/fa";
import { usePageShortcuts } from "../../../hooks/usePageShortcuts";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { storeService } from "../../../services/storeService";
import { formatDate, formatDateTime } from "../../../utils/dateUtils";
import { toast } from "react-toastify";
import { useSocket } from "../../../providers/SocketProvider";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchEodStock } from "../../../features/eod-stock/eodStockSlice";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";
import type { EodCategory, EodStockItem } from "../../../services/eodStockService";

const ITEMS_PER_PAGE = 20;
const LIVE_POLL_INTERVAL_MS = 30_000;

const getISTDateString = (d: Date = new Date()): string => {
  const ist = d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const dt = new Date(ist);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const formatUom = (uom: string | null): string => {
  if (!uom) return "";
  const first = uom.split(",")[0].trim().toLowerCase();
  if (["ea", "each", "piece", "pcs"].includes(first)) return "pcs";
  return uom.split(",")[0].trim();
};

const formatQty = (qty: number | null, uom: string | null): string => {
  if (qty === null || qty === undefined) return "—";
  const u = formatUom(uom);
  return u ? `${qty.toLocaleString()} ${u}` : qty.toLocaleString();
};

const CategoryBadge: React.FC<{ category: EodCategory }> = ({ category }) => {
  const map: Record<EodCategory, { label: string; cls: string }> = {
    RAW_MATERIAL: {
      label: "Raw Material",
      cls: "bg-emerald-950/60 text-emerald-300 border-emerald-800/60",
    },
    FINISHED_PRODUCT: {
      label: "Finished Product",
      cls: "bg-purple-950/60 text-purple-300 border-purple-800/60",
    },
    WASTAGE: {
      label: "Wastage",
      cls: "bg-red-950/60 text-red-300 border-red-800/60",
    },
  };
  const { label, cls } = map[category] ?? { label: category, cls: "" };
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold border rounded-md whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

const EodStockList: React.FC = () => {
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const { can } = usePermission();

  // ── Redux state ─────────────────────────────────────────────────────────────
  const { data, loading, error, total, asOf } = useAppSelector((state) => state.eodStock);

  // ── Local UI state ───────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [storeIdFilter, setStoreIdFilter] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => getISTDateString());
  const [currentPage, setCurrentPage] = useState(1);
  const [stores, setStores] = useState<any[]>([]);

  // ── Toast on Redux error ─────────────────────────────────────────────────────
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // ── Load stores once ─────────────────────────────────────────────────────────
  const loadStores = useCallback(async () => {
    try {
      const res: any = await storeService.fetchAll();
      const all = res?.stores || res || [];
      setStores(all.filter((s: any) => s.isActive));
    } catch {
      // silent — store list is non-critical
    }
  }, []);

  useEffect(() => { loadStores(); }, [loadStores]);

  // Socket sync: refresh store dropdown when stores change
  useSocketSync("store", undefined, loadStores);

  // ── Debounce search — 300 ms ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ── Dispatch fetch thunk ─────────────────────────────────────────────────────
  const loadData = useCallback(() => {
    dispatch(fetchEodStock({
      date: selectedDate,
      category: categoryFilter || undefined,
      storeId: storeIdFilter || undefined,
      search: debouncedSearch || undefined,
      page: currentPage,
      limit: ITEMS_PER_PAGE,
    }));
  }, [dispatch, selectedDate, categoryFilter, storeIdFilter, debouncedSearch, currentPage]);

  // Keep a stable ref so the polling interval always calls the latest version
  const loadDataRef = useRef(loadData);
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

  usePageShortcuts({ onRefresh: () => loadData() });

  // Re-fetch whenever filters / date / page change
  useEffect(() => { loadData(); }, [loadData]);

  const todayStr = getISTDateString();
  const isTodaySelected = selectedDate === todayStr;

  // ── Live polling: refresh every 30 s while viewing today ─────────────────────
  useEffect(() => {
    if (!isTodaySelected) return;
    const timer = setInterval(() => { loadDataRef.current(); }, LIVE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isTodaySelected]);

  // ── Socket.IO: real-time refresh on stock-mutating events ────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleStockUpdate = () => {
      if (isTodaySelected) loadDataRef.current();
    };

    const socketEvents = [
      "inventory:stockUpdated",
      "inventorySnapshot:completed",
      "stockAdjustment:created",
      "stockAdjustment:updated",
      "grn:created",
      "grn:updated",
      "salesInvoice:created",
      "salesInvoice:updated",
      "hourlyProduction:created",
      "hourlyProduction:updated",
      // Direct raw-material-stock mutations also affect live EOD qty
      "rawMaterialStock:created",
      "rawMaterialStock:updated",
      "rawMaterialStock:deleted",
    ];

    socketEvents.forEach((evt) => socket.on(evt, handleStockUpdate));
    return () => { socketEvents.forEach((evt) => socket.off(evt, handleStockUpdate)); };
  }, [socket, isTodaySelected]);

  const getStoreName = useCallback(
    (id: string) => stores.find((s) => s.storeId === id)?.storeName || id || "—",
    [stores]
  );

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  // Derived view state
  const isLive = data.some((item) => item.recordedAt === null);
  const isLocked = data.length > 0 && data.every((item) => item.recordedAt !== null);
  const lastLockedAt = data.find((item) => item.recordedAt !== null)?.recordedAt ?? null;
  const isFuture = selectedDate > todayStr;

  // ── Empty state message ───────────────────────────────────────────────────────
  const emptyMessage = useMemo(() => {
    if (isFuture) return "Future date — no EOD data available yet.";
    const catLabels: Record<string, string> = {
      RAW_MATERIAL: "Raw Material", FINISHED_PRODUCT: "Finished Product", WASTAGE: "Wastage",
    };
    const parts: string[] = [];
    if (categoryFilter) parts.push(catLabels[categoryFilter] || categoryFilter);
    if (storeIdFilter) parts.push(`in ${getStoreName(storeIdFilter)}`);
    if (!isTodaySelected) {
      return parts.length
        ? `No ${parts.join(" ")} data recorded for ${formatDate(selectedDate)}.`
        : `No EOD data recorded for ${formatDate(selectedDate)}. The stock snapshot for this date was not captured.`;
    }
    return parts.length ? `No ${parts.join(" ")} stock data found.` : "Loading live stock data…";
  }, [categoryFilter, storeIdFilter, selectedDate, isFuture, isTodaySelected, getStoreName]);

  const csvColumns = [
    { header: "Item Code", accessor: (r: EodStockItem) => r.itemCode },
    { header: "Item Name", accessor: (r: EodStockItem) => r.itemName },
    {
      header: "Category", accessor: (r: EodStockItem) =>
        r.category === "RAW_MATERIAL" ? "Raw Material" :
          r.category === "FINISHED_PRODUCT" ? "Finished Product" : "Wastage"
    },
    { header: "Store", accessor: (r: EodStockItem) => getStoreName(r.storeId) },
    { header: "UOM", accessor: (r: EodStockItem) => formatUom(r.uom) },
    { header: "Start Qty", accessor: (r: EodStockItem) => r.startQty },
    {
      header: isTodaySelected && isLive ? "Current Qty (Live)" : "EOD Qty",
      accessor: (r: EodStockItem) => r.eodQty ?? ""
    },
  ];

  // ── Info banner ───────────────────────────────────────────────────────────────
  const renderBanner = () => {
    if (isTodaySelected && isLive) {
      return (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-950/40 border-b border-blue-900/50 text-sm text-blue-300">
          <FaBroadcastTower size={13} className="flex-shrink-0 text-blue-400" />
          <span>
            <span className="font-semibold">Live view</span> —
            {" "}START QTY = day opening balance · EOD QTY = current live stock
            <span className="ml-2 text-blue-400 text-xs">(auto-refreshes every 30 s)</span>
          </span>
        </div>
      );
    }
    if (isTodaySelected && isLocked) {
      return (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-950/40 border-b border-emerald-900/50 text-sm text-emerald-300">
          <FaLock size={12} className="flex-shrink-0 text-emerald-400" />
          <span>
            Today's stock locked as of{" "}
            <span className="font-semibold">{formatDateTime(lastLockedAt!)}</span>
          </span>
        </div>
      );
    }
    if (!isTodaySelected && isLocked) {
      return (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-card-2 border-b border-line text-sm text-ink-muted">
          <FaLock size={12} className="flex-shrink-0 text-ink-subtle" />
          <span>
            Stock locked as of{" "}
            <span className="font-semibold text-ink">{formatDateTime(lastLockedAt!)}</span>
          </span>
        </div>
      );
    }
    if (!isTodaySelected && !isLocked && data.length === 0 && !loading) {
      return (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-950/40 border-b border-amber-900/50 text-sm text-amber-300">
          <FaInfoCircle size={13} className="flex-shrink-0 text-amber-400" />
          <span>
            No EOD snapshot recorded for{" "}
            <span className="font-semibold">{formatDate(selectedDate)}</span>.
          </span>
        </div>
      );
    }
    if (isFuture) {
      return (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-card-2 border-b border-line text-sm text-ink-subtle">
          <FaInfoCircle size={13} className="flex-shrink-0" />
          <span>Future date — no EOD data available yet.</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-5 py-2.5 bg-card-2 border-b border-line text-sm text-ink-muted">
        <FaInfoCircle size={14} className="text-blue-400 flex-shrink-0" />
        <span>
          Showing stock for{" "}
          <span className="font-semibold text-ink">
            {asOf ? formatDate(asOf) : formatDate(selectedDate)}
          </span>
        </span>
      </div>
    );
  };

  return (
    <div className="w-full pb-6">
      <div className="w-full bg-card rounded-2xl shadow-sm border border-line overflow-hidden">

        {/* ── Header ───────────────────────────────────────────────────────────── */}
        <div className="border-b border-line px-5 py-4">
          {/* Row 1: title + action buttons */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-ink tracking-tight">EOD Stock</h2>
            </div>

            <div className="flex items-center gap-2">
              {(can("eod-stock.export") || can("inventory.export")) && (
                <ExportCSVButton
                  data={data}
                  columns={csvColumns}
                  filename={`eod-stock-${selectedDate}.csv`}
                  text="Export"
                />
              )}
            </div>
          </div>

          {/* Row 2: filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <SelectInput
                value={categoryFilter}
                defaultOptionLabel="All Categories"
                options={[
                  { label: "Raw Material", value: "RAW_MATERIAL" },
                  { label: "Finished Product", value: "FINISHED_PRODUCT" },
                  { label: "Wastage", value: "WASTAGE" },
                ]}
                hideLabel
                noMargin
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div className="w-48">
              <SelectInput
                value={storeIdFilter}
                defaultOptionLabel="All Stores"
                options={stores.map((s) => ({ label: s.storeName, value: s.storeId }))}
                hideLabel
                noMargin
                onChange={(e) => { setStoreIdFilter(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div className="w-56">
              <SearchInput
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search item code or name…"
                fullWidthOnMobileOnly={false}
              />
            </div>

            <div className="w-40">
              <DatePickerCalendar
                value={selectedDate}
                maxDate={todayStr}
                placeholder="Select date"
                onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>

        {/* ── Info banner ──────────────────────────────────────────────────────── */}
        {renderBanner()}

        {/* ── Table ────────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <DataTable
            data={data}
            loading={loading}
            rowKey={(item) => item.id}
            emptyMessage={
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <FaHistory size={32} className="text-ink-subtle mb-3" />
                <p className="text-ink-subtle font-medium text-sm">{emptyMessage}</p>
              </div>
            }
            rowClassName={(_, i) => (i % 2 === 0 ? "bg-card" : "bg-card-2/40")}
            columns={[
              {
                header: "ITEM CODE",
                width: "160px",
                render: (item) => (
                  <span className="font-semibold text-ink tracking-tight text-sm font-mono">
                    {item.itemCode}
                  </span>
                ),
              },
              {
                header: "ITEM NAME",
                width: "minmax(200px, 2fr)",
                render: (item) => (
                  <span className="font-medium text-ink text-sm">{item.itemName}</span>
                ),
              },
              {
                header: "CATEGORY",
                width: "160px",
                render: (item) => <CategoryBadge category={item.category} />,
              },
              {
                header: "STORE",
                width: "160px",
                render: (item) => (
                  <span className="text-ink font-normal text-sm">{getStoreName(item.storeId)}</span>
                ),
              },
              {
                header: "START QTY",
                width: "150px",
                align: "right",
                render: (item) => (
                  <span className="text-ink font-mono font-medium text-sm">
                    {formatQty(item.startQty, item.uom)}
                  </span>
                ),
              },
              {
                header: isTodaySelected && isLive ? "CURRENT QTY" : "EOD QTY",
                width: "160px",
                align: "right",
                render: (item) => (
                  <span className="font-bold font-mono text-sm text-ink flex items-center justify-end gap-1.5">
                    {formatQty(item.eodQty, item.uom)}
                    {item.recordedAt !== null && (
                      <FaLock size={9} className="text-ink-subtle" title={`Locked at ${formatDateTime(item.recordedAt)}`} />
                    )}
                  </span>
                ),
              },
            ]}
            pagination={{
              currentPage,
              totalPages,
              onPageChange: (p) => setCurrentPage(p),
            }}
          />
        </div>

      </div>
    </div>
  );
};

export default EodStockList;
