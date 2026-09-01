import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocketSync } from "../../../hooks/useSocketSync";
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
  FaArrowUp, FaHandHoldingUsd, FaFileInvoiceDollar,
  FaUniversity, FaWarehouse, FaCheckCircle, FaSync, FaMapMarkerAlt, FaTimes,
} from "react-icons/fa";
import { FiTrendingUp, FiTrendingDown, FiMoreVertical } from "react-icons/fi";

import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import DashboardFooter from "../components/DashboardFooter";
import { SparklineCard } from "../components/SparklineCard";
import SalesPurchaseTrendChart from "../components/SalesPurchaseTrendChart";
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
  const [productModal, setProductModal] = useState<{ customer: string; type: "purchased" | "notPurchased"; products: string[] } | null>(null);

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
  const allCustomers = dashData.customers || [];
  const productsCount = dashData.productsCount || (Array.isArray(allProducts) ? allProducts.length : 0);
  const employeesCount = dashData.employeesCount || 0;
  const salesInvoices = dashData.salesInvoices || [];
  void rawMaterialStocks; // reserved for future use

  // ── Real-time socket refresh on any relevant change ─────────
  useSocketSync("purchaseOrder", undefined, refreshDashboard);
  useSocketSync("productionOrder", undefined, refreshDashboard);
  useSocketSync("dailyPlan", undefined, refreshDashboard);
  useSocketSync("finishedGoodsStock", undefined, refreshDashboard);
  useSocketSync("rawMaterialStock", undefined, refreshDashboard);

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

  useSocketSync("payment", undefined, refreshAccountsSummary);
  useSocketSync("journalItem", undefined, refreshAccountsSummary);
  useSocketSync("accountLedger", undefined, refreshAccountsSummary);
  useSocketSync("salesInvoice", undefined, refreshAccountsSummary);
  useSocketSync("grnInvoice", undefined, refreshAccountsSummary);
  useSocketSync("pettyCashEntry", undefined, refreshAccountsSummary);

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

  // Recent orders
  const recentSales = useMemo(() => {
    return safe(salesOrders)
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [salesOrders]);

  // Customer Purchase Report — per-customer: which products purchased vs not purchased
  const customerPurchaseReport = useMemo(() => {
    const so = safe(salesOrders);
    const products = safe(allProducts);
    const customers = safe(allCustomers);
    const productNames = products.map((p: any) => p.productName || p.name || "").filter(Boolean);
    const totalProducts = productNames.length;

    // Build: { customerName → Set of purchased product names }
    const customerProducts: Record<string, Set<string>> = {};
    for (const order of so) {
      const cName = order.customer?.firmName || "Unknown";
      if (!customerProducts[cName]) customerProducts[cName] = new Set();
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const pName = item.product?.productName || item.productName || "";
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
  }, [salesOrders, allProducts, allCustomers]);

  /* ═══════════════ RENDER ═══════════════ */
  // Cache-first render: no full-page CommonLoader anymore. On first cold visit
  // cards may briefly show ₹0 / empty until the background fetch resolves.
  // On repeat visits data appears instantly from cache. The "Syncing…" pill in
  // the header signals when a silent background refresh is in flight.
  return (
    <div className="bg-page flex flex-col min-h-0" style={{ height: "calc(100vh - 100px)" }}>

      {/* ── FIXED HEADER ────────────────────────────────────── */}
      <div className="shrink-0   px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black tracking-tight text-ink">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          {isSyncingAccounts && (
            <span className="flex items-center gap-1 text-[10px] text-blue-500">
              <FaSync className="animate-spin" /> Syncing…
            </span>
          )}
        </div>
      </div>

      {/* ── SCROLLABLE MAIN CONTENT ─────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-3 sm:px-6 sm:py-4 lg:px-8">

        {/* ══════════════════════════════════════════════════════
           ROW 0  –  ACCOUNTS SUMMARY (Busy-style)
           6 stat cards + Quick Actions + Alerts + Recent Txns
           ══════════════════════════════════════════════════════ */}
        {accountsSummary && (
          <>
            {/* 6 Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-3 sm:mb-4">
              <button
                onClick={() => navigate("/accounts/vouchers")}
                className="text-left bg-card border border-line-soft rounded-lg shadow-sm p-3 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Total Sales</span>
                  <FaArrowUp className="text-emerald-500 text-xs" />
                </div>
                <div className="text-base sm:text-lg font-mono font-bold text-ink mt-1">
                  ₹{Number(accountsSummary.totalSales).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-ink-subtle mt-0.5">{accountsSummary.salesVoucherCount} vouchers</div>
              </button>

              <button
                onClick={() => navigate("/invoice")}
                className="text-left bg-card border border-line-soft rounded-lg shadow-sm p-3 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Total Purchase</span>
                  <FaCheckCircle className="text-blue-500 text-xs" />
                </div>
                <div className="text-base sm:text-lg font-mono font-bold text-ink mt-1">
                  ₹{Number(accountsSummary.totalPurchase).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-ink-subtle mt-0.5">{accountsSummary.purchaseVoucherCount} vouchers</div>
              </button>

              <button
                onClick={() => navigate("/accounts/receivable")}
                className="text-left bg-card border border-line-soft rounded-lg shadow-sm p-3 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Receivable</span>
                  <FaHandHoldingUsd className="text-amber-500 text-xs" />
                </div>
                <div className={`text-base sm:text-lg font-mono font-bold mt-1 ${accountsSummary.totalReceivable < 0 ? "text-emerald-500" : "text-ink"}`}>
                  ₹{Math.abs(accountsSummary.totalReceivable).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  {accountsSummary.totalReceivable < 0 && <span className="text-[10px] ml-1">Cr</span>}
                </div>
                <div className="text-[10px] text-ink-subtle mt-0.5">{accountsSummary.receivableCustomerCount} customers</div>
              </button>

              <button
                onClick={() => navigate("/accounts/payable")}
                className="text-left bg-card border border-line-soft rounded-lg shadow-sm p-3 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Payable</span>
                  <FaFileInvoiceDollar className="text-rose-500 text-xs" />
                </div>
                <div className={`text-base sm:text-lg font-mono font-bold mt-1 ${accountsSummary.totalPayable < 0 ? "text-emerald-500" : "text-ink"}`}>
                  ₹{Math.abs(accountsSummary.totalPayable).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  {accountsSummary.totalPayable < 0 && <span className="text-[10px] ml-1">Dr</span>}
                </div>
                <div className="text-[10px] text-ink-subtle mt-0.5">{accountsSummary.payableSupplierCount} suppliers</div>
              </button>

              <button
                onClick={() => navigate("/accounts/bank-accounts?filter=cash")}
                className="text-left bg-card border border-line-soft rounded-lg shadow-sm p-3 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Cash</span>
                  <FaMoneyBillWave className="text-emerald-500 text-xs" />
                </div>
                <div className={`text-base sm:text-lg font-mono font-bold mt-1 ${accountsSummary.totalCashInHand < 0 ? "text-rose-500" : "text-ink"}`}>
                  ₹{Math.abs(accountsSummary.totalCashInHand).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-ink-subtle mt-0.5">{accountsSummary.cashAccountCount || 0} accounts</div>
              </button>

              <button
                onClick={() => navigate("/accounts/bank-accounts?filter=bank")}
                className="text-left bg-card border border-line-soft rounded-lg shadow-sm p-3 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Bank</span>
                  <FaUniversity className="text-indigo-500 text-xs" />
                </div>
                <div className={`text-base sm:text-lg font-mono font-bold mt-1 ${accountsSummary.totalBankBalance < 0 ? "text-rose-500" : "text-ink"}`}>
                  ₹{Math.abs(accountsSummary.totalBankBalance).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-ink-subtle mt-0.5">{accountsSummary.bankAccountCount || 0} accounts</div>
              </button>

              {/* <div className="bg-card border border-line-soft rounded-lg shadow-sm p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">Stock Value</span>
                  <FaWarehouse className="text-cyan-500 text-xs" />
                </div>
                <div className="text-base sm:text-lg font-mono font-bold text-ink mt-1">
                  ₹{Number(accountsSummary.stockValue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-ink-subtle mt-0.5">{accountsSummary.stockItemCount} items</div>
              </div> */}
            </div>

            {/* Alerts + Recent Transactions — single 2-col row.
                Each card has fixed header (+ footer for txns) with scrollable body. */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4 mb-3 sm:mb-4" style={{ height: "340px" }}>
              {/* Alerts (1 col of 5) */}
              <div className="bg-card border border-line-soft rounded-lg shadow-sm flex flex-col overflow-hidden">
                <div className="shrink-0 px-3 py-2 border-b border-line-soft flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wide font-bold text-ink-subtle">Alerts</div>
                  {accountsSummary.alerts.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/30">
                      {accountsSummary.alerts.length}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
                  {accountsSummary.alerts.length === 0 ? (
                    <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
                      <FaCheckCircle className="text-emerald-500 text-[10px]" /> All good, no alerts
                    </div>
                  ) : (
                    accountsSummary.alerts.map((a, i) => {
                      const styles = a.level === "danger"
                        ? "bg-rose-500/10 border-rose-500/20 text-amber-500 hover:bg-rose-500/15"
                        : a.level === "warn"
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/15"
                        : "bg-blue-500/10 border-blue-500/20 text-blue-500 hover:bg-blue-500/15";
                      const dot = a.level === "danger" ? "bg-rose-500"
                        : a.level === "warn" ? "bg-amber-500"
                        : "bg-blue-500";
                      const content = (
                        <>
                          <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${dot}`}></span>
                          <span className="flex-1 text-left">{a.message}</span>
                          {a.link && <span className="shrink-0 text-[10px] opacity-70">→</span>}
                        </>
                      );
                      return a.link ? (
                        <button
                          key={i}
                          onClick={() => navigate(a.link!)}
                          className={`w-full flex items-start gap-2 px-2 py-1.5 rounded text-[11px] border transition-colors cursor-pointer ${styles}`}
                        >
                          {content}
                        </button>
                      ) : (
                        <div key={i}
                          className={`flex items-start gap-2 px-2 py-1.5 rounded text-[11px] border ${styles}`}>
                          {content}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Recent Transactions (2 cols of 5) */}
              <div className="lg:col-span-2 bg-card border border-line-soft rounded-lg shadow-sm flex flex-col overflow-hidden">
                <div className="shrink-0 px-3 py-2 border-b border-line-soft flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wide font-bold text-ink-subtle">Recent Transactions</div>
                  <button onClick={() => navigate("/accounts/ledger-statement")} className="text-[11px] font-semibold text-blue-500 hover:underline">
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
                          <th className="px-2 py-1.5 bg-card-2">Voucher No</th>
                          <th className="px-2 py-1.5 bg-card-2">Type</th>
                          <th className="px-2 py-1.5 bg-card-2">Party / Account</th>
                          <th className="px-2 py-1.5 bg-card-2">Date</th>
                          <th className="px-2 py-1.5 bg-card-2 text-right">Amount</th>
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
                              <td className="px-2 py-1.5 font-mono font-semibold text-blue-500 whitespace-nowrap text-[11px]">{t.voucherNo}</td>
                              <td className="px-2 py-1.5">
                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${typeColor[t.type] || "bg-card-2 text-ink-subtle border-line"}`}>
                                  {t.type}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-ink truncate max-w-[140px] text-[11px]">{party}</td>
                              <td className="px-2 py-1.5 font-mono text-[10px] text-ink-muted whitespace-nowrap">
                                {new Date(t.date).toLocaleDateString("en-IN")}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono font-semibold text-ink whitespace-nowrap text-[11px]">
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

              {/* Sales Person Location Map (2 cols of 5) */}
              <div className="lg:col-span-2 bg-card border border-line-soft rounded-lg shadow-sm flex flex-col overflow-hidden">
                <div className="shrink-0 px-3 py-2 border-b border-line-soft flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wide font-bold text-ink-subtle flex items-center gap-1.5">
                    <FaMapMarkerAlt className="text-emerald-500 text-[10px]" /> Sales Person Location
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 uppercase">Live</span>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden relative">
                  {/* Satellite map — Google Maps embed (satellite view, Coimbatore–Tirupur region) */}
                  <iframe
                    title="Sales Person Locations"
                    src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d250000!2d77.3!3d11.1!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4t3!5e1!3m2!1sen!2sin"
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                  {/* Location pin overlays */}
                  {[
                    { name: "Ravi K", area: "RS Puram", initials: "RK", top: "30%", left: "30%", status: "active", color: "from-emerald-400 to-emerald-600" },
                    { name: "Suresh M", area: "SIDCO", initials: "SM", top: "62%", left: "62%", status: "active", color: "from-blue-400 to-blue-600" },
                    { name: "Karthik S", area: "Perundurai", initials: "KS", top: "45%", left: "78%", status: "idle", color: "from-amber-400 to-amber-600" },
                  ].map((pin, i) => (
                    <div key={i} className="absolute group" style={{ top: pin.top, left: pin.left, transform: "translate(-50%, -100%)" }}>
                      <div className="relative flex flex-col items-center cursor-pointer">
                        {/* Pin body */}
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${pin.color} border-[2.5px] border-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] flex items-center justify-center`}>
                            <span className="text-white text-[9px] font-black leading-none">{pin.initials}</span>
                          </div>
                          {pin.status === "active" && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-[1.5px] border-white animate-pulse" />}
                        </div>
                        {/* Pin tail */}
                        <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-white -mt-[1px]" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }} />
                        {/* Name label (always visible) */}
                        <div className="mt-0.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5 shadow-lg">
                          <p className="text-[8px] font-bold text-white whitespace-nowrap leading-tight">{pin.name}</p>
                        </div>
                        {/* Expanded tooltip on hover */}
                        <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-20">
                          <div className="bg-card border border-line-soft rounded-lg shadow-sm px-3 py-2 shadow-xl whitespace-nowrap">
                            <p className="text-[11px] font-bold text-ink">{pin.name}</p>
                            <p className="text-[10px] text-ink-subtle">{pin.area}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${pin.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`} />
                              <span className="text-[9px] font-semibold text-ink-muted">{pin.status === "active" ? "Active now" : "Idle"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Bottom legend */}
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-3 z-10">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-[9px] font-semibold text-white/80">Active</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-[9px] font-semibold text-white/80">Idle</span>
                    </div>
                    <span className="text-[9px] text-white/50">3 persons</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Old sparkline stats row removed — replaced by the 6 accounts cards above. */}

        {/* ══════════════════════════════════════════════════════
           ROW 2.5  –  Sales/Purchase Trend + Customer Product Report
           ══════════════════════════════════════════════════════ */}
        {showTrend && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6" style={{ height: "460px" }}>
            {/* Sales & Purchase Trend Chart */}
            <SalesPurchaseTrendChart
              salesOrders={salesOrders}
              purchaseOrders={purchaseOrders}
              productionOrders={productionOrders}
            />

            {/* Customer Product Purchase Report — fixed height so header &
               footer stay pinned while only the tbody scrolls. */}
            <div className="bg-card border border-line-soft rounded-lg shadow-sm flex flex-col overflow-hidden h-full min-h-0">
              <div className="shrink-0 px-3 py-2 border-b border-line-soft flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wide font-bold text-ink-subtle flex items-center gap-1.5">
                  <FaShoppingCart className="text-indigo-500 text-[10px]" /> Product Purchase Report
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/30">
                  {customerPurchaseReport.totalProducts} Products · {customerPurchaseReport.customers.length} Customers
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {customerPurchaseReport.customers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-ink-subtle">No customers available</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-card-2 text-ink-subtle uppercase text-[10px] font-bold tracking-wide border-b border-line-soft sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-1.5 bg-card-2">Customer</th>
                        <th className="px-3 py-1.5 bg-card-2 text-center">Purchased</th>
                        <th className="px-3 py-1.5 bg-card-2 text-center">Not Purchased</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {customerPurchaseReport.customers.map((row, idx) => (
                        <tr key={idx} className="hover:bg-card-2 transition-colors">
                          <td className="px-3 py-1.5">
                            <span className="text-[11px] font-semibold text-ink truncate block max-w-[180px]">{row.name}</span>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {row.purchasedProducts.length > 0 ? (
                              <button
                                onClick={() => setProductModal({ customer: row.name, type: "purchased", products: row.purchasedProducts })}
                                className="text-[11px] font-mono font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                              >
                                {row.purchasedProducts.length}
                              </button>
                            ) : (
                              <span className="text-[11px] font-mono text-ink-muted">0</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {row.notPurchasedProducts.length > 0 ? (
                              <button
                                onClick={() => setProductModal({ customer: row.name, type: "notPurchased", products: row.notPurchasedProducts })}
                                className="text-[11px] font-mono font-bold text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                              >
                                {row.notPurchasedProducts.length}
                              </button>
                            ) : (
                              <span className="text-[11px] font-mono text-emerald-400">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
           BOTTOM ROW  –  Today's Tasks | Top Products | Recent Sales
           Single 3-col row. Each widget has fixed header + scrollable body.
           ══════════════════════════════════════════════════════ */}
        {(showTasks || showTopProducts || showRecentSales) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6" style={{ height: "340px" }}>

          {/* Today's Tasks */}
          {showTasks && (
            <div className="bg-card border border-line-soft rounded-lg shadow-sm flex flex-col overflow-hidden">
              <div className="shrink-0 px-3 py-2 border-b border-line-soft flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wide font-bold text-ink-subtle">Today's Tasks</div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 uppercase">Live</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                {todayStats.tasksList.length > 0 ? (
                  todayStats.tasksList.map((task: any, i: number) => {
                    const linkedPo = safe(productionOrders).find((po: any) => po.productionOrderId === task.productionOrderId || po.id === task.productionOrderId);
                    const productName = task.product?.productName || task.productName || task.productionOrder?.productItem?.productName || task.productionOrder?.product?.productName || linkedPo?.productItem?.productName || linkedPo?.product?.productName || linkedPo?.productName || "No Product Linked";
                    const machineName = task.machine?.machineName || task.machineName || task.weeklyProgram?.machine?.machineName || `Plan #${task.dailyPlanId || task.id || i + 1}`;
                    const shiftName = task.shift?.shiftName || task.shiftName || task.weeklyProgram?.shift?.shiftName || "No Shift";
                    return (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-card-2 border border-line-soft hover:bg-card transition-colors group cursor-pointer">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                            <FaCalendarCheck className="text-xs" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[11px] font-bold text-ink truncate">{machineName}</span>
                            <span className="text-[10px] font-medium text-ink-muted truncate block">{productName} · {shiftName}</span>
                          </div>
                        </div>
                        <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {task.status || "SCHEDULED"}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-ink-subtle">
                    <FaCalendarCheck size={36} className="mb-2 opacity-20" />
                    <p className="text-[12px] font-semibold">No tasks scheduled for today</p>
                    <p className="text-[10px] mt-0.5">Schedules for today will appear here</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top Products */}
          {showTopProducts && (
            <div className="bg-card border border-line-soft rounded-lg shadow-sm flex flex-col overflow-hidden">
              <div className="shrink-0 px-3 py-2 border-b border-line-soft flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wide font-bold text-ink-subtle">Top Products</div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-500 border border-teal-500/30 uppercase">By stock</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                {topProducts.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-ink-muted text-xs">No Products</div>
                ) : (
                  topProducts.map((prod: any, i: number) => {
                    const maxVal = topProducts[0]?.value || 1;
                    const pct = Math.min((prod.value / maxVal) * 100, 100);
                    const barColors = [
                      "from-violet-500 to-indigo-500",
                      "from-sky-400 to-blue-500",
                      "from-emerald-400 to-teal-500",
                      "from-amber-400 to-orange-500",
                      "from-rose-400 to-pink-500",
                      "from-fuchsia-400 to-purple-500",
                      "from-cyan-400 to-sky-500",
                    ];
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex justify-between items-end">
                          <span className="text-[11px] font-semibold text-ink-muted truncate max-w-[140px]">{prod.name}</span>
                          <span className="text-[11px] font-bold text-ink whitespace-nowrap">{prod.value.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-line-soft rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full bg-gradient-to-r ${barColors[i % barColors.length]} transition-all duration-700`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Recent Sales Orders */}
          {showRecentSales && (
            <div className="bg-card border border-line-soft rounded-lg shadow-sm flex flex-col overflow-hidden">
              <div className="shrink-0 px-3 py-2 border-b border-line-soft flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wide font-bold text-ink-subtle">Recent Sales Orders</div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/30 uppercase">Latest 5</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                {recentSales.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-ink-muted text-xs">No Sales Orders</div>
                ) : (
                  recentSales.map((so: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-card-2 hover:bg-card rounded-lg px-3 py-2 border border-line-soft transition-colors">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-bold text-ink truncate">{so.orderNo || `SO-${so.id}`}</span>
                        <span className="text-[10px] font-medium text-ink-muted truncate">{so.customer?.firmName || so.customer?.displayName || "Customer"}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-[11px] font-black text-ink whitespace-nowrap">₹{Number(so.netAmount || 0).toLocaleString("en-IN")}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                          so.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                          so.status === "CANCELLED" ? "bg-rose-500/20 text-rose-300 border-rose-500/30" :
                          "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        }`}>{(so.status || "DRAFT").replace(/_/g, " ")}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* ── FIXED FOOTER ────────────────────────────────────── */}
      <div className="shrink-0">
        <DashboardFooter />
      </div>

      {/* ── Product List Modal ────────────────────────────────── */}
      {productModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setProductModal(null)}>
          <div className="bg-card border border-line rounded-lg shadow-2xl w-[480px] max-w-[95vw] max-h-[70vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className={`px-4 py-2.5 flex items-center justify-between ${productModal.type === "purchased" ? "bg-emerald-600" : "bg-rose-600"} text-white`}>
              <div>
                <h3 className="text-sm font-bold">
                  {productModal.type === "purchased" ? "Purchased Products" : "Not Purchased Products"}
                </h3>
                <p className="text-[11px] text-white/80 mt-0.5">{productModal.customer}</p>
              </div>
              <button onClick={() => setProductModal(null)} className="text-white/80 hover:text-white p-1">
                <FaTimes className="text-sm" />
              </button>
            </div>
            <div className="px-3 py-2 bg-card-2 border-b border-line-soft flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-subtle">
                {productModal.products.length} of {customerPurchaseReport.totalProducts} products
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${productModal.type === "purchased" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-rose-500/10 text-rose-500 border-rose-500/30"}`}>
                {productModal.type === "purchased" ? "ORDERED" : "NOT ORDERED"}
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {productModal.products.length === 0 ? (
                <div className="p-6 text-center text-xs text-ink-subtle">No products</div>
              ) : (
                <div className="divide-y divide-line-soft">
                  {productModal.products.map((product, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 px-4 py-2 hover:bg-card-2 transition-colors">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${productModal.type === "purchased" ? "bg-emerald-500" : "bg-rose-500"}`}>
                        {idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-ink truncate">{product}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-line-soft flex justify-end">
              <button onClick={() => setProductModal(null)} className="px-3 py-1 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-card-2 rounded border border-line">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;