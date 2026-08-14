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

router.get("/next-id", authMiddleware, categoryController.getNextId);

router.post(
  "/",
  authMiddleware,
  requirePermission("categories.create"),
  validateMiddleware(createCategorySchema),
  categoryController.create
);

router.get(
  "/",
  authMiddleware,
  requirePermission("categories.view"),
  categoryController.findAll
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("categories.view"),
  validateMiddleware(categoryIdSchema),
  categoryController.findById
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission("categories.edit"),
  validateMiddleware(updateCategorySchema),
  categoryController.update
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("categories.delete"),
  validateMiddleware(categoryIdSchema),
  categoryController.delete
);

export default router;