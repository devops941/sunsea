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
          const imageUrl = await uploadToImageKit(file.path, uniqueName, "/products");
          uploadedImages.push({
            imageUrl,
            isPrimary: index === 0,
          });

          // Clean up the local temp file after upload
          try {
            fs.unlinkSync(file.path);
          } catch (err) {
            console.error("Failed to delete temp file:", file.path, err);
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
      sizeId: data.sizeId ? Number(data.sizeId) : null,

      capacityLitres: toNumberOrNull(data.capacityLitres),
      weightPerPiece: toNumberOrNull(data.weightPerPiece),
      bundleQty: toNumberOrNull(data.bundleQty),
      isActive: toBoolean(data.isActive, true),

      hsnCode: data.hsnCode || null,
      gstRate: toNumberOrNull(data.gstRate),
      cess: toNumberOrNull(data.cess),
      minimumQty: data.minimumQty || "0",
      maximumQty: data.maximumQty || "0",


      ...(colorIds.length
        ? {
          colors: {
            create: colorIds.map((colorId, index) => {
              let priceObj: any = {};
              if (data.colorPricing) {
                try {
                  const pricingArr = typeof data.colorPricing === "string"
                    ? JSON.parse(data.colorPricing)
                    : data.colorPricing;
                  priceObj = (pricingArr || []).find((p: any) => Number(p.colorId) === colorId) || {};
                } catch (e) {
                  console.error("Failed to parse colorPricing in create:", e);
                }
              }
              return {
                colorId,
                isDefault: index === 0,
              };
            }),
          },
        }
        : {}),

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

    return prisma.product.create({
      data: {
        ...payload,
        // Existing colors create block remains unchanged...
        // New: create color type pricing rows
        ...(colorTypePricingList.length > 0 && {
          colorTypePrices: {
            create: colorTypePricingList.map((p: any) => ({
              colorType: p.typeId,                // "sc" or "mc"
              b2b: toNumberOrNull(p.b2b),
              mrp: toNumberOrNull(p.mrp),
              b2c: toNumberOrNull(p.b2c),
              exportPrice: toNumberOrNull(p.exportPrice),
            })),
          },
        }),
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
      },

      include: {
        category: true,
        subCategory: true,
        uom: true,
        colors: { include: { color: true } }, // ✅ multi-color
        size: true,
        images: true,
        colorTypePrices: true,
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
        colorTypePrices: true,
        uom: true,
        colors: { include: { color: true } }, // ✅ was: color: true
        size: true,
        images: true,
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
        colorTypePrices: true,
        uom: true,
        colors: { include: { color: true } }, // ✅ was: color: true
        size: true,
        images: true,
        finishedGoodsStocks: true,
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

    const uploadedImages: any[] = [];
    if (files && files.length > 0) {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const uniqueName = `product_${Date.now()}_${index}${path.extname(file.originalname)}`;
        try {
          const imageUrl = await uploadToImageKit(file.path, uniqueName, "/products");
          uploadedImages.push({
            productId: id,
            imageUrl,
            isPrimary: false,
          });

          // Clean up the local temp file after upload
          try {
            fs.unlinkSync(file.path);
          } catch (err) {
            console.error("Failed to delete temp file:", file.path, err);
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

      if (colorTypePricingList !== null) {
        // Delete all existing rows for this product
        await tx.productColorTypePrice.deleteMany({ where: { productId: id } });

        // Create new rows if the list is not empty
        if (colorTypePricingList.length > 0) {
          await tx.productColorTypePrice.createMany({
            data: colorTypePricingList.map((p: any) => ({
              productId: id,
              colorType: p.typeId,
              b2b: toNumberOrNull(p.b2b),
              mrp: toNumberOrNull(p.mrp),
              b2c: toNumberOrNull(p.b2c),
              exportPrice: toNumberOrNull(p.exportPrice)
            })),
          });
        }
      }

      // ✅ Color handling — only if colorIds was sent in the request
      if (colorIds !== null) {
        await tx.productColor.deleteMany({ where: { productId: id } });

        if (colorIds.length) {
          let colorPricing: any[] = [];
          if (data.colorPricing) {
            try {
              colorPricing = typeof data.colorPricing === "string"
                ? JSON.parse(data.colorPricing)
                : data.colorPricing;
            } catch (e) {
              console.error("Failed to parse colorPricing in update:", e);
            }
          }

          await tx.productColor.createMany({
            data: colorIds.map((colorId, index) => {
              const priceObj = (colorPricing || []).find((p: any) => Number(p.colorId) === colorId) || {};
              return {
                productId: id,
                colorId,
                isDefault: index === 0,

              };
            }),
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
      // ✅ removed colorId — colors handled via ProductColor in transaction above
      sizeId: data.sizeId !== undefined ? (data.sizeId ? Number(data.sizeId) : null) : undefined,

      capacityLitres: data.capacityLitres !== undefined ? toNumberOrNull(data.capacityLitres) : undefined,
      weightPerPiece: data.weightPerPiece !== undefined ? toNumberOrNull(data.weightPerPiece) : undefined,
      bundleQty: data.bundleQty !== undefined ? toNumberOrNull(data.bundleQty) : undefined,
      minimumQty: data.minimumQty !== undefined ? data.minimumQty : undefined,
      maximumQty: data.maximumQty !== undefined ? data.maximumQty : undefined,
      isActive: data.isActive !== undefined ? toBoolean(data.isActive, true) : undefined,

      hsnCode: data.hsnCode !== undefined ? data.hsnCode || null : undefined,
      gstTaxRateId: data.gstTaxRateId !== undefined ? data.gstTaxRateId || null : undefined,
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
        colors: { include: { color: true } }, // ✅ was: color: true
        size: true,
        colorTypePrices: true,
        images: true,
      },
    });
  }

  async delete(id: bigint) {
    await this.findById(id);
    const [salesCount, stockCount] = await Promise.all([
      prisma.salesOrderItem.count({ where: { productId: id } }),
      prisma.finishedGoodsStock.count({ where: { productId: id } })
    ]);
    if (salesCount > 0 || stockCount > 0) {
      throw new Error("Cannot delete product as it is referenced in sales orders or stock");
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