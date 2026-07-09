import { prisma } from "../../config/prisma";

import { ApiError } from "../../utils/ApiError";

class ProductPricingService {
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

    const existing =
      await prisma.productColorTypePrice.findFirst({
        where: {
          productId: BigInt(
            data.productId
          ),
        } as any,
      });

    if (existing) {
      throw new ApiError(
        409,
        "Pricing already exists for this product"
      );
    }

    return prisma.productColorTypePrice.create({
      data: {
        productId: BigInt(
          data.productId
        ),

        hsnCode: data.hsnCode,

        gstRate: data.gstRate,

        cess: data.cess,

        unitPrice: data.unitPrice,

        mrp: data.mrp,

        minSalePrice:
          data.minSalePrice,

        distributorPrice:
          data.distributorPrice,

        wholesalePrice:
          data.wholesalePrice,

        directPrice:
          data.directPrice,
      } as any,

      include: {
        product: true,
      },
    });
  }

  async findAll(search: string) {
    return prisma.productColorTypePrice.findMany({
      include: {
        product: true,
      },
      where: search
        ? {
          OR: [
            {
              product: {
                productCode: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              product: {
                productName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              hsnCode: {
                contains: search,
                mode: "insensitive",
              },
            },
          ] as any,
        }
        : undefined,

      orderBy: {
        id: "desc",
      },
    });
  }

  async findById(id: bigint) {
    const pricing =
      await prisma.productColorTypePrice.findUnique({
        where: { id },

        include: {
          product: true,
        },
      });

    if (!pricing) {
      throw new ApiError(
        404,
        "Product Pricing not found"
      );
    }

    return pricing;
  }

  async update(
    id: bigint,
    data: any
  ) {
    await this.findById(id);

    return prisma.productColorTypePrice.update({
      where: { id },

      data: {
        hsnCode:
          data.hsnCode ??
          undefined,

        gstRate:
          data.gstRate ??
          undefined,

        cess:
          data.cess ??
          undefined,

        unitPrice:
          data.unitPrice ??
          undefined,

        mrp:
          data.mrp ??
          undefined,

        minSalePrice:
          data.minSalePrice ??
          undefined,

        distributorPrice:
          data.distributorPrice ??
          undefined,

        wholesalePrice:
          data.wholesalePrice ??
          undefined,

        directPrice:
          data.directPrice ??
          undefined,
      } as any,

      include: {
        product: true,
      },
    });
  }

  async delete(id: bigint) {
    await this.findById(id);

    return prisma.productColorTypePrice.delete({
      where: { id },
    });
  }
}

export default new ProductPricingService();