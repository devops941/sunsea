import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

export class SupplierRepository {
  async count(where: Prisma.SupplierWhereInput) {
    return prisma.supplier.count({ where });
  }

  async findMany(params: {
    where: Prisma.SupplierWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.SupplierOrderByWithRelationInput;
  }) {
    return prisma.supplier.findMany({
      where: params.where,
      skip: params.skip,
      take: params.take,
      orderBy: params.orderBy || { createdAt: "desc" },
      include: {
        addresses: true,
        materialPrices: true,
        // BUG-SUP-003 fix: include creator user so Edit page can show "Created by-on"
        createdByUser: {
          select: { userId: true, fullName: true },
        },
      },
    });
  }

  async findById(id: string) {
    return prisma.supplier.findUnique({
      where: { id: Number(id) },
      include: {
        addresses: true,
        materialPrices: true,
        // BUG-SUP-003 fix: include creator user so Edit page can show "Created by-on"
        createdByUser: {
          select: { userId: true, fullName: true },
        },
      },
    });
  }

  async findByCode(companyId: string, supplierCode: string) {
    return prisma.supplier.findUnique({
      where: {
        companyId_supplierCode: {
          companyId,
          supplierCode,
        },
      },
      include: {
        addresses: true,
        materialPrices: true,
      },
    });
  }

  async findFirst(where: Prisma.SupplierWhereInput) {
    return prisma.supplier.findFirst({
      where,
      include: {
        addresses: true,
        materialPrices: true,
      },
    });
  }

  async create(data: Prisma.SupplierCreateInput) {
    return prisma.supplier.create({
      data,
      include: {
        addresses: true,
        materialPrices: true,
      },
    });
  }

  async update(id: string, data: Prisma.SupplierUpdateInput) {
    return prisma.supplier.update({
      where: { id: Number(id) },
      data,
      include: {
        addresses: true,
        materialPrices: true,
      },
    });
  }

  async delete(id: string) {
    return prisma.supplier.delete({
      where: { id: Number(id) },
    });
  }
}

export const supplierRepository = new SupplierRepository();
