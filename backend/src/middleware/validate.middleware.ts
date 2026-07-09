import { ZodTypeAny } from "zod";
import {
  Request,
  Response,
  NextFunction
} from "express";

/**
 * Validates request body, query, and params
 * using the provided Zod schema.
 */
export const validateMiddleware =
  (schema: ZodTypeAny) =>
  (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {

    try {

      // Validate incoming request data
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });

      next();

    } catch (error: unknown) {

      // Forward validation errors to global error handler
      next(error);
    }
  };