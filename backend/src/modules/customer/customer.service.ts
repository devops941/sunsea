import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { executeDeleteWithValidation } from "../../utils/deleteValidation";

import {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./customer.validation";
import { accountsService } from "../accounts/accounts.service";
import { voucherPostingService } from "../accounts/voucherPosting.service";
import { logAudit } from "../../utils/auditLog.util";

class CustomerService {
  /**
   * Derive lastPurchaseDate and lastPaymentDate from the account ledger.
   * - lastPurchaseDate = date of the most recent SALES voucher where the customer ledger is debited
   * - lastPaymentDate  = date of the most recent RECEIPT voucher where the customer ledger is credited
   */
  async getCustomerLedgerDates(customerId: string): Promise<{ lastPurchaseDate: Date | null; lastPaymentDate: Date | null }> {
    const ledger = await prisma.accountLedger.findUnique({
      where: { customerId },
      select: { id: true },
    });
    if (!ledger) return { lastPurchaseDate: null, lastPaymentDate: null };

    // Last SALES voucher date (customer ledger debited = purchase/invoice)
    const lastSalesItem = await prisma.journalItem.findFirst({
      where: {
        debitLedgerId: ledger.id,
        voucher: { type: "SALES" },
      },
      orderBy: { voucher: { date: "desc" } },
      select: { voucher: { select: { date: true } } },
    });

    // Last RECEIPT voucher date (customer ledger credited = payment received)
    const lastReceiptItem = await prisma.journalItem.findFirst({
      where: {
        creditLedgerId: ledger.id,
        voucher: { type: "RECEIPT" },
      },
      orderBy: { voucher: { date: "desc" } },
      select: { voucher: { select: { date: true } } },
    });

    return {
      lastPurchaseDate: lastSalesItem?.voucher?.date ?? null,
      lastPaymentDate: lastReceiptItem?.voucher?.date ?? null,
    };
  }

  async createCustomer(data: CreateCustomerInput, currentUser: { userId: string; companyId: string }) {
    let finalCustomerCode = data.customerCode;
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        companyId: currentUser.companyId,
        customerCode: data.customerCode,
      },
    });

    if (existingCustomer) {
      finalCustomerCode = await this.getNextCustomerCode();
    }

    // Also strip `openingBalancePaidThroughLedgerId` — it's a workflow-only field
    // used to route the auto-posted opening voucher to a bank/cash ledger; the
    // Customer table doesn't have (and doesn't need) a column for it.
    const { phones, addresses, openingBalance, openingBalancePaidThroughLedgerId: _paidThrough, customerCode: _originalCode, ...restData } = data as any;
    const mobileData = phones || restData.mobile || null;

    const newCustomer = await prisma.customer.create({
      data: {
        ...restData,
        customerCode: finalCustomerCode,
        mobile: mobileData as any,
        companyId: currentUser.companyId,
        createdBy: currentUser.userId,
        // Seed outstanding amount and opening balance (immutable after creation)
        outstandingAmount: openingBalance ?? 0,
        openingBalance: openingBalance ?? 0,
        editHistory: [{
          updatedBy: currentUser.userId,
          updatedAt: new Date().toISOString()
        }],
        ...(addresses && addresses.length > 0 && {
          addresses: {
            create: addresses.map((addr: any, index: number) => {
              const { _label, ...cleanAddr } = addr;
              return {
                address: cleanAddr,
                is_default: index === 0,
                label: _label || `Address ${index + 1}`,
                state_code: addr.state.toLowerCase(),
              };
            })
          }
        })
      },
      include: { addresses: true, customerType: true, customerGrade: true },
    });

    // Auto-create AccountLedger under Sundry Debtors.
    // Opening balance always posts to Opening Balance Equity — bank ledgers are
    // never touched at customer creation. Real advances must be entered via a
    // separate Receipt Voucher.
    try {
      await accountsService.ensureCustomerLedger(newCustomer);
      const opBal = Number(newCustomer.openingBalance || 0);
      if (opBal > 0) {
        const opType = (data.openingBalanceType || "DEBIT").toUpperCase() as "DEBIT" | "CREDIT";
        await voucherPostingService.postCustomerOpeningBalanceVoucher(
          { id: newCustomer.id, customerCode: newCustomer.customerCode, firmName: newCustomer.firmName },
          opBal,
          opType
        );
      }
    } catch (err) {
      console.error("Failed to auto-create customer ledger:", err);
    }

    await logAudit("Customer", newCustomer.customerCode, "CREATE", currentUser.userId, newCustomer.firmName);

    return newCustomer;
  }

  // BUG-CUST-004 fix: added server-side pagination (page, limit, skip/take)
  async getAllCustomers(params: {
    search?: string;
    page?: number;
    limit?: number;
    status?: string;
    customerTypeId?: number;
    customerGradeId?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const { search, page = 1, limit = 10, status, customerTypeId, customerGradeId, sortBy, sortOrder } = params;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { customerCode: { contains: search, mode: "insensitive" as const } },
        { firmName: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { displayName: { contains: search, mode: "insensitive" as const } },
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    if (customerTypeId) {
      whereClause.customerTypeId = customerTypeId;
    }

    if (customerGradeId) {
      whereClause.customerGradeId = customerGradeId;
    }

    let orderBy: any = { createdAt: "desc" };
    if (sortBy === "name" || sortBy === "firmName") {
      orderBy = { firmName: sortOrder === "desc" ? "desc" : "asc" };
    } else if (sortBy === "customerCode") {
      orderBy = { customerCode: sortOrder === "desc" ? "desc" : "asc" };
    } else if (sortBy === "status") {
      orderBy = { status: sortOrder === "desc" ? "desc" : "asc" };
    } else if (sortBy === "createdAt") {
      orderBy = { createdAt: sortOrder === "asc" ? "asc" : "desc" };
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: whereClause,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { addresses: true, customerType: true, customerGrade: true }
      }),
      prisma.customer.count({ where: whereClause }),
    ]);

    // Fetch creator names from User and Admin tables
    const creatorIds = [...new Set(customers.map(c => c.createdBy).filter(Boolean))];

    // Split IDs into admin IDs and normal user IDs
    const adminIds = creatorIds.filter(id => id.startsWith('admin_')).map(id => BigInt(id.replace('admin_', '')));
    const userIds = creatorIds.filter(id => !id.startsWith('admin_'));

    const [admins, users] = await Promise.all([
      adminIds.length > 0 ? prisma.admin.findMany({ where: { id: { in: adminIds } }, select: { id: true, username: true, role: { select: { name: true } } } }) : [],
      userIds.length > 0 ? prisma.user.findMany({ where: { userId: { in: userIds } }, select: { userId: true, username: true, role: { select: { name: true } } } }) : []
    ]);

    const adminMap = new Map(admins.map(a => [`admin_${a.id}`, { name: a.username, role: a.role?.name || 'Super Admin' }]));
    const userMap = new Map(users.map(u => [u.userId, { name: u.username, role: u.role?.name || 'User' }]));

    const { receivableService } = require("../accounts/receivable.service");

    const customersWithCreatorsAndBalance = await Promise.all(
      customers.map(async (customer) => {
        const creatorInfo = adminMap.get(customer.createdBy) || userMap.get(customer.createdBy) || { name: 'Unknown User', role: 'Unknown Role' };

        let netBalance = 0;
        try {
          const summaries = await receivableService.getReceivableSummaries({ customerId: customer.id });
          if (summaries && summaries.length > 0) {
            netBalance = summaries[0].netBalance;
          } else {
            const opBal = Number(customer.openingBalance || 0);
            const opType = ((customer as any).openingBalanceType || "DEBIT").toUpperCase();
            netBalance = opType === "CREDIT" ? -Math.abs(opBal) : Math.abs(opBal);
          }
        } catch (e) {
          const opBal = Number(customer.openingBalance || 0);
          const opType = ((customer as any).openingBalanceType || "DEBIT").toUpperCase();
          netBalance = opType === "CREDIT" ? -Math.abs(opBal) : Math.abs(opBal);
        }

        const balanceAmount = Math.abs(netBalance);
        const balanceType = netBalance > 0 ? "Dr" : netBalance < 0 ? "Cr" : "";

        return {
          ...customer,
          createdUserName: creatorInfo.name,
          createdUserRole: creatorInfo.role,
          netBalance,
          balanceAmount,
          balanceType,
        };
      })
    );

    return {
      customers: customersWithCreatorsAndBalance,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getNextCustomerCode() {
    const lastCustomer = await prisma.customer.findFirst({
      orderBy: {
        customerCode: "desc",
      },
    });

    if (!lastCustomer) {
      return "CUST001";
    }

    const lastCode = lastCustomer.customerCode;
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

  async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        customerType: true,
        customerGrade: true,
      }
    });

    if (!customer) {
      throw new ApiError(
        404,
        "Customer not found"
      );
    }

    let createdUserName = 'Unknown User';
    let createdUserRole = 'Unknown Role';
    if (customer.createdBy) {
      if (customer.createdBy.startsWith('admin_')) {
        const adminId = BigInt(customer.createdBy.replace('admin_', ''));
        const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { username: true, role: { select: { name: true } } } });
        if (admin) {
          createdUserName = admin.username;
          createdUserRole = admin.role?.name || 'Super Admin';
        }
      } else {
        const user = await prisma.user.findUnique({ where: { userId: customer.createdBy }, select: { username: true, role: { select: { name: true } } } });
        if (user) {
          createdUserName = user.username;
          createdUserRole = user.role?.name || 'User';
        }
      }
    }

    // Resolve names for editHistory
    let enrichedEditHistory: any[] = [];
    if (Array.isArray((customer as any).editHistory)) {
      enrichedEditHistory = await Promise.all((customer as any).editHistory.map(async (edit: any) => {
        let name = "Unknown User";
        if (edit.updatedBy) {
          if (edit.updatedBy.startsWith('admin_')) {
            const adminId = BigInt(edit.updatedBy.replace('admin_', ''));
            const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { username: true } });
            if (admin) name = admin.username;
          } else {
            const user = await prisma.user.findUnique({ where: { userId: edit.updatedBy }, select: { username: true } });
            if (user) name = user.username;
          }
        }
        return { ...edit, updatedByName: name };
      }));
    }

    let netBalance = 0;
    try {
      const { receivableService } = require("../accounts/receivable.service");
      const summaries = await receivableService.getReceivableSummaries({ customerId: customer.id });
      if (summaries && summaries.length > 0) {
        netBalance = summaries[0].netBalance;
      } else {
        const opBal = Number(customer.openingBalance || 0);
        const opType = ((customer as any).openingBalanceType || "DEBIT").toUpperCase();
        netBalance = opType === "CREDIT" ? -Math.abs(opBal) : Math.abs(opBal);
      }
    } catch (e) {
      const opBal = Number(customer.openingBalance || 0);
      const opType = ((customer as any).openingBalanceType || "DEBIT").toUpperCase();
      netBalance = opType === "CREDIT" ? -Math.abs(opBal) : Math.abs(opBal);
    }

    const balanceAmount = Math.abs(netBalance);
    const balanceType = netBalance > 0 ? "Dr" : netBalance < 0 ? "Cr" : "";

    // Check if customer has real transactions (beyond the opening balance voucher)
    const customerLedger = await prisma.accountLedger.findUnique({
      where: { customerId: id },
      include: { debitItems: { include: { voucher: true } }, creditItems: { include: { voucher: true } } },
    });
    const allJournalItems = [...(customerLedger?.debitItems || []), ...(customerLedger?.creditItems || [])];
    const hasTransactions = allJournalItems.some(
      (item: any) => item.voucher?.refDocType !== "CUSTOMER_OPENING_BALANCE"
    );

    // Derive last purchase / payment dates from ledger
    const { lastPurchaseDate, lastPaymentDate } = await this.getCustomerLedgerDates(id);

    return {
      ...customer,
      createdUserName,
      createdUserRole,
      netBalance,
      balanceAmount,
      balanceType,
      hasTransactions,
      lastPurchaseDate,
      lastPaymentDate,
      editHistory: enrichedEditHistory,
    };
  }

  async updateCustomer(
    id: string,
    data: UpdateCustomerInput,
    userId?: string
  ) {
    const customer = await this.getCustomerById(id);

    if (data.customerCode) {
      const existingCustomer =
        await prisma.customer.findFirst({
          where: {
            companyId: customer.companyId,

            customerCode:
              data.customerCode,

            id: {
              not: id,
            },
          },
        });

      if (existingCustomer) {
        throw new ApiError(
          409,
          "Customer code already exists for this company"
        );
      }
    }

    const { phones, addresses, openingBalance, openingBalanceType, ...restData } = data as any;
    const mobileData = phones !== undefined ? phones : restData.mobile;

    // Handle opening balance update — only if customer has no real transactions
    const wantsOpeningBalanceUpdate = openingBalance !== undefined || openingBalanceType !== undefined;
    if (wantsOpeningBalanceUpdate && customer.hasTransactions) {
      throw new ApiError(400, "Cannot update opening balance — customer has existing transactions");
    }

    // Handle edit history
    let newEditHistory: any[] = [];
    if (Array.isArray(customer.editHistory)) {
      newEditHistory = [...customer.editHistory];
    }

    // Attempt to get name from userId for history, if it's available in frontend or backend easily.
    // Given the complexity of resolving user names mid-update in this service,
    // we'll store the ID here. The `getCustomerById` already resolves this for the `createdBy` field,
    // we can either resolve the `updatedBy` here or let the frontend display the ID for now.
    // For now we'll just store the userId and timestamp.
    if (userId) {
      newEditHistory.push({
        updatedBy: userId,
        updatedAt: new Date().toISOString()
      });
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...restData,
        ...(mobileData !== undefined && { mobile: mobileData as any }),
        ...(wantsOpeningBalanceUpdate && {
          openingBalance: openingBalance ?? Number(customer.openingBalance ?? 0),
          openingBalanceType: openingBalanceType ?? customer.openingBalanceType ?? "DEBIT",
          outstandingAmount: openingBalance ?? Number(customer.openingBalance ?? 0),
        }),
        editHistory: newEditHistory,
        updatedBy: userId,

        ...(addresses && {
          addresses: {
            deleteMany: {},
            create: addresses.map((addr: any, index: number) => {
              const { _label, ...cleanAddr } = addr;
              return {
                address: cleanAddr,
                is_default: index === 0,
                label: _label || `Address ${index + 1}`,
                state_code: addr.state.toLowerCase(),
              };
            })
          }
        })
      },
      include: { addresses: true, customerType: true, customerGrade: true },
    });

    // Re-post opening balance voucher if opening balance was changed
    if (wantsOpeningBalanceUpdate) {
      // Delete old opening balance voucher
      try {
        await prisma.voucher.deleteMany({
          where: { refDocType: "CUSTOMER_OPENING_BALANCE", refDocId: id },
        });
      } catch { /* no existing voucher — that's fine */ }

      // Post new voucher with updated amount
      const newBalance = openingBalance ?? Number(customer.openingBalance ?? 0);
      if (newBalance > 0) {
        const newType = ((openingBalanceType ?? customer.openingBalanceType ?? "DEBIT") as string).toUpperCase() as "DEBIT" | "CREDIT";
        await voucherPostingService.postCustomerOpeningBalanceVoucher(
          { id: updated.id, customerCode: updated.customerCode, firmName: updated.firmName },
          newBalance,
          newType
        );
      }
    }

    // Update customer ledger name
    try {
      const ledgerName = updated.firmName || updated.displayName || updated.customerCode;
      await prisma.accountLedger.updateMany({
        where: { customerId: id },
        data: { name: ledgerName },
      });
    } catch (err) {
      console.error("Failed to update customer ledger name:", err);
    }

    await logAudit("Customer", updated.customerCode, "UPDATE", userId, updated.firmName);

    return updated;
  }

  async deleteCustomer(id: string, userId?: string) {
    const customer = await this.getCustomerById(id);

    // Check all dependent records
    const [linkedOrders, linkedInvoices, linkedReturns, linkedLedger] = await Promise.all([
      prisma.salesOrder.count({ where: { customerId: id } }),
      prisma.salesInvoice.count({ where: { customerId: id } }),
      prisma.salesReturn.count({ where: { customerId: id } }),
      prisma.accountLedger.findUnique({
        where: { customerId: id },
        include: {
          debitItems: { include: { voucher: { select: { id: true, refDocType: true } } } },
          creditItems: { include: { voucher: { select: { id: true, refDocType: true } } } },
        },
      }),
    ]);

    // Separate opening-balance-only journal entries from real transactions
    const allJournalItems = [
      ...(linkedLedger?.debitItems ?? []),
      ...(linkedLedger?.creditItems ?? []),
    ];
    const realJournalItems = allJournalItems.filter(
      (item) => item.voucher?.refDocType !== "CUSTOMER_OPENING_BALANCE"
    );
    const openingBalanceVoucherIds = [
      ...new Set(
        allJournalItems
          .filter((item) => item.voucher?.refDocType === "CUSTOMER_OPENING_BALANCE")
          .map((item) => item.voucher!.id)
      ),
    ];

    // Block delete if real transactions exist (orders, invoices, returns, real journal entries)
    if (linkedOrders > 0 || linkedInvoices > 0 || linkedReturns > 0 || realJournalItems.length > 0) {
      throw new ApiError(
        409,
        `Cannot delete customer — ${linkedOrders} sales order(s), ${linkedInvoices} sales invoice(s), ${linkedReturns} sales return(s), and ${realJournalItems.length} real journal entry/entries are linked to this customer`
      );
    }

    // Safe to delete — first clean up the auto-generated opening balance voucher(s) and ledger
    if (openingBalanceVoucherIds.length > 0) {
      // Delete journal items linked to opening balance vouchers
      await prisma.journalItem.deleteMany({
        where: { voucherId: { in: openingBalanceVoucherIds } },
      });
      // Delete the opening balance vouchers themselves
      await prisma.voucher.deleteMany({
        where: { id: { in: openingBalanceVoucherIds } },
      });
    }

    // Delete the account ledger for this customer (if any)
    if (linkedLedger) {
      await prisma.accountLedger.delete({ where: { id: linkedLedger.id } });
    }

    // Delete customer addresses
    await prisma.customerAddress.deleteMany({ where: { customerId: id } });

    const result = await executeDeleteWithValidation(
      () => prisma.customer.delete({ where: { id } }),
      "Customer"
    );

    await logAudit("Customer", customer.customerCode, "DELETE", userId, customer.firmName);

    return result;
  }
}

export default new CustomerService();