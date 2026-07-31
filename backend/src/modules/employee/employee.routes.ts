import { Router } from "express";

import employeeController from "./employee.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import { uploadEmployeePhoto } from "../../middleware/upload.middleware";

import { employeeIdSchema } from "./employee.validation";

const router = Router();

/**
 * Create Employee
 * Uses multipart/form-data for photo upload — validation done in controller.
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("employees.create"),
  uploadEmployeePhoto.single("photo"),
  employeeController.create
);

/**
 * Get All Employees
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("employees.view"),
  employeeController.findAll
);

/**
 * Get Next Employee Code
 */
router.get(
  "/next-code",
  authMiddleware,
  requirePermission("employees.view"),
  employeeController.getNextCode
);

/**
 * Get My Own Profile (logged-in user's linked employee record)
 * IMPORTANT: must be registered BEFORE "/:id" below, otherwise Express
 * matches "me" as the :id param and BigInt("me") throws.
 */
router.get(
  "/me",
  authMiddleware,
  employeeController.getMyProfile
);

/**
 * Get Employee By Id
 */
router.get(
  "/:id",
  authMiddleware,
  requirePermission("employees.view"),
  validateMiddleware(employeeIdSchema),
  employeeController.findById
);

/**
 * Update Employee
 * Uses multipart/form-data for photo upload — validation done in controller.
 */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("employees.edit"),
  uploadEmployeePhoto.single("photo"),
  employeeController.update
);

/**
 * Delete Employee
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("employees.delete"),
  validateMiddleware(employeeIdSchema),
  employeeController.delete
);

export default router;
