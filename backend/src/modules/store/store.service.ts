import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateStoreInput, UpdateStoreInput } from "./store.validation";
import { logAudit } from "../../utils/auditLog.util";

class StoreService {
  async create(data: CreateStoreInput, userId?: string) {
    const existing = await prisma.store.findUnique({
      where: { storeId: data.storeId },
    });

    if (existing) {
      throw new ApiError(409, `Store with ID ${data.storeId} already exists`);
    }

    const existingName = await prisma.store.findFirst({
      where: {
        storeName: { equals: data.storeName, mode: "insensitive" },
      },
    });

    if (existingName) {
      throw new ApiError(409, `Store Name "${data.storeName}" already exists. Please use a unique Store Name.`);
    }

    const newStore = await prisma.store.create({
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
        editHistory: userId
          ? [
              {
                updatedBy: userId,
                updatedAt: new Date().toISOString(),
              },
            ]
          : undefined,
      },
    });

    await logAudit("Store", newStore.storeId, "CREATE", userId, newStore.storeName);

    return newStore;
  }

  async findAll(params: {
    search?: string;
    storeCategory?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {}) {
    const {
      search,
      storeCategory,
      isActive,
      page,
      limit,
      sortBy = "createdAt",
      sortOrder = "asc",
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

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
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
            id: true,
            empCode: true,
            fullName: true,
            roleId: true,
            user: {
              select: {
                roleId: true,
              },
            },
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

    // Resolve createdBy user
    let createdUserName = "Unknown User";
    let createdUserRole = "User";
    if (store.createdBy) {
      if (store.createdBy.startsWith("admin_")) {
        const adminId = BigInt(store.createdBy.replace("admin_", ""));
        const admin = await prisma.admin.findUnique({
          where: { id: adminId },
          select: { username: true, role: { select: { name: true } } },
        });
        if (admin) {
          createdUserName = admin.username;
          createdUserRole = admin.role?.name || "Super Admin";
        }
      } else {
        const user = await prisma.user.findUnique({
          where: { userId: store.createdBy },
          select: { username: true, role: { select: { name: true } } },
        });
        if (user) {
          createdUserName = user.username;
          createdUserRole = user.role?.name || "User";
        }
      }
    }

    // Resolve names for editHistory
    let enrichedEditHistory: any[] = [];
    if (Array.isArray((store as any).editHistory)) {
      enrichedEditHistory = await Promise.all(
        ((store as any).editHistory as any[]).map(async (edit: any) => {
          let name = "Unknown User";
          if (edit.updatedBy) {
            if (edit.updatedBy.startsWith("admin_")) {
              const adminId = BigInt(edit.updatedBy.replace("admin_", ""));
              const admin = await prisma.admin.findUnique({
                where: { id: adminId },
                select: { username: true },
              });
              if (admin) name = admin.username;
            } else {
              const user = await prisma.user.findUnique({
                where: { userId: edit.updatedBy },
                select: { username: true },
              });
              if (user) name = user.username;
            }
          }
          return { ...edit, updatedByName: name };
        })
      );
    }

    if (enrichedEditHistory.length === 0 && store.createdAt) {
      enrichedEditHistory.push({
        updatedBy: store.createdBy,
        updatedByName: createdUserName,
        updatedAt: store.createdAt,
      });
    }

    return {
      ...store,
      createdUserName,
      createdUserRole,
      editHistory: enrichedEditHistory,
    };
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

    if (data.storeName) {
      const existingName = await prisma.store.findFirst({
        where: {
          storeName: { equals: data.storeName, mode: "insensitive" },
          NOT: { storeId },
        },
      });

      if (existingName) {
        throw new ApiError(409, `Store Name "${data.storeName}" already exists. Please use a unique Store Name.`);
      }
    }

    let newEditHistory: any[] = [];
    if (Array.isArray((existingStore as any).editHistory)) {
      newEditHistory = [...(existingStore as any).editHistory].map((e: any) => {
        const { updatedByName, ...raw } = e;
        return raw;
      });
    } else if (existingStore.createdAt) {
      newEditHistory.push({
        updatedBy: existingStore.createdBy,
        updatedAt: existingStore.createdAt instanceof Date ? existingStore.createdAt.toISOString() : existingStore.createdAt,
      });
    }

    if (userId) {
      newEditHistory.push({
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      });
    }

    await prisma.store.update({
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

    if (newEditHistory.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "stores" SET "edit_history" = $1::jsonb WHERE "store_id" = $2`,
        JSON.stringify(newEditHistory),
        storeId
      );
    }

    const updatedStore = await this.findById(storeId);
    await logAudit("Store", updatedStore.storeId, "UPDATE", userId, updatedStore.storeName);
    return updatedStore;
  }

  async delete(storeId: string, userId?: string) {
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
      const deletedStore = await prisma.store.delete({
        where: { storeId },
      });
      await logAudit("Store", deletedStore.storeId, "DELETE", userId, deletedStore.storeName);
      return deletedStore;
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
