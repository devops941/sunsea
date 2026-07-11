import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { expenseService } from "./expense.service";
import { prisma } from "../../config/prisma";

class ExpenseController {
  private async getCompanyId(): Promise<string> {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }
    return company.id;
  }

  create = asyncHandler(async (req: Request, res: Response) => {
    let userId = req.user?.userId;

    if (!userId) {
      throw new ApiError(401, "Unauthorized: missing user context");
    }

    // Resolve admin virtual ID to standard user ID to prevent P2003 constraint failure
    if (userId.startsWith("admin_")) {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) {
        userId = firstUser.userId;
      }
    }

    const companyId = await this.getCompanyId();

    const expense = await expenseService.createExpense(req.body, {
      userId,
      companyId,
    });

    return res.status(201).json(
      new ApiResponse("Expense created successfully", expense)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const search = req.query.search ? String(req.query.search) : undefined;
    const companyId = await this.getCompanyId();

    const expenses = await expenseService.getAllExpenses(companyId, search);

    return res.status(200).json(
      new ApiResponse("Expenses fetched successfully", expenses)
    );
  });

  findOne = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const companyId = await this.getCompanyId();

    const expense = await expenseService.getExpenseById(id, companyId);

    return res.status(200).json(
      new ApiResponse("Expense fetched successfully", expense)
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const companyId = await this.getCompanyId();

    const expense = await expenseService.updateExpense(id, req.body, companyId);

    return res.status(200).json(
      new ApiResponse("Expense updated successfully", expense)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const companyId = await this.getCompanyId();

    await expenseService.deleteExpense(id, companyId);

    return res.status(200).json(
      new ApiResponse("Expense deleted successfully")
    );
  });

  getNextCode = asyncHandler(async (req: Request, res: Response) => {
    const companyId = await this.getCompanyId();
    const nextCode = await expenseService.getNextExpenseNumber(companyId);

    return res.status(200).json(
      new ApiResponse("Next expense code fetched successfully", nextCode)
    );
  });
}

export const expenseController = new ExpenseController();
export default expenseController;
