import { Request, Response } from "express";
import gstTaxService from "./gstTaxService";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getIO } from "../../socket/socket";

class GstTaxController {
    create = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.userId;
        const gstTax = await gstTaxService.create(req.body, userId);

        getIO().emit("gstTax:created", gstTax);

        return res.status(201).json(
            new ApiResponse("GST Tax created successfully", gstTax)
        );
    });

    findAll = asyncHandler(async (req: Request, res: Response) => {
        const { data, total, page, pageSize } = await gstTaxService.findAll(req.query as any);

        return res.status(200).json({
            success: true,
            message: "GST Taxes fetched successfully",
            data,
            meta: {
                total,
                page,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    });

    findById = asyncHandler(async (req: Request, res: Response) => {
        const { gstTaxId } = req.params;
        const gstTax = await gstTaxService.findById(gstTaxId as string);

        return res.status(200).json(
            new ApiResponse("GST Tax fetched successfully", gstTax)
        );
    });

    update = asyncHandler(async (req: Request, res: Response) => {
        const { gstTaxId } = req.params;
        const gstTax = await gstTaxService.update(
            gstTaxId as string,
            req.body
        );

        getIO().emit("gstTax:updated", gstTax);

        return res.status(200).json(
            new ApiResponse("GST Tax updated successfully", gstTax)
        );
    });

    delete = asyncHandler(async (req: Request, res: Response) => {
        const { gstTaxId } = req.params;
        await gstTaxService.delete(gstTaxId as string);

        getIO().emit("gstTax:deleted", { id: gstTaxId });

        return res.status(200).json(
            new ApiResponse("GST Tax deleted successfully")
        );
    });
}

export default new GstTaxController();