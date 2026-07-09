import {
  RequestHandler
} from "express";

/**
 * Wraps async route handlers and forwards
 * unhandled errors to the global error handler.
 */
export const asyncHandler =
  (
    fn: RequestHandler
  ): RequestHandler =>
  (
    req,
    res,
    next
  ) => {
    Promise.resolve(
      fn(req, res, next)
    ).catch(next);
  };