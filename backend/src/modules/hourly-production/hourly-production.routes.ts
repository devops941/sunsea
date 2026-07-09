import { Router } from "express";
import hourlyProductionController from "./hourly-production.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createHourlyProductionSchema,
  updateHourlyProductionSchema,
  hourlyProductionIdSchema,
} from "./hourly-production.validation";

const router = Router();

/**
 * Create Hourly Production
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("hourly_productions.create"),
  validateMiddleware(createHourlyProductionSchema),
  hourlyProductionController.create
);

/**
 * Get All Hourly Productions
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("hourly_productions.view"),
  hourlyProductionController.findAll
);

/**
 * Get Hourly Production By ID
 */
router.get(
  "/:hourlyProductionId",
  authMiddleware,
  requirePermission("hourly_productions.view"),
  validateMiddleware(hourlyProductionIdSchema),
  hourlyProductionController.findById
);

/**
 * Update Hourly Production
 */
router.put(
  "/:hourlyProductionId",
  authMiddleware,
  requirePermission("hourly_productions.edit"),
  validateMiddleware(updateHourlyProductionSchema),
  hourlyProductionController.update
);

/**
 * Delete Hourly Production
 */
router.delete(
  "/:hourlyProductionId",
  authMiddleware,
  requirePermission("hourly_productions.delete"),
  validateMiddleware(hourlyProductionIdSchema),
  hourlyProductionController.delete
);

export default router;
