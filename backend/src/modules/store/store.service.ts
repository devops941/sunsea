import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateStoreInput, UpdateStoreInput } from "./store.validation";

class StoreService {
  async create(data: CreateStoreInput, userId?: string) {
    const existing = await prisma.store.findUnique({
      where: { storeId: data.storeId },
    });

    if (existing) {
      throw new ApiError(409, `Store with ID ${data.storeId} already exists`);
    }

    return prisma.store.create({
      data: {
        storeId: data.storeId,
        storeName: data.storeName,
        storeCategory: (data.storeCategory as any) || undefined,
        locationId: data.locationId || undefined,
        locationDesc: data.locationDesc || undefined,
        inchargeId: data.inchargeId ? BigInt(data.inchargeId) : undefined,
        allowNegative: data.allowNegative,
        costMethod: data.costMethod || "WAVG",
        gstPlace: data.gstPlace || undefined,
        status: data.status || "Active",
        isActive: data.isActive ?? true,
        createdBy: userId,
      },
    });
  }

  async findAll(params: {
    search?: string;
    storeCategory?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {}) {
    const {
      search,
      storeCategory,
      page,
      limit,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        {
          storeId: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          storeName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          location: {
            is: {
              locationName: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    if (storeCategory) {
      whereClause.storeCategory = storeCategory;
    }

    const queryOptions: any = {
      where: whereClause,
      include: {
        location: true,
        incharge: {
          select: {
            fullName: true,
          },
        },
        _count: {
          select: {
            rawMaterials: true,
            finishedGoodsStocks: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
    };

    if (page !== undefined || limit !== undefined) {
      const p = page || 1;
      const l = limit || 10;

      queryOptions.skip = (p - 1) * l;
      queryOptions.take = l;
    }

    const [stores, total] = await Promise.all([
      prisma.store.findMany(queryOptions),
      prisma.store.count({
        where: whereClause,
      }),
    ]);

    return {
      stores,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages: limit ? Math.ceil(total / limit) : 1,
    };
  }

  async findById(storeId: string) {
    const store = await prisma.store.findUnique({
      where: { storeId },
      include: {
        location: true,
        incharge: {
          select: {
            fullName: true,
          },
        },
        _count: {
          select: { rawMaterials: true },
        },
      },
    });

    if (!store) {
      throw new ApiError(404, `Store with ID ${storeId} not found`);
    }

    return store;
  }

  async update(storeId: string, data: UpdateStoreInput, userId?: string) {
    const existingStore = await this.findById(storeId);

    // If the user is trying to deactivate the store, check for positive stock
    if (data.isActive === false || data.status === "Inactive") {
      const activeRawMaterialStock = await prisma.rawMaterial.findFirst({
        where: { 
          storeId,
          onHandQty: { gt: 0 }
        },
      });

      const activeFinishedGoodsStock = await prisma.finishedGoodsStock.findFirst({
        where: { 
          storeId,
          onHandQty: { gt: 0 }
        },
      });

      if (activeRawMaterialStock || activeFinishedGoodsStock) {
        throw new ApiError(
          400,
          "Cannot deactivate this store because it contains active physical stock (on-hand quantity > 0)."
        );
      }
    }

    return prisma.store.update({
      where: { storeId },
      data: {
        ...data,
        storeCategory: (data.storeCategory as any) || undefined,
        locationId: data.locationId || undefined,
        storeCode: data.storeCode || undefined,
        locationDesc: data.locationDesc || undefined,
        inchargeId: data.inchargeId !== undefined && data.inchargeId !== null && data.inchargeId !== "" ? BigInt(data.inchargeId) : undefined,
        costMethod: data.costMethod || undefined,
        gstPlace: data.gstPlace || undefined,
        status: data.status || undefined,
        updatedBy: userId,
      },
    });
  }

  async delete(storeId: string) {
    await this.findById(storeId);

    const rawMaterialCount = await prisma.rawMaterial.count({
      where: { storeId },
    });

    const finishedGoodsCount = await prisma.finishedGoodsStock.count({
      where: { storeId },
    });

    if (rawMaterialCount > 0 || finishedGoodsCount > 0) {
      throw new ApiError(
        400,
        "Cannot delete this store because it is already assigned to stock."
      );
    }

    try {
      return await prisma.store.delete({
        where: { storeId },
      });
    } catch (error: any) {
      if (error.code === 'P2003' || (error.message && error.message.includes('foreign key constraint'))) {
        throw new ApiError(
          400,
          "Cannot delete this store because it is currently in use by other records."
        );
      }
      throw error;
    }
  }
  async getNextStoreId() {
    const lastStore = await prisma.store.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!lastStore) {
      return "STR001";
    }

    const lastId = lastStore.storeId;
    const match = lastId.match(/\d+/);
    if (!match) {
      return lastId + "001";
    }

    const numberStr = match[0];
    const nextNumber = parseInt(numberStr, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
    const prefix = lastId.substring(0, lastId.indexOf(numberStr));
    const suffix = lastId.substring(lastId.indexOf(numberStr) + numberStr.length);
    return `${prefix}${paddedNumber}${suffix}`;
  }
}

export default new StoreService();
