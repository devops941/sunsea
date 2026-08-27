import { prisma } from "../../config/prisma";
import { VoucherType, Prisma } from "@prisma/client";
import { accountsService } from "./accounts.service";
import { extractPaymentsArray } from "../../utils/payments";
import crypto from "crypto";

/**
 * Returns the start date of the current financial year (India: April 1).
 * Used to date system-generated opening balance vouchers so they show correctly
 * in "as on" reports for any date within the financial year.
 */
function getFinancialYearStart(): Date {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 3, 1);
}

/**
 * Generates a stable payment reference ID based on payment properties and array index if p.id is missing.
 * Including the index prevents hash collisions between multiple identical payments in the same parent document.
 */
function deriveStablePaymentRefId(parentId: string, prefix: string, p: any, index: number): string {
  if (p.id) return String(p.id);
  const rawAmt = p.amount !== undefined && p.amount !== null ? String(p.amount) : "0";
  const dateStr = p.paymentDate ? new Date(p.paymentDate).toISOString() : "";
  const method = p.paymentMethod || "";
  const ref = p.referenceNumber || "";
  const hashInput = `${parentId}:${index}:${rawAmt}:${dateStr}:${method}:${ref}`;
  const hash = crypto.createHash("sha256").update(hashInput).digest("hex").slice(0, 12);
  return `${parentId}_${prefix}_${hash}`;
}

/*
 * Database Schema Requirement Notice:
 * Safe duplicate protection in `safeCreateVoucher` relies on a composite unique constraint on `(refDocType, refDocId)`
 * in the Prisma schema:
 *
 * model Voucher {
 *   ...
 *   refDocType String
 *   refDocId   String
 *   @@unique([refDocType, refDocId])
 * }
 */

/**
 * Helper to safely create a voucher and gracefully handle concurrent creation / unique constraint races.
 * NOTE: Duplicate protection relies on the unique constraint `@@unique([refDocType, refDocId])` on the Voucher model in schema.prisma.
 *
 * Postgres Transaction Recovery Rationale:
 * We chose Approach (a) (SQL SAVEPOINT / ROLLBACK TO SAVEPOINT via $executeRawUnsafe) because inside an interactive Postgres
 * transaction, a failed statement (P2002 unique constraint error) marks the Postgres transaction block as ABORTED.
 * Without rolling back to a SAVEPOINT before executing the fallback query, any subsequent commands (like `db.voucher.findFirst`)
 * inside the `catch` block would fail with "current transaction is aborted, commands ignored until end of transaction block".
 */
