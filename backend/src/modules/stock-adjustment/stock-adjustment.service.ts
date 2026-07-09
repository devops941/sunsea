import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

export class StockAdjustmentService {
  static async createStockAdjustment(data: any, userId: string) {
    const { items, ...adjustmentData } = data;

    return prisma.stockAdjustment.create({
      data: {
        ...adjustmentData,
        createdBy: userId,
        updatedBy: userId,
        items: {
          create: items.map((item: any) => ({
            itemType: item.itemType,
            rawMaterialId: item.rawMaterialId,
            productItemId: item.productItemId ? BigInt(item.productItemId) : null,
            storeId: item.storeId,
            currentQty: item.currentQty,
            adjustedQty: item.adjustedQty,
            difference: item.difference,
            remarks: item.remarks,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  static async getStockAdjustments(filters: any) {
    const { status, search, page = 1, limit = 10 } = filters;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { adjustmentNumber: { contains: search, mode: "insensitive" } },
        { reason: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.stockAdjustment.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.stockAdjustment.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  static async getStockAdjustmentById(id: bigint | number | string) {
    const adjustment = await prisma.stockAdjustment.findUnique({
      where: { id: BigInt(id) },
      include: {
        items: {
          include: {
            rawMaterial: true,
            product: true,
            store: true,
          },
        },
      },
    });

    if (!adjustment) {
      throw new ApiError(404, "Stock Adjustment not found");
    }

    return adjustment;
  }

  static async updateStockAdjustment(id: bigint | number | string, data: any, userId: string) {
    const { items, ...adjustmentData } = data;
    const existing = await this.getStockAdjustmentById(id);

    if (existing.status !== "DRAFT") {
      throw new ApiError(400, "Only DRAFT stock adjustments can be updated");
    }

    return prisma.$transaction(async (tx) => {
      await tx.stockAdjustment.update({
        where: { id: BigInt(id) },
        data: {
          ...adjustmentData,
          updatedBy: userId,
        },
      });

      if (items && items.length > 0) {
        await tx.stockAdjustmentItem.deleteMany({
          where: { stockAdjustmentId: BigInt(id) },
        });

        await tx.stockAdjustmentItem.createMany({
          data: items.map((item: any) => ({
            stockAdjustmentId: BigInt(id),
            itemType: item.itemType,
            rawMaterialId: item.rawMaterialId,
            productItemId: item.productItemId ? BigInt(item.productItemId) : null,
            storeId: item.storeId,
            currentQty: item.currentQty,
            adjustedQty: item.adjustedQty,
            difference: item.difference,
            remarks: item.remarks,
          })),
        });
      }

      return tx.stockAdjustment.findUnique({
        where: { id: BigInt(id) },
        include: { items: true },
      });
    });
  }

  static async approveStockAdjustment(id: bigint | number | string, status: string, reason: string | undefined, userId: string) {
    const existing = await this.getStockAdjustmentById(id);

    if (existing.status === "APPROVED") {
      throw new ApiError(400, "Stock Adjustment is already approved");
    }

    if (status !== "APPROVED" && status !== "REJECTED") {
      return prisma.stockAdjustment.update({
        where: { id: BigInt(id) },
        data: { status: status as any, reason: reason || existing.reason, updatedBy: userId },
      });
    }

    if (status === "REJECTED") {
      return prisma.stockAdjustment.update({
        where: { id: BigInt(id) },
        data: { status: "REJECTED", reason: reason || existing.reason, updatedBy: userId },
      });
    }

    // Process Approval
    return prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        if (item.difference.toNumber() === 0) continue;

        if (item.itemType === "RAW_MATERIAL" && item.rawMaterialId) {
          // Update RM Stock
          const rm = await tx.rawMaterial.findUnique({ where: { rawMaterialId: item.rawMaterialId } });
          if (!rm) throw new ApiError(404, `Raw Material ${item.rawMaterialId} not found`);

          await tx.rawMaterial.update({
            where: { rawMaterialId: item.rawMaterialId },
            data: {
              onHandQty: { increment: item.difference },
              updatedBy: userId,
            },
          });

          // Create Transaction
          await tx.rawMaterialTransaction.create({
            data: {
              storeId: item.storeId,
              rawMaterialId: item.rawMaterialId,
              txnType: item.difference.toNumber() > 0 ? "STOCK_ADJUSTMENT_IN" : "STOCK_ADJUSTMENT_OUT",
              qty: new (require('decimal.js').Decimal)(Math.abs(item.difference.toNumber())),
              remarks: `Adjustment ${existing.adjustmentNumber}: ${item.remarks || ""}`,
            },
          });

        } else if (item.itemType === "FINISHED_GOODS" && item.productItemId) {
          // Find or create FG stock
          const fgStock = await tx.finishedGoodsStock.findUnique({
            where: {
              storeId_productItemId: {
                storeId: item.storeId,
                productItemId: item.productItemId,
              },
            },
          });

          if (fgStock) {
            await tx.finishedGoodsStock.update({
              where: {
                storeId_productItemId: {
                  storeId: item.storeId,
                  productItemId: item.productItemId,
                },
              },
              data: { onHandQty: { increment: item.difference } },
            });
          } else {
            await tx.finishedGoodsStock.create({
              data: {
                storeId: item.storeId,
                productItemId: item.productItemId,
                onHandQty: item.difference,
              },
            });
          }

          // Create Transaction
          await tx.finishedGoodsTransaction.create({
            data: {
              txnDateTime: new Date(),
              storeId: item.storeId,
              productItemId: item.productItemId,
              txnType: item.difference.toNumber() > 0 ? "STOCK_ADJUSTMENT_IN" : "STOCK_ADJUSTMENT_OUT",
              qty: new (require('decimal.js').Decimal)(Math.abs(item.difference.toNumber())),
              relatedDocNo: existing.adjustmentNumber,
              remarks: `Adjustment ${existing.adjustmentNumber}: ${item.remarks || ""}`,
              createdBy: userId,
            },
          });
        }
      }

      return tx.stockAdjustment.update({
        where: { id: BigInt(id) },
        data: {
          status: "APPROVED",
          approvedBy: userId,
          approvedAt: new Date(),
          updatedBy: userId,
        },
      });
    });
  }

  static async deleteStockAdjustment(id: bigint | number | string) {
    const existing = await this.getStockAdjustmentById(id);
    if (existing.status === "APPROVED") {
      throw new ApiError(400, "Cannot delete an approved stock adjustment");
    }
    return prisma.stockAdjustment.delete({ where: { id: BigInt(id) } });
  }
}
