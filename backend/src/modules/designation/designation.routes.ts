import { Router } from "express";

import {
  createDesignation,
  getAllDesignations,
  getDesignationById,
  updateDesignation,
  deleteDesignation,
} from "./designation.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
  createDesignationSchema,
  designationIdSchema,
} from "./designation.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("designations.create"),
  validateMiddleware(
    createDesignationSchema
  ),
  createDesignation
);

router.get(
  "/",
  authMiddleware,
  requirePermission("designations.view"),
  getAllDesignations
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("designations.view"),
  validateMiddleware(
    designationIdSchema
  ),
  getDesignationById
);

router.patch(
  "/:id",
  authMiddleware,
  requirePermission("designations.edit"),
  validateMiddleware(
    designationIdSchema
  ),
  updateDesignation
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("designations.delete"),
  validateMiddleware(
    designationIdSchema
  ),
  deleteDesignation
);

export default router;