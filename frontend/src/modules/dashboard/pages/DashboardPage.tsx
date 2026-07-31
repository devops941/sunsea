import React, { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { useSocketSync } from "../../../hooks/useSocketSync";

// Actions
import { fetchProductionOrders } from "../../../features/production-orders/productionOrderSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchWeeklyPrograms } from "../../../features/weekly-programs/weeklyProgramSlice";
import { fetchRawMaterials } from "../../../features/raw-materials/rawMaterialSlice";

// Hooks
import { useProducts } from "../../../hooks/useProducts";
import { useEmployees } from "../../../hooks/useEmployees";
import { useUsers } from "../../../hooks/useUsers";

// Subcomponents
import DashboardStatsGrid from "../components/DashboardStatsGrid";
import DashboardProductionOverview from "../components/DashboardProductionOverview";
import DashboardMachineOverview from "../components/DashboardMachineOverview";
import DashboardScheduleOverview from "../components/DashboardScheduleOverview";
import DashboardStatusPriority from "../components/DashboardStatusPriority";
import DashboardRecentActivity from "../components/DashboardRecentActivity";
import DashboardFooter from "../components/DashboardFooter";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";

const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Redux state with safe defaults
  const { data: productionOrders, loading: poLoading } = useAppSelector((state: any) => state.productionOrders || { data: [], loading: false });
  const { data: machines, loading: mLoading } = useAppSelector((state: any) => state.machines || { data: [], loading: false });
  const { data: weeklyPrograms } = useAppSelector((state: any) => state.weeklyPrograms || { data: [] });
  const { data: rawMaterials } = useAppSelector((state: any) => state.rawMaterials || { data: [] });

  // Custom Hooks
  const { products, loadProducts, loading: pLoading } = useProducts();
  const { employees, loadEmployees } = useEmployees();
  const { users, loadUsers } = useUsers();

  useEffect(() => {
    const loadAllData = async () => {
      setLoadingInitial(true);
      try {
        await Promise.allSettled([
          dispatch(fetchProductionOrders()),
          dispatch(fetchMachines()),
          dispatch(fetchWeeklyPrograms(undefined)),
          dispatch(fetchRawMaterials(undefined)),
          loadProducts(),
          loadEmployees({ limit: 1000 }),
          loadUsers()
        ]);
      } catch (e) {
        console.error("Error loading dashboard data", e);
      } finally {
        setLoadingInitial(false);
      }
    };
    loadAllData();
  }, [dispatch, loadProducts, loadEmployees, loadUsers]);

  // Real-time: refresh key data when production/inventory events arrive
  useSocketSync("productionOrder", undefined, () => dispatch(fetchProductionOrders()));
  useSocketSync("weeklyProgram", undefined, () => dispatch(fetchWeeklyPrograms(undefined)));
  useSocketSync("rawMaterial", undefined, () => dispatch(fetchRawMaterials(undefined)));

  // Derived Data: Stats
  const totalFinishedGoods = useMemo(() => {
    const safeProductionOrders = Array.isArray(productionOrders) ? productionOrders : [];
    return safeProductionOrders.reduce((acc, po) => acc + (Number(po.producedQty) || 0), 0);
  }, [productionOrders]);

  const stats = useMemo(() => {
    const safeProductionOrders = Array.isArray(productionOrders) ? productionOrders : [];
    const safeWeeklyPrograms = Array.isArray(weeklyPrograms) ? weeklyPrograms : [];
    const safeMachines = Array.isArray(machines) ? machines : [];
    const safeProducts = Array.isArray(products) ? products : [];
    const safeRawMaterials = Array.isArray(rawMaterials) ? rawMaterials : [];
    const safeEmployees = Array.isArray(employees) ? employees : [];
    const safeUsers = Array.isArray(users) ? users : [];

    return {
      totalProductionOrders: safeProductionOrders.length,
      totalWeeklySchedules: safeWeeklyPrograms.length,
      totalMachines: safeMachines.length,
      totalProducts: safeProducts.length,
      totalRawMaterials: safeRawMaterials.length,
      totalFinishedGoods,
      totalEmployees: safeEmployees.filter(e => e.status === "active").length,
      totalActiveUsers: safeUsers.filter((u: any) => u.isActive !== false).length,
    };
  }, [productionOrders, weeklyPrograms, machines, products, rawMaterials, totalFinishedGoods, employees, users]);

  // Derived Data: Production Overview
  const productionStats = useMemo(() => {
    const safeProductionOrders = Array.isArray(productionOrders) ? productionOrders : [];
    let planned = 0;
    let produced = 0;
    let completed = 0;
    let inProgress = 0;
    let plannedOrders = 0;

    safeProductionOrders.forEach((po) => {
      planned += Number(po.targetQty) || 0;
      produced += Number(po.producedQty) || 0;

      const st = po.status?.toUpperCase();
      if (st === 'COMPLETED') completed++;
      else if (st === 'IN_PROGRESS' || st === 'IN PROGRESS') inProgress++;
      else plannedOrders++;
    });

    const pendingQtyCalc = Math.max(0, planned - produced);

    return {
      totalPlannedQty: planned,
      totalProducedQty: produced,
      pendingQty: pendingQtyCalc,
      completedOrders: completed,
      inProgressOrders: inProgress,
      plannedOrders: plannedOrders,
      uom: "Units"
    };
  }, [productionOrders]);

  // Derived Data: Status & Priority
  const distribution = useMemo(() => {
    const safeProductionOrders = Array.isArray(productionOrders) ? productionOrders : [];
    const statusObj = { planned: 0, released: 0, inProgress: 0, completed: 0, cancelled: 0, total: safeProductionOrders.length };
    const prioObj = { urgent: 0, high: 0, medium: 0, low: 0, total: safeProductionOrders.length };

    safeProductionOrders.forEach(po => {
      const s = po.status?.toUpperCase() || '';
      if (s === 'PLANNED') statusObj.planned++;
      else if (s === 'RELEASED') statusObj.released++;
      else if (s === 'IN_PROGRESS' || s === 'IN PROGRESS') statusObj.inProgress++;
      else if (s === 'COMPLETED') statusObj.completed++;
      else if (s === 'CANCELLED') statusObj.cancelled++;
      else statusObj.planned++;

      const p = po.priority?.toUpperCase() || '';
      if (p === 'URGENT') prioObj.urgent++;
      else if (p === 'HIGH') prioObj.high++;
      else if (p === 'MEDIUM') prioObj.medium++;
      else if (p === 'LOW') prioObj.low++;
      else prioObj.medium++;
    });

    return { statusDistribution: statusObj, priorityDistribution: prioObj };
  }, [productionOrders]);

  // Derived Data: Machine Overview
  const machineOverviewData = useMemo(() => {
    const safeMachines = Array.isArray(machines) ? machines : [];
    const safeWeeklyPrograms = Array.isArray(weeklyPrograms) ? weeklyPrograms : [];

    return safeMachines.map((m, index) => {
      // Find programs for this machine
      const mPrograms = safeWeeklyPrograms.filter((wp: any) => wp.machineId === m.machineId || wp.machine?.machineId === m.machineId);
      const weeklyPlannedQty = mPrograms.reduce((acc: number, wp: any) => acc + (Number(wp.plannedQty) || 0), 0);

      return {
        id: m.machineId || m.id || String(index),
        name: m.machineName,
        code: m.machineId || m.machineName,
        technology: m.technology || 'N/A',
        status: m.status || 'Active',
        weeklyPlannedQty,
        scheduledJobs: mPrograms.length
      };
    });
  }, [machines, weeklyPrograms]);

  // Derived Data: Schedule Overview & Today
  const scheduleOverview = useMemo(() => {
    const safeWeeklyPrograms = Array.isArray(weeklyPrograms) ? weeklyPrograms : [];
    let planned = 0;
    const machineIds = new Set();

    safeWeeklyPrograms.forEach((wp: any) => {
      planned += Number(wp.plannedQty) || 0;
      machineIds.add(wp.machineId);
    });

    // Todays Plan mock matching current day of week
    const currentDayStr = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todaysPrograms = safeWeeklyPrograms.filter((wp: any) => wp.dayOfWeek === currentDayStr || wp.day === currentDayStr);

    const todaysPlanMap: any = {};
    todaysPrograms.forEach((wp: any) => {
      const mName = wp.machine?.machineName || `Machine ${wp.machineId}`;
      const sName = wp.shift?.shiftName || `Shift ${wp.shiftId}`;
      const pName = wp.productionOrder?.productItem?.productName || 'Unknown Product';

      if (!todaysPlanMap[mName]) todaysPlanMap[mName] = {};
      if (!todaysPlanMap[mName][sName]) todaysPlanMap[mName][sName] = [];

      todaysPlanMap[mName][sName].push({
        productName: pName,
        plannedQty: Number(wp.plannedQty) || 0,
        uom: wp.productionOrder?.uom || 'Units'
      });
    });

    const todaysPlanArray = Object.keys(todaysPlanMap).map(mName => ({
      machineName: mName,
      shifts: Object.keys(todaysPlanMap[mName]).map(sName => ({
        shiftName: sName,
        products: todaysPlanMap[mName][sName]
      }))
    }));

    return {
      weeklySummary: {
        weekStart: "Monday", // Can be dynamic
        weekEnd: "Sunday",
        totalOrders: [...new Set(safeWeeklyPrograms.map((wp: any) => wp.productionOrderId))].length,
        totalPlannedQty: planned,
        totalMachinesUsed: machineIds.size,
        totalScheduledEntries: safeWeeklyPrograms.length
      },
      todaysPlan: todaysPlanArray
    };
  }, [weeklyPrograms]);

  // Derived Data: Recent Activity
  const recentOrders = useMemo(() => {
    const safeProductionOrders = Array.isArray(productionOrders) ? productionOrders : [];
    return [...safeProductionOrders]
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5)
      .map(po => {
        const d = po.createdAt ? new Date(po.createdAt) : new Date();
        return {
          productionOrderId: po.productionOrderId || po.id,
          productName: po.productItem?.productName || 'Unknown',
          quantity: Number(po.targetQty) || 0,
          uom: po.uom || 'Units',
          priority: po.priority || 'Normal',
          status: po.status || 'Planned',
          orderDate: d.toLocaleDateString()
        };
      });
  }, [productionOrders]);

  const recentSchedules = useMemo(() => {
    const safeWeeklyPrograms = Array.isArray(weeklyPrograms) ? weeklyPrograms : [];
    return [...safeWeeklyPrograms]
      .slice(0, 5)
      .map((wp: any) => ({
        machineName: wp.machine?.machineName || `Machine ${wp.machineId}`,
        shiftName: wp.shift?.shiftName || `Shift ${wp.shiftId}`,
        day: wp.dayOfWeek || wp.day || 'Monday',
        productName: wp.productionOrder?.productItem?.productName || 'Unknown',
        plannedQty: Number(wp.plannedQty) || 0,
        uom: wp.productionOrder?.uom || 'Units',
        hours: Number(wp.plannedHours) || 0,
        priority: wp.productionOrder?.priority || 'Normal'
      }));
  }, [weeklyPrograms]);

  // Derived Data: Alerts
  // const alerts = useMemo(() => {
  //   const safeMachines = Array.isArray(machines) ? machines : [];
  //   const safeWeeklyPrograms = Array.isArray(weeklyPrograms) ? weeklyPrograms : [];
  //   const msgs: any[] = [];

  //   const machinesWithNoSchedule = safeMachines.filter(m =>
  //     !safeWeeklyPrograms.some((wp: any) => wp.machineId === m.machineId || wp.machine?.machineId === m.machineId)
  //   );

  //   if (machinesWithNoSchedule.length > 0) {
  //     msgs.push({
  //       type: 'warning',
  //       message: `${machinesWithNoSchedule.length} machines have no active schedules for this week.`,
  //       actionLabel: 'Schedule Now',
  //       actionPath: '/weekly-machine-schedules/create'
  //     });
  //   }

  //   if (productionStats.pendingQty > 0) {
  //     msgs.push({
  //       type: 'info',
  //       message: `There are ${productionStats.plannedOrders} planned orders waiting to be released.`,
  //       actionLabel: 'View Orders',
  //       actionPath: '/production-orders'
  //     });
  //   }

  //   return msgs;
  // }, [machines, weeklyPrograms, productionStats]);

  const anyLoading = loadingInitial || poLoading || mLoading || pLoading;

  return (
    <div className="bg-gray-50 min-h-screen">
      {anyLoading && (
        <CommonLoader text="Loding ..." />
      )}
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8 mx-auto">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-1 text-primary!">Manufacturing Command Center</h2>
            <div className="text-gray-500 text-sm sm:text-base">Centralized overview of your entire ERP operations</div>
          </div>

        </div>

        {/* 1. Top Summary Cards */}
        <DashboardStatsGrid stats={stats} />

        <div className="grid grid-cols-1 gap-6 mb-6">
          <div className="col-span-1">
            <DashboardProductionOverview productionStats={productionStats} />
          </div>
        </div>

        {/* 3. Machine Overview */}
        {/* <DashboardMachineOverview machines={machineOverviewData} /> */}

        {/* 4. Weekly Schedule Overview & 5. Today's Plan */}
        {/* <DashboardScheduleOverview
          weeklySummary={scheduleOverview.weeklySummary}
          todaysPlan={scheduleOverview.todaysPlan}
        /> */}

        {/* 6 & 7. Status and Priority Distributions */}
        {/* <DashboardStatusPriority
          statusDistribution={distribution.statusDistribution}
          priorityDistribution={distribution.priorityDistribution}
        /> */}

        {/* 8. Recent Production Orders & 9. Recent Schedules */}
        {/* <DashboardRecentActivity
          recentOrders={recentOrders}
          recentSchedules={recentSchedules}
        /> */}

        {/* 12. Footer */}
        <DashboardFooter />
      </div>
    </div>
  );
};

export default DashboardPage;