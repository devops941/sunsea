import { Router } from "express";

import productController from "./product.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";


import {
  createProductSchema,
  updateProductSchema,
  productIdSchema,
} from "./product.validation";
import { uploadProductImage } from "../../middleware/upload.middleware";

const router = Router();

/**
 * Get Next Product ID
 */
router.get(
  "/next-id",
  authMiddleware,
  productController.getNextId
);

/**
 * Create Product
 *
 * uploadProductImage.array("images", 3) MUST run before validateMiddleware.
 * Multer is what parses the multipart/form-data body into req.body +
 * req.files — until it runs, req.body is empty and validation would fail
 * on every field.
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("products.create"),
  uploadProductImage.array("images", 3),
  validateMiddleware(createProductSchema),
  productController.create
);

/**
 * Get All Products
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("products.view"),
  productController.findAll
);

/**
 * Get Product By Id
 */
router.get(
  "/:id",
  authMiddleware,
  requirePermission("products.view"),
  validateMiddleware(productIdSchema),
  productController.findById
);

/**
 * Update Product
 *
 * Same field name ("images") and cap (3) as create, since edit now supports
 * adding/removing individual images rather than replacing a single one.
 * The cap is enforced here per-request only — it does NOT account for
 * images the product already has on disk, so a product with 2 existing
 * images plus 3 new uploads would still pass multer (5 total) and only get
 * capped at the DB layer if product.service enforces it. Enforce the
 * combined (existing + new) limit of 3 on the frontend before submit.
 */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("products.edit"),
  uploadProductImage.array("images", 3),
  validateMiddleware(updateProductSchema),
  productController.update
);

/**
 * Delete Product
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("products.delete"),
  validateMiddleware(productIdSchema),
  productController.delete
);

export default router;