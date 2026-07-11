// src/middleware/normalizeImageBody.middleware.ts
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { uploadToImageKit } from "../utils/Imagekit";
import fs from "fs";

export const normalizeImageBody = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
        return next(new ApiError(400, "Image file is required"));
    }

    try {
        const uniqueName = `product_${Date.now()}_${req.file.originalname}`;
        req.body.imageUrl = await uploadToImageKit(req.file.path, uniqueName, "/products");

        // Clean up the local temp file after upload
        try {
            fs.unlinkSync(req.file.path);
        } catch (err) {
            console.error("Failed to delete temp file:", req.file.path, err);
        }

        if (req.body.isPrimary !== undefined) {
            req.body.isPrimary = req.body.isPrimary === "true" || req.body.isPrimary === true;
        }

        next();
    } catch (err: any) {
        next(err);
    }
};

export const normalizeImageBodyOptional = async (req: Request, res: Response, next: NextFunction) => {
    if (req.file) {
        try {
            const uniqueName = `product_${Date.now()}_${req.file.originalname}`;
            req.body.imageUrl = await uploadToImageKit(req.file.path, uniqueName, "/products");

            // Clean up the local temp file after upload
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.error("Failed to delete temp file:", req.file.path, err);
            }
        } catch (err: any) {
            return next(err);
        }
    }

    if (req.body.isPrimary !== undefined) {
        req.body.isPrimary = req.body.isPrimary === "true" || req.body.isPrimary === true;
    }

    next();
};
