import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { standardConverter } from "../../utils/convert.util";
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

function toIdArray(value: any): number[] {
  if (value === undefined || value === null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
}

class ProductService {
  private async resolveUomId(uomInput: any): Promise<number | null> {

    if (!uomInput) return null;

    // If it's already a valid number ID
    const numId = Number(uomInput);
    if (!isNaN(numId) && numId > 0) {
      return numId;
    }

    // Otherwise, it's a string code (e.g., "kg")
    const uomCode = String(uomInput).trim();
    let existingUom = await prisma.unitOfMeasure.findUnique({ where: { uomCode } });

    if (!existingUom) {
      // Auto-create it if missing using convert-units for the name
      let uomName = uomCode.toUpperCase();
      try {
        const desc = standardConverter().describe(uomCode as any);
        if (desc) {
          uomName = desc.plural || desc.singular || uomCode;
        }
      } catch (e) {
        // Ignored if convert-units doesn't recognize it
      }

      existingUom = await prisma.unitOfMeasure.create({
        data: {
          uomCode,
          uomName,
        },
      });
    }

    return existingUom.id;
  }

  async create(data: any, files?: Express.Multer.File[]) {
    const colorIds = toIdArray(data.colorIds);

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
      productCode: data.productCode,
      productName: data.productName,
      displayName: data.displayName || null,
      itemCode: data.itemCode || null,
      description: data.description || null,
      typeCode: data.typeCode || null,
      dimensions: data.dimensions || null,
      gstTaxRateId: data.gstTaxRateId || null,
      mouldReference: data.mouldReference || null,
      tags: data.tags || null,

      categoryId: Number(data.categoryId),
      subCategoryId: Number(data.subCategoryId),
      uomId: await this.resolveUomId(data.uomId),

      capacityLitres: toNumberOrNull(data.capacityLitres),
      weightPerPiece: toNumberOrNull(data.weightPerPiece),
      bundleQty: toNumberOrNull(data.bundleQty),
      isActive: toBoolean(data.isActive, true),

      hsnCode: data.hsnCode || null,
      gstRate: toNumberOrNull(data.gstRate),
      cess: toNumberOrNull(data.cess),
      minimumQty: data.minimumQty || "0",
      maximumQty: data.maximumQty || "0",
      mrp: toNumberOrNull(data.mrp),
      b2b: toNumberOrNull(data.b2b),
      b2c: toNumberOrNull(data.b2c),
      exportPrice: toNumberOrNull(data.exportPrice),

      ...(uploadedImages.length
        ? {
          images: {
            create: uploadedImages,
          },
        }
        : {}),
    };

    let colorTypePricingList: any[] = [];
    if (data.colorTypePricing) {
      try {
        colorTypePricingList = typeof data.colorTypePricing === "string"
          ? JSON.parse(data.colorTypePricing)
          : data.colorTypePricing;
      } catch (e) {
        console.error("Failed to parse colorTypePricing in create:", e);
      }
    }

    let rawMaterialsList: any[] = [];
    if (data.rawMaterials) {
      try {
        rawMaterialsList = typeof data.rawMaterials === "string"
          ? JSON.parse(data.rawMaterials)
          : data.rawMaterials;
        
        const totalPercent = rawMaterialsList.reduce((acc, curr) => acc + Number(curr.percentage), 0);
        if (rawMaterialsList.length > 0 && Math.abs(totalPercent - 100) > 0.01) {
          throw new ApiError(400, "Total raw material percentage must be exactly 100%");
        }
      } catch (e: any) {
        if (e instanceof ApiError) throw e;
        console.error("Failed to parse rawMaterials in create:", e);
      }
    }

    return prisma.product.create({
      data: {
        ...payload,
        ...(data.openingStockQty && data.openingStockStoreId
          ? {
              finishedGoodsStocks: {
                create: [
                  {
                    storeId: String(data.openingStockStoreId),
                    onHandQty: Number(data.openingStockQty),
                  },
                ],
              },
              finishedGoodsTransactions: {
                create: [
                  {
                    txnDateTime: new Date(),
                    storeId: String(data.openingStockStoreId),
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
              rawMaterialId: String(rm.rawMaterialId),
              requiredQuantity: new Prisma.Decimal(0),
              percentage: toNumberOrNull(rm.percentage),
            })),
          },
        }),
      },

      include: {
        category: true,
        subCategory: true,
        uom: true,
        images: true,
        billOfMaterials: { include: { rawMaterial: true } },
      },
    });
  }

  async findAll(search?: string) {
    const whereClause = search
      ? {
        OR: [
          { productCode: { contains: search, mode: "insensitive" as const } },
          { productName: { contains: search, mode: "insensitive" as const } },
          { itemCode: { contains: search, mode: "insensitive" as const } },
          { tags: { contains: search, mode: "insensitive" as const } },
        ],
      }
      : {};

    return prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        subCategory: true,
        uom: true,
        images: true,
        finishedGoodsStocks: true,
        billOfMaterials: { include: { rawMaterial: true } },
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
        subCategory: true,
        uom: true,
        images: true,
        finishedGoodsStocks: true,
        billOfMaterials: { include: { rawMaterial: true } },
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

    // null means "not sent" — leave colors alone
    // [] means "sent but empty" — clear all colors
    const colorIds = data.colorIds !== undefined ? toIdArray(data.colorIds) : null;

    let colorTypePricingList: any[] | null = null;
    if (data.colorTypePricing !== undefined) {
      try {
        colorTypePricingList = typeof data.colorTypePricing === "string"
          ? JSON.parse(data.colorTypePricing)
          : data.colorTypePricing;
      } catch (e) {
        console.error("Failed to parse colorTypePricing in update:", e);
      }
    }

    let rawMaterialsList: any[] | null = null;
    if (data.rawMaterials !== undefined) {
      try {
        rawMaterialsList = typeof data.rawMaterials === "string"
          ? JSON.parse(data.rawMaterials)
          : data.rawMaterials;
        
        if (rawMaterialsList && rawMaterialsList.length > 0) {
          const totalPercent = rawMaterialsList.reduce((acc, curr) => acc + Number(curr.percentage), 0);
          if (Math.abs(totalPercent - 100) > 0.01) {
            throw new ApiError(400, "Total raw material percentage must be exactly 100%");
          }
        }
      } catch (e: any) {
        if (e instanceof ApiError) throw e;
        console.error("Failed to parse rawMaterials in update:", e);
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
              requiredQuantity: new Prisma.Decimal(0),
              percentage: toNumberOrNull(rm.percentage)
            }))
          });
        }
      }

    });

    const payload: Prisma.ProductUncheckedUpdateInput = {
      productCode: data.productCode ?? undefined,
      productName: data.productName ?? undefined,
      displayName: data.displayName !== undefined ? data.displayName || null : undefined,
      itemCode: data.itemCode !== undefined ? data.itemCode || null : undefined,
      description: data.description !== undefined ? data.description || null : undefined,
      typeCode: data.typeCode !== undefined ? data.typeCode || null : undefined,
      dimensions: data.dimensions !== undefined ? data.dimensions || null : undefined,
      mouldReference: data.mouldReference !== undefined ? data.mouldReference || null : undefined,
      tags: data.tags !== undefined ? data.tags || null : undefined,

      categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      subCategoryId: undefined,
      uomId: data.uomId !== undefined ? await this.resolveUomId(data.uomId) : undefined,

      capacityLitres: data.capacityLitres !== undefined ? toNumberOrNull(data.capacityLitres) : undefined,
      weightPerPiece: data.weightPerPiece !== undefined ? toNumberOrNull(data.weightPerPiece) : undefined,
      bundleQty: data.bundleQty !== undefined ? toNumberOrNull(data.bundleQty) : undefined,
      minimumQty: data.minimumQty !== undefined ? data.minimumQty : undefined,
      maximumQty: data.maximumQty !== undefined ? data.maximumQty : undefined,
      isActive: data.isActive !== undefined ? toBoolean(data.isActive, true) : undefined,

      hsnCode: data.hsnCode !== undefined ? data.hsnCode || null : undefined,
      gstTaxRateId: data.gstTaxRateId !== undefined ? data.gstTaxRateId || null : undefined,
      mrp: data.mrp !== undefined ? toNumberOrNull(data.mrp) : undefined,
      b2b: data.b2b !== undefined ? toNumberOrNull(data.b2b) : undefined,
      b2c: data.b2c !== undefined ? toNumberOrNull(data.b2c) : undefined,
      exportPrice: data.exportPrice !== undefined ? toNumberOrNull(data.exportPrice) : undefined,
      gstRate: data.gstRate !== undefined ? toNumberOrNull(data.gstRate) : undefined,
      cess: data.cess !== undefined ? toNumberOrNull(data.cess) : undefined,
      
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
        subCategory: true,
        uom: true,
        images: true,
        billOfMaterials: { include: { rawMaterial: true } },
      },
    });
  }

  async delete(id: bigint) {
    await this.findById(id);
    const [salesCount, stockCount] = await Promise.all([
      prisma.salesOrderItem.count({ where: { productId: id } }),
      prisma.finishedGoodsStock.count({ where: { productItemId: id } })
    ]);
    if (salesCount > 0 || stockCount > 0) {
      throw new ApiError(400, "Cannot delete product as it is referenced in sales orders or stock");
    }
    return prisma.product.delete({ where: { id } });
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