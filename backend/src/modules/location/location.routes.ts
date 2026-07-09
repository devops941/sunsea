import { Router } from "express";
import locationController from "./location.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createLocationSchema,
  updateLocationSchema,
  locationIdSchema,
} from "./location.validation";

const router = Router();

/**
 * Create Location
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("locations.create"),
  validateMiddleware(createLocationSchema),
  locationController.create
);

/**
 * Get All Locations
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("locations.view"),
  locationController.findAll
);

/**
 * Get Next Location ID
 */
router.get(
  "/next-id",
  authMiddleware,
  requirePermission("locations.view"),
  locationController.getNextId
);

/**
 * Get Location By ID
 */
router.get(
  "/:locationId",
  authMiddleware,
  requirePermission("locations.view"),
  validateMiddleware(locationIdSchema),
  locationController.findById
);

/**
 * Update Location
 */
router.put(
  "/:locationId",
  authMiddleware,
  requirePermission("locations.edit"),
  validateMiddleware(updateLocationSchema),
  locationController.update
);

/**
 * Delete Location
 */
router.delete(
  "/:locationId",
  authMiddleware,
  requirePermission("locations.delete"),
  validateMiddleware(locationIdSchema),
  locationController.delete
);

export default router;
