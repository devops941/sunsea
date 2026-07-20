import { Request, Response } from "express";
import inventoryService from "./inventory.service";
import { runEodStockSnapshot } from "./jobs/eodStockSnapshot.job";
import { asyncHandler } from "../../utils/asyncHandler";

class InventoryController {
  /**
   * GET /api/inventory/eod-stock
   * Fetch paginated daily EOD stock snapshots by date, category, store, and search term
   */
  getEodStock = asyncHandler(async (req: Request, res: Response) => {
    const { date, category, storeId, search, page = 1, limit = 20 } = req.query;
    
    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const result = await inventoryService.getEodStock({
      date: targetDate,
      category: category as string || undefined,
      storeId: storeId as string || undefined,
      search: search as string || undefined,
      page: Number(page),
      limit: Number(limit),
    });

    return res.status(200).json({
      success: true,
      asOf: targetDate,
      data: result.data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.total,
      },
    });
  });

  /**
   * POST /api/inventory/eod-stock/run-now
   * Manual trigger endpoint to immediately execute the EOD stock snapshot
   */
  runNow = asyncHandler(async (req: Request, res: Response) => {
    await runEodStockSnapshot();
    return res.status(200).json({
      success: true,
      message: "EOD stock snapshot executed successfully.",
    });
  });
}

export default new InventoryController();
