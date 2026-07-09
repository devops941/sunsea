import { Router } from "express";

import {
  register,
  login,
  refreshToken,
  logout,
  logoutAllSessions,
  changePassword,
  requestPasswordReset,
  resetPassword,
  getProfile
} from "./auth.controller";

import { validateMiddleware } from "../../middleware/validate.middleware";

import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
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

router.post("/login",validateMiddleware(loginSchema), login
);

router.post("/refresh-token",
  validateMiddleware(refreshTokenSchema), refreshToken
);

router.post( "/password-reset-request",
 validateMiddleware(passwordResetRequestSchema), requestPasswordReset
);

router.post( "/password-reset",
  validateMiddleware(passwordResetSchema), resetPassword
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

router.post("/logout",
  authMiddleware, logout
);

router.post( "/logout-all-sessions",
 authMiddleware, logoutAllSessions
);

router.post("/change-password",
  authMiddleware, validateMiddleware(changePasswordSchema), changePassword
);

router.get("/me",
  authMiddleware,getProfile
);

export default router;