import { prisma } from "../../config/prisma";
import { LedgerType, VoucherType, Prisma } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { accountsService } from "../accounts/accounts.service";
import { voucherPostingService } from "../accounts/voucherPosting.service";

export interface CustomerReceivableSummary {
  customerId: string;
  customerCode: string;
  firmName: string;
  gstin?: string | null;
  customerType?: string | null;
  phone?: string | null;
  /** Date (YYYY-MM-DD) of the most recent voucher touching this customer's
   * ledger, excluding the auto-posted opening balance JV. Null if the only
   * activity is the opening balance. Populated so the Amount Receivable list
   * can show when the last transaction with this customer happened. */
  lastTransactionDate?: string | null;
  openingBalance: number;
  totalBilled: number;
  totalPaid: number;
  totalReturned: number;
  debit: number;
  credit: number;
  netBalance: number;
  balanceAsOnDate: number;
  overdueAmount: number;
  dueDays: number | null;
  isOverdue: boolean;
}

/** Extract the primary phone number from either a scalar string or the
 * `mobile` JSON column shape used by Customer/Supplier
 * (`[{ number, label, isPrimary? }, ...]`). Returns null if no digits found. */
function extractPrimaryPhone(raw: any): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw.trim() || null;
  if (Array.isArray(raw) && raw.length) {
    const primary = raw.find((p) => p && (p.isPrimary || p.is_primary || p.isDefault));
    const pick = primary || raw.find((p) => p && p.number);
    if (pick && pick.number) return String(pick.number).trim() || null;
    return null;
  }
  if (typeof raw === "object" && raw.number) return String(raw.number).trim() || null;
  return null;
}

