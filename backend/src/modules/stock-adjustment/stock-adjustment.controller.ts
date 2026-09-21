import { Request, Response } from "express";
import { StockAdjustmentService } from "./stock-adjustment.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { getIO } from "../../socket/socket";

export class StockAdjustmentController {
  static createStockAdjustment = asyncHandler(async (req: Request, res: Response) => {
    const data = req.body;
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const adjustment = await StockAdjustmentService.createStockAdjustment(data, userId);
    getIO().emit("stockAdjustment:created", adjustment);
    res.status(201).json({
      success: true,
      message: "Stock Adjustment created successfully",
      data: adjustment,
    });
  });

  static getStockAdjustments = asyncHandler(async (req: Request, res: Response) => {
    const result = await StockAdjustmentService.getStockAdjustments(req.query);
    res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  });

  static getStockAdjustmentById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const adjustment = await StockAdjustmentService.getStockAdjustmentById(id);
    res.json({
      success: true,
      data: adjustment,
    });
  });

  static updateStockAdjustment = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const data = req.body;
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const adjustment = await StockAdjustmentService.updateStockAdjustment(id, data, userId);
    getIO().emit("stockAdjustment:updated", adjustment);
    res.json({
      success: true,
      message: "Stock Adjustment updated successfully",
      data: adjustment,
    });
  });

  static approveStockAdjustment = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { status, reason } = req.body;
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const adjustment = await StockAdjustmentService.approveStockAdjustment(id, status, reason, userId);
    getIO().emit("stockAdjustment:updated", adjustment);
    res.json({
      success: true,
      message: `Stock Adjustment status updated to ${status}`,
      data: adjustment,
    });
  });

  static deleteStockAdjustment = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user?.userId;
    await StockAdjustmentService.deleteStockAdjustment(id, userId);
    getIO().emit("stockAdjustment:deleted", { id });
    res.json({
      success: true,
      message: "Stock Adjustment deleted successfully",
    });
  });

  static getProductionOrdersForIssue = asyncHandler(async (_req: Request, res: Response) => {
    const orders = await StockAdjustmentService.getProductionOrdersForIssue();
    res.json({
      success: true,
      data: orders,
    });
  });

  static getNextAdjustmentNumber = asyncHandler(async (_req: Request, res: Response) => {
    const nextNumber = await StockAdjustmentService.getNextAdjustmentNumber();
    res.json({
      success: true,
      data: nextNumber,
    });
  });
}
