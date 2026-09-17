import { NextFunction, Request, Response } from "express";
import { ZodError, ZodIssue } from "zod";
import { Prisma } from "@prisma/client";

import { ApiError } from "../utils/ApiError";

export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ApiError) {
    // Routine 401 on /auth/me is the frontend probing whether its stored JWT
    // is still valid at boot. That's expected and not noteworthy — suppress
    // the log line so a normal fresh load with a stale token doesn't look
    // like the server is on fire.
    const isRoutineAuthProbe =
      err.statusCode === 401 &&
      typeof _req.originalUrl === "string" &&
      _req.originalUrl.includes("/auth/me");

    if (err.statusCode >= 500) {
      console.error("API ERROR DETECTED:", err);
    } else if (!isRoutineAuthProbe) {
      console.warn(`[API Warning] ${err.statusCode} - ${err.message}`);
    }
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: [] as unknown[]
    });
    return;
  }

  if (err instanceof ZodError) {
    console.warn(`[API Warning] 400 - Validation failed`);
    const issues: ZodIssue[] = err.issues;

    const errors = issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }));

    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    const raw = err.message || '';
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const detail = lines.length > 1 ? lines.slice(1).join(' ') : (lines[0] || 'One or more fields have an invalid value.');
    console.warn(`[Prisma Validation]`, raw);
    res.status(400).json({
      success: false,
      message: `Validation error: ${detail}`,
      errors: []
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        success: false,
        message: "A record with this value already exists (Unique constraint failed).",
        errors: []
      });
      return;
    }
    if (err.code === "P2003") {
      res.status(409).json({
        success: false,
        message: "Foreign key constraint failed. Either a referenced record does not exist, or it is referenced by other records and cannot be deleted.",
        errors: []
      });
      return;
    }
    if (err.code === "P2025") {
      console.error("[Prisma P2025 Error]", err.meta, err.message);
      res.status(404).json({
        success: false,
        message: "Record not found.",
        errors: []
      });
      return;
    }
  }

  if (err instanceof Error) {
    res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
      errors: [] as unknown[]
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
    errors: [] as unknown[]
  });
};