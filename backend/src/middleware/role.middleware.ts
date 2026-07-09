import {
  Request,
  Response,
  NextFunction
} from "express";

import { ApiError } from "../utils/ApiError";

/**
 * Restricts route access based on user roles.
 */
export const roleMiddleware =
  (...allowedRoles: string[]) =>
  (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {

    // User must be authenticated
    if (!req.user) {
      return next(
        new ApiError(
          401,
          "Unauthorized"
        )
      );
    }

    const userRole =
      req.user.roleId;

    // Verify user role is allowed to access the resource
    const isAllowed =
      allowedRoles.includes(
        userRole
      );

    if (!isAllowed) {
      return next(
        new ApiError(
          403,
          "Access Denied"
        )
      );
    }

    next();
  };