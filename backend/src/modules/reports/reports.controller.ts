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
  getSalesOrderReport = asyncHandler(async (req: Request, res: Response) => {
    const {
      startDate, endDate, orderNo, customerId, status,
      salesPersonName, orderType, productionStatus,
      page, limit
    } = req.query;

    const report = await reportsService.getSalesOrderReport(
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined,
      orderNo ? String(orderNo) : undefined,
      customerId ? String(customerId) : undefined,
      status ? String(status) : undefined,
      salesPersonName ? String(salesPersonName) : undefined,
      orderType ? String(orderType) : undefined,
      productionStatus ? String(productionStatus) : undefined,
      page ? parseInt(String(page)) : 1,
      limit ? parseInt(String(limit)) : 10
    );

    return res.status(200).json(
      new ApiResponse("Sales order report fetched successfully", report)
    );
  });

  getPurchaseOrderReport = asyncHandler(async (req: Request, res: Response) => {
    const { 
      startDate, endDate, poNumber, supplierId, status, 
      page, limit 
    } = req.query;

    const report = await reportsService.getPurchaseOrderReport(
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined,
      poNumber ? String(poNumber) : undefined,
      supplierId ? parseInt(String(supplierId)) : undefined,
      status ? String(status) : undefined,
      page ? parseInt(String(page)) : 1,
      limit ? parseInt(String(limit)) : 10
    );

    return res.status(200).json(
      new ApiResponse("Purchase order report fetched successfully", report)
    );
  });
}

export default new ReportsController();
