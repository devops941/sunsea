import { Router } from "express";

import subCategoryController from "./sub-category.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
  createSubCategorySchema,
  updateSubCategorySchema,
  subCategoryIdSchema,
} from "./sub-category.validation";

const router = Router();

/**
 * Get Next Sub Category ID
 */
router.get(
  "/next-id",
  authMiddleware,
  subCategoryController.getNextId
);

/**
 * Create Sub Category
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("sub-categories.create"),
  validateMiddleware(
    createSubCategorySchema
  ),
  subCategoryController.create
);

/**
 * Get All Sub Categories
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("sub-categories.view"),
  subCategoryController.findAll
);

/**
 * Get Sub Category By Id
 */
router.get(
  "/:id",
  authMiddleware,
  requirePermission("sub-categories.view"),
  validateMiddleware(
    subCategoryIdSchema
  ),
  subCategoryController.findById
);

/**
 * Update Sub Category
 */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("sub-categories.edit"),
  validateMiddleware(
    updateSubCategorySchema
  ),
  subCategoryController.update
);

/**
 * Delete Sub Category
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("sub-categories.delete"),
  validateMiddleware(
    subCategoryIdSchema
  ),
  subCategoryController.delete
);

export default router;