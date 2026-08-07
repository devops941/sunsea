import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { getIO } from "../../socket/socket";

export class StockAdjustmentService {
  static async getNextAdjustmentNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ADJ-${year}-`;

    const last = await prisma.stockAdjustment.findFirst({
      where: { adjustmentNumber: { startsWith: prefix } },
      orderBy: { adjustmentNumber: "desc" },
      select: { adjustmentNumber: true },
    });

    let seq = 1;
    if (last?.adjustmentNumber) {
      const parts = last.adjustmentNumber.split("-");
      seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
    }
    return `${prefix}${String(seq).padStart(4, "0")}`;
  }
  static async createStockAdjustment(data: any, userId: string) {
    const { items, adjustmentDate, adjustmentType, productionOrderId, ...adjustmentData } = data;

    // Prevent duplicate PMI for same PO
    if (adjustmentType === "PRODUCTION_MATERIAL_ISSUE" && productionOrderId) {
      const existing = await prisma.stockAdjustment.findFirst({
        where: {
          adjustmentType: "PRODUCTION_MATERIAL_ISSUE",
          productionOrderId,
          status: { not: "REJECTED" },
        },
      });
      if (existing) {
        throw new ApiError(
          400,
          `A Material Issue already exists for Production Order ${productionOrderId} (${existing.adjustmentNumber}). Duplicate issue is not allowed.`
        );
      }
    }

    const targetStatus = adjustmentData.status || "DRAFT";
    const created = await prisma.stockAdjustment.create({
      data: {
        ...adjustmentData,
        status: "DRAFT",
        adjustmentDate: adjustmentDate ? new Date(adjustmentDate) : new Date(),
        adjustmentType: adjustmentType || "STOCK_INCREASE",
        productionOrderId: productionOrderId || null,
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

    if (targetStatus === "APPROVED") {
      return await this.approveStockAdjustment(created.id, "APPROVED", "Auto-approved on creation", userId);
    }

    return created;
  }

  static async getStockAdjustments(filters: any) {
    const { status, search, page = 1, limit = 10, adjustmentType, productionOrderId, dateFrom, dateTo } = filters;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (adjustmentType) where.adjustmentType = adjustmentType;
    if (productionOrderId) where.productionOrderId = { contains: productionOrderId, mode: "insensitive" };
    if (dateFrom || dateTo) {
      where.adjustmentDate = {};
      if (dateFrom) where.adjustmentDate.gte = new Date(dateFrom);
      if (dateTo) where.adjustmentDate.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { adjustmentNumber: { contains: search, mode: "insensitive" } },
        { reason: { contains: search, mode: "insensitive" } },
        { productionOrderId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.stockAdjustment.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          productionOrder: {
            select: {
              productionOrderId: true,
              productItem: { select: { productName: true, productCode: true } },
            },
          },
          items: {
            select: {
              id: true,
              itemType: true,
              rawMaterialId: true,
              currentQty: true,
              adjustedQty: true,
              difference: true,
              storeId: true,
              remarks: true,
              rawMaterial: { select: { materialName: true, baseUom: true } },
              store: { select: { storeName: true } },
              product: { select: { productName: true, productCode: true } },
            },
          },
        },
      }),
      prisma.stockAdjustment.count({ where }),
    ]);

    // Attach createdBy user names
    const userIds = [...new Set(data.map((d) => d.createdBy).filter(Boolean) as string[])];
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { userId: { in: userIds } }, select: { userId: true, fullName: true } })
      : [];

    const empIds = userIds
      .map(id => {
        try { return BigInt(id); } catch (e) { return null; }
      })
      .filter((id): id is bigint => id !== null);

    const employees = empIds.length > 0
      ? await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullName: true } })
      : [];

    const nameMap = new Map<string, string>();
    users.forEach((u) => nameMap.set(u.userId, u.fullName));
    employees.forEach((e) => nameMap.set(String(e.id), e.fullName));

    const enriched = data.map((d) => ({
      ...d,
      createdByUser: d.createdBy && nameMap.has(d.createdBy) ? { fullName: nameMap.get(d.createdBy) } : null,
    }));

    return {
      data: enriched,
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
        productionOrder: {
          select: {
            productionOrderId: true,
            orderDate: true,
            dueDate: true,
            targetQty: true,
            uom: true,
            status: true,
            machineMachineId: true,
            draftRawMaterials: true,
            productItem: { select: { productName: true, productCode: true } },
            Machine: { select: { machineId: true, machineName: true } },
          },
        },
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

    // Attach createdBy user name
    if (adjustment.createdBy) {
      const user = await prisma.user.findUnique({
        where: { userId: adjustment.createdBy },
        select: { fullName: true },
      });
      if (user) {
        (adjustment as any).createdByUser = { fullName: user.fullName };
      } else {
        let emp = null;
        try {
          const empId = BigInt(adjustment.createdBy);
          emp = await prisma.employee.findUnique({
            where: { id: empId },
            select: { fullName: true }
          });
        } catch (e) {}
        (adjustment as any).createdByUser = emp ? { fullName: emp.fullName } : null;
      }
    } else {
      (adjustment as any).createdByUser = null;
    }

    return adjustment;
  }

  static async updateStockAdjustment(id: bigint | number | string, data: any, userId: string) {
    const { items, adjustmentDate, ...adjustmentData } = data;
    const existing = await this.getStockAdjustmentById(id);

    if (existing.status !== "DRAFT") {
      throw new ApiError(400, "Only DRAFT stock adjustments can be updated");
    }

    // Prevent editing PMI after production started
    if (existing.adjustmentType === "PRODUCTION_MATERIAL_ISSUE" && existing.productionOrderId) {
      const po = await prisma.productionOrder.findUnique({
        where: { productionOrderId: existing.productionOrderId },
        select: { status: true },
      });
      if (po && ["IN_PROGRESS", "COMPLETED"].includes(po.status)) {
        throw new ApiError(400, "Production Material Issue cannot be edited after Production has started.");
      }
    }

    return prisma.$transaction(async (tx) => {
      await tx.stockAdjustment.update({
        where: { id: BigInt(id) },
        data: {
          ...adjustmentData,
          ...(adjustmentDate && { adjustmentDate: new Date(adjustmentDate) }),
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

          const updatedReservedQty = existing.adjustmentType === "PRODUCTION_MATERIAL_ISSUE"
            ? Math.max(0, Number(rm.reservedQty) - Math.abs(item.difference.toNumber()))
            : Number(rm.reservedQty);

          await tx.rawMaterial.update({
            where: { rawMaterialId: item.rawMaterialId },
            data: {
              onHandQty: { increment: item.difference },
              reservedQty: updatedReservedQty,
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

      // If this is a PMI approval, update the production order status
      if (existing.adjustmentType === "PRODUCTION_MATERIAL_ISSUE" && existing.productionOrderId) {
        await tx.productionOrder.update({
          where: { productionOrderId: existing.productionOrderId },
          data: { status: "MATERIAL_ISSUED", updatedBy: userId },
        });
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
    }).then((result) => {
      try { getIO().emit("inventory:stockUpdated", { type: "stock_adjustment" }); } catch (_) {}
      return result;
    });
  }

  static async deleteStockAdjustment(id: bigint | number | string) {
    const existing = await this.getStockAdjustmentById(id);
    if (existing.status === "APPROVED") {
      throw new ApiError(400, "Cannot delete an approved stock adjustment");
    }
    return prisma.stockAdjustment.delete({ where: { id: BigInt(id) } });
  }

  /**
   * Returns Production Orders eligible for Material Issue:
   * - status in RM_AVAILABLE | MATERIAL_RESERVED | APPROVED | SCHEDULED (not yet started)
   * - no existing non-rejected PRODUCTION_MATERIAL_ISSUE for that PO
   */
  static async getProductionOrdersForIssue() {
    const eligibleStatuses = ["RM_AVAILABLE", "MATERIAL_RESERVED", "APPROVED", "SCHEDULED", "PLANNED"];

    // Get POs that already have a non-rejected PMI
    const alreadyIssuedPos = await prisma.stockAdjustment.findMany({
      where: {
        adjustmentType: "PRODUCTION_MATERIAL_ISSUE",
        status: { not: "REJECTED" },
        productionOrderId: { not: null },
      },
      select: { productionOrderId: true },
    });
    const issuedPoIds = alreadyIssuedPos.map((a) => a.productionOrderId).filter(Boolean) as string[];

    const orders = await prisma.productionOrder.findMany({
      where: {
        status: { in: eligibleStatuses },
        ...(issuedPoIds.length > 0 ? { productionOrderId: { notIn: issuedPoIds } } : {}),
      },
      select: {
        productionOrderId: true,
        orderDate: true,
        dueDate: true,
        targetQty: true,
        uom: true,
        status: true,
        machineMachineId: true,
        draftRawMaterials: true,
        productItem: { select: { productName: true, productCode: true } },
        Machine: { select: { machineId: true, machineName: true } },
        rawMaterialTransactions: {
          where: { txnType: "MATERIAL_ISSUE" },
          select: { rawMaterialId: true, qty: true },
        },
      },
      orderBy: { orderDate: "desc" },
    });

    // Enrich with current raw material stock
    const result = await Promise.all(
      orders.map(async (order) => {
        const draftRMs = (order.draftRawMaterials as any[]) || [];

        // Get current stock for each RM
        const enrichedRMs = await Promise.all(
          draftRMs.map(async (rm: any) => {
            const stock = await prisma.rawMaterial.findUnique({
              where: { rawMaterialId: rm.rawMaterialId },
              select: { materialName: true, onHandQty: true, reservedQty: true },
            });

            // Already issued qty for this RM in this PO
            const alreadyIssued = order.rawMaterialTransactions
              .filter((t) => t.rawMaterialId === rm.rawMaterialId)
              .reduce((sum, t) => sum + Number(t.qty), 0);

            const reservedQty = Number(rm.requiredQty || 0);
            const remaining = Math.max(0, reservedQty - alreadyIssued);

            return {
              rawMaterialId: rm.rawMaterialId,
              materialName: stock?.materialName || rm.rawMaterialId,
              requiredQty: reservedQty,
              reservedQty,
              alreadyIssuedQty: alreadyIssued,
              remainingQty: remaining,
              availableStock: stock ? Number(stock.onHandQty) : 0,
              uom: rm.uom || "KG",
              issueQty: remaining, // default to remaining
            };
          })
        );

        return {
          ...order,
          productItemId: undefined,
          rawMaterialTransactions: undefined,
          draftRawMaterials: enrichedRMs,
          targetQty: Number(order.targetQty),
        };
      })
    );

    return result;
  }
}
