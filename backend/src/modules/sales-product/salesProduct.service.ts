import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { executeDeleteWithValidation } from "../../utils/deleteValidation";
import { logAudit } from "../../utils/auditLog.util";

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
  components: {
    include: {
      componentProduct: {
        include: {
          finishedGoodsStocks: true,
          uom: true,
        },
      },
    },
  },
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

  async create(data: any, userId?: string) {
    const components = Array.isArray(data.components) ? data.components : [];
    await this.validateComponents(components);

    const salesProductCode = await this.getNextSalesProductId();

    const newSalesProduct = await (prisma.salesProduct.create as any)({
      data: {
        salesProductCode,
        salesProductName: cleanString(data.salesProductName, 160)!,
        description: cleanString(data.description, 255),
        rate: toNumberOrNull(data.rate),
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        createdBy: userId,
        editHistory: userId
          ? [
              {
                updatedBy: userId,
                updatedAt: new Date().toISOString(),
              },
            ]
          : [],

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

    await logAudit("Sales Product", newSalesProduct.salesProductCode, "CREATE", userId, newSalesProduct.salesProductName);
    return newSalesProduct;
  }

  async findAll(params: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {}) {
    const {
      search,
      isActive,
      page,
      limit,
      sortBy = "salesProductName",
      sortOrder = "asc",
    } = params;
    const whereClause: Prisma.SalesProductWhereInput = {};

    if (search) {
      whereClause.OR = [
        { salesProductCode: { contains: search, mode: "insensitive" } },
        { salesProductName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    let orderBy: any = { createdAt: "desc" };
    const validSortOrder: "asc" | "desc" = sortOrder === "desc" ? "desc" : "asc";
    if (sortBy === "salesProductName" || sortBy === "name") {
      orderBy = { salesProductName: validSortOrder };
    } else if (sortBy === "salesProductCode" || sortBy === "code" || sortBy === "id") {
      orderBy = { salesProductCode: validSortOrder };
    } else if (sortBy === "rate") {
      orderBy = { rate: validSortOrder };
    } else if (sortBy === "createdAt") {
      orderBy = { createdAt: validSortOrder };
    } else if (["salesProductName", "salesProductCode", "createdAt", "updatedAt", "rate", "isActive"].includes(sortBy || "")) {
      orderBy = { [sortBy as string]: validSortOrder };
    }

    const queryOptions: any = {
      where: whereClause,
      include: includeDefaults,
      orderBy,
    };

    if (page !== undefined || limit !== undefined) {
      const p = page || 1;
      const l = limit || 15;
      queryOptions.skip = (p - 1) * l;
      queryOptions.take = l;
    }

    const [salesProducts, total] = await Promise.all([
      prisma.salesProduct.findMany(queryOptions),
      prisma.salesProduct.count({ where: whereClause }),
    ]);

    return {
      salesProducts,
      total,
      page: page || 1,
      limit: limit || total,
      totalPages: limit ? Math.ceil(total / limit) : 1,
    };
  }

  async findById(id: bigint) {
    const salesProduct = await prisma.salesProduct.findUnique({
      where: { id },
      include: includeDefaults,
    });

    if (!salesProduct) {
      throw new ApiError(404, "Sales Product not found");
    }

    // Resolve createdBy user
    let createdUserName = "Unknown User";
    let createdUserRole = "User";
    if (salesProduct.createdBy) {
      if (salesProduct.createdBy.startsWith("admin_")) {
        const adminId = BigInt(salesProduct.createdBy.replace("admin_", ""));
        const admin = await prisma.admin.findUnique({
          where: { id: adminId },
          select: { username: true, role: { select: { name: true } } },
        });
        if (admin) {
          createdUserName = admin.username;
          createdUserRole = admin.role?.name || "Super Admin";
        }
      } else {
        const user = await prisma.user.findUnique({
          where: { userId: salesProduct.createdBy },
          select: { username: true, role: { select: { name: true } } },
        });
        if (user) {
          createdUserName = user.username;
          createdUserRole = user.role?.name || "User";
        }
      }
    }

    // Resolve names for editHistory
    let enrichedEditHistory: any[] = [];
    if (Array.isArray((salesProduct as any).editHistory)) {
      enrichedEditHistory = await Promise.all(
        ((salesProduct as any).editHistory as any[]).map(async (edit: any) => {
          let name = "Unknown User";
          if (edit.updatedBy) {
            if (edit.updatedBy.startsWith("admin_")) {
              const adminId = BigInt(edit.updatedBy.replace("admin_", ""));
              const admin = await prisma.admin.findUnique({
                where: { id: adminId },
                select: { username: true },
              });
              if (admin) name = admin.username;
            } else {
              const user = await prisma.user.findUnique({
                where: { userId: edit.updatedBy },
                select: { username: true },
              });
              if (user) name = user.username;
            }
          }
          return { ...edit, updatedByName: name };
        })
      );
    }

    if (enrichedEditHistory.length === 0 && salesProduct.createdAt) {
      enrichedEditHistory.push({
        updatedBy: salesProduct.createdBy,
        updatedByName: createdUserName,
        updatedAt: salesProduct.createdAt,
      });
    }

    return {
      ...salesProduct,
      createdUserName,
      createdUserRole,
      editHistory: enrichedEditHistory,
    };
  }

  async update(id: bigint, data: any, userId?: string) {
    const current = await this.findById(id);

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

    let newEditHistory: any[] = [];
    if (Array.isArray((current as any).editHistory)) {
      newEditHistory = [...(current as any).editHistory].map((e: any) => {
        const { updatedByName, ...raw } = e;
        return raw;
      });
    } else if (current.createdAt) {
      newEditHistory.push({
        updatedBy: current.createdBy,
        updatedAt: current.createdAt instanceof Date ? current.createdAt.toISOString() : current.createdAt,
      });
    }

    if (userId) {
      newEditHistory.push({
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      });
    }

    await (prisma.salesProduct.update as any)({
      where: { id },
      data: {
        salesProductName: data.salesProductName !== undefined ? cleanString(data.salesProductName, 160)! : undefined,
        description: data.description !== undefined ? cleanString(data.description, 255) : undefined,
        rate: data.rate !== undefined ? toNumberOrNull(data.rate) : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
        modifiedBy: userId,
        editHistory: newEditHistory,
      },
    });

    const updatedSalesProduct = await this.findById(id);
    await logAudit("Sales Product", updatedSalesProduct.salesProductCode, "UPDATE", userId, updatedSalesProduct.salesProductName);
    return updatedSalesProduct;
  }

  async delete(id: bigint, userId?: string) {
    await this.findById(id);

    const deletedSalesProduct = await executeDeleteWithValidation(
      () => prisma.salesProduct.delete({ where: { id } }),
      "Sales Product"
    );

    await logAudit("Sales Product", deletedSalesProduct.salesProductCode, "DELETE", userId, deletedSalesProduct.salesProductName);
    return deletedSalesProduct;
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
