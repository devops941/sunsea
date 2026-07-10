import {
  Request,
  Response,
  NextFunction,
} from "express";
import jwt from "jsonwebtoken";

import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { JwtPayload } from "../types/auth.types";
import { prisma } from "../config/prisma";

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;

    if (
      authHeader &&
      authHeader.startsWith("Bearer ")
    ) {
      token = authHeader.split(" ")[1];
    }

    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(
        new ApiError(
          401,
          "Access token is required"
        )
      );
    }

    const decoded = jwt.verify(
      token,
      env.JWT_ACCESS_SECRET
    ) as JwtPayload;

    if (
      !decoded?.userId ||
      !Array.isArray(decoded?.permissions)
    ) {
      return next(
        new ApiError(
          401,
          "Invalid token payload"
        )
      );
    }

    const isAdmin = decoded.userId.startsWith("admin_");
    
    if (isAdmin) {
      const adminId = BigInt(decoded.userId.replace("admin_", ""));
      const admin = await prisma.admin.findUnique({
        where: { id: adminId },
        select: { status: true }
      });
      if (!admin || admin.status !== "active") {
        return next(new ApiError(401, "Admin account is suspended or inactive"));
      }
    } else {
      const user = await prisma.user.findUnique({
        where: { userId: decoded.userId },
        select: { status: true }
      });

      if (!user || user.status !== "active") {
        return next(new ApiError(401, "Account is suspended or inactive"));
      }
    }

    req.user = decoded;

    return next();
  } catch {
    return next(
      new ApiError(
        401,
        "Invalid or Expired Token"
      )
    );
  }
};