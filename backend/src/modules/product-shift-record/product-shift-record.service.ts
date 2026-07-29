import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateRecordInput } from "./product-shift-record.validation";

class ProductShiftRecordService {
  async create(data: CreateRecordInput) {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    const currentCapacity = Number(product.capacityLitres) || 0;

    const existing = await prisma.productShiftRecord.findFirst({
      where: { isHighest: true, productId: data.productId },
      orderBy: { achievedQty: "desc" },
    });

    let createdRecord = null;

    if (!existing || Number(existing.achievedQty) < data.achievedQty) {
      createdRecord = await prisma.$transaction(async (tx) => {
        await tx.productShiftRecord.updateMany({
          where: { productId: data.productId, isHighest: true },
          data: { isHighest: false },
        });

        return tx.productShiftRecord.create({
          data: {
            productId: data.productId,
            productionOrderId: data.productionOrderId,
            machineId: data.machineId,
            shiftId: data.shiftId,
            achievedQty: data.achievedQty,
            targetQty: data.targetQty,
            operatorIds: data.operatorIds || null,
            recordedDate: new Date(),
            isHighest: true,
          },
          include: {
            product: { select: { productName: true, productCode: true } },
            shift: { select: { shiftName: true } },
            machine: { select: { machineName: true } },
            productionOrder: { select: { productionOrderId: true } },
          },
        });
      });
    }

    if (data.achievedQty > currentCapacity) {
      await prisma.$transaction(async (tx) => {
        // Keep max 2 records per product: delete oldest beyond the 1 most recent
        const existing = await tx.productCapacityHistory.findMany({
          where: { productId: data.productId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (existing.length >= 2) {
          const idsToDelete = existing.slice(1).map(r => r.id);
          await tx.productCapacityHistory.deleteMany({
            where: { id: { in: idsToDelete } },
          });
        }

        await tx.product.update({
          where: { id: data.productId },
          data: { capacityLitres: data.achievedQty },
        });

        await tx.productCapacityHistory.create({
          data: {
            productId: data.productId,
            previousCapacity: currentCapacity,
            newCapacity: data.achievedQty,
            productionDate: new Date(),
            machineId: data.machineId,
            shiftId: data.shiftId,
            productionOrderId: data.productionOrderId,
            targetQty: data.targetQty,
            actualQty: data.achievedQty,
            achievementPct: data.targetQty > 0 ? (data.achievedQty / data.targetQty) * 100 : 0,
            operators: data.operatorIds || null,
          },
        });
      });
    }

    return createdRecord;
  }

  async findByProduct(productId: number) {
    const records = await prisma.productShiftRecord.findMany({
      where: { productId },
      include: {
        product: { select: { productName: true, productCode: true } },
        shift: { select: { shiftName: true, shiftCode: true } },
        machine: { select: { machineName: true } },
        productionOrder: {
          select: {
            productionOrderId: true,
            producedQty: true,
            targetQty: true,
          },
        },
      },
      orderBy: { recordedDate: "desc" },
    });

    return records;
  }

  async getHighestByProduct(productId: number) {
    return prisma.productShiftRecord.findFirst({
      where: { productId, isHighest: true },
      include: {
        shift: { select: { shiftName: true } },
        machine: { select: { machineName: true } },
      },
    });
  }
}

export default new ProductShiftRecordService();
