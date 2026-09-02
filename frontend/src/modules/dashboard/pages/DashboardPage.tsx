

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageSocketSync } from "../../../hooks/usePageSocketSync";
import dashboardService, { type AccountsSummary } from "../../../services/dashboardService";
import { useListCache } from "../../../hooks/useListCache";

// Recharts
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line,
} from "recharts";

// Icons
import {
  FaBoxes, FaCalendarCheck, FaCogs, FaCubes,
  FaLayerGroup, FaBoxOpen, FaUsers, FaUserTie,
  FaShoppingCart, FaTruck, FaChartLine, FaClock,
  FaMoneyBillWave, FaCalendarAlt, FaHourglassHalf, FaUserFriends,
  FaArrowUp, FaArrowDown, FaHandHoldingUsd, FaFileInvoiceDollar,
  FaUniversity, FaWarehouse, FaCheckCircle, FaTimesCircle, FaSync, FaMapMarkerAlt, FaTimes,
  FaChartBar, FaChartPie, FaListUl, FaArrowLeft, FaArrowRight, FaPlus, FaSearch, FaBox,
  FaBell, FaExclamationTriangle, FaExclamationCircle, FaInfoCircle, FaChevronRight,
} from "react-icons/fa";
import { LuLayoutDashboard } from "react-icons/lu";
import { FiTrendingUp, FiTrendingDown, FiMoreVertical } from "react-icons/fi";

import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { SparklineCard } from "../components/SparklineCard";
import SalesPurchaseTrendChart from "../components/SalesPurchaseTrendChart";
import { SalesPersonLiveMap } from "../components/SalesPersonLiveMap";
import { InventoryStockIntelligence } from "../components/InventoryStockIntelligence";
import { WorkforceShiftAttendance } from "../components/WorkforceShiftAttendance";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../components/ui/chart";
import { usePermission } from "../../../hooks/usePermission";

/* ════════════════════════════════════════════════════════════════
   COLOUR PALETTE
   ════════════════════════════════════════════════════════════════ */
const PALETTE = {
  blue: "#3b82f6",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#ef4444",
  indigo: "#6366f1",
  pink: "#ec4899",
  teal: "#14b8a6",
  orange: "#f97316",
};

const PIE_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ec4899", "#8b5cf6", "#f43f5e", "#14b8a6"
];

const inventoryChartConfig = {
  "Finished Goods": { label: "Finished Goods", color: PALETTE.amber },
  "Raw Materials": { label: "Raw Materials", color: PALETTE.rose },
  "Other": { label: "Other", color: PALETTE.blue },
} satisfies ChartConfig;

/* ════════════════════════════════════════════════════════════════
   REUSABLE PRIMITIVES
   ════════════════════════════════════════════════════════════════ */



