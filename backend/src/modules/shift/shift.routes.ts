import { Router } from "express";

import shiftController from "./shift.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
  createShiftSchema,
  updateShiftSchema,
  shiftIdSchema,
} from "./shift.validation";

const router = Router();

/**
 * Get Next Shift ID
 */
router.get(
  "/next-id",
  authMiddleware,
  requirePermission("shifts.view"),
  shiftController.getNextId
);

/**
 * Create Shift
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("shifts.create"),
  validateMiddleware(createShiftSchema),
  shiftController.create
);

/**
 * Get All Shifts
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("shifts.view"),
  shiftController.findAll
);

/**
 * Get Shift By Id
 */
router.get(
  "/:id",
  authMiddleware,
  requirePermission("shifts.view"),
  validateMiddleware(shiftIdSchema),
  shiftController.findById
);

/**
 * Update Shift
 */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("shifts.edit"),
  validateMiddleware(updateShiftSchema),
  shiftController.update
);

/**
 * Delete Shift
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("shifts.delete"),
  validateMiddleware(shiftIdSchema),
  shiftController.delete
);

export default router;
