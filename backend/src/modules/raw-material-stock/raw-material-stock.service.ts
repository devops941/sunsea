import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateRawMaterialStockInput, UpdateRawMaterialStockInput } from "./raw-material-stock.validation";

class RawMaterialStockService {
  async create(data: CreateRawMaterialStockInput) {
    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { storeId: data.storeId },
    });
    if (!store) {
      throw new ApiError(404, `Store with ID ${data.storeId} not found`);
    }

    // Verify raw material exists
    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { rawMaterialId: data.rawMaterialId },
    });
    if (!rawMaterial) {
      throw new ApiError(404, `Raw Material with ID ${data.rawMaterialId} not found`);
    }

    // In the updated schema, raw material stock is part of the RawMaterial model itself
    return prisma.rawMaterial.update({
      where: { rawMaterialId: data.rawMaterialId },
      data: {
        storeId: data.storeId,
        locationId: data.locationId ?? rawMaterial.locationId,
        batchNo: data.batchNo ?? rawMaterial.batchNo,
        onHandQty: {
          increment: data.onHandQty ?? 0,
        },
        reservedQty: {
          increment: data.reservedQty ?? 0,
        },
        status: data.status ?? rawMaterial.status,
        narration: data.remarks ?? rawMaterial.narration,
        lastMovementAt: new Date(),
      },
      include: {
        store: true,
      },
    });
  }

  async findAll(query?: { search?: string; storeId?: string; storeCategory?: string }) {
    const whereClause: any = {};
    if (query?.storeId) {
      whereClause.storeId = query.storeId;
    }
    if (query?.storeCategory) {
      whereClause.store = { storeCategory: query.storeCategory };
    }
    if (query?.search) {
      whereClause.OR = [
        { materialName: { contains: query.search, mode: 'insensitive' } },
        { rawMaterialId: { contains: query.search, mode: 'insensitive' } },
        { batchNo: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Return all raw materials as they represent the stock now
    const stockItems = await prisma.rawMaterial.findMany({
      where: whereClause,
      include: {
        store: {
          include: {
            location: true
          }
        },
        category: true,
        storeLocation: true
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    return stockItems;
  }

  async findById(id: string) {
    const stock = await prisma.rawMaterial.findUnique({
      where: { rawMaterialId: id },
      include: {
        store: true,
        category: true
      },
    });

    if (!stock) {
      throw new ApiError(
        404,
        `Raw Material with ID ${id} not found`
      );
    }

    return stock;
  }

  async update(id: string, data: UpdateRawMaterialStockInput) {
    const existing = await this.findById(id);

    return prisma.rawMaterial.update({
      where: { rawMaterialId: id },
      data: {
        onHandQty: data.onHandQty ?? existing.onHandQty,
        reservedQty: data.reservedQty ?? existing.reservedQty,
        locationId: data.locationId ?? existing.locationId,
        batchNo: data.batchNo ?? existing.batchNo,
        status: data.status ?? existing.status,
        narration: data.remarks ?? (existing as any).narration,
        lastMovementAt: new Date(),
      },
      include: {
        store: true,
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);

    // Instead of deleting the raw material, we zero out its stock fields
    return prisma.rawMaterial.update({
      where: { rawMaterialId: id },
      data: {
        onHandQty: 0,
        reservedQty: 0,
        lastMovementAt: new Date()
      }
    });
  }
  async deductForPurchaseReturn(
    items: { rawMaterialId: string; quantity: number; storeId: string }[],
    refDocNo: string,
    txClient?: any
  ) {
    const db = txClient || prisma;
    for (const item of items) {
      console.log(
        `[PurchaseReturn] Deducting ${item.quantity} of raw material ${item.rawMaterialId} from store ${item.storeId}`
      );

      const rawMaterial = await db.rawMaterial.findUnique({
        where: { rawMaterialId: item.rawMaterialId },
      });

      if (!rawMaterial) {
        throw new ApiError(404, `Raw material ${item.rawMaterialId} not found`);
      }

      const currentStock = Number(rawMaterial.onHandQty || 0);
      if (currentStock < item.quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for raw material ${item.rawMaterialId} (current on-hand: ${currentStock}, attempted return: ${item.quantity})`
        );
      }

      // Deduct onHandQty using update (throws P2025 if record missing)
      await db.rawMaterial.update({
        where: { rawMaterialId: item.rawMaterialId },
        data: {
          onHandQty: { decrement: item.quantity },
          lastMovementAt: new Date(),
        },
      });

      // Log RawMaterialTransaction audit entry
      await db.rawMaterialTransaction.create({
        data: {
          storeId: item.storeId,
          rawMaterialId: item.rawMaterialId,
          txnType: "PURCHASE_RETURN_OUT",
          qty: item.quantity,
          txnDateTime: new Date(),
          remarks: `Deducted ${item.quantity} units for Purchase Return ${refDocNo}`,
        },
      });

      console.log(
        `[PurchaseReturn] Successfully deducted ${item.quantity} of raw material ${item.rawMaterialId}. New on-hand: ${currentStock - item.quantity}`
      );
    }
  }
}

export default new RawMaterialStockService();
