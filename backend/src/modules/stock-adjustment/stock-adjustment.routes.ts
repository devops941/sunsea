import { Router } from "express";
import { StockAdjustmentController } from "./stock-adjustment.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createStockAdjustmentSchema,
  updateStockAdjustmentSchema,
  updateStockAdjustmentStatusSchema,
  stockAdjustmentIdSchema,
} from "./stock-adjustment.validation";

const router = Router();

router.use(authMiddleware);

// Must be before /:id to avoid param conflict
router.get(
  "/production-orders",
  requirePermission("stock-adjustments.view"),
  StockAdjustmentController.getProductionOrdersForIssue
);

router.get(
  "/next-number",
  requirePermission("stock-adjustments.create"),
  StockAdjustmentController.getNextAdjustmentNumber
);

router.post(
  "/",
  requirePermission("stock-adjustments.create"),
  validateMiddleware(createStockAdjustmentSchema),
  StockAdjustmentController.createStockAdjustment
);

router.get(
  "/",
  requirePermission("stock-adjustments.view"),
  StockAdjustmentController.getStockAdjustments
);

router.get(
  "/:id",
  requirePermission("stock-adjustments.view"),
  validateMiddleware(stockAdjustmentIdSchema),
  StockAdjustmentController.getStockAdjustmentById
);

router.put(
  "/:id",
  requirePermission("stock-adjustments.edit"),
  validateMiddleware(updateStockAdjustmentSchema),
  StockAdjustmentController.updateStockAdjustment
);

router.put(
  "/:id/approve",
  requirePermission("stock-adjustments.edit"),
  validateMiddleware(updateStockAdjustmentStatusSchema),
  StockAdjustmentController.approveStockAdjustment
);

router.delete(
  "/:id",
  requirePermission("stock-adjustments.delete"),
  validateMiddleware(stockAdjustmentIdSchema),
  StockAdjustmentController.deleteStockAdjustment
);

export default router;
