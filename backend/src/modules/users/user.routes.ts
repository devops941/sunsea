import { Router } from "express";

import {
  createUser,
  getProfile,
  updateProfile,
  getAllUsers,
  getUserById,
  updateUserStatus
} from "./user.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";

const router = Router();

/*
|--------------------------------------------------------------------------
| Profile Routes
|--------------------------------------------------------------------------
*/

router.get(
  "/profile",
  authMiddleware,
  getProfile
);

router.patch(
  "/profile",
  authMiddleware,
  updateProfile
);

/*
|--------------------------------------------------------------------------
| User Management Routes
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  authMiddleware,
  requirePermission("users.create"),
  createUser
);

router.get(
  "/",
  authMiddleware,
  requirePermission("users.view"),
  getAllUsers
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("users.view"),
  getUserById
);

router.patch(
  "/:id/status",
  authMiddleware,
  requirePermission("users.edit"),
  updateUserStatus
);

export default router;