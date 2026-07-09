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

router.post(
  "/",
  requirePermission("raw_material_stocks.create"),
  validateMiddleware(createStockAdjustmentSchema),
  StockAdjustmentController.createStockAdjustment
);

router.get(
  "/",
  requirePermission("raw_material_stocks.view"),
  StockAdjustmentController.getStockAdjustments
);

router.get(
  "/:id",
  requirePermission("raw_material_stocks.view"),
  validateMiddleware(stockAdjustmentIdSchema),
  StockAdjustmentController.getStockAdjustmentById
);

router.put(
  "/:id",
  requirePermission("raw_material_stocks.edit"),
  validateMiddleware(updateStockAdjustmentSchema),
  StockAdjustmentController.updateStockAdjustment
);

router.put(
  "/:id/approve",
  requirePermission("raw_material_stocks.edit"),
  validateMiddleware(updateStockAdjustmentStatusSchema),
  StockAdjustmentController.approveStockAdjustment
);

router.delete(
  "/:id",
  requirePermission("raw_material_stocks.delete"),
  validateMiddleware(stockAdjustmentIdSchema),
  StockAdjustmentController.deleteStockAdjustment
);

export default router;
