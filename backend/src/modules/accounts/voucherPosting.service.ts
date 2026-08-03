import { prisma } from "../../config/prisma";
import { VoucherType, Prisma } from "@prisma/client";
import { accountsService } from "./accounts.service";

import { extractPaymentsArray } from "../../utils/payments";

class VoucherPostingService {
  /**
   * Post a formal double-entry PURCHASE Voucher for a GRN Purchase Invoice.
   * Debit: Purchase Account (PURCH-001)
   * Credit: Supplier Account Ledger
   */
  async postPurchaseVoucher(grnInvoiceId: string, txClient?: Prisma.TransactionClient) {
    const db = txClient || prisma;
    const grnInvoice = await db.grnInvoice.findUnique({
      where: { id: grnInvoiceId },
      include: { supplier: true },
    });

    if (!grnInvoice || !grnInvoice.supplier) {
      console.warn(`[Auto-Post Voucher] GRN Invoice ${grnInvoiceId} not found or missing supplier.`);
      return null;
    }

    // Ensure system ledgers & party ledger exist
    await accountsService.ensureSystemLedgersExist(db);
    const purchaseLedger = await db.accountLedger.findUnique({ where: { code: "PURCH-001" } });
    const supplierLedger = await accountsService.ensureSupplierLedger(grnInvoice.supplier, db);

    if (!purchaseLedger || !supplierLedger) {
      console.error("[Auto-Post Voucher Error] Missing purchase or supplier ledger");
      return null;
    }

    // Check if purchase voucher already posted for this refDocId
    let voucher = await db.voucher.findFirst({
      where: {
        refDocType: "GRN_INVOICE",
        refDocId: grnInvoice.id,
      },
    });

    if (!voucher) {
      const g: any = grnInvoice;
      const netAmount = new Prisma.Decimal(g.netAmount || g.subtotal || g.grandTotal || g.totalAmount || 0);
      const voucherNo = `PUR-${grnInvoice.grnNumber || grnInvoice.id.slice(-6)}`;
      const date = grnInvoice.grnDate || grnInvoice.createdAt;

      voucher = await db.voucher.create({
        data: {
          voucherNo,
          type: VoucherType.PURCHASE,
          date,
          narration: `Purchase invoice posted for GRN ${grnInvoice.grnNumber || grnInvoice.invoiceNo}`,
          refDocType: "GRN_INVOICE",
          refDocId: grnInvoice.id,
          items: {
            create: [
              {
                debitLedgerId: purchaseLedger.id,
                debitAmount: netAmount,
                creditAmount: new Prisma.Decimal(0),
                narration: `Purchase of raw materials / goods`,
              },
              {
                creditLedgerId: supplierLedger.id,
                debitAmount: new Prisma.Decimal(0),
                creditAmount: netAmount,
                narration: `Liability payable to ${grnInvoice.supplier.legalName}`,
              },
            ],
          },
        },
        include: { items: true },
      });
    }

    // Also post payment vouchers for any payments on this GRN Invoice
    await this.postPaymentVouchersForGRN(grnInvoice.id, db);

    return voucher;
  }

