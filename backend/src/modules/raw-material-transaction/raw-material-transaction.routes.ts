import { Router } from "express";
import rawMaterialTransactionController from "./raw-material-transaction.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createRawMaterialTransactionSchema,
  updateRawMaterialTransactionSchema,
  rawMaterialTransactionIdSchema,
} from "./raw-material-transaction.validation";

const router = Router();

/**
 * Create Raw Material Transaction
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("raw_material_transactions.create"),
  validateMiddleware(createRawMaterialTransactionSchema),
  rawMaterialTransactionController.create
);

/**
 * Get All Raw Material Transactions
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("raw_material_transactions.view"),
  rawMaterialTransactionController.findAll
);

/**
 * Get Raw Material Transaction By ID
 */
router.get(
  "/:rmTxnId",
  authMiddleware,
  requirePermission("raw_material_transactions.view"),
  validateMiddleware(rawMaterialTransactionIdSchema),
  rawMaterialTransactionController.findById
);

/**
 * Update Raw Material Transaction
 */
router.put(
  "/:rmTxnId",
  authMiddleware,
  requirePermission("raw_material_transactions.edit"),
  validateMiddleware(updateRawMaterialTransactionSchema),
  rawMaterialTransactionController.update
);

/**
 * Delete Raw Material Transaction
 */
router.delete(
  "/:rmTxnId",
  authMiddleware,
  requirePermission("raw_material_transactions.delete"),
  validateMiddleware(rawMaterialTransactionIdSchema),
  rawMaterialTransactionController.delete
);

export default router;