export interface CustomerReceivableDetail {
  customer: {
    id: string;
    customerCode: string;
    firmName: string;
    gstin?: string | null;
    customerType?: string;
    openingBalance: number;
  };
  ledger: any;
  summary: {
    openingBalance: number;
    totalBilled: number;
    totalPaid: number;
    totalReturned: number;
    closingBalance: number;
  };
  invoices: Array<{
    id: string;
    invoiceNo: string;
    date: string;
    dueDate?: string;
    amount: number;
    paidAmount: number;
    balance: number;
    status: string;
  }>;
  collectionHistory: Array<{
    id: string;
    voucherId?: string;
    voucherNo: string;
    date: string;
    amount: number;
    paymentMode?: string;
    referenceNo?: string;
    narration?: string;
    postedToLedger?: boolean;
    sourceVoucherId?: string;
    refDocId?: string;
  }>;
  statementEntries: Array<{
    id: string;
    voucherNo: string;
    voucherType: string;
    date: string;
    narration: string;
    particulars: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
}

const extractPaymentsArray = (raw: any): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

class ReceivableService {
  /**
   * List all customers with outstanding receivable balances as on date.
   */
  async getReceivableSummaries(params?: {
    asOnDate?: string;
    startDate?: string;
    endDate?: string;
    customerId?: string;
    search?: string;
  }): Promise<CustomerReceivableSummary[]> {
    const cutoffDate = params?.asOnDate ? new Date(params.asOnDate) : new Date();
    if (params?.asOnDate) cutoffDate.setHours(23, 59, 59, 999);

    const startDateObj = params?.startDate ? new Date(params.startDate) : undefined;
    const endDateObj = params?.endDate ? new Date(params.endDate) : undefined;
    if (endDateObj) endDateObj.setHours(23, 59, 59, 999);

    // 1. Fetch customers
    const customers = await prisma.customer.findMany({
      where: {
        ...(params?.customerId && { id: params.customerId }),
        ...(params?.search && {
          OR: [
            { firmName: { contains: params.search, mode: "insensitive" } },
            { customerCode: { contains: params.search, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { firmName: "asc" },
    });

    const customerIds = customers.map((c) => c.id);

    // 2. Batch fetch all ledgers for these customers
    const existingLedgers = await prisma.accountLedger.findMany({
      where: { customerId: { in: customerIds } },
    });
    const ledgerMap = new Map<string, any>();
    existingLedgers.forEach((l) => { if (l.customerId) ledgerMap.set(l.customerId, l); });

    // Ensure missing ledgers (batch, sequential to avoid pool exhaustion)
    const missingCustomers = customers.filter((c) => !ledgerMap.has(c.id));
    for (const c of missingCustomers) {
      const l = await accountsService.ensureCustomerLedger(c);
      ledgerMap.set(c.id, l);
    }

    const ledgerIds = Array.from(ledgerMap.values()).map((l) => l.id);

    const voucherDateFilter: Prisma.DateTimeFilter = {
      ...(startDateObj && { gte: startDateObj }),
      ...(endDateObj ? { lte: endDateObj } : { lte: cutoffDate }),
    };

    // 3. Batch fetch ALL journal items and invoices in 2 queries (not per-customer)
    const [allJournalItems, allSalesInvoices] = await Promise.all([
      prisma.journalItem.findMany({
        where: {
          OR: [{ debitLedgerId: { in: ledgerIds } }, { creditLedgerId: { in: ledgerIds } }],
          voucher: { date: voucherDateFilter },
        },
        include: { voucher: true },
      }),
      (prisma as any).salesInvoice.findMany({
        where: { customerId: { in: customerIds } },
        // Explicit select — only the fields this file actually reads. Also
        // insulates against schema drift on unused columns (e.g. shipping_*
        // fields declared in schema but missing in DB → previously blew up
        // with Prisma P2022 on the whole endpoint).
        select: {
          id: true,
          customerId: true,
          invoiceNo: true,
          invoiceDate: true,
          dueDate: true,
          createdAt: true,
          grandTotal: true,
          subTotal: true,
          payments: true,
        },
      }),
    ]);

    // Group by ledger ID
    const itemsByLedger = new Map<number, typeof allJournalItems>();
    for (const item of allJournalItems) {
      if (item.debitLedgerId && ledgerIds.includes(item.debitLedgerId)) {
        const list = itemsByLedger.get(item.debitLedgerId) || [];
        list.push(item);
        itemsByLedger.set(item.debitLedgerId, list);
      }
      if (item.creditLedgerId && ledgerIds.includes(item.creditLedgerId)) {
        const list = itemsByLedger.get(item.creditLedgerId) || [];
        list.push(item);
        itemsByLedger.set(item.creditLedgerId, list);
      }
    }

    // Group invoices by customer
    const invoicesByCustomer = new Map<string, any[]>();
    for (const inv of allSalesInvoices) {
      const list = invoicesByCustomer.get(inv.customerId) || [];
      list.push(inv);
      invoicesByCustomer.set(inv.customerId, list);
    }

    // 4. Calculate per customer (no DB calls in this loop)
    const results: CustomerReceivableSummary[] = customers.map((customer) => {
      const rawOpBal = Number(customer.openingBalance || 0);
      const opType = ((customer as any).openingBalanceType || "DEBIT").toUpperCase();
      const openingBalance = opType === "CREDIT" ? -Math.abs(rawOpBal) : Math.abs(rawOpBal);

      const ledger = ledgerMap.get(customer.id);
      const journalItems = ledger ? itemsByLedger.get(ledger.id) || [] : [];
      const salesInvoices = invoicesByCustomer.get(customer.id) || [];

      let totalBilled = 0;
      let totalPaid = 0;
      let totalReturned = 0;
      /** Newest voucher.date across non-opening-balance items. */
      let lastTxnDateObj: Date | null = null;

      for (const item of journalItems) {
        if (item.voucher.refDocType === "CUSTOMER_OPENING_BALANCE" || item.narration?.includes("Opening balance")) {
          continue;
        }

        const vDate = item.voucher.date instanceof Date ? item.voucher.date : new Date(item.voucher.date as any);
        if (!isNaN(vDate.getTime()) && (!lastTxnDateObj || vDate.getTime() > lastTxnDateObj.getTime())) {
          lastTxnDateObj = vDate;
        }

        let isDebit = item.debitLedgerId === ledger?.id;
        let isCredit = item.creditLedgerId === ledger?.id;

        if (item.voucher.type === VoucherType.SALES_RETURN) {
          isDebit = false;
          isCredit = true;
        }

        const debitAmt = Number(item.debitAmount);
        const creditAmt = Number(item.creditAmount);
        const amt = debitAmt > 0 ? debitAmt : creditAmt;

        if (isDebit) {
          totalBilled += amt;
        } else if (isCredit) {
          if (item.voucher.type === VoucherType.SALES_RETURN) {
            totalReturned += amt;
          } else {
            totalPaid += amt;
          }
        }
      }

      const netAsset = openingBalance + totalBilled - totalPaid - totalReturned;
      // Opening balance (DEBIT) counts as debit, negative opening (CREDIT) counts as credit
      const debit = totalBilled + (openingBalance > 0 ? openingBalance : 0);
      const credit = totalPaid + totalReturned + (openingBalance < 0 ? Math.abs(openingBalance) : 0);
      const balanceAsOnDate = netAsset;
      const isOverdue = balanceAsOnDate > 0;

      const earliestUnpaidDueDate = salesInvoices
        .filter((inv: any) => {
          const amount = Number(inv.grandTotal || inv.subTotal || 0);
          const pList = extractPaymentsArray(inv.payments);
          const pSum = pList.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
          const paidAmt = Math.max(pSum, Number((inv as any).paidAmount || 0));
          return amount - paidAmt > 0 && inv.dueDate;
        })
        .map((inv: any) => new Date(inv.dueDate))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];

      const dueDays = isOverdue
        ? earliestUnpaidDueDate
          ? Math.max(0, Math.floor((cutoffDate.getTime() - earliestUnpaidDueDate.getTime()) / 86400000))
          : null
        : 0;

      return {
        customerId: customer.id,
        customerCode: customer.customerCode,
        firmName: customer.firmName,
        gstin: customer.gstin,
        customerType: (customer as any).customerType || "CUSTOMER",
        phone: extractPrimaryPhone((customer as any).phone ?? (customer as any).mobile),
        lastTransactionDate: lastTxnDateObj ? lastTxnDateObj.toISOString().split("T")[0] : null,
        openingBalance,
        totalBilled,
        totalPaid,
        totalReturned,
        debit,
        credit,
        netBalance: balanceAsOnDate,
        balanceAsOnDate,
        overdueAmount: isOverdue ? balanceAsOnDate : 0,
        dueDays,
        isOverdue,
      };
    });

    return results;
  }

  /**
   * Per-customer invoice breakdown + collection history + statement.
   */
  async getCustomerReceivableDetail(customerId: string, options?: { startDate?: string; endDate?: string }): Promise<CustomerReceivableDetail> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new ApiError(404, `Customer with ID ${customerId} not found`);
    }

    const ledger = await accountsService.ensureCustomerLedger(customer);
    const statement = await accountsService.getLedgerStatement(ledger.id, options || {});

    // Fetch Sales Invoices for per-invoice breakdown. Explicit select
    // avoids the P2022 schema-drift crash on unused columns.
    const salesInvoices = await (prisma as any).salesInvoice.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        customerId: true,
        invoiceNo: true,
        invoiceDate: true,
        dueDate: true,
        createdAt: true,
        grandTotal: true,
        subTotal: true,
        payments: true,
      },
    });

    const invoices = salesInvoices.map((inv: any) => {
      const amount = Number(inv.grandTotal || inv.subTotal || 0);
      const pList = extractPaymentsArray(inv.payments);
      const paidAmount = Math.max(
        pList.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0),
        Number((inv as any).paidAmount || 0)
      );

      const balance = Math.max(0, amount - paidAmount);
      let status = "UNPAID";
      if (balance <= 0 && amount > 0) {
        status = "PAID";
      } else if (paidAmount > 0) {
        status = "PARTIAL";
      }

      return {
        id: inv.id,
        invoiceNo: inv.invoiceNo || `INV-${inv.id}`,
        date: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split("T")[0] : (inv.createdAt ? new Date(inv.createdAt).toISOString().split("T")[0] : ""),
        dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split("T")[0] : undefined,
        amount,
        paidAmount,
        balance,
        status,
      };
    });