  /**
   * Post double-entry PAYMENT Vouchers for all payments recorded on a GRN Purchase Invoice.
   * Debit: Supplier Account Ledger (Liability decrease)
   * Credit: Cash in Hand (CASH-001) or Main Bank Account (BANK-001) (Asset decrease)
   */
  async postPaymentVouchersForGRN(grnInvoiceId: string, txClient?: Prisma.TransactionClient) {
    const db = txClient || prisma;
    const grnInvoice = await db.grnInvoice.findUnique({
      where: { id: grnInvoiceId },
      include: { supplier: true },
    });

    if (!grnInvoice || !grnInvoice.supplier) {
      return [];
    }

    await accountsService.ensureSystemLedgersExist(db);
    const supplierLedger = await accountsService.ensureSupplierLedger(grnInvoice.supplier, db);
    const cashLedger = await db.accountLedger.findUnique({ where: { code: "CASH-001" } });
    const bankLedger = await db.accountLedger.findUnique({ where: { code: "BANK-001" } });

    if (!supplierLedger || !cashLedger || !bankLedger) {
      console.error("[Auto-Post Payment Voucher Error] Missing ledgers");
      return [];
    }

    const rawPayments: any[] = extractPaymentsArray(grnInvoice.payments);

    const postedVouchers: any[] = [];

    for (let index = 0; index < rawPayments.length; index++) {
      const p = rawPayments[index];
      const amountNum = Math.round((Number(p.amount) || 0) * 100) / 100;
      if (amountNum <= 0) continue;

      const refDocId = p.id ? String(p.id) : `${grnInvoice.id}_pay_${index}`;

      const existing = await db.voucher.findFirst({
        where: {
          refDocType: "GRN_PAYMENT",
          refDocId: refDocId,
        },
      });

      if (existing) {
        if (!p.sourceVoucherId) {
          p.sourceVoucherId = String(existing.id);
        }
        postedVouchers.push(existing);
        continue;
      }

      const method = (p.paymentMethod || "").toLowerCase();
      const isCash = method.includes("cash");
      const payLedgerId = isCash ? cashLedger.id : bankLedger.id;
      const payLedgerName = isCash ? "Cash in Hand" : "Main Bank Account";

      const amountDec = new Prisma.Decimal(amountNum);
      const suffix = rawPayments.length > 1 ? `-${index + 1}` : "";
      const voucherNo = `PAY-${grnInvoice.grnNumber || grnInvoice.invoiceNo || grnInvoice.id.slice(-6)}${suffix}`;
      const pDate = p.paymentDate ? new Date(p.paymentDate) : (grnInvoice.grnDate || grnInvoice.createdAt);

      const voucher = await db.voucher.create({
        data: {
          voucherNo,
          type: VoucherType.PAYMENT,
          date: pDate,
          narration: `Payment made to ${grnInvoice.supplier.legalName} for GRN ${grnInvoice.grnNumber || grnInvoice.invoiceNo}${p.referenceNumber ? ` (Ref: ${p.referenceNumber})` : ""}`,
          refDocType: "GRN_PAYMENT",
          refDocId: refDocId,
          items: {
            create: [
              {
                debitLedgerId: supplierLedger.id,
                debitAmount: amountDec,
                creditAmount: new Prisma.Decimal(0),
                narration: `Liability settled for ${grnInvoice.supplier.legalName}`,
              },
              {
                creditLedgerId: payLedgerId,
                debitAmount: new Prisma.Decimal(0),
                creditAmount: amountDec,
                narration: `Paid via ${p.paymentMethod || payLedgerName}`,
              },
            ],
          },
        },
        include: { items: true },
      });

      p.sourceVoucherId = String(voucher.id);
      postedVouchers.push(voucher);
    }

    // Persist updated payments array with sourceVoucherId references
    try {
      await db.grnInvoice.update({
        where: { id: grnInvoice.id },
        data: { payments: rawPayments as any },
      });
    } catch (err) {
      console.error("[postPaymentVouchersForGRN] Failed to update grnInvoice payments array with sourceVoucherId:", err);
    }

    return postedVouchers;
  }

  /**
   * Post a formal double-entry SALES Voucher for a Sales Invoice.
   * Debit: Customer Account Ledger
   * Credit: Sales Account (SALES-001)
   */
  async postSalesVoucher(salesInvoiceId: string, txClient?: Prisma.TransactionClient) {
    const db = txClient || prisma;
    const salesInvoice = await db.salesInvoice.findUnique({
      where: { id: salesInvoiceId },
      include: { customer: true },
    });

    if (!salesInvoice || !salesInvoice.customer) {
      console.warn(`[Auto-Post Voucher] Sales Invoice ${salesInvoiceId} not found or missing customer.`);
      return null;
    }

    await accountsService.ensureSystemLedgersExist(db);
    const salesLedger = await db.accountLedger.findUnique({ where: { code: "SALES-001" } });
    const customerLedger = await accountsService.ensureCustomerLedger(salesInvoice.customer, db);

    if (!salesLedger || !customerLedger) {
      console.error("[Auto-Post Voucher Error] Missing sales or customer ledger");
      return null;
    }

    let voucher = await db.voucher.findFirst({
      where: {
        refDocType: "SALES_INVOICE",
        refDocId: salesInvoice.id,
      },
    });

    if (!voucher) {
      const grandTotal = new Prisma.Decimal(salesInvoice.grandTotal || salesInvoice.subTotal || 0);
      const voucherNo = `SLS-${salesInvoice.invoiceNo || salesInvoice.id.slice(-6)}`;
      const date = salesInvoice.invoiceDate || salesInvoice.createdAt;

      voucher = await db.voucher.create({
        data: {
          voucherNo,
          type: VoucherType.SALES,
          date,
          narration: `Sales invoice posted for ${salesInvoice.invoiceNo}`,
          refDocType: "SALES_INVOICE",
          refDocId: salesInvoice.id,
          items: {
            create: [
              {
                debitLedgerId: customerLedger.id,
                debitAmount: grandTotal,
                creditAmount: new Prisma.Decimal(0),
                narration: `Receivable from ${salesInvoice.customer.firmName}`,
              },
              {
                creditLedgerId: salesLedger.id,
                debitAmount: new Prisma.Decimal(0),
                creditAmount: grandTotal,
                narration: `Revenue credited to Sales Account`,
              },
            ],
          },
        },
        include: { items: true },
      });
    }

    // Also post receipt vouchers for any payments on this Sales Invoice
    await this.postReceiptVouchersForSales(salesInvoice.id, db);

    return voucher;
  }

