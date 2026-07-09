import { Router } from "express";

import categoryController from "./category.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";

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
  categoryController.findById
);

/**
 * Update Category
 */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("categories.edit"),
  categoryController.update
);

/**
 * Delete Category
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("categories.delete"),
  categoryController.delete
);

export default router;