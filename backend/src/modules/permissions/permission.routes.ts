import { Router } from "express";

import permissionController from "./permission.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
  createPermissionSchema,
  updatePermissionSchema,
} from "./permission.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("permissions.create"),
  validateMiddleware(
    createPermissionSchema
  ),
  permissionController.create
);

router.get(
  "/",
  authMiddleware,
  requirePermission("permissions.view"),
  permissionController.findAll
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("permissions.view"),
  permissionController.findById
);

router.patch(
  "/:id",
  authMiddleware,
  requirePermission("permissions.edit"),
  validateMiddleware(
    updatePermissionSchema
  ),
  permissionController.update
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("permissions.delete"),
  permissionController.delete
);

export default router;