    // Collection history from journal items / vouchers (RECEIPT + JOURNAL + PAYMENT)
    const collectionItems = await prisma.journalItem.findMany({
      where: {
        creditLedgerId: ledger.id,
        voucher: {
          type: { in: [VoucherType.RECEIPT, VoucherType.JOURNAL, VoucherType.PAYMENT] },
        },
      },
      include: { voucher: true },
      orderBy: { voucher: { date: "desc" } },
    });

    const collectionHistoryMap = new Map<string, any>();

    // Step A: Index posted RECEIPT vouchers
    collectionItems.forEach((item) => {
      const v = item.voucher;
      const voucherKey = v.id.toString();
      collectionHistoryMap.set(voucherKey, {
        id: voucherKey,
        voucherId: voucherKey,
        voucherNo: v.voucherNo,
        date: v.date.toISOString().split("T")[0],
        amount: Number(item.creditAmount),
        paymentMode: undefined,
        referenceNo: (v as any).referenceNo || undefined,
        narration: item.narration || v.narration || undefined,
        postedToLedger: true,
        sourceVoucherId: voucherKey,
        refDocId: v.refDocId || undefined,
      });
    });

    // Step B: Merge Sales Invoice JSON payment records into collection history map
    salesInvoices.forEach((inv: any) => {
      const pList = extractPaymentsArray(inv.payments);
      pList.forEach((p: any, idx: number) => {
        const paymentId = p.id ? String(p.id) : `${inv.id}_pay_${idx}`;
        const sourceVoucherId = p.sourceVoucherId ? String(p.sourceVoucherId) : undefined;

        // Try finding matching posted voucher
        let matchedVoucherKey: string | undefined = undefined;

        if (sourceVoucherId && collectionHistoryMap.has(sourceVoucherId)) {
          matchedVoucherKey = sourceVoucherId;
        } else {
          // Fallback matching by refDocId or voucherNo / reference number pattern
          for (const [key, entry] of collectionHistoryMap.entries()) {
            if (
              entry.refDocId === paymentId ||
              entry.refDocId === `${inv.id}_pay_${idx}` ||
              (p.referenceNumber && entry.referenceNo === p.referenceNumber && Math.abs(entry.amount - Number(p.amount || 0)) < 0.01)
            ) {
              matchedVoucherKey = key;
              break;
            }
          }
        }

        if (matchedVoucherKey) {
          // Merge Sales Invoice payment details (mode & reference number) into the voucher record
          const existingEntry = collectionHistoryMap.get(matchedVoucherKey);
          existingEntry.paymentMode = p.paymentMethod || existingEntry.paymentMode;
          existingEntry.referenceNo = p.referenceNumber || existingEntry.referenceNo;
          if (p.id) existingEntry.salesPaymentId = p.id;
        } else {
          // Sales Invoice payment entry has no posted ledger voucher -> render as unposted row
          const unpostedKey = `unposted-${paymentId}`;
          collectionHistoryMap.set(unpostedKey, {
            id: unpostedKey,
            voucherNo: p.referenceNumber || inv.invoiceNo || `RCT-INV-${inv.id}`,
            date: p.paymentDate ? new Date(p.paymentDate).toISOString().split("T")[0] : (inv.createdAt ? new Date(inv.createdAt).toISOString().split("T")[0] : ""),
            amount: Number(p.amount || 0),
            paymentMode: p.paymentMethod || undefined,
            referenceNo: p.referenceNumber || undefined,
            narration: `Receipt for Sales Invoice ${inv.invoiceNo}`,
            postedToLedger: false,
          });
        }
      });
    });

