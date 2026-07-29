import { Request, Response } from "express";

import purchaseOrderService from "./purchase-order.service";
import { prisma } from "../../config/prisma";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

class PurchaseOrderController {

    create = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new ApiError(401, "Unauthorized: missing user context");
        }

        const company = await prisma.company.findFirst();
        if (!company) {
            throw new ApiError(500, "Internal Server Error: No company found in the system");
        }

        const po = await purchaseOrderService.createPurchaseOrder(req.body, {
            userId,
            companyId: company.id,
        });

        return res.status(201).json(
            new ApiResponse("Purchase Order created successfully", po)
        );
    });

    findAll = asyncHandler(async (req: Request, res: Response) => {
        const { page, pageSize, search, status, fromDate, toDate } = req.query;
        const result = await purchaseOrderService.getAllPurchaseOrders({
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
            search: search as string,
            status: status as string,
            fromDate: fromDate as string,
            toDate: toDate as string,
        });

        return res.status(200).json(
            new ApiResponse("Purchase Orders fetched successfully", result)
        );
    });

    findOne = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;

        const po = await purchaseOrderService.getPurchaseOrderById(id);

        return res.status(200).json(
            new ApiResponse("Purchase Order fetched successfully", po)
        );
    });

    update = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;

        const po = await purchaseOrderService.updatePurchaseOrder(id, req.body);

        return res.status(200).json(
            new ApiResponse("Purchase Order updated successfully", po)
        );
    });

    getNextCode = asyncHandler(async (req: Request, res: Response) => {
        const nextCode = await purchaseOrderService.getNextPONumber();

        return res.status(200).json(
            new ApiResponse("Next PO number fetched successfully", nextCode)
        );
    });

    delete = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;

        await purchaseOrderService.deletePurchaseOrder(id);

        return res.status(200).json(
            new ApiResponse("Purchase Order deleted successfully")
        );
    });
}

export default new PurchaseOrderController();