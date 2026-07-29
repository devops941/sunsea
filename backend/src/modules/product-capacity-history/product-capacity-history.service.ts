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

    return prisma.productCapacityHistory.create({
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

    // Keep max 2 records per product: delete oldest records beyond the 1 most recent
    const existing = await prisma.productCapacityHistory.findMany({
      where: { productId: data.productId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (existing.length >= 2) {
      const idsToDelete = existing.slice(1).map(r => r.id);
      await prisma.productCapacityHistory.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    const targetQty = data.newCapacity;
    const actualQty = data.newCapacity;
    const achievementPct = targetQty > 0 ? 100 : 0;

    const [history] = await prisma.$transaction([
      prisma.productCapacityHistory.create({
        data: {
          productId: data.productId,
          previousCapacity,
          newCapacity: data.newCapacity,
          productionDate: new Date(data.date),
          machineId: data.machine || "MANUAL",
          shiftId: data.shift || "MANUAL",
          productionOrderId: "MANUAL",
          targetQty,
          actualQty,
          achievementPct,
          operators: data.operators || null,
          updatedBy: data.updatedBy || null,
        },
      }),
      prisma.product.update({
        where: { id: data.productId },
        data: { capacityLitres: data.newCapacity },
      }),
    ]);

    return history;
  }

  async findByProduct(productId: number) {
    return prisma.productCapacityHistory.findMany({
      where: { productId },
      include: {
        product: {
          select: { productName: true, productCode: true, capacityLitres: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getLatestByProduct(productId: number) {
    return prisma.productCapacityHistory.findFirst({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const productCapacityHistoryService = new ProductCapacityHistoryService();
