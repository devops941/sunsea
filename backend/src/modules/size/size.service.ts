import { prisma } from "../../config/prisma";

import { ApiError } from "../../utils/ApiError";

import {
  CreateSizeInput,
  UpdateSizeInput,
} from "./size.validation";

class SizeService {
  async create(
    data: CreateSizeInput
  ) {
    const existing =
      await prisma.size.findFirst({
        where: {
          OR: [
            {
              sizeCode:
                data.sizeCode,
            },
            {
              sizeName:
                data.sizeName,
            },
          ],
        },
      });

    if (existing) {
      throw new ApiError(
        409,
        "Size already exists"
      );
    }

    return prisma.size.create({
      data: {
        sizeCode:
          data.sizeCode,

        sizeName:
          data.sizeName,

        description:
          data.description,

        isActive:
          data.isActive ?? true,
      },
    });
  }

  async findAll(search?: string, isActive?: boolean) {
    return prisma.size.findMany({
      where: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(search
          ? {
            OR: [
              {
                sizeCode: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                sizeName: {
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
    const size =
      await prisma.size.findUnique({
        where: { id },
      });

    if (!size) {
      throw new ApiError(
        404,
        "Size not found"
      );
    }

    return size;
  }

  async update(
    id: number,
    data: UpdateSizeInput
  ) {
    await this.findById(id);

    return prisma.size.update({
      where: { id },

      data: {
        sizeCode:
          data.sizeCode ??
          undefined,

        sizeName:
          data.sizeName ??
          undefined,

        description:
          data.description ??
          undefined,

        isActive:
          data.isActive ??
          undefined,
      },
    });
  }

  async delete(id: number) {
    await this.findById(id);

    const productSizeCount = await prisma.productSize.count({ where: { sizeId: id } });
    const productCount = await prisma.product.count({ where: { sizeId: id } });

    if (productSizeCount > 0 || productCount > 0) {
      throw new ApiError(400, "Cannot delete this size because it is already assigned to a product.");
    }

    return prisma.size.delete({
      where: { id },
    });
  }

  async getNextSizeId() {
    const lastItem = await prisma.size.findFirst({
      orderBy: {
        id: "desc",
      },
    });

    if (!lastItem || !lastItem.sizeCode) {
      return "SZ001";
    }

    const lastId = lastItem.sizeCode;
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

export default new SizeService();