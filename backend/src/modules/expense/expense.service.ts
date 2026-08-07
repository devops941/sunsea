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
    // Check if expense number already exists for this company
    const existingExpense = await prisma.expense.findFirst({
      where: {
        companyId: currentUser.companyId,
        expenseNumber: data.expenseNumber,
      },
    });

    if (existingExpense) {
      throw new ApiError(409, `Expense number '${data.expenseNumber}' already exists for this company.`);
    }

    const newExpense = await prisma.expense.create({
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        amount: data.amount !== undefined ? Number(data.amount) : undefined,
        supplierId: data.supplierId ? Number(data.supplierId) : null,
        companyId: currentUser.companyId,
        createdBy: currentUser.userId,
      },
      include: {
        supplier: true,
      },
    });

    // Post a direct EXPENSE voucher to the correct Cash/Bank ledger
    try {
      const { voucherPostingService } = require("../accounts/voucherPosting.service");
      await voucherPostingService.postExpenseVoucher(newExpense.id, data.paymentMethod);
    } catch (voucherErr) {
      console.error("[Expense Voucher Posting Error]: Failed to post expense voucher", voucherErr);
    }

    // Also create a Petty Cash entry for petty cash tracking (record-keeping only, no voucher posting)
    try {
      const pcEntryNo = `PC-EXP-${newExpense.expenseNumber}`;
      await prisma.pettyCashEntry.create({
        data: {
          entryNo: pcEntryNo,
          entryDate: newExpense.date || new Date(),
          category: newExpense.expenseCategory || "General Expense",
          description: `Expense (${newExpense.expenseNumber}): ${newExpense.expense}`,
          amount: newExpense.amount,
          type: "OUT",
          paidTo: newExpense.supplier?.legalName || null,
          receiptNo: newExpense.receiptInvoice || newExpense.expenseNumber,
          companyId: currentUser.companyId,
          createdBy: currentUser.userId,
        },
      });
    } catch (pcErr) {
      console.error("[Petty Cash Sync Error]: Failed to create petty cash entry for expense", pcErr);
    }

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

    // Update corresponding petty cash entry if exists
    try {
      const pcEntryNo = `PC-EXP-${updatedExpense.expenseNumber}`;
      await prisma.pettyCashEntry.updateMany({
        where: { entryNo: pcEntryNo },
        data: {
          entryDate: updatedExpense.date,
          category: updatedExpense.expenseCategory || "General Expense",
          description: `Expense (${updatedExpense.expenseNumber}): ${updatedExpense.expense}`,
          amount: updatedExpense.amount,
          paidTo: updatedExpense.supplier?.legalName || null,
          receiptNo: updatedExpense.receiptInvoice || updatedExpense.expenseNumber,
        },
      });
    } catch (pcErr) {
      console.error("[Petty Cash Update Error]:", pcErr);
    }

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

    // Delete corresponding petty cash entry if exists
    try {
      const pcEntryNo = `PC-EXP-${expense.expenseNumber}`;
      await prisma.pettyCashEntry.deleteMany({
        where: { entryNo: pcEntryNo },
      });
    } catch (pcErr) {
      console.error("[Petty Cash Delete Error]:", pcErr);
    }

    return prisma.expense.delete({
      where: { id },
    });
  }

  /**
   * Generates the next sequential expense code.
   */
  async getNextExpenseNumber(companyId: string) {
    const lastExpense = await prisma.expense.findFirst({
      where: { companyId },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!lastExpense) {
      return "EXP-001";
    }

    const lastCode = lastExpense.expenseNumber;
    const match = lastCode.match(/EXP-(\d+)/);

    if (!match) {
      return `${lastCode}-001`;
    }

    const nextNum = parseInt(match[1], 10) + 1;
    return `EXP-${String(nextNum).padStart(3, "0")}`;
  }
}

export const expenseService = new ExpenseService();
export default expenseService;
