import { Request, Response } from "express";
import grnInvoiceService from "./grn-invoice.service";
import { prisma } from "../../config/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { getIO } from "../../socket/socket";

import { voucherPostingService } from "../accounts/voucherPosting.service";

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

        // Auto-post purchase and payment vouchers immediately on creation
        try {
            await voucherPostingService.postPurchaseVoucher(grnInvoice.id);
        } catch (err) {
            console.error("[GRN Controller] Voucher posting failed:", err);
        }

        getIO().emit("grnInvoice:created", grnInvoice);
        try {
            getIO().emit("voucher:created", { source: "grnInvoice" });
            getIO().emit("payment:created", { source: "grnInvoice" });
            getIO().emit("accountLedger:updated", { source: "grnInvoice" });
        } catch (e) {}

        return res.status(201).json(
            new ApiResponse("GRN / Invoice created successfully", grnInvoice)
        );
    });

    private parseSortBy(value: unknown): "supplier" | "supplierName" | "invoiceNo" | "grnNumber" | "invoiceDate" | "grnDate" | "netAmount" | "createdAt" | undefined {
        if (!value || typeof value !== "string") return undefined;
        const trimmed = value.trim();
        const validFields = ["supplier", "supplierName", "invoiceNo", "grnNumber", "invoiceDate", "grnDate", "netAmount", "createdAt"];
        const found = validFields.find((f) => f.toLowerCase() === trimmed.toLowerCase());
        return found as any;
    }

    private parseSortOrder(value: unknown): "asc" | "desc" | undefined {
        if (!value || typeof value !== "string") return undefined;
        const v = value.toLowerCase().trim();
        return v === "asc" || v === "desc" ? (v as any) : undefined;
    }

    findAll = asyncHandler(async (req: Request, res: Response) => {
        const { page, pageSize, search, supplierId, storeId } = req.query;
        const sortBy = this.parseSortBy(req.query.sortBy);
        const sortOrder = this.parseSortOrder(req.query.sortOrder);

        const result = await grnInvoiceService.getAllGrnInvoices({
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
            search: search as string,
            supplierId: supplierId ? Number(supplierId) : undefined,
            storeId: storeId as string,
            sortBy,
            sortOrder,
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
        const userId = req.user?.userId;

        const grnInvoice = await grnInvoiceService.updateGrnInvoice(id, req.body, req.file, userId);

        // Auto-post purchase and payment vouchers immediately on update
        try {
            await voucherPostingService.postPurchaseVoucher(grnInvoice.id);
        } catch (err) {
            console.error("[GRN Controller] Voucher posting failed:", err);
        }

        getIO().emit("grnInvoice:updated", grnInvoice);
        try {
            getIO().emit("voucher:updated", { source: "grnInvoice" });
            getIO().emit("payment:updated", { source: "grnInvoice" });
            getIO().emit("accountLedger:updated", { source: "grnInvoice" });
        } catch (e) {}

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
        const userId = req.user?.userId;

        await grnInvoiceService.deleteGrnInvoice(id, userId);

        getIO().emit("grnInvoice:deleted", { id });

        return res.status(200).json(
            new ApiResponse("GRN / Invoice deleted successfully")
        );
    });
}

export default new GrnInvoiceController();
