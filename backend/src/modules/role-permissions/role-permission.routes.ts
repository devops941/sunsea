import { Router } from "express";

import {
  assignPermissions,
  getRolePermissions,
  removePermission,
} from "./role-permission.controller";

import { authMiddleware }
  from "../../middleware/auth.middleware";

import { requirePermission }
  from "../../middleware/permission.middleware";

import { validateMiddleware }
  from "../../middleware/validate.middleware";

import {
  assignPermissionsSchema,
  removePermissionSchema,
} from "./role-permission.validation";

const router = Router();

router.post(
  "/assign",
  authMiddleware,
  requirePermission("role-permissions.edit"),
  validateMiddleware(
    assignPermissionsSchema
  ),
  assignPermissions
);

router.get(
  "/role/:roleId",
  authMiddleware,
  requirePermission("role-permissions.view"),
  getRolePermissions
);

router.delete(
  "/remove",
  authMiddleware,
  requirePermission("role-permissions.edit"),
  validateMiddleware(
    removePermissionSchema
  ),
  removePermission
);

export default router;