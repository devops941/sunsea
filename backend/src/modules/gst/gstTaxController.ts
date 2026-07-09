import { Request, Response } from "express";
import gstTaxService from "./gstTaxService";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class GstTaxController {
    create = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.userId;
        const gstTax = await gstTaxService.create(req.body, userId);

        return res.status(201).json(
            new ApiResponse("GST Tax created successfully", gstTax)
        );
    });

    findAll = asyncHandler(async (req: Request, res: Response) => {
        const gstTaxes = await gstTaxService.findAll(req.query as any);

        return res.status(200).json(
            new ApiResponse("GST Taxes fetched successfully", gstTaxes)
        );
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

        return res.status(200).json(
            new ApiResponse("GST Tax updated successfully", gstTax)
        );
    });

    delete = asyncHandler(async (req: Request, res: Response) => {
        const { gstTaxId } = req.params;
        await gstTaxService.delete(gstTaxId as string);

        return res.status(200).json(
            new ApiResponse("GST Tax deleted successfully")
        );
    });
}

export default new GstTaxController();