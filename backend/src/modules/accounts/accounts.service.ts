import { prisma } from "../../config/prisma";
import { LedgerType, VoucherType, Prisma } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { CreateLedgerInput, UpdateLedgerInput } from "./accounts.types";

/**
 * Default seed ledgers — created once when the DB has zero ledger rows.
 * After initial seeding, all ledger management happens through the UI.
 * The auto-posting system looks up ledgers from DB by code at runtime.
 */
const DEFAULT_SEED_LEDGERS = [
  { code: "CASH-001", name: "Cash in Hand", type: LedgerType.ASSET, group: "Cash & Bank" },
  { code: "BANK-001", name: "Main Bank Account", type: LedgerType.ASSET, group: "Cash & Bank" },
  { code: "CRED-001", name: "Sundry Creditors", type: LedgerType.LIABILITY, group: "Current Liabilities" },
  { code: "DEBT-001", name: "Sundry Debtors", type: LedgerType.ASSET, group: "Current Assets" },
  { code: "PURCH-001", name: "Purchase Account", type: LedgerType.EXPENSE, group: "Direct Expenses" },
  { code: "SALES-001", name: "Sales Account", type: LedgerType.INCOME, group: "Direct Income" },
  { code: "EXP-001", name: "General Expenses", type: LedgerType.EXPENSE, group: "Indirect Expenses" },
  { code: "PCASH-001", name: "Petty Cash Account", type: LedgerType.ASSET, group: "Cash & Bank" },
  { code: "SRT-001", name: "Sales Return Account", type: LedgerType.INCOME, group: "Direct Income" },
  { code: "PRT-001", name: "Purchase Return Account", type: LedgerType.EXPENSE, group: "Direct Expenses" },
  { code: "CGST-LIA-001", name: "CGST Payable", type: LedgerType.LIABILITY, group: "Tax Liabilities" },
  { code: "SGST-LIA-001", name: "SGST Payable", type: LedgerType.LIABILITY, group: "Tax Liabilities" },
  { code: "IGST-LIA-001", name: "IGST Payable", type: LedgerType.LIABILITY, group: "Tax Liabilities" },
  { code: "CGST-REC-001", name: "CGST Input Credit", type: LedgerType.ASSET, group: "Tax Assets" },
  { code: "SGST-REC-001", name: "SGST Input Credit", type: LedgerType.ASSET, group: "Tax Assets" },
  { code: "IGST-REC-001", name: "IGST Input Credit", type: LedgerType.ASSET, group: "Tax Assets" },
  { code: "EQ-001", name: "Opening Balance Equity", type: LedgerType.EQUITY, group: "Equity" },
];

class AccountsService {
  /**
   * Ensures system ledgers exist (PURCH-001, SALES-001, CASH-001, etc.).
   * Fast path: check all codes in ONE query; only upsert if any are missing.
   * Avoids per-ledger upserts (17 sequential queries) that timeout inside transactions.
   */
  async ensureSystemLedgersExist(txClient?: Prisma.TransactionClient) {
    const db = txClient || prisma;
    const codes = DEFAULT_SEED_LEDGERS.map((l) => l.code);
    const existing = await db.accountLedger.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((e) => e.code));
    if (existingCodes.size === codes.length) return; // All exist, fast exit

