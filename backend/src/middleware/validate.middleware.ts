import { Request, Response, NextFunction } from "express";

/**
 * Validates request body, query, and params
 * using the provided Zod schema.
 */
export const validateMiddleware =
  (schema: { parse: (data: unknown) => unknown }) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body:   req.body ?? {},   // GET requests have no body — default to {}
        query:  req.query,
        params: req.params,
      });
      next();
    } catch (error: unknown) {
      next(error);
    }
  };
