import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { executeDeleteWithValidation } from "../../utils/deleteValidation";
import { CreateRawMaterialInput, UpdateRawMaterialInput } from "./raw-material.validation";

class RawMaterialService {
  async create(data: CreateRawMaterialInput, userId?: string) {
    const existingId = await prisma.rawMaterial.findUnique({
      where: { rawMaterialId: data.rawMaterialId },
    });

    if (existingId) {
      throw new ApiError(409, `Raw Material with ID ${data.rawMaterialId} already exists`);
    }



    return prisma.$transaction(async (tx) => {
      const rawMaterial = await tx.rawMaterial.create({
        data: {
          rawMaterialId: data.rawMaterialId,
          materialName: data.materialName,
          ...(data.categoryId ? { category: { connect: { id: data.categoryId } } } : {}),
          minimumStock: data.minimumStock,
          baseUom: data.baseUom,
          reorderLevel: data.reorderLevel,
          rate: data.rate,
          ...(data.storeId ? { store: { connect: { storeId: data.storeId } } } : {}),
          isActive: data.isActive ?? true,
          createdBy: userId,
          editHistory: userId
            ? [
                {
                  updatedBy: userId,
                  updatedAt: new Date().toISOString(),
                },
              ]
            : [],
          ...(data.locationId ? { storeLocation: { connect: { id: data.locationId } } } : {}),
          batchNo: data.batchNo ?? null,
          onHandQty: data.onHandQty ?? 0,
          reservedQty: data.reservedQty ?? 0,
          narration: data.narration ?? null,
          lastMovementAt: data.lastMovementAt
            ? new Date(data.lastMovementAt)
            : null,
          status: data.status ?? "Active",
          itemType: data.itemType ?? "RAW_MATERIAL",
        } as any
      });



      return rawMaterial;
    });
  }

  async findAll(params: {
    search?: string;
    storeId?: string;
    isActive?: boolean;
    itemType?: string;
    categoryId?: string;
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {}) {
    const {
      search,
      storeId,
      isActive,
      itemType,
      categoryId,
      status,
      page,
      limit,
      sortBy = "rawMaterialId",
      sortOrder = "asc",
    } = params;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { rawMaterialId: { contains: search, mode: "insensitive" } },
        { materialName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (storeId) {
      whereClause.storeId = storeId;
    }

    if (categoryId) {
      whereClause.categoryId = Number(categoryId);
    }

    if (status) {
      whereClause.status = status;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    if (itemType) {
      if (itemType === "RAW_MATERIAL") {
        // Include legacy records with null itemType — treat them as RAW_MATERIAL
        const typeFilter = { OR: [{ itemType: "RAW_MATERIAL" }, { itemType: null }] };
        whereClause.AND = whereClause.AND ? [...whereClause.AND, typeFilter] : [typeFilter];
      } else {
        whereClause.itemType = itemType;
      }
    }

    const queryOptions: any = {
      where: whereClause,
      include: {
        store: { include: { location: true } },
        category: true,
        storeLocation: true,
      },
      orderBy: { [sortBy]: sortOrder },
    };

    if (page !== undefined || limit !== undefined) {
      const p = page || 1;
      const l = limit || 10;
      queryOptions.skip = (p - 1) * l;
      queryOptions.take = l;
    }

    const [rawMaterials, total] = await Promise.all([
      prisma.rawMaterial.findMany(queryOptions),
      prisma.rawMaterial.count({ where: whereClause }),
    ]);

    return {
      rawMaterials,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages: limit ? Math.ceil(total / limit) : 1,
    };
  }

  async findById(rawMaterialId: string) {
    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { rawMaterialId },
      include: {
        store: true,
        category: true,
        storeLocation: true,
      },
    });

    if (!rawMaterial) {
      throw new ApiError(404, `Raw Material with ID ${rawMaterialId} not found`);
    }

    // Resolve createdBy user
    let createdUserName = "Unknown User";
    let createdUserRole = "User";
    if (rawMaterial.createdBy) {
      if (rawMaterial.createdBy.startsWith("admin_")) {
        const adminId = BigInt(rawMaterial.createdBy.replace("admin_", ""));
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
          where: { userId: rawMaterial.createdBy },
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
    if (Array.isArray((rawMaterial as any).editHistory)) {
      enrichedEditHistory = await Promise.all(
        ((rawMaterial as any).editHistory as any[]).map(async (edit: any) => {
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

    if (enrichedEditHistory.length === 0 && rawMaterial.createdAt) {
      enrichedEditHistory.push({
        updatedBy: rawMaterial.createdBy,
        updatedByName: createdUserName,
        updatedAt: rawMaterial.createdAt,
      });
    }

    return {
      ...rawMaterial,
      createdUserName,
      createdUserRole,
      editHistory: enrichedEditHistory,
    };
  }

  async update(rawMaterialId: string, data: UpdateRawMaterialInput, userId?: string) {
    const current = await this.findById(rawMaterialId);

    const { categoryId, storeId, locationId, ...restData } = data;

    let newEditHistory: any[] = [];
    if (Array.isArray((current as any).editHistory)) {
      newEditHistory = [...(current as any).editHistory].map((e: any) => {
        const { updatedByName, ...raw } = e;
        return raw;
      });
    } else if (current.createdAt) {
      newEditHistory.push({
        updatedBy: current.createdBy,
        updatedAt: current.createdAt instanceof Date ? current.createdAt.toISOString() : current.createdAt,
      });
    }

    if (userId) {
      newEditHistory.push({
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      });
    }

    const updateData: any = {
      ...restData,
      updatedBy: userId,
      editHistory: newEditHistory,
    };

    if (locationId !== undefined) {
      if (locationId === null) {
        updateData.storeLocation = { disconnect: true };
      } else {
        updateData.storeLocation = { connect: { id: locationId } };
      }
    }

    if (categoryId !== undefined) {
      if (categoryId === null) {
        updateData.category = { disconnect: true };
      } else {
        updateData.category = { connect: { id: categoryId } };
      }
    }

    if (storeId !== undefined) {
      if (storeId === null) {
        updateData.store = { disconnect: true };
      } else {
        updateData.store = { connect: { storeId: storeId } };
      }
    }

    await prisma.rawMaterial.update({
      where: { rawMaterialId },
      data: updateData,
    });

    return this.findById(rawMaterialId);
  }

  async delete(rawMaterialId: string, userId?: string) {
    await this.findById(rawMaterialId);

    const txnCount = await prisma.rawMaterialTransaction.count({
      where: { rawMaterialId },
    });

    if (txnCount > 0) {
      throw new ApiError(
        400,
        "Cannot delete this Raw Material because it has transaction history."
      );
    }

    // Hard Delete with Prisma error boundary
    return executeDeleteWithValidation(
      () => prisma.rawMaterial.delete({ where: { rawMaterialId } }),
      "Raw Material"
    );
  }
  async getNextRawMaterialId() {
    const lastItem = await prisma.rawMaterial.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!lastItem) {
      return "RM001";
    }

    const lastId = lastItem.rawMaterialId;
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

export default new RawMaterialService();
