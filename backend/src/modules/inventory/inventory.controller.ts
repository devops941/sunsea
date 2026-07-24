import { Request, Response } from "express";
import inventoryService from "./inventory.service";
import { runEodStockSnapshot } from "./jobs/eodStockSnapshot.job";
import { asyncHandler } from "../../utils/asyncHandler";
import { getISTDateParts } from "../../utils/dateUtils";

class InventoryController {
  /**
   * GET /api/inventory/eod-stock
   * Fetch paginated daily EOD stock snapshots by date, category, store, and search term
   */
  getEodStock = asyncHandler(async (req: Request, res: Response) => {
    const { date, category, storeId, search, page = 1, limit = 20 } = req.query;

    let targetDate: Date;
    if (date && typeof date === "string") {
      const [year, month, day] = date.split("T")[0].split("-").map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, day));
    } else {
      const now = new Date();
      const parts = getISTDateParts(now);
      targetDate = new Date(Date.UTC(parts.year, parts.month, parts.day));
    }

    let result = await inventoryService.getEodStock({
      date: targetDate,
      category: category as string || undefined,
      storeId: storeId as string || undefined,
      search: search as string || undefined,
      page: Number(page),
      limit: Number(limit),
    });

    // If no snapshots exist for this date yet, auto-trigger a snapshot run and re-fetch
    if (result.total === 0 && (!search && !category && !storeId)) {
      try {
        const dateStr = date ? (date as string) : targetDate.toISOString().split("T")[0];
        await runEodStockSnapshot(dateStr);
        result = await inventoryService.getEodStock({
          date: targetDate,
          category: category as string || undefined,
          storeId: storeId as string || undefined,
          search: search as string || undefined,
          page: Number(page),
          limit: Number(limit),
        });
      } catch (eodErr) {
        console.error("Auto EOD snapshot run error:", eodErr);
      }
    }

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
