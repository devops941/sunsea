import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateHourlyProductionInput, UpdateHourlyProductionInput } from "./hourly-production.validation";

function getMondayAndDayOfWeek(dateInput: Date | string) {
  let date: Date;
  if (typeof dateInput === "string") {
    const [yyyy, mm, dd] = dateInput.split("-").map(Number);
    date = new Date(Date.UTC(yyyy, mm - 1, dd));
  } else {
    date = new Date(Date.UTC(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate()));
  }
  
  const day = date.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const dayOfWeek = day === 0 ? 7 : day; // Monday = 1, ..., Sunday = 7
  
  // Calculate Monday
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
  
  return { monday, dayOfWeek };
}

async function syncProductionOrderQuantities(tx: any, productionOrderId: string) {
  const aggregates = await tx.hourlyProduction.aggregate({
    where: { productionOrderId },
    _sum: {
      qtyProduced: true,
      rejectQty: true,
      scrapQty: true,
    }
  });

  const order = await tx.productionOrder.findUnique({ where: { productionOrderId } });
  let newStatus = order?.status || "IN_PROGRESS";
  
  if (newStatus !== "COMPLETED" && newStatus !== "IN_PROGRESS" && newStatus !== "FG_RECEIVED" && newStatus !== "READY_FOR_DISPATCH" && newStatus !== "DISPATCHED") {
    newStatus = "IN_PROGRESS";
  }

  await tx.productionOrder.update({
    where: { productionOrderId },
    data: {
      producedQty: aggregates._sum.qtyProduced || 0,
      rejectedQty: aggregates._sum.rejectQty || 0,
      scrapQty: aggregates._sum.scrapQty || 0,
      status: newStatus,
    }
  });
}

