import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import salesInvoiceService from "./sales-invoice.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

class SalesInvoiceController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, "Unauthorized: missing user context");
    }

    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }
    const companyId = company.id;

    const salesInvoice = await salesInvoiceService.createSalesInvoice(req.body, {
      userId,
      companyId,
    });

    return res.status(201).json(
      new ApiResponse("Sales Invoice created successfully", salesInvoice)
    );
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }
    const companyId = company.id;

    const { page, pageSize, search, customerId, fromDate, toDate } = req.query;

    const result = await salesInvoiceService.getAllSalesInvoices({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search: search as string,
      customerId: customerId as string,
      fromDate: fromDate as string,
      toDate: toDate as string,
      companyId,
    });

    return res.status(200).json(
      new ApiResponse("Sales Invoices fetched successfully", result)
    );
  });

  findOne = asyncHandler(async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }
    const companyId = company.id;

    const id = req.params.id as string;
    const salesInvoice = await salesInvoiceService.getSalesInvoiceById(id, companyId);

    return res.status(200).json(
      new ApiResponse("Sales Invoice fetched successfully", salesInvoice)
    );
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }
    const companyId = company.id;

    const id = req.params.id as string;
    await salesInvoiceService.deleteSalesInvoice(id, companyId);

    return res.status(200).json(
      new ApiResponse("Sales Invoice deleted successfully")
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, "Unauthorized: missing user context");
    }

    const company = await prisma.company.findFirst();
    if (!company) {
      throw new ApiError(500, "Internal Server Error: No company found in the system");
    }
    const companyId = company.id;

    const id = req.params.id as string;
    const salesInvoice = await salesInvoiceService.updateSalesInvoice(id, req.body, {
      userId,
      companyId,
    });

    return res.status(200).json(
      new ApiResponse("Sales Invoice updated successfully", salesInvoice)
    );
  });
}

export const salesInvoiceController = new SalesInvoiceController();
export default salesInvoiceController;
