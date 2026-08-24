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

  async findAll(query?: {
    search?: string;
    storeId?: string;
    storeCategory?: string;
    itemType?: string;
    categoryId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const whereClause: any = {};
    const andConditions: any[] = [];

    if (query?.storeId) {
      andConditions.push({ storeId: query.storeId });
    }
    if (query?.storeCategory) {
      andConditions.push({ store: { storeCategory: query.storeCategory } });
    }
    if (query?.itemType) {
      if (query.itemType === "RAW_MATERIAL") {
        andConditions.push({
          OR: [{ itemType: "RAW_MATERIAL" }, { itemType: null }],
        });
      } else {
        andConditions.push({ itemType: query.itemType });
      }
    }
    if (query?.categoryId) {
      andConditions.push({ categoryId: Number(query.categoryId) });
    }
    if (query?.status) {
      andConditions.push({ status: query.status });
    }
    if (query?.search) {
      andConditions.push({
        OR: [
          { materialName: { contains: query.search, mode: 'insensitive' } },
          { rawMaterialId: { contains: query.search, mode: 'insensitive' } },
          { batchNo: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;

    const [stockItems, total] = await Promise.all([
      prisma.rawMaterial.findMany({
        where: whereClause,
        include: {
          store: { include: { location: true } },
          category: true,
          storeLocation: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.rawMaterial.count({ where: whereClause }),
    ]);

    return {
      data: stockItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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

    }
  }
}

export default new RawMaterialStockService();
