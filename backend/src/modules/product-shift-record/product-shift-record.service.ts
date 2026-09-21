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
            machine: { select: { machineName: true } },
            productionOrder: { select: { productionOrderId: true } },
          },
        });
      });
    }

    if (data.achievedQty > currentCapacity) {
      await prisma.$transaction(async (tx) => {
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

    return createdRecord
      ? {
          ...createdRecord,
          shift: {
            shiftCode: createdRecord.shiftId,
            shiftName: createdRecord.shiftId === "NIGHT" ? "Night Shift" : "Day Shift",
          },
        }
      : null;
  }

  async findByProduct(productId: number) {
    const records = await prisma.productShiftRecord.findMany({
      where: { productId },
      include: {
        product: { select: { productName: true, productCode: true } },
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

    return records.map((r) => ({
      ...r,
      shift: {
        shiftCode: r.shiftId,
        shiftName: r.shiftId === "NIGHT" ? "Night Shift" : "Day Shift",
      },
    }));
  }

  async getHighestByProduct(productId: number) {
    const record = await prisma.productShiftRecord.findFirst({
      where: { productId, isHighest: true },
      include: {
        machine: { select: { machineName: true } },
      },
    });

    if (!record) return null;
    return {
      ...record,
      shift: {
        shiftCode: record.shiftId,
        shiftName: record.shiftId === "NIGHT" ? "Night Shift" : "Day Shift",
      },
    };
  }
}

export default new ProductShiftRecordService();