    const missing = DEFAULT_SEED_LEDGERS.filter((l) => !existingCodes.has(l.code));
    for (const ledger of missing) {
      await db.accountLedger.upsert({
        where: { code: ledger.code },
        update: {},
        create: {
          code: ledger.code,
          name: ledger.name,
          type: ledger.type,
          group: ledger.group,
          isActive: true,
        },
      });
    }
  }

  async getLedgers(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: LedgerType;
    group?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const countTotal = await prisma.accountLedger.count();
    if (countTotal === 0) {
      await this.ensureSystemLedgersExist();
    }

    const where: Prisma.AccountLedgerWhereInput = {
      ...(params.type && { type: params.type }),
      ...(params.group && { group: { equals: params.group, mode: "insensitive" } }),
      ...(params.search && {
        OR: [
          { code: { contains: params.search, mode: "insensitive" } },
          { name: { contains: params.search, mode: "insensitive" } },
          { group: { contains: params.search, mode: "insensitive" } },
        ],
      }),
    };

    const [ledgers, total] = await Promise.all([
      prisma.accountLedger.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { code: "asc" },
        include: {
          customer: { select: { id: true, firmName: true, customerCode: true } },
          supplier: { select: { id: true, legalName: true, supplierCode: true } },
        },
      }),
      prisma.accountLedger.count({ where }),
    ]);

    return {
      ledgers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBankAccounts() {
    const bankGroups = ["Cash & Bank", "Bank Accounts", "Cash in Hand", "BANK ACCOUNTS", "CASH IN HAND"];

    const ledgers = await prisma.accountLedger.findMany({
      where: {
        type: LedgerType.ASSET,
        group: { in: bankGroups, mode: "insensitive" },
        isActive: true,
      },
      orderBy: { name: "asc" },
    });

    const results = await Promise.all(
      ledgers.map(async (ledger) => {
        const debitSum = await prisma.journalItem.aggregate({
          _sum: { debitAmount: true },
          where: { debitLedgerId: ledger.id },
        });
        const creditSum = await prisma.journalItem.aggregate({
          _sum: { creditAmount: true },
          where: { creditLedgerId: ledger.id },
        });
        const totalDebit = Number(debitSum._sum.debitAmount || 0);
        const totalCredit = Number(creditSum._sum.creditAmount || 0);
        const currentBalance = totalDebit - totalCredit;

        return {
          id: ledger.id,
          code: ledger.code,
          name: ledger.name,
          group: ledger.group,
          currentBalance,
          totalDebit,
          totalCredit,
        };
      })
    );

    const totalBalance = results.reduce((sum, r) => sum + r.currentBalance, 0);
    return { accounts: results, totalBalance };
  }

  async createLedger(data: CreateLedgerInput) {
    const existing = await prisma.accountLedger.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ApiError(409, `Ledger with code '${data.code}' already exists`);
    }

    return prisma.accountLedger.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        group: data.group,
        isActive: data.isActive ?? true,
        customerId: data.customerId || null,
        supplierId: data.supplierId || null,
      },
    });
  }

  async updateLedger(id: number, data: UpdateLedgerInput) {
    const existing = await prisma.accountLedger.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError(404, "Account ledger not found");
    }

    return prisma.accountLedger.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.type && { type: data.type }),
        ...(data.group && { group: data.group }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async getLedgerById(id: number) {
    const ledger = await prisma.accountLedger.findUnique({
      where: { id },
      include: {
        customer: true,
        supplier: true,
      },
    });

    if (!ledger) {
      throw new ApiError(404, "Account ledger not found");
    }

    return ledger;
  }

  async getLedgerStatement(id: number, options: { startDate?: string; endDate?: string }) {
    try {
      const { voucherPostingService } = require("./voucherPosting.service");
      await voucherPostingService.syncUnpostedVouchers();
    } catch (err) {
      console.error("[AccountsService] Sync unposted vouchers failed:", err);
    }

    const ledger = await this.getLedgerById(id);

    const dateFilter: Prisma.VoucherWhereInput = {};
    if (options.startDate || options.endDate) {
      dateFilter.date = {
        ...(options.startDate && { gte: new Date(options.startDate) }),
        ...(options.endDate && { lte: new Date(options.endDate) }),
      };
    }

    const journalItems = await prisma.journalItem.findMany({
      where: {
        OR: [{ debitLedgerId: id }, { creditLedgerId: id }],
        voucher: {
          ...dateFilter,
          // Exclude opening balance vouchers — they are already represented by the
          // synthetic "Opening Balance b/f" row built from party.openingBalance field.
          // Including them here causes the running balance to be doubled.
          refDocType: {
            notIn: ["SUPPLIER_OPENING_BALANCE", "CUSTOMER_OPENING_BALANCE"],
          },
        },
      },
      include: {
        voucher: true,
        debitLedger: { select: { id: true, name: true, code: true } },
        creditLedger: { select: { id: true, name: true, code: true } },
      },
      orderBy: [
        { voucher: { date: "asc" } },
        { voucher: { id: "asc" } },
      ],
    });

    const isAssetOrExpense = ledger.type === LedgerType.ASSET || ledger.type === LedgerType.EXPENSE;
    let openingBalance = 0;
    if (ledger.customer) {
      openingBalance = Number((ledger.customer as any).openingBalance || 0);
    } else if (ledger.supplier) {
      openingBalance = Number((ledger.supplier as any).openingBalance || 0);
    }

    let runningBalance = openingBalance;
    const entries: any[] = [];

    if (openingBalance !== 0) {
      entries.push({
        id: `opening-${ledger.id}`,
        voucherNo: "-",
        voucherType: "OPENING",
        date: options.startDate || (journalItems.length > 0 ? journalItems[0].voucher.date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0]),
        narration: "Opening Balance b/f",
        particulars: "Opening Balance",
        debit: isAssetOrExpense ? openingBalance : 0,
        credit: !isAssetOrExpense ? openingBalance : 0,
        runningBalance: openingBalance,
      });
    }

    const getParticularsLabel = (item: any, isDebit: boolean): string => {
      const vType = item.voucher?.type;
      if (vType === VoucherType.SALES_RETURN) return "Sales Return";
      if (vType === VoucherType.PURCHASE_RETURN) return "Purchase Return";

      const opposingName = isDebit ? item.creditLedger?.name : item.debitLedger?.name;

      if (
        opposingName &&
        opposingName !== "Credit Account" &&
        opposingName !== "Debit Account" &&
        opposingName !== "General Ledger" &&
        opposingName !== ledger.name
      ) {
        return opposingName;
      }

      switch (vType) {
        case VoucherType.SALES:
          return "Sales Invoice";
        case VoucherType.RECEIPT:
          return "Receipt";
        case VoucherType.PURCHASE:
          return "Purchase Invoice";
        case VoucherType.PAYMENT:
          return "Payment";
        case VoucherType.EXPENSE:
          return "Expense Voucher";
        default:
          return isDebit ? "Debit Entry" : "Credit Entry";
      }
    };

    for (const item of journalItems) {
      let isDebit = item.debitLedgerId === id;
      const rawDebit = Number(item.debitAmount);
      const rawCredit = Number(item.creditAmount);
      const amt = rawDebit > 0 ? rawDebit : (rawCredit > 0 ? rawCredit : 0);

      // Force correct double-entry direction for Return Vouchers if party ledger was misattached
      if (item.voucher?.type === VoucherType.SALES_RETURN && ledger.customerId) {
        isDebit = false; // Always CREDIT Customer Ledger on Sales Return
      } else if (item.voucher?.type === VoucherType.PURCHASE_RETURN && ledger.supplierId) {
        isDebit = true; // Always DEBIT Supplier Ledger on Purchase Return
      }

      const debit = isDebit ? amt : 0;
      const credit = !isDebit ? amt : 0;

      if (isAssetOrExpense) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      entries.push({
        id: item.id.toString(),
        voucherNo: item.voucher.voucherNo,
        voucherType: item.voucher.type,
        refDocType: item.voucher.refDocType,
        date: item.voucher.date.toISOString().split("T")[0],
        narration: item.narration || item.voucher.narration || "",
        particulars: getParticularsLabel(item, isDebit),
        debit,
        credit,
        runningBalance,
      });
    }

    return {
      ledger,
      startDate: options.startDate || null,
      endDate: options.endDate || null,
      openingBalance,
      closingBalance: runningBalance,
      entries,
    };
  }

  async getTrialBalance() {
    await this.ensureSystemLedgersExist();

    const { voucherPostingService } = require("./voucherPosting.service");
    await voucherPostingService.syncMissingOpeningBalanceVouchers();

    const ledgers = await prisma.accountLedger.findMany({
      include: {
        debitItems: { include: { voucher: true } },
        creditItems: { include: { voucher: true } },
        customer: { select: { openingBalance: true } },
        supplier: { select: { openingBalance: true } },
      },
      orderBy: { code: "asc" },
    });

    const rows = ledgers.map((ledger) => {
      const isAssetOrExpense = ledger.type === LedgerType.ASSET || ledger.type === LedgerType.EXPENSE;

      const totalDebit = ledger.debitItems.reduce((sum, item) => sum + Number(item.debitAmount), 0);
      const totalCredit = ledger.creditItems.reduce((sum, item) => sum + Number(item.creditAmount), 0);

      const openingBalance = Number(
        (ledger.customer as any)?.openingBalance ||
        (ledger.supplier as any)?.openingBalance ||
        0
      );

      let closingBalance = 0;
      if (isAssetOrExpense) {
        closingBalance = totalDebit - totalCredit;
      } else {
        closingBalance = totalCredit - totalDebit;
      }

      return {
        ledgerId: ledger.id,
        code: ledger.code,
        name: ledger.name,
        type: ledger.type,
        group: ledger.group,
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance,
        debitBalance: isAssetOrExpense ? Math.max(0, closingBalance) : Math.max(0, -closingBalance),
        creditBalance: isAssetOrExpense ? Math.max(0, -closingBalance) : Math.max(0, closingBalance),
      };
    });

    const activeRows = rows.filter((r) => r.debitBalance > 0 || r.creditBalance > 0);
    const totalDebitBalance = activeRows.reduce((sum, r) => sum + r.debitBalance, 0);
    const totalCreditBalance = activeRows.reduce((sum, r) => sum + r.creditBalance, 0);

    return {
      rows: activeRows,
      totalDebitBalance,
      totalCreditBalance,
      isBalanced: Math.abs(totalDebitBalance - totalCreditBalance) < 0.01,
    };
  }

  async getBalanceSheet() {
    const trialBalance = await this.getTrialBalance();

    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];

    for (const row of trialBalance.rows) {
      const item = { code: row.code, name: row.name, group: row.group, balance: row.closingBalance };
      if (row.type === "ASSET") assets.push(item);
      else if (row.type === "LIABILITY") liabilities.push(item);
      else if (row.type === "EQUITY") equity.push(item);
    }

    // Get P&L net profit and add to equity
    const pnl = await this.getProfitAndLoss({});
    if (pnl.netProfit !== 0) {
      equity.push({ code: "NET-PNL", name: "Net Profit / (Loss)", group: "Profit & Loss", balance: pnl.netProfit });
    }

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
    const totalEquity = equity.reduce((s, e) => s + e.balance, 0);

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  }

  async getProfitAndLoss(options: { startDate?: string; endDate?: string }) {
    await this.ensureSystemLedgersExist();

    const dateFilter: Prisma.VoucherWhereInput = {};
    if (options.startDate || options.endDate) {
      dateFilter.date = {
        ...(options.startDate && { gte: new Date(options.startDate) }),
        ...(options.endDate && { lte: new Date(options.endDate) }),
      };
    }

    const ledgers = await prisma.accountLedger.findMany({
      where: { type: { in: [LedgerType.INCOME, LedgerType.EXPENSE] } },
      include: {
        debitItems: {
          where: Object.keys(dateFilter).length > 0 ? { voucher: dateFilter } : undefined,
          include: { voucher: true },
        },
        creditItems: {
          where: Object.keys(dateFilter).length > 0 ? { voucher: dateFilter } : undefined,
          include: { voucher: true },
        },
      },
      orderBy: { code: "asc" },
    });

    const incomeAccounts: any[] = [];
    const expenseAccounts: any[] = [];

    for (const ledger of ledgers) {
      const totalDebit = ledger.debitItems.reduce((sum, item) => sum + Number(item.debitAmount), 0);
      const totalCredit = ledger.creditItems.reduce((sum, item) => sum + Number(item.creditAmount), 0);

      const netAmount =
        ledger.type === LedgerType.INCOME ? totalCredit - totalDebit : totalDebit - totalCredit;

      const item = {
        ledgerId: ledger.id,
        code: ledger.code,
        name: ledger.name,
        group: ledger.group,
        totalDebit,
        totalCredit,
        netAmount,
      };

      if (ledger.type === LedgerType.INCOME) {
        incomeAccounts.push(item);
      } else {
        expenseAccounts.push(item);
      }
    }

    const totalIncome = incomeAccounts.reduce((sum, a) => sum + a.netAmount, 0);
    const totalExpense = expenseAccounts.reduce((sum, a) => sum + a.netAmount, 0);
    const netProfit = totalIncome - totalExpense;

    return {
      startDate: options.startDate || null,
      endDate: options.endDate || null,
      incomeAccounts,
      expenseAccounts,
      totalIncome,
      totalExpense,
      netProfit,
      isProfit: netProfit >= 0,
    };
  }

  /**
   * Shared party ledger creation helper for both Customers and Suppliers.
   * Prevents drift between customer and supplier Chart of Accounts registration paths.
   */
  async ensurePartyLedger(
    party: {
      type: "CUSTOMER" | "SUPPLIER";
      id: string | number;
      code: string;
      name: string;
    },
    txClient?: Prisma.TransactionClient
  ) {
    const db = txClient || prisma;
    const isCustomer = party.type === "CUSTOMER";

    const existing = await db.accountLedger.findUnique({
      where: isCustomer ? { customerId: String(party.id) } : { supplierId: Number(party.id) },
    });

    if (existing) return existing;

    const prefix = isCustomer ? "CUST" : "SUPP";
    const ledgerCode = `${prefix}-${party.code}`;
    const codeExists = await db.accountLedger.findUnique({ where: { code: ledgerCode } });
    const finalCode = codeExists ? `${prefix}-${party.code}-${Date.now().toString().slice(-4)}` : ledgerCode;

    return db.accountLedger.create({
      data: {
        code: finalCode,
        name: party.name,
        type: isCustomer ? LedgerType.ASSET : LedgerType.LIABILITY,
        group: isCustomer ? "Sundry Debtors" : "Sundry Creditors",
        customerId: isCustomer ? String(party.id) : null,
        supplierId: !isCustomer ? Number(party.id) : null,
      },
    });
  }

  async ensureCustomerLedger(customer: { id: string; customerCode: string; firmName: string }, txClient?: Prisma.TransactionClient) {
    return this.ensurePartyLedger({ type: "CUSTOMER", id: customer.id, code: customer.customerCode, name: customer.firmName }, txClient);
  }

  async ensureSupplierLedger(supplier: { id: number; supplierCode: string; legalName: string }, txClient?: Prisma.TransactionClient) {
    return this.ensurePartyLedger({ type: "SUPPLIER", id: supplier.id, code: supplier.supplierCode, name: supplier.legalName }, txClient);
  }
}

export const accountsService = new AccountsService();
