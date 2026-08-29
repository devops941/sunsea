import { prisma } from "../../config/prisma";
import { extractPaymentsArray } from "../../utils/payments";

/**
 * Outstanding Service — bill-wise outstanding + aging analysis.
 *
 * For Receivable (customers who owe us): each unpaid Sales Invoice becomes a
 * bill. Age is computed against `dueDate` (falls back to `invoiceDate` if no
 * due date). Bills are bucketed into: current / 0-30 / 31-60 / 61-90 / 90+.
 *
 * For Payable (suppliers we owe): mirrors the same logic against GrnInvoice.
 *
 * All aggregation is done in memory after a single findMany per party type —
 * no per-invoice DB roundtrip. Payments are read from the `payments` JSON
 * array on each invoice (already the source of truth in this project).
 */

export type AgingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+";

interface OutstandingBill {
  id: string | number;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  billAmount: number;
  paidAmount: number;
  balance: number;
  ageDays: number;   // days since due date (negative = not yet due)
  bucket: AgingBucket;
}

interface OutstandingParty {
  partyId: string | number;
  partyCode: string;
  partyName: string;
  gstin?: string | null;
  phone?: string | null;
  totalOutstanding: number;
  bills: OutstandingBill[];
  bucketTotals: Record<AgingBucket, number>;
}

interface OutstandingReport {
  asOnDate: string;
  parties: OutstandingParty[];
  grandTotal: number;
  grandBucketTotals: Record<AgingBucket, number>;
}

function classifyBucket(ageDays: number): AgingBucket {
  if (ageDays <= 0) return "current";
  if (ageDays <= 30) return "0-30";
  if (ageDays <= 60) return "31-60";
  if (ageDays <= 90) return "61-90";
  return "90+";
}

