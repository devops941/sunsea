import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Returns true when the authenticated user is a Super Admin and
 * should bypass all permission checks.
 *
 * Two checks (either is sufficient):
 *  1. `isSuperAdmin` flag — set in JWT at login for Admin-table accounts.
 *  2. `userId` prefix `"admin_"` — authMiddleware already validated this
 *     against the Admin table, so it is safe to treat these as Super Admin.
 *     This covers tokens issued before isSuperAdmin was added to the payload.
 */
function checkSuperAdmin(req: Request): boolean {
  const user = req.user;
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  if (user.userId && user.userId.startsWith("admin_")) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// requireSuperAdmin — route accessible only to Super Admin
// ─────────────────────────────────────────────────────────────────────────────
export function requireSuperAdmin() {
  return function (req: Request, _res: Response, next: NextFunction) {
    if (!req.user) {
      return next(new ApiError(401, "Unauthorized"));
    }
    if (!checkSuperAdmin(req)) {
      return next(new ApiError(403, "Access Denied: Super Admin only"));
    }
    return next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// requirePermission — user must hold the exact permission key
// Example: requirePermission("users.view")
// ─────────────────────────────────────────────────────────────────────────────
export function requirePermission(permission: string) {
  return function (req: Request, _res: Response, next: NextFunction) {
    const user = req.user;

    if (!user) {
      return next(new ApiError(401, "Unauthorized"));
    }

    // Super Admins are never blocked
    if (checkSuperAdmin(req)) {
      return next();
    }

    if (!Array.isArray(user.permissions) || !user.permissions.includes(permission)) {
      return next(new ApiError(403, `Access Denied: "${permission}" permission required`));
    }

    return next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// requireAnyPermission — user needs at least ONE of the listed permissions
// Example: requireAnyPermission("reports.view", "sales-orders.view")
// ─────────────────────────────────────────────────────────────────────────────
export function requireAnyPermission(...permissions: string[]) {
  return function (req: Request, _res: Response, next: NextFunction) {
    const user = req.user;

    if (!user) {
      return next(new ApiError(401, "Unauthorized"));
    }

    if (checkSuperAdmin(req)) {
      return next();
    }

    const hasAny =
      Array.isArray(user.permissions) &&
      permissions.some((p) => user.permissions.includes(p));

    if (!hasAny) {
      return next(
        new ApiError(403, `Access Denied: one of [${permissions.join(", ")}] required`)
      );
    }

    return next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// requireAllPermissions — user must hold EVERY listed permission
// Example: requireAllPermissions("users.view", "users.edit")
// ─────────────────────────────────────────────────────────────────────────────
export function requireAllPermissions(...permissions: string[]) {
  return function (req: Request, _res: Response, next: NextFunction) {
    const user = req.user;

    if (!user) {
      return next(new ApiError(401, "Unauthorized"));
    }

    if (checkSuperAdmin(req)) {
      return next();
    }

    const hasAll =
      Array.isArray(user.permissions) &&
      permissions.every((p) => user.permissions.includes(p));

    if (!hasAll) {
      return next(
        new ApiError(403, `Access Denied: all of [${permissions.join(", ")}] required`)
      );
    }

    return next();
  };
}
