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
      const netAmountNum = Number(g.netAmount || g.subtotal || g.grandTotal || g.totalAmount || 0);
      const totalCgst = Number(g.totalCgst || 0);
      const totalSgst = Number(g.totalSgst || 0);
      const totalIgst = Number(g.totalIgst || 0);
      const purchaseBase = netAmountNum - totalCgst - totalSgst - totalIgst;

      const voucherNo = `PUR-${grnInvoice.grnNumber || grnInvoice.id.slice(-6)}`;
      const date = grnInvoice.grnDate || grnInvoice.createdAt;

      const journalItemsToCreate: any[] = [
        {
          debitLedgerId: purchaseLedger.id,
          debitAmount: new Prisma.Decimal(purchaseBase > 0 ? purchaseBase : netAmountNum),
          creditAmount: new Prisma.Decimal(0),
          narration: `Purchase of raw materials / goods (base excl. GST)`,
        },
      ];

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

      voucher = await db.voucher.create({
        data: {
          voucherNo,
          type: VoucherType.PURCHASE,
          date,
          narration: `Purchase invoice posted for GRN ${grnInvoice.grnNumber || grnInvoice.invoiceNo}`,
          refDocType: "GRN_INVOICE",
          refDocId: grnInvoice.id,
          items: { create: journalItemsToCreate },
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
      const salesBase = grandTotalNum - totalCgst - totalSgst - totalIgst;

      const salesJournalItems: any[] = [
        // Debit Customer for full grand total
        {
          debitLedgerId: customerLedger.id,
          debitAmount: grandTotal,
          creditAmount: new Prisma.Decimal(0),
          narration: `Receivable from ${salesInvoice.customer.firmName}`,
        },
        // Credit Sales Account for base amount (excl. GST)
        {
          creditLedgerId: salesLedger.id,
          debitAmount: new Prisma.Decimal(0),
          creditAmount: new Prisma.Decimal(salesBase > 0 ? salesBase : grandTotalNum),
          narration: `Revenue credited to Sales Account`,
        },
      ];

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

      voucher = await db.voucher.create({
        data: {
          voucherNo,
          type: VoucherType.SALES,
          date,
          narration: `Sales invoice posted for ${salesInvoice.invoiceNo}`,
          refDocType: "SALES_INVOICE",
          refDocId: salesInvoice.id,
          items: { create: salesJournalItems },
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
      // BUG-4 FIX: Refund should debit Sales Return A/c, NOT the Customer ledger.
      // Customer ledger was already credited by the Sales Return voucher above (reducing what they owe).
      // The refund is purely: Sales Return A/c Dr | Cash/Bank Cr — customer balance is NOT touched again.
      if (payLedger && salesReturnLedger) {
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
                  // Debit Sales Return A/c (reducing the return liability), NOT the customer ledger
                  debitLedgerId: salesReturnLedger.id,
                  debitAmount: grandTotal,
                  creditAmount: new Prisma.Decimal(0),
                  narration: `Sales return refund settled via ${salesReturn.refundMode}`,
                },
                {
                  // Credit Cash / Bank (asset decreases as cash goes out)
                  creditLedgerId: payLedger.id,
                  debitAmount: new Prisma.Decimal(0),
                  creditAmount: grandTotal,
                  narration: `Refund paid via ${salesReturn.refundMode} to ${salesReturn.customer.firmName}`,
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
      return db.voucher.create({
        data: {
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
      });
    } else {
      if (!cashLedger) return null;
      return db.voucher.create({
        data: {
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
      });
    }
  }

  /**
   * Sync unposted GRN Invoices, Sales Invoices, Expenses, and Petty Cash entries to the Voucher table.
   * Uses set-based queries and parallel batches for efficiency.
   */
  async syncUnpostedVouchers() {
    try {
      const [
        postedGrnVouchers,
        postedSalesVouchers,
        postedPettyCashVouchers,
        allGrnIds,
        allSalesIds,
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
          where: { refDocType: "PETTY_CASH" },
          select: { refDocId: true },
        }),
        prisma.grnInvoice.findMany({ select: { id: true } }),
        prisma.salesInvoice.findMany({ select: { id: true } }),
        prisma.pettyCashEntry.findMany({ select: { id: true, entryNo: true } }),
        prisma.expense.findMany({
          include: { supplier: true },
        }),
      ]);

      const postedGrnIds = new Set(postedGrnVouchers.map((v) => v.refDocId).filter(Boolean));
      const postedSalesIds = new Set(postedSalesVouchers.map((v) => v.refDocId).filter(Boolean));

      const unpostedGrnIds = allGrnIds.filter((g) => !postedGrnIds.has(g.id)).map((g) => g.id);
      const unpostedSalesIds = allSalesIds.filter((s) => !postedSalesIds.has(s.id)).map((s) => s.id);

      const batchSize = 10;
      for (let i = 0; i < unpostedGrnIds.length; i += batchSize) {
        await Promise.all(unpostedGrnIds.slice(i, i + batchSize).map((id) => this.postPurchaseVoucher(id)));
      }
      for (let i = 0; i < unpostedSalesIds.length; i += batchSize) {
        await Promise.all(unpostedSalesIds.slice(i, i + batchSize).map((id) => this.postSalesVoucher(id)));
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
          } catch (pcErr) {
            console.error(`[Auto-Post Voucher Error] Syncing expense ${exp.expenseNumber} to petty cash failed:`, pcErr);
          }
        }
      }

      const postedPettyCashIds = new Set(postedPettyCashVouchers.map((v) => v.refDocId).filter(Boolean));
      const unpostedPettyCashIds = pettyCashList.filter((p) => !postedPettyCashIds.has(String(p.id))).map((p) => p.id);

      for (const id of unpostedPettyCashIds) {
        await this.postPettyCashVoucher(id);
      }
    } catch (err) {
      console.error("[Auto-Post Voucher Error] Syncing unposted vouchers failed:", err);
    }
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

    return db.voucher.create({
      data: {
        voucherNo: `JV-SUP-OP-${supplier.supplierCode || String(supplier.id).slice(-6)}`,
        type: VoucherType.JOURNAL,
        date: new Date(),
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
    });
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

    return db.voucher.create({
      data: {
        voucherNo: `JV-CUST-OP-${customer.customerCode || String(customer.id).slice(-6)}`,
        type: VoucherType.JOURNAL,
        date: new Date(),
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
    });
  }

  /**
   * Automatically scan for and post missing double-entry opening balance vouchers
   * for any customers and suppliers who have an opening balance in the database.
   */
  async syncMissingOpeningBalanceVouchers(txClient?: Prisma.TransactionClient) {
    const db = txClient || prisma;
    await accountsService.ensureSystemLedgersExist(db);

    // 1. Sync Customer Opening Balance Vouchers
    const customers = await db.customer.findMany({
      where: { openingBalance: { gt: 0 } },
    });

    for (const cust of customers) {
      const opBal = Number(cust.openingBalance || 0);
      if (opBal <= 0) continue;

      const existingVoucher = await db.voucher.findFirst({
        where: {
          refDocType: "CUSTOMER_OPENING_BALANCE",
          refDocId: String(cust.id),
        },
      });

      if (!existingVoucher) {
        const opType = ((cust as any).openingBalanceType || "DEBIT").toUpperCase() as "DEBIT" | "CREDIT";
        await this.postCustomerOpeningBalanceVoucher(
          { id: cust.id, customerCode: cust.customerCode, firmName: cust.firmName },
          opBal,
          opType,
          db
        );
      }
    }

    // 2. Sync Supplier Opening Balance Vouchers
    const suppliers = await db.supplier.findMany({
      where: { openingBalance: { gt: 0 } },
    });

    for (const supp of suppliers) {
      const opBal = Number(supp.openingBalance || 0);
      if (opBal <= 0) continue;

      const existingVoucher = await db.voucher.findFirst({
        where: {
          refDocType: "SUPPLIER_OPENING_BALANCE",
          refDocId: String(supp.id),
        },
      });

      if (!existingVoucher) {
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
}

export const voucherPostingService = new VoucherPostingService();