  /**
   * Post double-entry RECEIPT Vouchers for all payments received on a Sales Invoice.
   * Debit: Cash in Hand (CASH-001) or Main Bank Account (BANK-001) (Asset increase)
   * Credit: Customer Account Ledger (Asset / Receivable decrease)
   */
  async postReceiptVouchersForSales(salesInvoiceId: string, txClient?: Prisma.TransactionClient) {
    const db = txClient || prisma;
    const salesInvoice = await db.salesInvoice.findUnique({
      where: { id: salesInvoiceId },
      include: { customer: true },
    });

    if (!salesInvoice || !salesInvoice.customer) {
      return [];
    }

    await accountsService.ensureSystemLedgersExist(db);
    const customerLedger = await accountsService.ensureCustomerLedger(salesInvoice.customer, db);
    const cashLedger = await db.accountLedger.findUnique({ where: { code: "CASH-001" } });
    const bankLedger = await db.accountLedger.findUnique({ where: { code: "BANK-001" } });

    if (!customerLedger || !cashLedger || !bankLedger) {
      console.error("[Auto-Post Receipt Voucher Error] Missing ledgers");
      return [];
    }

    const rawPayments: any[] = extractPaymentsArray(salesInvoice.payments);

    const postedVouchers: any[] = [];

    for (let index = 0; index < rawPayments.length; index++) {
      const p = rawPayments[index];
      const amountNum = Math.round((Number(p.amount) || 0) * 100) / 100;
      if (amountNum <= 0) continue;

      const refDocId = p.id ? String(p.id) : `${salesInvoice.id}_rcpt_${index}`;

      const existing = await db.voucher.findFirst({
        where: {
          refDocType: "SALES_PAYMENT",
          refDocId: refDocId,
        },
      });

      if (existing) {
        postedVouchers.push(existing);
        continue;
      }

      const method = (p.paymentMethod || "").toLowerCase();
      const isCash = method.includes("cash");
      const payLedgerId = isCash ? cashLedger.id : bankLedger.id;
      const payLedgerName = isCash ? "Cash in Hand" : "Main Bank Account";

      const amountDec = new Prisma.Decimal(amountNum);
      const suffix = rawPayments.length > 1 ? `-${index + 1}` : "";
      const voucherNo = `RCT-${salesInvoice.invoiceNo || salesInvoice.id.slice(-6)}${suffix}`;
      const pDate = p.paymentDate ? new Date(p.paymentDate) : (salesInvoice.invoiceDate || salesInvoice.createdAt);

      const voucher = await db.voucher.create({
        data: {
          voucherNo,
          type: VoucherType.RECEIPT,
          date: pDate,
          narration: `Payment received from ${salesInvoice.customer.firmName} for Invoice ${salesInvoice.invoiceNo}${p.referenceNumber ? ` (Ref: ${p.referenceNumber})` : ""}`,
          refDocType: "SALES_PAYMENT",
          refDocId: refDocId,
          items: {
            create: [
              {
                debitLedgerId: payLedgerId,
                debitAmount: amountDec,
                creditAmount: new Prisma.Decimal(0),
                narration: `Received via ${p.paymentMethod || payLedgerName}`,
              },
              {
                creditLedgerId: customerLedger.id,
                debitAmount: new Prisma.Decimal(0),
                creditAmount: amountDec,
                narration: `Receivable settled for ${salesInvoice.customer.firmName}`,
              },
            ],
          },
        },
        include: { items: true },
      });

      p.sourceVoucherId = String(voucher.id);
      postedVouchers.push(voucher);
    }

    // Persist updated payments array with sourceVoucherId references
    try {
      await db.salesInvoice.update({
        where: { id: salesInvoice.id },
        data: { payments: rawPayments as any },
      });
    } catch (err) {
      console.error("[postReceiptVouchersForSales] Failed to update salesInvoice payments array with sourceVoucherId:", err);
    }

    return postedVouchers;
  }

