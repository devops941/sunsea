import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

export class ProductCapacityHistoryService {
  async create(data: {
    productId: number;
    previousCapacity: number;
    newCapacity: number;
    productionDate: Date;
    machineId: string;
    shiftId: string;
    productionOrderId: string;
    targetQty: number;
    actualQty: number;
    operators?: string | null;
    updatedBy?: string | null;
  }) {
    const achievementPct = data.targetQty > 0
      ? (data.actualQty / data.targetQty) * 100
      : 0;

    return prisma.$transaction(async (tx) => {
      const record = await tx.productCapacityHistory.create({
        data: {
          productId: data.productId,
          previousCapacity: data.previousCapacity,
          newCapacity: data.newCapacity,
          productionDate: data.productionDate,
          machineId: data.machineId,
          shiftId: data.shiftId,
          productionOrderId: data.productionOrderId,
          targetQty: data.targetQty,
          actualQty: data.actualQty,
          achievementPct,
          operators: data.operators || null,
          updatedBy: data.updatedBy || null,
        },
      });

      // Keep only latest 2 records (CURRENT and 1 PREVIOUS) for this machine
      const existing = await tx.productCapacityHistory.findMany({
        where: { productId: data.productId, machineId: data.machineId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (existing.length > 2) {
        const idsToDelete = existing.slice(2).map((r) => r.id);
        await tx.productCapacityHistory.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      return record;
    });
  }

  async manualChange(data: {
    productId: number;
    date: string;
    shift: string;
    machine: string;
    operators: string;
    newCapacity: number;
    updatedBy?: string;
  }) {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { capacityLitres: true },
    });
    if (!product) throw new ApiError(404, "Product not found");

    const previousCapacity = Number(product.capacityLitres ?? 0);

    const targetQty = data.newCapacity;
    const actualQty = data.newCapacity;
    const achievementPct = targetQty > 0 ? 100 : 0;
    const machineId = (data.machine || "MANUAL").slice(0, 20);
    const prodDate = new Date(data.date);

    const history = await prisma.$transaction(async (tx) => {
      const hist = await tx.productCapacityHistory.create({
        data: {
          productId: data.productId,
          previousCapacity,
          newCapacity: data.newCapacity,
          productionDate: prodDate,
          machineId,
          shiftId: (data.shift || "MANUAL").slice(0, 20),
          productionOrderId: "MANUAL",
          targetQty,
          actualQty,
          achievementPct,
          operators: data.operators || null,
          updatedBy: data.updatedBy || null,
        },
      });

      // Keep only latest 2 records (CURRENT and 1 PREVIOUS) for this machine
      const existing = await tx.productCapacityHistory.findMany({
        where: { productId: data.productId, machineId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (existing.length > 2) {
        const idsToDelete = existing.slice(2).map((r) => r.id);
        await tx.productCapacityHistory.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      await tx.product.update({
        where: { id: data.productId },
        data: { capacityLitres: data.newCapacity },
      });

      // Propagate to future unstarted daily plans for this machine and product
      if (machineId !== "MANUAL") {
        const unstartedPlans = await tx.dailyProductionPlan.findMany({
          where: {
            machineId,
            productionOrder: { productItemId: data.productId },
            status: { in: ["PLANNED", "DRAFT"] },
            productionDate: { gte: prodDate },
            hourlyProductions: { none: { totalQtyProduced: { gt: 0 } } },
          },
        });

        for (const plan of unstartedPlans) {
          await tx.dailyProductionPlan.update({
            where: { dailyPlanId: plan.dailyPlanId },
            data: { plannedQty: data.newCapacity },
          });

          if (plan.weeklyProgramId) {
            await tx.weeklyMachineProgram.update({
              where: { weeklyProgramId: plan.weeklyProgramId },
              data: { plannedQty: data.newCapacity },
            }).catch(() => {});
          }
        }
      }

      return hist;
    });

    return history;
  }

  async findByProduct(productId: number) {
    const allRecords = await prisma.productCapacityHistory.findMany({
      where: { productId },
      include: {
        product: {
          select: { productName: true, productCode: true, capacityLitres: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Prune so that each machine only retains at most 2 records (1 CURRENT + 1 PREVIOUS)
    const machineGroups = new Map<string, any[]>();
    const prunedRecords: any[] = [];
    const idsToDelete: bigint[] = [];

    allRecords.forEach((rec) => {
      const key = rec.machineId || "INITIAL";
      if (!machineGroups.has(key)) {
        machineGroups.set(key, []);
      }
      const group = machineGroups.get(key)!;
      if (group.length < 2) {
        group.push(rec);
        prunedRecords.push(rec);
      } else {
        idsToDelete.push(rec.id);
      }
    });

    // Asynchronously delete obsolete 3rd+ records from database
    if (idsToDelete.length > 0) {
      prisma.productCapacityHistory.deleteMany({
        where: { id: { in: idsToDelete } },
      }).catch(() => {});
    }

    return prunedRecords;
  }

  async getLatestByProduct(productId: number) {
    return prisma.productCapacityHistory.findFirst({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getLatestByProductAndMachine(productId: number, machineId: string) {
    return prisma.productCapacityHistory.findFirst({
      where: { productId, machineId },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const productCapacityHistoryService = new ProductCapacityHistoryService();
