import { prisma } from "../../config/prisma";

import { ApiError } from "../../utils/ApiError";

class ProductColorService {
  async create(data: any) {
    const product =
      await prisma.product.findUnique({
        where: {
          id: BigInt(data.productId),
        },
      });

    if (!product) {
      throw new ApiError(
        404,
        "Product not found"
      );
    }

    const color =
      await prisma.color.findUnique({
        where: {
          id: Number(data.colorId),
        },
      });

    if (!color) {
      throw new ApiError(
        404,
        "Color not found"
      );
    }

    const existing =
      await prisma.productColor.findFirst({
        where: {
          productId: BigInt(
            data.productId
          ),
          colorId: Number(
            data.colorId
          ),
        },
      });

    if (existing) {
      throw new ApiError(
        409,
        "Color already assigned to product"
      );
    }

    if (data.isDefault === true) {
      await prisma.productColor.updateMany({
        where: {
          productId: BigInt(
            data.productId
          ),
        },
        data: {
          isDefault: false,
        },
      });
    }

    return prisma.productColor.create({
      data: {
        productId: BigInt(
          data.productId
        ),
        colorId: Number(
          data.colorId
        ),
        isDefault:
          data.isDefault ?? false,
      },

      include: {
        product: true,
        color: true,
      },
    });
  }

  async findAll() {
    return prisma.productColor.findMany({
      include: {
        product: true,
        color: true,
      },

      orderBy: {
        id: "desc",
      },
    });
  }

  async findById(id: bigint) {
    const productColor =
      await prisma.productColor.findUnique({
        where: { id },

        include: {
          product: true,
          color: true,
        },
      });

    if (!productColor) {
      throw new ApiError(
        404,
        "Product Color not found"
      );
    }

    return productColor;
  }

  async update(
    id: bigint,
    data: any
  ) {
    const productColor =
      await this.findById(id);

    if (data.isDefault === true) {
      await prisma.productColor.updateMany({
        where: {
          productId:
            productColor.productId,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return prisma.productColor.update({
      where: { id },

      data: {
        isDefault:
          data.isDefault,
      },

      include: {
        product: true,
        color: true,
      },
    });
  }

  async delete(id: bigint) {
    await this.findById(id);

    return prisma.productColor.delete({
      where: { id },
    });
  }
}

export default new ProductColorService();