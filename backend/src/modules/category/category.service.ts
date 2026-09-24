import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateCategoryInput, UpdateCategoryInput } from "./category.validation";
import { logAudit } from "../../utils/auditLog.util";

class CategoryService {
  async create(data: CreateCategoryInput, userId?: string) {
    const existing = await prisma.category.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ApiError(409, `Category with code "${data.code}" already exists`);
    }

    const existingName = await prisma.category.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        type: data.type as any,
      },
    });

    if (existingName) {
      throw new ApiError(
        409,
        `Category name "${data.name}" already exists for this type. Use a unique name.`
      );
    }

    const newCategory = await prisma.category.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        type: data.type as any,
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
      } as any,
    });

    await logAudit("Category", newCategory.code, "CREATE", userId, newCategory.name);

    return newCategory;
  }

  async findAll(params: {
    search?: string;
    type?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {}) {
    const {
      search,
      type,
      isActive,
      page,
      limit,
      sortBy = "createdAt",
      sortOrder = "asc",
    } = params;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (type) {
      whereClause.type = type;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    let orderBy: any = { createdAt: "desc" };
    const validSortOrder: "asc" | "desc" = sortOrder === "desc" ? "desc" : "asc";
    if (sortBy === "name" || sortBy === "categoryName") {
      orderBy = { name: validSortOrder };
    } else if (sortBy === "code" || sortBy === "categoryCode") {
      orderBy = { code: validSortOrder };
    } else if (["createdAt", "updatedAt", "type", "isActive"].includes(sortBy || "")) {
      orderBy = { [sortBy as string]: validSortOrder };
    }

    const queryOptions: any = {
      where: whereClause,
      include: {
        _count: {
          select: {
            rawMaterials: true,
            products: true,
          },
        },
      },
      orderBy,
    };

    if (page !== undefined || limit !== undefined) {
      const p = page || 1;
      const l = limit || 10;
      queryOptions.skip = (p - 1) * l;
      queryOptions.take = l;
    }

    const [categories, total] = await Promise.all([
      prisma.category.findMany(queryOptions),
      prisma.category.count({ where: whereClause }),
    ]);

    return {
      categories,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages: limit ? Math.ceil(total / limit) : 1,
    };
  }

  async findById(id: number) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            rawMaterials: true,
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new ApiError(404, `Category with ID ${id} not found`);
    }

    // Resolve createdBy user (matches customer.service.ts logic)
    let createdUserName = "Unknown User";
    let createdUserRole = "User";
    if (category.createdBy) {
      if (category.createdBy.startsWith("admin_")) {
        const adminId = BigInt(category.createdBy.replace("admin_", ""));
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
          where: { userId: category.createdBy },
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
    if (Array.isArray((category as any).editHistory)) {
      enrichedEditHistory = await Promise.all(
        ((category as any).editHistory as any[]).map(async (edit: any) => {
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

    if (enrichedEditHistory.length === 0 && category.createdAt) {
      enrichedEditHistory.push({
        updatedBy: category.createdBy,
        updatedByName: createdUserName,
        updatedAt: category.createdAt,
      });
    }

    return {
      ...category,
      createdUserName,
      createdUserRole,
      editHistory: enrichedEditHistory,
    };
  }

  async update(id: number, data: UpdateCategoryInput, userId?: string) {
    const current = await this.findById(id);
    const typeToCheck = (data.type ?? current.type) as string;

    if (data.name) {
      const existing = await prisma.category.findFirst({
        where: {
          name: { equals: data.name, mode: "insensitive" },
          type: typeToCheck as any,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ApiError(
          409,
          `Category name "${data.name}" already exists for this type. Use a unique name.`
        );
      }
    }

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

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        type: data.type as any,
        isActive: data.isActive,
        updatedBy: userId,
        editHistory: newEditHistory as any,
      } as any,
      include: {
        _count: {
          select: {
            rawMaterials: true,
            products: true,
          },
        },
      },
    });

    await logAudit("Category", updatedCategory.code, "UPDATE", userId, updatedCategory.name);

    return this.findById(id);
  }

  async delete(id: number, userId?: string) {
    const category = await this.findById(id);

    const rawMaterialCount = await prisma.rawMaterial.count({
      where: { categoryId: id },
    });

    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (rawMaterialCount > 0 || productCount > 0) {
      throw new ApiError(
        400,
        `Cannot delete this category because it is assigned to ${rawMaterialCount} raw material(s) and ${productCount} product(s).`
      );
    }

    const deletedCategory = await prisma.category.delete({ where: { id } });

    await logAudit("Category", deletedCategory.code, "DELETE", userId, deletedCategory.name);

    return deletedCategory;
  }

  async getNextCode(type: string) {
    const prefix = type === "PRODUCT" ? "PC" : type === "RAW_MATERIAL" ? "RC" : "WC";

    const last = await prisma.category.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { createdAt: "desc" },
    });

    if (!last) {
      return `${prefix}001`;
    }

    const match = last.code.match(/\d+$/);
    if (!match) return `${prefix}001`;

    const next = parseInt(match[0], 10) + 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  }
}

export default new CategoryService();
