import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

class BillOfMaterialService {
  private mapToGroupedBom(boms: any[]) {
    if (!boms || boms.length === 0) return null;
    return {
      id: Number(boms[0].productId),
      productId: Number(boms[0].productId),
      product: boms[0].product,
      remarks: boms[0].remarks,
      createdAt: boms[0].createdAt,
      updatedAt: boms[0].updatedAt,
      items: boms.map((b) => ({
        id: b.id,
        rawMaterialId: b.rawMaterialId,
        rawMaterial: b.rawMaterial,
        requiredQuantity: b.requiredQuantity,
        uom: b.uom,
        remarks: b.remarks,
      })),
    };
  }

  async create(data: any) {
    const product = await prisma.product.findUnique({
      where: {
        id: BigInt(data.productId),
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    const existing = await prisma.billOfMaterial.findFirst({
      where: {
        productId: BigInt(data.productId),
      },
    });

    if (existing) {
      throw new ApiError(
        400,
        "Bill Of Material already exists for this product"
      );
    }

    for (const item of data.items) {
      const rawMaterial = await prisma.rawMaterial.findUnique({
        where: {
          rawMaterialId: item.rawMaterialId,
        },
      });

      if (!rawMaterial) {
        throw new ApiError(
          404,
          `Raw Material ${item.rawMaterialId} not found`
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      await tx.billOfMaterial.createMany({
        data: data.items.map((item: any) => ({
          productId: BigInt(data.productId),
          rawMaterialId: item.rawMaterialId,
          requiredQuantity: item.requiredQuantity,
          uom: item.uom,
          remarks: data.remarks || null,
        })),
      });

      const boms = await tx.billOfMaterial.findMany({
        where: {
          productId: BigInt(data.productId),
        },
        include: {
          product: true,
          rawMaterial: true,
        },
      });

      return this.mapToGroupedBom(boms);
    });
  }

  async findAll(search?: string) {
    const whereClause: any = search
      ? {
          product: {
            OR: [
              { productName: { contains: search, mode: "insensitive" } },
              { productCode: { contains: search, mode: "insensitive" } },
            ],
          },
        }
      : {};

    const boms = await prisma.billOfMaterial.findMany({
      where: whereClause,
      include: {
        product: true,
        rawMaterial: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const grouped = boms.reduce((acc: any, bom) => {
      const pId = bom.productId.toString();
      if (!acc[pId]) {
        acc[pId] = {
          id: Number(bom.productId),
          productId: Number(bom.productId),
          product: bom.product,
          remarks: bom.remarks,
          createdAt: bom.createdAt,
          updatedAt: bom.updatedAt,
          items: [],
        };
      }
      acc[pId].items.push({
        id: bom.id,
        rawMaterialId: bom.rawMaterialId,
        rawMaterial: bom.rawMaterial,
        requiredQuantity: bom.requiredQuantity,
        uom: bom.uom,
        remarks: bom.remarks,
      });
      return acc;
    }, {});

    return Object.values(grouped);
  }

  async findById(productId: number) {
    const boms = await prisma.billOfMaterial.findMany({
      where: {
        productId: BigInt(productId),
      },
      include: {
        product: true,
        rawMaterial: true,
      },
    });

    if (!boms || boms.length === 0) {
      throw new ApiError(
        404,
        "Bill Of Material not found"
      );
    }

    return this.mapToGroupedBom(boms);
  }

  async update(productId: number, data: any) {
    await this.findById(productId);

    return prisma.$transaction(async (tx) => {
      await tx.billOfMaterial.deleteMany({
        where: {
          productId: BigInt(productId),
        },
      });

      if (data.items && data.items.length > 0) {
        await tx.billOfMaterial.createMany({
          data: data.items.map((item: any) => ({
            productId: BigInt(productId),
            rawMaterialId: item.rawMaterialId,
            requiredQuantity: item.requiredQuantity,
            uom: item.uom,
            remarks: data.remarks || null,
          })),
        });
      }

      const boms = await tx.billOfMaterial.findMany({
        where: {
          productId: BigInt(productId),
        },
        include: {
          product: true,
          rawMaterial: true,
        },
      });

      return this.mapToGroupedBom(boms);
    });
  }
  
  async delete(productId: number) {
    await this.findById(productId);

    return prisma.billOfMaterial.deleteMany({
      where: {
        productId: BigInt(productId),
      },
    });
  }

  async getNextBillOfMaterialId() {
    const grouped = await prisma.billOfMaterial.groupBy({
      by: ["productId"],
    });

    return `BOM${String(grouped.length + 1).padStart(3, "0")}`;
  }
}

export default new BillOfMaterialService();
