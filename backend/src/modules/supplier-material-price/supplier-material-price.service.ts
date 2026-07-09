import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { Prisma } from "@prisma/client";

class SupplierMaterialPriceService {
  async fetchCurrent(supplierId: number) {
    // Fetch all current pricing records for the supplier
    const prices = await prisma.supplierMaterialPrice.findMany({
      where: {
        supplierId,
        validTo: null,
      },
      orderBy: {
        validFrom: "desc",
      },
    });

    // console.log(supplierId, "sadsad")
    // console.log(prices, 'kjlk')

    // if (prices.length === 0) {
    //   return [];
    // }

    // Fetch raw material details to map their names
    const rawMaterialIds = prices.map((p) => p.rawMaterialId);

    const rawMaterials = await prisma.rawMaterial.findMany({
      where: {
        rawMaterialId: { in: rawMaterialIds },
      },
      select: {
        rawMaterialId: true,
        materialName: true,
      },
    });

    const materialNameMap = new Map(
      rawMaterials.map((rm) => [rm.rawMaterialId, rm.materialName])
    );

    // Compute revision counts for each raw material of this supplier
    const revisionCounts = await prisma.supplierMaterialPrice.groupBy({
      by: ["rawMaterialId"],
      where: {
        supplierId,
      },
      _count: {
        id: true,
      },
    });

    const revisionCountMap = new Map(
      revisionCounts.map((rc) => [rc.rawMaterialId, rc._count.id])
    );

    // Map pricing rows to include materialName and revisionCount
    return prices.map((price) => ({
      ...price,
      price: Number(price.price), // Convert Prisma Decimal to number
      materialName: materialNameMap.get(price.rawMaterialId) || "Unknown Material",
      revisionCount: revisionCountMap.get(price.rawMaterialId) || 1,
    }));
  }

  async fetchHistory(supplierId: number, rawMaterialId: string) {
    const history = await prisma.supplierMaterialPrice.findMany({
      where: {
        supplierId,
        rawMaterialId,
      },
      orderBy: {
        validFrom: "desc",
      },
    });

    return history.map((h) => ({
      ...h,
      price: Number(h.price),
    }));
  }

  async create(data: {
    supplierId: number;
    rawMaterialId: string;
    price: number;
    validFrom: string;
  }) {
    const { supplierId, rawMaterialId, price, validFrom } = data;

    // Check if there is already a current price row
    const existingCurrent = await prisma.supplierMaterialPrice.findFirst({
      where: {
        supplierId,
        rawMaterialId,
        validTo: null,
      },
    });

    if (existingCurrent) {
      throw new ApiError(
        400,
        `Current price row already exists for raw material ${rawMaterialId}`
      );
    }

    const created = await prisma.supplierMaterialPrice.create({
      data: {
        supplierId,
        rawMaterialId,
        price: new Prisma.Decimal(price),
        validFrom: new Date(validFrom),
        validTo: null,
      },
    });

    return {
      ...created,
      price: Number(created.price),
    };
  }

  async revise(data: {
    supplierId: number;
    rawMaterialId: string;
    price: number;
    validFrom: string;
  }) {
    const { supplierId, rawMaterialId, price, validFrom } = data;
    const newValidFrom = new Date(validFrom);

    const result = await prisma.$transaction(async (tx) => {
      // Find the current active price row
      const currentPriceRow = await tx.supplierMaterialPrice.findFirst({
        where: {
          supplierId,
          rawMaterialId,
          validTo: null,
        },
      });

      if (currentPriceRow) {
        // Close the old row
        // Calculate validTo: the day before newValidFrom
        const validToDate = new Date(newValidFrom.getTime() - 24 * 60 * 60 * 1000);

        // Ensure validTo isn't before validFrom of currentPriceRow
        const currentValidFrom = new Date(currentPriceRow.validFrom);
        const finalValidTo = validToDate < currentValidFrom ? currentValidFrom : validToDate;

        await tx.supplierMaterialPrice.update({
          where: { id: currentPriceRow.id },
          data: { validTo: finalValidTo },
        });
      }

      // Insert the new price row
      return tx.supplierMaterialPrice.create({
        data: {
          supplierId,
          rawMaterialId,
          price: new Prisma.Decimal(price),
          validFrom: newValidFrom,
          validTo: null,
        },
      });
    });

    return {
      ...result,
      price: Number(result.price),
    };
  }

  async delete(priceRowId: string) {
    const row = await prisma.supplierMaterialPrice.findUnique({
      where: { id: priceRowId },
    });

    if (!row) {
      throw new ApiError(404, "Price record not found");
    }

    await prisma.supplierMaterialPrice.delete({
      where: { id: priceRowId },
    });
  }
}

export default new SupplierMaterialPriceService();
