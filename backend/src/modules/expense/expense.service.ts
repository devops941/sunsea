import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

class ExpenseService {
  /**
   * Creates a new expense.
   */
  async createExpense(
    data: any,
    currentUser: { userId: string; companyId: string }
  ) {
    // Client-supplied expenseNumber path — legacy imports / manual overrides.
    // Reject duplicates upfront so the caller sees a clean 409 instead of a
    // cryptic Prisma unique-constraint error.
    if (data.expenseNumber) {
      const existingExpense = await prisma.expense.findFirst({
        where: {
          companyId: currentUser.companyId,
          expenseNumber: data.expenseNumber,
        },
      });
      if (existingExpense) {
        throw new ApiError(409, `Expense number '${data.expenseNumber}' already exists for this company.`);
      }
    }

    // Auto-generate expenseNumber (with retry-on-collision) when the client
    // omits it — safer than the "fetch-then-post" pattern which raced when
    // multiple rows were saved in the same batch.
    const buildData = async () => ({
      ...data,
      expenseNumber: data.expenseNumber || (await this.getNextExpenseNumber(currentUser.companyId)),
      date: data.date ? new Date(data.date) : undefined,
      amount: data.amount !== undefined ? Number(data.amount) : undefined,
      supplierId: data.supplierId ? Number(data.supplierId) : null,
      // Golden-Rule ledger picks. Both are optional so legacy callers keep
      // working — postExpenseVoucher below falls back to system defaults.
      debitLedgerId: data.debitLedgerId ? Number(data.debitLedgerId) : null,
      creditLedgerId: data.creditLedgerId ? Number(data.creditLedgerId) : null,
      // Defaults for optional-but-required-in-schema fields.
      expenseCategory: data.expenseCategory || "General",
      paymentMethod: data.paymentMethod || "Cash",
      companyId: currentUser.companyId,
      createdBy: currentUser.userId,
    });

    // Retry loop — if getNextExpenseNumber races with a concurrent insert,
    // Prisma throws P2002 (unique constraint) on `(companyId, expenseNumber)`.
    // Recompute the next number and try again. Cap at 5 retries to avoid
    // infinite loop on genuine schema issues.
    let newExpense: any = null;
    let lastErr: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const payload = await buildData();
        newExpense = await prisma.expense.create({
          data: payload,
          include: { supplier: true },
        });
        break;
      } catch (err: any) {
        lastErr = err;
        // P2002 = unique constraint violation. Only retry when NO explicit
        // expenseNumber was supplied (else the caller wants THAT exact number).
        if (err?.code === "P2002" && !data.expenseNumber) continue;
        throw err;
      }
    }
    if (!newExpense) throw lastErr;

    // Post the double-entry EXPENSE voucher. Posting engine reads the two
    // ledger IDs off the expense row when present; otherwise it falls back
    // to EXP-001 + paymentMethod-guessed cash/bank ledger.
    try {
      const { voucherPostingService } = require("../accounts/voucherPosting.service");
      await voucherPostingService.postExpenseVoucher(newExpense.id, data.paymentMethod);
    } catch (voucherErr) {
      console.error("[Expense Voucher Posting Error]: Failed to post expense voucher", voucherErr);
    }

    // NOTE: We used to also create a `PC-EXP-*` PettyCashEntry here for
    // "record-keeping". That was a double-post — the sync sweep later
    // posted it AGAIN as a PETTY_CASH voucher, inflating expense totals on
    // TB/P&L. The EXPENSE voucher above already hits Petty Cash on the Cr
    // side (when Petty Cash is picked as the payment ledger), so the extra
    // PC entry is redundant. Removed. See git history for the old block.

    return newExpense;
  }

  /**
   * Fetches all expenses for a company with optional search, filtering, and pagination.
   */
  async getAllExpenses(companyId: string, query?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
  }) {
    const page = query?.page;
    const limit = query?.limit;
    const search = query?.search;
    const category = query?.category;
    const status = query?.status;

    const where: any = {
      companyId,
      ...(category && { expenseCategory: category }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { expenseNumber: { contains: search, mode: "insensitive" } },
          { expense: { contains: search, mode: "insensitive" } },
          { expenseCategory: { contains: search, mode: "insensitive" } },
          { supplier: { legalName: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const total = await prisma.expense.count({ where });

    const findOptions: any = {
      where,
      include: {
        supplier: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    };

    if (page !== undefined && limit !== undefined) {
      findOptions.skip = (page - 1) * limit;
      findOptions.take = limit;
    }

    const expenses = await prisma.expense.findMany(findOptions);

    if (page !== undefined && limit !== undefined) {
      return {
        data: expenses,
        total,
      };
    }

    return expenses;
  }

  /**
   * Fetches an expense by ID.
   */
  async getExpenseById(id: string, companyId: string) {
    const expense = await prisma.expense.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        supplier: true,
      },
    });

    if (!expense) {
      throw new ApiError(404, "Expense record not found.");
    }

    return expense;
  }

  /**
   * Updates an expense by ID.
   */
  async updateExpense(id: string, data: any, companyId: string) {
    const expense = await this.getExpenseById(id, companyId);

    if (data.expenseNumber && data.expenseNumber !== expense.expenseNumber) {
      const existing = await prisma.expense.findFirst({
        where: {
          companyId,
          expenseNumber: data.expenseNumber,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ApiError(409, `Expense number '${data.expenseNumber}' already exists for this company.`);
      }
    }

    const updateData = {
      ...data,
      ...(data.date && { date: new Date(data.date) }),
      ...(data.amount !== undefined && { amount: Number(data.amount) }),
      ...(data.supplierId !== undefined && { supplierId: data.supplierId ? Number(data.supplierId) : null }),
      ...(data.debitLedgerId !== undefined && { debitLedgerId: data.debitLedgerId ? Number(data.debitLedgerId) : null }),
      ...(data.creditLedgerId !== undefined && { creditLedgerId: data.creditLedgerId ? Number(data.creditLedgerId) : null }),
    };

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
      },
    });

    // Delete old EXPENSE voucher and re-post with updated data
    try {
      const oldVoucher = await prisma.voucher.findFirst({
        where: { refDocType: "EXPENSE", refDocId: id },
      });
      if (oldVoucher) {
        await prisma.journalItem.deleteMany({ where: { voucherId: oldVoucher.id } });
        await prisma.voucher.delete({ where: { id: oldVoucher.id } });
      }
      const { voucherPostingService } = require("../accounts/voucherPosting.service");
      await voucherPostingService.postExpenseVoucher(id, updatedExpense.paymentMethod);
    } catch (voucherErr) {
      console.error("[Expense Voucher Update Error]:", voucherErr);
    }

    // NOTE: PC-EXP-* petty cash sync removed (see createExpense comment).
    // The EXPENSE voucher's Cr side already lands on Petty Cash when that
    // ledger is selected — no separate PC entry needed.

    return updatedExpense;
  }

  /**
   * Deletes an expense by ID.
   */
  async deleteExpense(id: string, companyId: string) {
    const expense = await this.getExpenseById(id, companyId);
    
    // Delete associated EXPENSE voucher and its journal items
    try {
      const voucher = await prisma.voucher.findFirst({
        where: { refDocType: "EXPENSE", refDocId: id },
      });
      if (voucher) {
        await prisma.journalItem.deleteMany({ where: { voucherId: voucher.id } });
        await prisma.voucher.delete({ where: { id: voucher.id } });
      }
    } catch (voucherErr) {
      console.error("[Expense Voucher Delete Error]:", voucherErr);
    }

    // Legacy cleanup: older records may still have a PC-EXP-* entry from
    // the previous double-post design. Sweep them so deleting an old
    // expense doesn't leave an orphan petty cash row.
    try {
      const pcEntryNo = `PC-EXP-${expense.expenseNumber}`;
      await prisma.pettyCashEntry.deleteMany({ where: { entryNo: pcEntryNo } });
    } catch (pcErr) {
      console.error("[Legacy PC-EXP Cleanup Error]:", pcErr);
    }

    return prisma.expense.delete({
      where: { id },
    });
  }

  /**
   * Generates the next sequential expense code — scans every EXP-N row in
   * this company, takes MAX(N) + 1. Ignores rows whose number doesn't match
   * the EXP-\d+ pattern (custom / legacy formats) so they never bump the
   * sequential counter or produce nonsense fallbacks like "PC-EXP-abc-001".
   */
  async getNextExpenseNumber(companyId: string) {
    const rows = await prisma.expense.findMany({
      where: {
        companyId,
        expenseNumber: { startsWith: "EXP-" },
      },
      select: { expenseNumber: true },
    });

    let maxN = 0;
    for (const r of rows) {
      const m = r.expenseNumber.match(/^EXP-(\d+)$/);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxN) maxN = n;
    }
    return `EXP-${String(maxN + 1).padStart(3, "0")}`;
  }
}

export const expenseService = new ExpenseService();
export default expenseService;
