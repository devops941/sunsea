import { supplierRepository } from "./supplier.repository";
import { ApiError } from "../../utils/ApiError";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
} from "./supplier.validation";
import { uploadToImageKit } from "../../utils/Imagekit";
import { accountsService } from "../accounts/accounts.service";
import { voucherPostingService } from "../accounts/voucherPosting.service";
import { logAudit } from "../../utils/auditLog.util";

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

    // Strip `openingBalancePaidThroughLedgerId` too — workflow-only, not a Supplier column.
    const { addresses, userId, materialPrices, phones, openingBalance, openingBalancePaidThroughLedgerId: _paidThrough, ...supplierData } = data as any;

    const mobileData = phones || supplierData.mobile || null;

    const insertData: Prisma.SupplierCreateInput = {
      ...supplierData,
      mobile: mobileData as any,
      openingBalance: openingBalance !== undefined && openingBalance !== null ? new Prisma.Decimal(openingBalance) : new Prisma.Decimal(0),
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
    };

    const createdSupplier = await supplierRepository.create(insertData);

    // Auto-create AccountLedger under Sundry Creditors.
    // Opening balance always posts to Opening Balance Equity — bank ledgers are
    // never touched at supplier creation. Real advances must be entered via a
    // separate Payment Voucher.
    try {
      await accountsService.ensureSupplierLedger(createdSupplier);
      const opBal = Number(createdSupplier.openingBalance || 0);
      if (opBal > 0) {
        const opType = (data.openingBalanceType || "CREDIT").toUpperCase() as "DEBIT" | "CREDIT";
        await voucherPostingService.postSupplierOpeningBalanceVoucher(
          { id: createdSupplier.id, supplierCode: createdSupplier.supplierCode, legalName: createdSupplier.legalName },
          opBal,
          opType
        );
      }
    } catch (err) {
      console.error("Failed to auto-create supplier ledger/opening balance voucher:", err);
    }

    await logAudit(
      "Supplier",
      createdSupplier.supplierCode,
      "CREATE",
      userId
    );

    return createdSupplier;
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

    // Compute dynamic balance for each supplier using payable service
    const { payableService } = require("../accounts/payable.service");

    const suppliersWithBalance = await Promise.all(
      suppliers.map(async (supplier) => {
        const creatorInfo = adminMap.get(supplier.createdBy) || userMap.get(supplier.createdBy) || { name: 'Unknown User', role: 'Unknown Role' };
        const updaterInfo = supplier.updatedBy ? (adminMap.get(supplier.updatedBy) || userMap.get(supplier.updatedBy)) : null;

        // Payable convention (matches payableService + getSupplierById):
        //   positive netBalance = we owe supplier (Cr on their ledger)
        //   negative netBalance = advance paid, supplier owes us (Dr)
        let netBalance = 0;
        try {
          const result = await payableService.getPayableSummaries({ supplierId: supplier.id });
          const summaries = result?.data || result || [];
          if (Array.isArray(summaries) && summaries.length > 0) {
            netBalance = summaries[0].netBalance ?? summaries[0].balanceAsOnDate ?? 0;
          } else {
            const opBal = Number(supplier.openingBalance || 0);
            const opType = ((supplier as any).openingBalanceType || "CREDIT").toUpperCase();
            netBalance = opType === "DEBIT" ? -Math.abs(opBal) : Math.abs(opBal);
          }
        } catch (e) {
          const opBal = Number(supplier.openingBalance || 0);
          const opType = ((supplier as any).openingBalanceType || "CREDIT").toUpperCase();
          netBalance = opType === "DEBIT" ? -Math.abs(opBal) : Math.abs(opBal);
        }

        const balanceAmount = Math.abs(netBalance);
        const balanceType = netBalance > 0 ? "Cr" : netBalance < 0 ? "Dr" : "";

        return {
          ...supplier,
          createdUserName: creatorInfo.name,
          createdUserRole: creatorInfo.role,
          updatedUserName: updaterInfo ? updaterInfo.name : null,
          updatedUserRole: updaterInfo ? updaterInfo.role : null,
          netBalance,
          balanceAmount,
          balanceType,
        };
      })
    );

    return {
      suppliers: suppliersWithBalance,
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

    // Resolve names for editHistory
    let enrichedEditHistory: any[] = [];
    if (Array.isArray(supplier.editHistory)) {
      enrichedEditHistory = await Promise.all(supplier.editHistory.map(async (edit: any) => {
        let name = "Unknown User";
        if (edit.updatedBy) {
          if (edit.updatedBy.startsWith('admin_')) {
            const adminId = BigInt(edit.updatedBy.replace('admin_', ''));
            const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { fullName: true } });
            if (admin) name = admin.fullName;
          } else {
            const user = await prisma.user.findUnique({ where: { userId: edit.updatedBy }, select: { fullName: true } });
            if (user) name = user.fullName;
          }
        }
        return { ...edit, updatedByName: name };
      }));
    }

    // Compute dynamic balance from payable service (same as customer uses receivable)
    // Payable netBalance: positive = we owe supplier (Cr), negative = advance paid (Dr)
    let netBalance = 0;
    try {
      const { payableService } = require("../accounts/payable.service");
      const result = await payableService.getPayableSummaries({ supplierId: supplier.id });
      const summaries = result?.data || result || [];
      if (Array.isArray(summaries) && summaries.length > 0) {
        netBalance = summaries[0].netBalance ?? summaries[0].balanceAsOnDate ?? 0;
      } else {
        const opBal = Number(supplier.openingBalance || 0);
        const opType = ((supplier as any).openingBalanceType || "CREDIT").toUpperCase();
        netBalance = opType === "DEBIT" ? -Math.abs(opBal) : Math.abs(opBal);
      }
    } catch (e) {
      const opBal = Number(supplier.openingBalance || 0);
      const opType = ((supplier as any).openingBalanceType || "CREDIT").toUpperCase();
      netBalance = opType === "DEBIT" ? -Math.abs(opBal) : Math.abs(opBal);
    }

    // Payable: positive = Cr (we owe them), negative = Dr (advance/they owe us)
    const balanceAmount = Math.abs(netBalance);
    const balanceType = netBalance > 0 ? "Cr" : netBalance < 0 ? "Dr" : "";

    // Check if supplier has real transactions (beyond the opening balance voucher)
    const supplierLedger = await prisma.accountLedger.findUnique({
      where: { supplierId: Number(id) },
      include: { debitItems: { include: { voucher: true } }, creditItems: { include: { voucher: true } } },
    });
    const allJournalItems = [...(supplierLedger?.debitItems || []), ...(supplierLedger?.creditItems || [])];
    const hasTransactions = allJournalItems.some(
      (item: any) => item.voucher?.refDocType !== "SUPPLIER_OPENING_BALANCE"
    );

    return {
      ...supplier,
      createdUserName,
      createdUserRole,
      updatedUserName,
      updatedUserRole,
      netBalance,
      balanceAmount,
      balanceType,
      hasTransactions,
      editHistory: enrichedEditHistory,
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

    const { addresses, userId, materialPrices, phones, openingBalance, openingBalanceType, ...supplierData } = data as any;

    // Handle opening balance update — only if opening balance is actually changed and supplier has no real transactions
    const isOpeningBalanceChanged =
      (openingBalance !== undefined && Number(openingBalance) !== Number(supplier.openingBalance ?? 0)) ||
      (openingBalanceType !== undefined && String(openingBalanceType).toUpperCase() !== String(supplier.openingBalanceType ?? "CREDIT").toUpperCase());

    if (isOpeningBalanceChanged && supplier.hasTransactions) {
      throw new ApiError(400, "Cannot update opening balance — supplier has existing transactions");
    }

    // We no longer need to map to a fallback user because updatedBy is a plain string
    let updatedByUserId = userId;

    const updated = await prisma.$transaction(async (tx) => {
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

      const mobileData = phones !== undefined ? phones : supplierData.mobile;

      // Handle edit history
      let newEditHistory: any[] = [];
      let rawHistory = (supplier as any).editHistory;
      if (typeof rawHistory === "string") {
        try {
          rawHistory = JSON.parse(rawHistory);
        } catch (e) {
          rawHistory = [];
        }
      }

      if (Array.isArray(rawHistory) && rawHistory.length > 0) {
        newEditHistory = rawHistory.map((item: any) => ({
          updatedBy: item.updatedBy,
          updatedAt: item.updatedAt,
        }));
      } else if (supplier.createdBy || supplier.createdAt) {
        newEditHistory.push({
          updatedBy: supplier.createdBy || "System",
          updatedAt: supplier.createdAt ? new Date(supplier.createdAt).toISOString() : new Date().toISOString(),
        });
      }
      
      if (updatedByUserId) {
        newEditHistory.push({
          updatedBy: updatedByUserId,
          updatedAt: new Date().toISOString()
        });
      }

      const updateData: Prisma.SupplierUpdateInput = {
        ...supplierData,
        ...(mobileData !== undefined && { mobile: mobileData as any }),
        ...(isOpeningBalanceChanged && !supplier.hasTransactions && {
          openingBalance: openingBalance !== undefined ? Number(openingBalance) : Number(supplier.openingBalance ?? 0),
          openingBalanceType: openingBalanceType !== undefined ? openingBalanceType : (supplier.openingBalanceType ?? "CREDIT"),
        }),
        editHistory: newEditHistory,
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

    // Re-post opening balance voucher if opening balance was changed
    if (isOpeningBalanceChanged && !supplier.hasTransactions) {
      try {
        await prisma.voucher.deleteMany({
          where: { refDocType: "SUPPLIER_OPENING_BALANCE", refDocId: String(id) },
        });
      } catch { /* no existing voucher — that's fine */ }

      const newBalance = openingBalance !== undefined ? Number(openingBalance) : Number(supplier.openingBalance ?? 0);
      if (newBalance > 0) {
        const newType = ((openingBalanceType ?? supplier.openingBalanceType ?? "CREDIT") as string).toUpperCase() as "DEBIT" | "CREDIT";
        await voucherPostingService.postSupplierOpeningBalanceVoucher(
          { id: updated.id, supplierCode: updated.supplierCode, legalName: updated.legalName },
          newBalance,
          newType
        );
      }
    }

    // Update supplier ledger name
    try {
      const ledgerName = updated.legalName || updated.displayName || updated.supplierCode;
      await prisma.accountLedger.updateMany({
        where: { supplierId: Number(id) },
        data: { name: ledgerName },
      });
    } catch (err) {
      console.error("Failed to update supplier ledger name:", err);
    }

    await logAudit(
      "Supplier",
      updated.supplierCode,
      "UPDATE",
      updatedByUserId
    );

    return updated;
  }

  async deleteSupplier(
    id: string,
    userId?: string
  ) {
    const supplier = await this.getSupplierById(id);

    const linkedPurchaseOrders = await prisma.purchaseOrder.findFirst({ where: { supplierId: Number(id) } });
    if (linkedPurchaseOrders) throw new ApiError(400, "Cannot delete supplier because they have associated Purchase Orders.");

    const linkedGrnInvoices = await prisma.grnInvoice.findFirst({ where: { supplierId: Number(id) } });
    if (linkedGrnInvoices) throw new ApiError(400, "Cannot delete supplier because they have associated GRN Invoices.");

    const result = await supplierRepository.delete(id);
    
    await logAudit(
      "Supplier",
      supplier.supplierCode,
      "DELETE",
      userId
    );

    return result;
  }
}

export default new SupplierService();