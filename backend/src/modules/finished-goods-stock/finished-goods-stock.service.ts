import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { CreateFinishedGoodsStockInput, UpdateFinishedGoodsStockInput } from "./finished-goods-stock.validation";

class FinishedGoodsStockService {
  async create(data: CreateFinishedGoodsStockInput) {
    const productItemId = BigInt(data.productItemId);

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { storeId: data.storeId },
    });
    if (!store) {
      throw new ApiError(404, `Store with ID ${data.storeId} not found`);
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productItemId },
    });
    if (!product) {
      throw new ApiError(404, `Product with ID ${productItemId.toString()} not found`);
    }

    const existing = await prisma.finishedGoodsStock.findUnique({
      where: {
        storeId_productItemId: {
          storeId: data.storeId,
          productItemId,
        },
      },
    });

    if (existing) {
      throw new ApiError(
        409,
        `Stock entry for Store ${data.storeId} and Product Item ID ${productItemId.toString()} already exists`
      );
    }

    return prisma.finishedGoodsStock.create({
      data: {
        storeId: data.storeId,
        productItemId,
        onHandQty: data.onHandQty,
      },
      include: {
        store: true,
        product: true,
      },
    });
  }

  async findAll(query?: { storeId?: string; search?: string }) {
    const whereClause: any = {};

    if (query?.storeId) {
      whereClause.storeId = query.storeId;
    }

    if (query?.search) {
      whereClause.product = {
        OR: [
          { productName: { contains: query.search, mode: 'insensitive' } },
          { productCode: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    return prisma.finishedGoodsStock.findMany({
      where: whereClause,
      include: {
        store: true,
        product: {
          include: {
            category: true,
            uom: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async findById(storeId: string, productItemId: bigint) {
    const stock = await prisma.finishedGoodsStock.findUnique({
      where: {
        storeId_productItemId: {
          storeId,
          productItemId,
        },
      },
      include: {
        store: true,
        product: {
          include: {
            category: true,
            uom: true,
          },
        },
      },
    });

    if (!stock) {
      throw new ApiError(
        404,
        `Stock entry for Store ${storeId} and Product Item ID ${productItemId.toString()} not found`
      );
    }

    return stock;
  }

  async update(storeId: string, productItemId: bigint, data: UpdateFinishedGoodsStockInput) {
    await this.findById(storeId, productItemId);

    return prisma.finishedGoodsStock.update({
      where: {
        storeId_productItemId: {
          storeId,
          productItemId,
        },
      },
      data,
      include: {
        store: true,
        product: true,
      },
    });
  }

  async delete(storeId: string, productItemId: bigint) {
    await this.findById(storeId, productItemId);

    return prisma.finishedGoodsStock.delete({
      where: {
        storeId_productItemId: {
          storeId,
          productItemId,
        },
      },
    });
  }
}

export default new FinishedGoodsStockService();
