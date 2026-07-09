import { Router } from "express";
import rawMaterialController from "./raw-material.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createRawMaterialSchema,
  updateRawMaterialSchema,
  rawMaterialIdSchema,
} from "./raw-material.validation";

const router = Router();

/**
 * Create Raw Material
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("raw_materials.create"),
  validateMiddleware(createRawMaterialSchema),
  rawMaterialController.create
);

/**
 * Get All Raw Materials
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("raw_materials.view"),
  rawMaterialController.findAll
);

/**
 * Get Next Raw Material ID
 */
router.get(
  "/next-id",
  authMiddleware,
  requirePermission("raw_materials.view"),
  rawMaterialController.getNextId
);

/**
 * Get Raw Material By ID
 */
router.get(
  "/:rawMaterialId",
  authMiddleware,
  requirePermission("raw_materials.view"),
  validateMiddleware(rawMaterialIdSchema),
  rawMaterialController.findById
);

/**
 * Update Raw Material
 */
router.put(
  "/:rawMaterialId",
  authMiddleware,
  requirePermission("raw_materials.edit"),
  validateMiddleware(updateRawMaterialSchema),
  rawMaterialController.update
);

/**
 * Delete Raw Material
 */
router.delete(
  "/:rawMaterialId",
  authMiddleware,
  requirePermission("raw_materials.delete"),
  validateMiddleware(rawMaterialIdSchema),
  rawMaterialController.delete
);

export default router;
