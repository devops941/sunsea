import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { executeDeleteWithValidation } from "../../utils/deleteValidation";

function toNumberOrNull(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  return Number(value);
}

function cleanString(value: any, maxLength?: number): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return maxLength ? text.slice(0, maxLength) : text;
}

const includeDefaults = {
  components: { include: { componentProduct: true } },
  stocks: true,
};

class SalesProductService {
  private async validateComponents(items: any[]) {
    for (const item of items) {
      const componentProduct = await prisma.product.findUnique({
        where: { id: BigInt(item.componentProductId) },
      });
      if (!componentProduct) {
        throw new ApiError(404, `Component Product ${item.componentProductId} not found`);
      }
    }
  }

  async create(data: any) {
    const components = Array.isArray(data.components) ? data.components : [];
    await this.validateComponents(components);

    const salesProductCode = await this.getNextSalesProductId();

    return prisma.salesProduct.create({
      data: {
        salesProductCode,
        salesProductName: cleanString(data.salesProductName, 160)!,
        description: cleanString(data.description, 255),
        hsnCode: cleanString(data.hsnCode, 20),
        rate: toNumberOrNull(data.rate),
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,

        components: {
          create: components.map((c: any) => ({
            componentProductId: BigInt(c.componentProductId),
            quantity: new Prisma.Decimal(c.quantity),
            remarks: cleanString(c.remarks, 255),
          })),
        },

        ...(data.openingStockQty !== undefined && data.openingStockStoreId
          ? {
              stocks: {
                create: [
                  {
                    storeId: String(data.openingStockStoreId),
                    onHandQty: Number(data.openingStockQty),
                  },
                ],
              },
            }
          : {}),
      },
      include: includeDefaults,
    });
  }

  async findAll(params: { search?: string } = {}) {
    const { search } = params;
    const whereClause: Prisma.SalesProductWhereInput = {};

    if (search) {
      whereClause.OR = [
        { salesProductCode: { contains: search, mode: "insensitive" } },
        { salesProductName: { contains: search, mode: "insensitive" } },
      ];
    }

    return prisma.salesProduct.findMany({
      where: whereClause,
      include: includeDefaults,
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: bigint) {
    const salesProduct = await prisma.salesProduct.findUnique({
      where: { id },
      include: includeDefaults,
    });

    if (!salesProduct) {
      throw new ApiError(404, "Sales Product not found");
    }

    return salesProduct;
  }

  async update(id: bigint, data: any) {
    await this.findById(id);

    let components: any[] | null = null;
    if (data.components !== undefined) {
      const list = Array.isArray(data.components) ? data.components : [];
      await this.validateComponents(list);
      components = list;
    }

    await prisma.$transaction(async (tx) => {
      if (components !== null) {
        await tx.salesProductComponent.deleteMany({ where: { salesProductId: id } });
        if (components.length > 0) {
          await tx.salesProductComponent.createMany({
            data: components.map((c: any) => ({
              salesProductId: id,
              componentProductId: BigInt(c.componentProductId),
              quantity: new Prisma.Decimal(c.quantity),
              remarks: cleanString(c.remarks, 255),
            })),
          });
        }
      }

      if (data.openingStockQty !== undefined && data.openingStockStoreId) {
        await tx.salesProductStock.upsert({
          where: {
            storeId_salesProductId: {
              storeId: String(data.openingStockStoreId),
              salesProductId: id,
            },
          },
          update: { onHandQty: Number(data.openingStockQty) },
          create: {
            storeId: String(data.openingStockStoreId),
            salesProductId: id,
            onHandQty: Number(data.openingStockQty),
          },
        });
      }
    });

    return prisma.salesProduct.update({
      where: { id },
      data: {
        salesProductName: data.salesProductName !== undefined ? cleanString(data.salesProductName, 160)! : undefined,
        description: data.description !== undefined ? cleanString(data.description, 255) : undefined,
        hsnCode: data.hsnCode !== undefined ? cleanString(data.hsnCode, 20) : undefined,
        rate: data.rate !== undefined ? toNumberOrNull(data.rate) : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
      },
      include: includeDefaults,
    });
  }

  async delete(id: bigint) {
    await this.findById(id);

    return executeDeleteWithValidation(
      () => prisma.salesProduct.delete({ where: { id } }),
      "Sales Product"
    );
  }

  async getNextSalesProductId() {
    const lastItem = await prisma.salesProduct.findFirst({
      orderBy: { id: "desc" },
    });

    if (!lastItem || !lastItem.salesProductCode) {
      return "SP001";
    }

    const lastId = lastItem.salesProductCode;
    const match = lastId.match(/\d+$/);
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

export default new SalesProductService();
