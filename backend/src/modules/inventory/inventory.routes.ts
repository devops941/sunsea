import { Router } from "express";
import inventoryController from "./inventory.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import { getEodStockSchema } from "./inventory.validation";

const router = Router();

/**
 * GET /api/inventory/eod-stock
 * Protected by authentication middleware and validated by Zod query schemas
 */
router.get(
  "/eod-stock",
  authMiddleware,
  validateMiddleware(getEodStockSchema),
  inventoryController.getEodStock
);

/**
 * POST /api/inventory/eod-stock/run-now
 * Manual EOD snapshot trigger
 */
router.post(
  "/eod-stock/run-now",
  authMiddleware,
  inventoryController.runNow
);

export default router;
