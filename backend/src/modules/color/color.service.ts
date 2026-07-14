import { prisma } from "../../config/prisma";

import { ApiError } from "../../utils/ApiError";

import {
  CreateColorInput,
  UpdateColorInput,
} from "./color.validation";

class ColorService {
  async create(
    data: CreateColorInput
  ) {
    const existing =
      await prisma.color.findFirst({
        where: {
          OR: [
            {
              colorCode:
                data.colorCode,
            },
            {
              colorName:
                data.colorName,
            },
            {
              hexCode:
                data.hexCode,
            }
          ],
        },
      });

    if (existing) {
      throw new ApiError(
        409,
        "Color already exists"
      );
    }

    return prisma.color.create({
      data: {
        colorCode:
          data.colorCode,

        colorName:
          data.colorName,

        hexCode:
          data.hexCode,
        hexCode2:
          data.hexCode2,
        colorType:
          data.colorType,


        isActive:
          data.isActive ?? true,
      },
    });
  }

  async findAll(search?: string, isActive?: boolean) {
    return prisma.color.findMany({
      where: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(search
          ? {
            OR: [
              {
                colorCode: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                colorName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
          : {}),
      },

      orderBy: {
        id: "desc",
      },
    });
  }


  async findById(id: number) {
    const color =
      await prisma.color.findUnique({
        where: { id },
      });

    if (!color) {
      throw new ApiError(
        404,
        "Color not found"
      );
    }

    return color;
  }

  async update(
    id: number,
    data: UpdateColorInput
  ) {
    await this.findById(id);

    // CLR-006 fix: removed colorType and hexCode2 from duplicate check
    // colorType only has 2 values ("sc"/"mc") — including it causes false 409 errors.
    // Only colorCode, colorName, and hexCode (primary) should be unique.
    const orConditions: any[] = [];
    if (data.colorCode !== undefined) {
      orConditions.push({ colorCode: data.colorCode });
    }
    if (data.colorName !== undefined) {
      orConditions.push({ colorName: data.colorName });
    }
    if (data.hexCode !== undefined) {
      orConditions.push({ hexCode: data.hexCode });
    }

    if (orConditions.length > 0) {
      const existing = await prisma.color.findFirst({
        where: {
          id: { not: id },
          OR: orConditions,
        },
      });

      if (existing) {
        throw new ApiError(409, "Color already exists");
      }
    }

    return prisma.color.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    await this.findById(id);

    const productColorCount = await prisma.productColor.count({ where: { colorId: id } });
    if (productColorCount > 0) {
      throw new ApiError(400, "Cannot delete this color because it is already assigned to a product.");
    }

    return prisma.color.delete({
      where: { id },
    });
  }

  async getNextColorId() {
    const lastItem = await prisma.color.findFirst({
      orderBy: { id: "desc" },
    });

    if (!lastItem || !lastItem.colorCode) {
      return "CLR001";
    }

    const lastId = lastItem.colorCode;
    // CLR-005 fix: use last (trailing) number group
    const match = lastId.match(/\d+(?!.*\d)/);
    if (!match) {
      return lastId + "001";
    }

    const numberStr = match[0];
    const nextNumber = parseInt(numberStr, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
    const lastIndex = lastId.lastIndexOf(numberStr);
    const prefix = lastId.substring(0, lastIndex);
    const suffix = lastId.substring(lastIndex + numberStr.length);
    return `${prefix}${paddedNumber}${suffix}`;
  }
}

export default new ColorService();