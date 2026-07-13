import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

// --- OEE Calculation Utilities -------------------------------------------------
//
//  Industry Standard OEE Formula:
//    Availability (A) = (Planned Run Time - Downtime) / Planned Run Time x 100
//    Performance  (P) = (Produced Qty x Ideal Cycle Time) / Run Time x 100
//    Quality      (Q) = Good Qty / Total Produced x 100
//    OEE (%)          = A x P x Q / 10000
//
//  - Planned Run Time is from Shift duration in minutes.
//  - Ideal Cycle Time comes from Machine.cycleTime (seconds/piece).
//  - If cycleTime is not set, Performance defaults to 100%.
//  - Good Qty = Produced Qty - Reject Qty - Scrap Qty
//
// -------------------------------------------------------------------------------

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

function shiftDurationMinutes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end >= start ? end - start : 24 * 60 - start + end;
}

export function calculateOeeMetrics(params: {
  plannedRunTimeMinutes: number;
  totalRuntimeMinutes: number;
  totalDowntimeMinutes: number;
  totalProduced: number;
  totalReject: number;
  totalScrap: number;
  cycleTimeSeconds?: number | null;
}): {
  availability: number;
  performance: number;
  quality: number;
  oeePercent: number;
  goodQty: number;
} {
  const { plannedRunTimeMinutes, totalRuntimeMinutes, totalDowntimeMinutes, totalProduced, totalReject, totalScrap, cycleTimeSeconds } = params;

  const actualRunTime = Math.max(0, totalRuntimeMinutes - totalDowntimeMinutes);
  const availability = plannedRunTimeMinutes > 0 ? Math.min(100, (actualRunTime / plannedRunTimeMinutes) * 100) : 0;

  let performance = 100;
  if (cycleTimeSeconds && cycleTimeSeconds > 0 && actualRunTime > 0) {
    const idealProduction = (actualRunTime * 60) / cycleTimeSeconds;
    performance = Math.min(100, (totalProduced / idealProduction) * 100);
  }

  const goodQty = Math.max(0, totalProduced - totalReject - totalScrap);
  const quality = totalProduced > 0 ? Math.min(100, (goodQty / totalProduced) * 100) : 100;
  const oeePercent = (availability * performance * quality) / 10000;

  return {
    availability: Math.round(availability * 100) / 100,
    performance: Math.round(performance * 100) / 100,
    quality: Math.round(quality * 100) / 100,
    oeePercent: Math.round(oeePercent * 100) / 100,
    goodQty: Math.round(goodQty * 1000) / 1000,
  };
}