    const collectionHistory = Array.from(collectionHistoryMap.values());

    let totalBilled = 0;
    let totalPaid = 0;
    let totalReturned = 0;

    statement.entries.forEach((e) => {
      if (e.voucherType === "OPENING" || /opening balance/i.test(e.narration) || (e as any).refDocType === "CUSTOMER_OPENING_BALANCE") return;
      if (e.voucherType === VoucherType.SALES_RETURN) {
        totalReturned += e.credit || e.debit;
      } else if (e.voucherType === VoucherType.SALES) {
        totalBilled += e.debit;
      } else if (e.voucherType === VoucherType.RECEIPT) {
        totalPaid += e.credit;
      } else {
        totalBilled += e.debit;
        totalPaid += e.credit;
      }
    });

    // Sign opening balance by openingBalanceType — matches list-view convention.
    // CUSTOMER default = DEBIT (customer owes us, +). CREDIT = advance/overpaid (−).
    // Missing this sign made CREDIT openings inflate the closing balance
    // (mirror of the payable bug we fixed earlier).
    const rawOpBalDetail = Number(customer.openingBalance || 0);
    const opTypeDetail = ((customer as any).openingBalanceType || "DEBIT").toUpperCase();
    const signedOpeningDetail = opTypeDetail === "CREDIT" ? -Math.abs(rawOpBalDetail) : Math.abs(rawOpBalDetail);
    const closingBalance = signedOpeningDetail + totalBilled - totalPaid - totalReturned;

    return {
      customer: {
        id: customer.id,
        customerCode: customer.customerCode,
        firmName: customer.firmName,
        gstin: customer.gstin,
        customerType: (customer as any).customerType || "CUSTOMER",
        openingBalance: signedOpeningDetail,
      },
      ledger,
      summary: {
        openingBalance: signedOpeningDetail,
        totalBilled,
        totalPaid,
        totalReturned,
        closingBalance,
      },
      invoices,
      collectionHistory,
      statementEntries: statement.entries,
    };
  }
}

export const receivableService = new ReceivableService();
