import { supplierRepository } from "./supplier.repository";
import { ApiError } from "../../utils/ApiError";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
} from "./supplier.validation";
import { uploadToImageKit } from "../../utils/Imagekit";

async function processBankAccounts(bankAccounts: any): Promise<any> {
  if (!Array.isArray(bankAccounts)) return bankAccounts;
  
  return Promise.all(bankAccounts.map(async (acc, index) => {
    if (acc.qrImage && acc.qrImage.startsWith("data:image")) {
      try {
        const base64Data = acc.qrImage.split(";base64,").pop();
        if (base64Data) {
          const buffer = Buffer.from(base64Data, "base64");
          const fileName = `supplier_qr_${Date.now()}_${index}.png`;
          const imageUrl = await uploadToImageKit(buffer, fileName, "/suppliers");
          return { ...acc, qrImage: imageUrl };
        }
      } catch (err) {
        console.error("Failed to upload QR image to ImageKit:", err);
      }
    }
    return acc;
  }));
}

class SupplierService {
  async createSupplier(
    data: CreateSupplierInput & { userId: string; companyId: string }
  ) {
    const existingSupplier = await supplierRepository.findByCode(data.companyId, data.supplierCode);

    if (existingSupplier) {
      throw new ApiError(
        409,
        `Supplier with code ${data.supplierCode} already exists for this company`
      );
    }

    const { addresses, userId, materialPrices, phones, ...supplierData } = data as any;

    const processedBankAccount = await processBankAccounts(supplierData.bankAccount);
    const mobileData = phones || supplierData.mobile || null;

    const insertData: Prisma.SupplierCreateInput = {
      ...supplierData,
      mobile: mobileData as any,
      bankAccount: processedBankAccount as any,
      minOrderQty: supplierData.minOrderQty !== undefined && supplierData.minOrderQty !== null ? new Prisma.Decimal(supplierData.minOrderQty) : undefined,
      createdBy: userId,
      addresses: addresses && addresses.length > 0
        ? {
          create: addresses.map((addr: any, index: number) => ({
            address: addr.address as any,
            label: `Address ${index + 1}`,
            state_code: addr.address.state || "",
            is_default: index === 0,
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

    // Fetch creator and updater names from User and Admin tables
    const creatorIds = suppliers.map(s => s.createdBy).filter((id): id is string => Boolean(id));
    const updaterIds = suppliers.map(s => s.updatedBy).filter((id): id is string => Boolean(id));
    const allUserIds = [...new Set([...creatorIds, ...updaterIds])];

    const adminIds = allUserIds.filter(id => id.startsWith('admin_')).map(id => BigInt(id.replace('admin_', '')));
    const normalUserIds = allUserIds.filter(id => !id.startsWith('admin_'));

    const [admins, users] = await Promise.all([
      prisma.admin.findMany({ where: { id: { in: adminIds } }, select: { id: true, fullName: true, role: { select: { name: true } } } }),
      prisma.user.findMany({ where: { userId: { in: normalUserIds } }, select: { userId: true, fullName: true, role: { select: { name: true } } } })
    ]);

    const adminMap = new Map(admins.map(a => [`admin_${a.id}`, { name: a.fullName, role: a.role?.name || 'Super Admin' }]));
    const userMap = new Map(users.map(u => [u.userId, { name: u.fullName, role: u.role?.name || 'User' }]));

    const suppliersWithNames = suppliers.map(supplier => {
      const creatorInfo = adminMap.get(supplier.createdBy) || userMap.get(supplier.createdBy) || { name: 'Unknown User', role: 'Unknown Role' };
      const updaterInfo = supplier.updatedBy ? (adminMap.get(supplier.updatedBy) || userMap.get(supplier.updatedBy)) : null;
      
      return {
        ...supplier,
        createdUserName: creatorInfo.name,
        createdUserRole: creatorInfo.role,
        updatedUserName: updaterInfo ? updaterInfo.name : null,
        updatedUserRole: updaterInfo ? updaterInfo.role : null
      };
    });

    return {
      suppliers: suppliersWithNames,
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

    let createdUserName = 'Unknown User';
    let createdUserRole = 'Unknown Role';
    let updatedUserName = null;
    let updatedUserRole = null;

    if (supplier.createdBy) {
      if (supplier.createdBy.startsWith('admin_')) {
        const adminId = BigInt(supplier.createdBy.replace('admin_', ''));
        const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { fullName: true, role: { select: { name: true } } } });
        if (admin) {
            createdUserName = admin.fullName;
            createdUserRole = admin.role?.name || 'Super Admin';
        }
      } else {
        const user = await prisma.user.findUnique({ where: { userId: supplier.createdBy }, select: { fullName: true, role: { select: { name: true } } } });
        if (user) {
            createdUserName = user.fullName;
            createdUserRole = user.role?.name || 'User';
        }
      }
    }

    if (supplier.updatedBy) {
      if (supplier.updatedBy.startsWith('admin_')) {
        const adminId = BigInt(supplier.updatedBy.replace('admin_', ''));
        const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { fullName: true, role: { select: { name: true } } } });
        if (admin) {
            updatedUserName = admin.fullName;
            updatedUserRole = admin.role?.name || 'Super Admin';
        }
      } else {
        const user = await prisma.user.findUnique({ where: { userId: supplier.updatedBy }, select: { fullName: true, role: { select: { name: true } } } });
        if (user) {
            updatedUserName = user.fullName;
            updatedUserRole = user.role?.name || 'User';
        }
      }
    }

    return {
      ...supplier,
      createdUserName,
      createdUserRole,
      updatedUserName,
      updatedUserRole
    };
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

    const { addresses, userId, materialPrices, phones, ...supplierData } = data as any;

    // We no longer need to map to a fallback user because updatedBy is a plain string
    let updatedByUserId = userId;

    return prisma.$transaction(async (tx) => {
      if (addresses !== undefined) {
        // Delete all old addresses
        await tx.supplierAddress.deleteMany({
          where: { supplierId: Number(id) },
        });

        // Insert new addresses
        if (addresses.length > 0) {
          await tx.supplierAddress.createMany({
            data: addresses.map((addr: any, index: number) => ({
              supplierId: Number(id),
              address: addr.address as any,
              label: `Address ${index + 1}`,
              state_code: addr.address.state || "",
              is_default: index === 0,
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

      const processedBankAccount = await processBankAccounts(supplierData.bankAccount);
      const mobileData = phones !== undefined ? phones : supplierData.mobile;

      const updateData: Prisma.SupplierUpdateInput = {
        ...supplierData,
        ...(mobileData !== undefined && { mobile: mobileData as any }),
        bankAccount: processedBankAccount as any,
        minOrderQty: supplierData.minOrderQty !== undefined && supplierData.minOrderQty !== null ? new Prisma.Decimal(supplierData.minOrderQty) : undefined,
        updatedBy: updatedByUserId ? updatedByUserId : undefined,
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

    const linkedPurchaseOrders = await prisma.purchaseOrder.findFirst({ where: { supplierId: Number(id) } });
    if (linkedPurchaseOrders) throw new ApiError(400, "Cannot delete supplier because they have associated Purchase Orders.");

    const linkedGrnInvoices = await prisma.grnInvoice.findFirst({ where: { supplierId: Number(id) } });
    if (linkedGrnInvoices) throw new ApiError(400, "Cannot delete supplier because they have associated GRN Invoices.");

    return supplierRepository.delete(id);
  }
}

export default new SupplierService();