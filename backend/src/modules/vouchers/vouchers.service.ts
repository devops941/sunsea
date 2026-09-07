import { prisma } from "../../config/prisma";
import { VoucherType, Prisma } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { CreateVoucherInput, GetVouchersQueryInput, UpdateVoucherInput } from "./vouchers.types";

class VouchersService {
  private readonly prefixMap: Record<VoucherType, string> = {
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

  /**
   * Busy-style sequential numbering: PAY-00001, PAY-00002, ...
   * We count existing vouchers of this type whose voucherNo matches
   * the sequential pattern and pick next. Older random-formatted numbers
   * (e.g. PAY-123456-7890) are ignored by the pattern match so they
   * don't collide with the new sequence.
   */
  async peekNextVoucherNo(type: VoucherType): Promise<string> {
    const prefix = this.prefixMap[type] || "VCH";
    const rows = await prisma.voucher.findMany({
      where: {
        type,
        voucherNo: { startsWith: `${prefix}-` },
      },
      select: { voucherNo: true },
    });
    const seqRegex = new RegExp(`^${prefix}-(\\d+)$`);
    let maxSeq = 0;
    for (const r of rows) {
      const m = r.voucherNo.match(seqRegex);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    }
    // Busy shows plain integers ("Vch No. 1", "2", ...). We keep the type
    // prefix for cross-type uniqueness (voucherNo is @unique globally), but
    // no zero-padding — the UI strips the prefix so the operator sees just N.
    return `${prefix}-${maxSeq + 1}`;
  }

  private async generateVoucherNo(type: VoucherType): Promise<string> {
    // Retry a few times to survive a race where two creates read the same
    // maxSeq at once — the DB unique constraint on voucherNo is the source
    // of truth, so on conflict we peek again.
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = await this.peekNextVoucherNo(type);
      const exists = await prisma.voucher.findUnique({
        where: { voucherNo: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    // Fallback: append time-based suffix if we can't settle on a sequence
    const prefix = this.prefixMap[type] || "VCH";
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  }

  async deleteVoucher(id: number) {
    const voucher = await prisma.voucher.findUnique({ where: { id }, select: { id: true, type: true, refDocType: true } });
    if (!voucher) throw new ApiError(404, "Voucher not found");

    // Block deletion of system-generated vouchers (opening balance JVs, invoice-linked vouchers)
    const blockedRefDocTypes = ["LEDGER_OPENING_BALANCE", "CUSTOMER_OPENING_BALANCE", "SUPPLIER_OPENING_BALANCE"];
    if (voucher.refDocType && blockedRefDocTypes.includes(voucher.refDocType)) {
      throw new ApiError(400, "System-generated vouchers cannot be deleted");
    }

    await prisma.$transaction([
      prisma.journalItem.deleteMany({ where: { voucherId: id } }),
      prisma.voucher.delete({ where: { id } }),
    ]);

    return { deleted: true, id };
  }

  /**
   * Update an existing voucher — supports Busy-style "List → Modify" flow.
   *
   * Rules:
   *  • Voucher ID stays the same (ledger history references it by id).
   *  • System-generated vouchers (opening balance JVs) are locked, same as
   *    delete — modifying them would silently corrupt the audit trail.
   *  • Items, when supplied, fully replace existing journal items (delete
   *    then recreate). Journal items don't have a stable business key we
   *    can diff on, so wholesale swap is both correct and simplest.
   *  • Dr/Cr totals must still balance if items are updated.
   *  • Same Bank/Cash side guard as create for PAYMENT/RECEIPT.
   */
  async updateVoucher(id: number, data: UpdateVoucherInput) {
    const existing = await prisma.voucher.findUnique({
      where: { id },
      select: { id: true, type: true, refDocType: true },
    });
    if (!existing) throw new ApiError(404, "Voucher not found");

    const blockedRefDocTypes = [
      "LEDGER_OPENING_BALANCE",
      "CUSTOMER_OPENING_BALANCE",
      "SUPPLIER_OPENING_BALANCE",
    ];
    if (existing.refDocType && blockedRefDocTypes.includes(existing.refDocType)) {
      throw new ApiError(400, "System-generated vouchers cannot be edited");
    }

    if (data.items && data.items.length > 0) {
      let totalDebit = 0;
      let totalCredit = 0;
      for (const item of data.items) {
        totalDebit += item.debitAmount || 0;
        totalCredit += item.creditAmount || 0;
      }
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new ApiError(
          400,
          `Unbalanced voucher entry: Total Debit (${totalDebit.toFixed(2)}) must equal Total Credit (${totalCredit.toFixed(2)})`
        );
      }

      // Same Bank/Cash side guard as create — a modified PAYMENT can't move
      // to a party ledger on the credit side (would silently corrupt).
      if (existing.type === "PAYMENT" || existing.type === "RECEIPT") {
        const partyIds = data.items
          .map((i) => (existing.type === "PAYMENT" ? i.creditLedgerId : i.debitLedgerId))
          .filter((pid): pid is number => pid != null);
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
            const side = existing.type === "PAYMENT" ? '"Paid From"' : '"Received In"';
            throw new ApiError(
              400,
              `${existing.type} voucher's ${side} account must be a Bank or Cash ledger, ` +
                `but "${wrongSide.name}" (group: ${wrongSide.group || "-"}) was used.`
            );
          }
        }
      }
    }

    return prisma.$transaction(async (tx) => {
      await tx.voucher.update({
        where: { id },
        data: {
          ...(data.date ? { date: new Date(data.date) } : {}),
          ...(data.narration !== undefined ? { narration: data.narration || null } : {}),
        },
      });

      if (data.items && data.items.length > 0) {
        // Wholesale swap: kill existing items, then re-create from payload.
        await tx.journalItem.deleteMany({ where: { voucherId: id } });
        await tx.journalItem.createMany({
          data: data.items.map((item) => ({
            voucherId: id,
            debitLedgerId: item.debitLedgerId || null,
            creditLedgerId: item.creditLedgerId || null,
            debitAmount: new Prisma.Decimal(item.debitAmount || 0),
            creditAmount: new Prisma.Decimal(item.creditAmount || 0),
            narration: item.narration || data.narration || null,
          })),
        });
      }

      return tx.voucher.findUnique({
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
    });
  }

  private async enrichVouchers(vouchers: any[]) {
    try {
      // Explicit `select` — only pull the fields the mapping below actually
      // reads. Two reasons:
      //   1. Query is a full-table scan (no where clause) so trimming
      //      columns is a real perf win on large datasets.
      //   2. Insulates the enrichment path from schema drift on unused
      //      columns (e.g. shipping_address_line1 declared in schema but
      //      missing in DB → previously blew up with P2022).
      const [allGrnInvoices, allSalesInvoices] = await Promise.all([
        prisma.grnInvoice.findMany({
          select: {
            id: true,
            grnNumber: true,
            invoiceNo: true,
            supplierId: true,
            paymentStatus: true,
            payments: true,
            supplier: { select: { legalName: true, displayName: true } },
            store: { select: { storeName: true, storeId: true } },
            items: {
              select: {
                description: true,
                uom: true,
                quantity: true,
                unitPrice: true,
                tax: true,
                lineTotal: true,
              },
            },
          },
        }),
        prisma.salesInvoice.findMany({
          select: {
            id: true,
            invoiceNo: true,
            status: true,
            payments: true,
            customer: { select: { firmName: true } },
            items: {
              select: {
                description: true,
                uom: true,
                quantity: true,
                unitPrice: true,
                tax: true,
                lineTotal: true,
                product: { select: { productName: true, productCode: true } },
              },
            },
          },
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
              status: inv.status || "POSTED",
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
    const voucherNo = data.voucherNo || (await this.generateVoucherNo(data.type));
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
