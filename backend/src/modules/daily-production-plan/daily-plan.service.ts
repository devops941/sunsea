import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import dailyPlanRepository from "./daily-plan.repository";
import { CreateDailyPlanInput, UpdateDailyPlanInput } from "./daily-plan.validation";

class DailyPlanService {
  async generateNextDailyPlanId(tx?: any): Promise<string> {
    const client = tx || prisma;
    const plans = await client.dailyProductionPlan.findMany({
      select: { dailyPlanId: true },
    });

    let maxNum = 0;
    for (const p of plans) {
      if (p.dailyPlanId && p.dailyPlanId.startsWith("DP")) {
        const num = parseInt(p.dailyPlanId.slice(2), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    return `DP${String(maxNum + 1).padStart(4, "0")}`;
  }

  async create(data: CreateDailyPlanInput, userId?: string) {
    const [yyyy, mm, dd] = data.productionDate.split("-").map(Number);
    const prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));

    // 1. Validation: Weekly Plan must exist
    const weeklyProgram = await prisma.weeklyMachineProgram.findUnique({
      where: { weeklyProgramId: data.weeklyProgramId },
    });
    if (!weeklyProgram) {
      throw new ApiError(404, `Weekly Program with ID ${data.weeklyProgramId} not found`);
    }

    // 2. Validation: Production Order must exist
    const productionOrder = await prisma.productionOrder.findUnique({
      where: { productionOrderId: data.productionOrderId },
    });
    if (!productionOrder) {
      throw new ApiError(404, `Production Order with ID ${data.productionOrderId} not found`);
    }

    // 3. Validation: Machine must exist
    const machine = await prisma.machine.findUnique({
      where: { machineId: data.machineId },
    });
    if (!machine) {
      throw new ApiError(404, `Machine with ID ${data.machineId} not found`);
    }

    // 4. Validation: Shift must exist
    const shift = await prisma.shift.findUnique({
      where: { shiftCode: data.shiftId },
    });
    if (!shift) {
      throw new ApiError(404, `Shift with ID ${data.shiftId} not found`);
    }

    // 5. Validation: Planned quantity must be greater than zero
    if (data.plannedQty <= 0) {
      throw new ApiError(400, "Planned quantity must be greater than zero");
    }

    // 6. (Removed) Validation: Daily plan date must fall inside Weekly Plan date range

    // 7. Carry-forward guard: a source plan can only be carried forward ONCE
    if (data.carryForwardFromPlanId) {
      const sourcePlan = await prisma.dailyProductionPlan.findUnique({
        where: { dailyPlanId: data.carryForwardFromPlanId },
        include: { carryForwardTo: { select: { dailyPlanId: true } } },
      });
      if (!sourcePlan) {
        throw new ApiError(404, `Source plan ${data.carryForwardFromPlanId} not found`);
      }
      if (sourcePlan.carryForwardTo && sourcePlan.carryForwardTo.length > 0) {
        throw new ApiError(409, `Plan ${data.carryForwardFromPlanId} has already been carried forward. Each plan can only be carried forward once.`);
      }
    }

    return prisma.$transaction(async (tx) => {
      // 8. Validation: Machine must not already be planned for the same date, shift, and PO
      const isAlreadyPlanned = await dailyPlanRepository.existsByDateMachineShift(prodDate, data.machineId, data.shiftId, data.productionOrderId);
      if (isAlreadyPlanned) {
        throw new ApiError(409, `Machine ${data.machineId} is already scheduled with production order ${data.productionOrderId} on shift ${data.shiftId} for date ${data.productionDate}`);
      }

      // (Removed) Validation: Planned quantity cannot exceed remaining Weekly quantity
      // We allow exceeding the weekly target to support carry-forwards and extra production.

      const nextId = await this.generateNextDailyPlanId(tx);

      return dailyPlanRepository.create(
        {
          dailyPlanId: nextId,
          weeklyProgramId: data.weeklyProgramId,
          productionOrderId: data.productionOrderId,
          productionDate: prodDate,
          machineId: data.machineId,
          shiftId: data.shiftId,
          plannedQty: data.plannedQty,
          plannedHours: data.plannedHours ?? null,
          priority: data.priority ?? "MEDIUM",
          status: data.status ?? "DRAFT",
          remarks: data.remarks ?? null,
          carryForwardFromPlanId: data.carryForwardFromPlanId ?? null,
          createdBy: userId,
        },
        tx
      );
    });
  }

  async update(dailyPlanId: string, data: UpdateDailyPlanInput, userId?: string) {
    const existingPlan = await dailyPlanRepository.findById(dailyPlanId);
    if (!existingPlan) {
      throw new ApiError(404, `Daily Plan with ID ${dailyPlanId} not found`);
    }

    const checkWeeklyProgramId = data.weeklyProgramId || existingPlan.weeklyProgramId;
    const checkProductionOrderId = data.productionOrderId || existingPlan.productionOrderId;
    const checkMachineId = data.machineId || existingPlan.machineId;
    const checkShiftId = data.shiftId || existingPlan.shiftId;
    const checkPlannedQty = data.plannedQty !== undefined ? data.plannedQty : Number(existingPlan.plannedQty);

    let prodDate = existingPlan.productionDate;
    if (data.productionDate) {
      const [yyyy, mm, dd] = data.productionDate.split("-").map(Number);
      prodDate = new Date(Date.UTC(yyyy, mm - 1, dd));
    }

    // 1. Verify Weekly Plan exists
    const weeklyProgram = await prisma.weeklyMachineProgram.findUnique({
      where: { weeklyProgramId: checkWeeklyProgramId },
    });
    if (!weeklyProgram) {
      throw new ApiError(404, `Weekly Program with ID ${checkWeeklyProgramId} not found`);
    }

    // 2. Verify Production Order exists
    const productionOrder = await prisma.productionOrder.findUnique({
      where: { productionOrderId: checkProductionOrderId },
    });
    if (!productionOrder) {
      throw new ApiError(404, `Production Order with ID ${checkProductionOrderId} not found`);
    }

    // 3. Verify Machine exists
    const machine = await prisma.machine.findUnique({
      where: { machineId: checkMachineId },
    });
    if (!machine) {
      throw new ApiError(404, `Machine with ID ${checkMachineId} not found`);
    }

    // 4. Verify Shift exists
    const shift = await prisma.shift.findUnique({
      where: { shiftCode: checkShiftId },
    });
    if (!shift) {
      throw new ApiError(404, `Shift with ID ${checkShiftId} not found`);
    }

    // 5. Verify quantity > 0
    if (checkPlannedQty <= 0) {
      throw new ApiError(400, "Planned quantity must be greater than zero");
    }

    // 6. (Removed) Verify Daily plan date must fall inside Weekly Plan date range

    return prisma.$transaction(async (tx) => {
      // 7. Verify machine is not already planned on this date, shift & PO (excluding self)
      const isAlreadyPlanned = await dailyPlanRepository.existsByDateMachineShift(prodDate, checkMachineId, checkShiftId, checkProductionOrderId, dailyPlanId);
      if (isAlreadyPlanned) {
        throw new ApiError(
          409,
          `Machine ${checkMachineId} is already scheduled with production order ${checkProductionOrderId} on shift ${checkShiftId} for date ${prodDate.toISOString().split("T")[0]}`
        );
      }

      // 9. *** PRODUCTION START GATING ***: IN_PROGRESS requires a completed Material Issue
      if (
        data.status === "IN_PROGRESS" &&
        existingPlan.status !== "IN_PROGRESS"
      ) {
        const materialIssueAdj = await prisma.stockAdjustment.findFirst({
          where: {
            productionOrderId: checkProductionOrderId,
            adjustmentType: "PRODUCTION_MATERIAL_ISSUE",
            status: "APPROVED",
          },
        });

        if (!materialIssueAdj) {
          throw new ApiError(
            400,
            "Daily Plan cannot be started because the required raw materials have not yet been issued for this Production Order. Please complete the Material Issue through Stock Adjustment."
          );
        }
      }


      // Formulate update fields
      const updateData: any = {
        weeklyProgramId: checkWeeklyProgramId,
        productionOrderId: checkProductionOrderId,
        productionDate: prodDate,
        machineId: checkMachineId,
        shiftId: checkShiftId,
        plannedQty: checkPlannedQty,
        plannedHours: data.plannedHours !== undefined ? data.plannedHours : existingPlan.plannedHours,
        priority: data.priority || existingPlan.priority,
        status: data.status || existingPlan.status,
        remarks: data.remarks !== undefined ? data.remarks : existingPlan.remarks,
        updatedBy: userId,
      };

      const updatedPlan = await dailyPlanRepository.update(dailyPlanId, updateData, tx);

      return updatedPlan;
    });
  }

  async delete(dailyPlanId: string) {
    const existingPlan = await dailyPlanRepository.findById(dailyPlanId);
    if (!existingPlan) {
      throw new ApiError(404, `Daily Plan with ID ${dailyPlanId} not found`);
    }

    // Verify if there are already hourly production logs registered
    const hourlyLogsCount = await prisma.hourlyProduction.count({
      where: { dailyPlanId },
    });

    if (hourlyLogsCount > 0) {
      throw new ApiError(400, `Cannot delete Daily Plan because it already has ${hourlyLogsCount} hourly production logs registered`);
    }

    return dailyPlanRepository.delete(dailyPlanId);
  }

  async findById(dailyPlanId: string) {
    const plan = await dailyPlanRepository.findById(dailyPlanId);
    if (!plan) {
      throw new ApiError(404, `Daily Plan with ID ${dailyPlanId} not found`);
    }
    return plan;
  }

  async findAll(filters: {
    weeklyProgramId?: string;
    productionOrderId?: string;
    machineId?: string;
    shiftId?: string;
    productionDate?: string;
    status?: string;
  }) {
    let dateObj: Date | undefined;
    if (filters.productionDate) {
      const [yyyy, mm, dd] = filters.productionDate.split("-").map(Number);
      dateObj = new Date(Date.UTC(yyyy, mm - 1, dd));
    }

    return dailyPlanRepository.findAll({
      weeklyProgramId: filters.weeklyProgramId,
      productionOrderId: filters.productionOrderId,
      machineId: filters.machineId,
      shiftId: filters.shiftId,
      productionDate: dateObj,
      status: filters.status,
    });
  }
}

export default new DailyPlanService();
