// src/middleware/normalizeImageBody.middleware.ts
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

export const normalizeImageBody = (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
        return next(new ApiError(400, "Image file is required"));
    }

    req.body.imageUrl = `/uploads/products/${req.file.filename}`;

    if (req.body.isPrimary !== undefined) {
        req.body.isPrimary = req.body.isPrimary === "true" || req.body.isPrimary === true;
    }

    next();
};

export const normalizeImageBodyOptional = (req: Request, res: Response, next: NextFunction) => {
    if (req.file) {
        req.body.imageUrl = `/uploads/products/${req.file.filename}`;
    }

    if (req.body.isPrimary !== undefined) {
        req.body.isPrimary = req.body.isPrimary === "true" || req.body.isPrimary === true;
    }

    next();
};