  /**
   * Post formal double-entry SALES_RETURN Voucher for a Sales Return.
   * Debit: Sales Return Account (SRT-001)
   * Credit: Customer Account Ledger
   * Plus optional settlement payment voucher if refundMode is CASH or BANK.
   */
  async postSalesReturnVoucher(salesReturnId: string, txClient?: Prisma.TransactionClient) {
    const db = txClient || prisma;
    const salesReturn = await db.salesReturn.findUnique({
      where: { id: salesReturnId },
      include: { customer: true },
    });

    if (!salesReturn || !salesReturn.customer) {
      console.warn(`[Auto-Post Voucher] Sales Return ${salesReturnId} not found or missing customer.`);
      return null;
    }

    await accountsService.ensureSystemLedgersExist(db);
    const customerLedger = await accountsService.ensureCustomerLedger(salesReturn.customer, db);
    let salesReturnLedger = await db.accountLedger.findUnique({ where: { code: "SRT-001" } });
    if (!salesReturnLedger) {
      const srList = await db.accountLedger.findMany({
        where: { name: { contains: "Sales Return", mode: "insensitive" } },
      });
      salesReturnLedger = srList.length > 0 ? srList[0] : null;
    }

    if (!salesReturnLedger || !customerLedger) {
      console.error("[Auto-Post Voucher Error] Missing sales return or customer ledger");
      return null;
    }

    const existing = await db.voucher.findFirst({
      where: { refDocType: "SALES_RETURN", refDocId: salesReturn.id },
    });
    if (existing) return existing;

    const grandTotal = new Prisma.Decimal(salesReturn.grandTotal);
    const voucherNo = `SRT-${salesReturn.returnNo}`;

    const voucher = await db.voucher.create({
      data: {
        voucherNo,
        type: VoucherType.SALES_RETURN,
        date: salesReturn.returnDate,
        narration: `Sales return posted for ${salesReturn.returnNo}${salesReturn.salesInvoiceId ? ` against invoice ${salesReturn.salesInvoiceId}` : ""}`,
        refDocType: "SALES_RETURN",
        refDocId: salesReturn.id,
        items: {
          create: [
            {
              debitLedgerId: salesReturnLedger.id,
              debitAmount: grandTotal,
              creditAmount: new Prisma.Decimal(0),
              narration: `Sales return — goods returned by ${salesReturn.customer.firmName}`,
            },
            {
              creditLedgerId: customerLedger.id,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: grandTotal,
              narration: `Receivable reduced for ${salesReturn.customer.firmName}`,
            },
          ],
        },
      },
      include: { items: true },
    });

    if (salesReturn.refundMode === "CASH" || salesReturn.refundMode === "BANK") {
      const payLedgerCode = salesReturn.refundMode === "CASH" ? "CASH-001" : "BANK-001";
      let payLedger = await db.accountLedger.findUnique({ where: { code: payLedgerCode } });
      if (!payLedger) {
        payLedger = await db.accountLedger.findFirst({
          where: { name: { contains: salesReturn.refundMode === "CASH" ? "Cash" : "Bank", mode: "insensitive" } },
        });
      }
      if (payLedger) {
        await db.voucher.create({
          data: {
            voucherNo: `SRT-PAY-${salesReturn.returnNo}`,
            type: VoucherType.PAYMENT,
            date: salesReturn.returnDate,
            narration: `Refund paid to ${salesReturn.customer.firmName} for return ${salesReturn.returnNo}`,
            refDocType: "SALES_RETURN_REFUND",
            refDocId: salesReturn.id,
            items: {
              create: [
                {
                  debitLedgerId: customerLedger.id,
                  debitAmount: grandTotal,
                  creditAmount: new Prisma.Decimal(0),
                  narration: `Credit settled via refund`,
                },
                {
                  creditLedgerId: payLedger.id,
                  debitAmount: new Prisma.Decimal(0),
                  creditAmount: grandTotal,
                  narration: `Refund paid via ${salesReturn.refundMode}`,
                },
              ],
            },
          },
        });
      }
    }

    return voucher;
  }

  /**
   * Sync unposted GRN Invoices, Sales Invoices, and Payments to the Voucher table
   */
  async syncUnpostedVouchers() {
    try {
      const existingGrnVouchers = await prisma.voucher.findMany({
        where: { refDocType: "GRN_INVOICE", refDocId: { not: null } },
        select: { refDocId: true },
      });
      const postedGrnIds = existingGrnVouchers.map((v) => v.refDocId!).filter(Boolean);

      const unpostedGrns = await prisma.grnInvoice.findMany({
        where: {
          id: { notIn: postedGrnIds },
        },
        select: { id: true },
      });

      for (const grn of unpostedGrns) {
        await this.postPurchaseVoucher(grn.id);
      }

      const existingSalesVouchers = await prisma.voucher.findMany({
        where: { refDocType: "SALES_INVOICE", refDocId: { not: null } },
        select: { refDocId: true },
      });
      const postedSalesIds = existingSalesVouchers.map((v) => v.refDocId!).filter(Boolean);

      const unpostedSales = await prisma.salesInvoice.findMany({
        where: {
          id: { notIn: postedSalesIds },
        },
        select: { id: true },
      });

      for (const inv of unpostedSales) {
        await this.postSalesVoucher(inv.id);
      }
    } catch (err) {
      console.error("[Auto-Post Voucher Error] Syncing unposted vouchers failed:", err);
    }
  }
}

export const voucherPostingService = new VoucherPostingService();
