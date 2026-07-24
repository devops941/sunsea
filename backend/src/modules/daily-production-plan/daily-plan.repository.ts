import { prisma } from "../../config/prisma";

export class DailyPlanRepository {
  async create(data: any, tx?: any) {
    const client = tx || prisma;
    return client.dailyProductionPlan.create({
      data,
      include: {
        weeklyMachineProgram: true,
        productionOrder: {
          include: {
            productItem: {
              include: {
                productionSteps: { orderBy: { stepOrder: 'asc' } }
              }
            },
          },
        },
        machine: true,
        shift: true,
      },
    });
  }

  async update(dailyPlanId: string, data: any, tx?: any) {
    const client = tx || prisma;
    return client.dailyProductionPlan.update({
      where: { dailyPlanId },
      data,
      include: {
        weeklyMachineProgram: true,
        productionOrder: {
          include: {
            productItem: {
              include: {
                productionSteps: { orderBy: { stepOrder: 'asc' } }
              }
            },
          },
        },
        machine: true,
        shift: true,
        hourlyProductions: {
          select: { qtyProduced: true, hourIndex: true }
        },
        carryForwardFrom: { select: { dailyPlanId: true } },
        carryForwardTo: { select: { dailyPlanId: true, productionDate: true, shiftId: true, status: true } },
      },
    });
  }

  async delete(dailyPlanId: string, tx?: any) {
    const client = tx || prisma;
    return client.dailyProductionPlan.delete({
      where: { dailyPlanId },
    });
  }

  async findById(dailyPlanId: string) {
    return prisma.dailyProductionPlan.findUnique({
      where: { dailyPlanId },
      include: {
        weeklyMachineProgram: true,
        productionOrder: {
          include: {
            productItem: {
              include: {
                productionSteps: { orderBy: { stepOrder: 'asc' } }
              }
            },
          },
        },
        machine: true,
        shift: true,
        carryForwardFrom: { select: { dailyPlanId: true, productionDate: true, shiftId: true } },
        carryForwardTo: { select: { dailyPlanId: true, productionDate: true, shiftId: true } },
      },
    });
  }

  async findAll(filters: {
    weeklyProgramId?: string;
    productionOrderId?: string;
    machineId?: string;
    shiftId?: string;
    productionDate?: Date;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (filters.weeklyProgramId) {
      where.weeklyProgramId = filters.weeklyProgramId;
    }
    if (filters.productionOrderId) {
      where.productionOrderId = filters.productionOrderId;
    }
    if (filters.machineId) {
      where.machineId = filters.machineId;
    }
    if (filters.shiftId) {
      where.shiftId = filters.shiftId;
    }
    if (filters.productionDate) {
      where.productionDate = filters.productionDate;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const queryOptions: any = {
      where,
      orderBy: {
        productionDate: "desc",
      },
      include: {
        weeklyMachineProgram: true,
        productionOrder: {
          include: {
            productItem: {
              include: {
                productionSteps: { orderBy: { stepOrder: 'asc' } }
              }
            },
          },
        },
        machine: true,
        shift: true,
        hourlyProductions: {
          select: { qtyProduced: true, hourIndex: true }
        },
        carryForwardFrom: { select: { dailyPlanId: true } },
        carryForwardTo: { select: { dailyPlanId: true, productionDate: true, shiftId: true, status: true } },
      },
    };

    if (filters.page !== undefined || filters.limit !== undefined) {
      const p = filters.page || 1;
      const l = filters.limit || 10;
      queryOptions.skip = (p - 1) * l;
      queryOptions.take = l;
    }

    const [dailyPlans, total] = await Promise.all([
      prisma.dailyProductionPlan.findMany(queryOptions),
      prisma.dailyProductionPlan.count({ where }),
    ]);

    return {
      dailyPlans,
      total,
      page: filters.page || 1,
      limit: filters.limit || total,
      totalPages: filters.limit ? Math.ceil(total / filters.limit) : 1,
    };
  }

  async sumPlannedQtyForWeeklyProgram(weeklyProgramId: string, excludeDailyPlanId?: string, tx?: any) {
    const client = tx || prisma;
    const aggregate = await client.dailyProductionPlan.aggregate({
      where: {
        weeklyProgramId,
        status: { not: "CANCELLED" },
        ...(excludeDailyPlanId ? { dailyPlanId: { not: excludeDailyPlanId } } : {}),
      },
      _sum: {
        plannedQty: true,
      },
    });
    return Number(aggregate._sum.plannedQty || 0);
  }

  async existsByDateMachineShift(productionDate: Date, machineId: string, shiftId: string, productionOrderId: string, excludeDailyPlanId?: string, tx?: any) {
    const client = tx || prisma;
    const count = await client.dailyProductionPlan.count({
      where: {
        productionDate,
        machineId,
        shiftId,
        productionOrderId,
        status: { notIn: ["CANCELLED", "COMPLETED", "STOPPED", "SHORT_CLOSED"] },
        ...(excludeDailyPlanId ? { dailyPlanId: { not: excludeDailyPlanId } } : {}),
      },
    });
    return count > 0;
  }

  async findLatestId(tx?: any): Promise<string | null> {
    const client = tx || prisma;
    const latest = await client.dailyProductionPlan.findFirst({
      orderBy: { dailyPlanId: "desc" },
      select: { dailyPlanId: true },
    });
    return latest?.dailyPlanId || null;
  }
}

export default new DailyPlanRepository();
