import { Router } from "express";

import {
  register,
  login,
  logout,
  logoutAllSessions,
  changePassword,
  requestPasswordReset,
  resetPassword,
  getProfile,
  getActiveSessions
} from "./auth.controller";

import { validateMiddleware } from "../../middleware/validate.middleware";

import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  passwordResetRequestSchema,
  passwordResetSchema
} from "./auth.validation";

import { authMiddleware } from "../../middleware/auth.middleware";
import { roleMiddleware } from "../../middleware/role.middleware";

const router = Router();

// ============================================================
// PUBLIC ROUTES
// ============================================================

router.post("/login", validateMiddleware(loginSchema), login);

router.post("/password-reset-request",
  validateMiddleware(passwordResetRequestSchema), 
  requestPasswordReset
);

router.post("/password-reset",
  validateMiddleware(passwordResetSchema), 
  resetPassword
);

// ============================================================
// PROTECTED ROUTES
// ============================================================

router.post("/register",
  authMiddleware,
  roleMiddleware("ROLE_ADMIN"),
  validateMiddleware(registerSchema),
  register
);

router.post("/logout", authMiddleware, logout);

router.post("/logout-all-sessions", authMiddleware, logoutAllSessions);

router.get("/sessions", authMiddleware, getActiveSessions);

router.post("/change-password",
  authMiddleware, 
  validateMiddleware(changePasswordSchema), 
  changePassword
);

router.get("/me", authMiddleware, getProfile);

export default router;