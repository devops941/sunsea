import { Router } from "express";
import machineController from "./machine.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createMachineSchema,
  updateMachineSchema,
  machineIdSchema,
} from "./machine.validation";

const router = Router();

/**
 * Get Next Machine ID
 */
router.get(
  "/next-id",
  authMiddleware,
  requirePermission("machines.view"),
  machineController.getNextId
);

/**
 * Create Machine
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("machines.create"),
  validateMiddleware(createMachineSchema),
  machineController.create
);

/**
 * Get All Machines
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("machines.view"),
  machineController.findAll
);

/**
 * Get Machine By ID
 */
router.get(
  "/:machineId",
  authMiddleware,
  requirePermission("machines.view"),
  validateMiddleware(machineIdSchema),
  machineController.findById
);

/**
 * Update Machine
 */
router.put(
  "/:machineId",
  authMiddleware,
  requirePermission("machines.edit"),
  validateMiddleware(updateMachineSchema),
  machineController.update
);

/**
 * Delete Machine
 */
router.delete(
  "/:machineId",
  authMiddleware,
  requirePermission("machines.delete"),
  validateMiddleware(machineIdSchema),
  machineController.delete
);

export default router;
