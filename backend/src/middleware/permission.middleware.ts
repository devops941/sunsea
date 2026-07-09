import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Ensures the authenticated user has the required permission.
 */
export const requireSuperAdmin = () => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    const user = req.user;

    if (!user) {
      return next(
        new ApiError(401, "Unauthorized")
      );
    }

    if (!user.isSuperAdmin) {
      return next(
        new ApiError(
          403,
          "Access Denied: Super Admin only"
        )
      );
    }

    next();
  };
};

export const requirePermission = (permission: string) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    const user = req.user;

    // User must be authenticated
    if (!user) {
      return next(
        new ApiError(401, "Unauthorized")
      );
    }

    // Bypass for Super Admin and Admin role
    if (user.isSuperAdmin || user.roleId === "ROLE_ADMIN") {
      return next();
    }

    // Validate required permission
    if (
      !user.permissions.includes(
        permission
      )
    ) {
      return next(
        new ApiError(
          403,
          "Access Denied"
        )
      );
    }

    next();
  };
};

/**
 * Grants access when the user has at least one
 * of the provided permissions.
 */
export const requireAnyPermission = (
  ...permissions: string[]
) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    const user = req.user;

    if (!user) {
      return next(
        new ApiError(401, "Unauthorized")
      );
    }

    // Bypass for Super Admin and Admin role
    if (user.isSuperAdmin || user.roleId === "ROLE_ADMIN") {
      return next();
    }

    const hasPermission =
      permissions.some((permission) =>
        user.permissions.includes(
          permission
        )
      );

    if (!hasPermission) {
      return next(
        new ApiError(
          403,
          "Access Denied"
        )
      );
    }

    next();
  };
};

/**
 * Grants access only when the user has all
 * of the provided permissions.
 */
export const requireAllPermissions = (
  ...permissions: string[]
) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    const user = req.user;

    if (!user) {
      return next(
        new ApiError(401, "Unauthorized")
      );
    }

    // Bypass for Super Admin and Admin role
    if (user.isSuperAdmin || user.roleId === "ROLE_ADMIN") {
      return next();
    }

    const hasAllPermissions =
      permissions.every((permission) =>
        user.permissions.includes(
          permission
        )
      );

    if (!hasAllPermissions) {
      return next(
        new ApiError(
          403,
          "Access Denied"
        )
      );
    }

    next();
  };
};