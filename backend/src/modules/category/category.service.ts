import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateCategoryInput, UpdateCategoryInput } from "./category.validation";

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

    return prisma.category.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        type: data.type as any,
        isActive: data.isActive ?? true,
        createdBy: userId,
      },
    });
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
      orderBy: { [sortBy]: sortOrder },
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

    return category;
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

    return prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        type: data.type as any,
        isActive: data.isActive,
        updatedBy: userId,
      },
    });
  }

  async delete(id: number) {
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

    return prisma.category.delete({ where: { id } });
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
