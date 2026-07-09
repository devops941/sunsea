import { Router } from "express";

import colorController from "./color.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
  createColorSchema,
  updateColorSchema,
  colorIdSchema,
} from "./color.validation";

const router = Router();

/**
 * Get Next Color ID
 */
router.get(
  "/next-id",
  authMiddleware,
  colorController.getNextId
);

/**
 * Create Color
 * Access: Admin Only
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("colors.create"),
  validateMiddleware(
    createColorSchema
  ),
  colorController.create
);

/**
 * Get All Colors
 * Access: Authenticated Users
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("colors.view"),
  colorController.findAll
);

/**
 * Get Color By Id
 * Access: Authenticated Users
 */
router.get(
  "/:id",
  authMiddleware,
  requirePermission("colors.view"),
  validateMiddleware(
    colorIdSchema
  ),
  colorController.findById
);

/**
 * Update Color
 * Access: Admin Only
 */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("colors.edit"),
  validateMiddleware(
    updateColorSchema
  ),
  colorController.update
);

/**
 * Delete Color
 * Access: Admin Only
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("colors.delete"),
  validateMiddleware(
    colorIdSchema
  ),
  colorController.delete
);

export default router;