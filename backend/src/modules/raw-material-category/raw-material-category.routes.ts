import { Router } from "express";
import rawMaterialCategoryController from "./raw-material-category.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createRawMaterialCategorySchema,
  updateRawMaterialCategorySchema,
  rawMaterialCategoryIdSchema,
} from "./raw-material-category.validation";

const router = Router();

/**
 * Create Raw Material Category
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("raw_material_categories.create"),
  validateMiddleware(createRawMaterialCategorySchema),
  rawMaterialCategoryController.create
);

/**
 * Get All Raw Material Categories
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("raw_material_categories.view"),
  rawMaterialCategoryController.findAll
);

/**
 * Get Next Category Code
 */
router.get(
  "/next-id",
  authMiddleware,
  requirePermission("raw_material_categories.view"),
  rawMaterialCategoryController.getNextCode
);

/**
 * Get Raw Material Category By ID
 */
router.get(
  "/:id",
  authMiddleware,
  requirePermission("raw_material_categories.view"),
  validateMiddleware(rawMaterialCategoryIdSchema),
  rawMaterialCategoryController.findById
);

/**
 * Update Raw Material Category
 */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("raw_material_categories.edit"),
  validateMiddleware(updateRawMaterialCategorySchema),
  rawMaterialCategoryController.update
);

/**
 * Delete Raw Material Category
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("raw_material_categories.delete"),
  validateMiddleware(rawMaterialCategoryIdSchema),
  rawMaterialCategoryController.delete
);

export default router;
