import { prisma } from "../../config/prisma";
import { LedgerType, VoucherType, Prisma } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { accountsService } from "../accounts/accounts.service";
import { voucherPostingService } from "../accounts/voucherPosting.service";
import { extractPaymentsArray } from "../../utils/payments";

export interface SupplierPayableSummary {
  supplierId: number;
  supplierCode: string;
  legalName: string;
  gstin?: string | null;
  vendorType?: string | null;
  phone?: string | null;
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

export interface SupplierPayableDetail {
  supplier: {
    id: number;
    supplierCode: string;
    legalName: string;
    gstin?: string | null;
    vendorType?: string | null;
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
    grnNumber?: string;
    date: string;
    dueDate?: string;
    amount: number;
    paidAmount: number;
    balance: number;
    status: string;
  }>;
  paymentHistory: Array<{
    id: string;
    voucherNo: string;
    date: string;
    amount: number;
    paymentMode?: string;
    referenceNo?: string;
    narration?: string;
    postedToLedger?: boolean;
    sourceVoucherId?: string;
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


class PayableService {
  /**
   * List all suppliers with calculated outstanding balances as on date.
   */
  async getPayableSummaries(params?: {
    asOnDate?: string;
    startDate?: string;
    endDate?: string;
    supplierId?: string | number;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: SupplierPayableSummary[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.max(1, params?.limit || 50);

    const cutoffDate = params?.asOnDate ? new Date(params.asOnDate) : new Date();
    if (params?.asOnDate) {
      cutoffDate.setHours(23, 59, 59, 999);
    }

    const startDateObj = params?.startDate ? new Date(params.startDate) : undefined;
    const endDateObj = params?.endDate ? new Date(params.endDate) : undefined;
    if (endDateObj) endDateObj.setHours(23, 59, 59, 999);

    const supplierIdNum = params?.supplierId ? Number(params.supplierId) : undefined;

    const whereClause: Prisma.SupplierWhereInput = {
      ...(supplierIdNum && { id: supplierIdNum }),
      ...(params?.search && {
        OR: [
          { legalName: { contains: params.search, mode: "insensitive" } },
          { supplierCode: { contains: params.search, mode: "insensitive" } },
        ],
      }),
    };

    const total = await prisma.supplier.count({ where: whereClause });
    const totalPages = Math.ceil(total / limit) || 1;

    const suppliers = await prisma.supplier.findMany({
      where: whereClause,
      orderBy: { legalName: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const supplierIds = suppliers.map((s) => s.id);

    // 1. Fetch existing ledgers in batch
    const existingLedgers = await prisma.accountLedger.findMany({
      where: { supplierId: { in: supplierIds } },
    });
    const ledgerMap = new Map<number, any>();
    existingLedgers.forEach((l) => {
      if (l.supplierId) ledgerMap.set(l.supplierId, l);
    });

    // 2. Only ensure ledgers for suppliers missing a ledger
    const missingSuppliers = suppliers.filter((s) => !ledgerMap.has(s.id));
    if (missingSuppliers.length > 0) {
      const createdLedgers = await Promise.all(
        missingSuppliers.map((s) => accountsService.ensureSupplierLedger(s))
      );
      createdLedgers.forEach((l) => {
        if (l.supplierId) ledgerMap.set(l.supplierId, l);
      });
    }

    const ledgerIds = Array.from(ledgerMap.values()).map((l) => l.id);

    const voucherDateFilter: Prisma.DateTimeFilter = {
      ...(startDateObj && { gte: startDateObj }),
      ...(endDateObj ? { lte: endDateObj } : { lte: cutoffDate }),
    };

    // 3. Fetch all journal items and GRN invoices for target suppliers in batch queries
    const [allJournalItems, allGrnInvoices] = await Promise.all([
      prisma.journalItem.findMany({
        where: {
          OR: [{ debitLedgerId: { in: ledgerIds } }, { creditLedgerId: { in: ledgerIds } }],
          voucher: {
            date: voucherDateFilter,
          },
        },
        include: {
          voucher: true,
        },
      }),
      (prisma as any).grnInvoice.findMany({
        where: {
          supplierId: { in: supplierIds },
        },
      }),
    ]);

    // Group journal items by ledger ID
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

    // Group GRN invoices by supplier ID
    const grnsBySupplier = new Map<number, any[]>();
    for (const grn of allGrnInvoices) {
      const list = grnsBySupplier.get(grn.supplierId) || [];
      list.push(grn);
      grnsBySupplier.set(grn.supplierId, list);
    }

    const data: SupplierPayableSummary[] = suppliers.map((supplier) => {
      const openingBalance = Number(supplier.openingBalance || 0);
      const ledger = ledgerMap.get(supplier.id);
      const journalItems = ledger ? itemsByLedger.get(ledger.id) || [] : [];
      const grnInvoices = grnsBySupplier.get(supplier.id) || [];

      let totalBilled = 0;
      let totalPaid = 0;
      let totalReturned = 0;

      for (const item of journalItems) {
        if (item.voucher.refDocType === "SUPPLIER_OPENING_BALANCE" || item.narration?.includes("Opening balance")) {
          continue;
        }

        let isCredit = item.creditLedgerId === ledger?.id;
        let isDebit = item.debitLedgerId === ledger?.id;

        if (item.voucher.type === VoucherType.PURCHASE_RETURN) {
          isCredit = false;
          isDebit = true;
        }

        const creditAmt = Number(item.creditAmount);
        const debitAmt = Number(item.debitAmount);
        const amt = creditAmt > 0 ? creditAmt : debitAmt;

        if (isCredit) {
          totalBilled += amt;
        } else if (isDebit) {
          if (item.voucher.type === VoucherType.PURCHASE_RETURN) {
            totalReturned += amt;
          } else {
            totalPaid += amt;
          }
        }
      }

      // BUG-2 FIX: Do NOT use Math.max(ledger_total, grn_raw_total).
      // GRN raw amounts independently duplicate what was already captured in journal items,
      // including the opening-balance journal voucher amount — causing the balance to appear doubled.
      // Instead, derive totals purely from journal items (SUPPLIER_OPENING_BALANCE is already skipped above).

      const netLiability = openingBalance + totalBilled - totalPaid - totalReturned;
      const credit = totalBilled;
      const debit = totalPaid + totalReturned;
      const balanceAsOnDate = netLiability;
      const isOverdue = balanceAsOnDate > 0;

      const earliestUnpaidDueDate = grnInvoices
        .filter((g: any) => {
          const b = Number(g.netAmount || g.subtotal || g.grandTotal || g.totalAmount || 0);
          const pList = extractPaymentsArray(g.payments);
          const pSum = pList.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
          const pAmt = Math.max(pSum, Number(g.paidAmount || 0));
          return b - pAmt > 0 && g.billDueDate;
        })
        .map((g: any) => new Date(g.billDueDate))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];

      const dueDays = isOverdue
        ? earliestUnpaidDueDate
          ? Math.max(0, Math.floor((cutoffDate.getTime() - earliestUnpaidDueDate.getTime()) / 86400000))
          : null
        : 0;

      const netBalance = balanceAsOnDate;

      return {
        supplierId: supplier.id,
        supplierCode: supplier.supplierCode,
        legalName: supplier.legalName,
        gstin: supplier.gstin,
        vendorType: (supplier as any).vendorType || "SUPPLIER",
        phone: (supplier as any).phone || (supplier as any).mobile || null,
        openingBalance,
        totalBilled,
        totalPaid,
        totalReturned,
        debit,
        credit,
        netBalance,
        balanceAsOnDate,
        overdueAmount: isOverdue ? balanceAsOnDate : 0,
        dueDays,
        isOverdue,
      };
    });

    return { data, total, page, totalPages };
  }

  /**
   * Per-supplier invoice breakdown + payment history + statement.
   */
  async getSupplierPayableDetail(supplierId: number, options?: { startDate?: string; endDate?: string }): Promise<SupplierPayableDetail> {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new ApiError(404, `Supplier with ID ${supplierId} not found`);
    }

    const ledger = await accountsService.ensureSupplierLedger(supplier);
    const statement = await accountsService.getLedgerStatement(ledger.id, options || {});

    // Fetch GRN Invoices for per-invoice breakdown
    const grnInvoices = await (prisma as any).grnInvoice.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: "desc" },
    });

    const invoices = grnInvoices.map((grn: any) => {
      const amount = Number(grn.netAmount || grn.subtotal || grn.grandTotal || grn.totalAmount || 0);
      const pList = extractPaymentsArray(grn.payments);
      const paidAmount = Math.max(
        pList.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0),
        Number(grn.paidAmount || 0)
      );

      const balance = Math.max(0, amount - paidAmount);
      let status = "UNPAID";
      if (balance <= 0 && amount > 0) {
        status = "PAID";
      } else if (paidAmount > 0) {
        status = "PARTIAL";
      }

      return {
        id: grn.id,
        invoiceNo: grn.invoiceNo || grn.grnNumber || `INV-${grn.id}`,
        grnNumber: grn.grnNumber,
        date: grn.grnDate ? new Date(grn.grnDate).toISOString().split("T")[0] : (grn.createdAt ? new Date(grn.createdAt).toISOString().split("T")[0] : ""),
        dueDate: grn.billDueDate ? new Date(grn.billDueDate).toISOString().split("T")[0] : undefined,
        amount,
        paidAmount,
        balance,
        status,
      };
    });

    // Payment history from journal items / vouchers (PAYMENT + JOURNAL)
    const paymentItems = await prisma.journalItem.findMany({
      where: {
        debitLedgerId: ledger.id,
        voucher: {
          type: { in: [VoucherType.PAYMENT, VoucherType.JOURNAL] },
        },
      },
      include: { voucher: true },
      orderBy: { voucher: { date: "desc" } },
    });

    const paymentHistoryMap = new Map<string, any>();

    // Step A: Index posted payment vouchers
    paymentItems.forEach((item) => {
      const v = item.voucher;
      const voucherKey = v.id.toString();
      paymentHistoryMap.set(voucherKey, {
        id: voucherKey,
        voucherId: voucherKey,
        voucherNo: v.voucherNo,
        date: v.date.toISOString().split("T")[0],
        amount: Number(item.debitAmount),
        paymentMode: undefined,
        referenceNo: (v as any).referenceNo || undefined,
        narration: item.narration || v.narration || undefined,
        postedToLedger: true,
        sourceVoucherId: voucherKey,
        refDocId: v.refDocId || undefined,
      });
    });

    // Step B: Merge GRN JSON payment records into payment history map
    grnInvoices.forEach((grn: any) => {
      const pList = extractPaymentsArray(grn.payments);
      pList.forEach((p: any, idx: number) => {
        const paymentId = p.id ? String(p.id) : `${grn.id}_pay_${idx}`;
        const sourceVoucherId = p.sourceVoucherId ? String(p.sourceVoucherId) : undefined;

        // Try finding matching posted voucher
        let matchedVoucherKey: string | undefined = undefined;

        if (sourceVoucherId && paymentHistoryMap.has(sourceVoucherId)) {
          matchedVoucherKey = sourceVoucherId;
        } else {
          // Fallback matching by refDocId or voucherNo pattern
          for (const [key, entry] of paymentHistoryMap.entries()) {
            if (
              entry.refDocId === paymentId ||
              entry.refDocId === `${grn.id}_pay_${idx}` ||
              (p.referenceNumber && entry.referenceNo === p.referenceNumber && Math.abs(entry.amount - Number(p.amount || 0)) < 0.01)
            ) {
              matchedVoucherKey = key;
              break;
            }
          }
        }

        if (matchedVoucherKey) {
          // Merge GRN payment details (mode & reference number) into the voucher record
          const existingEntry = paymentHistoryMap.get(matchedVoucherKey);
          existingEntry.paymentMode = p.paymentMethod || existingEntry.paymentMode;
          existingEntry.referenceNo = p.referenceNumber || existingEntry.referenceNo;
          if (p.id) existingEntry.grnPaymentId = p.id;
        } else {
          // GRN payment entry has no posted ledger voucher -> render as unposted row
          const unpostedKey = `unposted-${paymentId}`;
          paymentHistoryMap.set(unpostedKey, {
            id: unpostedKey,
            voucherNo: p.referenceNumber || grn.grnNumber || `PAY-GRN-${grn.id}`,
            date: p.paymentDate ? new Date(p.paymentDate).toISOString().split("T")[0] : (grn.createdAt ? new Date(grn.createdAt).toISOString().split("T")[0] : ""),
            amount: Number(p.amount || 0),
            paymentMode: p.paymentMethod || undefined,
            referenceNo: p.referenceNumber || undefined,
            narration: `Payment for GRN ${grn.grnNumber || grn.invoiceNo || grn.id}`,
            postedToLedger: false,
          });
        }
      });
    });

    const paymentHistory = Array.from(paymentHistoryMap.values());

    let totalBilled = 0;
    let totalPaid = 0;
    let totalReturned = 0;

    statement.entries.forEach((e) => {
      if (e.voucherType === "OPENING" || /opening balance/i.test(e.narration) || (e as any).refDocType === "SUPPLIER_OPENING_BALANCE") return;
      if (e.voucherType === VoucherType.PURCHASE_RETURN) {
        totalReturned += e.debit || e.credit;
      } else if (e.voucherType === VoucherType.PURCHASE) {
        totalBilled += e.credit;
      } else if (e.voucherType === VoucherType.PAYMENT) {
        totalPaid += e.debit;
      } else {
        totalBilled += e.credit;
        totalPaid += e.debit;
      }
    });

    // BUG-2 FIX: Use only journal-entry-based totals (openingBalance entry already excluded above).
    // GRN-raw fallback caused double-counting when the opening balance voucher matched the GRN amount.
    const closingBalance = Number(supplier.openingBalance || 0) + totalBilled - totalPaid - totalReturned;

    return {
      supplier: {
        id: supplier.id,
        supplierCode: supplier.supplierCode,
        legalName: supplier.legalName,
        gstin: supplier.gstin,
        vendorType: (supplier as any).vendorType || "SUPPLIER",
        openingBalance: Number(supplier.openingBalance || 0),
      },
      ledger,
      summary: {
        openingBalance: Number(supplier.openingBalance || 0),
        totalBilled,
        totalPaid,
        totalReturned,
        closingBalance,
      },
      invoices,
      paymentHistory,
      statementEntries: statement.entries,
    };
  }
}

export const payableService = new PayableService();
