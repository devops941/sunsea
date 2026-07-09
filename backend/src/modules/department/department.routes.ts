import { Router } from "express";

import {
  createDepartment,
  deleteDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
} from "./department.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
  createDepartmentSchema,
  departmentIdSchema,
} from "./department.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("departments.create"),
  validateMiddleware(
    createDepartmentSchema
  ),
  createDepartment
);

router.get(
  "/",
  authMiddleware,
  requirePermission("departments.view"),
  getAllDepartments
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("departments.view"),
  validateMiddleware(
    departmentIdSchema
  ),
  getDepartmentById
);

router.patch(
  "/:id",
  authMiddleware,
  requirePermission("departments.edit"),
  validateMiddleware(
    departmentIdSchema
  ),
  updateDepartment
);

/**
 * Delete Employee
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("departments.delete"),
  validateMiddleware(departmentIdSchema),
  deleteDepartment
);


export default router;