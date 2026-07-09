import { Router } from "express";
import finishedGoodsTransactionController from "./finished-goods-transaction.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createFinishedGoodsTransactionSchema,
  updateFinishedGoodsTransactionSchema,
  finishedGoodsTransactionIdSchema,
} from "./finished-goods-transaction.validation";

const router = Router();

/**
 * Create Finished Goods Transaction
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("finished_goods_transactions.create"),
  validateMiddleware(createFinishedGoodsTransactionSchema),
  finishedGoodsTransactionController.create
);

/**
 * Get All Finished Goods Transactions
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("finished_goods_transactions.view"),
  finishedGoodsTransactionController.findAll
);

/**
 * Get Finished Goods Transaction By ID
 */
router.get(
  "/:fgTxnId",
  authMiddleware,
  requirePermission("finished_goods_transactions.view"),
  validateMiddleware(finishedGoodsTransactionIdSchema),
  finishedGoodsTransactionController.findById
);

/**
 * Update Finished Goods Transaction
 */
router.put(
  "/:fgTxnId",
  authMiddleware,
  requirePermission("finished_goods_transactions.edit"),
  validateMiddleware(updateFinishedGoodsTransactionSchema),
  finishedGoodsTransactionController.update
);

/**
 * Delete Finished Goods Transaction
 */
router.delete(
  "/:fgTxnId",
  authMiddleware,
  requirePermission("finished_goods_transactions.delete"),
  validateMiddleware(finishedGoodsTransactionIdSchema),
  finishedGoodsTransactionController.delete
);

export default router;
