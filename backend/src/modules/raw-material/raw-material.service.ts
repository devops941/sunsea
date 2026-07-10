import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { executeDeleteWithValidation } from "../../utils/deleteValidation";
import { CreateRawMaterialInput, UpdateRawMaterialInput } from "./raw-material.validation";

class RawMaterialService {
  async create(data: CreateRawMaterialInput, userId?: string) {
    const existingId = await prisma.rawMaterial.findUnique({
      where: { rawMaterialId: data.rawMaterialId },
    });

    if (existingId) {
      throw new ApiError(409, `Raw Material with ID ${data.rawMaterialId} already exists`);
    }



    return prisma.$transaction(async (tx) => {
      const rawMaterial = await tx.rawMaterial.create({
        data: {
          rawMaterialId: data.rawMaterialId,
          materialName: data.materialName,
          ...(data.categoryId ? { category: { connect: { id: data.categoryId } } } : {}),
          hsnCode: data.hsnCode || null,
          minimumStock: data.minimumStock,
          leadTimeDays: data.leadTimeDays,
          baseUom: data.baseUom,
          reorderLevel: data.reorderLevel,
          unitPrice: data.unitPrice,
          ...(data.storeId ? { store: { connect: { storeId: data.storeId } } } : {}),
          isActive: data.isActive ?? true,
          createdBy: userId,
          // locationId: data.locationId ?? null,
          batchNo: data.batchNo ?? null,
          onHandQty: data.onHandQty ?? 0,
          reservedQty: data.reservedQty ?? 0,
          avgCost: data.avgCost ?? 0,
          remarks: data.remarks ?? null,
          lastMovementAt: data.lastMovementAt
            ? new Date(data.lastMovementAt)
            : null,
          status: data.status ?? "Active",
        }
      });



      return rawMaterial;
    });
  }

  async findAll(search?: string) {
    const whereClause: any = search
      ? {
        OR: [
          { materialCode: { contains: search } },
          { materialName: { contains: search } },
        ],
      }
      : {};

    return prisma.rawMaterial.findMany({
      where: whereClause,
      include: {
        store: true,
        category: true,
        storeLocation: true,
      },
      orderBy: {
        rawMaterialId: "asc",
      },
    });
  }

  async findById(rawMaterialId: string) {
    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { rawMaterialId },
      include: {
        store: true,
        category: true,
        storeLocation: true,
      },
    });

    if (!rawMaterial) {
      throw new ApiError(404, `Raw Material with ID ${rawMaterialId} not found`);
    }

    return rawMaterial;
  }

  async update(rawMaterialId: string, data: UpdateRawMaterialInput, userId?: string) {
    await this.findById(rawMaterialId);


    const { categoryId, gstTaxRateId, storeId, ...restData } = data;

    const updateData: any = {
      ...restData,
      updatedBy: userId,
    };

    if (categoryId !== undefined) {
      if (categoryId === null) {
        updateData.category = { disconnect: true };
      } else {
        updateData.category = { connect: { id: categoryId } };
      }
    }

    if (storeId !== undefined) {
      if (storeId === null) {
        updateData.store = { disconnect: true };
      } else {
        updateData.store = { connect: { storeId: storeId } };
      }
    }

    return prisma.rawMaterial.update({
      where: { rawMaterialId },
      data: updateData,
    });
  }

  async delete(rawMaterialId: string, userId?: string) {
    await this.findById(rawMaterialId);

    const txnCount = await prisma.rawMaterialTransaction.count({
      where: { rawMaterialId },
    });

    if (txnCount > 0) {
      throw new ApiError(
        400,
        "Cannot delete this Raw Material because it has transaction history."
      );
    }

    // Hard Delete with Prisma error boundary
    return executeDeleteWithValidation(
      () => prisma.rawMaterial.delete({ where: { rawMaterialId } }),
      "Raw Material"
    );
  }
  async getNextRawMaterialId() {
    const lastItem = await prisma.rawMaterial.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!lastItem) {
      return "RM001";
    }

    const lastId = lastItem.rawMaterialId;
    const match = lastId.match(/\d+/);
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

export default new RawMaterialService();