function emptyBucketTotals(): Record<AgingBucket, number> {
  return { current: 0, "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
}

class OutstandingService {
  /**
   * Customer-wise receivable outstanding + bill-wise breakdown + aging.
   *
   * Includes:
   *   1. Each unpaid Sales Invoice as a bill (aged by dueDate)
   *   2. Opening balance as a synthetic "OPENING" bill for customers who had
   *      a non-zero opening carried in from prior periods (Busy import etc.)
   *
   * Without (2), the totals here would silently be lower than the dashboard's
   * ledger-based receivable — because dashboard counts opening + invoices,
   * outstanding page used to count only invoices. Now both agree.
   */
  async getReceivable(params?: { asOnDate?: string }): Promise<OutstandingReport> {
    const asOn = params?.asOnDate ? new Date(params.asOnDate) : new Date();
    asOn.setHours(23, 59, 59, 999);

    // Fetch invoices + all customers (so we can include opening-only ones too)
    const [invoices, customers] = await Promise.all([
      prisma.salesInvoice.findMany({
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true, invoiceNo: true, invoiceDate: true, dueDate: true,
          grandTotal: true, payments: true, customerId: true,
          customer: {
            select: {
              id: true, customerCode: true, firmName: true, gstin: true,
              mobile: true,
            },
          },
        },
        orderBy: { invoiceDate: "asc" },
      }),
      prisma.customer.findMany({
        select: {
          id: true, customerCode: true, firmName: true, gstin: true, mobile: true,
          openingBalance: true, openingBalanceType: true, createdAt: true,
        },
      }),
    ]);

    const byParty = new Map<string, OutstandingParty>();

    // Extract raw mobile → phone helper
    const phoneOf = (rawMobile: any): string | null => {
      if (Array.isArray(rawMobile) && rawMobile.length > 0) {
        return rawMobile[0]?.number || rawMobile[0]?.value || null;
      }
      return typeof rawMobile === "string" ? rawMobile : null;
    };

    // ─── Step 1: Add opening balance as synthetic "OPENING" bill ──
    // For CUSTOMER: default openingBalanceType = DEBIT (they owe us → positive).
    // CREDIT type = advance from customer → negative balance (skip from receivable).
    // Age is computed from customer.createdAt (or fixed FY start) so old openings
    // fall into the 90+ bucket naturally.
    for (const c of customers) {
      const raw = Number(c.openingBalance || 0);
      if (raw === 0) continue;
      const opType = String((c as any).openingBalanceType || "DEBIT").toUpperCase();
      const signed = opType === "CREDIT" ? -Math.abs(raw) : Math.abs(raw);
      if (signed <= 0) continue; // customer has advance, not a receivable

      const openingDate = c.createdAt ? new Date(c.createdAt) : asOn;
      if (openingDate > asOn) continue;
      const ageDays = Math.floor((asOn.getTime() - openingDate.getTime()) / 86400000);
      const bucket = classifyBucket(ageDays);
      const bill: OutstandingBill = {
        id: `opening-${c.id}`,
        invoiceNo: "OPENING",
        invoiceDate: openingDate.toISOString().split("T")[0],
        dueDate: null,
        billAmount: signed,
        paidAmount: 0,
        balance: signed,
        ageDays,
        bucket,
      };
      byParty.set(c.id, {
        partyId: c.id,
        partyCode: c.customerCode,
        partyName: c.firmName,
        gstin: c.gstin,
        phone: phoneOf((c as any).mobile),
        totalOutstanding: signed,
        bills: [bill],
        bucketTotals: { ...emptyBucketTotals(), [bucket]: signed },
      });
    }

    // ─── Step 2: Add invoice-wise bills ───────────────────────

    for (const inv of invoices) {
      const invoiceDate = new Date(inv.invoiceDate);
      if (invoiceDate > asOn) continue; // exclude future-dated invoices for as-on report

      const payments = extractPaymentsArray(inv.payments);
      const paidAmount = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const billAmount = Number(inv.grandTotal || 0);
      const balance = Math.max(0, billAmount - paidAmount);
      if (balance < 0.01) continue; // fully paid — skip

      const dueDateObj = inv.dueDate ? new Date(inv.dueDate) : invoiceDate;
      const ageDays = Math.floor((asOn.getTime() - dueDateObj.getTime()) / 86400000);
      const bucket = classifyBucket(ageDays);

      const bill: OutstandingBill = {
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        invoiceDate: invoiceDate.toISOString().split("T")[0],
        dueDate: inv.dueDate ? dueDateObj.toISOString().split("T")[0] : null,
        billAmount,
        paidAmount,
        balance,
        ageDays,
        bucket,
      };

      const key = inv.customerId;
      let party = byParty.get(key);
      if (!party) {
        // mobile is JSON — extract first phone
        const rawMobile = (inv.customer as any)?.mobile;
        const phone = Array.isArray(rawMobile) && rawMobile.length > 0
          ? (rawMobile[0]?.number || rawMobile[0]?.value || null)
          : typeof rawMobile === "string" ? rawMobile : null;
        party = {
          partyId: inv.customer!.id,
          partyCode: inv.customer!.customerCode,
          partyName: inv.customer!.firmName,
          gstin: inv.customer!.gstin,
          phone,
          totalOutstanding: 0,
          bills: [],
          bucketTotals: emptyBucketTotals(),
        };
        byParty.set(key, party);
      }
      party.bills.push(bill);
      party.totalOutstanding += balance;
      party.bucketTotals[bucket] += balance;
    }

    const parties = Array.from(byParty.values())
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    const grandTotal = parties.reduce((s, p) => s + p.totalOutstanding, 0);
    const grandBucketTotals = emptyBucketTotals();
    for (const p of parties) {
      (Object.keys(grandBucketTotals) as AgingBucket[]).forEach((k) => {
        grandBucketTotals[k] += p.bucketTotals[k];
      });
    }

    return {
      asOnDate: asOn.toISOString().split("T")[0],
      parties,
      grandTotal,
      grandBucketTotals,
    };
  }

  /**
   * Supplier-wise payable outstanding + bill-wise breakdown + aging.
   *
   * Same pattern as getReceivable: opening balance is added as a synthetic
   * "OPENING" bill for suppliers with non-zero opening (so totals match the
   * dashboard's ledger-based payable).
   */
  async getPayable(params?: { asOnDate?: string }): Promise<OutstandingReport> {
    const asOn = params?.asOnDate ? new Date(params.asOnDate) : new Date();
    asOn.setHours(23, 59, 59, 999);

    const [invoices, suppliers] = await Promise.all([
      (prisma as any).grnInvoice.findMany({
        select: {
          id: true, invoiceNo: true, grnNumber: true, grnDate: true, billDueDate: true,
          netAmount: true, subtotal: true, payments: true, supplierId: true,
          supplier: {
            select: {
              id: true, supplierCode: true, legalName: true, gstin: true,
              mobile: true,
            },
          },
        },
        orderBy: { grnDate: "asc" },
      }),
      prisma.supplier.findMany({
        select: {
          id: true, supplierCode: true, legalName: true, gstin: true, mobile: true,
          openingBalance: true, openingBalanceType: true, createdAt: true,
        },
      }),
    ]);

    const byParty = new Map<number, OutstandingParty>();

    const phoneOf = (rawMobile: any): string | null => {
      if (Array.isArray(rawMobile) && rawMobile.length > 0) {
        return rawMobile[0]?.number || rawMobile[0]?.value || null;
      }
      return typeof rawMobile === "string" ? rawMobile : null;
    };

    // ─── Step 1: Add opening balance as synthetic "OPENING" bill ──
    // For SUPPLIER: default openingBalanceType = CREDIT (we owe them → positive).
    // DEBIT type = advance paid → negative (supplier owes us) → skip from payable.
    for (const s of suppliers) {
      const raw = Number(s.openingBalance || 0);
      if (raw === 0) continue;
      const opType = String((s as any).openingBalanceType || "CREDIT").toUpperCase();
      const signed = opType === "DEBIT" ? -Math.abs(raw) : Math.abs(raw);
      if (signed <= 0) continue;

      const openingDate = s.createdAt ? new Date(s.createdAt) : asOn;
      if (openingDate > asOn) continue;
      const ageDays = Math.floor((asOn.getTime() - openingDate.getTime()) / 86400000);
      const bucket = classifyBucket(ageDays);
      const bill: OutstandingBill = {
        id: `opening-${s.id}`,
        invoiceNo: "OPENING",
        invoiceDate: openingDate.toISOString().split("T")[0],
        dueDate: null,
        billAmount: signed,
        paidAmount: 0,
        balance: signed,
        ageDays,
        bucket,
      };
      byParty.set(s.id, {
        partyId: s.id,
        partyCode: s.supplierCode,
        partyName: s.legalName,
        gstin: s.gstin,
        phone: phoneOf((s as any).mobile),
        totalOutstanding: signed,
        bills: [bill],
        bucketTotals: { ...emptyBucketTotals(), [bucket]: signed },
      });
    }

    // ─── Step 2: Add invoice-wise bills ───────────────────────

    for (const inv of invoices as any[]) {
      const invoiceDate = new Date(inv.grnDate);
      if (invoiceDate > asOn) continue;

      const payments = extractPaymentsArray(inv.payments);
      const paidAmount = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const billAmount = Number(inv.netAmount || inv.subtotal || 0);
      const balance = Math.max(0, billAmount - paidAmount);
      if (balance < 0.01) continue;

      const dueDateObj = inv.billDueDate ? new Date(inv.billDueDate) : invoiceDate;
      const ageDays = Math.floor((asOn.getTime() - dueDateObj.getTime()) / 86400000);
      const bucket = classifyBucket(ageDays);

      const bill: OutstandingBill = {
        id: inv.id,
        invoiceNo: inv.invoiceNo || inv.grnNumber,
        invoiceDate: invoiceDate.toISOString().split("T")[0],
        dueDate: inv.billDueDate ? dueDateObj.toISOString().split("T")[0] : null,
        billAmount,
        paidAmount,
        balance,
        ageDays,
        bucket,
      };

      const key = inv.supplierId;
      let party = byParty.get(key);
      if (!party) {
        const rawMobile = inv.supplier?.mobile;
        const phone = Array.isArray(rawMobile) && rawMobile.length > 0
          ? (rawMobile[0]?.number || rawMobile[0]?.value || null)
          : typeof rawMobile === "string" ? rawMobile : null;
        party = {
          partyId: inv.supplier.id,
          partyCode: inv.supplier.supplierCode,
          partyName: inv.supplier.legalName,
          gstin: inv.supplier.gstin,
          phone,
          totalOutstanding: 0,
          bills: [],
          bucketTotals: emptyBucketTotals(),
        };
        byParty.set(key, party);
      }
      party.bills.push(bill);
      party.totalOutstanding += balance;
      party.bucketTotals[bucket] += balance;
    }

    const parties = Array.from(byParty.values())
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    const grandTotal = parties.reduce((s, p) => s + p.totalOutstanding, 0);
    const grandBucketTotals = emptyBucketTotals();
    for (const p of parties) {
      (Object.keys(grandBucketTotals) as AgingBucket[]).forEach((k) => {
        grandBucketTotals[k] += p.bucketTotals[k];
      });
    }

    return {
      asOnDate: asOn.toISOString().split("T")[0],
      parties,
      grandTotal,
      grandBucketTotals,
    };
  }
}

export const outstandingService = new OutstandingService();