/* ════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ════════════════════════════════════════════════════════════════ */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { can, isSuperAdmin } = usePermission();
  const [selectedCustomerReport, setSelectedCustomerReport] = useState<{
    customer: string;
    type: "purchased" | "notPurchased";
  } | null>(null);
  const [customerProductSearch, setCustomerProductSearch] = useState("");
  const [topProductsChartType, setTopProductsChartType] = useState<"list" | "bar" | "pie">(() => {
    try {
      const saved = localStorage.getItem("dashboard_top_products_chart_type");
      if (saved && ["list", "bar", "pie"].includes(saved)) {
        return saved as "list" | "bar" | "pie";
      }
    } catch (e) {}
    return "list";
  });

  const handleTopProductsChartTypeChange = (newType: "list" | "bar" | "pie") => {
    setTopProductsChartType(newType);
    try {
      localStorage.setItem("dashboard_top_products_chart_type", newType);
    } catch (e) {}
  };

  // Dashboard widget visibility — super admin always sees everything
  const showOverview     = isSuperAdmin || can("dash-overview.view");
  const showTrend        = isSuperAdmin || can("dash-trend.view");
  const showTasks        = isSuperAdmin || can("dash-tasks.view");
  const showInventory    = isSuperAdmin || can("dash-inventory.view");
  const showMachines     = isSuperAdmin || can("dash-machines.view");
  const showTopProducts  = isSuperAdmin || can("dash-top-products.view");
  const showRecentSales  = isSuperAdmin || can("dash-recent-sales.view");

  // ─────────────────────────────────────────────────────────────
  //  DASHBOARD SUMMARY — cache-first (no full-page Loading spinner)
  //  Same pattern used across all accounts pages: cached data shows
  //  instantly on repeat visits, silent background refetch keeps it fresh,
  //  socket events invalidate and refetch in the background.
  // ─────────────────────────────────────────────────────────────
  const dashboardFetcher = useCallback(async (_signal: AbortSignal) => {
    const data = await dashboardService.getSummary();
    return { data: [data], total: 1 };
  }, []);

  const dashboardCache = useListCache<any>({
    cacheKey: "dashboard:summary",
    socketModule: "salesOrder",
    fetcher: dashboardFetcher,
  });
  const dashData = dashboardCache.data[0] || {};
  const refreshDashboard = dashboardCache.refresh;

  // Derive the individual arrays from the cached payload. Empty arrays fall
  // through cleanly during cold-load; downstream useMemos handle that.
  const salesOrders = dashData.salesOrders || [];
  const purchaseOrders = dashData.purchaseOrders || [];
  const productionOrders = dashData.productionOrders || [];
  const dailyPlans = dashData.dailyPlans || [];
  const finishedGoodsStocks = dashData.finishedGoodsStocks || [];
  const rawMaterialStocks = dashData.rawMaterialStocks || [];
  const machines = dashData.machines || [];
  const weeklyPrograms = dashData.weeklyPrograms || [];
  const rawMaterials = dashData.rawMaterials || [];
  const allProducts = dashData.products || [];
  const allSalesProducts = dashData.salesProducts || [];
  const allCustomers = dashData.customers || [];
  const productsCount = dashData.productsCount || (Array.isArray(allProducts) ? allProducts.length : 0);
  const employeesCount = dashData.employeesCount || 0;
  const salesInvoices = dashData.salesInvoices || [];
  const purchaseInvoices = dashData.purchaseInvoices || [];
  void rawMaterialStocks; // reserved for future use

  // ── Real-time socket refresh on any relevant change ─────────
  // Single 300ms debounce shared across all modules — prevents up to 5
  // independent refetches when one save touches multiple collections.
  usePageSocketSync(
    ["purchaseOrder", "productionOrder", "dailyPlan", "finishedGoodsStock", "rawMaterialStock", "salesOrder", "salesInvoice", "grnInvoice"],
    refreshDashboard
  );

  // ─────────────────────────────────────────────────────────────
  //  ACCOUNTS SUMMARY — 6 top cards + Alerts + Recent Transactions
  //  Uses useListCache so it is auto-tracked by the global prefetch
  //  progress bar and gets prefetched on app boot. Multiple socket
  //  listeners keep it fresh in realtime as vouchers are posted.
  // ─────────────────────────────────────────────────────────────
  const accountsSummaryFetcher = useCallback(async (_signal: AbortSignal) => {
    const summary = await dashboardService.getAccountsSummary();
    return { data: [summary], total: 1 };
  }, []);

  const accountsSummaryCache = useListCache<AccountsSummary>({
    cacheKey: "accounts:dashboard-summary",
    socketModule: "voucher",
    fetcher: accountsSummaryFetcher,
  });
  const accSummaryList = accountsSummaryCache.data;
  const isSyncingAccounts = accountsSummaryCache.refreshing;
  const refreshAccountsSummary = accountsSummaryCache.refresh;
  const accountsSummary = accSummaryList[0] || null;

  usePageSocketSync(
    ["payment", "journalItem", "accountLedger", "salesInvoice", "grnInvoice", "pettyCashEntry"],
    refreshAccountsSummary
  );

  /* ─── ACCOUNTS CARD TRENDS ──────────────────────────────────── */
  const cardTrends = useMemo(() => {
    if (!accountsSummary) return { sales: "neutral", purchase: "neutral", receivable: "neutral", payable: "neutral", cash: "neutral", bank: "neutral" } as const;

    const txns = accountsSummary.recentTransactions || [];

    const getTrend = (type: string): "up" | "down" | "neutral" => {
      const filtered = txns.filter((t: any) => t.type === type);
      if (filtered.length < 2) return "neutral";
      return filtered[0].amount >= filtered[1].amount ? "up" : "down";
    };

    const cashTrend: "up" | "down" | "neutral" =
      accountsSummary.todayReceipts > accountsSummary.todayPayments ? "up"
      : accountsSummary.todayReceipts < accountsSummary.todayPayments ? "down"
      : "neutral";

    return {
      sales: getTrend("SALES"),
      purchase: getTrend("PURCHASE"),
      receivable: getTrend("RECEIPT"),
      payable: getTrend("PAYMENT"),
      cash: cashTrend,
      bank: cashTrend,
    };
  }, [accountsSummary]);

  /* ─── DERIVED DATA ────────────────────────────────────────── */
  const safe = (d: any) => (Array.isArray(d) ? d : []);

  // Top stats
  const topStats = useMemo(() => {
    const po = safe(productionOrders);
    const so = safe(salesOrders);
    const purc = safe(purchaseOrders);
    const mach = safe(machines);
    const wp = safe(weeklyPrograms);
    const totalFinished = po.reduce((a: number, o: any) => a + (Number(o.producedQty) || 0), 0);

    const totalRevenue = so.reduce((acc: number, s: any) => acc + (Number(s.netAmount) || 0), 0);
    
    // Calculate last month revenue
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const lastMonthRevenue = so
      .filter((s: any) => {
        const d = new Date(s.createdAt || s.orderDate);
        return !isNaN(d.getTime()) && d >= lastMonthStart && d <= lastMonthEnd;
      })
      .reduce((acc: number, s: any) => acc + (Number(s.netAmount) || 0), 0);

    // Pending amount = sum of (grandTotal - totalPaid) across all non-cancelled invoices
    const pendingAmount = safe(salesInvoices).reduce((acc: number, inv: any) => {
      const payments = Array.isArray(inv.payments) ? inv.payments : (typeof inv.payments === "string" ? JSON.parse(inv.payments || "[]") : []);
      const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const balanceDue = Math.max(0, Number(inv.grandTotal) - totalPaid);
      return acc + balanceDue;
    }, 0);
    const uniqueCustomers = new Set(so.filter((s: any) => s.customer).map((s: any) => s.customer?.id || s.customer?.firmName)).size;

    return {
      salesOrders: so.length,
      purchaseOrders: purc.length,
      productionOrders: po.length,
      weeklySchedules: wp.length,
      machines: mach.length,
      products: productsCount,
      rawMaterials: rawMaterials.length,
      finishedGoods: totalFinished,
      employees: employeesCount,
      totalRevenue,
      lastMonthRevenue,
      pendingAmount,
      uniqueCustomers,
    };
  }, [productionOrders, salesOrders, purchaseOrders, rawMaterials, machines, weeklyPrograms, productsCount, employeesCount, salesInvoices]);

  // Today's Tasks Stats
  const todayStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isToday = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    };

    const poToday = safe(productionOrders).filter((o: any) => isToday(o.createdAt || o.orderDate));
    const soToday = safe(salesOrders).filter((o: any) => isToday(o.createdAt || o.orderDate));
    const puToday = safe(purchaseOrders).filter((o: any) => isToday(o.createdAt || o.orderDate));
    const wpToday = safe(weeklyPrograms).filter((w: any) => isToday(w.createdAt || w.startDate || w.date || w.scheduleDate));
    const dpToday = safe(dailyPlans).filter((p: any) => isToday(p.productionDate || p.date || p.createdAt));
    const pendingCount = safe(salesOrders).filter((s: any) => s.status === 'DRAFT' || s.status === 'PENDING').length +
      safe(purchaseOrders).filter((p: any) => p.status === 'DRAFT' || p.status === 'PENDING').length;

    return {
      production: poToday.length,
      sales: soToday.length,
      purchase: puToday.length,
      schedules: wpToday.length,
      pending: pendingCount,
      tasksList: dpToday,
    };
  }, [productionOrders, salesOrders, purchaseOrders, weeklyPrograms, dailyPlans]);

  // Production status counts
  const prodStatusData = useMemo(() => {
    const po = safe(productionOrders);
    const counts: Record<string, number> = {};
    po.forEach((o: any) => {
      const s = o.status?.toUpperCase() || "PLANNED";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [productionOrders]);

  // Sales status doughnut
  const salesStatusData = useMemo(() => {
    const so = safe(salesOrders);
    const counts: Record<string, number> = {};
    so.forEach((o: any) => { counts[o.status || "DRAFT"] = (counts[o.status || "DRAFT"] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value], i) => ({ name: name.replace(/_/g, " "), value, color: PIE_COLORS[i % PIE_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [salesOrders]);

  // Purchase status doughnut
  const purchaseStatusData = useMemo(() => {
    const po = safe(purchaseOrders);
    const counts: Record<string, number> = {};
    po.forEach((o: any) => { counts[o.status || "DRAFT"] = (counts[o.status || "DRAFT"] || 0) + 1; });
    return Object.entries(counts)
      .map(([name, value], i) => ({ name: name.replace(/_/g, " "), value, color: PIE_COLORS[(i + 3) % PIE_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [purchaseOrders]);

  // Inventory breakdown doughnut (Stock by Store)
  const formatUom = (uomStr: string | undefined) => {
    if (!uomStr) return "";
    let code = uomStr.trim();
    if (code.toUpperCase() === "EA" || code.toUpperCase() === "EACH") return "PCS";
    if (code.includes(",")) code = code.split(",")[0].trim();
    return code;
  };

  const inventoryData = useMemo(() => {
    const rm = safe(rawMaterials);
    const itemMap: Record<string, { qty: number, storeName: string, productName: string, uom: string }> = {};

    // Process Raw Materials
    rm.forEach((item: any) => {
      const storeName = item.store?.storeName || "Main Warehouse";
      const qty = Number(item.onHandQty) || 0;
      const productName = item.materialName || item.rawMaterial?.materialName || "Unknown RM";
      const uom = formatUom(item.baseUom || item.rawMaterial?.baseUom);
      const key = `${storeName}::${productName}`;
      
      if (!itemMap[key]) {
        itemMap[key] = { qty: 0, storeName, productName, uom };
      }
      itemMap[key].qty += qty;
    });

    const data = Object.entries(itemMap)
      .map(([key, obj], i) => ({
        name: obj.productName,
        storeName: obj.storeName,
        value: 1, // Equal slice for each unique item
        displayValue: `${obj.qty} ${obj.uom}`.trim(),
        products: obj.storeName,
        color: PIE_COLORS[i % PIE_COLORS.length],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return data.length > 0 ? data : [{ name: "No Stock", storeName: "", value: 1, displayValue: "0", products: "", color: "#cbd5e1" }];
  }, [rawMaterials]);




  // Machine utilization list
  const machineList = useMemo(() => {
    const m = safe(machines);
    const wp = safe(weeklyPrograms);
    return m.slice(0, 5).map((mac: any) => {
      const jobs = wp.filter((w: any) => w.machineId === mac.machineId || w.machine?.machineId === mac.machineId);
      return { name: mac.machineName, jobs: jobs.length, status: mac.status || "Active" };
    });
  }, [machines, weeklyPrograms]);

  // Production priority bar chart
  const priorityData = useMemo(() => {
    const po = safe(productionOrders);
    const map: Record<string, number> = { Urgent: 0, High: 0, Medium: 0, Low: 0 };
    po.forEach((o: any) => {
      const p = (o.priority || "Medium").charAt(0).toUpperCase() + (o.priority || "Medium").slice(1).toLowerCase();
      if (map[p] !== undefined) map[p]++;
      else map["Medium"]++;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [productionOrders]);

  const topProducts = useMemo(() => {
    const fg = safe(finishedGoodsStocks);
    
    // Group stocks by product name
    const grouped = fg.reduce((acc: Record<string, number>, curr: any) => {
      const name = curr.product?.productName || curr.productItem?.productName || "Unknown";
      acc[name] = (acc[name] || 0) + (Number(curr.onHandQty) || 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [finishedGoodsStocks]);

  const topProductsTotal = useMemo(() => {
    return topProducts.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  }, [topProducts]);

  const topProductsWithColors = useMemo(() => {
    return topProducts.map((item, idx) => ({
      ...item,
      color: PIE_COLORS[idx % PIE_COLORS.length],
      percent: topProductsTotal > 0 ? item.value / topProductsTotal : 0,
    }));
  }, [topProducts, topProductsTotal]);

  // Recent orders
  const recentSales = useMemo(() => {
    return safe(salesOrders)
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [salesOrders]);

  // Customer Purchase Report — per-customer: which sales products purchased vs not purchased
  const customerPurchaseReport = useMemo(() => {
    const so = safe(salesOrders);
    const salesProducts = safe(allSalesProducts);
    const customers = safe(allCustomers);
    const productNames = salesProducts
      .map((p: any) => p.salesProductName || p.name || "")
      .filter(Boolean);
    const totalProducts = productNames.length;

    // Build: { customerName → Set of purchased sales product names }
    const customerProducts: Record<string, Set<string>> = {};
    for (const order of so) {
      const cName = order.customer?.firmName || "Unknown";
      if (!customerProducts[cName]) customerProducts[cName] = new Set();
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        // Prefer salesProduct name; fall back to product name for legacy orders
        const pName =
          item.salesProduct?.salesProductName ||
          item.salesProductName ||
          "";
        if (pName) customerProducts[cName].add(pName);
      }
    }

    // Build result for ALL customers (including those with 0 orders)
    const seen = new Set<string>();
    const result: Array<{ name: string; purchasedProducts: string[]; notPurchasedProducts: string[] }> = [];

    // Customers from master
    for (const c of customers) {
      const cName = c.firmName || "";
      if (!cName) continue;
      seen.add(cName);
      const purchased = customerProducts[cName] || new Set<string>();
      const purchasedList = productNames.filter((p: string) => purchased.has(p));
      const notPurchasedList = productNames.filter((p: string) => !purchased.has(p));
      result.push({ name: cName, purchasedProducts: purchasedList, notPurchasedProducts: notPurchasedList });
    }
    // Customers from orders not in master (edge case)
    for (const [cName, purchased] of Object.entries(customerProducts)) {
      if (seen.has(cName)) continue;
      const purchasedList = productNames.filter((p: string) => purchased.has(p));
      const notPurchasedList = productNames.filter((p: string) => !purchased.has(p));
      result.push({ name: cName, purchasedProducts: purchasedList, notPurchasedProducts: notPurchasedList });
    }

    return { totalProducts, customers: result.sort((a, b) => b.purchasedProducts.length - a.purchasedProducts.length || a.name.localeCompare(b.name)) };
  }, [salesOrders, allSalesProducts, allCustomers]);

  /* ═══════════════ RENDER ═══════════════ */
  // Cache-first render: no full-page CommonLoader anymore. On first cold visit
  // cards may briefly show ₹0 / empty until the background fetch resolves.
  // On repeat visits data appears instantly from cache. The "Syncing…" pill in
  // the header signals when a silent background refresh is in flight.
  return (
    <div className="bg-page flex flex-col min-h-0" style={{ height: "calc(100vh - 100px)" }}>

      {/* ── SCROLLABLE MAIN CONTENT ─────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-3 sm:px-6 sm:py-4 lg:px-8">

        {/* ── NON-STICKY HEADER ───── */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-ink">
              Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {isSyncingAccounts && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-xs">
                <FaSync className="animate-spin text-[10px]" /> Syncing…
              </span>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
           ROW 0  –  ACCOUNTS SUMMARY (Busy-style)
           6 stat cards + Quick Actions + Alerts + Recent Txns
           ══════════════════════════════════════════════════════ */}
        {accountsSummary && (
          <>
            {/* 6 Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-3 sm:mb-4">

              {/* TOTAL SALES */}
              <button
                onClick={() => navigate("/sales-invoices")}
                className="relative text-left rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1"
                style={{ background: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)", border: "1px solid rgba(52,211,153,0.25)" }}
              >
                {/* Bottom-right corner white shade on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                  style={{ background: "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)" }} />
                {/* BG Icon — visible, scales on hover */}
                <FaArrowUp
                  className="absolute -right-3 -bottom-2 text-white/20 group-hover:text-white/35 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 pointer-events-none select-none"
                  style={{ fontSize: "5.5rem" }}
                />
                <div className="relative z-10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-200">Total Sales</span>
                    {cardTrends.sales !== "neutral" && (
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        cardTrends.sales === "up"
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-rose-400/20 border-rose-400/40 text-rose-300"
                      }`}>
                        {cardTrends.sales === "up" ? <FaArrowUp size={7} /> : <FaArrowDown size={7} />}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-[26px] xl:text-[28px] font-sans font-black text-white tracking-tight leading-none mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                    ₹{Number(accountsSummary.totalSales).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm" />
                    <span className="text-[11px] font-bold text-emerald-100/80">{accountsSummary.salesVoucherCount} vouchers</span>
                  </div>
                </div>
              </button>

              {/* TOTAL PURCHASE */}
              <button
                onClick={() => navigate("/invoice")}
                className="relative text-left rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1"
                style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #1d4ed8 100%)", border: "1px solid rgba(96,165,250,0.25)" }}
              >
                {/* Bottom-right corner white shade on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                  style={{ background: "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)" }} />
                <FaCheckCircle
                  className="absolute -right-3 -bottom-2 text-white/20 group-hover:text-white/35 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 pointer-events-none select-none"
                  style={{ fontSize: "5.5rem" }}
                />
                <div className="relative z-10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-blue-200">Total Purchase</span>
                    {cardTrends.purchase !== "neutral" && (
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        cardTrends.purchase === "up"
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-rose-400/20 border-rose-400/40 text-rose-300"
                      }`}>
                        {cardTrends.purchase === "up" ? <FaArrowUp size={7} /> : <FaArrowDown size={7} />}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-[26px] xl:text-[28px] font-sans font-black text-white tracking-tight leading-none mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                    ₹{Number(accountsSummary.totalPurchase).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-sm" />
                    <span className="text-[11px] font-bold text-blue-100/80">{accountsSummary.purchaseVoucherCount} vouchers</span>
                  </div>
                </div>
              </button>

              {/* RECEIVABLE */}
              <button
                onClick={() => navigate("/accounts/receivable")}
                className="relative text-left rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1"
                style={{ background: "linear-gradient(135deg, #451a03 0%, #78350f 50%, #92400e 100%)", border: "1px solid rgba(251,191,36,0.25)" }}
              >
                {/* Bottom-right corner white shade on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                  style={{ background: "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)" }} />
                <FaHandHoldingUsd
                  className="absolute -right-3 -bottom-2 text-white/20 group-hover:text-white/35 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 pointer-events-none select-none"
                  style={{ fontSize: "5.5rem" }}
                />
                <div className="relative z-10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-200">Receivable</span>
                    {cardTrends.receivable !== "neutral" && (
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        cardTrends.receivable === "up"
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-rose-400/20 border-rose-400/40 text-rose-300"
                      }`}>
                        {cardTrends.receivable === "up" ? <FaArrowUp size={7} /> : <FaArrowDown size={7} />}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-[26px] xl:text-[28px] font-sans font-black text-white tracking-tight leading-none mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] flex items-baseline gap-1">
                    <span>₹{Math.abs(accountsSummary.totalReceivable).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                    {accountsSummary.totalReceivable < 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-black/40 text-emerald-300 border border-emerald-400/30">Cr</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm" />
                    <span className="text-[11px] font-bold text-amber-100/80">{accountsSummary.receivableCustomerCount} customers</span>
                  </div>
                </div>
              </button>

              {/* PAYABLE */}
              <button
                onClick={() => navigate("/accounts/payable")}
                className="relative text-left rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1"
                style={{ background: "linear-gradient(135deg, #4c0519 0%, #9f1239 50%, #be123c 100%)", border: "1px solid rgba(251,113,133,0.25)" }}
              >
                {/* Bottom-right corner white shade on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                  style={{ background: "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)" }} />
                <FaFileInvoiceDollar
                  className="absolute -right-3 -bottom-2 text-white/20 group-hover:text-white/35 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 pointer-events-none select-none"
                  style={{ fontSize: "5.5rem" }}
                />
                <div className="relative z-10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-rose-200">Payable</span>
                    {cardTrends.payable !== "neutral" && (
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        cardTrends.payable === "up"
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-rose-400/20 border-rose-400/40 text-rose-300"
                      }`}>
                        {cardTrends.payable === "up" ? <FaArrowUp size={7} /> : <FaArrowDown size={7} />}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-[26px] xl:text-[28px] font-sans font-black text-white tracking-tight leading-none mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] flex items-baseline gap-1">
                    <span>₹{Math.abs(accountsSummary.totalPayable).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                    {accountsSummary.totalPayable < 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-black/40 text-rose-300 border border-rose-400/30">Dr</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-sm" />
                    <span className="text-[11px] font-bold text-rose-100/80">{accountsSummary.payableSupplierCount} suppliers</span>
                  </div>
                </div>
              </button>

              {/* CASH */}
              <button
                onClick={() => navigate("/accounts/bank-accounts?filter=cash")}
                className="relative text-left rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1"
                style={{ background: "linear-gradient(135deg, #042f2e 0%, #115e59 50%, #0d9488 100%)", border: "1px solid rgba(45,212,191,0.25)" }}
              >
                {/* Bottom-right corner white shade on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                  style={{ background: "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)" }} />
                <FaMoneyBillWave
                  className="absolute -right-3 -bottom-2 text-white/20 group-hover:text-white/35 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 pointer-events-none select-none"
                  style={{ fontSize: "5.5rem" }}
                />
                <div className="relative z-10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-teal-200">Cash</span>
                    {cardTrends.cash !== "neutral" && (
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        cardTrends.cash === "up"
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-rose-400/20 border-rose-400/40 text-rose-300"
                      }`}>
                        {cardTrends.cash === "up" ? <FaArrowUp size={7} /> : <FaArrowDown size={7} />}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-[26px] xl:text-[28px] font-sans font-black text-white tracking-tight leading-none mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                    ₹{Math.abs(accountsSummary.totalCashInHand).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-sm" />
                    <span className="text-[11px] font-bold text-teal-100/80">{accountsSummary.cashAccountCount || 0} accounts</span>
                  </div>
                </div>
              </button>

              {/* BANK */}
              <button
                onClick={() => navigate("/accounts/bank-accounts?filter=bank")}
                className="relative text-left rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1"
                style={{ background: "linear-gradient(135deg, #2e1065 0%, #4c1d95 50%, #6d28d9 100%)", border: "1px solid rgba(167,139,250,0.25)" }}
              >
                {/* Bottom-right corner white shade on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                  style={{ background: "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)" }} />
                <FaUniversity
                  className="absolute -right-3 -bottom-2 text-white/20 group-hover:text-white/35 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 pointer-events-none select-none"
                  style={{ fontSize: "5.5rem" }}
                />
                <div className="relative z-10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-violet-200">Bank</span>
                    {cardTrends.bank !== "neutral" && (
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        cardTrends.bank === "up"
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-rose-400/20 border-rose-400/40 text-rose-300"
                      }`}>
                        {cardTrends.bank === "up" ? <FaArrowUp size={7} /> : <FaArrowDown size={7} />}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl sm:text-[26px] xl:text-[28px] font-sans font-black text-white tracking-tight leading-none mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                    ₹{Math.abs(accountsSummary.totalBankBalance).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-sm" />
                    <span className="text-[11px] font-bold text-violet-100/80">{accountsSummary.bankAccountCount || 0} accounts</span>
                  </div>
                </div>
              </button>

            </div>
          </>
        )}        {/* ══════════════════════════════════════════════════════
           ROW 2  –  Sales/Purchase Trend Chart (Left) + Today's Tasks & Recent Sales (Right)
           ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6" style={{ minHeight: "530px" }}>
          {/* Left: Sales & Purchase Trend Chart */}
          {showTrend && (
            <div className="h-full min-h-[530px]">
              <SalesPurchaseTrendChart
                salesOrders={salesOrders}
                purchaseOrders={purchaseOrders}
                productionOrders={productionOrders}
                salesInvoices={salesInvoices}
                purchaseInvoices={purchaseInvoices}
              />
            </div>
          )}

          {/* Right: Today's Tasks & Production (Top) + Recent Sales Orders (Bottom) */}
          <div className="flex flex-col gap-3 sm:gap-4 h-full min-h-[530px]">
            {/* 1. Today's Tasks / Daily Production Planning */}
            {showTasks && (
              <div className="bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden flex-1 min-h-[255px]">
                {/* Card Header */}
                <div className="shrink-0 px-3.5 py-2.5 border-b border-line-soft flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <FaCalendarCheck className="text-xs" />
                    </div>
                    <div className="text-[12px] uppercase tracking-wider font-extrabold text-ink truncate">
                      Today's Tasks & Production
                    </div>
                  </div>
                  
                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>

                {/* Card Content */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                  {todayStats.tasksList.length > 0 ? (
                    todayStats.tasksList.map((task: any, i: number) => {
                      const linkedPo = safe(productionOrders).find((po: any) => po.productionOrderId === task.productionOrderId || po.id === task.productionOrderId);
                      const productName = task.product?.productName || task.productName || task.productionOrder?.productItem?.productName || task.productionOrder?.product?.productName || linkedPo?.productItem?.productName || linkedPo?.product?.productName || linkedPo?.productName || "No Product Linked";
                      const machineName = task.machine?.machineName || task.machineName || task.weeklyProgram?.machine?.machineName || `Plan #${task.dailyPlanId || task.id || i + 1}`;
                      const shiftName = task.shift?.shiftName || task.shiftName || task.weeklyProgram?.shift?.shiftName || "General Shift";
                      return (
                        <div
                          key={i}
                          onClick={() => navigate("/daily-machine-planning")}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-card-2 border border-line-soft hover:border-emerald-500/40 hover:bg-card transition-all group cursor-pointer shadow-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-teal-600/30 text-emerald-400 border border-emerald-500/30 group-hover:scale-105 transition-transform">
                              <FaCalendarCheck className="text-xs" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-bold text-ink truncate">{machineName}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-card text-ink-muted border border-line-soft">
                                  {shiftName}
                                </span>
                              </div>
                              <span className="text-[10.5px] font-medium text-ink-muted truncate block mt-0.5">{productName}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                              {task.status || "SCHEDULED"}
                            </span>
                            <FaChevronRight className="text-ink-subtle text-[10px] group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center text-ink-subtle">
                      <FaCalendarCheck size={32} className="mb-2 opacity-25 text-emerald-400" />
                      <p className="text-[12px] font-bold text-ink-muted">No tasks scheduled for today</p>
                      <p className="text-[10px] text-ink-subtle mt-0.5">Daily production plans for today will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Recent Sales Orders */}
            {showRecentSales && (
              <div className="bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden flex-1 min-h-[255px]">
                {/* Header */}
                <div className="shrink-0 px-3.5 py-2.5 border-b border-line-soft bg-card-2/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <FaShoppingCart className="text-xs" />
                    </div>
                    <div className="text-[12px] uppercase tracking-wider font-extrabold text-ink truncate">
                      Recent Sales Orders
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase">
                      Latest {recentSales.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate("/sales-order")}
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-ink-muted hover:text-ink bg-card hover:bg-card-2 border border-line-soft transition-colors flex items-center gap-1 cursor-pointer"
                      title="View all sales orders"
                    >
                      <span>View All</span>
                      <FaArrowRight className="text-[8px]" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                  {recentSales.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center text-ink-subtle">
                      <FaShoppingCart size={32} className="mb-2 opacity-25 text-blue-400" />
                      <p className="text-[12px] font-bold text-ink-muted">No Sales Orders Yet</p>
                      <p className="text-[10px] text-ink-subtle mt-0.5">New sales orders placed in the system will display here</p>
                    </div>
                  ) : (
                    recentSales.map((so: any, i: number) => {
                      const custName = so.customer?.firmName || so.customer?.displayName || so.customerName || "Customer";
                      const initial = (custName || "C").trim().charAt(0).toUpperCase();
                      const status = (so.status || "DRAFT").toUpperCase();
                      const isCompleted = status === "COMPLETED" || status === "INVOICED" || status === "DELIVERED";
                      const isCancelled = status === "CANCELLED";

                      return (
                        <div
                          key={i}
                          onClick={() => navigate(`/sales-order/details/${so.id || so.salesOrderId || ""}`)}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-card-2 border border-line-soft hover:border-blue-500/40 hover:bg-card transition-all group cursor-pointer shadow-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 font-extrabold flex items-center justify-center text-xs group-hover:scale-105 transition-transform">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <span className="block text-[11.5px] font-mono font-bold text-ink truncate group-hover:text-blue-400 transition-colors">
                                {so.orderNo || `SO-${so.id}`}
                              </span>
                              <span className="text-[10px] font-medium text-ink-muted truncate block">{custName}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <span className="text-[12px] font-mono font-black text-ink whitespace-nowrap">
                              ₹{Number(so.netAmount || 0).toLocaleString("en-IN")}
                            </span>
                            <span
                              className={`text-[8px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                                isCompleted
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                  : isCancelled
                                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                  : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                              }`}
                            >
                              {status.replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
           ROW 3  –  Alerts & Recent Transactions (3/4 Left) + Top Products (1/4 Right)
           ══════════════════════════════════════════════════════ */}
        {accountsSummary && <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6" style={{ minHeight: "360px" }}>
          {/* Left 3/4: Alerts (1/3) + Recent Transactions (2/3) */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 h-full">
            {/* Alerts (1 of 3 inside 3/4) */}
            <div className="bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden h-full min-h-[360px]">
              <div className="shrink-0 px-3.5 py-2.5 border-b border-line-soft flex items-center justify-between">
                <div className="text-[12px] uppercase tracking-wider font-extrabold text-ink flex items-center gap-1.5">
                  <FaBell className="text-amber-400 text-xs" />
                  <span>Alerts</span>
                </div>
                {accountsSummary.alerts.length > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    {accountsSummary.alerts.length} Action{accountsSummary.alerts.length > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    0 Active
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
                {accountsSummary.alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                      <FaCheckCircle className="text-sm" />
                    </div>
                    <p className="text-xs font-bold text-ink">All Systems Clear</p>
                    <p className="text-[10px] text-ink-subtle mt-0.5">No pending warnings or actions</p>
                  </div>
                ) : (
                  accountsSummary.alerts.map((a, i) => {
                    const isDanger = a.level === "danger";
                    const isWarn = a.level === "warn";

                    const borderAccent = isDanger
                      ? "border-l-rose-500"
                      : isWarn
                      ? "border-l-amber-500"
                      : "border-l-blue-500";

                    const iconColor = isDanger
                      ? "text-rose-400"
                      : isWarn
                      ? "text-amber-400"
                      : "text-blue-400";

                    const IconComponent = isDanger
                      ? FaExclamationCircle
                      : isWarn
                      ? FaExclamationTriangle
                      : FaInfoCircle;

                    const content = (
                      <div className="flex items-center justify-between gap-2.5 w-full">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <IconComponent className={`text-xs mt-0.5 shrink-0 ${iconColor}`} />
                          <p className="text-[11px] font-semibold text-ink leading-snug break-words">
                            {a.message}
                          </p>
                        </div>
                        {a.link && (
                          <FaChevronRight className="text-[9px] text-ink-subtle group-hover:text-ink group-hover:translate-x-0.5 transition-all shrink-0" />
                        )}
                      </div>
                    );

                    return a.link ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => navigate(a.link!)}
                        className={`w-full text-left rounded-md p-2.5 bg-card-2 border border-line-soft hover:bg-card border-l-[3px] ${borderAccent} transition-all duration-150 cursor-pointer shadow-sm group`}
                      >
                        {content}
                      </button>
                    ) : (
                      <div
                        key={i}
                        className={`w-full text-left rounded-md p-2.5 bg-card-2 border border-line-soft border-l-[3px] ${borderAccent} shadow-sm`}
                      >
                        {content}
                      </div>
                    );
                  })
                )}
              </div>

              {accountsSummary.alerts.length > 0 && (
                <div className="shrink-0 px-3 py-1.5 bg-card-2/50 border-t border-line-soft flex items-center justify-between text-[10px] text-ink-subtle">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Active Alerts
                  </span>
                  <span className="text-[9px] text-ink-muted">Click to view</span>
                </div>
              )}
            </div>

            {/* Recent Transactions (2 of 3 inside 3/4) */}
            <div className="md:col-span-2 bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden h-full min-h-[360px]">
              <div className="shrink-0 px-3.5 py-2.5 border-b border-line-soft flex items-center justify-between">
                <div className="text-[12px] uppercase tracking-wider font-extrabold text-ink">Recent Transactions</div>
                <button
                  type="button"
                  onClick={() => navigate("/accounts/ledger-statement")}
                  className="text-[11px] font-semibold text-blue-400 hover:underline cursor-pointer"
                >
                  View Ledger Statement →
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {accountsSummary.recentTransactions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-ink-subtle">No recent transactions</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-card-2 text-ink-subtle uppercase text-[10px] font-bold tracking-wide border-b border-line-soft sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 bg-card-2">Voucher No</th>
                        <th className="px-2 py-2 bg-card-2">Type</th>
                        <th className="px-3 py-2 bg-card-2">Party / Account</th>
                        <th className="px-2 py-2 bg-card-2">Date</th>
                        <th className="px-3 py-2 bg-card-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {accountsSummary.recentTransactions.map((t) => {
                        const typeColor: Record<string, string> = {
                          SALES: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                          PURCHASE: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                          RECEIPT: "bg-green-500/10 text-green-500 border-green-500/20",
                          PAYMENT: "bg-rose-500/10 text-rose-500 border-rose-500/20",
                          JOURNAL: "bg-purple-500/10 text-purple-500 border-purple-500/20",
                          CONTRA: "bg-amber-500/10 text-amber-500 border-amber-500/20",
                        };
                        const party = t.debitLedger || t.creditLedger || t.narration || "-";
                        return (
                          <tr key={t.id} className="hover:bg-card-2 transition-colors">
                            <td className="px-3 py-2 font-mono font-semibold text-blue-400 whitespace-nowrap text-[11px]">{t.voucherNo}</td>
                            <td className="px-2 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${typeColor[t.type] || "bg-card-2 text-ink-subtle border-line"}`}>
                                {t.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-ink truncate max-w-[160px] text-[11px] font-medium">{party}</td>
                            <td className="px-2 py-2 font-mono text-[10px] text-ink-muted whitespace-nowrap">
                              {new Date(t.date).toLocaleDateString("en-IN")}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-ink whitespace-nowrap text-[11px]">
                              ₹{Number(t.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Right 1/4: Top Products */}
          {showTopProducts && (
            <div className="lg:col-span-1 bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden h-full min-h-[360px]">
              <div className="shrink-0 px-3 py-2 border-b border-line-soft flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="text-[12px] uppercase tracking-wider font-extrabold text-ink truncate">Top Products</div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-500 border border-teal-500/30 uppercase shrink-0">By stock</span>
                </div>
                {/* 3 Chart Type Switch Icons */}
                <div className="flex items-center bg-card-2 p-0.5 rounded-lg border border-line-soft gap-1 shrink-0 shadow-inner">
                  <button
                    type="button"
                    onClick={() => handleTopProductsChartTypeChange("list")}
                    title="Horizontal Ranking Bars"
                    className={`p-1.5 rounded transition-all flex items-center justify-center cursor-pointer ${
                      topProductsChartType === "list"
                        ? "bg-teal-500 text-white shadow-md shadow-teal-500/40 font-bold"
                        : "text-ink-muted hover:text-ink hover:bg-card"
                    }`}
                  >
                    <FaListUl className="text-xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTopProductsChartTypeChange("bar")}
                    title="Vertical Column Chart"
                    className={`p-1.5 rounded transition-all flex items-center justify-center cursor-pointer ${
                      topProductsChartType === "bar"
                        ? "bg-teal-500 text-white shadow-md shadow-teal-500/40 font-bold"
                        : "text-ink-muted hover:text-ink hover:bg-card"
                    }`}
                  >
                    <FaChartBar className="text-xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTopProductsChartTypeChange("pie")}
                    title="Donut Distribution Chart"
                    className={`p-1.5 rounded transition-all flex items-center justify-center cursor-pointer ${
                      topProductsChartType === "pie"
                        ? "bg-teal-500 text-white shadow-md shadow-teal-500/40 font-bold"
                        : "text-ink-muted hover:text-ink hover:bg-card"
                    }`}
                  >
                    <FaChartPie className="text-xs" />
                  </button>
                </div>
              </div>

              {/* 1. Horizontal Progress Ranking */}
              {topProductsChartType === "list" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
                  {topProducts.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-ink-muted text-xs">No Products</div>
                  ) : (
                    topProductsWithColors.map((prod: any, i: number) => {
                      const maxVal = topProducts[0]?.value || 1;
                      const pct = Math.min((prod.value / maxVal) * 100, 100);
                      return (
                        <div key={i} className="flex flex-col gap-1 group">
                          <div className="flex justify-between items-end">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[9px] font-bold w-4 h-4 rounded bg-card-2 border border-line-soft text-ink-muted flex items-center justify-center shrink-0 group-hover:border-teal-500/40 group-hover:text-teal-500 transition-colors">
                                {i + 1}
                              </span>
                              <span className="text-[11px] font-semibold text-ink-muted truncate max-w-[130px] group-hover:text-ink transition-colors" title={prod.name}>
                                {prod.name}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-ink whitespace-nowrap">{prod.value.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-line-soft rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: prod.color,
                                boxShadow: `0 0 6px ${prod.color}40`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* 2. Vertical Column Bar Chart */}
              {topProductsChartType === "bar" && (
                <div className="flex-1 min-h-0 p-2.5 flex flex-col">
                  {topProducts.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-ink-muted text-xs">No Products</div>
                  ) : (
                    <div className="w-full h-full min-h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topProductsWithColors} margin={{ top: 12, right: 8, left: -24, bottom: 26 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line-soft)" />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 9, fill: "var(--color-ink-subtle)" }}
                            interval={0}
                            tickFormatter={(val) => (val && val.length > 7 ? `${val.slice(0, 6)}…` : val)}
                            angle={-25}
                            textAnchor="end"
                            height={30}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 9, fill: "var(--color-ink-subtle)" }}
                            tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`)}
                          />
                          <Tooltip
                            content={({ active, payload }: any) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload || {};
                                return (
                                  <div className="bg-card/95 backdrop-blur-md border border-line-soft rounded-lg px-2.5 py-1.5 shadow-xl text-ink text-[11px] z-50">
                                    <p className="font-bold text-ink max-w-[170px] truncate mb-0.5">{data.name}</p>
                                    <div className="flex items-center gap-1.5 text-ink-muted">
                                      <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: data.color || "#14b8a6" }} />
                                      <span>Stock: <strong className="text-ink font-mono">{Number(data.value || 0).toLocaleString()}</strong></span>
                                    </div>
                                    {data.percent !== undefined && (
                                      <p className="text-[9px] text-ink-subtle mt-0.5">{(data.percent * 100).toFixed(1)}% of top items</p>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {topProductsWithColors.map((entry, index) => (
                              <Cell key={`cell-bar-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Donut / Pie Chart */}
              {topProductsChartType === "pie" && (
                <div className="flex-1 min-h-0 p-2 flex flex-col justify-between overflow-hidden">
                  {topProducts.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-ink-muted text-xs">No Products</div>
                  ) : (
                    <>
                      <div className="h-[145px] w-full relative shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip
                              content={({ active, payload }: any) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload || {};
                                  return (
                                    <div className="bg-card/95 backdrop-blur-md border border-line-soft rounded-lg px-2.5 py-1.5 shadow-xl text-ink text-[11px] z-50">
                                      <p className="font-bold text-ink max-w-[170px] truncate mb-0.5">{data.name}</p>
                                      <div className="flex items-center gap-1.5 text-ink-muted">
                                        <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: data.color || "#14b8a6" }} />
                                        <span>Stock: <strong className="text-ink font-mono">{Number(data.value || 0).toLocaleString()}</strong></span>
                                      </div>
                                      {data.percent !== undefined && (
                                        <p className="text-[9px] text-ink-subtle mt-0.5">{(data.percent * 100).toFixed(1)}% of top items</p>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Pie
                              data={topProductsWithColors}
                              cx="50%"
                              cy="50%"
                              innerRadius={36}
                              outerRadius={60}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {topProductsWithColors.map((entry, index) => (
                                <Cell key={`cell-pie-${index}`} fill={entry.color} stroke="transparent" />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[8px] text-ink-muted font-bold uppercase tracking-wider">Total</span>
                          <span className="text-[11px] font-black text-ink">{topProductsTotal.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 max-h-[85px] overflow-y-auto px-1 pt-1 border-t border-line-soft">
                        {topProductsWithColors.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 min-w-0" title={`${item.name}: ${item.value.toLocaleString()}`}>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-[10px] text-ink-muted truncate flex-1">{item.name}</span>
                            <span className="text-[10px] font-bold text-ink shrink-0">{item.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>}

        {/* ══════════════════════════════════════════════════════
           ROW 4  –  Customer Product Purchase Report (Left) + Sales Person Location (Right)
           ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6" style={{ height: "360px" }}>
          {/* Customer Product Purchase Report — in-card drill-down view */}
          <div className="bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden h-full min-h-0">
            {/* Header */}
            <div className="shrink-0 px-3 py-2 border-b border-line-soft flex items-center justify-between gap-2">
              {selectedCustomerReport ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerReport(null);
                        setCustomerProductSearch("");
                      }}
                      className="px-2 py-1 rounded bg-card-2 text-ink-muted hover:text-ink hover:bg-card transition-colors flex items-center gap-1.5 text-[11px] font-bold cursor-pointer border border-line-soft shadow-sm"
                      title="Back to Customer List"
                    >
                      <FaArrowLeft className="text-[10px]" />
                      <span>Back</span>
                    </button>
                    <span className="text-[12px] uppercase tracking-wider font-extrabold text-ink truncate">
                      {selectedCustomerReport.customer}
                    </span>
                  </div>

                  {/* In-Card Toggle: Purchased vs Not Purchased */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(() => {
                      const customerObj = customerPurchaseReport.customers.find(
                        (c) => c.name === selectedCustomerReport.customer
                      );
                      const purchasedCount = customerObj?.purchasedProducts.length || 0;
                      const notPurchasedCount = customerObj?.notPurchasedProducts.length || 0;
                      return (
                        <div className="flex items-center bg-card-2 p-0.5 rounded-lg border border-line-soft gap-0.5 shadow-inner">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerReport({ customer: selectedCustomerReport.customer, type: "purchased" })}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              selectedCustomerReport.type === "purchased"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-ink-muted hover:text-ink hover:bg-card"
                            }`}
                          >
                            <FaCheckCircle className="text-[9px]" />
                            <span>Purchased ({purchasedCount})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerReport({ customer: selectedCustomerReport.customer, type: "notPurchased" })}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              selectedCustomerReport.type === "notPurchased"
                                ? "bg-rose-600 text-white shadow-sm"
                                : "text-ink-muted hover:text-ink hover:bg-card"
                            }`}
                          >
                            <FaTimesCircle className="text-[9px]" />
                            <span>Not Purchased ({notPurchasedCount})</span>
                          </button>
                        </div>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerReport(null);
                        setCustomerProductSearch("");
                      }}
                      className="p-1 text-ink-subtle hover:text-ink hover:bg-card-2 rounded transition-colors cursor-pointer"
                      title="Close details"
                    >
                      <FaTimes className="text-xs" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[12px] uppercase tracking-wider font-extrabold text-ink flex items-center gap-1.5">
                    <FaShoppingCart className="text-indigo-400 text-xs" /> Product Purchase Report
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/30">
                    {customerPurchaseReport.totalProducts} Products · {customerPurchaseReport.customers.length} Customers
                  </span>
                </>
              )}
            </div>

            {/* Body */}
            {selectedCustomerReport ? (
              /* In-Card Details View */
              (() => {
                const customerObj = customerPurchaseReport.customers.find(
                  (c) => c.name === selectedCustomerReport.customer
                );
                const isPurchased = selectedCustomerReport.type === "purchased";
                const rawList = isPurchased
                  ? customerObj?.purchasedProducts || []
                  : customerObj?.notPurchasedProducts || [];
                const filtered = rawList.filter((p) =>
                  p.toLowerCase().includes(customerProductSearch.toLowerCase())
                );

                return (
                  <div className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden">
                    {/* Search bar */}
                    <div className="flex items-center gap-2 mb-2.5 shrink-0">
                      <div className="relative flex-1">
                        <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted text-[10px]" />
                        <input
                          type="text"
                          value={customerProductSearch}
                          onChange={(e) => setCustomerProductSearch(e.target.value)}
                          placeholder={`Search ${isPurchased ? "purchased" : "not purchased"} products...`}
                          className="w-full bg-card-2 border border-line-soft rounded-lg pl-7 pr-3 py-1 text-xs text-ink placeholder:text-ink-subtle focus:outline-none focus:border-teal-500/50"
                        />
                        {customerProductSearch && (
                          <button
                            type="button"
                            onClick={() => setCustomerProductSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink text-[10px]"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-1 rounded-md border shrink-0 ${
                          isPurchased
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {rawList.length} of {customerPurchaseReport.totalProducts} products
                      </span>
                    </div>

                    {/* Product items list */}
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                      {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-10 text-ink-subtle">
                          <FaBox className="text-2xl mb-2 opacity-20" />
                          <p className="text-xs font-semibold">No products found</p>
                          <p className="text-[10px] mt-0.5">
                            {rawList.length === 0
                              ? `No ${isPurchased ? "purchased" : "unpurchased"} products for this customer`
                              : "No matching search results"}
                          </p>
                        </div>
                      ) : (
                        filtered.map((productName, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-card-2 border border-line-soft hover:bg-card transition-colors group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                  isPurchased
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <span
                                className="text-xs font-semibold text-ink truncate group-hover:text-white transition-colors"
                                title={productName}
                              >
                                {productName}
                              </span>
                            </div>
                            <span
                              className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                                isPurchased
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              }`}
                            >
                              {isPurchased ? "Ordered" : "Not Ordered"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Customer Overview Table */
              <div className="flex-1 min-h-0 overflow-auto">
                {customerPurchaseReport.customers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-ink-subtle">No customers available</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-card-2 text-ink-subtle uppercase text-[10px] font-bold tracking-wide border-b border-line-soft sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 bg-card-2">Customer</th>
                        <th className="px-3 py-2 bg-card-2 text-center">Purchased</th>
                        <th className="px-3 py-2 bg-card-2 text-center">Not Purchased</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {customerPurchaseReport.customers.map((row, idx) => (
                        <tr key={idx} className="hover:bg-card-2/80 transition-colors group">
                          <td className="px-3 py-2.5">
                            <span
                              onClick={() =>
                                setSelectedCustomerReport({
                                  customer: row.name,
                                  type: row.purchasedProducts.length > 0 ? "purchased" : "notPurchased",
                                })
                              }
                              className="text-[12px] font-semibold text-ink group-hover:text-teal-400 cursor-pointer truncate block max-w-[200px] transition-colors"
                              title="Click to view product breakdown"
                            >
                              {row.name}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {row.purchasedProducts.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCustomerReport({ customer: row.name, type: "purchased" })
                                }
                                title={`View ${row.purchasedProducts.length} purchased products for ${row.name}`}
                                className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono font-bold text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer shadow-sm"
                              >
                                {row.purchasedProducts.length}
                              </button>
                            ) : (
                              <span className="text-[11px] font-mono text-ink-muted">0</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {row.notPurchasedProducts.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCustomerReport({ customer: row.name, type: "notPurchased" })
                                }
                                title={`View ${row.notPurchasedProducts.length} not purchased products for ${row.name}`}
                                className="px-2.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-[11px] font-mono font-bold text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer shadow-sm"
                              >
                                {row.notPurchasedProducts.length}
                              </button>
                            ) : (
                              <span className="text-[11px] font-mono text-emerald-400 font-semibold">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Sales Person Live GPS Interactive Map */}
          <SalesPersonLiveMap />
        </div>

        {/* ══════════════════════════════════════════════════════
           ROW 4  –  INVENTORY & STOCK INTELLIGENCE (Multi-Chart & Reorder Alerts)
           ══════════════════════════════════════════════════════ */}
        <InventoryStockIntelligence
          rawMaterials={rawMaterials}
          rawMaterialStocks={rawMaterialStocks}
          finishedGoodsStocks={finishedGoodsStocks}
          allProducts={allProducts}
        />

        {/* ══════════════════════════════════════════════════════
           ROW 5  –  WORKFORCE & SHIFT ATTENDANCE SNAPSHOT
           ══════════════════════════════════════════════════════ */}
        <WorkforceShiftAttendance
          employeesCount={employeesCount}
          dailyPlans={dailyPlans}
          weeklyPrograms={weeklyPrograms}
        />
      </div>

    </div>
  );
};

export default DashboardPage;