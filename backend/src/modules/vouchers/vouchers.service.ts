import { prisma } from "../../config/prisma";
import { VoucherType, Prisma } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { CreateVoucherInput, GetVouchersQueryInput } from "./vouchers.types";

class VouchersService {
  private generateVoucherNo(type: VoucherType): string {
    const prefixMap: Record<VoucherType, string> = {
      PAYMENT: "PAY",
      RECEIPT: "RCT",
      JOURNAL: "JRN",
      CONTRA: "CTR",
      SALES: "SLS",
      PURCHASE: "PUR",
      SALES_RETURN: "SRT",
      PURCHASE_RETURN: "PRT",
      EXPENSE: "EXP",
    };
    const prefix = prefixMap[type] || "VCH";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${timestamp}-${random}`;
  }

  private async enrichVouchers(vouchers: any[]) {
    try {
      const [allGrnInvoices, allSalesInvoices] = await Promise.all([
        prisma.grnInvoice.findMany({
          include: { supplier: true, store: true, items: true },
        }),
        prisma.salesInvoice.findMany({
          include: { customer: true, items: { include: { product: true } } },
        }),
      ]);

      const grnMapById = new Map<string, any>();
      const grnMapByPaymentId = new Map<string, any>();
      const grnMapByNumber = new Map<string, any>();

      for (const g of allGrnInvoices) {
        grnMapById.set(g.id, g);
        if (g.grnNumber) grnMapByNumber.set(g.grnNumber.toLowerCase(), g);
        if (g.invoiceNo) grnMapByNumber.set(g.invoiceNo.toLowerCase(), g);

        const payments: any[] = Array.isArray(g.payments) ? (g.payments as any[]) : [];
        for (const p of payments) {
          if (p.id) {
            grnMapByPaymentId.set(String(p.id), g);
          }
        }
      }

      const salesMapById = new Map<string, any>();
      const salesMapByPaymentId = new Map<string, any>();

      for (const s of allSalesInvoices) {
        salesMapById.set(s.id, s);
        const payments: any[] = Array.isArray(s.payments) ? (s.payments as any[]) : [];
        for (const p of payments) {
          if (p.id) {
            salesMapByPaymentId.set(String(p.id), s);
          }
        }
      }

      return vouchers.map((v) => {
        let refDoc: any = null;
        let grn: any = null;
        let inv: any = null;

        // Try matching GRN invoice
        if (v.refDocType === "GRN_INVOICE" || v.refDocType === "GRN_PAYMENT") {
          if (v.refDocId) {
            grn = grnMapByPaymentId.get(String(v.refDocId)) || grnMapById.get(String(v.refDocId));
            if (!grn && String(v.refDocId).includes("_pay_")) {
              grn = grnMapById.get(String(v.refDocId).split("_pay_")[0]);
            }
          }

          // Fallback: extract GRN number from narration
          if (!grn && v.narration) {
            const match = v.narration.match(/GRN[-\w]+/i);
            if (match && match[0]) {
              grn = grnMapByNumber.get(match[0].toLowerCase());
            }
          }

          if (grn) {
            refDoc = {
              id: grn.id,
              grnId: grn.id,
              invoiceNo: grn.invoiceNo || "-",
              grnNumber: grn.grnNumber || "-",
              supplierId: grn.supplierId,
              supplierName: grn.supplier?.legalName || grn.supplier?.displayName || "-",
              storeName: grn.store?.storeName || grn.storeId || "-",
              status: grn.paymentStatus || "POSTED",
              items: (grn.items || []).map((i: any) => ({
                description: i.description || "Item",
                uom: i.uom || "Units",
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
                tax: Number(i.tax || 0),
                lineTotal: Number(i.lineTotal),
              })),
            };
          }
        }

        // Try matching Sales invoice
        if (!refDoc && (v.refDocType === "SALES_INVOICE" || v.refDocType === "SALES_PAYMENT")) {
          if (v.refDocId) {
            inv = salesMapByPaymentId.get(String(v.refDocId)) || salesMapById.get(String(v.refDocId));
            if (!inv && String(v.refDocId).includes("_rcpt_")) {
              inv = salesMapById.get(String(v.refDocId).split("_rcpt_")[0]);
            }
          }

          if (inv) {
            refDoc = {
              id: inv.id,
              invoiceNo: inv.invoiceNo,
              customerName: inv.customer?.firmName || "-",
              status: inv.paymentStatus || "POSTED",
              items: (inv.items || []).map((i: any) => ({
                description: i.description || i.product?.productName || i.product?.skuCode || (i as any).productName || "Item",
                uom: i.uom || i.product?.uom || "Units",
                quantity: Number(i.quantity || 1),
                unitPrice: Number(i.unitPrice || (i as any).rate || 0),
                tax: Number(i.tax || 0),
                lineTotal: Number(i.lineTotal || (i as any).amount || 0),
              })),
            };
          }
        }

        return {
          ...v,
          status: (v as any).status || "POSTED",
          refDoc,
        };
      });
    } catch (e) {
      console.error("[VouchersService] Error in enrichVouchers:", e);
      return vouchers;
    }
  }

  async getVouchers(query: GetVouchersQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    try {
      const { voucherPostingService } = require("../accounts/voucherPosting.service");
      await voucherPostingService.syncUnpostedVouchers();
    } catch (e) {
      console.error("[VouchersService] Failed to sync unposted vouchers:", e);
    }

    const supplierIdNum = query.supplierId ? Number(query.supplierId) : undefined;

    const where: Prisma.VoucherWhereInput = {
      ...(query.type && { type: query.type }),
      ...(supplierIdNum && {
        items: {
          some: {
            OR: [
              { creditLedger: { supplierId: supplierIdNum } },
              { debitLedger: { supplierId: supplierIdNum } },
            ],
          },
        },
      }),
      ...((query.startDate || query.endDate) && {
        date: {
          ...(query.startDate && { gte: new Date(query.startDate) }),
          ...(query.endDate && { lte: new Date(query.endDate) }),
        },
      }),
      ...(query.search && {
        OR: [
          { voucherNo: { contains: query.search, mode: "insensitive" } },
          { narration: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [vouchers, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          items: {
            include: {
              debitLedger: { select: { id: true, name: true, code: true, supplierId: true, customerId: true } },
              creditLedger: { select: { id: true, name: true, code: true, supplierId: true, customerId: true } },
            },
          },
        },
      }),
      prisma.voucher.count({ where }),
    ]);

    const enriched = await this.enrichVouchers(vouchers);

    return {
      vouchers: enriched,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getVoucherById(id: number) {
    const voucher = await prisma.voucher.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            debitLedger: true,
            creditLedger: true,
          },
        },
      },
    });

    if (!voucher) {
      throw new ApiError(404, "Voucher not found");
    }

    const [enriched] = await this.enrichVouchers([voucher]);
    return enriched;
  }

  async createVoucher(data: CreateVoucherInput, createdBy?: string) {
    const voucherNo = data.voucherNo || this.generateVoucherNo(data.type);
    const voucherDate = data.date ? new Date(data.date) : new Date();

    let totalDebit = 0;
    let totalCredit = 0;
    for (const item of data.items) {
      totalDebit += item.debitAmount || 0;
      totalCredit += item.creditAmount || 0;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new ApiError(400, `Unbalanced voucher entry: Total Debit (${totalDebit.toFixed(2)}) must equal Total Credit (${totalCredit.toFixed(2)})`);
    }

    // BUG 4 Guard: Return Refund vouchers must not reference Customer or Supplier ledgers
    if (data.refDocType === "SALES_RETURN_REFUND" || data.refDocType === "PURCHASE_RETURN_REFUND") {
      const ledgerIds = data.items.flatMap(i => [i.debitLedgerId, i.creditLedgerId]).filter(Boolean) as number[];
      const partyLedger = await prisma.accountLedger.findFirst({
        where: { id: { in: ledgerIds }, OR: [{ customerId: { not: null } }, { supplierId: { not: null } }] }
      });
      if (partyLedger) {
        throw new ApiError(400, `Return refund vouchers must not directly touch Customer or Supplier ledgers (attempted on ledger ${partyLedger.code})`);
      }
    }

    // PAYMENT/RECEIPT side guard: prevents the classic "swap" bug where a
    // user picks a supplier in "Paid From" and a bank in "Paid To" (or vice
    // versa for Receipt). By definition:
    //   PAYMENT = money OUT of bank/cash → credit side MUST be a Cash/Bank ledger
    //   RECEIPT = money IN to bank/cash  → debit side  MUST be a Cash/Bank ledger
    // Backend enforces this even if the frontend filter is bypassed. Without
    // this guard, a swapped voucher INCREASES the party's balance instead of
    // reducing it, silently corrupting the ledger.
    if (data.type === "PAYMENT" || data.type === "RECEIPT") {
      const partyIds = data.items
        .map((i) => (data.type === "PAYMENT" ? i.creditLedgerId : i.debitLedgerId))
        .filter((id): id is number => id != null);
      if (partyIds.length > 0) {
        const ledgers = await prisma.accountLedger.findMany({
          where: { id: { in: partyIds } },
          select: { id: true, code: true, name: true, group: true },
        });
        const bankOrCash = (g: string | null | undefined) => {
          const gg = (g || "").toLowerCase();
          return gg.includes("cash") || gg.includes("bank");
        };
        const wrongSide = ledgers.find((l) => !bankOrCash(l.group));
        if (wrongSide) {
          const side = data.type === "PAYMENT" ? '"Paid From"' : '"Received In"';
          throw new ApiError(
            400,
            `${data.type} voucher's ${side} account must be a Bank or Cash ledger, ` +
              `but "${wrongSide.name}" (group: ${wrongSide.group || "-"}) was used. ` +
              `Common mistake: the two ledgers are swapped — check your entry.`
          );
        }
      }
    }

    return prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          voucherNo,
          type: data.type,
          date: voucherDate,
          narration: data.narration || null,
          refDocType: data.refDocType || null,
          refDocId: data.refDocId || null,
          createdBy: createdBy || null,
        },
      });

      const journalItems = data.items.map((item) => ({
        voucherId: voucher.id,
        debitLedgerId: item.debitLedgerId || null,
        creditLedgerId: item.creditLedgerId || null,
        debitAmount: new Prisma.Decimal(item.debitAmount || 0),
        creditAmount: new Prisma.Decimal(item.creditAmount || 0),
        narration: item.narration || data.narration || null,
      }));

      await tx.journalItem.createMany({
        data: journalItems,
      });

      return tx.voucher.findUnique({
        where: { id: voucher.id },
        include: {
          items: {
            include: {
              debitLedger: true,
              creditLedger: true,
            },
          },
        },
      });
    });
  }

  async autoPostVoucher(params: {
    type: VoucherType;
    refDocType: string;
    refDocId: string;
    debitLedgerId: number;
    creditLedgerId: number;
    amount: number;
    narration: string;
    date?: Date;
    createdBy?: string;
  }) {
    const existing = await prisma.voucher.findFirst({
      where: {
        refDocType: params.refDocType,
        refDocId: params.refDocId,
      },
    });

    if (existing) {
      return existing;
    }

    return this.createVoucher(
      {
        type: params.type,
        date: params.date ? params.date.toISOString() : new Date().toISOString(),
        narration: params.narration,
        refDocType: params.refDocType,
        refDocId: params.refDocId,
        items: [
          {
            debitLedgerId: params.debitLedgerId,
            creditLedgerId: params.creditLedgerId,
            debitAmount: params.amount,
            creditAmount: params.amount,
            narration: params.narration,
          },
        ],
      },
      params.createdBy
    );
  }
}

export const vouchersService = new VouchersService();
