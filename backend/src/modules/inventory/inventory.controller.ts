  import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
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
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const parts = getISTDateParts(yesterday);
      targetDate = new Date(Date.UTC(parts.year, parts.month, parts.day));
    }

    const now = new Date();
    const nowParts = getISTDateParts(now);
    const todayISTStart = new Date(Date.UTC(nowParts.year, nowParts.month, nowParts.day));

    const isFuture = targetDate.getTime() > todayISTStart.getTime();
    const isToday = targetDate.getTime() === todayISTStart.getTime();

    const setting = await prisma.systemSetting.findFirst({
      where: { key: "EOD_CUTOFF_TIME" },
    });
    const cutoffTime = setting?.value || "23:59";
    const [cutoffHh, cutoffMm] = cutoffTime.split(":").map(Number);
    const isPastCutoff = nowParts.hours > cutoffHh || (nowParts.hours === cutoffHh && nowParts.minutes >= cutoffMm);

    if (isFuture) {
      return res.status(200).json({
        success: true,
        asOf: targetDate,
        data: [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: 0,
        },
      });
    }

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
        totalPages: Math.ceil(result.total / Number(limit)),
      },
    });
  });

  /**
   * POST /api/inventory/eod-stock/run-now
   * Manual trigger endpoint to immediately execute the EOD stock snapshot.
   * Accepts optional ?date=YYYY-MM-DD to re-run for a specific past date.
   */
  runNow = asyncHandler(async (req: Request, res: Response) => {
    const { date } = req.query;
    const dateStr = date && typeof date === "string" ? date.split("T")[0] : undefined;
    await runEodStockSnapshot(dateStr);
    return res.status(200).json({
      success: true,
      message: `EOD stock snapshot executed successfully${dateStr ? ` for ${dateStr}` : ""}.`,
    });
  });
}

export default new InventoryController();
