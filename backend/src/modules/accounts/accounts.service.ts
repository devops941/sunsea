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
    grouped?: boolean;
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

    // Optional pre-grouped output for sidebar tree views
    let grouped: Array<{ group: string; ledgers: typeof ledgers }> | null = null;
    if (params.grouped) {
      const buckets: Record<string, typeof ledgers> = {};
      for (const l of ledgers) {
        const g = l.group || "Others";
        if (!buckets[g]) buckets[g] = [];
        buckets[g].push(l);
      }
      grouped = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, groupLedgers]) => ({
          group,
          ledgers: [...groupLedgers].sort((a, b) => a.name.localeCompare(b.name)),
        }));
    }

    return {
      ledgers,
      grouped,
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

  async getLedgerStatement(id: number, options: { startDate?: string; endDate?: string; search?: string }) {
    try {
      const { voucherPostingService } = require("./voucherPosting.service");
      await voucherPostingService.syncUnpostedVouchers();
    } catch (err) {
      console.error("[AccountsService] Sync unposted vouchers failed:", err);
    }

    const ledger = await this.getLedgerById(id);

    // Aggregate expansion — if this ledger is a standard "Sundry Debtors" or
    // "Sundry Creditors" parent, expand to include ALL child party ledgers so
    // the statement shows combined activity from every customer/supplier.
    const { AGGREGATE_LEDGER_CODES, expandAggregateLedger } = require("./standardLedgers");
    if (AGGREGATE_LEDGER_CODES.has(ledger.code)) {
      const expansion = await expandAggregateLedger(ledger, prisma);
      const multi = await this.getMultiLedgerStatement(expansion.ledgerIds, {
        ...options,
        label: expansion.label,
      });
      // Return with the parent ledger attached so the frontend "One Account" mode
      // still recognises the response and renders the same UI.
      return { ...multi, ledger, mode: "one" as const };
    }

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
          // BUG FIX (Ledger Statement Integrity):
          // Exclude opening balance vouchers — they are already represented by the
          // synthetic "Opening Balance b/f" row built from party.openingBalance field.
          // Including them here causes the running balance to be doubled.
          //
          // IMPORTANT: A bare `refDocType: { notIn: [...] }` filter unintentionally
          // excludes vouchers with `refDocType = NULL` because in SQL/Prisma
          // `NULL NOT IN (...)` evaluates to NULL (i.e. "not TRUE"), so the row is
          // filtered out. All manually-created vouchers (e.g. Payment Voucher created
          // from the UI via POST /vouchers) have `refDocType = NULL`, which caused
          // them to be silently missing from the Supplier/Customer Ledger Statement
          // — while still being counted in Amount Payable / Receivable summaries
          // (which query journal items without this filter). Result: payment appeared
          // in Payable page but NOT in the supplier's ledger statement.
          //
          // Fix: explicitly allow NULL refDocType through by combining with an OR clause.
          OR: [
            { refDocType: null },
            { refDocType: { notIn: ["SUPPLIER_OPENING_BALANCE", "CUSTOMER_OPENING_BALANCE"] } },
          ],
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

    // Apply server-side search filter on entries
    let filteredEntries = entries;
    if (options.search && options.search.trim()) {
      const q = options.search.toLowerCase();
      filteredEntries = entries.filter(
        (e) =>
          (e.voucherNo || "").toString().toLowerCase().includes(q) ||
          (e.particulars || "").toString().toLowerCase().includes(q) ||
          (e.narration || "").toString().toLowerCase().includes(q) ||
          (e.voucherType || "").toString().toLowerCase().includes(q)
      );
    }

    return {
      ledger,
      mode: "one" as const,
      startDate: options.startDate || null,
      endDate: options.endDate || null,
      openingBalance,
      closingBalance: runningBalance,
      entries: filteredEntries,
    };
  }

  /**
   * Combined ledger statement for multiple ledgers.
   * Used by Busy-style "All Accounts", "Group of Accounts", "Selected Accounts" modes.
   * Returns a chronologically-merged voucher list with a single running balance
   * (net across all selected ledgers, treating Asset+Expense = Dr side).
   */
  async getMultiLedgerStatement(
    ids: number[],
    options: { startDate?: string; endDate?: string; search?: string; label?: string }
  ) {
    if (!ids || ids.length === 0) {
      throw new ApiError(400, "At least one ledger id is required");
    }

    try {
      const { voucherPostingService } = require("./voucherPosting.service");
      await voucherPostingService.syncUnpostedVouchers();
    } catch (err) {
      console.error("[AccountsService] Sync unposted vouchers failed:", err);
    }

    const ledgers = await prisma.accountLedger.findMany({
      where: { id: { in: ids } },
      include: { customer: true, supplier: true },
    });
    if (ledgers.length === 0) {
      throw new ApiError(404, "No matching ledgers found");
    }

    const dateFilter: Prisma.VoucherWhereInput = {};
    if (options.startDate || options.endDate) {
      dateFilter.date = {
        ...(options.startDate && { gte: new Date(options.startDate) }),
        ...(options.endDate && { lte: new Date(options.endDate) }),
      };
    }

    const journalItems = await prisma.journalItem.findMany({
      where: {
        OR: [
          { debitLedgerId: { in: ids } },
          { creditLedgerId: { in: ids } },
        ],
        voucher: {
          ...dateFilter,
          OR: [
            { refDocType: null },
            { refDocType: { notIn: ["SUPPLIER_OPENING_BALANCE", "CUSTOMER_OPENING_BALANCE"] } },
          ],
        },
      },
      include: {
        voucher: true,
        debitLedger: { select: { id: true, name: true, code: true, type: true } },
        creditLedger: { select: { id: true, name: true, code: true, type: true } },
      },
      orderBy: [{ voucher: { date: "asc" } }, { voucher: { id: "asc" } }],
    });

    // Aggregate opening balance from party ledgers.
    //
    // IMPORTANT SIGN CONVENTION:
    // Each subsequent journal item updates `runningBalance` using ITS OWN
    // ledger-type formula:  Asset/Expense → debit − credit, Liability/Income/Equity → credit − debit.
    // Both formulas produce a POSITIVE number when the balance grows in the
    // ledger's natural direction (asset debit grows / liability credit grows).
    //
    // Therefore the opening must also be added in its NATURAL direction — i.e.
    // as a plain positive number — otherwise the initial balance would go into
    // the aggregate "backwards" and every subsequent purchase (which correctly
    // adds +credit for a supplier liability) would then look like the opening
    // was being CANCELLED OUT.  The earlier `-opening` for non-asset ledgers
    // was the bug the user reported: opening ₹2,000 for a supplier appeared as
    // −₹2,000 in Sundry Creditors, then a ₹110 purchase moved it to −₹1,890
    // instead of the correct ₹2,110.
    let openingBalance = 0;
    let hasLiability = false;
    let hasAsset = false;
    for (const ledger of ledgers) {
      let opening = 0;
      if (ledger.customer) opening = Number((ledger.customer as any).openingBalance || 0);
      else if (ledger.supplier) opening = Number((ledger.supplier as any).openingBalance || 0);
      openingBalance += opening;
      if (ledger.type === LedgerType.LIABILITY || ledger.type === LedgerType.INCOME || ledger.type === LedgerType.EQUITY) hasLiability = true;
      if (ledger.type === LedgerType.ASSET || ledger.type === LedgerType.EXPENSE) hasAsset = true;
    }

    // Choose which side to render the opening row on. If every party ledger is
    // a credit-natural type (all suppliers / Sundry Creditors), render as credit.
    // Otherwise (all customers / Sundry Debtors, or mixed), render as debit.
    const openingIsCredit = hasLiability && !hasAsset;

    const selectedIds = new Set(ids);
    let runningBalance = openingBalance;
    const entries: any[] = [];

    if (Math.abs(openingBalance) > 0.01) {
      entries.push({
        id: `opening-multi`,
        voucherNo: "-",
        voucherType: "OPENING",
        date: options.startDate || (journalItems.length > 0 ? journalItems[0].voucher.date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0]),
        narration: "Combined Opening Balance",
        particulars: `Opening Balance (${ids.length} accounts)`,
        debit: openingIsCredit ? 0 : openingBalance,
        credit: openingIsCredit ? openingBalance : 0,
        runningBalance: openingBalance,
      });
    }

    for (const item of journalItems) {
      const isSelectedDebit = item.debitLedgerId && selectedIds.has(item.debitLedgerId);
      const isSelectedCredit = item.creditLedgerId && selectedIds.has(item.creditLedgerId);
      // If both sides are within the selected set, the entry is internal — skip
      if (isSelectedDebit && isSelectedCredit) continue;

      const rawDebit = Number(item.debitAmount);
      const rawCredit = Number(item.creditAmount);
      const amt = rawDebit > 0 ? rawDebit : rawCredit > 0 ? rawCredit : 0;

      // Determine which side of the selected set the entry falls on
      const selectedLedger = isSelectedDebit ? item.debitLedger : item.creditLedger;
      const opposingLedger = isSelectedDebit ? item.creditLedger : item.debitLedger;
      const isAssetOrExpense = selectedLedger?.type === LedgerType.ASSET || selectedLedger?.type === LedgerType.EXPENSE;

      const debit = isSelectedDebit ? amt : 0;
      const credit = isSelectedCredit ? amt : 0;

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
        particulars: opposingLedger?.name || (isSelectedDebit ? "Debit Entry" : "Credit Entry"),
        accountName: selectedLedger?.name || "-",
        debit,
        credit,
        runningBalance,
      });
    }

    // Search filter
    let filteredEntries = entries;
    if (options.search && options.search.trim()) {
      const q = options.search.toLowerCase();
      filteredEntries = entries.filter(
        (e) =>
          (e.voucherNo || "").toString().toLowerCase().includes(q) ||
          (e.particulars || "").toString().toLowerCase().includes(q) ||
          (e.accountName || "").toString().toLowerCase().includes(q) ||
          (e.narration || "").toString().toLowerCase().includes(q) ||
          (e.voucherType || "").toString().toLowerCase().includes(q)
      );
    }

    return {
      mode: "multi" as const,
      label: options.label || `${ledgers.length} accounts`,
      ledgerIds: ids,
      ledgerCount: ledgers.length,
      startDate: options.startDate || null,
      endDate: options.endDate || null,
      openingBalance,
      closingBalance: runningBalance,
      entries: filteredEntries,
    };
  }

  async getTrialBalance(options: {
    asOnDate?: string;
    showZeroBalance?: boolean;
    sortBy?: "name" | "code";
    groupByCategory?: boolean;
  } = {}) {
    await this.ensureSystemLedgersExist();

    const { voucherPostingService } = require("./voucherPosting.service");
    await voucherPostingService.syncMissingOpeningBalanceVouchers();

    const asOnDate = options.asOnDate ? new Date(options.asOnDate) : null;
    if (asOnDate) asOnDate.setHours(23, 59, 59, 999);
    const voucherDateFilter = asOnDate ? { voucher: { date: { lte: asOnDate } } } : undefined;

    const ledgers = await prisma.accountLedger.findMany({
      include: {
        debitItems: { where: voucherDateFilter, include: { voucher: true } },
        creditItems: { where: voucherDateFilter, include: { voucher: true } },
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

    // Apply showZeroBalance filter (default: hide zero balance)
    let activeRows = options.showZeroBalance
      ? rows
      : rows.filter((r) => r.debitBalance > 0 || r.creditBalance > 0);

    // Apply sort
    const sortBy = options.sortBy || "code";
    activeRows = [...activeRows].sort((a, b) =>
      sortBy === "name" ? a.name.localeCompare(b.name) : a.code.localeCompare(b.code)
    );

    // Optional pre-grouped structure for hierarchical/grouped views
    let grouped: Array<{ group: string; rows: typeof activeRows; groupDebit: number; groupCredit: number }> | null = null;
    if (options.groupByCategory) {
      const buckets: Record<string, typeof activeRows> = {};
      for (const r of activeRows) {
        const g = r.group || "Others";
        if (!buckets[g]) buckets[g] = [];
        buckets[g].push(r);
      }
      grouped = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, groupRows]) => ({
          group,
          rows: groupRows,
          groupDebit: groupRows.reduce((s, r) => s + r.debitBalance, 0),
          groupCredit: groupRows.reduce((s, r) => s + r.creditBalance, 0),
        }));
    }

    const totalDebitBalance = activeRows.reduce((sum, r) => sum + r.debitBalance, 0);
    const totalCreditBalance = activeRows.reduce((sum, r) => sum + r.creditBalance, 0);

    return {
      rows: activeRows,
      grouped,
      totalDebitBalance,
      totalCreditBalance,
      isBalanced: Math.abs(totalDebitBalance - totalCreditBalance) < 0.01,
    };
  }

  async getBalanceSheet(options: {
    asOnDate?: string;
    showZeroBalance?: boolean;
    groupByCategory?: boolean;
  } = {}) {
    // Always request full data from trial balance (no filtering there); we do our own here
    const trialBalance = await this.getTrialBalance({ asOnDate: options.asOnDate, showZeroBalance: true });

    let assets: any[] = [];
    let liabilities: any[] = [];
    let equity: any[] = [];

    for (const row of trialBalance.rows) {
      const item = { code: row.code, name: row.name, group: row.group, balance: row.closingBalance };
      if (row.type === "ASSET") assets.push(item);
      else if (row.type === "LIABILITY") liabilities.push(item);
      else if (row.type === "EQUITY") equity.push(item);
    }

    // Get P&L net profit up to asOnDate and add to equity
    const pnl = await this.getProfitAndLoss({ endDate: options.asOnDate });
    if (pnl.netProfit !== 0) {
      equity.push({ code: "NET-PNL", name: "Net Profit / (Loss)", group: "Profit & Loss", balance: pnl.netProfit });
    }

    // Apply zero balance filter (default: hide)
    if (!options.showZeroBalance) {
      assets = assets.filter((i) => Math.abs(i.balance) > 0.01);
      liabilities = liabilities.filter((i) => Math.abs(i.balance) > 0.01);
      equity = equity.filter((i) => Math.abs(i.balance) > 0.01);
    }

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
    const totalEquity = equity.reduce((s, e) => s + e.balance, 0);

    // Optional pre-grouped structure
    const groupSection = (items: any[]) => {
      const buckets: Record<string, any[]> = {};
      items.forEach((it) => {
        const g = it.group || "Others";
        if (!buckets[g]) buckets[g] = [];
        buckets[g].push(it);
      });
      return Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, groupItems]) => ({
          group,
          items: groupItems,
          groupTotal: groupItems.reduce((s, i) => s + i.balance, 0),
        }));
    };

    return {
      assets,
      liabilities,
      equity,
      groupedAssets: options.groupByCategory ? groupSection(assets) : null,
      groupedLiabilities: options.groupByCategory ? groupSection(liabilities) : null,
      groupedEquity: options.groupByCategory ? groupSection(equity) : null,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  }

  async getProfitAndLoss(options: {
    startDate?: string;
    endDate?: string;
    showZeroBalance?: boolean;
  }) {
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

    // Apply zero balance filter
    const filteredIncome = options.showZeroBalance
      ? incomeAccounts
      : incomeAccounts.filter((a) => Math.abs(a.netAmount) > 0.01);
    const filteredExpense = options.showZeroBalance
      ? expenseAccounts
      : expenseAccounts.filter((a) => Math.abs(a.netAmount) > 0.01);

    const totalIncome = filteredIncome.reduce((sum, a) => sum + a.netAmount, 0);
    const totalExpense = filteredExpense.reduce((sum, a) => sum + a.netAmount, 0);
    const netProfit = totalIncome - totalExpense;

    return {
      startDate: options.startDate || null,
      endDate: options.endDate || null,
      incomeAccounts: filteredIncome,
      expenseAccounts: filteredExpense,
      totalIncome,
      totalExpense,
      netProfit,
      isProfit: netProfit >= 0,
    };
  }

  /**
   * Profit & Loss aggregated by month or quarter across the given date range.
   * Returns a period-column matrix — each account has a per-period net amount + total.
   */
  async getProfitAndLossByPeriod(options: {
    startDate: string;
    endDate: string;
    groupBy: "month" | "quarter";
  }) {
    await this.ensureSystemLedgersExist();

    const startDate = new Date(options.startDate);
    const endDate = new Date(options.endDate);
    endDate.setHours(23, 59, 59, 999);

    // Build the list of periods spanning the range
    const periods: Array<{ key: string; label: string; start: Date; end: Date }> = [];
    if (options.groupBy === "month") {
      let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      while (cursor <= last) {
        const y = cursor.getFullYear();
        const m = cursor.getMonth();
        const pStart = new Date(y, m, 1);
        const pEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
        periods.push({
          key: `${y}-${String(m + 1).padStart(2, "0")}`,
          label: cursor.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
          start: pStart,
          end: pEnd,
        });
        cursor = new Date(y, m + 1, 1);
      }
    } else {
      // Indian FY quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
      const quarterForMonth = (mo: number) => (mo >= 3 && mo <= 5 ? 1 : mo >= 6 && mo <= 8 ? 2 : mo >= 9 && mo <= 11 ? 3 : 4);
      const quarterStart = (q: number, fyYear: number) => {
        // fyYear = the calendar year of April 1 for that FY
        const monthMap = { 1: [3, fyYear], 2: [6, fyYear], 3: [9, fyYear], 4: [0, fyYear + 1] } as const;
        const [mo, y] = monthMap[q as 1 | 2 | 3 | 4];
        return new Date(y, mo, 1);
      };
      const quarterEnd = (q: number, fyYear: number) => {
        const monthMap = { 1: [5, fyYear], 2: [8, fyYear], 3: [11, fyYear], 4: [2, fyYear + 1] } as const;
        const [mo, y] = monthMap[q as 1 | 2 | 3 | 4];
        return new Date(y, mo + 1, 0, 23, 59, 59, 999);
      };
      const fyOf = (d: Date) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);

      let curFy = fyOf(startDate);
      let curQ = quarterForMonth(startDate.getMonth());
      const endFy = fyOf(endDate);
      const endQ = quarterForMonth(endDate.getMonth());

      while (curFy < endFy || (curFy === endFy && curQ <= endQ)) {
        const pStart = quarterStart(curQ, curFy);
        const pEnd = quarterEnd(curQ, curFy);
        periods.push({
          key: `${curFy}-Q${curQ}`,
          label: `Q${curQ} ${String(curFy).slice(-2)}-${String(curFy + 1).slice(-2)}`,
          start: pStart,
          end: pEnd,
        });
        if (curQ === 4) { curFy++; curQ = 1; } else { curQ++; }
      }
    }

    const dateFilter: Prisma.VoucherWhereInput = {
      date: { gte: startDate, lte: endDate },
    };

    const ledgers = await prisma.accountLedger.findMany({
      where: { type: { in: [LedgerType.INCOME, LedgerType.EXPENSE] } },
      include: {
        debitItems: {
          where: { voucher: dateFilter },
          include: { voucher: { select: { date: true } } },
        },
        creditItems: {
          where: { voucher: dateFilter },
          include: { voucher: { select: { date: true } } },
        },
      },
      orderBy: { code: "asc" },
    });

    const findPeriodIndex = (date: Date) => periods.findIndex((p) => date >= p.start && date <= p.end);

    const buildAccount = (ledger: (typeof ledgers)[number]) => {
      const perPeriod = new Array(periods.length).fill(0);
      for (const item of ledger.debitItems) {
        const idx = findPeriodIndex(item.voucher.date);
        if (idx < 0) continue;
        // For INCOME accounts, a debit reduces income; for EXPENSE, debit increases expense
        const delta = ledger.type === LedgerType.INCOME ? -Number(item.debitAmount) : Number(item.debitAmount);
        perPeriod[idx] += delta;
      }
      for (const item of ledger.creditItems) {
        const idx = findPeriodIndex(item.voucher.date);
        if (idx < 0) continue;
        const delta = ledger.type === LedgerType.INCOME ? Number(item.creditAmount) : -Number(item.creditAmount);
        perPeriod[idx] += delta;
      }
      const total = perPeriod.reduce((s, v) => s + v, 0);
      return {
        ledgerId: ledger.id,
        code: ledger.code,
        name: ledger.name,
        group: ledger.group,
        perPeriod,
        total,
      };
    };

    const incomeAccounts: any[] = [];
    const expenseAccounts: any[] = [];
    for (const ledger of ledgers) {
      const acc = buildAccount(ledger);
      // Skip accounts with no activity in the range
      if (Math.abs(acc.total) < 0.01 && acc.perPeriod.every((v: number) => Math.abs(v) < 0.01)) continue;
      if (ledger.type === LedgerType.INCOME) incomeAccounts.push(acc);
      else expenseAccounts.push(acc);
    }

    const totalIncomePerPeriod = periods.map((_, i) =>
      incomeAccounts.reduce((s, a) => s + a.perPeriod[i], 0)
    );
    const totalExpensePerPeriod = periods.map((_, i) =>
      expenseAccounts.reduce((s, a) => s + a.perPeriod[i], 0)
    );
    const netPerPeriod = periods.map((_, i) => totalIncomePerPeriod[i] - totalExpensePerPeriod[i]);

    const totalIncome = totalIncomePerPeriod.reduce((s, v) => s + v, 0);
    const totalExpense = totalExpensePerPeriod.reduce((s, v) => s + v, 0);
    const netProfit = totalIncome - totalExpense;

    return {
      groupBy: options.groupBy,
      startDate: options.startDate,
      endDate: options.endDate,
      periods: periods.map((p) => ({ key: p.key, label: p.label })),
      incomeAccounts,
      expenseAccounts,
      totalIncomePerPeriod,
      totalExpensePerPeriod,
      netPerPeriod,
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