class HourlyProductionService {
  async validateHourlyEntry(data: any, excludeId?: bigint) {
    // 1. Verify production order exists
    const order = await prisma.productionOrder.findUnique({
      where: { productionOrderId: data.productionOrderId },
    });
    if (!order) {
      throw new ApiError(404, `Production Order with ID ${data.productionOrderId} not found`);
    }

    // 2. Entry without Daily Plan
    const { monday, dayOfWeek } = getMondayAndDayOfWeek(data.productionDate);
    const [yyyy, mm, dd] = data.productionDate.split("-").map(Number);
    const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));

    const weeklyProgram = await prisma.weeklyMachineProgram.findFirst({
      where: {
        machineId: data.machineId,
        shiftId: data.shiftId,
        weekStartDate: monday,
        dayOfWeek: dayOfWeek,
        productionOrderId: data.productionOrderId,
      }
    });

    if (!weeklyProgram) {
      throw new ApiError(400, "Entry without Daily Plan: No weekly machine schedule (Daily Plan) exists for this machine, date, and shift");
    }

    // 3. Entry after Shift Closed
    if (weeklyProgram.status.toUpperCase() === "COMPLETED" || weeklyProgram.status.toUpperCase() === "CLOSED") {
      throw new ApiError(400, "Entry after Shift Closed: The shift schedule has already been closed");
    }

    // 4. Duplicate Hour Entry
    const duplicate = await prisma.hourlyProduction.findFirst({
      where: {
        productionDate: prodDate,
        machineId: data.machineId,
        shiftId: data.shiftId,
        hourIndex: data.hourIndex,
        ...(excludeId ? { hourlyProductionId: { not: excludeId } } : {})
      }
    });

    if (duplicate) {
      throw new ApiError(409, `Duplicate Hour Entry: An hourly production log already exists for this machine, date, shift, and hour index ${data.hourIndex}`);
    }

    // 5. Future Time Entry (Commented out to allow logging and testing future dates)
    /*
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (prodDate > today) {
      throw new ApiError(400, "Future Time Entry: Cannot enter production for a future date");
    }

    if (prodDate.getTime() === today.getTime()) {
      const [startHour, startMin] = shift.startTime.split(":").map(Number);
      const slotStartTime = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), startHour + (data.hourIndex - 1), startMin, 0, 0));

      if (slotStartTime > now) {
        throw new ApiError(400, "Future Time Entry: Cannot log hourly production for a future time slot");
      }
    }
    */

    // 6. Negative Quantity (handled by Zod but let's be double sure)
    if (data.qtyProduced < 0 || (data.rejectQty && data.rejectQty < 0) || (data.scrapQty && data.scrapQty < 0) || (data.downtime && data.downtime < 0)) {
      throw new ApiError(400, "Quantities and downtime cannot be negative");
    }

    // 7. Hourly Quantity greater than Remaining Quantity
    const aggregates = await prisma.hourlyProduction.aggregate({
      where: {
        productionDate: prodDate,
        machineId: data.machineId,
        shiftId: data.shiftId,
        productionOrderId: data.productionOrderId,
        ...(excludeId ? { hourlyProductionId: { not: excludeId } } : {})
      },
      _sum: {
        qtyProduced: true
      }
    });

    const alreadyProduced = Number(aggregates._sum.qtyProduced || 0);
    const plannedQty = Number(weeklyProgram.plannedQty);
    const remainingQty = Math.max(0, plannedQty - alreadyProduced);

    // Allow hourly production to exceed planned quantity (overproduction is allowed)
    /*
    if (Number(data.qtyProduced) > remainingQty) {
      throw new ApiError(400, `Hourly Quantity greater than Remaining Quantity: Hourly quantity (${data.qtyProduced}) exceeds the remaining planned quantity (${remainingQty})`);
    }
    */

    return { order, weeklyProgram };
  }

  async create(data: CreateHourlyProductionInput) {
    const [yyyy, mm, dd] = data.productionDate.split("-").map(Number);
    const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));

    const { weeklyProgram } = await this.validateHourlyEntry(data);

    return prisma.$transaction(async (tx) => {
      const created = await tx.hourlyProduction.create({
        data: {
          productionOrderId: data.productionOrderId,
          productionDate: prodDate,
          shiftId: data.shiftId,
          machineId: data.machineId,
          hourIndex: data.hourIndex,
          qtyProduced: data.qtyProduced,
          rejectQty: data.rejectQty ?? 0,
          scrapQty: data.scrapQty ?? 0,
          downtime: data.downtime ?? 0,
          remarks: data.remarks ?? null,
          operatorId: data.operatorId ?? null,
        },
        include: {
          productionOrder: true,
        },
      });

      if (weeklyProgram.status !== "COMPLETED" && weeklyProgram.status !== "IN_PROGRESS") {
        await tx.weeklyMachineProgram.update({
          where: { weeklyProgramId: weeklyProgram.weeklyProgramId },
          data: { status: "IN_PROGRESS" },
        });
      }

      await syncProductionOrderQuantities(tx, data.productionOrderId);
      return created;
    });
  }

  async findAll(filters?: { machineId?: string; shiftId?: string; productionDate?: string; productionOrderId?: string; search?: string }) {
    const where: any = {};
    if (filters?.machineId) where.machineId = filters.machineId;
    if (filters?.shiftId) where.shiftId = filters.shiftId;
    if (filters?.productionOrderId) where.productionOrderId = filters.productionOrderId;
    if (filters?.productionDate) {
      const [yyyy, mm, dd] = filters.productionDate.split("-").map(Number);
      const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));
      where.productionDate = prodDate;
    }
    if (filters?.search) {
      where.OR = [
        { productionOrderId: { contains: filters.search } },
        { machineId: { contains: filters.search } },
        { machine: { machineName: { contains: filters.search } } },
        { productionOrder: { productItem: { productName: { contains: filters.search } } } }
      ];
    }

    const logs = await prisma.hourlyProduction.findMany({
      where,
      include: {
        productionOrder: {
          include: {
            productItem: true,
          }
        },
        machine: true,
        shift: true,
      },
      orderBy: [
        { productionDate: "desc" },
        { hourIndex: "asc" }
      ],
    });

    const enrichedLogs = await Promise.all(logs.map(async (log) => {
      const { monday, dayOfWeek } = getMondayAndDayOfWeek(log.productionDate);
      
      const weeklyProgram = await prisma.weeklyMachineProgram.findFirst({
        where: {
          machineId: log.machineId,
          shiftId: log.shiftId,
          weekStartDate: monday,
          dayOfWeek: dayOfWeek,
          productionOrderId: log.productionOrderId,
        }
      });
      
      return {
        ...log,
        shiftPlannedQty: weeklyProgram ? Number(weeklyProgram.plannedQty) : 0,
      };
    }));

    return enrichedLogs;
  }

  async findById(hourlyProductionId: bigint) {
    const log = await prisma.hourlyProduction.findUnique({
      where: { hourlyProductionId },
      include: {
        productionOrder: {
          include: {
            productItem: true,
          }
        },
        machine: true,
        shift: true,
      },
    });

    if (!log) {
      throw new ApiError(404, `Hourly production log with ID ${hourlyProductionId.toString()} not found`);
    }

    return log;
  }

  async update(hourlyProductionId: bigint, data: UpdateHourlyProductionInput) {
    const existing = await this.findById(hourlyProductionId);

    // Merge existing and update data for validation
    const merged = {
      productionOrderId: data.productionOrderId ?? existing.productionOrderId,
      productionDate: data.productionDate ?? existing.productionDate.toISOString().split("T")[0],
      shiftId: data.shiftId ?? existing.shiftId,
      machineId: data.machineId ?? existing.machineId,
      hourIndex: data.hourIndex ?? existing.hourIndex,
      qtyProduced: data.qtyProduced ?? Number(existing.qtyProduced),
      rejectQty: data.rejectQty ?? Number(existing.rejectQty),
      scrapQty: data.scrapQty ?? Number(existing.scrapQty),
      downtime: data.downtime ?? Number(existing.downtime),
      remarks: data.remarks ?? existing.remarks,
      operatorId: data.operatorId ?? existing.operatorId,
    };

    await this.validateHourlyEntry(merged, hourlyProductionId);

    const updateData: any = {};
    if (data.productionOrderId) updateData.productionOrderId = data.productionOrderId;
    if (data.productionDate) {
      const [yyyy, mm, dd] = data.productionDate.split("-").map(Number);
      updateData.productionDate = new Date(Date.UTC(yyyy, mm - 1, dd));
    }
    if (data.shiftId) updateData.shiftId = data.shiftId;
    if (data.machineId) updateData.machineId = data.machineId;
    if (data.hourIndex !== undefined) updateData.hourIndex = data.hourIndex;
    if (data.qtyProduced !== undefined) updateData.qtyProduced = data.qtyProduced;
    if (data.rejectQty !== undefined) updateData.rejectQty = data.rejectQty;
    if (data.scrapQty !== undefined) updateData.scrapQty = data.scrapQty;
    if (data.downtime !== undefined) updateData.downtime = data.downtime;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;
    if (data.operatorId !== undefined) updateData.operatorId = data.operatorId;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.hourlyProduction.update({
        where: { hourlyProductionId },
        data: updateData,
        include: {
          productionOrder: true,
        },
      });

      await syncProductionOrderQuantities(tx, updated.productionOrderId);
      if (existing.productionOrderId !== updated.productionOrderId) {
        await syncProductionOrderQuantities(tx, existing.productionOrderId);
      }
      return updated;
    });
  }

  async delete(hourlyProductionId: bigint) {
    const existing = await this.findById(hourlyProductionId);

    return prisma.$transaction(async (tx) => {
      const deleted = await tx.hourlyProduction.delete({
        where: { hourlyProductionId },
      });
      await syncProductionOrderQuantities(tx, existing.productionOrderId);
      return deleted;
    });
  }
}

export default new HourlyProductionService();
