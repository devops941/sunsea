import { prisma } from "../../config/prisma";
import { Prisma, VoucherType } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { CreatePettyCashInput, GetPettyCashQueryInput } from "./petty-cash.types";
import { accountsService } from "../accounts/accounts.service";

class PettyCashService {
  private generateEntryNo(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `PC-${timestamp}-${random}`;
  }

  async getEntries(query: GetPettyCashQueryInput) {
    const where: Prisma.PettyCashEntryWhereInput = {
      ...(query.companyId && { companyId: query.companyId }),
      ...(query.type && { type: query.type }),
      ...(query.category && { category: { equals: query.category, mode: "insensitive" } }),
      ...((query.startDate || query.endDate) && {
        entryDate: {
          ...(query.startDate && { gte: new Date(query.startDate) }),
          ...(query.endDate && { lte: new Date(query.endDate) }),
        },
      }),
    };

    const entries = await prisma.pettyCashEntry.findMany({
      where,
      orderBy: { entryDate: "desc" },
    });

    // Also fetch all Expense entries for this company to include as Petty Cash OUT entries
    const expenses = await prisma.expense.findMany({
      where: query.companyId ? { companyId: query.companyId } : {},
      include: { supplier: true },
      orderBy: { date: "desc" },
    });

    let totalIn = 0;
    let totalOut = 0;

    const formattedEntries: any[] = [];

    // Map explicit petty cash entries
    entries.forEach((e) => {
      const amt = Number(e.amount);
      if (e.type === "IN") {
        totalIn += amt;
      } else {
        totalOut += amt;
      }
      formattedEntries.push({
        ...e,
        amount: amt,
      });
    });

    // Map expense records if not already synced by entryNo
    const existingEntryNos = new Set(entries.map((e) => e.entryNo));

    expenses.forEach((exp) => {
      const entryNo = `PC-EXP-${exp.expenseNumber}`;
      if (!existingEntryNos.has(entryNo)) {
        const amt = Number(exp.amount || 0);
        totalOut += amt;
        formattedEntries.push({
          id: exp.id,
          entryNo,
          entryDate: exp.date,
          category: exp.expenseCategory || "Expense",
          description: `Expense (${exp.expenseNumber}): ${exp.expense}`,
          amount: amt,
          type: "OUT",
          paidTo: exp.supplier?.legalName || exp.supplier || null,
          receiptNo: exp.receiptInvoice || exp.expenseNumber,
          companyId: exp.companyId,
          createdBy: exp.createdBy,
          createdAt: exp.createdAt,
          updatedAt: exp.updatedAt,
        });
      }
    });

    // Sort combined entries by entryDate descending
    formattedEntries.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());

    const currentBalance = totalIn - totalOut;

    return {
      entries: formattedEntries,
      summary: {
        totalIn,
        totalOut,
        currentBalance,
      },
    };
  }

  async createEntry(data: CreatePettyCashInput, createdBy?: string) {
    const entryNo = this.generateEntryNo();
    const entryDate = data.entryDate ? new Date(data.entryDate) : new Date();

    const entry = await prisma.pettyCashEntry.create({
      data: {
        entryNo,
        entryDate,
        category: data.category,
        description: data.description,
        amount: new Prisma.Decimal(data.amount),
        type: data.type,
        paidTo: data.paidTo || null,
        receiptNo: data.receiptNo || null,
        companyId: data.companyId,
        createdBy: createdBy || null,
      },
    });

    // Auto-post to ledger (double-entry bookkeeping)
    try {
      await accountsService.ensureSystemLedgersExist();
      const pcashLedger = await prisma.accountLedger.findUnique({ where: { code: "PCASH-001" } });
      const expenseLedger = await prisma.accountLedger.findUnique({ where: { code: "EXP-001" } });

      if (pcashLedger && expenseLedger) {
        const amount = new Prisma.Decimal(data.amount);
        const voucherNo = `PC-${entryNo}`;

        if (data.type === "OUT") {
          // Petty cash OUT: Debit Expense, Credit Petty Cash
          await prisma.voucher.create({
            data: {
              voucherNo,
              type: VoucherType.EXPENSE,
              date: entryDate,
              narration: `Petty cash payment: ${data.description || data.category}${data.paidTo ? ` to ${data.paidTo}` : ""}`,
              refDocType: "PETTY_CASH",
              refDocId: String(entry.id),
              items: {
                create: [
                  {
                    debitLedgerId: expenseLedger.id,
                    debitAmount: amount,
                    creditAmount: new Prisma.Decimal(0),
                    narration: `${data.category}: ${data.description || ""}`,
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
          // Petty cash IN (replenishment): Debit Petty Cash, Credit Cash
          const cashLedger = await prisma.accountLedger.findUnique({ where: { code: "CASH-001" } });
          if (cashLedger) {
            await prisma.voucher.create({
              data: {
                voucherNo,
                type: VoucherType.CONTRA,
                date: entryDate,
                narration: `Petty cash replenished: ${data.description || data.category}`,
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
      }
    } catch (err) {
      console.error("[PettyCashService] Auto-post to ledger failed:", err);
      // Don't fail the entry creation if ledger posting fails
    }

    return entry;
  }
}

export const pettyCashService = new PettyCashService();
