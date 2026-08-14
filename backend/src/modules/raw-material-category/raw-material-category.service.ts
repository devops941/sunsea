import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateRawMaterialCategoryInput, UpdateRawMaterialCategoryInput } from "./raw-material-category.validation";

class RawMaterialCategoryService {
  async create(data: CreateRawMaterialCategoryInput, userId?: string) {
    const existingCode = await prisma.rawMaterialCategory.findUnique({
      where: { categoryCode: data.categoryCode },
    });

    if (existingCode) {
      throw new ApiError(409, `Raw Material Category with code ${data.categoryCode} already exists`);
    }

    const existingName = await prisma.rawMaterialCategory.findUnique({
      where: { categoryName: data.categoryName },
    });

    if (existingName) {
      throw new ApiError(409, `Raw Material Category with name ${data.categoryName} already exists`);
    }

    return prisma.rawMaterialCategory.create({
      data: {
        categoryCode: data.categoryCode,
        categoryName: data.categoryName,
        description: data.description || null,
        isActive: data.isActive ?? true,
        createdBy: userId,
      },
    });
  }

  async findAll(params: {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {}) {

    const {
      search,
      page,
      limit,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const where: any = {};

    if (search) {
      where.OR = [
        {
          categoryCode: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          categoryName: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const queryOptions: any = {
      where,
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

    const [rawMaterialCategories, total] = await Promise.all([
      prisma.rawMaterialCategory.findMany(queryOptions),
      prisma.rawMaterialCategory.count({
        where,
      }),
    ]);

    return {
      rawMaterialCategories,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages: limit ? Math.ceil(total / limit) : 1,
    };
  }

  async findById(id: number) {
    const category = await prisma.rawMaterialCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new ApiError(404, `Raw Material Category with ID ${id} not found`);
    }

    return category;
  }

  async update(id: number, data: UpdateRawMaterialCategoryInput, userId?: string) {
    await this.findById(id);

    if (data.categoryCode) {
      const existingCode = await prisma.rawMaterialCategory.findFirst({
        where: {
          categoryCode: data.categoryCode,
          id: { not: id },
        },
      });

      if (existingCode) {
        throw new ApiError(409, `Raw Material Category with code ${data.categoryCode} already exists`);
      }
    }

    if (data.categoryName) {
      const existingName = await prisma.rawMaterialCategory.findFirst({
        where: {
          categoryName: data.categoryName,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ApiError(409, `Raw Material Category with name ${data.categoryName} already exists`);
      }
    }

    return prisma.rawMaterialCategory.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userId,
      },
    });
  }

  async delete(id: number, userId?: string) {
    await this.findById(id);

    // Business validation: Check for dependent raw materials
    const rawMaterialCount = await prisma.rawMaterial.count({
      where: { categoryId: id },
    });

    if (rawMaterialCount > 0) {
      throw new ApiError(400, "Cannot delete category because raw materials are assigned to it.");
    }

    return prisma.rawMaterialCategory.delete({
      where: { id },
    });
  }

  async getNextCategoryCode() {
    const lastCategory = await prisma.rawMaterialCategory.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!lastCategory || !lastCategory.categoryCode) {
      return "RMC001";
    }

    const lastCode = lastCategory.categoryCode;
    const match = lastCode.match(/\d+(?!.*\d)/);
    if (!match) {
      return lastCode + "001";
    }

    const numberStr = match[0];
    const nextNumber = parseInt(numberStr, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
    const lastIndex = lastCode.lastIndexOf(numberStr);
    const prefix = lastCode.substring(0, lastIndex);
    const suffix = lastCode.substring(lastIndex + numberStr.length);
    return `${prefix}${paddedNumber}${suffix}`;
  }
}

export default new RawMaterialCategoryService();
