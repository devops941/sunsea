import { Router } from "express";
import finishedGoodsStockController from "./finished-goods-stock.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createFinishedGoodsStockSchema,
  updateFinishedGoodsStockSchema,
  finishedGoodsStockIdSchema,
} from "./finished-goods-stock.validation";

const router = Router();

/**
 * Create Finished Goods Stock
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("finished_goods_stocks.create"),
  validateMiddleware(createFinishedGoodsStockSchema),
  finishedGoodsStockController.create
);

/**
 * Get All Finished Goods Stocks
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("finished_goods_stocks.view"),
  finishedGoodsStockController.findAll
);

/**
 * Get Finished Goods Stock By ID (Composite Keys)
 */
router.get(
  "/:storeId/:productItemId",
  authMiddleware,
  requirePermission("finished_goods_stocks.view"),
  validateMiddleware(finishedGoodsStockIdSchema),
  finishedGoodsStockController.findById
);

/**
 * Update Finished Goods Stock
 */
router.put(
  "/:storeId/:productItemId",
  authMiddleware,
  requirePermission("finished_goods_stocks.edit"),
  validateMiddleware(updateFinishedGoodsStockSchema),
  finishedGoodsStockController.update
);

/**
 * Delete Finished Goods Stock
 */
router.delete(
  "/:storeId/:productItemId",
  authMiddleware,
  requirePermission("finished_goods_stocks.delete"),
  validateMiddleware(finishedGoodsStockIdSchema),
  finishedGoodsStockController.delete
);

export default router;
