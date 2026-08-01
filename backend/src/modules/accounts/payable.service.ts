import { prisma } from "../../config/prisma";
import { LedgerType, VoucherType, Prisma } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { accountsService } from "../accounts/accounts.service";
import { voucherPostingService } from "../accounts/voucherPosting.service";

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
  dueDays: number;
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
  }): Promise<SupplierPayableSummary[]> {
    // Auto-sync any unposted purchase & payment vouchers
    try {
      const { voucherPostingService } = require("./voucherPosting.service");
      await voucherPostingService.syncUnpostedVouchers();
    } catch (err) {
      console.error("[PayableService] Sync unposted vouchers failed:", err);
    }

    const cutoffDate = params?.asOnDate ? new Date(params.asOnDate) : new Date();
    if (params?.asOnDate) {
      cutoffDate.setHours(23, 59, 59, 999);
    }

    const startDateObj = params?.startDate ? new Date(params.startDate) : undefined;
    const endDateObj = params?.endDate ? new Date(params.endDate) : undefined;
    if (endDateObj) endDateObj.setHours(23, 59, 59, 999);

    const supplierIdNum = params?.supplierId ? Number(params.supplierId) : undefined;

    const suppliers = await prisma.supplier.findMany({
      where: {
        ...(supplierIdNum && { id: supplierIdNum }),
        ...(params?.search && {
          OR: [
            { legalName: { contains: params.search, mode: "insensitive" } },
            { supplierCode: { contains: params.search, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { legalName: "asc" },
    });

    const results: SupplierPayableSummary[] = [];

    for (const supplier of suppliers) {
      const openingBalance = Number(supplier.openingBalance || 0);

      // Ensure supplier ledger exists
      const ledger = await accountsService.ensureSupplierLedger(supplier);

      const voucherDateFilter: Prisma.DateTimeFilter = {
        ...(startDateObj && { gte: startDateObj }),
        ...(endDateObj ? { lte: endDateObj } : { lte: cutoffDate }),
      };

      // Aggregate journal items up to cutoffDate
      const journalItems = await prisma.journalItem.findMany({
        where: {
          OR: [{ debitLedgerId: ledger.id }, { creditLedgerId: ledger.id }],
          voucher: {
            date: voucherDateFilter,
          },
        },
        include: {
          voucher: true,
        },
      });

      let totalBilled = 0;
      let totalPaid = 0;
      let totalReturned = 0;

      for (const item of journalItems) {
        let isCredit = item.creditLedgerId === ledger.id;
        let isDebit = item.debitLedgerId === ledger.id;

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

      // Fetch GRN Invoices for this supplier
      const grnInvoices = await (prisma as any).grnInvoice.findMany({
        where: {
          supplierId: supplier.id,
        },
      });

      let grnBilled = 0;
      let grnPaid = 0;
      for (const grn of grnInvoices) {
        grnBilled += Number(grn.netAmount || grn.subtotal || grn.grandTotal || grn.totalAmount || 0);
        const pList = extractPaymentsArray(grn.payments);
        const pSum = pList.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        grnPaid += Math.max(pSum, Number(grn.paidAmount || 0));
      }

      totalBilled = Math.max(totalBilled, grnBilled);
      totalPaid = Math.max(totalPaid, grnPaid);

      const netLiability = openingBalance + totalBilled - totalPaid - totalReturned;
      const credit = totalBilled;
      const debit = totalPaid + totalReturned;
      const balanceAsOnDate = netLiability;
      const isOverdue = balanceAsOnDate > 0;
      const dueDays = isOverdue ? 30 : 0;
      const netBalance = balanceAsOnDate;

      results.push({
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
      });
    }

    return results;
  }

  /**
   * Per-supplier invoice breakdown + payment history + statement.
   */
  async getSupplierPayableDetail(supplierId: number, options?: { startDate?: string; endDate?: string }): Promise<SupplierPayableDetail> {
    try {
      const { voucherPostingService } = require("./voucherPosting.service");
      await voucherPostingService.syncUnpostedVouchers();
    } catch (err) {
      console.error("[PayableService] Sync unposted vouchers failed:", err);
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new ApiError(404, `Supplier with ID ${supplierId} not found`);
    }

    const ledger = await accountsService.ensureSupplierLedger(supplier);
    await voucherPostingService.syncUnpostedVouchers();
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

    // Payment history from journal items / vouchers
    const paymentItems = await prisma.journalItem.findMany({
      where: {
        debitLedgerId: ledger.id,
        voucher: { type: VoucherType.PAYMENT },
      },
      include: { voucher: true },
      orderBy: { voucher: { date: "desc" } },
    });

    const paymentHistoryMap = new Map<string, any>();

    paymentItems.forEach((item) => {
      paymentHistoryMap.set(item.voucher.id.toString(), {
        id: item.voucher.id.toString(),
        voucherNo: item.voucher.voucherNo,
        date: item.voucher.date.toISOString().split("T")[0],
        amount: Number(item.debitAmount),
        paymentMode: undefined,
        referenceNo: (item.voucher as any).referenceNo || undefined,
        narration: item.narration || item.voucher.narration || undefined,
      });
    });

    // Extract payments recorded inside GRN Invoices payments JSON array
    grnInvoices.forEach((grn: any) => {
      const pList = extractPaymentsArray(grn.payments);
      pList.forEach((p: any, idx: number) => {
        const idKey = p.id || `grn-pmt-${grn.id}-${idx}`;
        if (!paymentHistoryMap.has(idKey)) {
          paymentHistoryMap.set(idKey, {
            id: idKey,
            voucherNo: p.referenceNumber || grn.grnNumber || `PAY-GRN-${grn.id}`,
            date: p.paymentDate ? new Date(p.paymentDate).toISOString().split("T")[0] : (grn.createdAt ? new Date(grn.createdAt).toISOString().split("T")[0] : ""),
            amount: Number(p.amount || 0),
            paymentMode: p.paymentMethod || undefined,
            referenceNo: p.referenceNumber || undefined,
            narration: `Payment for GRN ${grn.grnNumber || grn.invoiceNo || grn.id}`,
          });
        }
      });
    });

    const paymentHistory = Array.from(paymentHistoryMap.values());

    let totalBilled = 0;
    let totalPaid = 0;
    let totalReturned = 0;

    statement.entries.forEach((e) => {
      if (e.voucherType === "OPENING") return;
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

    let grnBilled = 0;
    let grnPaid = 0;
    invoices.forEach((inv: any) => {
      grnBilled += inv.amount;
      grnPaid += inv.paidAmount;
    });

    totalBilled = Math.max(totalBilled, grnBilled);
    totalPaid = Math.max(totalPaid, grnPaid);
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
