import { formatDate } from "../../../utils/dateUtils";


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
  FaUniversity, FaWarehouse, FaCheckCircle, FaTimesCircle, FaSync, FaMapMarkerAlt, FaTimes,FaTv,
  FaChartBar, FaChartPie, FaListUl, FaArrowLeft, FaArrowRight, FaPlus, FaSearch, FaBox,
  FaBell, FaExclamationTriangle, FaExclamationCircle, FaInfoCircle, FaChevronRight,
} from "react-icons/fa";
import { LuLayoutDashboard } from "react-icons/lu";
import { FiTrendingUp, FiTrendingDown, FiMoreVertical } from "react-icons/fi";

import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { SparklineCard } from "../components/SparklineCard";
import { DashboardStatCard } from "../components/DashboardStatCard";
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

  type TaskPeriod = "day" | "week" | "month";
  const [taskPeriod, setTaskPeriod] = useState<TaskPeriod>(() => {
    try {
      const saved = localStorage.getItem("dashboard_tasks_period");
      if (saved && ["day", "week", "month"].includes(saved)) {
        return saved as TaskPeriod;
      }
    } catch (e) {}
    return "day";
  });

  const handleTaskPeriodChange = (p: TaskPeriod) => {
    setTaskPeriod(p);
    try { localStorage.setItem("dashboard_tasks_period", p); } catch (e) {}
  };

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
  const isDashboardLoading = dashboardCache.loading || !dashboardCache.data[0];
  const isDashboardSyncing = dashboardCache.refreshing;
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
    ["purchaseOrder", "productionOrder", "dailyPlan", "finishedGoodsStock", "rawMaterialStock", "salesOrder", "salesInvoice", "grnInvoice", "rawMaterial", "product"],
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
  const rawAccountsSummary = accSummaryList[0] || null;
  const accountsSummary = rawAccountsSummary ? { ...rawAccountsSummary, alerts: rawAccountsSummary.alerts || [], recentTransactions: rawAccountsSummary.recentTransactions || [], purchaseOverdue: rawAccountsSummary.purchaseOverdue || [], paymentOverdue: rawAccountsSummary.paymentOverdue || [] } : null;
  const isAccountsLoading = accountsSummaryCache.loading || !accountsSummary;

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

  const isDateInTaskPeriod = useCallback((dateStr: string, period: TaskPeriod) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;

    const now = new Date();

    if (period === "day") {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }

    if (period === "week") {
      // Monday 00:00:00 to Sunday 23:59:59 of current week
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
      return d >= monday && d <= sunday;
    }

    if (period === "month") {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      );
    }

    return false;
  }, []);

  // Today's / Period Tasks Stats
  const todayStats = useMemo(() => {
    const poToday = safe(productionOrders).filter((o: any) => isDateInTaskPeriod(o.createdAt || o.orderDate, taskPeriod));
    const soToday = safe(salesOrders).filter((o: any) => isDateInTaskPeriod(o.createdAt || o.orderDate, taskPeriod));
    const puToday = safe(purchaseOrders).filter((o: any) => isDateInTaskPeriod(o.createdAt || o.orderDate, taskPeriod));
    const wpToday = safe(weeklyPrograms).filter((w: any) => isDateInTaskPeriod(w.createdAt || w.startDate || w.date || w.scheduleDate, taskPeriod));
    const dpToday = safe(dailyPlans).filter((p: any) => (p.status?.toUpperCase() !== 'DRAFT') && isDateInTaskPeriod(p.productionDate || p.date || p.createdAt, taskPeriod));
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
  }, [productionOrders, salesOrders, purchaseOrders, weeklyPrograms, dailyPlans, taskPeriod, isDateInTaskPeriod]);

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
    const invoiceByOrderId = safe(salesInvoices).reduce((map: Record<number, any>, inv: any) => {
      if (inv.salesOrderId != null) map[inv.salesOrderId] = inv;
      return map;
    }, {});
    return safe(salesOrders)
      .filter((so: any) => (so.status || "").toUpperCase() !== "DRAFT")
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5)
      .map((so: any) => {
        const invoice = invoiceByOrderId[so.id];
        return { ...so, displayAmount: invoice ? Number(invoice.grandTotal) : Number(so.netAmount || 0) };
      });
  }, [salesOrders, salesInvoices]);

  // Customer Purchase Report — per-customer: which sales products purchased in last 3 months vs not purchased
  const customerPurchaseReport = useMemo(() => {
    const so = safe(salesOrders);
    const salesProducts = safe(allSalesProducts);
    const customers = safe(allCustomers);
    const productNames = salesProducts
      .map((p: any) => p.salesProductName || p.name || "")
      .filter(Boolean);
    const totalProducts = productNames.length;

    const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Map: customerName -> { productName -> { lastOrderDate, orderNo } }
    const customerProductLastOrder: Record<string, Record<string, { lastOrderDate: Date; orderNo?: string }>> = {};

    for (const order of so) {
      const cName = order.customer?.firmName || "Unknown";
      if (!customerProductLastOrder[cName]) customerProductLastOrder[cName] = {};
      const orderDateVal = order.orderDate || order.createdAt;
      const orderTime = orderDateVal ? new Date(orderDateVal) : new Date(0);
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const pName =
          item.salesProduct?.salesProductName ||
          item.salesProductName ||
          "";
        if (!pName) continue;

        const existing = customerProductLastOrder[cName][pName];
        if (!existing || orderTime.getTime() > existing.lastOrderDate.getTime()) {
          customerProductLastOrder[cName][pName] = {
            lastOrderDate: orderTime,
            orderNo: order.orderNo,
          };
        }
      }
    }

    interface ProductPurchaseDetail {
      name: string;
      lastOrderDate?: Date;
      daysAgo?: number;
      isPurchasedWithin3Months: boolean;
      hasEverPurchased: boolean;
    }

    interface CustomerReportItem {
      name: string;
      purchasedProducts: ProductPurchaseDetail[];
      notPurchasedProducts: ProductPurchaseDetail[];
    }

    const processCustomer = (cName: string): CustomerReportItem => {
      const productHistory = customerProductLastOrder[cName] || {};
      const purchasedProducts: ProductPurchaseDetail[] = [];
      const notPurchasedProducts: ProductPurchaseDetail[] = [];

      for (const pName of productNames) {
        const history = productHistory[pName];
        if (history && !isNaN(history.lastOrderDate.getTime()) && history.lastOrderDate.getTime() > 0) {
          const diffMs = now - history.lastOrderDate.getTime();
          const daysAgo = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
          const isWithin3Months = diffMs <= THREE_MONTHS_MS;

          const detail: ProductPurchaseDetail = {
            name: pName,
            lastOrderDate: history.lastOrderDate,
            daysAgo,
            isPurchasedWithin3Months: isWithin3Months,
            hasEverPurchased: true,
          };

          if (isWithin3Months) {
            purchasedProducts.push(detail);
          } else {
            notPurchasedProducts.push(detail);
          }
        } else {
          const detail: ProductPurchaseDetail = {
            name: pName,
            isPurchasedWithin3Months: false,
            hasEverPurchased: false,
          };
          notPurchasedProducts.push(detail);
        }
      }

      return {
        name: cName,
        purchasedProducts,
        notPurchasedProducts,
      };
    };

    const seen = new Set<string>();
    const result: CustomerReportItem[] = [];

    // Customers from master
    for (const c of customers) {
      const cName = c.firmName || "";
      if (!cName) continue;
      seen.add(cName);
      result.push(processCustomer(cName));
    }

    // Customers from orders not in master
    for (const cName of Object.keys(customerProductLastOrder)) {
      if (seen.has(cName)) continue;
      result.push(processCustomer(cName));
    }

    return {
      totalProducts,
      customers: result.sort(
        (a, b) => b.purchasedProducts.length - a.purchasedProducts.length || a.name.localeCompare(b.name)
      ),
    };
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
              
            <button
              type="button"
              onClick={() => navigate("/tv-dashboard")}
              title="Open the full-screen TV dashboard"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-accent/10 text-accent border border-accent/20 shadow-xs hover:bg-accent/20 transition-colors cursor-pointer"
            >
              <FaTv className="text-[11px]" /> TV Dashboard
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
           ROW 0  –  ACCOUNTS SUMMARY (Busy-style)
           6 stat cards + Quick Actions + Alerts + Recent Txns
           ══════════════════════════════════════════════════════ */}
        {/* 6 Top Stat Cards (Using Reusable DashboardStatCard Component) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-3 sm:mb-4">

          {/* TOTAL SALES */}
          <DashboardStatCard
            title="Total Sales"
            amount={isAccountsLoading ? undefined : accountsSummary?.totalSales}
            countText={isAccountsLoading ? null : (accountsSummary ? `${accountsSummary.salesVoucherCount ?? 0} vouchers` : "0 vouchers")}
            onClick={() => navigate("/sales-invoices")}
            backgroundGradient="linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)"
            borderColor="rgba(52,211,153,0.25)"
            titleColorClass="text-emerald-200"
            bulletColorClass="bg-emerald-400"
            countTextColorClass="text-emerald-100/80"
            bgIcon={FaArrowUp}
            trend={cardTrends.sales}
            loading={isAccountsLoading}
          />

          {/* TOTAL PURCHASE */}
          <DashboardStatCard
            title="Total Purchase"
            amount={isAccountsLoading ? undefined : accountsSummary?.totalPurchase}
            countText={isAccountsLoading ? null : (accountsSummary ? `${accountsSummary.purchaseVoucherCount ?? 0} vouchers` : "0 vouchers")}
            onClick={() => navigate("/invoice")}
            backgroundGradient="linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #1d4ed8 100%)"
            borderColor="rgba(96,165,250,0.25)"
            titleColorClass="text-blue-200"
            bulletColorClass="bg-blue-400"
            countTextColorClass="text-blue-100/80"
            bgIcon={FaCheckCircle}
            trend={cardTrends.purchase}
            loading={isAccountsLoading}
          />

          {/* RECEIVABLE */}
          <DashboardStatCard
            title="Receivable"
            amount={isAccountsLoading || !accountsSummary ? undefined : Math.abs(Number(accountsSummary.totalReceivable) || 0)}
            countText={isAccountsLoading || !accountsSummary ? null : `${accountsSummary.receivableCustomerCount ?? 0} customers`}
            suffixBadge={accountsSummary && accountsSummary.totalReceivable < 0 ? "Cr" : undefined}
            suffixBadgeColorClass="text-emerald-300 border-emerald-400/30"
            onClick={() => navigate("/accounts/receivable")}
            backgroundGradient="linear-gradient(135deg, #451a03 0%, #78350f 50%, #92400e 100%)"
            borderColor="rgba(251,191,36,0.25)"
            titleColorClass="text-amber-200"
            bulletColorClass="bg-amber-400"
            countTextColorClass="text-amber-100/80"
            bgIcon={FaHandHoldingUsd}
            trend={cardTrends.receivable}
            loading={isAccountsLoading}
          />

          {/* PAYABLE */}
          <DashboardStatCard
            title="Payable"
            amount={isAccountsLoading || !accountsSummary ? undefined : Math.abs(Number(accountsSummary.totalPayable) || 0)}
            countText={isAccountsLoading || !accountsSummary ? null : `${accountsSummary.payableSupplierCount ?? 0} suppliers`}
            suffixBadge={accountsSummary && accountsSummary.totalPayable < 0 ? "Dr" : undefined}
            suffixBadgeColorClass="text-rose-300 border-rose-400/30"
            onClick={() => navigate("/accounts/payable")}
            backgroundGradient="linear-gradient(135deg, #4c0519 0%, #9f1239 50%, #be123c 100%)"
            borderColor="rgba(251,113,133,0.25)"
            titleColorClass="text-rose-200"
            bulletColorClass="bg-rose-400"
            countTextColorClass="text-rose-100/80"
            bgIcon={FaFileInvoiceDollar}
            trend={cardTrends.payable}
            loading={isAccountsLoading}
          />

          {/* CASH */}
          <DashboardStatCard
            title="Cash"
            amount={isAccountsLoading || !accountsSummary ? undefined : Math.abs(Number(accountsSummary.totalCashInHand) || 0)}
            countText={isAccountsLoading || !accountsSummary ? null : `${accountsSummary.cashAccountCount || 0} accounts`}
            onClick={() => navigate("/accounts/bank-accounts?filter=cash")}
            backgroundGradient="linear-gradient(135deg, #042f2e 0%, #115e59 50%, #0d9488 100%)"
            borderColor="rgba(45,212,191,0.25)"
            titleColorClass="text-teal-200"
            bulletColorClass="bg-teal-400"
            countTextColorClass="text-teal-100/80"
            bgIcon={FaMoneyBillWave}
            trend={cardTrends.cash}
            loading={isAccountsLoading}
          />

          {/* BANK */}
          <DashboardStatCard
            title="Bank"
            amount={isAccountsLoading || !accountsSummary ? undefined : Math.abs(Number(accountsSummary.totalBankBalance) || 0)}
            countText={isAccountsLoading || !accountsSummary ? null : `${accountsSummary.bankAccountCount || 0} accounts`}
            onClick={() => navigate("/accounts/bank-accounts?filter=bank")}
            backgroundGradient="linear-gradient(135deg, #2e1065 0%, #4c1d95 50%, #6d28d9 100%)"
            borderColor="rgba(167,139,250,0.25)"
            titleColorClass="text-violet-200"
            bulletColorClass="bg-violet-400"
            countTextColorClass="text-violet-100/80"
            bgIcon={FaUniversity}
            trend={cardTrends.bank}
            loading={isAccountsLoading}
          />

        </div>        {/* ══════════════════════════════════════════════════════
           ROW 2  –  Sales/Purchase Trend Chart (Left) + Today's Tasks & Recent Sales (Right)
           ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Left: Sales & Purchase Trend Chart */}
          {showTrend && (
            <div className="w-full" style={{ height: "530px", maxHeight: "530px" }}>
              <SalesPurchaseTrendChart
                salesOrders={salesOrders}
                purchaseOrders={purchaseOrders}
                productionOrders={productionOrders}
                salesInvoices={salesInvoices}
                purchaseInvoices={purchaseInvoices}
                loading={isDashboardLoading}
              />
            </div>
          )}

          {/* Right: Today's Tasks & Production (Top) + Recent Sales Orders (Bottom) */}
          <div className="flex flex-col gap-3 sm:gap-4 w-full" style={{ height: "530px", maxHeight: "530px" }}>
            {/* 1. Tasks / Daily Production Planning */}
            {showTasks && (
              <div
                className="bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden w-full shrink-0"
                style={{ height: "257px", minHeight: "257px", maxHeight: "257px" }}
              >
                {/* Card Header */}
                <div className="shrink-0 px-3.5 py-2.5 border-b border-line-soft flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <FaCalendarCheck className="text-xs" />
                    </div>
                    <div className="text-[12px] uppercase tracking-wider font-extrabold text-ink truncate">
                      {taskPeriod === "day"
                        ? "Today's Tasks & Production"
                        : taskPeriod === "week"
                        ? "This Week's Tasks & Production"
                        : "This Month's Tasks & Production"}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Day / Week / Month Filter Tabs */}
                    <div className="flex items-center gap-0.5 bg-card-2 p-0.5 rounded-lg border border-line-soft">
                      {(["day", "week", "month"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleTaskPeriodChange(p)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize transition-all duration-200 cursor-pointer ${
                            taskPeriod === p
                              ? "bg-emerald-500 text-white shadow-xs font-black"
                              : "text-ink-muted hover:text-ink hover:bg-card/50"
                          }`}
                        >
                          {p === "day" ? "Day" : p === "week" ? "Week" : "Month"}
                        </button>
                      ))}
                    </div>

                    {isDashboardLoading ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-white/10 text-ink-muted border border-line-soft uppercase tracking-wider shrink-0">
                        <FaSync className="animate-spin text-emerald-400 text-[8px]" /> Loading...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {todayStats.tasksList.length} Tasks
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div
                  className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 [&::-webkit-scrollbar]:!block [&::-webkit-scrollbar]:!w-1.5 [&::-webkit-scrollbar-track]:!bg-transparent [&::-webkit-scrollbar-thumb]:!bg-slate-700/60 [&::-webkit-scrollbar-thumb]:!rounded-full hover:[&::-webkit-scrollbar-thumb]:!bg-slate-500"
                  style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(100, 116, 139, 0.4) transparent" }}
                >
                  {isDashboardLoading ? (
                    <div className="space-y-2 animate-pulse">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="flex items-center justify-between p-2.5 rounded-xl bg-card-2 border border-line-soft">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-white/10 shrink-0" />
                            <div className="space-y-1.5 min-w-0">
                              <div className="h-3 bg-white/15 rounded w-28" />
                              <div className="h-2.5 bg-white/10 rounded w-40" />
                            </div>
                          </div>
                          <div className="h-4 w-16 bg-white/10 rounded-full shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : todayStats.tasksList.length > 0 ? (
                    todayStats.tasksList.map((task: any, i: number) => {
                      const linkedPo = safe(productionOrders).find((po: any) => po.productionOrderId === task.productionOrderId || po.id === task.productionOrderId);
                      const productName = task.product?.productName || task.productName || task.productionOrder?.productItem?.productName || task.productionOrder?.product?.productName || linkedPo?.productItem?.productName || linkedPo?.product?.productName || linkedPo?.productName || "No Product Linked";
                      const machineName = task.machine?.machineName || task.machineName || task.weeklyProgram?.machine?.machineName || task.weeklyMachineProgram?.machine?.machineName || `Plan #${task.dailyPlanId || task.id || i + 1}`;
                      const shiftName = task.shift?.shiftName || task.shiftName || task.weeklyProgram?.shift?.shiftName || task.weeklyMachineProgram?.shift?.shiftName || "General Shift";
                      
                      const rawDate = task.productionDate || task.date || task.createdAt;
                      const dateObj = rawDate ? new Date(rawDate) : null;
                      const dateText = dateObj && !isNaN(dateObj.getTime()) ? (
                        dateObj.toDateString() === new Date().toDateString()
                          ? "Today"
                          : formatDate(dateObj)
                      ) : "";

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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[12px] font-bold text-ink truncate">{machineName}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-card text-ink-muted border border-line-soft">
                                  {shiftName}
                                </span>
                                {dateText && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {dateText}
                                  </span>
                                )}
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
                      <p className="text-[12px] font-bold text-ink-muted">
                        No tasks scheduled for {taskPeriod === "day" ? "today" : taskPeriod === "week" ? "this week" : "this month"}
                      </p>
                      <p className="text-[10px] text-ink-subtle mt-0.5">
                        Daily production plans for {taskPeriod === "day" ? "today" : taskPeriod === "week" ? "this week" : "this month"} will appear here
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Recent Sales Orders */}
            {showRecentSales && (
              <div
                className="bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden w-full shrink-0"
                style={{ height: "257px", minHeight: "257px", maxHeight: "257px" }}
              >
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
                    {isDashboardLoading ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-ink-muted border border-line-soft uppercase">
                        Loading...
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase">
                        Latest {recentSales.length}
                      </span>
                    )}
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
                <div
                  className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 [&::-webkit-scrollbar]:!block [&::-webkit-scrollbar]:!w-1.5 [&::-webkit-scrollbar-track]:!bg-transparent [&::-webkit-scrollbar-thumb]:!bg-slate-700/60 [&::-webkit-scrollbar-thumb]:!rounded-full hover:[&::-webkit-scrollbar-thumb]:!bg-slate-500"
                  style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(100, 116, 139, 0.4) transparent" }}
                >
                  {isDashboardLoading ? (
                    <div className="space-y-2 animate-pulse">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="flex items-center justify-between p-2.5 rounded-xl bg-card-2 border border-line-soft">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-white/10 shrink-0" />
                            <div className="space-y-1.5 min-w-0">
                              <div className="h-3 bg-white/15 rounded w-20" />
                              <div className="h-2.5 bg-white/10 rounded w-32" />
                            </div>
                          </div>
                          <div className="space-y-1 text-right flex flex-col items-end shrink-0">
                            <div className="h-3 bg-white/15 rounded w-16" />
                            <div className="h-3 w-12 bg-white/10 rounded-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : recentSales.length === 0 ? (
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
                              ₹{so.displayAmount.toLocaleString("en-IN")}
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6" style={{ minHeight: "360px" }}>
          {/* Left 3/4: Alerts (1/3) + Recent Transactions (2/3) */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 h-full">
            {/* Alerts (1 of 3 inside 3/4) */}
            <div className="bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden h-[440px]">
              <div className="shrink-0 px-3.5 py-2.5 border-b border-line-soft flex items-center justify-between">
                <div className="text-[12px] uppercase tracking-wider font-extrabold text-ink flex items-center gap-1.5">
                  <FaBell className="text-amber-400 text-xs" />
                  <span>Alerts</span>
                </div>
                {isAccountsLoading ? (
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-black px-2 py-0.5 rounded-full bg-white/10 text-ink-muted border border-line-soft uppercase tracking-wider">
                    <FaSync className="animate-spin text-amber-400 text-[8px]" />
                    Checking...
                  </span>
                ) : accountsSummary?.alerts && accountsSummary.alerts.length > 0 ? (
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
                {isAccountsLoading ? (
                  <div className="p-1 space-y-2.5 animate-pulse">
                    <div className="p-3 rounded-lg bg-card-2 border border-line-soft space-y-2">
                      <div className="h-3.5 bg-white/15 rounded w-4/5" />
                      <div className="h-2.5 bg-white/10 rounded w-1/2" />
                    </div>
                    <div className="p-3 rounded-lg bg-card-2 border border-line-soft space-y-2">
                      <div className="h-3.5 bg-white/15 rounded w-3/4" />
                      <div className="h-2.5 bg-white/10 rounded w-2/5" />
                    </div>
                    <div className="p-3 rounded-lg bg-card-2 border border-line-soft space-y-2">
                      <div className="h-3.5 bg-white/15 rounded w-2/3" />
                      <div className="h-2.5 bg-white/10 rounded w-1/3" />
                    </div>
                  </div>
                ) : !accountsSummary || accountsSummary.alerts.length === 0 ? (
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
                      <div className="w-full">
                        <div className="flex items-center justify-between gap-2.5">
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
                        {a.details && a.details.length > 0 && (
                          <div className="ml-5 mt-1.5 space-y-1">
                            {a.details.map((d, di) => (
                              <div key={di} className="flex items-center justify-between text-[10px] text-ink-subtle">
                                <span className="truncate mr-2">{d.name}</span>
                                <span className="font-semibold text-ink whitespace-nowrap">{d.amount}</span>
                              </div>
                            ))}
                          </div>
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

              {!isAccountsLoading && accountsSummary && accountsSummary.alerts.length > 0 && (
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
            <div className="md:col-span-2 bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden h-[440px]">
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
                {isAccountsLoading ? (
                  <div className="p-4 space-y-3 animate-pulse">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="flex items-center justify-between py-2 border-b border-line-soft/40">
                        <div className="h-3 bg-white/15 rounded w-20" />
                        <div className="h-3 bg-white/10 rounded w-16" />
                        <div className="h-3 bg-white/15 rounded w-36" />
                        <div className="h-3 bg-white/10 rounded w-20" />
                        <div className="h-3 bg-white/15 rounded w-16" />
                      </div>
                    ))}
                  </div>
                ) : !accountsSummary || accountsSummary.recentTransactions.length === 0 ? (
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
                              {formatDate(t.date)}
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
            <div className="lg:col-span-1 bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden h-[440px]">
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
                  {isDashboardLoading ? (
                    <div className="space-y-3 animate-pulse">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div key={n} className="space-y-1.5">
                          <div className="flex justify-between">
                            <div className="h-3 bg-white/15 rounded w-24" />
                            <div className="h-3 bg-white/10 rounded w-10" />
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full w-full" />
                        </div>
                      ))}
                    </div>
                  ) : topProducts.length === 0 ? (
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
                  {isDashboardLoading ? (
                    <div className="w-full h-full min-h-[220px] flex flex-col justify-between p-2 animate-pulse">
                      <div className="flex items-end justify-between gap-2 h-[170px] border-b border-line-soft/40 px-2">
                        {[40, 70, 90, 60, 50].map((h, idx) => (
                          <div key={idx} className="flex-1 flex justify-center items-end h-full">
                            <div className="w-full max-w-[24px] bg-teal-500/20 rounded-t" style={{ height: `${h}%` }} />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between px-2 pt-2">
                        {[1, 2, 3, 4, 5].map((_, idx) => (
                          <div key={idx} className="h-2 w-8 bg-white/10 rounded" />
                        ))}
                      </div>
                    </div>
                  ) : topProducts.length === 0 ? (
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
                  {isDashboardLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 animate-pulse space-y-3">
                      <div className="w-28 h-28 rounded-full border-4 border-teal-500/20 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white/10" />
                      </div>
                      <div className="w-full space-y-1.5 pt-2">
                        <div className="h-2.5 bg-white/15 rounded w-3/4 mx-auto" />
                        <div className="h-2.5 bg-white/10 rounded w-1/2 mx-auto" />
                      </div>
                    </div>
                  ) : topProducts.length === 0 ? (
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
        </div>

        {/* ══════════════════════════════════════════════════════
           ROW 3.5  –  Purchase Overdue (Left) + Payment Overdue (Right)
           ══════════════════════════════════════════════════════ */}
        {accountsSummary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Purchase Overdue */}
            <div className="bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden" style={{ height: "420px" }}>
              <div className="shrink-0 px-3.5 py-2.5 border-b border-line-soft flex items-center justify-between">
                <div className="text-[12px] uppercase tracking-wider font-extrabold text-ink flex items-center gap-1.5">
                  <FaShoppingCart className="text-amber-400 text-xs" />
                  <span>Purchase Overdue</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  accountsSummary.purchaseOverdue.length > 0
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                }`}>
                  {accountsSummary.purchaseOverdue.length} Customer{accountsSummary.purchaseOverdue.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {accountsSummary.purchaseOverdue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                      <FaCheckCircle className="text-sm" />
                    </div>
                    <p className="text-xs font-bold text-ink">All Clear</p>
                    <p className="text-[10px] text-ink-subtle mt-0.5">No purchase overdue customers</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-card-2 text-ink-subtle uppercase text-[10px] font-bold tracking-wide border-b border-line-soft sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 bg-card-2">Customer</th>
                        <th className="px-2 py-2 bg-card-2 text-center">Days Overdue</th>
                        <th className="px-2 py-2 bg-card-2 text-center">Credit Days</th>
                        <th className="px-2 py-2 bg-card-2">Last Purchase</th>
                        <th className="px-3 py-2 bg-card-2 text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {accountsSummary.purchaseOverdue.map((item) => (
                        <tr key={item.customerId} className="hover:bg-card-2 transition-colors">
                          <td className="px-3 py-2 text-[11px] font-semibold text-ink truncate max-w-[160px]">{item.name}</td>
                          <td className="px-2 py-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                              {item.daysSince}d
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-[11px] text-ink-muted font-mono">{item.creditDays}d</td>
                          <td className="px-2 py-2 text-[10px] font-mono text-ink-muted whitespace-nowrap">
                            {formatDate(item.lastDate)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-ink whitespace-nowrap text-[11px]">
                            ₹{item.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {accountsSummary.purchaseOverdue.length > 0 && (
                <div className="shrink-0 px-3 py-1.5 bg-card-2/50 border-t border-line-soft flex items-center justify-between text-[10px] text-ink-subtle">
                  <span className="font-medium">Total: {accountsSummary.purchaseOverdue.length} customer{accountsSummary.purchaseOverdue.length !== 1 ? "s" : ""}</span>
                  {accountsSummary.purchaseOverdue.length > 10 && <span className="text-[9px] text-ink-muted">Scroll to see all</span>}
                </div>
              )}
            </div>

            {/* Payment Overdue */}
            <div className="bg-card border border-line-soft rounded-xl shadow-md flex flex-col overflow-hidden" style={{ height: "420px" }}>
              <div className="shrink-0 px-3.5 py-2.5 border-b border-line-soft flex items-center justify-between">
                <div className="text-[12px] uppercase tracking-wider font-extrabold text-ink flex items-center gap-1.5">
                  <FaMoneyBillWave className="text-rose-400 text-xs" />
                  <span>Payment Overdue</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  accountsSummary.paymentOverdue.length > 0
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                }`}>
                  {accountsSummary.paymentOverdue.length} Customer{accountsSummary.paymentOverdue.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {accountsSummary.paymentOverdue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                      <FaCheckCircle className="text-sm" />
                    </div>
                    <p className="text-xs font-bold text-ink">All Clear</p>
                    <p className="text-[10px] text-ink-subtle mt-0.5">No payment overdue customers</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-card-2 text-ink-subtle uppercase text-[10px] font-bold tracking-wide border-b border-line-soft sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 bg-card-2">Customer</th>
                        <th className="px-2 py-2 bg-card-2 text-center">Days Overdue</th>
                        <th className="px-2 py-2 bg-card-2 text-center">Credit Days</th>
                        <th className="px-2 py-2 bg-card-2">Last Payment</th>
                        <th className="px-3 py-2 bg-card-2 text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {accountsSummary.paymentOverdue.map((item) => (
                        <tr key={item.customerId} className="hover:bg-card-2 transition-colors">
                          <td className="px-3 py-2 text-[11px] font-semibold text-ink truncate max-w-[160px]">{item.name}</td>
                          <td className="px-2 py-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
                              {item.daysSince}d
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-[11px] text-ink-muted font-mono">{item.creditDays}d</td>
                          <td className="px-2 py-2 text-[10px] font-mono text-ink-muted whitespace-nowrap">
                            {formatDate(item.lastDate)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-ink whitespace-nowrap text-[11px]">
                            ₹{item.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {accountsSummary.paymentOverdue.length > 0 && (
                <div className="shrink-0 px-3 py-1.5 bg-card-2/50 border-t border-line-soft flex items-center justify-between text-[10px] text-ink-subtle">
                  <span className="font-medium">Total: {accountsSummary.paymentOverdue.length} customer{accountsSummary.paymentOverdue.length !== 1 ? "s" : ""}</span>
                  {accountsSummary.paymentOverdue.length > 10 && <span className="text-[9px] text-ink-muted">Scroll to see all</span>}
                </div>
              )}
            </div>
          </div>
        )}

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

                  {/* In-Card Toggle: Purchased (≤3 Mo) vs Not Purchased */}
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
                            <span>Purchased (≤3 Mo) ({purchasedCount})</span>
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
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" title="Purchased within last 90 days">
                      3-Month Window
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/30">
                      {customerPurchaseReport.totalProducts} Products · {customerPurchaseReport.customers.length} Customers
                    </span>
                  </div>
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
                const filtered = rawList.filter((item) =>
                  item.name.toLowerCase().includes(customerProductSearch.toLowerCase())
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
                        filtered.map((item, idx) => {
                          const isInactive = !item.isPurchasedWithin3Months && item.hasEverPurchased;

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded-lg bg-card-2 border border-line-soft hover:bg-card transition-colors group gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                    isPurchased
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                      : isInactive
                                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <span
                                    className="text-xs font-semibold text-ink truncate group-hover:text-white transition-colors"
                                    title={item.name}
                                  >
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] text-ink-subtle flex items-center gap-1 mt-0.5">
                                    {item.hasEverPurchased && item.lastOrderDate ? (
                                      <>
                                        <span>Last ordered:</span>
                                        <span className="font-semibold text-ink-muted">
                                          {formatDate(new Date())}
                                        </span>
                                        <span className="text-[9px]">({item.daysAgo}d ago)</span>
                                        {isInactive && (
                                          <span className="text-amber-400 font-bold ml-1">• Inactive for &gt;3 Mo</span>
                                        )}
                                      </>
                                    ) : (
                                      <span>Never ordered by customer</span>
                                    )}
                                  </span>
                                </div>
                              </div>
                              <span
                                className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                                  isPurchased
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                    : isInactive
                                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                    : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                }`}
                              >
                                {isPurchased ? "Active (≤3 Mo)" : isInactive ? "Inactive (>3 Mo)" : "Never Bought"}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Customer Overview Table */
              <div className="flex-1 min-h-0 overflow-auto">
                {isDashboardLoading ? (
                  <div className="p-3 space-y-2 animate-pulse">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-card-2 border border-line-soft">
                        <div className="h-3.5 bg-white/15 rounded w-1/3" />
                        <div className="flex items-center gap-4">
                          <div className="h-4 bg-emerald-500/20 rounded w-8" />
                          <div className="h-4 bg-rose-500/20 rounded w-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : customerPurchaseReport.customers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-ink-subtle">No customers available</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-card-2 text-ink-subtle uppercase text-[10px] font-bold tracking-wide border-b border-line-soft sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 bg-card-2">Customer</th>
                        <th className="px-3 py-2 bg-card-2 text-center" title="Purchased within the last 3 months (90 days)">Purchased (≤3 Mo)</th>
                        <th className="px-3 py-2 bg-card-2 text-center" title="Not purchased in the last 3 months">Not Purchased</th>
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
                                title={`View ${row.purchasedProducts.length} active products (purchased in last 3 months) for ${row.name}`}
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
                                title={`View ${row.notPurchasedProducts.length} not purchased / inactive products for ${row.name}`}
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
          isParentLoading={isDashboardLoading}
        />

        {/* ══════════════════════════════════════════════════════
           ROW 5  –  WORKFORCE & SHIFT ATTENDANCE SNAPSHOT
           ══════════════════════════════════════════════════════ */}
        <WorkforceShiftAttendance
          employeesCount={employeesCount}
          dailyPlans={dailyPlans}
          weeklyPrograms={weeklyPrograms}
          isParentLoading={isDashboardLoading}
        />
      </div>

    </div>
  );
};

export default DashboardPage;