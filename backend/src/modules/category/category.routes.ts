import { Router } from "express";

import categoryController from "./category.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
} from "./category.validation";

const router = Router();

/**
 * Get Next Category ID
 */
router.get(
  "/next-id",
  authMiddleware,
  categoryController.getNextId
);

/**
 * Create Category
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("categories.create"),
  validateMiddleware(createCategorySchema), // CAT-004 fix: added validation middleware
  categoryController.create
);

/**
 * Get All Categories
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("categories.view"),
  categoryController.findAll
);

/**
 * Get Category By Id
 */
router.get(
  "/:id",
  authMiddleware,
  requirePermission("categories.view"),
  validateMiddleware(categoryIdSchema), // CAT-004 fix: added validation middleware
  categoryController.findById
);

/**
 * Update Category
 */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("categories.edit"),
  validateMiddleware(updateCategorySchema), // CAT-004 fix: added validation middleware
  categoryController.update
);

/**
 * Delete Category
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("categories.delete"),
  validateMiddleware(categoryIdSchema), // CAT-004 fix: added validation middleware
  categoryController.delete
);

export default router;