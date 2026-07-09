import { Router } from "express";
import storeController from "./store.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createStoreSchema,
  updateStoreSchema,
  storeIdSchema,
} from "./store.validation";

const router = Router();

/**
 * Create Store
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("stores.create"),
  validateMiddleware(createStoreSchema),
  storeController.create
);

/**
 * Get All Stores
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("stores.view"),
  storeController.findAll
);

/**
 * Get Next Store ID
 */
router.get(
  "/next-id",
  authMiddleware,
  requirePermission("stores.view"),
  storeController.getNextId
);

/**
 * Get Store By ID
 */
router.get(
  "/:storeId",
  authMiddleware,
  requirePermission("stores.view"),
  validateMiddleware(storeIdSchema),
  storeController.findById
);

/**
 * Update Store
 */
router.put(
  "/:storeId",
  authMiddleware,
  requirePermission("stores.edit"),
  validateMiddleware(updateStoreSchema),
  storeController.update
);

/**
 * Delete Store
 */
router.delete(
  "/:storeId",
  authMiddleware,
  requirePermission("stores.delete"),
  validateMiddleware(storeIdSchema),
  storeController.delete
);

export default router;
