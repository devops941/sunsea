import { Router } from "express";
import rawMaterialStockController from "./raw-material-stock.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createRawMaterialStockSchema,
  updateRawMaterialStockSchema,
  rawMaterialStockIdSchema,
} from "./raw-material-stock.validation";

const router = Router();

/**
 * Create Raw Material Stock
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("raw_material_stocks.create"),
  validateMiddleware(createRawMaterialStockSchema),
  rawMaterialStockController.create
);

/**
 * Get All Raw Material Stocks
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("raw_material_stocks.view"),
  rawMaterialStockController.findAll
);

/**
 * Get Raw Material Stock By ID
 */
router.get(
  "/:id",
  authMiddleware,
  requirePermission("raw_material_stocks.view"),
  validateMiddleware(rawMaterialStockIdSchema),
  rawMaterialStockController.findById
);

/**
 * Update Raw Material Stock
 */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("raw_material_stocks.edit"),
  validateMiddleware(updateRawMaterialStockSchema),
  rawMaterialStockController.update
);

/**
 * Delete Raw Material Stock
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("raw_material_stocks.delete"),
  validateMiddleware(rawMaterialStockIdSchema),
  rawMaterialStockController.delete
);

export default router;
