import { prisma } from "../../config/prisma";

import { ApiError } from "../../utils/ApiError";

import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./category.validation";

class CategoryService {
  async create(
    data: CreateCategoryInput
  ) {
    const existing =
      await prisma.category.findFirst({
        where: {
          OR: [
            {
              categoryCode:
                data.categoryCode,
            },
            {
              categoryName:
                data.categoryName,
            },
          ],
        },
      });

    if (existing) {
      throw new ApiError(
        409,
        "Category already exists"
      );
    }

    return prisma.category.create({
      data,
    });
  }

  async findAll(search?: string, isActive?: boolean) {
    return prisma.category.findMany({
      orderBy: {
        id: "desc",
      },
      where: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(search
          ? {
            OR: [
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
            ],
          }
          : {}),
      },
    });
  }

  async findById(id: number) {
    const category =
      await prisma.category.findUnique({
        where: { id },
      });

    if (!category) {
      throw new ApiError(
        404,
        "Category not found"
      );
    }

    return category;
  }

  async update(
    id: number,
    data: UpdateCategoryInput
  ) {
    await this.findById(id);

    const existing =
      await prisma.category.findFirst({
        where: {
          id: {
            not: id,
          },
          OR: [
            {
              categoryCode:
                data.categoryCode,
            },
            {
              categoryName:
                data.categoryName,
            },
          ],
        },
      });

    if (existing) {
      throw new ApiError(
        409,
        "Category already exists"
      );
    }

    return prisma.category.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    await this.findById(id);

    const subCategoryCount = await prisma.subCategory.count({ where: { categoryId: id } });
    const productCount = await prisma.product.count({ where: { categoryId: id } });

    if (subCategoryCount > 0 || productCount > 0) {
      throw new ApiError(
        400,
        "Cannot delete this category because it is already assigned to a subcategory or product."
      );
    }

    return prisma.category.delete({
      where: { id },
    });
  }

  async getNextCategoryId() {
    const lastItem = await prisma.category.findFirst({
      orderBy: {
        id: "desc",
      },
    });

    if (!lastItem || !lastItem.categoryCode) {
      return "CAT001";
    }

    const lastId = lastItem.categoryCode;
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

export default new CategoryService();