async function safeCreateVoucher(
  db: Prisma.TransactionClient | typeof prisma,
  data: Prisma.VoucherCreateInput,
  refDocType: string,
  refDocId: string
) {
  const savepointName = `sp_vch_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const isTx = "$executeRawUnsafe" in db && typeof (db as any).$executeRawUnsafe === "function";

  if (isTx) {
    try {
      await (db as any).$executeRawUnsafe(`SAVEPOINT ${savepointName}`);
    } catch {
      // Ignore if savepoints are not supported in execution context
    }
  }

  try {
    const created = await db.voucher.create({
      data,
      include: { items: true },
    });
    if (isTx) {
      try {
        await (db as any).$executeRawUnsafe(`RELEASE SAVEPOINT ${savepointName}`);
      } catch {
        // Ignore release errors
      }
    }
    try {
      const { getIO } = require("../../socket/socket");
      const io = getIO();
      io.emit("voucher:created", created);
      io.emit("payment:created", created);
      io.emit("accountLedger:updated", { source: "voucherPosting" });
    } catch {}
    return created;
  } catch (err: any) {
    if (err.code === "P2002" || err.message?.includes("Unique constraint")) {
      if (isTx) {
        try {
          await (db as any).$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        } catch {
          // Ignore rollback errors
        }
      }
      const existing = await db.voucher.findFirst({
        where: { refDocType, refDocId },
        include: { items: true },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

class VoucherPostingService {
  /**
   * Post a formal double-entry PURCHASE Voucher for a GRN Purchase Invoice.
   * Debit: Purchase Account (PURCH-001)
   * Credit: Supplier Account Ledger
   */
  async postPurchaseVoucher(grnInvoiceId: string, txClient?: Prisma.TransactionClient): Promise<any> {
    if (!txClient) {
      // Configured with generous maxWait & timeout to handle multi-step postings with many payments without hitting Prisma's 5s default limit.
      return prisma.$transaction(
        async (tx) => {
          return this.postPurchaseVoucher(grnInvoiceId, tx);
        },
        { maxWait: 10000, timeout: 30000 }
      );
    }
    const db = txClient;

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
      const netAmountNum = Number(g.netAmount || g.subtotal || g.grandTotal || g.totalAmount || 0);
      const totalCgst = Number(g.totalCgst || 0);
      const totalSgst = Number(g.totalSgst || 0);
      const totalIgst = Number(g.totalIgst || 0);
      const totalGst = totalCgst + totalSgst + totalIgst;

      // Validation: Ensure total GST does not exceed the net invoice amount.
      // If total GST > netAmountNum (due to inconsistent/corrupted source data), the purchase base
      // would be negative and posting a voucher would result in unbalanced debits and credits.
      if (totalGst > netAmountNum) {
        console.error(
          `[Auto-Post Voucher Error] Inconsistent GST data on GRN Invoice ${grnInvoice.id}: ` +
            `Total GST (${totalGst}) exceeds Net Amount (${netAmountNum}). Voucher posting aborted.`
        );
        return null;
      }

      const purchaseBase = netAmountNum - totalGst;
      const voucherNo = `PUR-${grnInvoice.grnNumber || grnInvoice.id.slice(-6)}`;
      const date = grnInvoice.grnDate || grnInvoice.createdAt;

      const journalItemsToCreate: any[] = [];

      // Only include Purchase Ledger debit line if purchaseBase is strictly > 0 (avoid 0-amount lines when GST equals full total)
      if (purchaseBase > 0) {
        journalItemsToCreate.push({
          debitLedgerId: purchaseLedger.id,
          debitAmount: new Prisma.Decimal(purchaseBase),
          creditAmount: new Prisma.Decimal(0),
          narration: `Purchase of raw materials / goods (base excl. GST)`,
        });
      }

      // Add GST input credit entries if GST breakdown is available
      if (totalCgst > 0 || totalSgst > 0 || totalIgst > 0) {
        if (totalCgst > 0) {
          const cgstRecLedger = await db.accountLedger.findUnique({ where: { code: "CGST-REC-001" } });
          if (cgstRecLedger) {
            journalItemsToCreate.push({
              debitLedgerId: cgstRecLedger.id,
              debitAmount: new Prisma.Decimal(totalCgst),
              creditAmount: new Prisma.Decimal(0),
              narration: `CGST Input Tax Credit`,
            });
          }
        }
        if (totalSgst > 0) {
          const sgstRecLedger = await db.accountLedger.findUnique({ where: { code: "SGST-REC-001" } });
          if (sgstRecLedger) {
            journalItemsToCreate.push({
              debitLedgerId: sgstRecLedger.id,
              debitAmount: new Prisma.Decimal(totalSgst),
              creditAmount: new Prisma.Decimal(0),
              narration: `SGST Input Tax Credit`,
            });
          }
        }
        if (totalIgst > 0) {
          const igstRecLedger = await db.accountLedger.findUnique({ where: { code: "IGST-REC-001" } });
          if (igstRecLedger) {
            journalItemsToCreate.push({
              debitLedgerId: igstRecLedger.id,
              debitAmount: new Prisma.Decimal(totalIgst),
              creditAmount: new Prisma.Decimal(0),
              narration: `IGST Input Tax Credit`,
            });
          }
        }
      }

      // Credit supplier ledger for full net amount
      journalItemsToCreate.push({
        creditLedgerId: supplierLedger.id,
        debitAmount: new Prisma.Decimal(0),
        creditAmount: new Prisma.Decimal(netAmountNum),
        narration: `Liability payable to ${grnInvoice.supplier.legalName}`,
      });

      voucher = await safeCreateVoucher(
        db,
        {
          voucherNo,
          type: VoucherType.PURCHASE,
          date,
          narration: `Purchase invoice posted for GRN ${grnInvoice.grnNumber || grnInvoice.invoiceNo}`,
          refDocType: "GRN_INVOICE",
          refDocId: grnInvoice.id,
          items: { create: journalItemsToCreate },
        },
        "GRN_INVOICE",
        grnInvoice.id
      );
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
  async postPaymentVouchersForGRN(grnInvoiceId: string, txClient?: Prisma.TransactionClient): Promise<any[]> {
    if (!txClient) {
      // Configured with generous maxWait & timeout to handle GRN invoices with many payment lines
      return prisma.$transaction(
        async (tx) => {
          return this.postPaymentVouchersForGRN(grnInvoiceId, tx);
        },
        { maxWait: 10000, timeout: 30000 }
      );
    }
    const db = txClient;

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
      const rawAmt = p.amount !== undefined && p.amount !== null ? p.amount : 0;
      const amountDec = new Prisma.Decimal(rawAmt).toDecimalPlaces(2);
      if (amountDec.lte(0)) continue;

      const refDocId = deriveStablePaymentRefId(grnInvoice.id, "pay", p, index);

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

      const suffix = rawPayments.length > 1 ? `-${index + 1}` : "";
      const voucherNo = `PAY-${grnInvoice.grnNumber || grnInvoice.invoiceNo || grnInvoice.id.slice(-6)}${suffix}`;
      const pDate = p.paymentDate ? new Date(p.paymentDate) : (grnInvoice.grnDate || grnInvoice.createdAt);

      const voucher = await safeCreateVoucher(
        db,
        {
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
        "GRN_PAYMENT",
        refDocId
      );

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
  async postSalesVoucher(salesInvoiceId: string, txClient?: Prisma.TransactionClient): Promise<any> {
    if (!txClient) {
      // Configured with generous maxWait & timeout to handle multi-step postings for sales invoices with many receipts
      return prisma.$transaction(
        async (tx) => {
          return this.postSalesVoucher(salesInvoiceId, tx);
        },
        { maxWait: 10000, timeout: 30000 }
      );
    }
    const db = txClient;

    const salesInvoice = await db.salesInvoice.findUnique({
      where: { id: salesInvoiceId },
      include: { customer: true, items: true },
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
      const grandTotalNum = Number(salesInvoice.grandTotal || salesInvoice.subTotal || 0);
      const grandTotal = new Prisma.Decimal(grandTotalNum);
      const voucherNo = `SLS-${salesInvoice.invoiceNo || salesInvoice.id.slice(-6)}`;
      const date = salesInvoice.invoiceDate || salesInvoice.createdAt;

      // Sum GST components from line items
      const items: any[] = (salesInvoice as any).items || [];
      const totalCgst = items.reduce((s: number, i: any) => s + Number(i.cgstAmount || 0), 0);
      const totalSgst = items.reduce((s: number, i: any) => s + Number(i.sgstAmount || 0), 0);
      const totalIgst = items.reduce((s: number, i: any) => s + Number(i.igstAmount || 0), 0);
      const totalGst = totalCgst + totalSgst + totalIgst;

      // Validation: Ensure total GST does not exceed the grand total amount.
      // If total GST > grandTotalNum (due to inconsistent/corrupted source data), the sales base
      // would be negative and posting a voucher would result in unbalanced debits and credits.
      if (totalGst > grandTotalNum) {
        console.error(
          `[Auto-Post Voucher Error] Inconsistent GST data on Sales Invoice ${salesInvoice.id}: ` +
            `Total GST (${totalGst}) exceeds Grand Total (${grandTotalNum}). Voucher posting aborted.`
        );
        return null;
      }

      const salesBase = grandTotalNum - totalGst;

      const salesJournalItems: any[] = [
        // Debit Customer for full grand total
        {
          debitLedgerId: customerLedger.id,
          debitAmount: grandTotal,
          creditAmount: new Prisma.Decimal(0),
          narration: `Receivable from ${salesInvoice.customer.firmName}`,
        },
      ];

      // Only include Sales Ledger credit line if salesBase is strictly > 0 (avoid 0-amount lines when GST equals full total)
      if (salesBase > 0) {
        salesJournalItems.push({
          creditLedgerId: salesLedger.id,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: new Prisma.Decimal(salesBase),
          narration: `Revenue credited to Sales Account`,
        });
      }

      // Credit GST liability ledgers if GST breakdown available
      if (totalCgst > 0 || totalSgst > 0 || totalIgst > 0) {
        if (totalCgst > 0) {
          const cgstLiaLedger = await db.accountLedger.findUnique({ where: { code: "CGST-LIA-001" } });
          if (cgstLiaLedger) {
            salesJournalItems.push({
              creditLedgerId: cgstLiaLedger.id,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: new Prisma.Decimal(totalCgst),
              narration: `CGST Output Tax Payable`,
            });
          }
        }
        if (totalSgst > 0) {
          const sgstLiaLedger = await db.accountLedger.findUnique({ where: { code: "SGST-LIA-001" } });
          if (sgstLiaLedger) {
            salesJournalItems.push({
              creditLedgerId: sgstLiaLedger.id,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: new Prisma.Decimal(totalSgst),
              narration: `SGST Output Tax Payable`,
            });
          }
        }
        if (totalIgst > 0) {
          const igstLiaLedger = await db.accountLedger.findUnique({ where: { code: "IGST-LIA-001" } });
          if (igstLiaLedger) {
            salesJournalItems.push({
              creditLedgerId: igstLiaLedger.id,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: new Prisma.Decimal(totalIgst),
              narration: `IGST Output Tax Payable`,
            });
          }
        }
      }

      voucher = await safeCreateVoucher(
        db,
        {
          voucherNo,
          type: VoucherType.SALES,
          date,
          narration: `Sales invoice posted for ${salesInvoice.invoiceNo}`,
          refDocType: "SALES_INVOICE",
          refDocId: salesInvoice.id,
          items: { create: salesJournalItems },
        },
        "SALES_INVOICE",
        salesInvoice.id
      );
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
  async postReceiptVouchersForSales(salesInvoiceId: string, txClient?: Prisma.TransactionClient): Promise<any[]> {
    if (!txClient) {
      // Configured with generous maxWait & timeout to handle sales invoices with many receipt lines
      return prisma.$transaction(
        async (tx) => {
          return this.postReceiptVouchersForSales(salesInvoiceId, tx);
        },
        { maxWait: 10000, timeout: 30000 }
      );
    }
    const db = txClient;

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
      const rawAmt = p.amount !== undefined && p.amount !== null ? p.amount : 0;
      const amountDec = new Prisma.Decimal(rawAmt).toDecimalPlaces(2);
      if (amountDec.lte(0)) continue;

      const refDocId = deriveStablePaymentRefId(salesInvoice.id, "rcpt", p, index);

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

      const suffix = rawPayments.length > 1 ? `-${index + 1}` : "";
      const voucherNo = `RCT-${salesInvoice.invoiceNo || salesInvoice.id.slice(-6)}${suffix}`;
      const pDate = p.paymentDate ? new Date(p.paymentDate) : (salesInvoice.invoiceDate || salesInvoice.createdAt);

      const voucher = await safeCreateVoucher(
        db,
        {
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
        "SALES_PAYMENT",
        refDocId
      );

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
  async postSalesReturnVoucher(salesReturnId: string, txClient?: Prisma.TransactionClient): Promise<any> {
    if (!txClient) {
      // Configured with generous maxWait & timeout for transaction atomicity
      return prisma.$transaction(
        async (tx) => {
          return this.postSalesReturnVoucher(salesReturnId, tx);
        },
        { maxWait: 10000, timeout: 30000 }
      );
    }
    const db = txClient;

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

    const voucher = await safeCreateVoucher(
      db,
      {
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
      "SALES_RETURN",
      salesReturn.id
    );

    // Accounting Semantics Note for Refund Vouchers:
    // This refund entry (Dr Customer Ledger / Cr Cash-or-Bank) assumes that the customer
    // has already paid for the invoice being returned, and is now receiving a direct cash/bank refund.
    // - Main Sales Return Voucher: Dr Sales Return A/c | Cr Customer Ledger (reduces customer receivable)
    // - Refund Voucher: Dr Customer Ledger | Cr Cash/Bank (re-instates customer balance, reduces cash/bank asset)
    // Net Customer Ledger Impact: Zero (receivable reduced by return, offset by cash payout).
    // Net Business Impact: Dr Sales Return A/c | Cr Cash/Bank.
    // If the business model changes (e.g. return reducing an unpaid customer balance without cash payout),
    // do not set refundMode = CASH/BANK.
    if (salesReturn.refundMode === "CASH" || salesReturn.refundMode === "BANK") {
      const payLedgerCode = salesReturn.refundMode === "CASH" ? "CASH-001" : "BANK-001";
      let payLedger = await db.accountLedger.findUnique({ where: { code: payLedgerCode } });
      if (!payLedger) {
        payLedger = await db.accountLedger.findFirst({
          where: { name: { contains: salesReturn.refundMode === "CASH" ? "Cash" : "Bank", mode: "insensitive" } },
        });
      }

      if (payLedger && customerLedger) {
        await safeCreateVoucher(
          db,
          {
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
                  narration: `Refund paid to ${salesReturn.customer.firmName} via ${salesReturn.refundMode}`,
                },
                {
                  creditLedgerId: payLedger.id,
                  debitAmount: new Prisma.Decimal(0),
                  creditAmount: grandTotal,
                  narration: `Refund paid via ${salesReturn.refundMode} to ${salesReturn.customer.firmName}`,
                },
              ],
            },
          },
          "SALES_RETURN_REFUND",
          salesReturn.id
        );
      }
    }

    return voucher;
  }

  /**
   * Post a formal double-entry Voucher for a Purchase Return.
   * Debit: Supplier Ledger (reduces supplier payable)
   * Credit: Purchase Return Account (PRT-001)
   */
  async postPurchaseReturnVoucher(purchaseReturnId: string, txClient?: Prisma.TransactionClient): Promise<any> {
    if (!txClient) {
      return prisma.$transaction(
        async (tx) => {
          return this.postPurchaseReturnVoucher(purchaseReturnId, tx);
        },
        { maxWait: 10000, timeout: 30000 }
      );
    }
    const db = txClient;

    const purchaseReturn = await db.purchaseReturn.findUnique({
      where: { id: purchaseReturnId },
      include: { supplier: true },
    });

    if (!purchaseReturn || !purchaseReturn.supplier) {
      console.warn(`[Auto-Post Voucher] Purchase Return ${purchaseReturnId} not found or missing supplier.`);
      return null;
    }

    await accountsService.ensureSystemLedgersExist(db);
    const supplierLedger = await accountsService.ensureSupplierLedger(purchaseReturn.supplier, db);
    let purchaseReturnLedger = await db.accountLedger.findUnique({ where: { code: "PRT-001" } });
    if (!purchaseReturnLedger) {
      const prList = await db.accountLedger.findMany({
        where: { name: { contains: "Purchase Return", mode: "insensitive" } },
      });
      purchaseReturnLedger = prList.length > 0 ? prList[0] : null;
    }

    if (!purchaseReturnLedger || !supplierLedger) {
      console.error("[Auto-Post Voucher Error] Missing purchase return or supplier ledger");
      return null;
    }

    const existing = await db.voucher.findFirst({
      where: { refDocType: "PURCHASE_RETURN", refDocId: purchaseReturn.id },
    });
    if (existing) return existing;

    const grandTotal = new Prisma.Decimal(purchaseReturn.grandTotal);
    const voucherNo = `PRT-${purchaseReturn.returnNo}`;

    const voucher = await safeCreateVoucher(
      db,
      {
        voucherNo,
        type: VoucherType.PURCHASE_RETURN,
        date: purchaseReturn.returnDate,
        narration: `Purchase return posted for ${purchaseReturn.returnNo}${purchaseReturn.grnInvoiceId ? ` against GRN invoice ${purchaseReturn.grnInvoiceId}` : ""}`,
        refDocType: "PURCHASE_RETURN",
        refDocId: purchaseReturn.id,
        items: {
          create: [
            {
              debitLedgerId: supplierLedger.id,
              debitAmount: grandTotal,
              creditAmount: new Prisma.Decimal(0),
              narration: `Payable reduced for ${purchaseReturn.supplier.legalName}`,
            },
            {
              creditLedgerId: purchaseReturnLedger.id,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: grandTotal,
              narration: `Purchase return — goods returned to ${purchaseReturn.supplier.legalName}`,
            },
          ],
        },
      },
      "PURCHASE_RETURN",
      purchaseReturn.id
    );

    return voucher;
  }

  /**
   * Post a formal double-entry Voucher for a Petty Cash Entry.
   * OUT: Debit Expense (EXP-001), Credit Petty Cash (PCASH-001)
   * IN: Debit Petty Cash (PCASH-001), Credit Cash in Hand (CASH-001)
   */
  async postPettyCashVoucher(pettyCashEntryId: number | string, txClient?: Prisma.TransactionClient) {
    const db = txClient || prisma;
    const entryIdNum = Number(pettyCashEntryId);
    if (isNaN(entryIdNum)) return null;

    const entry = await db.pettyCashEntry.findUnique({
      where: { id: entryIdNum },
    });

    if (!entry) return null;

    const existingVoucher = await db.voucher.findFirst({
      where: {
        refDocType: "PETTY_CASH",
        refDocId: String(entry.id),
      },
    });

    if (existingVoucher) return existingVoucher;

    await accountsService.ensureSystemLedgersExist(db);
    const pcashLedger = await db.accountLedger.findUnique({ where: { code: "PCASH-001" } });
    const expenseLedger = await db.accountLedger.findUnique({ where: { code: "EXP-001" } });
    const cashLedger = await db.accountLedger.findUnique({ where: { code: "CASH-001" } });

    if (!pcashLedger || !expenseLedger) {
      console.warn("[Auto-Post Voucher] Missing system ledgers PCASH-001 or EXP-001.");
      return null;
    }

    const amount = new Prisma.Decimal(entry.amount);
    const voucherNo = `PC-${entry.entryNo}`;
    const entryDate = entry.entryDate || new Date();

    if (entry.type === "OUT") {
      return safeCreateVoucher(
        db,
        {
          voucherNo,
          type: VoucherType.EXPENSE,
          date: entryDate,
          narration: `Petty cash payment: ${entry.description || entry.category}${entry.paidTo ? ` to ${entry.paidTo}` : ""}`,
          refDocType: "PETTY_CASH",
          refDocId: String(entry.id),
          items: {
            create: [
              {
                debitLedgerId: expenseLedger.id,
                debitAmount: amount,
                creditAmount: new Prisma.Decimal(0),
                narration: `${entry.category}: ${entry.description || ""}`,
              },
              {
                creditLedgerId: pcashLedger.id,
                debitAmount: new Prisma.Decimal(0),
                creditAmount: amount,
                narration: `Petty cash disbursed`,
              },
            ],
          },
        },
        "PETTY_CASH",
        String(entry.id)
      );
    } else if (entry.type === "IN") {
      if (!cashLedger) return null;
      return safeCreateVoucher(
        db,
        {
          voucherNo,
          type: VoucherType.CONTRA,
          date: entryDate,
          narration: `Petty cash replenished: ${entry.description || entry.category}`,
          refDocType: "PETTY_CASH",
          refDocId: String(entry.id),
          items: {
            create: [
              {
                debitLedgerId: pcashLedger.id,
                debitAmount: amount,
                creditAmount: new Prisma.Decimal(0),
                narration: `Petty cash fund replenished`,
              },
              {
                creditLedgerId: cashLedger.id,
                debitAmount: new Prisma.Decimal(0),
                creditAmount: amount,
                narration: `Cash transferred to petty cash`,
              },
            ],
          },
        },
        "PETTY_CASH",
        String(entry.id)
      );
    } else {
      console.error(`[Auto-Post Voucher Error] Invalid petty cash entry type "${entry.type}" for entry ${entry.id}`);
      return null;
    }
  }

  /**
   * Determine the correct credit ledger code based on the expense's paymentMethod.
   *   "Cash"                          → CASH-001 (Cash in Hand)
   *   "Bank Transfer" / GPay / PhonePe / Credit Card / Debit Card → BANK-001 (Main Bank Account)
   *   Fallback (empty or unknown)     → PCASH-001 (Petty Cash)
   */
  private getCreditLedgerCodeForExpense(paymentMethod?: string): string {
    if (!paymentMethod) return "PCASH-001";

    const method = paymentMethod.trim().toLowerCase();

    if (method === "cash") return "CASH-001";

    if (
      method === "bank transfer" ||
      method === "gpay" ||
      method === "phonepe" ||
      method === "credit card" ||
      method === "debit card"
    ) {
      return "BANK-001";
    }

    return "PCASH-001";
  }

  /**
   * Post a formal double-entry EXPENSE Voucher directly.
   *   Debit  : General Expenses  (EXP-001)  — records the expense
   *   Credit : Cash / Bank / Petty Cash      — reduces the paying account
   *
   * Uses refDocType = "EXPENSE" so duplicates are prevented by the unique constraint.
   */
  async postExpenseVoucher(
    expenseId: string,
    paymentMethod?: string,
    txClient?: Prisma.TransactionClient
  ) {
    const db = txClient || prisma;

    const expense = await db.expense.findUnique({
      where: { id: expenseId },
      include: { supplier: true },
    });

    if (!expense) return null;

    // Check if a voucher was already posted for this expense
    const existingVoucher = await db.voucher.findFirst({
      where: {
        refDocType: "EXPENSE",
        refDocId: expense.id,
      },
    });

    if (existingVoucher) return existingVoucher;

    await accountsService.ensureSystemLedgersExist(db);

    const expenseLedger = await db.accountLedger.findUnique({ where: { code: "EXP-001" } });
    const creditLedgerCode = this.getCreditLedgerCodeForExpense(paymentMethod || expense.paymentMethod);
    const creditLedger = await db.accountLedger.findUnique({ where: { code: creditLedgerCode } });

    if (!expenseLedger || !creditLedger) {
      console.warn(`[Auto-Post Expense Voucher] Missing system ledgers EXP-001 or ${creditLedgerCode}.`);
      return null;
    }

    const amount = new Prisma.Decimal(expense.amount);
    const voucherNo = `EXP-${expense.expenseNumber}`;
    const entryDate = expense.date || new Date();

    return safeCreateVoucher(
      db,
      {
        voucherNo,
        type: VoucherType.EXPENSE,
        date: entryDate,
        narration: `Expense: ${expense.expense}${expense.supplier ? ` — ${expense.supplier.legalName}` : ""}`,
        refDocType: "EXPENSE",
        refDocId: expense.id,
        items: {
          create: [
            {
              debitLedgerId: expenseLedger.id,
              debitAmount: amount,
              creditAmount: new Prisma.Decimal(0),
              narration: `${expense.expenseCategory}: ${expense.expense}`,
            },
            {
              creditLedgerId: creditLedger.id,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: amount,
              narration: `Paid via ${paymentMethod || expense.paymentMethod || "Cash"}`,
            },
          ],
        },
      },
      "EXPENSE",
      expense.id
    );
  }

  /**
   * Sync unposted GRN Invoices, Sales Invoices, Expenses, and Petty Cash entries to the Voucher table.
   * Uses set-based queries and parallel batches for efficiency.
   */
  async syncUnpostedVouchers() {
    const failedPostings: Array<{ id: string | number; docType: string; reason: string }> = [];

    try {
      const [
        postedGrnVouchers,
        postedSalesVouchers,
        postedPurchaseReturnVouchers,
        postedSalesReturnVouchers,
        postedPettyCashVouchers,
        allGrnIds,
        allSalesIds,
        allPurchaseReturnIds,
        allSalesReturnIds,
        allPettyCashEntries,
        allExpenses,
      ] = await Promise.all([
        prisma.voucher.findMany({
          where: { refDocType: "GRN_INVOICE" },
          select: { refDocId: true },
        }),
        prisma.voucher.findMany({
          where: { refDocType: "SALES_INVOICE" },
          select: { refDocId: true },
        }),
        prisma.voucher.findMany({
          where: { refDocType: "PURCHASE_RETURN" },
          select: { refDocId: true },
        }),
        prisma.voucher.findMany({
          where: { refDocType: "SALES_RETURN" },
          select: { refDocId: true },
        }),
        prisma.voucher.findMany({
          where: { refDocType: "PETTY_CASH" },
          select: { refDocId: true },
        }),
        prisma.grnInvoice.findMany({ select: { id: true } }),
        prisma.salesInvoice.findMany({ select: { id: true } }),
        prisma.purchaseReturn.findMany({ select: { id: true } }),
        prisma.salesReturn.findMany({ select: { id: true } }),
        prisma.pettyCashEntry.findMany({ select: { id: true, entryNo: true } }),
        prisma.expense.findMany({
          include: { supplier: true },
        }),
      ]);

      const postedGrnIds = new Set(postedGrnVouchers.map((v) => v.refDocId).filter(Boolean));
      const postedSalesIds = new Set(postedSalesVouchers.map((v) => v.refDocId).filter(Boolean));
      const postedPRIds = new Set(postedPurchaseReturnVouchers.map((v) => v.refDocId).filter(Boolean));
      const postedSRIds = new Set(postedSalesReturnVouchers.map((v) => v.refDocId).filter(Boolean));

      const unpostedGrnIds = allGrnIds.filter((g) => !postedGrnIds.has(g.id)).map((g) => g.id);
      const unpostedSalesIds = allSalesIds.filter((s) => !postedSalesIds.has(s.id)).map((s) => s.id);
      const unpostedPRIds = allPurchaseReturnIds.filter((p) => !postedPRIds.has(p.id)).map((p) => p.id);
      const unpostedSRIds = allSalesReturnIds.filter((s) => !postedSRIds.has(s.id)).map((s) => s.id);

      const batchSize = 10;
      for (let i = 0; i < unpostedGrnIds.length; i += batchSize) {
        const batch = unpostedGrnIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (id) => {
            try {
              const res = await this.postPurchaseVoucher(id);
              if (!res) {
                failedPostings.push({ id, docType: "GRN_INVOICE", reason: "Returned null (missing ledger or missing document)" });
              }
            } catch (err: any) {
              failedPostings.push({ id, docType: "GRN_INVOICE", reason: err?.message || String(err) });
            }
          })
        );
      }

      for (let i = 0; i < unpostedSalesIds.length; i += batchSize) {
        const batch = unpostedSalesIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (id) => {
            try {
              const res = await this.postSalesVoucher(id);
              if (!res) {
                failedPostings.push({ id, docType: "SALES_INVOICE", reason: "Returned null (missing ledger or missing document)" });
              }
            } catch (err: any) {
              failedPostings.push({ id, docType: "SALES_INVOICE", reason: err?.message || String(err) });
            }
          })
        );
      }

      for (let i = 0; i < unpostedPRIds.length; i += batchSize) {
        const batch = unpostedPRIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (id) => {
            try {
              const res = await this.postPurchaseReturnVoucher(id);
              if (!res) {
                failedPostings.push({ id, docType: "PURCHASE_RETURN", reason: "Returned null (missing ledger or missing document)" });
              }
            } catch (err: any) {
              failedPostings.push({ id, docType: "PURCHASE_RETURN", reason: err?.message || String(err) });
            }
          })
        );
      }

      for (let i = 0; i < unpostedSRIds.length; i += batchSize) {
        const batch = unpostedSRIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (id) => {
            try {
              const res = await this.postSalesReturnVoucher(id);
              if (!res) {
                failedPostings.push({ id, docType: "SALES_RETURN", reason: "Returned null (missing ledger or missing document)" });
              }
            } catch (err: any) {
              failedPostings.push({ id, docType: "SALES_RETURN", reason: err?.message || String(err) });
            }
          })
        );
      }

      // Sync unposted Expense & Petty Cash entries
      const existingEntryNos = new Set(allPettyCashEntries.map((e) => e.entryNo));
      const pettyCashList: Array<{ id: number; entryNo: string }> = [...allPettyCashEntries];

      for (const exp of allExpenses) {
        const pcEntryNo = `PC-EXP-${exp.expenseNumber}`;
        if (!existingEntryNos.has(pcEntryNo)) {
          try {
            const createdEntry = await prisma.pettyCashEntry.create({
              data: {
                entryNo: pcEntryNo,
                entryDate: exp.date || new Date(),
                category: exp.expenseCategory || "General Expense",
                description: `Expense (${exp.expenseNumber}): ${exp.expense}`,
                amount: exp.amount ? new Prisma.Decimal(exp.amount) : new Prisma.Decimal(0),
                type: "OUT",
                paidTo: exp.supplier?.legalName || null,
                receiptNo: exp.expenseNumber,
                companyId: exp.companyId,
                createdBy: exp.createdBy,
              },
            });
            pettyCashList.push({ id: createdEntry.id, entryNo: createdEntry.entryNo });
          } catch (pcErr: any) {
            console.error(`[Auto-Post Voucher Error] Syncing expense ${exp.expenseNumber} to petty cash failed:`, pcErr);
            failedPostings.push({ id: exp.id, docType: "EXPENSE_PETTY_CASH_SYNC", reason: pcErr?.message || String(pcErr) });
          }
        }
      }

      const postedPettyCashIds = new Set(postedPettyCashVouchers.map((v) => v.refDocId).filter(Boolean));
      const unpostedPettyCashIds = pettyCashList.filter((p) => !postedPettyCashIds.has(String(p.id))).map((p) => p.id);

      for (const id of unpostedPettyCashIds) {
        try {
          const res = await this.postPettyCashVoucher(id);
          if (!res) {
            failedPostings.push({ id, docType: "PETTY_CASH", reason: "Returned null (missing ledger or invalid entry type)" });
          }
        } catch (err: any) {
          failedPostings.push({ id, docType: "PETTY_CASH", reason: err?.message || String(err) });
        }
      }

      if (failedPostings.length > 0) {
        console.warn(`[Auto-Post Voucher Sync Warning] Completed with ${failedPostings.length} failed posting(s):`, failedPostings);
      }
    } catch (err) {
      console.error("[Auto-Post Voucher Error] Syncing unposted vouchers failed:", err);
    }

    return { failedPostings };
  }

  /**
   * Post a formal double-entry Opening Balance Voucher for a Supplier.
   */
  async postSupplierOpeningBalanceVoucher(
    supplier: { id: number; supplierCode: string; legalName: string },
    amount: number,
    type: "DEBIT" | "CREDIT" = "CREDIT",
    txClient?: Prisma.TransactionClient
  ) {
    const db = txClient || prisma;
    await accountsService.ensureSystemLedgersExist(db);
    const supplierLedger = await accountsService.ensureSupplierLedger(supplier, db);
    const eqLedger = await db.accountLedger.findUnique({ where: { code: "EQ-001" } });

    if (!supplierLedger || !eqLedger) return null;

    const opBal = new Prisma.Decimal(amount);
    const isCredit = type === "CREDIT";

    return safeCreateVoucher(
      db,
      {
        voucherNo: `JV-SUP-OP-${supplier.supplierCode || String(supplier.id).slice(-6)}`,
        type: VoucherType.JOURNAL,
        // Opening balances belong to the start of the financial year, not "today".
        date: getFinancialYearStart(),
        narration: `Opening balance for supplier ${supplier.legalName} (${type})`,
        refDocType: "SUPPLIER_OPENING_BALANCE",
        refDocId: String(supplier.id),
        items: {
          create: [
            {
              debitLedgerId: isCredit ? eqLedger.id : supplierLedger.id,
              debitAmount: opBal,
              creditAmount: new Prisma.Decimal(0),
              narration: `Supplier opening balance debit`,
            },
            {
              creditLedgerId: isCredit ? supplierLedger.id : eqLedger.id,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: opBal,
              narration: `Supplier opening balance credit`,
            },
          ],
        },
      },
      "SUPPLIER_OPENING_BALANCE",
      String(supplier.id)
    );
  }

  /**
   * Post a formal double-entry Opening Balance Voucher for a Customer.
   */
  async postCustomerOpeningBalanceVoucher(
    customer: { id: string; customerCode: string; firmName: string },
    amount: number,
    type: "DEBIT" | "CREDIT" = "DEBIT",
    txClient?: Prisma.TransactionClient
  ) {
    const db = txClient || prisma;
    await accountsService.ensureSystemLedgersExist(db);
    const customerLedger = await accountsService.ensureCustomerLedger(customer, db);
    const eqLedger = await db.accountLedger.findUnique({ where: { code: "EQ-001" } });

    if (!customerLedger || !eqLedger) return null;

    const opBal = new Prisma.Decimal(amount);
    const isDebit = type === "DEBIT";

    return safeCreateVoucher(
      db,
      {
        voucherNo: `JV-CUST-OP-${customer.customerCode || String(customer.id).slice(-6)}`,
        type: VoucherType.JOURNAL,
        // Opening balances belong to the start of the financial year, not "today".
        // Otherwise a trial balance "as on" any earlier date would omit them.
        date: getFinancialYearStart(),
        narration: `Opening balance for customer ${customer.firmName} (${type})`,
        refDocType: "CUSTOMER_OPENING_BALANCE",
        refDocId: String(customer.id),
        items: {
          create: [
            {
              debitLedgerId: isDebit ? customerLedger.id : eqLedger.id,
              debitAmount: opBal,
              creditAmount: new Prisma.Decimal(0),
              narration: `Customer opening balance debit`,
            },
            {
              creditLedgerId: isDebit ? eqLedger.id : customerLedger.id,
              debitAmount: new Prisma.Decimal(0),
              creditAmount: opBal,
              narration: `Customer opening balance credit`,
            },
          ],
        },
      },
      "CUSTOMER_OPENING_BALANCE",
      String(customer.id)
    );
  }

  /**
   * Automatically scan for and post missing double-entry opening balance vouchers
   * for any customers and suppliers who have an opening balance in the database.
   */
  async syncMissingOpeningBalanceVouchers(txClient?: Prisma.TransactionClient) {
    const db = txClient || prisma;
    await accountsService.ensureSystemLedgersExist(db);

    // Fast-path: bulk-check existing opening balance vouchers in TWO queries instead of N per party.
    const existingCustomerVouchers = await db.voucher.findMany({
      where: { refDocType: "CUSTOMER_OPENING_BALANCE" },
      select: { refDocId: true },
    });
    const existingCustIds = new Set(existingCustomerVouchers.map((v) => v.refDocId));

    const existingSupplierVouchers = await db.voucher.findMany({
      where: { refDocType: "SUPPLIER_OPENING_BALANCE" },
      select: { refDocId: true },
    });
    const existingSupIds = new Set(existingSupplierVouchers.map((v) => v.refDocId));

    // Customers needing opening balance vouchers
    const customers = await db.customer.findMany({
      where: { openingBalance: { gt: 0 } },
    });
    const missingCustomers = customers.filter((c) => !existingCustIds.has(String(c.id)));
    if (missingCustomers.length === 0 && customers.length > 0) {
      // All good, skip loop entirely
    } else {
      for (const cust of missingCustomers) {
        const opBal = Number(cust.openingBalance || 0);
        if (opBal <= 0) continue;
        const opType = ((cust as any).openingBalanceType || "DEBIT").toUpperCase() as "DEBIT" | "CREDIT";
        await this.postCustomerOpeningBalanceVoucher(
          { id: cust.id, customerCode: cust.customerCode, firmName: cust.firmName },
          opBal,
          opType,
          db
        );
      }
    }

    // Suppliers needing opening balance vouchers
    const suppliers = await db.supplier.findMany({
      where: { openingBalance: { gt: 0 } },
    });
    const missingSuppliers = suppliers.filter((s) => !existingSupIds.has(String(s.id)));
    for (const supp of missingSuppliers) {
      const opBal = Number(supp.openingBalance || 0);
      if (opBal <= 0) continue;
      const opType = ((supp as any).openingBalanceType || "CREDIT").toUpperCase() as "DEBIT" | "CREDIT";
      await this.postSupplierOpeningBalanceVoucher(
        { id: supp.id, supplierCode: supp.supplierCode, legalName: supp.legalName },
        opBal,
        opType,
        db
      );
    }
  }
}

export const voucherPostingService = new VoucherPostingService();
