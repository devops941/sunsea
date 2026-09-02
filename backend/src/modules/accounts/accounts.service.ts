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
  { code: "CASH-001", name: "Cash in Hand", type: LedgerType.ASSET, group: "Cash in Hand" },
  { code: "BANK-001", name: "Main Bank Account", type: LedgerType.ASSET, group: "Bank Accounts" },
  { code: "CRED-001", name: "Sundry Creditors", type: LedgerType.LIABILITY, group: "Current Liabilities" },
  { code: "DEBT-001", name: "Sundry Debtors", type: LedgerType.ASSET, group: "Current Assets" },
  { code: "PURCH-001", name: "Purchase Account", type: LedgerType.EXPENSE, group: "Direct Expenses" },
  { code: "SALES-001", name: "Sales Account", type: LedgerType.INCOME, group: "Direct Income" },
  { code: "EXP-001", name: "General Expenses", type: LedgerType.EXPENSE, group: "Indirect Expenses" },
  { code: "PCASH-001", name: "Petty Cash Account", type: LedgerType.ASSET, group: "Cash in Hand" },
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
  // Once all system ledgers exist we never need to re-check the DB — they never
  // get deleted at runtime. Memoized flag avoids the findMany on every report load
  // that was contributing to Neon pool exhaustion (P2024).
  private static _systemLedgersReadyAt: number = 0;
  private static _inFlightSystemLedgerCheck: Promise<void> | null = null;
  private static readonly SYSTEM_LEDGERS_TTL_MS: number = 5 * 60_000; // 5 min

  /**
   * Ensures system ledgers exist (PURCH-001, SALES-001, CASH-001, etc.).
   * Fast path: check all codes in ONE query; only upsert if any are missing.
   * Avoids per-ledger upserts (17 sequential queries) that timeout inside transactions.
   *
   * THROTTLED: outside a transaction we skip if the last successful check was
   * within TTL, and dedupe concurrent callers onto a single in-flight promise.
   * Transactional callers always run inline (correctness inside the tx boundary).
   */
  async ensureSystemLedgersExist(txClient?: Prisma.TransactionClient) {
    if (txClient) {
      return this._doEnsureSystemLedgersExist(txClient);
    }
    const now = Date.now();
    if (now - AccountsService._systemLedgersReadyAt < AccountsService.SYSTEM_LEDGERS_TTL_MS) {
      return;
    }
    if (AccountsService._inFlightSystemLedgerCheck) {
      return AccountsService._inFlightSystemLedgerCheck;
    }
    AccountsService._inFlightSystemLedgerCheck = this._doEnsureSystemLedgersExist()
      .then(() => {
        AccountsService._systemLedgersReadyAt = Date.now();
      })
      .catch((err) => {
        console.error("[System Ledgers] ensureSystemLedgersExist failed:", err);
      })
      .finally(() => {
        AccountsService._inFlightSystemLedgerCheck = null;
      });
    return AccountsService._inFlightSystemLedgerCheck;
  }

  private async _doEnsureSystemLedgersExist(txClient?: Prisma.TransactionClient) {
    const db = txClient || prisma;
    const codes = DEFAULT_SEED_LEDGERS.map((l) => l.code);
    const existing = await db.accountLedger.findMany({
      where: { code: { in: codes } },
      select: { code: true, group: true },
    });
    const existingMap = new Map(existing.map((e) => [e.code, e.group]));

    // Create missing ledgers
    const missing = DEFAULT_SEED_LEDGERS.filter((l) => !existingMap.has(l.code));
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

    // Fix existing ledgers with stale "Cash & Bank" group — migrate to proper groups
    for (const ledger of DEFAULT_SEED_LEDGERS) {
      const currentGroup = existingMap.get(ledger.code);
      if (currentGroup && currentGroup.toLowerCase().trim() === "cash & bank" && ledger.group !== "Cash & Bank") {
        await db.accountLedger.update({
          where: { code: ledger.code },
          data: { group: ledger.group },
        });
      }
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

    // `group` may match either the ledger's own `group` field OR a customer
    // grade/type name (Grade A, Retailer, etc.). We build the WHERE at query
    // time to keep it a single fast query.
    const groupIsPartyMeta =
      !!params.group &&
      (
        // If Prisma returns rows for either grade/type match, use OR. We can't
        // know ahead of time, so we always OR against both.
        true
      );
    const where: Prisma.AccountLedgerWhereInput = {
      ...(params.type && { type: params.type }),
      ...(params.group && {
        OR: [
          { group: { equals: params.group, mode: "insensitive" } },
          { customer: { customerGrade: { name: { equals: params.group, mode: "insensitive" } } } },
          { customer: { customerType: { name: { equals: params.group, mode: "insensitive" } } } },
        ],
      }),
      ...(params.search && {
        OR: [
          { code: { contains: params.search, mode: "insensitive" } },
          { name: { contains: params.search, mode: "insensitive" } },
          { group: { contains: params.search, mode: "insensitive" } },
        ],
      }),
    };
    // Silence unused-var lint hint (kept as a doc marker for the reader).
    void groupIsPartyMeta;

    const [ledgers, total] = await Promise.all([
      prisma.accountLedger.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { code: "asc" },
        include: {
          customer: {
            select: {
              id: true,
              firmName: true,
              customerCode: true,
              customerGrade: { select: { name: true } },
              customerType: { select: { name: true } },
            },
          },
          supplier: { select: { id: true, legalName: true, supplierCode: true } },
        },
      }),
      prisma.accountLedger.count({ where }),
    ]);

    // Optional pre-grouped output for sidebar tree views.
    // In addition to the ledger's own `group`, party ledgers also appear
    // under their customer grade/type as pseudo-groups so the user can
    // pick "Grade A" or "Retailer" straight from the group picker.
    //
    // Fetch the FULL ledger set for grouping — the paginated `ledgers`
    // above would miss any ledger past the current page, so newly-created
    // customers can look like they have no grade. Grouping is a compact
    // index (only fields we need) so full-table scan is cheap.
    let grouped: Array<{ group: string; ledgers: typeof ledgers }> | null = null;
    if (params.grouped) {
      const allForGroup = await prisma.accountLedger.findMany({
        where,
        orderBy: { code: "asc" },
        include: {
          customer: {
            select: {
              id: true,
              firmName: true,
              customerCode: true,
              customerGrade: { select: { name: true } },
              customerType: { select: { name: true } },
            },
          },
          supplier: { select: { id: true, legalName: true, supplierCode: true } },
        },
      });
      const buckets: Record<string, typeof ledgers> = {};
      const push = (key: string, l: typeof ledgers[number]) => {
        if (!buckets[key]) buckets[key] = [];
        // Avoid double-listing the same ledger under the same key
        if (!buckets[key].some((x) => x.id === l.id)) buckets[key].push(l);
      };
      for (const l of allForGroup) {
        push(l.group || "Others", l);
        const gradeName = (l as any).customer?.customerGrade?.name as string | undefined;
        const typeName = (l as any).customer?.customerType?.name as string | undefined;
        if (gradeName) push(gradeName, l);
        if (typeName) push(typeName, l);
      }
      // Also include EVERY grade / type from the master tables even when
      // no customer is assigned yet, so newly-created grades appear in
      // the group picker straight away (empty bucket until a customer
      // uses that grade).
      try {
        const [allGrades, allTypes] = await Promise.all([
          prisma.customerGrade.findMany({ select: { name: true } }),
          prisma.customerType.findMany({ select: { name: true } }),
        ]);
        for (const g of allGrades) if (g.name && !buckets[g.name]) buckets[g.name] = [];
        for (const t of allTypes) if (t.name && !buckets[t.name]) buckets[t.name] = [];
        console.log("[getLedgers.grouped]", {
          gradesFromTable: allGrades.map((g) => g.name),
          typesFromTable: allTypes.map((t) => t.name),
          finalBucketCount: Object.keys(buckets).length,
        });
      } catch (err) {
        console.error("[getLedgers.grouped] master seed failed:", err);
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
    // Safety net: on a fresh DB where the user hasn't triggered any auto-seeding
    // flow yet (no customer/supplier/report loaded), Cash in Hand / Main Bank
    // Account / Petty Cash may still be missing. Ensure they exist so the bank
    // selector on customer & supplier create forms always has these 3 defaults.
    // Throttled + memoized, so this is effectively free on hot path.
    await this.ensureSystemLedgersExist();

    const bankGroups = ["Cash & Bank", "Bank Accounts", "Cash in Hand", "BANK ACCOUNTS", "CASH IN HAND"];

    const ledgers = await prisma.accountLedger.findMany({
      where: {
        type: LedgerType.ASSET,
        group: { in: bankGroups, mode: "insensitive" },
        isActive: true,
      },
      orderBy: { name: "asc" },
    });
    if (ledgers.length === 0) return { accounts: [], totalBalance: 0 };

    const ledgerIds = ledgers.map((l) => l.id);

    // Old code fired 2 aggregate queries PER ledger (up to 20+ parallel queries
    // saturating the Neon pool). Now: 2 groupBy queries total, regardless of
    // ledger count. Runs in an interactive $transaction so both share one
    // connection.
    const { debitRows, creditRows, openingVouchers } = await prisma.$transaction(async (tx) => {
      const [debitRows, creditRows, openingVouchers] = await Promise.all([
        tx.journalItem.groupBy({
          by: ["debitLedgerId"],
          where: { debitLedgerId: { in: ledgerIds } },
          _sum: { debitAmount: true },
        }),
        tx.journalItem.groupBy({
          by: ["creditLedgerId"],
          where: { creditLedgerId: { in: ledgerIds } },
          _sum: { creditAmount: true },
        }),
        tx.voucher.findMany({
          where: {
            refDocType: "LEDGER_OPENING_BALANCE",
            refDocId: { in: ledgerIds.map(String) },
          },
          select: { refDocId: true },
        }),
      ]);
      return { debitRows, creditRows, openingVouchers };
    });

    const debitMap = new Map<number, number>(
      debitRows.map((r) => [r.debitLedgerId as number, Number(r._sum?.debitAmount || 0)])
    );
    const creditMap = new Map<number, number>(
      creditRows.map((r) => [r.creditLedgerId as number, Number(r._sum?.creditAmount || 0)])
    );
    const openingBalanceSet = new Set<number>(
      openingVouchers.map((v) => Number(v.refDocId))
    );

    const results = ledgers.map((ledger) => {
      const totalDebit = debitMap.get(ledger.id) || 0;
      const totalCredit = creditMap.get(ledger.id) || 0;
      return {
        id: ledger.id,
        code: ledger.code,
        name: ledger.name,
        group: ledger.group,
        currentBalance: totalDebit - totalCredit,
        totalDebit,
        totalCredit,
        hasOpeningBalance: openingBalanceSet.has(ledger.id),
      };
    });

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

    const ledger = await prisma.accountLedger.create({
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

    // Auto-post opening balance voucher when user creates a bank/cash/generic
    // ledger with a non-zero opening balance. This is what makes the entered
    // "current bank balance" appear immediately on the Ledger Statement and
    // roll into Trial Balance / Balance Sheet without a manual journal entry.
    const openingBalance = Number(data.openingBalance || 0);
    if (openingBalance > 0) {
      try {
        const { voucherPostingService } = require("./voucherPosting.service");
        const opType = String(data.openingBalanceType || "DEBIT").toUpperCase() === "CREDIT" ? "CREDIT" : "DEBIT";
        await voucherPostingService.postGenericLedgerOpeningBalanceVoucher(
          { id: ledger.id, code: ledger.code, name: ledger.name },
          openingBalance,
          opType as "DEBIT" | "CREDIT"
        );
      } catch (err) {
        console.error("[AccountsService] Auto-post opening balance failed:", err);
        // Do not throw — the ledger is already created; the user can add a JV manually if needed.
      }
    }

    return ledger;
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
      // Ensure opening-balance JVs exist for every customer/supplier that has
      // a non-zero opening. Without this the statement is missing rows for
      // legacy party records that never triggered a manual post.
      await voucherPostingService.syncMissingOpeningBalanceVouchers();
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

    // Ledger statement now shows the REAL opening JV voucher (with its
    // voucher number, clickable → JV detail). No synthetic "Opening Balance
    // b/f" row is injected anymore — that duplicated the JV and hid the
    // voucher trail. Just fetch every journal item that touches this ledger.
    const voucherWhere: Prisma.VoucherWhereInput = {
      ...dateFilter,
    };

    const journalItems = await prisma.journalItem.findMany({
      where: {
        OR: [{ debitLedgerId: id }, { creditLedgerId: id }],
        voucher: voucherWhere,
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

    // Read opening balance AND its side ("DEBIT" | "CREDIT") from the party record.
    // Customer defaults to DEBIT (they owe us), Supplier defaults to CREDIT (we owe them).
    // If the user chose the OPPOSITE side, that means:
    //   • Customer + CREDIT = advance received from customer → we owe them (negative receivable)
    //   • Supplier + DEBIT   = advance paid to supplier    → they owe us (negative payable)
    let openingBalance = 0;
    let openingType: "DEBIT" | "CREDIT" = "DEBIT";
    if (ledger.customer) {
      openingBalance = Number((ledger.customer as any).openingBalance || 0);
      openingType = String((ledger.customer as any).openingBalanceType || "DEBIT").toUpperCase() === "CREDIT" ? "CREDIT" : "DEBIT";
    } else if (ledger.supplier) {
      openingBalance = Number((ledger.supplier as any).openingBalance || 0);
      openingType = String((ledger.supplier as any).openingBalanceType || "CREDIT").toUpperCase() === "DEBIT" ? "DEBIT" : "CREDIT";
    }

    // The ledger's natural side (Asset/Expense → DEBIT natural, Liability/Income/Equity → CREDIT natural).
    // Only used to derive the signed "opening balance" number displayed in the
    // header banner — the row itself now comes from the real JV entry below.
    const naturalSide: "DEBIT" | "CREDIT" = isAssetOrExpense ? "DEBIT" : "CREDIT";
    const signedOpeningBalance = openingType === naturalSide ? openingBalance : -openingBalance;

    // For bank/cash ledgers (no customer or supplier link), pull the opening
    // balance from the dedicated LEDGER_OPENING_BALANCE JV and exclude it from
    // the transaction list. This makes the Opening Balance stat card show the
    // actual amount while keeping the statement table clean.
    const isBankLedger = !ledger.customerId && !ledger.supplierId;
    let openingBalanceForDisplay = signedOpeningBalance;
    let itemsForStatement = journalItems;

    if (isBankLedger) {
      const openingJvItems = journalItems.filter(
        (item) => item.voucher.refDocType === "LEDGER_OPENING_BALANCE"
      );
      itemsForStatement = journalItems.filter(
        (item) => item.voucher.refDocType !== "LEDGER_OPENING_BALANCE"
      );
      let computedOpening = 0;
      for (const item of openingJvItems) {
        const isDebit = item.debitLedgerId === id;
        const rawDebit = Number(item.debitAmount);
        const rawCredit = Number(item.creditAmount);
        const amt = rawDebit > 0 ? rawDebit : rawCredit > 0 ? rawCredit : 0;
        if (isAssetOrExpense) {
          computedOpening += isDebit ? amt : -amt;
        } else {
          computedOpening += isDebit ? -amt : amt;
        }
      }
      openingBalanceForDisplay = computedOpening;
    }

    // For bank ledgers the opening JV is excluded from itemsForStatement so we
    // start from the computed opening. For customer/supplier ledgers the opening
    // JV IS included as a regular row — starting from openingBalanceForDisplay
    // would double-count it (e.g. opening 5,000 + JV credit 5,000 = 10,000).
    // Mirror the same logic used in getMultiLedgerStatement.
    let runningBalance = isBankLedger ? openingBalanceForDisplay : 0;
    const entries: any[] = [];

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

    for (const item of itemsForStatement) {
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
        voucherId: item.voucher.id,
        voucherNo: item.voucher.voucherNo,
        voucherType: item.voucher.type,
        refDocType: item.voucher.refDocType,
        refDocId: item.voucher.refDocId,
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
      // Return the SIGNED opening (negative when the party sits on the opposite
      // side, e.g. customer with a CREDIT-type opening = advance received).
      // The running balance is already signed, so keeping both signed makes
      // the header banner consistent with the row math.
      openingBalance: openingBalanceForDisplay,
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
      await voucherPostingService.syncMissingOpeningBalanceVouchers();
    } catch (err) {
      console.error("[AccountsService] Sync unposted vouchers failed:", err);
    }

    // First fetch the caller-supplied ledgers so we can detect aggregate parents.
    const requestedLedgers = await prisma.accountLedger.findMany({
      where: { id: { in: ids } },
      include: { customer: true, supplier: true },
    });
    if (requestedLedgers.length === 0) {
      throw new ApiError(404, "No matching ledgers found");
    }

    // Aggregate expansion — if any requested ledger is an aggregate parent
    // (Sundry Debtors / Sundry Creditors), swap it in for ALL its child party
    // ledgers so their vouchers actually show up. Without this, selecting
    // "Sundry Debtors" in "Selected Accounts" mode returns zero rows because
    // the parent ledger itself has no direct journal items — all activity is
    // on the individual customer/supplier ledgers under it.
    const { AGGREGATE_LEDGER_CODES, expandAggregateLedger } = require("./standardLedgers");
    const expandedIdSet = new Set<number>();
    for (const l of requestedLedgers) {
      if (AGGREGATE_LEDGER_CODES.has(l.code)) {
        const expansion = await expandAggregateLedger(l, prisma);
        expansion.ledgerIds.forEach((id: number) => expandedIdSet.add(id));
      } else {
        expandedIdSet.add(l.id);
      }
    }
    const effectiveIds = Array.from(expandedIdSet);

    // Refetch the full ledger set including expanded children (needed for
    // opening-balance aggregation and running-balance calculation below).
    const ledgers = effectiveIds.length === requestedLedgers.length
      ? requestedLedgers
      : await prisma.accountLedger.findMany({
          where: { id: { in: effectiveIds } },
          include: { customer: true, supplier: true },
        });

    const dateFilter: Prisma.VoucherWhereInput = {};
    if (options.startDate || options.endDate) {
      dateFilter.date = {
        ...(options.startDate && { gte: new Date(options.startDate) }),
        ...(options.endDate && { lte: new Date(options.endDate) }),
      };
    }

    // Include EVERY journal item that touches any effective ledger — including
    // opening balance JVs. Excluding them (as we used to) meant that when
    // openings from multiple customers/suppliers cancelled each other, the
    // "Sundry Debtors" / "Selected Accounts" / "Current Assets" views returned
    // an empty table even though real opening entries existed on the books.
    // Matches Busy behaviour: every posted JV is a row, running balance follows.
    const journalItems = await prisma.journalItem.findMany({
      where: {
        OR: [
          { debitLedgerId: { in: effectiveIds } },
          { creditLedgerId: { in: effectiveIds } },
        ],
        voucher: dateFilter,
      },
      include: {
        voucher: true,
        debitLedger: { select: { id: true, name: true, code: true, type: true } },
        creditLedger: { select: { id: true, name: true, code: true, type: true } },
      },
      orderBy: [{ voucher: { date: "asc" } }, { voucher: { id: "asc" } }],
    });

    // Aggregate opening balance (header banner only). The individual opening
    // JVs are now rendered as regular rows in the entries list below, so this
    // number is used purely as a summary shown at the top of the statement.
    //
    // Per-account tracking — needed so the frontend can render Busy-style
    // "Closing Balance" rows per account. `opening` holds the signed opening
    // in natural direction (positive = same side as ledger's natural side).
    // `running` starts at 0 because the opening JV itself will be one of the
    // journal items iterated below — starting from `opening` would double-count.
    type AccountAgg = {
      id: number;
      name: string;
      isAssetOrExpense: boolean;
      opening: number;   // signed in the ledger's natural direction
      running: number;   // signed running balance
    };
    const perAccount = new Map<number, AccountAgg>();

    let openingBalance = 0;
    for (const ledger of ledgers) {
      let opening = 0;
      let openingType: "DEBIT" | "CREDIT" = "DEBIT";
      if (ledger.customer) {
        opening = Number((ledger.customer as any).openingBalance || 0);
        openingType = String((ledger.customer as any).openingBalanceType || "DEBIT").toUpperCase() === "CREDIT" ? "CREDIT" : "DEBIT";
      } else if (ledger.supplier) {
        opening = Number((ledger.supplier as any).openingBalance || 0);
        openingType = String((ledger.supplier as any).openingBalanceType || "CREDIT").toUpperCase() === "DEBIT" ? "DEBIT" : "CREDIT";
      }
      const isAssetOrExpense = ledger.type === LedgerType.ASSET || ledger.type === LedgerType.EXPENSE;
      const naturalSide: "DEBIT" | "CREDIT" = isAssetOrExpense ? "DEBIT" : "CREDIT";
      const signedOpening = openingType === naturalSide ? opening : -opening;
      openingBalance += signedOpening;
      perAccount.set(ledger.id, {
        id: ledger.id,
        name: ledger.name,
        isAssetOrExpense,
        opening: signedOpening,
        running: 0,
      });
    }

    // Use the EXPANDED set (children of aggregate parents included), not
    // the raw request IDs. Otherwise a user selecting an aggregate parent
    // like "Sundry Debtors" would fail the isSelectedDebit/Credit checks
    // below (parent ID is not on any journal item — only its children are),
    // and every entry would render with debit=0 credit=0 despite the
    // WHERE clause correctly matching child ledgers.
    const selectedIds = expandedIdSet;
    let runningBalance = 0;
    const entries: any[] = [];

    // Diagnostic: log selection membership + amounts for a few items so we
    // can spot cases where an entry appears in the list but its debit/credit
    // both end up 0 (WHERE matched a side that later doesn't pass the has()
    // check — e.g. type mismatch between Set entries and item ledger IDs).
    let __diagLogged = 0;
    for (const item of journalItems) {
      const isSelectedDebit = item.debitLedgerId && selectedIds.has(item.debitLedgerId);
      const isSelectedCredit = item.creditLedgerId && selectedIds.has(item.creditLedgerId);
      if (__diagLogged < 5 && !isSelectedDebit && !isSelectedCredit) {
        console.warn("[getMultiLedger] item matched WHERE but neither side is in selectedIds", {
          itemId: item.id,
          debitLedgerId: item.debitLedgerId,
          creditLedgerId: item.creditLedgerId,
          selectedIdsSize: selectedIds.size,
          selectedIdsSample: Array.from(selectedIds).slice(0, 10),
        });
        __diagLogged++;
      }
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

      const delta = isAssetOrExpense ? (debit - credit) : (credit - debit);
      runningBalance += delta;
      // Also apply the same delta to the individual account's running
      // balance so we can return per-account closing balances for the
      // Busy-style "Closing Balance" row per account section.
      const selectedLedgerId = isSelectedDebit ? item.debitLedgerId : item.creditLedgerId;
      if (selectedLedgerId) {
        const agg = perAccount.get(selectedLedgerId);
        if (agg) agg.running += delta;
      }

      entries.push({
        id: item.id.toString(),
        voucherId: item.voucher.id,
        voucherNo: item.voucher.voucherNo,
        voucherType: item.voucher.type,
        refDocType: item.voucher.refDocType,
        refDocId: item.voucher.refDocId,
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

    // Per-account opening / closing balances keyed by account NAME (matches
    // what entries carry as `accountName`, so the frontend can look up the
    // group's balance in O(1) when rendering the per-account footer row).
    // Closing is expressed as a positive number + Dr/Cr side (natural side
    // of the ledger). `runningRaw` keeps the signed value for internal use.
    const accountBalances: Record<string, { name: string; opening: number; openingSide: "Dr" | "Cr"; closing: number; closingSide: "Dr" | "Cr" }> = {};
    for (const agg of perAccount.values()) {
      const naturalSide: "Dr" | "Cr" = agg.isAssetOrExpense ? "Dr" : "Cr";
      const oppositeSide: "Dr" | "Cr" = agg.isAssetOrExpense ? "Cr" : "Dr";
      accountBalances[agg.name] = {
        name: agg.name,
        opening: Math.abs(agg.opening),
        openingSide: agg.opening >= 0 ? naturalSide : oppositeSide,
        closing: Math.abs(agg.running),
        closingSide: agg.running >= 0 ? naturalSide : oppositeSide,
      };
    }

    return {
      mode: "multi" as const,
      label: options.label || `${ledgers.length} accounts`,
      ledgerIds: effectiveIds,
      ledgerCount: ledgers.length,
      startDate: options.startDate || null,
      endDate: options.endDate || null,
      openingBalance,
      closingBalance: runningBalance,
      entries: filteredEntries,
      accountBalances,
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
    const journalItemWhere: Prisma.JournalItemWhereInput | undefined = asOnDate
      ? { voucher: { date: { lte: asOnDate } } }
      : undefined;

    // FAST PATH: 3 queries in one transaction (shared connection).
    // Old code did a mega-include that pulled EVERY journalItem + EVERY voucher
    // for EVERY ledger into memory just to sum debitAmount/creditAmount — hundreds
    // of MB of unused voucher metadata over the wire for 700+ ledgers × N items.
    // Now: 1 lightweight ledger query + 2 groupBy sums. Speedup is 10–100×.
    const { ledgers, debitSums, creditSums } = await prisma.$transaction(async (tx) => {
      const [ledgers, debitSums, creditSums] = await Promise.all([
        tx.accountLedger.findMany({
          select: {
            id: true, code: true, name: true, type: true, group: true,
            customer: { select: { openingBalance: true, openingBalanceType: true } },
            supplier: { select: { openingBalance: true, openingBalanceType: true } },
          },
          orderBy: { code: "asc" },
        }),
        tx.journalItem.groupBy({
          by: ["debitLedgerId"],
          where: { debitLedgerId: { not: null }, ...(journalItemWhere ?? {}) },
          _sum: { debitAmount: true },
        }),
        tx.journalItem.groupBy({
          by: ["creditLedgerId"],
          where: { creditLedgerId: { not: null }, ...(journalItemWhere ?? {}) },
          _sum: { creditAmount: true },
        }),
      ]);
      return { ledgers, debitSums, creditSums };
    });

    const debitMap = new Map<number, number>(
      debitSums.map((r) => [r.debitLedgerId as number, Number(r._sum?.debitAmount || 0)])
    );
    const creditMap = new Map<number, number>(
      creditSums.map((r) => [r.creditLedgerId as number, Number(r._sum?.creditAmount || 0)])
    );

    const rows = ledgers.map((ledger) => {
      const isAssetOrExpense = ledger.type === LedgerType.ASSET || ledger.type === LedgerType.EXPENSE;

      const totalDebit = debitMap.get(ledger.id) || 0;
      const totalCredit = creditMap.get(ledger.id) || 0;

      // Signed opening balance — DEBIT type (natural for ASSET/EXPENSE) is
      // positive, CREDIT type (natural for LIABILITY/INCOME/EQUITY) is negative
      // when displayed on the natural side. Sign only affects display (Opening
      // Dr / Opening Cr columns); closingBalance is derived from journal items
      // which already include the opening voucher amounts.
      const rawOp = Number(
        (ledger.customer as any)?.openingBalance ||
        (ledger.supplier as any)?.openingBalance ||
        0
      );
      // Customer default = DEBIT (they owe us). Supplier default = CREDIT (we owe them).
      const opTypeStr = ledger.customer
        ? String((ledger.customer as any)?.openingBalanceType || "DEBIT").toUpperCase()
        : ledger.supplier
          ? String((ledger.supplier as any)?.openingBalanceType || "CREDIT").toUpperCase()
          : "DEBIT";
      const naturalIsDebit = isAssetOrExpense;
      const opIsDebit = opTypeStr === "DEBIT";
      const openingBalance = opIsDebit === naturalIsDebit ? rawOp : -rawOp;

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

    // Same fast-path as getTrialBalance — 1 ledger query + 2 groupBy sums
    // instead of a mega-include that pulls every journalItem + voucher row.
    const journalItemWhere: Prisma.JournalItemWhereInput | undefined =
      Object.keys(dateFilter).length > 0 ? { voucher: dateFilter } : undefined;

    const { ledgers, debitSums, creditSums } = await prisma.$transaction(async (tx) => {
      const ledgersList = await tx.accountLedger.findMany({
        where: { type: { in: [LedgerType.INCOME, LedgerType.EXPENSE] } },
        select: { id: true, code: true, name: true, type: true, group: true },
        orderBy: { code: "asc" },
      });
      const ledgerIds = ledgersList.map((l) => l.id);
      if (ledgerIds.length === 0) {
        return { ledgers: ledgersList, debitSums: [] as any[], creditSums: [] as any[] };
      }
      const [debitSums, creditSums] = await Promise.all([
        tx.journalItem.groupBy({
          by: ["debitLedgerId"],
          where: { debitLedgerId: { in: ledgerIds }, ...(journalItemWhere ?? {}) },
          _sum: { debitAmount: true },
        }),
        tx.journalItem.groupBy({
          by: ["creditLedgerId"],
          where: { creditLedgerId: { in: ledgerIds }, ...(journalItemWhere ?? {}) },
          _sum: { creditAmount: true },
        }),
      ]);
      return { ledgers: ledgersList, debitSums, creditSums };
    });

    const debitMap = new Map<number, number>(
      debitSums.map((r: any) => [r.debitLedgerId as number, Number(r._sum?.debitAmount || 0)])
    );
    const creditMap = new Map<number, number>(
      creditSums.map((r: any) => [r.creditLedgerId as number, Number(r._sum?.creditAmount || 0)])
    );

    const incomeAccounts: any[] = [];
    const expenseAccounts: any[] = [];

    for (const ledger of ledgers) {
      const totalDebit = debitMap.get(ledger.id) || 0;
      const totalCredit = creditMap.get(ledger.id) || 0;

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

  /**
   * One-time repair for legacy customer/supplier opening balance vouchers
   * whose contra side was wrongly routed to a bank/cash ledger. Deletes any
   * offending voucher, then triggers the sync so a clean one is re-posted
   * against Opening Balance Equity (EQ-001).
   *
   * Safe to run any number of times — after the first successful run, no
   * more mismatched vouchers exist and subsequent calls are a no-op.
   */
  async repairPartyOpeningBalanceVouchers() {
    const bankGroups = ["Cash & Bank", "Bank Accounts", "Cash in Hand"];
    const bankLedgers = await prisma.accountLedger.findMany({
      where: {
        type: LedgerType.ASSET,
        group: { in: bankGroups, mode: "insensitive" },
      },
      select: { id: true },
    });
    const bankLedgerIds = new Set(bankLedgers.map((l) => l.id));

    const vouchers = await prisma.voucher.findMany({
      where: { refDocType: { in: ["CUSTOMER_OPENING_BALANCE", "SUPPLIER_OPENING_BALANCE"] } },
      include: { items: { select: { debitLedgerId: true, creditLedgerId: true } } },
    });

    const badVoucherIds = vouchers
      .filter((v) =>
        v.items.some(
          (it) =>
            (it.debitLedgerId != null && bankLedgerIds.has(it.debitLedgerId)) ||
            (it.creditLedgerId != null && bankLedgerIds.has(it.creditLedgerId))
        )
      )
      .map((v) => v.id);

    if (badVoucherIds.length > 0) {
      await prisma.$transaction([
        prisma.journalItem.deleteMany({ where: { voucherId: { in: badVoucherIds } } }),
        prisma.voucher.deleteMany({ where: { id: { in: badVoucherIds } } }),
      ]);
    }

    const { voucherPostingService } = require("./voucherPosting.service");
    await voucherPostingService.syncMissingOpeningBalanceVouchers();

    return { removed: badVoucherIds.length, ok: true };
  }

  /**
   * Set (or reset) the opening balance for a bank/cash ledger.
   *
   * Idempotent — any prior `JV-LEDG-OP-<code>` for the same ledger is deleted
   * first so the user can adjust the number without stacking duplicate JVs.
   * Passing `amount = 0` clears the opening balance entirely (no new voucher).
   *
   * The voucher hits the target ledger and `EQ-001 Opening Balance Equity` —
   * never a customer/supplier ledger.
   */
  async setBankOpeningBalance(ledgerId: number, amount: number) {
    const ledger = await prisma.accountLedger.findUnique({ where: { id: ledgerId } });
    if (!ledger) throw new ApiError(404, "Ledger not found");

    const bankGroups = ["Cash & Bank", "Bank Accounts", "Cash in Hand"];
    const isBankLike =
      ledger.type === LedgerType.ASSET &&
      bankGroups.some((g) => g.toLowerCase() === (ledger.group || "").toLowerCase().trim());
    if (!isBankLike) {
      throw new ApiError(400, "Opening balance edit is only allowed on bank / cash ledgers");
    }

    if (!Number.isFinite(amount) || amount < 0) {
      throw new ApiError(400, "Opening balance must be a non-negative number");
    }

    const refDocId = String(ledger.id);
    const existing = await prisma.voucher.findMany({
      where: { refDocType: "LEDGER_OPENING_BALANCE", refDocId },
      select: { id: true },
    });
    if (existing.length > 0) {
      throw new ApiError(400, "Opening balance has already been set for this account and cannot be changed");
    }

    if (amount > 0) {
      const { voucherPostingService } = require("./voucherPosting.service");
      await voucherPostingService.postGenericLedgerOpeningBalanceVoucher(
        { id: ledger.id, code: ledger.code, name: ledger.name },
        amount,
        "DEBIT"
      );
    }

    return { ledgerId: ledger.id, openingBalance: amount };
  }
}

export const accountsService = new AccountsService();
