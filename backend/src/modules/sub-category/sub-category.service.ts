import { prisma } from "../../config/prisma";

import { ApiError } from "../../utils/ApiError";

import {
  CreateSubCategoryInput,
  UpdateSubCategoryInput,
} from "./sub-category.validation";

class SubCategoryService {
  async create(
    data: CreateSubCategoryInput
  ) {
    const category =
      await prisma.category.findUnique({
        where: {
          id: Number(
            data.categoryId
          ),
        },
      });

    if (!category) {
      throw new ApiError(
        404,
        "Category not found"
      );
    }

    const existing =
      await prisma.subCategory.findFirst({
        where: {
          OR: [
            {
              subCategoryCode:
                data.subCategoryCode,
            },
            {
              subCategoryName:
                data.subCategoryName,
            },
          ],
        },
      });

    if (existing) {
      throw new ApiError(
        409,
        "Sub Category already exists"
      );
    }

    return prisma.subCategory.create({
      data: {
        subCategoryCode:
          data.subCategoryCode,

        subCategoryName:
          data.subCategoryName,

        description:
          data.description,

        categoryId: Number(
          data.categoryId
        ),

        isActive:
          data.isActive ?? true,
      },

      include: {
        category: true,
      },
    });
  }

  /**
   * @param search free-text match against code/name/parent category name
   * @param categoryId when provided, restricts results to that category only
   *   — this is the filter the product-create/edit dropdowns need, and is
   *   independent of (and combinable with) the text search.
   */
  async findAll(search?: string, categoryId?: number, isActive?: boolean) {
    const conditions: any[] = [];

    if (categoryId !== undefined) {
      conditions.push({ categoryId });
    }
    if (isActive !== undefined) {
      conditions.push({ isActive });
    }

    if (search) {
      conditions.push({
        OR: [
          {
            subCategoryCode: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            subCategoryName: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            category: {
              categoryName: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        ],
      });
    }

    return prisma.subCategory.findMany({
      include: {
        category: true,
      },

      where: conditions.length > 0 ? { AND: conditions } : undefined,

      orderBy: {
        id: "desc",
      },
    });
  }

  async findById(id: number) {
    const subCategory =
      await prisma.subCategory.findUnique({
        where: { id },

        include: {
          category: true,
        },
      });

    if (!subCategory) {
      throw new ApiError(
        404,
        "Sub Category not found"
      );
    }

    return subCategory;
  }

  async update(
    id: number,
    data: UpdateSubCategoryInput
  ) {
    await this.findById(id);

    if (data.categoryId) {
      const category =
        await prisma.category.findUnique({
          where: {
            id: Number(
              data.categoryId
            ),
          },
        });

      if (!category) {
        throw new ApiError(
          404,
          "Category not found"
        );
      }
    }

    return prisma.subCategory.update({
      where: { id },

      data: {
        subCategoryCode:
          data.subCategoryCode ??
          undefined,

        subCategoryName:
          data.subCategoryName ??
          undefined,

        description:
          data.description ??
          undefined,

        categoryId:
          data.categoryId
            ? Number(
              data.categoryId
            )
            : undefined,

        isActive:
          data.isActive ??
          undefined,
      },

      include: {
        category: true,
      },
    });
  }

  async delete(id: number) {
    await this.findById(id);

    const productCount = await prisma.product.count({ where: { subCategoryId: id } });

    if (productCount > 0) {
      throw new ApiError(
        400,
        "Cannot delete this subcategory because it is already assigned to a product."
      );
    }

    return prisma.subCategory.delete({
      where: { id },
    });
  }

  async getNextSubCategoryId() {
    const lastItem = await prisma.subCategory.findFirst({
      orderBy: {
        id: "desc",
      },
    });

    if (!lastItem || !lastItem.subCategoryCode) {
      return "SUB001";
    }

    const lastId = lastItem.subCategoryCode;
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

export default new SubCategoryService();