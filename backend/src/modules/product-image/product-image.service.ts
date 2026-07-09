import { prisma } from "../../config/prisma";

import { ApiError } from "../../utils/ApiError";

class ProductImageService {
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

    if (data.isPrimary === true) {
      await prisma.productImage.updateMany({
        where: {
          productId: BigInt(
            data.productId
          ),
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return prisma.productImage.create({
      data: {
        productId: BigInt(
          data.productId
        ),

        imageUrl: data.imageUrl,

        isPrimary:
          data.isPrimary ?? false,
      },

      include: {
        product: true,
      },
    });
  }

  async findAll() {
    return prisma.productImage.findMany({
      include: {
        product: true,
      },

      orderBy: {
        id: "desc",
      },
    });
  }

  async findById(id: bigint) {
    const image =
      await prisma.productImage.findUnique({
        where: { id },

        include: {
          product: true,
        },
      });

    if (!image) {
      throw new ApiError(
        404,
        "Product Image not found"
      );
    }

    return image;
  }

  async update(
    id: bigint,
    data: any
  ) {
    const image =
      await this.findById(id);

    if (data.isPrimary === true) {
      await prisma.productImage.updateMany({
        where: {
          productId:
            image.productId,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return prisma.productImage.update({
      where: { id },

      data: {
        imageUrl:
          data.imageUrl ??
          undefined,

        isPrimary:
          data.isPrimary ??
          undefined,
      },

      include: {
        product: true,
      },
    });
  }

  async delete(id: bigint) {
    await this.findById(id);

    return prisma.productImage.delete({
      where: { id },
    });
  }
}

export default new ProductImageService();