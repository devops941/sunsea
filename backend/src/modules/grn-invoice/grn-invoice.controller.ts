import { Request, Response } from "express";
import grnInvoiceService from "./grn-invoice.service";
import { prisma } from "../../config/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

class GrnInvoiceController {

    create = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new ApiError(401, "Unauthorized: missing user context");
        }

        const company = await prisma.company.findFirst();
        if (!company) {
            throw new ApiError(500, "Internal Server Error: No company found in the system");
        }

        const grnInvoice = await grnInvoiceService.createGrnInvoice(req.body, {
            userId,
            companyId: company.id,
        }, req.file);

        return res.status(201).json(
            new ApiResponse("GRN / Invoice created successfully", grnInvoice)
        );
    });

    findAll = asyncHandler(async (req: Request, res: Response) => {
        const { page, pageSize, search, supplierId, storeId } = req.query;

        const result = await grnInvoiceService.getAllGrnInvoices({
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
            search: search as string,
            supplierId: supplierId ? Number(supplierId) : undefined,
            storeId: storeId as string,
        });

        return res.status(200).json(
            new ApiResponse("GRN / Invoices fetched successfully", result)
        );
    });

    findOne = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;

        const grnInvoice = await grnInvoiceService.getGrnInvoiceById(id);

        return res.status(200).json(
            new ApiResponse("GRN / Invoice fetched successfully", grnInvoice)
        );
    });

    update = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;

        const grnInvoice = await grnInvoiceService.updateGrnInvoice(id, req.body, req.file);

        return res.status(200).json(
            new ApiResponse("GRN / Invoice updated successfully", grnInvoice)
        );
    });

    getNextCode = asyncHandler(async (req: Request, res: Response) => {
        const nextCode = await grnInvoiceService.getNextGrnNumber();

        return res.status(200).json(
            new ApiResponse("Next GRN number fetched successfully", nextCode)
        );
    });

    delete = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;

        await grnInvoiceService.deleteGrnInvoice(id);

        return res.status(200).json(
            new ApiResponse("GRN / Invoice deleted successfully")
        );
    });
}

export default new GrnInvoiceController();
