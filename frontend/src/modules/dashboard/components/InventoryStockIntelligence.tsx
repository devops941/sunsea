import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  FaBoxes,
  FaExclamationTriangle,
  FaCheckCircle,
  FaChartBar,
  FaChartPie,
  FaChartLine,
  FaListUl,
  FaWarehouse,
  FaLayerGroup,
  FaShoppingBag,
  FaRecycle,
  FaSync,
  FaCheckDouble,
  FaChevronLeft,
  FaChevronRight,
  FaPause,
  FaPlay,
} from "react-icons/fa";
import { rawMaterialStockService } from "../../../services/rawMaterialStockService";
import { rawMaterialService } from "../../../services/rawMaterialService";
import { finishedGoodsStockService } from "../../../services/finishedGoodsStockService";
import { productService } from "../../../services/productService";
import { usePageSocketSync } from "../../../hooks/usePageSocketSync";

interface InventoryStockIntelligenceProps {
  rawMaterials?: any[];
  rawMaterialStocks?: any[];
  finishedGoodsStocks?: any[];
  allProducts?: any[];
  isParentLoading?: boolean;
}

type InventoryTab = "raw" | "finished" | "wastage";

const PALETTE = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#f43f5e", "#14b8a6", "#6366f1"];
const ITEMS_PER_PAGE = 7; // Optimal item count for clean, readable charts

// Helper to extract only the single primary UOM and normalize EA -> PCS
const getPrimaryUom = (uomInput: any, defaultUom = "KG"): string => {
  if (!uomInput) return defaultUom;
  if (typeof uomInput === "object") {
    const val = uomInput.code || uomInput.uomCode || uomInput.name || uomInput.uomName;
    return val ? getPrimaryUom(val, defaultUom) : defaultUom;
  }
  let str = String(uomInput).trim();
  if (str.includes(",")) {
    str = str.split(",")[0].trim();
  }
  str = str.toUpperCase();
  if (str === "EA" || str === "EACH") {
    return "PCS";
  }
  return str || defaultUom;
};

// Helper to identify whether an item belongs to Wastage Store
const isWastageItem = (rm: any, name: string): boolean => {
  const nm = (name || "").toLowerCase();
  return (
    rm.itemType === "WASTAGE" ||
    rm.category?.type === "WASTAGE" ||
    rm.category?.name?.toUpperCase() === "WASTAGE" ||
    rm.store?.storeCategory === "WASTAGE" ||
    nm.startsWith("wastage") ||
    nm.includes("wastage") ||
    nm.includes("scrap")
  );
};

// Helper to extract clean category for Raw Materials
const extractRawCategory = (rm: any, name: string): string => {
  if (rm.category?.name) return rm.category.name;
  if (rm.categoryName) return rm.categoryName;
  if (typeof rm.category === "string" && rm.category.trim()) return rm.category;
  if (rm.rawMaterialCategory?.name) return rm.rawMaterialCategory.name;

  const nm = (name || "").toLowerCase();
  if (nm.includes("granule") || nm.includes("virgin") || nm.includes("pp") || nm.includes("hd") || nm.includes("lld") || nm.includes("npp")) {
    return "Polymer";
  }
  if (nm.includes("masterbatch") || nm.includes("color") || nm.includes("red") || nm.includes("oxide") || nm.includes("titanium")) {
    return "Masterbatch";
  }
  if (nm.includes("thread") || nm.includes("yarn") || nm.includes("handle") || nm.includes("wire")) {
    return "Accessory";
  }
  return "Raw Material";
};

// Helper to extract clean category for Finished Products (e.g. Bucket, Container, Lid, Mug)
const extractProductCategory = (p: any, name: string): string => {
  if (p.category?.name) return p.category.name;
  if (p.categoryName) return p.categoryName;
  if (typeof p.category === "string" && p.category.trim()) return p.category;
  if (p.productCategory?.name) return p.productCategory.name;

  const nm = (name || "").toLowerCase();
  if (nm.includes("bucket")) return "Bucket";
  if (nm.includes("container") || nm.includes("box")) return "Container";
  if (nm.includes("lid") || nm.includes("cap")) return "Lid & Cap";
  if (nm.includes("mug") || nm.includes("cup")) return "Mug";
  if (nm.includes("handle")) return "Handle";
  if (nm.includes("basin") || nm.includes("tub")) return "Basin / Tub";
  return "Moulded Product";
};

