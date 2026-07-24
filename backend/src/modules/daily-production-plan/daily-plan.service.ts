import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import dailyPlanRepository from "./daily-plan.repository";
import { CreateDailyPlanInput, UpdateDailyPlanInput } from "./daily-plan.validation";
import { StatusSyncService } from "../../utils/status-sync.util";
import { MachineOperationAssignmentService } from "../machine-operation-assignment/machine-operation-assignment.service";

class DailyPlanService {
  async generateNextDailyPlanId(tx?: any): Promise<string> {
    const client = tx || prisma;
    const latest = await client.dailyProductionPlan.findFirst({
      orderBy: { dailyPlanId: "desc" },
      select: { dailyPlanId: true },
    });

    if (!latest || !latest.dailyPlanId) {
      return "DP0001";
    }

    const match = latest.dailyPlanId.match(/\d+/);
    if (!match) return "DP0001";

    const nextNumber = parseInt(match[0], 10) + 1;
    return `DP${String(nextNumber).padStart(4, "0")}`;
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

    // ✅ STEP 4 RULE: Daily Planning only allowed for WEEKLY_SCHEDULED orders
    // Also allow legacy SCHEDULED and DAILY_PLANNED (for re-planning an existing day)
    const dailyPlanAllowedStatuses = [
      "WEEKLY_SCHEDULED",
      "SCHEDULED",       // legacy alias
      "DAILY_PLANNED",   // already daily planned, adding another shift
      "IN_PROGRESS",     // allow creating plans for orders currently in progress (e.g. next shift/day)
    ];
    if (!dailyPlanAllowedStatuses.includes(productionOrder.status)) {
      throw new ApiError(
        400,
        `Cannot create Daily Plan: Production Order must have status WEEKLY_SCHEDULED. Current status: ${productionOrder.status}. ` +
        `Please create a Weekly Machine Program first.`
      );
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

    // Validate Machine & Shift Active status
    if (!machine.isActive) {
      throw new ApiError(400, `Machine ${machine.machineName} (${data.machineId}) is currently inactive and cannot be planned`);
    }
    if (!shift.isActive) {
      throw new ApiError(400, `Shift ${shift.shiftName} (${data.shiftId}) is currently inactive and cannot be planned`);
    }

    // Resolve assignment and validate Operator + Shift Incharge
    const assignment = await MachineOperationAssignmentService.resolveAssignment(data.machineId, data.shiftId, prodDate);

    if (!assignment || !assignment.operators || assignment.operators.length === 0) {
      throw new ApiError(400, "No operator is assigned to the selected machine for this shift. Please assign an operator before creating the Daily Production Plan.");
    }
    const inactiveOp = assignment.operators.find(op => op.status !== "active");
    if (inactiveOp) {
      throw new ApiError(400, `Operator ${inactiveOp.fullName} is currently inactive.`);
    }

    // 5. Validation: Planned quantity must be greater than zero
    if (data.plannedQty <= 0) {
      throw new ApiError(400, "Planned quantity must be greater than zero");
    }

    // 6. Carry-forward guard: a source plan can only be carried forward ONCE
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
      // 7. Validation: Machine must not already be planned for the same date, shift, and PO
      const isAlreadyPlanned = await dailyPlanRepository.existsByDateMachineShift(prodDate, data.machineId, data.shiftId, data.productionOrderId, undefined, tx);
      if (isAlreadyPlanned) {
        throw new ApiError(409, `Machine ${data.machineId} is already scheduled with production order ${data.productionOrderId} on shift ${data.shiftId} for date ${data.productionDate}`);
      }

      const nextId = await this.generateNextDailyPlanId(tx);

      const created = await dailyPlanRepository.create(
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

      // ✅ STEP 4: Transition Production Order to DAILY_PLANNED after first daily plan created
      if (productionOrder.status === "WEEKLY_SCHEDULED" || productionOrder.status === "SCHEDULED") {
        await tx.productionOrder.update({
          where: { productionOrderId: data.productionOrderId },
          data: { status: "DAILY_PLANNED" },
        });
        await StatusSyncService.logHistory(
          tx,
          data.productionOrderId,
          productionOrder.status,
          "DAILY_PLANNED",
          userId,
          `Daily production plan ${nextId} created for ${data.productionDate}`,
          "DAILY_PLAN_CREATED"
        );
      }

      return created;
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

    // Validate Machine & Shift Active status
    if (!machine.isActive) {
      throw new ApiError(400, `Machine ${machine.machineName} (${checkMachineId}) is currently inactive and cannot be planned`);
    }
    if (!shift.isActive) {
      throw new ApiError(400, `Shift ${shift.shiftName} (${checkShiftId}) is currently inactive and cannot be planned`);
    }

    // Resolve assignment and validate Operator + Shift Incharge
    const assignment = await MachineOperationAssignmentService.resolveAssignment(checkMachineId, checkShiftId, prodDate);

    if (!assignment || !assignment.operators || assignment.operators.length === 0) {
      throw new ApiError(400, "No operator is assigned to the selected machine for this shift. Please assign an operator before creating the Daily Production Plan.");
    }
    const inactiveOp = assignment.operators.find(op => op.status !== "active");
    if (inactiveOp) {
      throw new ApiError(400, `Operator ${inactiveOp.fullName} is currently inactive.`);
    }

    // 5. Verify quantity > 0
    if (checkPlannedQty <= 0) {
      throw new ApiError(400, "Planned quantity must be greater than zero");
    }

    return prisma.$transaction(async (tx) => {
      // 6. Verify machine is not already planned on this date, shift & PO (excluding self)
      const isAlreadyPlanned = await dailyPlanRepository.existsByDateMachineShift(prodDate, checkMachineId, checkShiftId, checkProductionOrderId, dailyPlanId, tx);
      if (isAlreadyPlanned) {
        throw new ApiError(
          409,
          `Machine ${checkMachineId} is already scheduled with production order ${checkProductionOrderId} on shift ${checkShiftId} for date ${prodDate.toISOString().split("T")[0]}`
        );
      }

      // ✅ STEP 5 GATE: If transitioning to IN_PROGRESS, production order must be DAILY_PLANNED
      // The actual stock deduction happens via the /start-production API — not here.
      // This just validates the gate and transitions the daily plan status.
      if (
        data.status === "IN_PROGRESS" &&
        existingPlan.status !== "IN_PROGRESS"
      ) {
        if (!["DAILY_PLANNED", "IN_PRODUCTION", "IN_PROGRESS", "WEEKLY_SCHEDULED", "MATERIAL_ISSUED"].includes(productionOrder.status)) {
          throw new ApiError(
            400,
            `Daily Plan cannot be started because the Production Order status is "${productionOrder.status}". ` +
            `Please ensure the production order is in DAILY_PLANNED status and use the Start Production action.`
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
        status: data.status === "NEXT_STEP" ? "IN_PROGRESS" : (data.status || existingPlan.status),
        remarks: data.remarks !== undefined ? data.remarks : existingPlan.remarks,
        updatedBy: userId,
      };

      // Handle dynamic post-production steps
      if (
        (data.status === "COMPLETED" || data.status === "NEXT_STEP" || data.status === "POST_PRODUCTION")
      ) {
        const productionOrderFull = await tx.productionOrder.findUnique({
          where: { productionOrderId: checkProductionOrderId },
          include: { productItem: { include: { productionSteps: { orderBy: { stepOrder: "asc" } } } } },
        });

        if (productionOrderFull) {
          const customSteps = productionOrderFull.productItem?.productionSteps || [];
          const totalCustomStepsCount = customSteps.length;
          
          if (data.status === "POST_PRODUCTION" && existingPlan.status !== "POST_PRODUCTION") {
            // First time entering POST_PRODUCTION
            const firstStepName = totalCustomStepsCount > 0 ? customSteps[0].stepKey : "Post Production";
            await tx.productionOrder.update({
              where: { productionOrderId: checkProductionOrderId },
              data: {
                currentStepIndex: 1,
                currentProductionStep: firstStepName,
                status: "POST_PRODUCTION",
              },
            });
            await StatusSyncService.logHistory(
              tx, checkProductionOrderId, "IN_PRODUCTION", "POST_PRODUCTION", userId,
              "Production completed. Entering post-production phase.", "POST_PRODUCTION_START"
            );
            updateData.status = "POST_PRODUCTION";
          } 
          else if (data.status === "NEXT_STEP" && existingPlan.status === "POST_PRODUCTION") {
            // Advancing through custom steps within POST_PRODUCTION
            const currentIndex = productionOrderFull.currentStepIndex || 1;
            const nextIndex = currentIndex + 1;
            
            if (nextIndex <= totalCustomStepsCount) {
              const nextStepName = customSteps[nextIndex - 1].stepKey;
              await tx.productionOrder.update({
                where: { productionOrderId: checkProductionOrderId },
                data: {
                  currentStepIndex: nextIndex,
                  currentProductionStep: nextStepName,
                  status: "POST_PRODUCTION",
                },
              });
              updateData.status = "POST_PRODUCTION"; // Keep daily plan in POST_PRODUCTION
            }
          } 
          else if (data.status === "COMPLETED" && existingPlan.status !== "COMPLETED") {
            // ✅ STEP 7 → STEP 8: Transition to READY_FOR_DISPATCH
            await tx.productionOrder.update({
              where: { productionOrderId: checkProductionOrderId },
              data: {
                currentStepIndex: totalCustomStepsCount + 1,
                currentProductionStep: "Completed",
                status: "READY_FOR_DISPATCH",
              },
            });
            await StatusSyncService.logHistory(
              tx, checkProductionOrderId, productionOrderFull.status, "READY_FOR_DISPATCH", userId,
              "All post-production steps completed. Ready for dispatch.", "READY_FOR_DISPATCH"
            );
            updateData.status = "COMPLETED";
          }
        }
      }

      const updatedPlan = await dailyPlanRepository.update(dailyPlanId, updateData, tx);

      return updatedPlan;
    }, { timeout: 15000, maxWait: 10000 });
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

    // ✅ If this is the LAST daily plan for the PO, revert PO status back to WEEKLY_SCHEDULED
    const remainingPlans = await prisma.dailyProductionPlan.count({
      where: {
        productionOrderId: existingPlan.productionOrderId,
        dailyPlanId: { not: dailyPlanId },
      },
    });

    if (remainingPlans === 0) {
      const po = await prisma.productionOrder.findUnique({
        where: { productionOrderId: existingPlan.productionOrderId },
      });
      if (po && po.status === "DAILY_PLANNED") {
        await prisma.productionOrder.update({
          where: { productionOrderId: existingPlan.productionOrderId },
          data: { status: "WEEKLY_SCHEDULED" },
        });
      }
    }

    return dailyPlanRepository.delete(dailyPlanId);
  }

  async findById(dailyPlanId: string) {
    const plan = await dailyPlanRepository.findById(dailyPlanId);
    if (!plan) {
      throw new ApiError(404, `Daily Plan with ID ${dailyPlanId} not found`);
    }

    const assignment = await MachineOperationAssignmentService.resolveAssignment(plan.machineId, plan.shiftId, plan.productionDate);

    return {
      ...plan,
      operators: assignment?.operators || [],
      shiftIncharge: assignment?.shiftIncharge || null,
    };
  }

  async findAll(filters: {
    weeklyProgramId?: string;
    productionOrderId?: string;
    machineId?: string;
    shiftId?: string;
    productionDate?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    let dateObj: Date | undefined;
    if (filters.productionDate) {
      const [yyyy, mm, dd] = filters.productionDate.split("-").map(Number);
      dateObj = new Date(Date.UTC(yyyy, mm - 1, dd));
    }

    const result = await dailyPlanRepository.findAll({
      weeklyProgramId: filters.weeklyProgramId,
      productionOrderId: filters.productionOrderId,
      machineId: filters.machineId,
      shiftId: filters.shiftId,
      productionDate: dateObj,
      status: filters.status,
      page: filters.page,
      limit: filters.limit,
    });

    const plansWithAssignments = await Promise.all(result.dailyPlans.map(async (plan: any) => {
      try {
        const assignment = await MachineOperationAssignmentService.resolveAssignment(plan.machineId, plan.shiftId, plan.productionDate);
        return {
          ...plan,
          operators: assignment?.operators || [],
          shiftIncharge: assignment?.shiftIncharge || null,
        };
      } catch (err) {
        return {
          ...plan,
          operator: null,
          shiftIncharge: null,
        };
      }
    }));

    return {
      ...result,
      dailyPlans: plansWithAssignments,
    };
  }
}

export default new DailyPlanService();
