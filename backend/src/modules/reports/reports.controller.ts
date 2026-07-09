import { Request, Response } from "express";
import reportsService from "./reports.service";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

class ReportsController {
  getMachineReport = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const report = await reportsService.getMachineReport(
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined
    );

    return res.status(200).json(
      new ApiResponse("Machine status and efficiency report fetched successfully", report)
    );
  });

  getWeeklyProgramReport = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const report = await reportsService.getWeeklyProgramReport(
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined
    );

    return res.status(200).json(
      new ApiResponse("Weekly program progress report fetched successfully", report)
    );
  });

  getProductionOrderReport = asyncHandler(async (req: Request, res: Response) => {
    const { productionOrderId } = req.params;
    const report = await reportsService.getProductionOrderReport(String(productionOrderId));

    return res.status(200).json(
      new ApiResponse("Production order detailed report fetched successfully", report)
    );
  });
}

export default new ReportsController();
