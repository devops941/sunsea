import React, { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { useSocketSync } from "../../../hooks/useSocketSync";
import { usePermission } from "../../../hooks/usePermission";

// Actions
import { fetchProductionOrders } from "../../../features/production-orders/productionOrderSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchWeeklyPrograms } from "../../../features/weekly-programs/weeklyProgramSlice";
import { fetchRawMaterials } from "../../../features/raw-materials/rawMaterialSlice";

// Services
import { salesOrderService } from "../../../services/salesOrderService";
import { purchaseOrderService } from "../../../services/purchaseOrderService";
import { dailyPlanService } from "../../../services/dailyPlanService";
import { finishedGoodsStockService } from "../../../services/finishedGoodsStockService";
import { rawMaterialStockService } from "../../../services/rawMaterialStockService";

// Hooks
import { useProducts } from "../../../hooks/useProducts";
import { useEmployees } from "../../../hooks/useEmployees";
import { useUsers } from "../../../hooks/useUsers";

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
} from "react-icons/fa";
import { FiTrendingUp, FiTrendingDown, FiMoreVertical } from "react-icons/fi";

import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import DashboardFooter from "../components/DashboardFooter";
import { SparklineCard } from "../components/SparklineCard";
import { Card } from "../components/Card";
import SalesPurchaseTrendChart from "../components/SalesPurchaseTrendChart";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../../components/ui/chart";

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
  const dispatch = useAppDispatch();
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Extra data not in Redux
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [dailyPlans, setDailyPlans] = useState<any[]>([]);
  const [finishedGoodsStocks, setFinishedGoodsStocks] = useState<any[]>([]);
  const [rawMaterialStocks, setRawMaterialStocks] = useState<any[]>([]);

  // Permissions
  const { can } = usePermission();
  const canViewProduction = can("production_orders.view");
  const canViewMachines = can("machines.view");
  const canViewSchedules = can("weekly_programs.view");
  const canViewRawMaterials = can("raw_materials.view");
  const canViewProducts = can("products.view");
  const canViewEmployees = can("employees.view");
  const canViewUsers = can("users.view");

  // Redux state
  const { data: productionOrders, loading: poLoading } = useAppSelector((s: any) => s.productionOrders || { data: [], loading: false });
  const { data: machines, loading: mLoading } = useAppSelector((s: any) => s.machines || { data: [], loading: false });
  const { data: weeklyPrograms } = useAppSelector((s: any) => s.weeklyPrograms || { data: [] });
  const { data: rawMaterials } = useAppSelector((s: any) => s.rawMaterials || { data: [] });

  // Custom hooks
  const { products, loadProducts, loading: pLoading } = useProducts();
  const { employees, loadEmployees } = useEmployees();
  const { users, loadUsers } = useUsers();

  // ── Bootstrap ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingInitial(true);
      try {
        const calls: Promise<any>[] = [];
        if (canViewProduction) calls.push(dispatch(fetchProductionOrders()) as any);
        if (canViewMachines) calls.push(dispatch(fetchMachines()) as any);
        if (canViewSchedules) calls.push(dispatch(fetchWeeklyPrograms(undefined)) as any);
        if (canViewRawMaterials) calls.push(dispatch(fetchRawMaterials(undefined)) as any);
        if (canViewProducts) calls.push(Promise.resolve(loadProducts()));
        if (canViewEmployees) calls.push(Promise.resolve(loadEmployees({ limit: 1000 })));
        if (canViewUsers) calls.push(Promise.resolve(loadUsers()));

        // Sales & Purchase
        calls.push(
          salesOrderService.fetchAll().then((res: any) => {
            const list = res?.data || res || [];
            setSalesOrders(Array.isArray(list) ? list : []);
          }).catch(() => { })
        );
        calls.push(
          purchaseOrderService.fetchAll().then((res: any) => {
            const list = res?.data || res || [];
            setPurchaseOrders(Array.isArray(list) ? list : []);
          }).catch(() => { })
        );
        calls.push(
          dailyPlanService.getAll().then((res: any) => {
            const list = Array.isArray(res?.data?.dailyPlans) ? res.data.dailyPlans : (Array.isArray(res?.dailyPlans) ? res.dailyPlans : (Array.isArray(res) ? res : []));
            setDailyPlans(list);
          }).catch(() => { })
        );
        calls.push(
          finishedGoodsStockService.fetchAll().then((res: any) => {
            const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setFinishedGoodsStocks(list);
          }).catch(() => { })
        );
        calls.push(
          rawMaterialStockService.fetchAll().then((res: any) => {
            const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setRawMaterialStocks(list);
          }).catch(() => { })
        );

        await Promise.allSettled(calls);
      } catch (e) {
        console.error("Dashboard load error", e);
      } finally {
        setLoadingInitial(false);
      }
    };
    load();
  }, [dispatch, loadProducts, loadEmployees, loadUsers,
    canViewProduction, canViewMachines, canViewSchedules,
    canViewRawMaterials, canViewProducts, canViewEmployees, canViewUsers]);

  // Real-time sockets
  useSocketSync("productionOrder", undefined, canViewProduction ? () => dispatch(fetchProductionOrders()) : undefined);
  useSocketSync("weeklyProgram", undefined, canViewSchedules ? () => dispatch(fetchWeeklyPrograms(undefined)) : undefined);
  useSocketSync("rawMaterial", undefined, canViewRawMaterials ? () => dispatch(fetchRawMaterials(undefined)) : undefined);

  /* ─── DERIVED DATA ────────────────────────────────────────── */
  const safe = (d: any) => (Array.isArray(d) ? d : []);

  // Top stats
  const topStats = useMemo(() => {
    const po = safe(productionOrders);
    const so = safe(salesOrders);
    const purc = safe(purchaseOrders);
    const prod = safe(products);
    const rm = safe(rawMaterials);
    const emp = safe(employees);
    const usr = safe(users);
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

    const pendingAmount = so.filter((s: any) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED').reduce((acc: number, s: any) => acc + (Number(s.netAmount) || 0), 0);
    const uniqueCustomers = new Set(so.filter((s: any) => s.customer).map((s: any) => s.customer?.id || s.customer?.firmName)).size;

    return {
      salesOrders: so.length,
      purchaseOrders: purc.length,
      productionOrders: po.length,
      weeklySchedules: wp.length,
      machines: mach.length,
      products: prod.length,
      rawMaterials: rm.length,
      finishedGoods: totalFinished,
      employees: emp.filter((e: any) => e.status === "active").length,
      activeUsers: usr.filter((u: any) => u.isActive !== false).length,
      totalRevenue,
      lastMonthRevenue,
      pendingAmount,
      uniqueCustomers,
    };
  }, [productionOrders, salesOrders, purchaseOrders, products, rawMaterials, employees, users, machines, weeklyPrograms]);

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
    const fg = safe(finishedGoodsStocks);
    const rm = safe(rawMaterialStocks);
    const itemMap: Record<string, { qty: number, storeName: string, productName: string, uom: string }> = {};
    
    // Process Finished Goods
    fg.forEach((item: any) => {
      const storeName = item.store?.storeName || "Main Warehouse";
      const qty = Number(item.onHandQty) || 0;
      const productName = item.product?.productName || "Unknown Product";
      const uom = formatUom(item.product?.uom?.uomCode);
      const key = `${storeName}::${productName}`;
      
      if (!itemMap[key]) {
        itemMap[key] = { qty: 0, storeName, productName, uom };
      }
      itemMap[key].qty += qty;
    });

    // Process Raw Materials
    rm.forEach((item: any) => {
      const storeName = item.store?.storeName || "Main Warehouse";
      const qty = Number(item.onHandQty) || 0;
      const productName = item.rawMaterial?.materialName || item.rawMaterial?.name || item.materialName || "Unknown RM";
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
        value: 1, // Equal slice for each unique item
        displayValue: `${obj.qty} ${obj.uom}`.trim(),
        products: obj.storeName,
        color: PIE_COLORS[i % PIE_COLORS.length],
      }))
      .sort((a, b) => b.name.localeCompare(a.name));

    return data.length > 0 ? data : [{ name: "No Stock", value: 1, displayValue: "0", products: "", color: "#cbd5e1" }];
  }, [finishedGoodsStocks, rawMaterialStocks]);




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
    const p = safe(products);
    const fg = safe(finishedGoodsStocks);
    return [...p]
      .map((prod: any) => {
        const stockItems = fg.filter((item: any) => item.productItemId === prod.id || item.productItemId === String(prod.id));
        const totalStock = stockItems.reduce((acc, item) => acc + (Number(item.onHandQty) || 0), 0);
        return {
          name: prod.productName || "Unknown",
          value: totalStock,
        };
      })
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 7);
  }, [products, finishedGoodsStocks]);

  // Recent orders
  const recentSales = useMemo(() => {
    return safe(salesOrders)
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [salesOrders]);

  const anyLoading = loadingInitial || poLoading || mLoading || pLoading;

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 min-h-screen">
      {anyLoading && <CommonLoader text="Loading ..." />}

      <div className="w-full px-4 py-6 sm:px-6 lg:px-8 mx-auto max-w-[1440px]">

        {/* ── HEADER ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-slate-800 via-indigo-700 to-purple-700 bg-clip-text text-transparent">Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1 font-medium">Complete overview of all ERP modules</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="bg-white border border-slate-200 text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
              Overview
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
           ROW 1  –  Top Sparkline Stats (5 cards across)
           ══════════════════════════════════════════════════════ */}


        {/* ══ ROW 1 – Top Stat Cards ══ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <SparklineCard title="Last Month Income" value={`₹${topStats.lastMonthRevenue.toLocaleString()}`} icon={FaCalendarAlt} iconBg="" gradient="bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700" />
          <SparklineCard title="Total Income" value={`₹${topStats.totalRevenue.toLocaleString()}`} icon={FaMoneyBillWave} iconBg="" gradient="bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600" />
          <SparklineCard title="Customers" value={topStats.uniqueCustomers} icon={FaUserFriends} iconBg="" gradient="bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600" />
          <SparklineCard title="Pending Amount" value={`₹${topStats.pendingAmount.toLocaleString()}`} icon={FaHourglassHalf} iconBg="" gradient="bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-500" />
          <SparklineCard title="Products" value={topStats.products} icon={FaBoxOpen} iconBg="" gradient="bg-gradient-to-br from-rose-400 via-pink-500 to-fuchsia-600" />
        </div>

        {/* ══════════════════════════════════════════════════════
           ROW 2.5  –  Trend Chart (Full Width)
           ══════════════════════════════════════════════════════ */}
        <div className="mb-6">
          <SalesPurchaseTrendChart
            salesOrders={salesOrders}
            purchaseOrders={purchaseOrders}
            productionOrders={productionOrders}
          />
        </div>

        {/* ══════════════════════════════════════════════════════
           ROW 2b  –  Today's Tasks | Inventory Doughnut
           ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          {/* Today's Tasks List */}
          <Card title="Today's Tasks" badge="Live" className="min-h-[340px]">
            <div className="flex flex-col gap-4 h-full">
              {todayStats.tasksList.length > 0 ? (
                todayStats.tasksList.map((task: any, i: number) => {
                  const linkedPo = safe(productionOrders).find((po: any) => po.productionOrderId === task.productionOrderId || po.id === task.productionOrderId);
                  const productName = task.product?.productName || task.productName || task.productionOrder?.productItem?.productName || task.productionOrder?.product?.productName || linkedPo?.productItem?.productName || linkedPo?.product?.productName || linkedPo?.productName || "No Product Linked";
                  const machineName = task.machine?.machineName || task.machineName || task.weeklyProgram?.machine?.machineName || `Plan #${task.dailyPlanId || task.id || i + 1}`;
                  const shiftName = task.shift?.shiftName || task.shiftName || task.weeklyProgram?.shift?.shiftName || "No Shift";

                  return (
                    <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/50 border border-indigo-100/60 hover:from-indigo-50 hover:to-purple-50 hover:border-indigo-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 group cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm bg-gradient-to-br from-indigo-500 to-purple-600 text-white group-hover:scale-110 transition-transform duration-300">
                          <FaCalendarCheck size={16} />
                        </div>
                        <div>
                          <span className="block text-[13px] font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
                            {machineName}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">
                            {productName} • {shiftName}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                          {task.status || "SCHEDULED"}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-slate-300 flex-1">
                  <FaCalendarCheck size={48} className="mb-4 opacity-20" />
                  <p className="text-[13px] font-semibold text-slate-400">No tasks scheduled for today</p>
                  <p className="text-[11px] text-slate-400 mt-1">Schedules added for today will appear here</p>
                </div>
              )}
            </div>
          </Card>

          {/* Inventory Doughnut */}
          <Card title="Stock by Store" badge="Products">
            <div className="flex flex-col items-center justify-center h-[200px] relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Items</span>
                <span className="text-[28px] font-black text-slate-800 leading-none">
                  {inventoryData.length === 1 && inventoryData[0].name === "No Stock" ? 0 : inventoryData.length}
                </span>
              </div>
              <ChartContainer config={inventoryChartConfig} className="w-full h-full pb-0 [&_.recharts-pie-label-text]:fill-foreground">
                <PieChart>
                  <Pie data={inventoryData} cx="50%" cy="50%" innerRadius="65%" outerRadius="85%" paddingAngle={4} dataKey="value" nameKey="name" stroke="none" isAnimationActive={false}>
                    {inventoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <ChartTooltip 
                    cursor={false} 
                    content={
                      <ChartTooltipContent 
                        hideLabel 
                        formatter={(value: any, name: any, item: any, index: any, payload: any) => (
                          <>
                            <div
                              className="shrink-0 rounded-[2px] h-2.5 w-2.5"
                              style={{ backgroundColor: payload?.color || item?.color }}
                            />
                            <div className="flex flex-1 justify-between leading-none gap-4 items-center">
                              <div className="flex flex-col gap-1">
                                <span className="text-slate-700 font-semibold">{name}</span>
                                <span className="text-slate-400 text-[10px] font-medium">{payload?.products}</span>
                              </div>
                              <span className="text-slate-800 font-mono font-bold tabular-nums ml-2">
                                {payload?.displayValue || value}
                              </span>
                            </div>
                          </>
                        )}
                      />
                    } 
                  />
                </PieChart>
              </ChartContainer>
            </div>
            <div className="flex flex-row flex-wrap justify-center gap-x-4 gap-y-2 px-2 mt-2">
              {inventoryData.map((item, i) => (
                <div key={i} className="flex items-center p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                    <span className="text-[13px] font-bold text-slate-700">{item.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ══════════════════════════════════════════════════════
           ROW 3  –  Machine Utilization | Top Products | Recent Sales
           ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">

          {/* Machine Utilization */}
          <Card title="Machine Overview" badge="Live">
            <div className="flex flex-col gap-3">
              {machineList.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-slate-400 text-sm font-medium">No Machines</div>
              ) : (
                machineList.map((mac, i) => (
                  <div key={i} className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100/50 hover:from-blue-50 hover:to-indigo-50 rounded-xl px-4 py-3 border border-slate-100 hover:border-indigo-100 transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${mac.status === "Active" ? "bg-emerald-400 shadow-emerald-200" : "bg-slate-300"}`}></div>
                      <span className="text-[12px] font-bold text-slate-700">{mac.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        mac.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}>{mac.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Top Products List */}
          <Card title="Top Products" badge="By stock level" className="min-h-[370px]">
            <div className="flex flex-col gap-3">
              {topProducts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">No Products</div>
              ) : (
                topProducts.map((prod, i) => {
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
                    <div key={i} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-end">
                        <span className="text-[12px] font-semibold text-slate-600 truncate max-w-[140px]">{prod.name}</span>
                        <span className="text-[12px] font-bold text-slate-800">{prod.value.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full bg-gradient-to-r ${barColors[i % barColors.length]} transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Recent Sales Orders */}
          <Card title="Recent Sales Orders" badge="Latest 5">
            <div className="flex flex-col gap-3">
              {recentSales.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-slate-400 text-sm font-medium">No Sales Orders</div>
              ) : (
                recentSales.map((so: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100/50 hover:from-emerald-50 hover:to-teal-50 hover:border-emerald-100 rounded-xl px-4 py-3 border border-slate-100 transition-all duration-200">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-slate-700">{so.orderNo || `SO-${so.id}`}</span>
                      <span className="text-[10px] font-medium text-slate-400">{so.customer?.firmName || so.customer?.displayName || "Customer"}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[13px] font-black text-slate-800">₹{Number(so.netAmount || 0).toLocaleString()}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        so.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        so.status === "CANCELLED" ? "bg-rose-50 text-rose-700 border-rose-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>{(so.status || "DRAFT").replace(/_/g, " ")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Footer */}
        <DashboardFooter />
      </div>
    </div>
  );
};

export default DashboardPage;