import React, { useState, useEffect, useRef, useMemo } from "react";
import { FaInfoCircle, FaHistory, FaSyncAlt, FaLock, FaBroadcastTower } from "react-icons/fa";
import DataTable from "../../../components/ui/table/DataTable";
import SearchInput from "../../../components/ui/SearchInput/SearchInput";
import ExportCSVButton from "../../../components/ui/ExportCSVButton/ExportCSVButton";
import Button from "../../../components/ui/Button/Button";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import DatePickerCalendar from "../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import apiClient from "../../../api/apiClient";
import { storeService } from "../../../services/storeService";
import { formatDate, formatDateTime } from "../../../utils/dateUtils";
import { toast } from "react-toastify";
import { useSocket } from "../../../providers/SocketProvider";

type EodCategory = "RAW_MATERIAL" | "FINISHED_PRODUCT" | "WASTAGE";

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
  eodQty: number | null;
  recordedAt: string | null;
}

const ITEMS_PER_PAGE = 20;
const LIVE_POLL_INTERVAL_MS = 30_000; // refresh today's live data every 30 s

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

// ─── Category badge ────────────────────────────────────────────────────────────
const CategoryBadge: React.FC<{ category: EodCategory }> = ({ category }) => {
  const map: Record<EodCategory, { label: string; cls: string }> = {
    RAW_MATERIAL:     { label: "Raw Material",     cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    FINISHED_PRODUCT: { label: "Finished Product", cls: "bg-purple-50  text-purple-700  border-purple-200"  },
    WASTAGE:          { label: "Wastage",           cls: "bg-red-50     text-red-700     border-red-200"     },
  };
  const { label, cls } = map[category] ?? { label: category, cls: "" };
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold border rounded-md whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
};

// ──────────────────────────────────────────────────────────────────────────────

const EodStockList: React.FC = () => {
  const { socket } = useSocket();

  const [data,        setData]        = useState<EodStockItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [syncing,     setSyncing]     = useState(false);
  const [totalItems,  setTotalItems]  = useState(0);
  const [asOfDate,    setAsOfDate]    = useState("");
  const [searchTerm,  setSearchTerm]  = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter,  setCategoryFilter]  = useState("");
  const [storeIdFilter,   setStoreIdFilter]   = useState("");

  // Default date = TODAY so users always open to the live view
  const [selectedDate, setSelectedDate] = useState(() => getISTDateString());

  const [currentPage, setCurrentPage] = useState(1);
  const [stores,      setStores]      = useState<any[]>([]);

  const fetchFnRef = useRef<(() => void) | undefined>(undefined);

  // Load stores once
  useEffect(() => {
    storeService.fetchAll()
      .then((res: any) => {
        const all = res?.stores || res || [];
        setStores(all.filter((s: any) => s.isActive));
      })
      .catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchEodStock = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/inventory/eod-stock", {
        params: {
          date:     selectedDate,
          category: categoryFilter  || undefined,
          storeId:  storeIdFilter   || undefined,
          search:   debouncedSearch || undefined,
          page:     currentPage,
          limit:    ITEMS_PER_PAGE,
        },
      });
      if (res.data) {
        setData(res.data.data || []);
        setTotalItems(res.data.pagination?.total || 0);
        setAsOfDate(res.data.asOf || "");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to fetch EOD stock data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFnRef.current = fetchEodStock; });

  // Re-fetch whenever filters / date / page change
  useEffect(() => {
    fetchEodStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, categoryFilter, storeIdFilter, selectedDate, currentPage]);

  const todayStr = getISTDateString();
  const isTodaySelected = selectedDate === todayStr;

  // ── Live polling: refresh every 30 s while viewing today ─────────────────
  useEffect(() => {
    if (!isTodaySelected) return;
    const timer = setInterval(() => { fetchFnRef.current?.(); }, LIVE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isTodaySelected]);

  // ── Socket: refresh today's view when any stock operation happens ─────────
  useEffect(() => {
    if (!socket) return;

    // After EOD snapshot is locked (cron or manual sync)
    const onSnapshotCompleted = () => { fetchFnRef.current?.(); };
    socket.on("inventorySnapshot:completed", onSnapshotCompleted);

    // After any stock movement (hourly production, stock adjustment approval)
    const onStockUpdated = () => {
      if (isTodaySelected) fetchFnRef.current?.();
    };
    socket.on("inventory:stockUpdated", onStockUpdated);

    return () => {
      socket.off("inventorySnapshot:completed", onSnapshotCompleted);
      socket.off("inventory:stockUpdated", onStockUpdated);
    };
  }, [socket, isTodaySelected]);

  // Manual sync / re-run EOD for selected date
  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiClient.post("/inventory/eod-stock/run-now", null, {
        params: { date: selectedDate },
      });
      toast.success(`EOD snapshot run for ${selectedDate}`);
      await fetchEodStock();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const getStoreName = (id: string) =>
    stores.find((s) => s.storeId === id)?.storeName || id || "—";

  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  // Determine view state
  const isLive       = data.some((item) => item.recordedAt === null);
  const isLocked     = data.length > 0 && data.every((item) => item.recordedAt !== null);
  const lastLockedAt = data.find((item) => item.recordedAt !== null)?.recordedAt ?? null;
  const isFuture     = selectedDate > todayStr;

  // ── Empty state message ───────────────────────────────────────────────────
  const emptyMessage = useMemo(() => {
    if (isFuture) {
      return "Future date — no EOD data available yet.";
    }
    const catLabels: Record<string, string> = {
      RAW_MATERIAL: "Raw Material", FINISHED_PRODUCT: "Finished Product", WASTAGE: "Wastage",
    };
    const parts: string[] = [];
    if (categoryFilter) parts.push(catLabels[categoryFilter] || categoryFilter);
    if (storeIdFilter)  parts.push(`in ${getStoreName(storeIdFilter)}`);

    if (!isTodaySelected) {
      // Past date with no snapshot data at all
      return parts.length
        ? `No ${parts.join(" ")} data recorded for ${formatDate(selectedDate)}.`
        : `No EOD data recorded for ${formatDate(selectedDate)}. The stock snapshot for this date was not captured.`;
    }
    // Today but empty (shouldn't normally happen — live data always has items)
    return parts.length
      ? `No ${parts.join(" ")} stock data found.`
      : "Loading live stock data…";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, storeIdFilter, selectedDate, stores, isFuture, isTodaySelected]);

  const csvColumns = [
    { header: "Item Code", accessor: (r: EodStockItem) => r.itemCode },
    { header: "Item Name", accessor: (r: EodStockItem) => r.itemName },
    { header: "Category",  accessor: (r: EodStockItem) =>
        r.category === "RAW_MATERIAL" ? "Raw Material" :
        r.category === "FINISHED_PRODUCT" ? "Finished Product" : "Wastage" },
    { header: "Store",     accessor: (r: EodStockItem) => getStoreName(r.storeId) },
    { header: "UOM",       accessor: (r: EodStockItem) => formatUom(r.uom) },
    { header: "Start Qty", accessor: (r: EodStockItem) => r.startQty },
    { header: isTodaySelected && isLive ? "Current Qty (Live)" : "EOD Qty",
      accessor: (r: EodStockItem) => r.eodQty ?? "" },
  ];

  // ── Info banner ───────────────────────────────────────────────────────────
  const renderBanner = () => {
    if (isTodaySelected && isLive) {
      return (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 border-b border-blue-100 text-sm text-blue-700">
          <FaBroadcastTower size={13} className="flex-shrink-0 text-blue-500" />
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
        <div className="flex items-center gap-2 px-5 py-2.5 bg-green-50 border-b border-green-100 text-sm text-green-700">
          <FaLock size={12} className="flex-shrink-0 text-green-500" />
          <span>
            Today's stock locked as of{" "}
            <span className="font-semibold">{formatDateTime(lastLockedAt!)}</span>
          </span>
        </div>
      );
    }

    if (!isTodaySelected && isLocked) {
      return (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
          <FaLock size={12} className="flex-shrink-0 text-slate-400" />
          <span>
            Stock locked as of{" "}
            <span className="font-semibold text-slate-800">{formatDateTime(lastLockedAt!)}</span>
          </span>
        </div>
      );
    }

    if (!isTodaySelected && !isLocked && data.length === 0 && !loading) {
      return (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-sm text-amber-700">
          <FaInfoCircle size={13} className="flex-shrink-0 text-amber-500" />
          <span>
            No EOD snapshot recorded for{" "}
            <span className="font-semibold">{formatDate(selectedDate)}</span>.
            {" "}Use <span className="font-semibold">Sync EOD</span> to capture a snapshot for this date.
          </span>
        </div>
      );
    }

    if (isFuture) {
      return (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
          <FaInfoCircle size={13} className="flex-shrink-0" />
          <span>Future date — no EOD data available yet.</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
        <FaInfoCircle size={14} className="text-blue-500 flex-shrink-0" />
        <span>
          Showing stock for{" "}
          <span className="font-semibold text-slate-800">
            {asOfDate ? formatDate(asOfDate) : formatDate(selectedDate)}
          </span>
        </span>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="border-b border-slate-200 px-5 py-4">
          {/* Row 1: title + action buttons */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">EOD Stock</h2>
              <span className="px-1.5 py-0.5 text-[9px] font-extrabold text-orange-600 bg-orange-50 border border-orange-200 rounded tracking-widest uppercase">
                INV
              </span>
              {isTodaySelected && isLive && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                text={syncing ? "Syncing…" : "Sync EOD"}
                icon={FaSyncAlt}
                variant="secondary"
                size="sm"
                disabled={syncing}
                onClick={handleSync}
              />
              <ExportCSVButton
                data={data}
                columns={csvColumns}
                filename={`eod-stock-${selectedDate}.csv`}
                text="Export"
              />
            </div>
          </div>

          {/* Row 2: filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <SelectInput
                value={categoryFilter}
                defaultOptionLabel="All Categories"
                options={[
                  { label: "Raw Material",     value: "RAW_MATERIAL"     },
                  { label: "Finished Product", value: "FINISHED_PRODUCT" },
                  { label: "Wastage",          value: "WASTAGE"          },
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

        {/* ── Info banner ──────────────────────────────────────────────────── */}
        {renderBanner()}

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <DataTable
            data={data}
            loading={loading}
            rowKey={(item) => item.id}
            emptyMessage={
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <FaHistory size={32} className="text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium text-sm">{emptyMessage}</p>
                {/* Only show Sync button for past dates with no data (not future) */}
                {!isTodaySelected && !isFuture && (
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="mt-3 px-4 py-1.5 text-xs font-semibold text-white bg-blue-500
                      hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {syncing ? "Syncing…" : "Sync Now"}
                  </button>
                )}
              </div>
            }
            rowClassName={(_, i) => (i % 2 === 0 ? "bg-white" : "bg-slate-50/40")}
            columns={[
              {
                header: "ITEM CODE",
                render: (item) => (
                  <span className="font-semibold text-slate-800 tracking-tight text-sm">
                    {item.itemCode}
                  </span>
                ),
              },
              {
                header: "ITEM NAME",
                render: (item) => (
                  <span className="font-medium text-slate-800 text-sm">{item.itemName}</span>
                ),
              },
              {
                header: "CATEGORY",
                render: (item) => <CategoryBadge category={item.category} />,
              },
              {
                header: "STORE",
                render: (item) => (
                  <span className="text-slate-600 text-sm">{getStoreName(item.storeId)}</span>
                ),
              },
              {
                header: "START QTY",
                align: "right",
                render: (item) => (
                  <span className="text-slate-600 font-mono text-sm">
                    {formatQty(item.startQty, item.uom)}
                  </span>
                ),
              },
              {
                header: isTodaySelected && isLive ? "CURRENT QTY" : "EOD QTY",
                align: "right",
                render: (item) => (
                  <span className={`font-bold font-mono text-sm flex items-center justify-end gap-1.5 ${
                    item.recordedAt === null ? "text-blue-600" : "text-slate-900"
                  }`}>
                    {formatQty(item.eodQty, item.uom)}
                    {item.recordedAt === null ? (
                      <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wide
                        border border-blue-200 bg-blue-50 rounded px-1 py-px">
                        live
                      </span>
                    ) : (
                      <FaLock size={9} className="text-slate-400" title={`Locked at ${formatDateTime(item.recordedAt)}`} />
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
