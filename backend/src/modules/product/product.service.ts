import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { executeDeleteWithValidation } from "../../utils/deleteValidation";
import { uploadToImageKit } from "../../utils/Imagekit";
import fs from "fs";
import path from "path";

function toNumberOrNull(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  return Number(value);
}

function toBoolean(value: any, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === true;
}

function cleanString(value: any, maxLength?: number): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return maxLength ? text.slice(0, maxLength) : text;
}

function cleanRequiredString(value: any, maxLength?: number): string {
  const text = String(value ?? "").trim();
  return maxLength ? text.slice(0, maxLength) : text;
}

function toIdArray(value: any): number[] {
  if (value === undefined || value === null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
}

class ProductService {
  // Every Production Product's stock (FinishedGoodsStock.onHandQty) is a
  // plain piece count, never a weight — so the product's stock-counting UOM
  // is always "pcs", regardless of weightPerPiece (which is separate,
  // descriptive-only data). This keeps "Physical Stock" showing e.g.
  // "3000 PCS" instead of echoing whatever weight unit weightPerPiece used.
  private async resolvePcsUomId(): Promise<number> {
    const uomCode = "pcs";
    let existingUom = await prisma.unitOfMeasure.findUnique({ where: { uomCode } });

    if (!existingUom) {
      existingUom = await prisma.unitOfMeasure.create({
        data: { uomCode, uomName: "Pieces" },
      });
    }

    return existingUom.id;
  }

  async create(data: any, files?: Express.Multer.File[]) {
    const uploadedImages: any[] = [];
    if (files && files.length > 0) {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const uniqueName = `product_${Date.now()}_${index}${path.extname(file.originalname)}`;
        try {
          const fileData = file.buffer || file.path;
          const imageUrl = await uploadToImageKit(fileData, uniqueName, "/products");
          uploadedImages.push({
            imageUrl,
            isPrimary: index === 0,
          });

          // Clean up the local temp file after upload (only if diskStorage was used)
          if (file.path) {
            try {
              fs.unlinkSync(file.path);
            } catch (err) {
              console.error("Failed to delete temp file:", file.path, err);
            }
          }
        } catch (err) {
          console.error("Failed to upload product image to ImageKit:", err);
          throw err;
        }
      }
    }

    const payload: Prisma.ProductUncheckedCreateInput = {
      productCode: cleanRequiredString(data.productCode, 20),
      productName: cleanRequiredString(data.productName, 160),
      description: cleanString(data.description, 255),
      productType: data.productType === "SALES_PRODUCTION" ? "SALES_PRODUCTION" : "PRODUCTION",

      categoryId: Number(data.categoryId),
      uomId: await this.resolvePcsUomId(),

      capacityLitres: toNumberOrNull(data.capacityLitres),
      weightPerPiece: toNumberOrNull(data.weightPerPiece),
      weightUom: cleanString(data.weightUom, 10) || "kg",
      isActive: toBoolean(data.isActive, true),

      hsnCode: cleanString(data.hsnCode, 20),
      minimumQty: data.minimumQty || "0",
      maximumQty: data.maximumQty || "0",
      rate: toNumberOrNull(data.rate),

      ...(uploadedImages.length
        ? {
          images: {
            create: uploadedImages,
          },
        }
        : {}),
    };

    let rawMaterialsList: any[] = [];
    if (data.rawMaterials) {
      try {
        rawMaterialsList = typeof data.rawMaterials === "string"
          ? JSON.parse(data.rawMaterials)
          : data.rawMaterials;

        const percentageItems = rawMaterialsList.filter(rm => rm.percentage !== null && rm.percentage !== undefined && String(rm.percentage).trim() !== "");
        const totalPercent = percentageItems.reduce((acc, curr) => acc + Number(curr.percentage), 0);
        if (percentageItems.length > 0 && totalPercent !== 100) {
          throw new ApiError(400, "Total Raw Material percentage must be exactly 100%");
        }

        const rmIds = rawMaterialsList.map(rm => String(rm.rawMaterialId));
        if (new Set(rmIds).size !== rmIds.length) {
          throw new ApiError(400, "Duplicate raw materials are not allowed");
        }
      } catch (e: any) {
        if (e instanceof ApiError) throw e;
        console.error("Failed to parse rawMaterials in create:", e);
      }
    }

    let capacityHistoryList: any[] = [];
    if (data.capacityHistory) {
      try {
        capacityHistoryList = typeof data.capacityHistory === "string"
          ? JSON.parse(data.capacityHistory)
          : data.capacityHistory;
      } catch (e: any) {
        console.error("Failed to parse capacityHistory in create:", e);
      }
    }

    try {
      return await prisma.product.create({
        data: {
          ...payload,
          ...(data.openingStockQty && data.openingStockStoreId
            ? {
              finishedGoodsStocks: {
                create: [
                  {
                    storeId: cleanRequiredString(data.openingStockStoreId, 20),
                    onHandQty: Number(data.openingStockQty),
                  },
                ],
              },
              finishedGoodsTransactions: {
                create: [
                  {
                    txnDateTime: new Date(),
                    storeId: cleanRequiredString(data.openingStockStoreId, 20),
                    txnType: "OPENING_STOCK",
                    qty: Number(data.openingStockQty),
                    remarks: "Opening Stock during product creation",
                  },
                ],
              },
            }
            : {}),
          ...(rawMaterialsList.length > 0 && {
            billOfMaterials: {
              create: rawMaterialsList.map((rm: any) => ({
                rawMaterialId: cleanRequiredString(rm.rawMaterialId, 20),
                requiredQuantity: new Prisma.Decimal(rm.requiredQuantity || 0),
                percentage: toNumberOrNull(rm.percentage),
              })),
            },
          }),
          ...(capacityHistoryList.length > 0 && {
            capacityHistories: {
              create: capacityHistoryList.map((entry: any) => ({
                newCapacity: Number(entry.newCapacity),
                previousCapacity: Number(entry.previousCapacity ?? 0),
                productionDate: new Date(entry.recordedAt ?? new Date()),
                machineId: cleanRequiredString(entry.machineId || "INITIAL", 20),
                shiftId: cleanRequiredString(entry.shiftId || "INITIAL", 20),
                productionOrderId: cleanRequiredString("INITIAL", 20),
                targetQty: Number(entry.newCapacity),
                actualQty: Number(entry.newCapacity),
                achievementPct: 100,
                operators: cleanString(entry.operatorName, 255),
              })),
            },
          }),
        },

        include: {
          category: true,
          uom: true,
          images: true,
          finishedGoodsStocks: { include: { store: true } },
          billOfMaterials: { include: { rawMaterial: true } },
        },
      });
    } catch (err: any) {
      console.error("Product create failed. Payload keys:", Object.keys(payload));
      console.error("Prisma error:", err.message);
      if (err.message?.includes("too long")) {
        throw new ApiError(400, "One of the field values is too long. Please shorten your input and try again.");
      }
      throw err;
    }
  }

  async findAll(params: { search?: string; categoryId?: string } = {}) {
    const { search, categoryId } = params;
    const whereClause: Prisma.ProductWhereInput = {};

    if (search) {
      whereClause.OR = [
        { productCode: { contains: search, mode: "insensitive" as const } },
        { productName: { contains: search, mode: "insensitive" as const } },
      ];
    }

    if (categoryId) {
      whereClause.categoryId = Number(categoryId);
    }

    return prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        uom: true,
        images: true,
        finishedGoodsStocks: { include: { store: true } },
        billOfMaterials: { include: { rawMaterial: true } },
        capacityHistories: { orderBy: { createdAt: "desc" } },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findById(id: bigint) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        uom: true,
        images: true,
        finishedGoodsStocks: { include: { store: true } },
        billOfMaterials: { include: { rawMaterial: true } },
        capacityHistories: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    return product;
  }

  async update(id: bigint, data: any, files?: Express.Multer.File[]) {
    await this.findById(id);

    let isStockChanged = false;
    let qtyDiff = 0;
    if (data.openingStockQty && data.openingStockStoreId) {
      const existingStock = await prisma.finishedGoodsStock.findUnique({
        where: {
          storeId_productItemId: {
            storeId: String(data.openingStockStoreId),
            productItemId: id,
          },
        },
      });
      const newQty = Number(data.openingStockQty);
      const oldQty = existingStock ? Number(existingStock.onHandQty) : 0;
      if (newQty !== oldQty) {
        isStockChanged = true;
        qtyDiff = newQty - oldQty;
      }
    }

    const removedImageIds = toIdArray(data.removedImageIds);
    const primaryImageId =
      data.primaryImageId !== undefined
        ? Number(data.primaryImageId)
        : undefined;

    let rawMaterialsList: any[] | null = null;
    if (data.rawMaterials !== undefined) {
      try {
        rawMaterialsList = typeof data.rawMaterials === "string"
          ? JSON.parse(data.rawMaterials)
          : data.rawMaterials;

        if (rawMaterialsList && rawMaterialsList.length > 0) {
          const percentageItems = rawMaterialsList.filter(rm => rm.percentage !== null && rm.percentage !== undefined && String(rm.percentage).trim() !== "");
          const totalPercent = percentageItems.reduce((acc, curr) => acc + Number(curr.percentage), 0);
          if (percentageItems.length > 0 && totalPercent !== 100) {
            throw new ApiError(400, "Total Raw Material percentage must be exactly 100%");
          }

          const rmIds = rawMaterialsList.map(rm => String(rm.rawMaterialId));
          if (new Set(rmIds).size !== rmIds.length) {
            throw new ApiError(400, "Duplicate raw materials are not allowed");
          }
        }
      } catch (e: any) {
        if (e instanceof ApiError) throw e;
        console.error("Failed to parse rawMaterials in update:", e);
      }
    }

    let capacityHistoryList: any[] | null = null;
    if (data.capacityHistory !== undefined) {
      try {
        capacityHistoryList = typeof data.capacityHistory === "string"
          ? JSON.parse(data.capacityHistory)
          : data.capacityHistory;
      } catch (e: any) {
        console.error("Failed to parse capacityHistory in update:", e);
      }
    }

    const uploadedImages: any[] = [];
    if (files && files.length > 0) {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const uniqueName = `product_${Date.now()}_${index}${path.extname(file.originalname)}`;
        try {
          const fileData = file.buffer || file.path;
          const imageUrl = await uploadToImageKit(fileData, uniqueName, "/products");
          uploadedImages.push({
            productId: id,
            imageUrl,
            isPrimary: false,
          });

          // Clean up the local temp file after upload (only if diskStorage was used)
          if (file.path) {
            try {
              fs.unlinkSync(file.path);
            } catch (err) {
              console.error("Failed to delete temp file:", file.path, err);
            }
          }
        } catch (err) {
          console.error("Failed to upload product image to ImageKit:", err);
          throw err;
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // --- Image handling (unchanged) ---
      if (removedImageIds.length) {
        await tx.productImage.deleteMany({
          where: { id: { in: removedImageIds }, productId: id },
        });
      }

      if (uploadedImages.length) {
        await tx.productImage.createMany({
          data: uploadedImages,
        });
      }

      if (removedImageIds.length || uploadedImages.length) {
        await tx.productImage.updateMany({
          where: { productId: id },
          data: { isPrimary: false },
        });

        const remaining = await tx.productImage.findMany({
          where: { productId: id },
          orderBy: { id: "asc" },
        });

        if (remaining.length) {
          const requestedStillExists =
            primaryImageId !== undefined &&
            remaining.some((img) => img.id === BigInt(primaryImageId));

          const newPrimary = requestedStillExists
            ? remaining.find((img) => img.id === BigInt(primaryImageId))!
            : uploadedImages.length
              ? remaining[remaining.length - uploadedImages.length]
              : remaining[0];

          await tx.productImage.update({
            where: { id: newPrimary.id },
            data: { isPrimary: true },
          });
        }
      }

      if (rawMaterialsList !== null) {
        await tx.billOfMaterial.deleteMany({ where: { productId: id } });
        if (rawMaterialsList.length > 0) {
          await tx.billOfMaterial.createMany({
            data: rawMaterialsList.map((rm: any) => ({
              productId: id,
              rawMaterialId: String(rm.rawMaterialId),
              requiredQuantity: new Prisma.Decimal(rm.requiredQuantity || 0),
              percentage: toNumberOrNull(rm.percentage)
            }))
          });
        }
      }

      if (capacityHistoryList !== null && capacityHistoryList.length > 0) {
        for (const entry of capacityHistoryList) {
          const machineId = cleanRequiredString(entry.machineId || "INITIAL", 20);

          await tx.productCapacityHistory.create({
            data: {
              productId: id,
              newCapacity: Number(entry.newCapacity),
              previousCapacity: Number(entry.previousCapacity ?? 0),
              productionDate: new Date(entry.recordedAt ?? new Date()),
              machineId: machineId,
              shiftId: cleanRequiredString(entry.shiftId || "INITIAL", 20),
              productionOrderId: cleanRequiredString("UPDATE", 20),
              targetQty: Number(entry.newCapacity),
              actualQty: Number(entry.newCapacity),
              achievementPct: 100,
              operators: cleanString(entry.operatorName, 255),
            }
          });

          const existing = await tx.productCapacityHistory.findMany({
            where: { productId: id, machineId: machineId },
            orderBy: { createdAt: "desc" },
            select: { id: true }
          });

          if (existing.length > 2) {
            const idsToDelete = existing.slice(2).map(r => r.id);
            await tx.productCapacityHistory.deleteMany({
              where: { id: { in: idsToDelete } }
            });
          }
        }
      }
    });

    const payload: Prisma.ProductUncheckedUpdateInput = {
      productCode: data.productCode !== undefined ? cleanRequiredString(data.productCode, 20) : undefined,
      productName: data.productName !== undefined ? cleanRequiredString(data.productName, 160) : undefined,
      description: data.description !== undefined ? cleanString(data.description, 255) : undefined,
      productType: data.productType !== undefined ? (data.productType === "SALES_PRODUCTION" ? "SALES_PRODUCTION" : "PRODUCTION") : undefined,

      categoryId: data.categoryId ? Number(data.categoryId) : undefined,

      capacityLitres: data.capacityLitres !== undefined ? toNumberOrNull(data.capacityLitres) : undefined,
      weightPerPiece: data.weightPerPiece !== undefined ? toNumberOrNull(data.weightPerPiece) : undefined,
      weightUom: data.weightUom !== undefined ? (cleanString(data.weightUom, 10) || "kg") : undefined,
      minimumQty: data.minimumQty !== undefined ? data.minimumQty : undefined,
      maximumQty: data.maximumQty !== undefined ? data.maximumQty : undefined,
      isActive: data.isActive !== undefined ? toBoolean(data.isActive, true) : undefined,

      hsnCode: data.hsnCode !== undefined ? cleanString(data.hsnCode, 20) : undefined,
      rate: data.rate !== undefined ? toNumberOrNull(data.rate) : undefined,

      ...(data.openingStockQty && data.openingStockStoreId
        ? {
          finishedGoodsStocks: {
            upsert: [
              {
                where: {
                  storeId_productItemId: {
                    storeId: String(data.openingStockStoreId),
                    productItemId: id,
                  },
                },
                update: { onHandQty: Number(data.openingStockQty) },
                create: {
                  storeId: String(data.openingStockStoreId),
                  onHandQty: Number(data.openingStockQty),
                },
              },
            ],
          },
          ...(isStockChanged
            ? {
              finishedGoodsTransactions: {
                create: [
                  {
                    txnDateTime: new Date(),
                    storeId: String(data.openingStockStoreId),
                    txnType: qtyDiff > 0 ? "STOCK_ADJUSTMENT_IN" : "STOCK_ADJUSTMENT_OUT",
                    qty: Math.abs(qtyDiff),
                    remarks: `Opening Stock updated (Difference: ${qtyDiff})`,
                  },
                ],
              },
            }
            : {}),
        }
        : {}),
    };

    return prisma.product.update({
      where: { id },
      data: payload,
      include: {
        category: true,
        uom: true,
        images: true,
        finishedGoodsStocks: { include: { store: true } },
        billOfMaterials: { include: { rawMaterial: true } },
        capacityHistories: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  async delete(id: bigint) {
    await this.findById(id);
    const [salesCount, prodOrderCount, dispatchCount, realTxnCount, usedAsComponentCount] = await Promise.all([
      prisma.salesOrderItem.count({ where: { productId: id } }),
      prisma.productionOrder.count({ where: { productItemId: id } }),
      prisma.goodsDispatchItem.count({ where: { productItemId: id } }),
      prisma.finishedGoodsTransaction.count({
        where: {
          productItemId: id,
          txnType: { not: "OPENING_STOCK" },
        },
      }),
      prisma.salesProductComponent.count({ where: { componentProductId: id } }),
    ]);

    if (salesCount > 0 || prodOrderCount > 0 || dispatchCount > 0 || realTxnCount > 0) {
      throw new ApiError(400, "Cannot delete product as it is referenced in sales orders, production orders, dispatch, or stock transactions.");
    }

    if (usedAsComponentCount > 0) {
      throw new ApiError(400, "Cannot delete this product because it is used as a component in one or more sales products. Remove it from those sales products first.");
    }

    return executeDeleteWithValidation(
      () => prisma.$transaction(async (tx) => {
        await tx.finishedGoodsTransaction.deleteMany({ where: { productItemId: id } });
        await tx.finishedGoodsStock.deleteMany({ where: { productItemId: id } });
        await tx.billOfMaterial.deleteMany({ where: { productId: id } });
        await tx.productionStep.deleteMany({ where: { productId: id } });
        await tx.productImage.deleteMany({ where: { productId: id } });
        return tx.product.delete({ where: { id } });
      }),
      "Product"
    );
  }

  async getNextProductId() {
    const lastItem = await prisma.product.findFirst({
      orderBy: { id: "desc" },
    });

    if (!lastItem || !lastItem.productCode) {
      return "PROD001";
    }

    const lastId = lastItem.productCode;
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

export default new ProductService();
