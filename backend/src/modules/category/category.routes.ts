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
 * Get Next Category Code
 * Query: ?type=PRODUCT|RAW_MATERIAL|WASTAGE
 */
router.get(
  "/next-code",
  authMiddleware,
  requirePermission("categories.view"),
  categoryController.getNextCode
);

/**
 * Get All Categories
 * Query: ?type=PRODUCT|RAW_MATERIAL|WASTAGE&search=&isActive=&page=&limit=
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("categories.view"),
  categoryController.findAll
);

/**
 * Create Category
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("categories.create"),
  validateMiddleware(createCategorySchema),
  categoryController.create
);

/**
 * Get Category By ID
 */
router.get(
  "/:id",
  authMiddleware,
  requirePermission("categories.view"),
  validateMiddleware(categoryIdSchema),
  categoryController.findById
);

/**
 * Update Category
 */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("categories.edit"),
  validateMiddleware(updateCategorySchema),
  categoryController.update
);

/**
 * Delete Category
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("categories.delete"),
  validateMiddleware(categoryIdSchema),
  categoryController.delete
);

export default router;