class OeeService {
  async recalculateAndSaveSnapshot(params: {
    machineId: string;
    productionDate: string;
    shiftId: string;
    dailyPlanId?: string | null;
  }) {
    const { machineId, productionDate, shiftId, dailyPlanId } = params;
    const [yyyy, mm, dd] = productionDate.split("-").map(Number);
    const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));

    const machine = await prisma.machine.findUnique({ where: { machineId }, select: { cycleTime: true } });
    const shift = await (prisma as any).shift.findFirst({ where: { shiftCode: shiftId }, select: { startTime: true, endTime: true, breakDuration: true } });
    const shiftMinutes = shift ? shiftDurationMinutes(shift.startTime, shift.endTime) - (Number(shift.breakDuration) || 0) : 480;

    const hourlyAgg = await prisma.hourlyProduction.aggregate({
      where: { machineId, shiftId, productionDate: prodDate },
      _sum: { qtyProduced: true, rejectQty: true, scrapQty: true, downtime: true, runtimeMinutes: true },
    });

    const totalProduced = Number(hourlyAgg._sum.qtyProduced || 0);
    const totalReject = Number(hourlyAgg._sum.rejectQty || 0);
    const totalScrap = Number(hourlyAgg._sum.scrapQty || 0);
    const totalDowntime = Number(hourlyAgg._sum.downtime || 0);
    const totalRuntime = Number(hourlyAgg._sum.runtimeMinutes || 0);

    const oee = calculateOeeMetrics({
      plannedRunTimeMinutes: shiftMinutes,
      totalRuntimeMinutes: totalRuntime,
      totalDowntimeMinutes: totalDowntime,
      totalProduced,
      totalReject,
      totalScrap,
      cycleTimeSeconds: machine?.cycleTime ? Number(machine.cycleTime) : null,
    });

    await (prisma as any).machineOeeSnapshot.upsert({
      where: { machineId_productionDate_shiftId: { machineId, productionDate: prodDate, shiftId } },
      update: {
        dailyPlanId: dailyPlanId ?? null,
        plannedRunTime: shiftMinutes,
        actualRunTime: Math.max(0, totalRuntime - totalDowntime),
        totalDowntime,
        totalProduced,
        goodQty: oee.goodQty,
        rejectQty: totalReject,
        availability: oee.availability,
        performance: oee.performance,
        quality: oee.quality,
        oeePercent: oee.oeePercent,
        calculatedAt: new Date(),
      },
      create: {
        machineId,
        dailyPlanId: dailyPlanId ?? null,
        productionDate: prodDate,
        shiftId,
        plannedRunTime: shiftMinutes,
        actualRunTime: Math.max(0, totalRuntime - totalDowntime),
        totalDowntime,
        totalProduced,
        goodQty: oee.goodQty,
        rejectQty: totalReject,
        availability: oee.availability,
        performance: oee.performance,
        quality: oee.quality,
        oeePercent: oee.oeePercent,
      },
    });

    return oee;
  }

  async getMachineOeeSummary(machineId: string, date?: string) {
    const dateStr = date || new Date().toISOString().split("T")[0];
    const [yyyy, mm, dd] = dateStr.split("-").map(Number);
    const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));

    const machine = await prisma.machine.findUnique({
      where: { machineId },
      select: { machineName: true, machineStatus: true, cycleTime: true, operatorId: true },
    });
    if (!machine) throw new ApiError(404, `Machine ${machineId} not found`);

    const snapshots = await (prisma as any).machineOeeSnapshot.findMany({
      where: { machineId, productionDate: prodDate },
      orderBy: { calculatedAt: "desc" },
    });

    const todayPlans = await prisma.dailyProductionPlan.findMany({
      where: { machineId, productionDate: prodDate },
      include: {
        shift: { select: { shiftName: true, startTime: true, endTime: true } },
        productionOrder: { select: { productionOrderId: true, targetQty: true, producedQty: true } },
      },
    });

    const totalPlannedHours = todayPlans.reduce((sum: number, p: any) => sum + Number(p.plannedHours || 0), 0);

    const latestSnapshot = snapshots[0] ?? null;
    const avgOee = latestSnapshot
      ? {
          availability: Number(latestSnapshot.availability),
          performance: Number(latestSnapshot.performance),
          quality: Number(latestSnapshot.quality),
          oeePercent: Number(latestSnapshot.oeePercent),
        }
      : null;

    const downtimeAgg = await prisma.hourlyProduction.aggregate({
      where: { machineId, productionDate: prodDate },
      _sum: { downtime: true, runtimeMinutes: true },
    });

    const runningOrdersCount = todayPlans.filter((p: any) => p.status === "IN_PROGRESS" || p.status === "APPROVED").length;

    return {
      machineId,
      machineName: machine.machineName,
      machineStatus: machine.machineStatus,
      oeeToday: avgOee,
      snapshots,
      todayPlannedHours: Math.round(totalPlannedHours * 100) / 100,
      downtimeToday: Number(downtimeAgg._sum.downtime || 0),
      runningOrdersCount,
      todayPlans,
    };
  }

  async getProductionOrderOeeSummary(productionOrderId: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { productionOrderId },
      include: { productItem: true },
    });
    if (!order) throw new ApiError(404, `Production Order ${productionOrderId} not found`);

    const hourlyAgg = await prisma.hourlyProduction.aggregate({
      where: { productionOrderId },
      _sum: { qtyProduced: true, rejectQty: true, scrapQty: true, downtime: true, runtimeMinutes: true },
    });

    const totalProduced = Number(hourlyAgg._sum.qtyProduced || 0);
    const totalReject = Number(hourlyAgg._sum.rejectQty || 0);
    const totalScrap = Number(hourlyAgg._sum.scrapQty || 0);
    const totalDowntime = Number(hourlyAgg._sum.downtime || 0);
    const totalRuntime = Number(hourlyAgg._sum.runtimeMinutes || 0);
    const goodQty = Math.max(0, totalProduced - totalReject - totalScrap);

    const dailyPlans = await prisma.dailyProductionPlan.findMany({
      where: { productionOrderId },
      include: { shift: { select: { startTime: true, endTime: true, breakDuration: true } } },
    });

    const totalPlannedMinutes = dailyPlans.reduce((sum: number, p: any) => {
      if (p.shift) {
        return sum + shiftDurationMinutes(p.shift.startTime, p.shift.endTime) - (Number(p.shift.breakDuration) || 0);
      }
      return sum + Number(p.plannedHours || 0) * 60;
    }, 0);

    const oee = calculateOeeMetrics({
      plannedRunTimeMinutes: totalPlannedMinutes || totalRuntime,
      totalRuntimeMinutes: totalRuntime,
      totalDowntimeMinutes: totalDowntime,
      totalProduced,
      totalReject,
      totalScrap,
    });

    const wastageAgg = await prisma.productionWastage.aggregate({
      where: { productionOrderId },
      _sum: { quantity: true },
    });

    return {
      productionOrderId,
      productName: (order as any).productItem?.productName,
      targetQty: Number(order.targetQty),
      producedQty: totalProduced,
      goodQty,
      rejectQty: totalReject,
      scrapQty: totalScrap,
      wasteQty: Number(wastageAgg._sum?.quantity || 0),
      remainingQty: Math.max(0, Number(order.targetQty) - totalProduced),
      runtimeMinutes: totalRuntime,
      downtimeMinutes: totalDowntime,
      availability: oee.availability,
      performance: oee.performance,
      quality: oee.quality,
      oeePercent: oee.oeePercent,
    };
  }

  async getAllMachinesStatus(dateStr?: string) {
    let prodDate: Date;
    if (dateStr) {
      const [yyyy, mm, dd] = dateStr.split("-").map(Number);
      prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));
    } else {
      prodDate = new Date(new Date().toISOString().split("T")[0] + "T00:00:00Z");
    }

    const machines = await prisma.machine.findMany({
      where: { isActive: true },
      select: {
        machineId: true,
        machineName: true,
        machineStatus: true,
        cycleTime: true,
        operatorId: true,
        dailyProductionPlans: {
          where: { productionDate: prodDate },
          select: { dailyPlanId: true, status: true, plannedHours: true, productionOrderId: true, shift: { select: { shiftName: true } } },
        },
        oeeSnapshots: {
          where: { productionDate: prodDate },
          select: { oeePercent: true, availability: true, performance: true, quality: true, shiftId: true },
          orderBy: { calculatedAt: "desc" },
          take: 1,
        },
      },
    });

    return machines.map((m: any) => {
      const latestOee = m.oeeSnapshots?.[0] ?? null;
      const activePlan = m.dailyProductionPlans?.find((p: any) => p.status === "IN_PROGRESS" || p.status === "APPROVED");
      return {
        machineId: m.machineId,
        machineName: m.machineName,
        machineStatus: m.machineStatus,
        currentOee: latestOee ? Number(latestOee.oeePercent) : null,
        availability: latestOee ? Number(latestOee.availability) : null,
        performance: latestOee ? Number(latestOee.performance) : null,
        quality: latestOee ? Number(latestOee.quality) : null,
        activeProductionOrderId: activePlan?.productionOrderId ?? null,
        activePlanStatus: activePlan?.status ?? null,
        currentShift: activePlan?.shift?.shiftName ?? null,
        todayPlannedHours: m.dailyProductionPlans?.reduce((sum: number, p: any) => sum + Number(p.plannedHours || 0), 0),
      };
    });
  }
}

export default new OeeService();
