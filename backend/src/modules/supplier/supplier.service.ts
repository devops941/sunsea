import { supplierRepository } from "./supplier.repository";
import { ApiError } from "../../utils/ApiError";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
} from "./supplier.validation";

class SupplierService {
  async createSupplier(
    data: CreateSupplierInput & { userId: string }
  ) {
    const existingSupplier = await supplierRepository.findByCode(data.companyId, data.supplierCode);

    if (existingSupplier) {
      throw new ApiError(
        409,
        `Supplier with code ${data.supplierCode} already exists for this company`
      );
    }

    const { addresses, userId, materialPrices, ...supplierData } = data;

    const isAdmin = userId.startsWith("admin_");

    // When admin creates a supplier, we need a valid userId for the FK constraint
    // since admins are in a separate table and createdBy references the User table
    let createdByUserId = userId;
    if (isAdmin) {
      const fallbackUser = await prisma.user.findFirst({
        where: { status: "active" },
        select: { userId: true },
      });
      if (!fallbackUser) {
        throw new ApiError(500, "No active user found in the system to attribute this record to");
      }
      createdByUserId = fallbackUser.userId;
    }

    const insertData: Prisma.SupplierCreateInput = {
      ...supplierData,
      bankAccount: supplierData.bankAccount as any,
      minOrderQty: supplierData.minOrderQty !== undefined && supplierData.minOrderQty !== null ? new Prisma.Decimal(supplierData.minOrderQty) : undefined,
      createdByUser: { connect: { userId: createdByUserId } },
      addresses: addresses && addresses.length > 0
        ? {
          create: addresses.map((addr) => ({
            label: addr.label,
            isDefault: addr.isDefault,
            address: addr.address as any,
            stateCode: addr.stateCode,
          })),
        }
        : undefined,
      materialPrices: materialPrices && materialPrices.length > 0
        ? {
          create: materialPrices.map((mp: any) => ({
            rawMaterialId: mp.rawMaterialId,
            price: new Prisma.Decimal(mp.price),
            validFrom: new Date(mp.validFrom),
            validTo: mp.validTo ? new Date(mp.validTo) : null,
          })),
        }
        : undefined,
    };

    return supplierRepository.create(insertData);
  }

  async getNextSupplierCode() {
    const lastSupplier = await prisma.supplier.findFirst({
      orderBy: {
        supplierCode: "desc",
      },
    });

    if (!lastSupplier) {
      return "SUP001";
    }

    const lastCode = lastSupplier.supplierCode;
    const match = lastCode.match(/\d+/);
    if (!match) {
      return lastCode + "001";
    }

    const numberStr = match[0];
    const nextNumber = parseInt(numberStr, 10) + 1;
    const paddedNumber = String(nextNumber).padStart(numberStr.length, "0");
    const prefix = lastCode.substring(0, lastCode.indexOf(numberStr));
    const suffix = lastCode.substring(lastCode.indexOf(numberStr) + numberStr.length);
    return `${prefix}${paddedNumber}${suffix}`;
  }


  async getAllSuppliers(params: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }) {
    const { page, limit, search, status } = params;
    const offset = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {
      ...(status !== undefined && { status }),
      ...(search && {
        OR: [
          { supplierCode: { contains: search, mode: "insensitive" } },
          { legalName: { contains: search, mode: "insensitive" } },
          { displayName: { contains: search, mode: "insensitive" } },
          { contactPerson: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [suppliers, total] = await Promise.all([
      supplierRepository.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      supplierRepository.count(where),
    ]);

    return {
      suppliers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSupplierById(
    id: string
  ) {
    const supplier = await supplierRepository.findById(id);

    if (!supplier) {
      throw new ApiError(
        404,
        "Supplier not found"
      );
    }

    return supplier;
  }

  async updateSupplier(
    id: string,
    data: UpdateSupplierInput & { userId?: string }
  ) {
    const supplier = await this.getSupplierById(id);

    if (data.supplierCode && data.supplierCode !== supplier.supplierCode) {
      const companyId = data.companyId || supplier.companyId;
      const existingSupplier = await supplierRepository.findByCode(companyId, data.supplierCode);

      if (existingSupplier) {
        throw new ApiError(
          409,
          `Supplier with code ${data.supplierCode} already exists for this company`
        );
      }
    }

    const { addresses, userId, materialPrices, ...supplierData } = data;

    return prisma.$transaction(async (tx) => {
      if (addresses !== undefined) {
        // Delete all old addresses
        await tx.supplierAddress.deleteMany({
          where: { supplierId: Number(id) },
        });

        // Insert new addresses
        if (addresses.length > 0) {
          await tx.supplierAddress.createMany({
            data: addresses.map((addr) => ({
              supplierId: Number(id),
              label: addr.label,
              isDefault: addr.isDefault,
              address: addr.address as any,
              stateCode: addr.stateCode,
            })),
          });
        }
      }

      if (materialPrices !== undefined) {
        // Delete only current active material prices for this supplier
        await tx.supplierMaterialPrice.deleteMany({
          where: {
            supplierId: Number(id),
            validTo: null,
          },
        });

        // Insert new material prices
        if (materialPrices.length > 0) {
          await tx.supplierMaterialPrice.createMany({
            data: materialPrices.map((mp: any) => ({
              supplierId: Number(id),
              rawMaterialId: mp.rawMaterialId,
              price: new Prisma.Decimal(mp.price),
              validFrom: new Date(mp.validFrom),
              validTo: null, // Always null for active prices being set/updated via edit supplier
            })),
          });
        }
      }

      const updateData: Prisma.SupplierUpdateInput = {
        ...supplierData,
        bankAccount: supplierData.bankAccount as any,
        minOrderQty: supplierData.minOrderQty !== undefined && supplierData.minOrderQty !== null ? new Prisma.Decimal(supplierData.minOrderQty) : undefined,
        updatedByUser: userId ? { connect: { userId } } : undefined,
      };

      return tx.supplier.update({
        where: { id: Number(id) },
        data: updateData,
        include: {
          addresses: true,
          materialPrices: true,
        },
      });
    });
  }

  async deleteSupplier(
    id: string
  ) {
    await this.getSupplierById(id);
    return supplierRepository.delete(id);
  }
}

export default new SupplierService();