export const InventoryStockIntelligence: React.FC<InventoryStockIntelligenceProps> = ({
  rawMaterials: initialRawMaterials = [],
  rawMaterialStocks: initialRawStocks = [],
  finishedGoodsStocks: initialFgStocks = [],
  allProducts: initialProducts = [],
  isParentLoading = false,
}) => {
  const navigate = useNavigate();

  // Load persisted preferences from localStorage
  const [chartType, setChartType] = useState<"bar" | "pie" | "area" | "list">(() => {
    try {
      return (localStorage.getItem("dash_inventory_chart_type") as any) || "bar";
    } catch {
      return "bar";
    }
  });

  const [activeTab, setActiveTab] = useState<InventoryTab>(() => {
    try {
      const saved = localStorage.getItem("dash_inventory_active_tab");
      if (saved === "finished" || saved === "wastage" || saved === "raw") {
        return saved;
      }
      return "raw";
    } catch {
      return "raw";
    }
  });

  // Carousel Batching & Auto-Rotation State
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);

  const handleTabChange = (tab: InventoryTab) => {
    setActiveTab(tab);
    setCurrentPage(0);
    try {
      localStorage.setItem("dash_inventory_active_tab", tab);
    } catch {
      // silent
    }
  };

  const handleChartTypeChange = (type: "bar" | "pie" | "area" | "list") => {
    setChartType(type);
    try {
      localStorage.setItem("dash_inventory_chart_type", type);
    } catch {
      // silent
    }
  };

  // Live data states
  const [liveRawMaterials, setLiveRawMaterials] = useState<any[]>(initialRawMaterials);
  const [liveRawStocks, setLiveRawStocks] = useState<any[]>(initialRawStocks);
  const [liveFgStocks, setLiveFgStocks] = useState<any[]>(initialFgStocks);
  const [liveProducts, setLiveProducts] = useState<any[]>(initialProducts);
  const [hasLoadedData, setHasLoadedData] = useState<boolean>(() => Boolean(initialRawMaterials?.length || initialRawStocks?.length || initialProducts?.length));
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialRawMaterials?.length && !initialRawStocks?.length);

  const isOverallLoading = isLoading || isParentLoading || !hasLoadedData;

  // Prevent concurrent fetches: if a socket event fires while a fetch is
  // in-flight, skip it — the in-flight response is already the freshest data.
  const fetchingRef = useRef(false);

  // Fetch 100% Real Live Data from Backend APIs
  const fetchLiveInventoryData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setIsLoading(true);
      const [rmRes, rmStockRes, fgStockRes, prodRes] = await Promise.allSettled([
        rawMaterialService.fetchAll ? rawMaterialService.fetchAll({ limit: 100 }) : Promise.resolve([]),
        rawMaterialStockService.fetchAll ? rawMaterialStockService.fetchAll({ limit: 100 }) : Promise.resolve([]),
        finishedGoodsStockService.fetchAll ? finishedGoodsStockService.fetchAll({ limit: 100 }) : Promise.resolve([]),
        productService.fetchAll ? productService.fetchAll() : Promise.resolve([]),
      ]);

      if (rmRes.status === "fulfilled" && rmRes.value) {
        const val: any = rmRes.value;
        const data = Array.isArray(val) ? val : val?.rawMaterials || val?.data || [];
        if (data.length > 0) setLiveRawMaterials(data);
      }

      if (rmStockRes.status === "fulfilled" && rmStockRes.value) {
        const val: any = rmStockRes.value;
        const data = Array.isArray(val) ? val : val?.data || val?.stocks || [];
        if (data.length > 0) setLiveRawStocks(data);
      }

      if (fgStockRes.status === "fulfilled" && fgStockRes.value) {
        const val: any = fgStockRes.value;
        const data = Array.isArray(val) ? val : val?.data || val?.finishedGoodsStocks || [];
        if (data.length > 0) setLiveFgStocks(data);
      }

      if (prodRes.status === "fulfilled" && prodRes.value) {
        const val: any = prodRes.value;
        const data = Array.isArray(val) ? val : val?.products || val?.data || [];
        if (data.length > 0) setLiveProducts(data);
      }
    } catch (err) {
      console.warn("Live inventory fetch fallback to props:", err);
    } finally {
      setIsLoading(false);
      setHasLoadedData(true);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchLiveInventoryData();
  }, [fetchLiveInventoryData]);

  // Real-time socket sync — ONE shared 300ms debounce across all 4 modules.
  usePageSocketSync(
    ["rawMaterialStock", "finishedGoodsStock", "rawMaterial", "product"],
    fetchLiveInventoryData
  );

  // Refetch live inventory whenever the browser tab gains focus or user returns to page
  useEffect(() => {
    const handleFocus = () => {
      fetchLiveInventoryData();
    };
    window.addEventListener("focus", handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchLiveInventoryData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchLiveInventoryData]);

  // Sync props if parent updates
  useEffect(() => {
    if (initialRawMaterials?.length > 0) {
      setLiveRawMaterials((prev) => (prev.length === 0 ? initialRawMaterials : prev));
      setHasLoadedData(true);
    }
  }, [initialRawMaterials]);

  useEffect(() => {
    if (initialProducts?.length > 0) {
      setLiveProducts((prev) => (prev.length === 0 ? initialProducts : prev));
      setHasLoadedData(true);
    }
  }, [initialProducts]);

  useEffect(() => {
    if (initialRawStocks?.length > 0) {
      setLiveRawStocks((prev) => (prev.length === 0 ? initialRawStocks : prev));
      setHasLoadedData(true);
    }
  }, [initialRawStocks]);

  useEffect(() => {
    if (initialFgStocks?.length > 0) {
      setLiveFgStocks((prev) => (prev.length === 0 ? initialFgStocks : prev));
      setHasLoadedData(true);
    }
  }, [initialFgStocks]);

  // 1. Process All Raw Stock Entries (Separating Standard Raw Materials from Wastage Store)
  const { rawStockItems, wastageStockItems } = useMemo(() => {
    const rmList = liveRawMaterials.length > 0 ? liveRawMaterials : initialRawMaterials;
    const rmStockList = liveRawStocks.length > 0 ? liveRawStocks : initialRawStocks;
    if (!Array.isArray(rmList) || rmList.length === 0) {
      return { rawStockItems: [], wastageStockItems: [] };
    }

    const rawList: any[] = [];
    const wastageList: any[] = [];

    rmList.forEach((rm: any, idx: number) => {
      const name = rm.materialName || rm.name || rm.itemName || `Item #${rm.rawMaterialId || rm.id || idx + 1}`;
      const rmId = String(rm.rawMaterialId || rm.id || "");
      const isWastage = isWastageItem(rm, name);

      // Sum all store stock entries for this item
      const matchingStocks = rmStockList.filter(
        (s: any) =>
          (s.rawMaterialId != null && String(s.rawMaterialId) === rmId) ||
          (s.rawMaterial?.rawMaterialId != null && String(s.rawMaterial.rawMaterialId) === rmId) ||
          (s.rawMaterial?.id != null && String(s.rawMaterial.id) === rmId)
      );

      let hasRealStock = matchingStocks.length > 0;
      let totalStockQty = 0;

      if (hasRealStock) {
        totalStockQty = matchingStocks.reduce(
          (sum: number, s: any) => sum + (Number(s.onHandQty ?? s.currentStock ?? s.quantity ?? 0) || 0),
          0
        );
      } else if (rm.onHandQty !== undefined && rm.onHandQty !== null) {
        totalStockQty = Number(rm.onHandQty ?? rm.currentStock ?? rm.totalQuantity ?? rm.quantity ?? 0) || 0;
      }

      const minStock = Number(rm.minimumStock ?? rm.minStock ?? (isWastage ? 50 : 0));
      const reorderLevel = Number(rm.reorderLevel ?? rm.reorderPoint ?? (isWastage ? 100 : 0));
      const unitPrice = Number(rm.rate || rm.price || rm.unitPrice || rm.standardCost || (isWastage ? 25 : 85));
      const uom = getPrimaryUom(rm.baseUom || rm.uom || "KG", "KG");

      let isCritical = false;
      let isLow = false;
      let status: "CRITICAL" | "REORDER" | "OPTIMAL" = "OPTIMAL";

      if (isWastage) {
        if (reorderLevel > 0 && totalStockQty >= reorderLevel) {
          isLow = true;
          status = "REORDER";
        }
      } else {
        if (minStock > 0 && totalStockQty <= minStock) {
          isCritical = true;
          isLow = true;
          status = "CRITICAL";
        } else if (reorderLevel > 0 && totalStockQty <= reorderLevel) {
          isLow = true;
          status = "REORDER";
        }
      }

      const value = totalStockQty * unitPrice;
      const category = isWastage ? (rm.category?.name || "Plastic Scrap") : extractRawCategory(rm, name);

      const processed = {
        id: rmId || idx,
        name,
        type: isWastage ? "Wastage Store" : "Raw Material",
        category,
        isWastage,
        qty: totalStockQty,
        minStock,
        reorderLevel,
        minLevel: minStock,
        uom,
        unitPrice,
        value,
        isLow,
        isCritical,
        status,
      };

      if (isWastage) {
        wastageList.push(processed);
      } else {
        rawList.push(processed);
      }
    });

    return { rawStockItems: rawList, wastageStockItems: wastageList };
  }, [liveRawMaterials, initialRawMaterials, liveRawStocks, initialRawStocks]);

  // 2. Process Finished Goods
  const finishedStockItems = useMemo(() => {
    const prodList = liveProducts.length > 0 ? liveProducts : initialProducts;
    const fgList = liveFgStocks.length > 0 ? liveFgStocks : initialFgStocks;
    if (!Array.isArray(prodList) || prodList.length === 0) return [];

    return prodList.map((p: any, idx: number) => {
      const name = p.productName || p.name || `Product #${p.id || idx + 1}`;
      const pId = String(p.id ?? p.productId ?? "");

      // Sum all store stock entries for this product
      const matchingFg = fgList.filter(
        (fg: any) =>
          (fg.productItemId != null && String(fg.productItemId) === pId) ||
          (fg.productId != null && String(fg.productId) === pId) ||
          (fg.product?.id != null && String(fg.product.id) === pId) ||
          (fg.product?.productId != null && String(fg.product.productId) === pId)
      );

      let hasRealFgStock = matchingFg.length > 0;
      let totalFgQty = 0;

      if (hasRealFgStock) {
        totalFgQty = matchingFg.reduce(
          (sum: number, fg: any) => sum + (Number(fg.onHandQty ?? fg.currentStock ?? fg.quantity ?? 0) || 0),
          0
        );
      } else if (Array.isArray(p.finishedGoodsStocks) && p.finishedGoodsStocks.length > 0) {
        hasRealFgStock = true;
        totalFgQty = p.finishedGoodsStocks.reduce(
          (sum: number, fg: any) => sum + (Number(fg.onHandQty ?? fg.currentStock ?? fg.quantity ?? 0) || 0),
          0
        );
      } else if (p.onHandQty != null || p.currentStock != null || p.stock != null || p.quantity != null) {
        totalFgQty = Number(p.onHandQty ?? p.currentStock ?? p.stock ?? p.quantity ?? 0) || 0;
      }

      const minStock = Number(p.minimumQty ?? p.minStock ?? p.minimumStock ?? 0);
      const reorderLevel = Number(p.reorderLevel ?? p.reorderPoint ?? 0);
      const unitPrice = Number(p.rate || p.price || p.b2b || p.mrp || 15);
      const dynamicUom =
        matchingFg[0]?.product?.uom?.uomCode ||
        matchingFg[0]?.product?.uom?.name ||
        p.uom?.uomCode ||
        p.uom?.name ||
        p.uomCode ||
        p.baseUom ||
        p.uom ||
        "PCS";
      const uom = getPrimaryUom(dynamicUom, "PCS");

      let isCritical = false;
      let isLow = false;
      let status: "CRITICAL" | "REORDER" | "OPTIMAL" = "OPTIMAL";

      if (minStock > 0 && totalFgQty <= minStock) {
        isCritical = true;
        isLow = true;
        status = "CRITICAL";
      } else if (reorderLevel > 0 && totalFgQty <= reorderLevel) {
        isLow = true;
        status = "REORDER";
      }

      const value = totalFgQty * unitPrice;
      const category = extractProductCategory(p, name);

      return {
        id: pId || idx,
        name,
        type: "Finished Goods",
        category,
        isWastage: false,
        qty: totalFgQty,
        minStock,
        reorderLevel,
        minLevel: minStock,
        uom,
        unitPrice,
        value,
        isLow,
        isCritical,
        status,
      };
    });
  }, [liveProducts, initialProducts, liveFgStocks, initialFgStocks]);

  // 3. System-Wide Reorder Alerts (Monitors Raw Materials & Finished Goods)
  const lowStockAlerts = useMemo(() => {
    // Only Raw Materials and Finished Goods require Reorder Alerts (Wastage is excluded)
    const allCombined = [...rawStockItems, ...finishedStockItems];
    return allCombined
      .filter((item) => item.isLow || item.isCritical)
      .sort((a, b) => {
        if (a.isCritical && !b.isCritical) return -1;
        if (!a.isCritical && b.isCritical) return 1;
        const refA = a.reorderLevel || a.minStock || 1;
        const refB = b.reorderLevel || b.minStock || 1;
        return a.qty / refA - b.qty / refB;
      })
      .slice(0, 10);
  }, [rawStockItems, finishedStockItems]);

  // 4. Aggregated Total Stock Counts
  const totalRawQty = useMemo(() => rawStockItems.reduce((sum, item) => sum + item.qty, 0), [rawStockItems]);
  const totalFgQty = useMemo(() => finishedStockItems.reduce((sum, item) => sum + item.qty, 0), [finishedStockItems]);
  const totalWastageQty = useMemo(() => wastageStockItems.reduce((sum, item) => sum + item.qty, 0), [wastageStockItems]);
  const totalTrackedSKUs = rawStockItems.length + finishedStockItems.length + wastageStockItems.length;

  // 5. Active Tab Full Item List
  const currentTabItems = useMemo(() => {
    if (activeTab === "raw") return rawStockItems;
    if (activeTab === "finished") return finishedStockItems;
    if (activeTab === "wastage") return wastageStockItems;
    return rawStockItems;
  }, [activeTab, rawStockItems, finishedStockItems, wastageStockItems]);

  const totalPages = Math.max(1, Math.ceil(currentTabItems.length / ITEMS_PER_PAGE));

  // Reset page if out of bounds
  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(0);
    }
  }, [currentPage, totalPages]);

  // Auto-slide to next batch every 5.5 seconds if multiple pages exist
  useEffect(() => {
    if (!isAutoRotating || totalPages <= 1) return;
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, 5500);
    return () => clearInterval(interval);
  }, [isAutoRotating, totalPages]);

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  // 6. Paginated Batch of Items for Clean Visual Chart
  const chartData = useMemo(() => {
    const startIdx = currentPage * ITEMS_PER_PAGE;
    const batch = currentTabItems.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    return batch.map((item, idx) => ({
      name: item.name.length > 13 ? item.name.substring(0, 12) + "…" : item.name,
      fullName: item.name,
      quantity: item.qty,
      value: item.value,
      uom: item.uom,
      type: item.type,
      category: item.category,
      minLevel: item.minLevel,
      minStock: item.minStock,
      reorderLevel: item.reorderLevel,
      isLow: item.isLow,
      isCritical: item.isCritical,
      status: item.status,
      color: PALETTE[(startIdx + idx) % PALETTE.length],
    }));
  }, [currentTabItems, currentPage]);

  const currentTabUom = activeTab === "raw" ? "KG" : activeTab === "finished" ? "PCS" : "KG";
  const currentBatchTotal = useMemo(() => chartData.reduce((sum, item) => sum + item.quantity, 0), [chartData]);
  const currentTabTitle = activeTab === "raw" ? "Raw Materials" : activeTab === "finished" ? "Finished Goods" : "Wastage Store";

  const distributionPieData = useMemo(() => {
    return [
      { name: "Raw Materials", value: totalRawQty || 1, color: "#0ea5e9" },
      { name: "Finished Goods", value: totalFgQty || 1, color: "#10b981" },
      { name: "Wastage Store", value: totalWastageQty || 1, color: "#f59e0b" },
    ];
  }, [totalRawQty, totalFgQty, totalWastageQty]);

  return (
    <div className="bg-white dark:bg-card border border-slate-200 dark:border-line-soft rounded-2xl shadow-sm hover:shadow-md overflow-hidden flex flex-col mb-4 sm:mb-6 transition-all">
      {/* ── CARD HEADER ── */}
      <div className="shrink-0 px-3 sm:px-4 py-2.5 sm:py-3.5 border-b border-slate-200/80 dark:border-line-soft flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/70 dark:bg-card-2/40">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 shadow-2xs">
            <FaWarehouse className="text-xs sm:text-sm" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-[13px] font-extrabold uppercase tracking-wider text-slate-900 dark:text-ink flex items-center gap-1.5 sm:gap-2 truncate">
              <span className="truncate">Inventory & Stock Intelligence</span>
              <span className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-black px-1.5 sm:px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/30 uppercase tracking-wider shrink-0">
                <span className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-teal-500 animate-pulse" />
                Live Feed
              </span>
              {isLoading && <FaSync className="animate-spin text-teal-500 text-[10px] shrink-0" />}
            </div>
          </div>
        </div>

        {/* Action Controls: 3 Tabs & Multi-Chart Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Filter Tabs (Persisted to LocalStorage) */}
          <div className="flex items-center bg-slate-100/90 dark:bg-card p-0.5 sm:p-1 rounded-xl border border-slate-200 dark:border-line-soft text-[10px] sm:text-[11px] font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => handleTabChange("raw")}
              className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === "raw" ? "bg-teal-600 text-white shadow-xs font-bold" : "text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink hover:bg-white/70 dark:hover:bg-card-2"
              }`}
            >
              Raw Material
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("finished")}
              className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === "finished" ? "bg-teal-600 text-white shadow-xs font-bold" : "text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink hover:bg-white/70 dark:hover:bg-card-2"
              }`}
            >
              Finished Goods
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("wastage")}
              className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === "wastage" ? "bg-amber-600 text-white shadow-xs font-bold" : "text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink hover:bg-white/70 dark:hover:bg-card-2"
              }`}
            >
              Wastage Store
            </button>
          </div>

          {/* 4 Graph Type Switch Buttons (Persisted to LocalStorage) */}
          <div className="flex items-center bg-slate-100/90 dark:bg-card p-0.5 sm:p-1 rounded-xl border border-slate-200 dark:border-line-soft gap-0.5 sm:gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => handleChartTypeChange("bar")}
              title="Column Chart"
              className={`p-1 sm:p-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === "bar" ? "bg-teal-600 text-white shadow-xs font-bold" : "text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink hover:bg-white/70 dark:hover:bg-card-2"
              }`}
            >
              <FaChartBar className="text-[10px] sm:text-xs" />
            </button>
            <button
              type="button"
              onClick={() => handleChartTypeChange("pie")}
              title="Donut Distribution"
              className={`p-1 sm:p-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === "pie" ? "bg-teal-600 text-white shadow-xs font-bold" : "text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink hover:bg-white/70 dark:hover:bg-card-2"
              }`}
            >
              <FaChartPie className="text-[10px] sm:text-xs" />
            </button>
            <button
              type="button"
              onClick={() => handleChartTypeChange("area")}
              title="Area Trend"
              className={`p-1 sm:p-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === "area" ? "bg-teal-600 text-white shadow-xs font-bold" : "text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink hover:bg-white/70 dark:hover:bg-card-2"
              }`}
            >
              <FaChartLine className="text-[10px] sm:text-xs" />
            </button>
            <button
              type="button"
              onClick={() => handleChartTypeChange("list")}
              title="Matrix Table View"
              className={`p-1 sm:p-1.5 rounded-lg transition-all cursor-pointer ${
                chartType === "list" ? "bg-teal-600 text-white shadow-xs font-bold" : "text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink hover:bg-white/70 dark:hover:bg-card-2"
              }`}
            >
              <FaListUl className="text-[10px] sm:text-xs" />
            </button>
          </div>
        </div>
      </div>

      {/* ── TOP 4 ACTIONABLE INVENTORY SNAPSHOT METRIC CARDS (CLICKABLE) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 p-2.5 sm:p-3.5 border-b border-slate-200/80 dark:border-line-soft bg-slate-50/50 dark:bg-card-2/20">
        {/* 1. Tracked Inventory SKUs */}
        <div
          onClick={() => navigate("/stock")}
          className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-white dark:bg-card border border-slate-200/90 dark:border-line-soft shadow-2xs hover:border-emerald-500 hover:shadow-md hover:bg-slate-50 dark:hover:bg-card-2/50 transition-all cursor-pointer group"
          title="Click to view Stock Ledger"
        >
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
            <FaCheckDouble className="text-xs sm:text-base" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-[10.5px] uppercase font-extrabold text-slate-500 dark:text-ink-muted group-hover:text-slate-900 dark:group-hover:text-ink tracking-wider transition-colors truncate">
              Total SKUs
            </div>
            {isOverallLoading ? (
              <div className="h-5 sm:h-6 w-16 sm:w-20 bg-slate-200 dark:bg-card-2 rounded animate-pulse my-1" />
            ) : (
              <div className="text-sm sm:text-lg font-mono font-black text-slate-900 dark:text-ink mt-0.5 truncate">
                {totalTrackedSKUs} <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-ink-muted font-bold uppercase">Items</span>
              </div>
            )}
            <div className="text-[8.5px] sm:text-[9.5px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 truncate">
              ● Stock Ledger →
            </div>
          </div>
        </div>

        {/* 2. Raw Materials Stock (Physical Qty) -> Navigates to /stock */}
        <div
          onClick={() => navigate("/stock")}
          className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-white dark:bg-card border border-slate-200/90 dark:border-line-soft shadow-2xs hover:border-sky-500 hover:shadow-md hover:bg-slate-50 dark:hover:bg-card-2/50 transition-all cursor-pointer group"
          title="Click to open Raw Material Stock Inventory"
        >
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
            <FaLayerGroup className="text-xs sm:text-base" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-[10.5px] uppercase font-extrabold text-slate-500 dark:text-ink-muted group-hover:text-slate-900 dark:group-hover:text-ink tracking-wider transition-colors truncate">
              Raw Materials
            </div>
            {isOverallLoading ? (
              <div className="h-5 sm:h-6 w-16 sm:w-24 bg-slate-200 dark:bg-card-2 rounded animate-pulse my-1" />
            ) : (
              <div className="text-sm sm:text-lg font-mono font-black text-sky-600 dark:text-sky-400 mt-0.5 truncate">
                {totalRawQty.toLocaleString()} <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-ink-muted font-bold">KG</span>
              </div>
            )}
            <div className="text-[8.5px] sm:text-[9.5px] text-sky-600 dark:text-sky-400 font-semibold mt-0.5 truncate">{isOverallLoading ? "Loading..." : `${rawStockItems.length} materials →`}</div>
          </div>
        </div>

        {/* 3. Finished Goods Stock (Physical Qty) -> Navigates to /finished-stock */}
        <div
          onClick={() => navigate("/finished-stock")}
          className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-white dark:bg-card border border-slate-200/90 dark:border-line-soft shadow-2xs hover:border-teal-500 hover:shadow-md hover:bg-slate-50 dark:hover:bg-card-2/50 transition-all cursor-pointer group"
          title="Click to open Finished Goods Stock Inventory"
        >
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 group-hover:scale-105 transition-transform">
            <FaShoppingBag className="text-xs sm:text-base" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-[10.5px] uppercase font-extrabold text-slate-500 dark:text-ink-muted group-hover:text-slate-900 dark:group-hover:text-ink tracking-wider transition-colors truncate">
              Finished Goods
            </div>
            {isOverallLoading ? (
              <div className="h-5 sm:h-6 w-16 sm:w-24 bg-slate-200 dark:bg-card-2 rounded animate-pulse my-1" />
            ) : (
              <div className="text-sm sm:text-lg font-mono font-black text-teal-600 dark:text-teal-400 mt-0.5 truncate">
                {totalFgQty.toLocaleString()} <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-ink-muted font-bold">PCS</span>
              </div>
            )}
            <div className="text-[8.5px] sm:text-[9.5px] text-teal-600 dark:text-teal-400 font-semibold mt-0.5 truncate">{isOverallLoading ? "Loading..." : `${finishedStockItems.length} products →`}</div>
          </div>
        </div>

        {/* 4. Wastage Scrap Store -> Navigates to /wastage-stock */}
        <div
          onClick={() => navigate("/wastage-stock")}
          className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-white dark:bg-card border border-slate-200/90 dark:border-line-soft shadow-2xs hover:border-amber-500 hover:shadow-md hover:bg-slate-50 dark:hover:bg-card-2/50 transition-all cursor-pointer group"
          title="Click to open Wastage & Scrap Stock Inventory"
        >
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
            <FaRecycle className="text-xs sm:text-base" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] sm:text-[10.5px] uppercase font-extrabold text-slate-500 dark:text-ink-muted group-hover:text-slate-900 dark:group-hover:text-ink tracking-wider transition-colors truncate">
              Wastage Store
            </div>
            {isOverallLoading ? (
              <div className="h-5 sm:h-6 w-16 sm:w-24 bg-slate-200 dark:bg-card-2 rounded animate-pulse my-1" />
            ) : (
              <div className="text-sm sm:text-lg font-mono font-black text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                {totalWastageQty.toLocaleString()} <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-ink-muted font-bold">KG</span>
              </div>
            )}
            <div className="text-[8.5px] sm:text-[9.5px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5 truncate">{isOverallLoading ? "Loading..." : `${wastageStockItems.length} scrap items →`}</div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT SPLIT: LEFT 2/3 (CHARTS + AUTO-ROTATING BATCHING) & RIGHT 1/3 (REORDER ALERTS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-line-soft">
        {/* LEFT 2/3: Dynamic Visual Charts with Auto-Batching Pagination */}
        <div
          className="lg:col-span-2 p-2.5 sm:p-4 flex flex-col justify-between min-h-[320px] sm:min-h-[440px]"
          onMouseEnter={() => setIsAutoRotating(false)}
          onMouseLeave={() => setIsAutoRotating(true)}
        >
          {/* Batch Carousel Navigation Sub-header (when items > 7) */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2 px-1 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 dark:text-ink truncate">
                  Batch {currentPage + 1} of {totalPages}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-ink-muted font-mono truncate">
                  ({currentPage * ITEMS_PER_PAGE + 1}–{Math.min((currentPage + 1) * ITEMS_PER_PAGE, currentTabItems.length)} of {currentTabItems.length})
                </span>
              </div>

              {/* Controls: Prev, Next, Play/Pause */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-card-2/60 border border-slate-200 dark:border-line-soft px-1.5 py-0.5 rounded-lg shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  className="p-1 text-slate-500 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink rounded cursor-pointer transition-colors"
                  title="Previous batch"
                >
                  <FaChevronLeft className="text-[9px]" />
                </button>

                {/* Page Dot Indicators */}
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentPage(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                        i === currentPage
                          ? "bg-teal-500 w-3 shadow-[0_0_6px_#14b8a6]"
                          : "bg-slate-300 dark:bg-ink-muted/30 hover:bg-slate-400 dark:hover:bg-ink-muted/60"
                      }`}
                      title={`Batch ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleNextPage}
                  className="p-1 text-slate-500 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink rounded cursor-pointer transition-colors"
                  title="Next batch"
                >
                  <FaChevronRight className="text-[9px]" />
                </button>

                <div className="w-[1px] h-3 bg-slate-200 dark:bg-line-soft mx-0.5" />

                <button
                  type="button"
                  onClick={() => setIsAutoRotating((prev) => !prev)}
                  className={`p-1 rounded cursor-pointer transition-colors ${
                    isAutoRotating ? "text-teal-600 dark:text-teal-400 font-bold" : "text-slate-500 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink"
                  }`}
                  title={isAutoRotating ? "Auto-sliding active (Click to Pause)" : "Paused (Click to Auto-slide)"}
                >
                  {isAutoRotating ? <FaPause className="text-[8px]" /> : <FaPlay className="text-[8px]" />}
                </button>
              </div>
            </div>
          )}

          {isOverallLoading ? (
            <div className="w-full h-[280px] sm:h-[380px] flex flex-col justify-between p-3 animate-pulse">
              <div className="flex items-end justify-between gap-3 h-[220px] sm:h-[300px] px-3 pt-4 border-b border-line-soft/40">
                {[60, 85, 45, 75, 90, 50, 70].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                    <div className="w-full max-w-[28px] bg-teal-500/20 rounded-t" style={{ height: `${h}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-3 pt-2">
                {[1, 2, 3, 4, 5, 6, 7].map((_, i) => (
                  <div key={i} className="h-2.5 w-8 sm:w-10 bg-slate-200 dark:bg-card-2 rounded" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {chartType === "bar" && (
                <div className="w-full h-[280px] sm:h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 15, right: 15, left: -15, bottom: 35 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.18)" />
                      <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: "currentColor" }} angle={-25} textAnchor="end" height={40} interval={0} />
                      <YAxis tick={{ fontSize: 9.5, fill: "currentColor" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card, #ffffff)",
                          borderColor: "var(--color-line-soft, #cbd5e1)",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                          color: "var(--color-ink, #0f172a)",
                          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
                        }}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                        formatter={(val: any, name: any, props: any) => [
                          `${Number(val).toLocaleString()} ${props.payload.uom || "Units"}`,
                          props.payload.fullName || props.payload.name || "Live Stock",
                        ]}
                      />
                      <Bar dataKey="quantity" fill="#0ea5e9" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {chartType === "pie" && (
                <div className="w-full min-h-[280px] sm:min-h-[380px] grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  {/* Left Donut Wheel */}
                  <div className="sm:col-span-6 h-[220px] sm:h-[350px] relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--color-card, #ffffff)",
                            borderColor: "var(--color-line-soft, #cbd5e1)",
                            borderRadius: "0.75rem",
                            fontSize: "11px",
                            color: "var(--color-ink, #0f172a)",
                            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
                          }}
                          formatter={(val: any, name: any, props: any) => {
                            const total = currentBatchTotal || 1;
                            const pct = ((Number(val) / total) * 100).toFixed(1);
                            return [
                              `${Number(val).toLocaleString()} ${props.payload.uom || "Units"} (${pct}%)`,
                              props.payload.fullName || props.payload.name || "Stock Item",
                            ];
                          }}
                        />
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={4}
                          dataKey="quantity"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-pie-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Central Donut Hub with Real Live Batch Total */}
                    <div className="absolute text-center pointer-events-none px-2">
                      <div className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 dark:text-ink-muted uppercase tracking-wider">
                        {currentTabTitle}
                      </div>
                      <div className="text-sm sm:text-base font-mono font-black text-slate-900 dark:text-ink">
                        {currentBatchTotal.toLocaleString()} <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-ink-muted">{currentTabUom}</span>
                      </div>
                      <div className="text-[8.5px] sm:text-[9.5px] text-teal-600 dark:text-teal-400 font-bold">
                        Batch {currentPage + 1}/{totalPages}
                      </div>
                    </div>
                  </div>

                  {/* Right Side Item Legend List with Badges */}
                  <div className="sm:col-span-6 max-h-[220px] sm:max-h-[350px] overflow-y-auto pr-1 space-y-1.5">
                    {chartData.map((item, idx) => {
                      const pct = currentBatchTotal > 0 ? ((item.quantity / currentBatchTotal) * 100).toFixed(1) : "0";
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-slate-50/80 dark:bg-card-2/50 border border-slate-200/80 dark:border-line-soft hover:bg-slate-100 dark:hover:bg-card-2 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-2">
                            <span
                              className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-bold text-slate-800 dark:text-ink truncate text-[10px] sm:text-[11px]" title={item.fullName}>
                              {item.fullName}
                            </span>
                          </div>
                          <div className="text-right shrink-0 font-mono">
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-900 dark:text-ink">
                              {item.quantity.toLocaleString()} {item.uom}
                            </span>
                            <span className="text-[8.5px] sm:text-[9.5px] text-slate-500 dark:text-ink-muted ml-1 sm:ml-1.5 font-bold">({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {chartType === "area" && (
                <div className="w-full h-[280px] sm:h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -15, bottom: 35 }}>
                      <defs>
                        <linearGradient id="colorStockVal" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor={activeTab === "raw" ? "#0ea5e9" : activeTab === "finished" ? "#10b981" : "#f59e0b"}
                            stopOpacity={0.45}
                          />
                          <stop
                            offset="95%"
                            stopColor={activeTab === "raw" ? "#0ea5e9" : activeTab === "finished" ? "#10b981" : "#f59e0b"}
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.18)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "currentColor" }} angle={-25} textAnchor="end" height={40} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: "currentColor" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card, #ffffff)",
                          borderColor: "var(--color-line-soft, #cbd5e1)",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                          color: "var(--color-ink, #0f172a)",
                          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
                        }}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                        formatter={(val: any, name: any, props: any) => [
                          `${Number(val).toLocaleString()} ${props.payload.uom || "Units"}`,
                          props.payload.fullName || props.payload.name || "Stock Level",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="quantity"
                        stroke={activeTab === "raw" ? "#0ea5e9" : activeTab === "finished" ? "#10b981" : "#f59e0b"}
                        strokeWidth={2.5}
                        dot={{
                          r: 4,
                          fill: activeTab === "raw" ? "#0ea5e9" : activeTab === "finished" ? "#10b981" : "#f59e0b",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        activeDot={{
                          r: 7,
                          fill: activeTab === "raw" ? "#0ea5e9" : activeTab === "finished" ? "#10b981" : "#f59e0b",
                          stroke: "#fff",
                          strokeWidth: 2,
                        }}
                        fillOpacity={1}
                        fill="url(#colorStockVal)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {chartType === "list" && (
                <div className="w-full h-[380px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/90 dark:bg-card-2 text-slate-700 dark:text-ink-subtle uppercase text-[9.5px] font-black tracking-wider sticky top-0 border-b border-slate-200 dark:border-line-soft z-10">
                      <tr>
                        <th className="px-3 py-2 bg-slate-100/95 dark:bg-card-2 text-slate-700 dark:text-ink-subtle font-extrabold">Item Name</th>
                        <th className="px-2 py-2 bg-slate-100/95 dark:bg-card-2 text-slate-700 dark:text-ink-subtle font-extrabold">Category</th>
                        <th className="px-2 py-2 bg-slate-100/95 dark:bg-card-2 text-slate-700 dark:text-ink-subtle font-extrabold text-right">Live Stock</th>
                        <th className="px-3 py-2 bg-slate-100/95 dark:bg-card-2 text-slate-700 dark:text-ink-subtle font-extrabold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-line-soft">
                      {chartData.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-card-2/60 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-ink truncate max-w-[150px]" title={item.fullName}>
                            {item.fullName}
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-card-2 border border-slate-200 dark:border-line-soft text-slate-700 dark:text-ink">
                              {item.category || item.type}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-ink">
                            {item.quantity.toLocaleString()} {item.uom}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold">
                            {item.status === "CRITICAL" ? (
                              <span className="text-[9.5px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30 uppercase">
                                Critical ({item.quantity.toLocaleString()} &le; {item.minStock})
                              </span>
                            ) : item.status === "REORDER" || item.status === "LOW STOCK" ? (
                              <span className="text-[9.5px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30 uppercase">
                                Reorder ({item.quantity.toLocaleString()} &le; {item.reorderLevel || item.minStock})
                              </span>
                            ) : (
                              <span className="text-[9.5px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 uppercase">
                                Optimal
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT 1/3: System-Wide Inventory Reorder Alerts Sub-panel (Monitors Raw Material & FG) */}
        <div className="lg:col-span-1 p-3.5 flex flex-col justify-between bg-slate-50/50 dark:bg-card-2/10">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-ink">
                <FaExclamationTriangle className="text-amber-500 text-xs" />
                <span>Reorder Alerts</span>
              </div>
              {isOverallLoading ? (
                <span className="inline-flex items-center gap-1.5 text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-card-2 dark:text-ink-muted border border-slate-200 dark:border-line-soft uppercase tracking-wider">
                  <FaSync className="animate-spin text-teal-500 text-[8px]" />
                  Checking...
                </span>
              ) : (
                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    lowStockAlerts.length > 0
                      ? "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"
                  }`}
                >
                  {lowStockAlerts.length} Action Needed
                </span>
              )}
            </div>

            {/* List of Low Stock items across Raw Materials & Finished Goods */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {isOverallLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-2.5 shadow-2xs">
                    <FaSync className="animate-spin text-sm" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-ink">Checking Stock Levels...</p>
                  <p className="text-[10px] text-slate-500 dark:text-ink-muted mt-0.5 mb-3">Scanning stores for reorder and minimum limits</p>
                  
                  {/* Subtle Loading Pulse Skeleton Placeholders */}
                  <div className="w-full space-y-2">
                    <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-line-soft bg-slate-50 dark:bg-card-2/50 animate-pulse">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="h-3 bg-slate-200 dark:bg-card rounded w-24" />
                        <div className="h-3 bg-slate-200 dark:bg-card rounded w-12" />
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-card rounded w-16 mb-2" />
                      <div className="h-1.5 bg-slate-200 dark:bg-card rounded w-full" />
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-line-soft bg-slate-50 dark:bg-card-2/50 animate-pulse opacity-60">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="h-3 bg-slate-200 dark:bg-card rounded w-28" />
                        <div className="h-3 bg-slate-200 dark:bg-card rounded w-12" />
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-card rounded w-20 mb-2" />
                      <div className="h-1.5 bg-slate-200 dark:bg-card rounded w-full" />
                    </div>
                  </div>
                </div>
              ) : lowStockAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-ink-subtle">
                  <FaCheckCircle className="text-emerald-500 text-3xl mb-2 opacity-70" />
                  <p className="text-sm font-bold text-slate-800 dark:text-ink">All Stock Levels Healthy</p>
                  <p className="text-xs text-slate-500 dark:text-ink-muted mt-1">Every Raw Material & FG is within safety limits</p>
                </div>
              ) : (
                lowStockAlerts.map((item, idx) => {
                  const targetRef = item.reorderLevel || item.minStock || 1;
                  const pct = Math.min((item.qty / targetRef) * 100, 100);
                  const isCritical = item.isCritical;
                  const targetRoute = item.type === "Finished Goods" ? "/finished-stock" : "/stock";

                  return (
                    <div
                      key={idx}
                      onClick={() => navigate(targetRoute)}
                      className={`p-2.5 rounded-xl border transition-colors cursor-pointer shadow-2xs ${
                        isCritical
                          ? "bg-rose-50/90 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-950 dark:text-white hover:bg-rose-100/80 dark:hover:bg-rose-500/20 hover:border-rose-400"
                          : "bg-amber-50/90 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-950 dark:text-white hover:bg-amber-100/80 dark:hover:bg-amber-500/20 hover:border-amber-400"
                      }`}
                      title={`Click to view ${item.name} in ${item.type}`}
                    >
                      <div className="flex items-center justify-between mb-1 gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11.5px] font-bold text-slate-900 dark:text-ink truncate max-w-[125px]" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Store Pill Badge */}
                          <span
                            className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                              item.type === "Finished Goods"
                                ? "bg-teal-200/80 text-teal-900 dark:bg-teal-500/30 dark:text-teal-300"
                                : "bg-sky-200/80 text-sky-900 dark:bg-sky-500/30 dark:text-sky-300"
                            }`}
                          >
                            {item.type === "Finished Goods" ? "FG" : "Raw"}
                          </span>
                          {/* Status Pill Badge */}
                          <span
                            className={`text-[8px] font-black px-1.5 py-0.2 rounded uppercase ${
                              isCritical
                                ? "bg-rose-500 text-white"
                                : "bg-amber-500 text-slate-950 font-black"
                            }`}
                          >
                            {isCritical ? "CRITICAL" : "REORDER"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 dark:text-ink-muted mb-1.5">
                        <span>
                          Current: <strong className="text-slate-900 dark:text-ink">{item.qty.toLocaleString()}</strong> {item.uom}
                        </span>
                        <span>
                          {item.reorderLevel && item.minStock && item.reorderLevel !== item.minStock
                            ? `Min: ${item.minStock} | Reorder: ${item.reorderLevel} ${item.uom}`
                            : isCritical
                            ? `Min: ${item.minStock} ${item.uom}`
                            : `Reorder: ${item.reorderLevel || item.minStock} ${item.uom}`}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200/90 dark:bg-black/40 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCritical
                              ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                              : "bg-amber-500 shadow-[0_0_8px_#f59e0b]"
                          }`}
                          style={{ width: `${Math.max(pct, 12)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
