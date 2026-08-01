import { prisma } from "../../config/prisma";
import { LedgerType, VoucherType, Prisma } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { accountsService } from "../accounts/accounts.service";
import { voucherPostingService } from "../accounts/voucherPosting.service";

export interface CustomerReceivableSummary {
  customerId: string;
  customerCode: string;
  firmName: string;
  contactPerson?: string | null;
  gstin?: string | null;
  phone?: string | null;
  customerType?: string | null;
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

export interface CustomerReceivableDetail {
  customer: {
    id: string;
    customerCode: string;
    firmName: string;
    gstin?: string | null;
    customerType?: string | null;
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
    try {
      const { voucherPostingService } = require("./voucherPosting.service");
      await voucherPostingService.syncUnpostedVouchers();
    } catch (err) {
      console.error("[ReceivableService] Sync unposted vouchers failed:", err);
    }

    const cutoffDate = params?.asOnDate ? new Date(params.asOnDate) : new Date();
    if (params?.asOnDate) {
      cutoffDate.setHours(23, 59, 59, 999);
    }

    const startDateObj = params?.startDate ? new Date(params.startDate) : undefined;
    const endDateObj = params?.endDate ? new Date(params.endDate) : undefined;
    if (endDateObj) endDateObj.setHours(23, 59, 59, 999);

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

    const results: CustomerReceivableSummary[] = [];

    for (const customer of customers) {
      const openingBalance = Number(customer.openingBalance || 0);

      // Ensure customer ledger exists
      const ledger = await accountsService.ensureCustomerLedger(customer);

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
        let isDebit = item.debitLedgerId === ledger.id;
        let isCredit = item.creditLedgerId === ledger.id;

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

      // Fetch Sales Invoices directly
      const salesInvoices = await (prisma as any).salesInvoice.findMany({
        where: {
          customerId: customer.id,
        },
      });

      let invoiceBilled = 0;
      let invoicePaid = 0;
      for (const inv of salesInvoices) {
        invoiceBilled += Number(inv.grandTotal || inv.subTotal || 0);
        const pList = extractPaymentsArray(inv.payments);
        const pSum = pList.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        invoicePaid += Math.max(pSum, Number((inv as any).paidAmount || 0));
      }

      totalBilled = Math.max(totalBilled, invoiceBilled);
      totalPaid = Math.max(totalPaid, invoicePaid);

      const netAsset = openingBalance + totalBilled - totalPaid - totalReturned;
      const debit = totalBilled;
      const credit = totalPaid + totalReturned;
      const balanceAsOnDate = netAsset;
      const isOverdue = balanceAsOnDate > 0;
      const dueDays = isOverdue ? 30 : 0;
      const netBalance = balanceAsOnDate;

      results.push({
        customerId: customer.id,
        customerCode: customer.customerCode,
        firmName: customer.firmName,
        contactPerson: (customer as any).contactPersonName || (customer as any).primaryContactName || null,
        gstin: customer.gstin,
        phone: (customer as any).phone || (customer as any).mobile || null,
        customerType: (customer as any).customerType || "CUSTOMER",
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
   * Per-customer invoice breakdown + collection history + statement.
   */
  async getCustomerReceivableDetail(customerId: string, options?: { startDate?: string; endDate?: string }): Promise<CustomerReceivableDetail> {
    try {
      const { voucherPostingService } = require("./voucherPosting.service");
      await voucherPostingService.syncUnpostedVouchers();
    } catch (err) {
      console.error("[ReceivableService] Sync unposted vouchers failed:", err);
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new ApiError(404, `Customer with ID ${customerId} not found`);
    }

    const ledger = await accountsService.ensureCustomerLedger(customer);
    await voucherPostingService.syncUnpostedVouchers();
    const statement = await accountsService.getLedgerStatement(ledger.id, options || {});

    // Fetch Sales Invoices for per-invoice breakdown
    const salesInvoices = await (prisma as any).salesInvoice.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
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

    // Collection history from journal items / vouchers
    const collectionItems = await prisma.journalItem.findMany({
      where: {
        creditLedgerId: ledger.id,
        voucher: { type: VoucherType.RECEIPT },
      },
      include: { voucher: true },
      orderBy: { voucher: { date: "desc" } },
    });

    const collectionHistoryMap = new Map<string, any>();

    collectionItems.forEach((item) => {
      collectionHistoryMap.set(item.voucher.id.toString(), {
        id: item.voucher.id.toString(),
        voucherNo: item.voucher.voucherNo,
        date: item.voucher.date.toISOString().split("T")[0],
        amount: Number(item.creditAmount),
        paymentMode: undefined,
        referenceNo: (item.voucher as any).referenceNo || undefined,
        narration: item.narration || item.voucher.narration || undefined,
      });
    });

    // Extract payments recorded inside Sales Invoices payments JSON array
    salesInvoices.forEach((inv: any) => {
      const pList = extractPaymentsArray(inv.payments);
      pList.forEach((p: any, idx: number) => {
        const idKey = p.id || `inv-pmt-${inv.id}-${idx}`;
        if (!collectionHistoryMap.has(idKey)) {
          collectionHistoryMap.set(idKey, {
            id: idKey,
            voucherNo: p.referenceNumber || inv.invoiceNo || `RCT-INV-${inv.id}`,
            date: p.paymentDate ? new Date(p.paymentDate).toISOString().split("T")[0] : (inv.createdAt ? new Date(inv.createdAt).toISOString().split("T")[0] : ""),
            amount: Number(p.amount || 0),
            paymentMode: p.paymentMethod || undefined,
            referenceNo: p.referenceNumber || undefined,
            narration: `Receipt for Sales Invoice ${inv.invoiceNo}`,
          });
        }
      });
    });

    const collectionHistory = Array.from(collectionHistoryMap.values());

    let totalBilled = 0;
    let totalPaid = 0;
    let totalReturned = 0;

    statement.entries.forEach((e) => {
      if (e.voucherType === "OPENING") return;
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

    let invBilled = 0;
    let invPaid = 0;
    invoices.forEach((inv: any) => {
      invBilled += inv.amount;
      invPaid += inv.paidAmount;
    });

    totalBilled = Math.max(totalBilled, invBilled);
    totalPaid = Math.max(totalPaid, invPaid);
    const closingBalance = Number(customer.openingBalance || 0) + totalBilled - totalPaid - totalReturned;

    return {
      customer: {
        id: customer.id,
        customerCode: customer.customerCode,
        firmName: customer.firmName,
        gstin: customer.gstin,
        customerType: (customer as any).customerType || "CUSTOMER",
        openingBalance: Number(customer.openingBalance || 0),
      },
      ledger,
      summary: {
        openingBalance: Number(customer.openingBalance || 0),
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
