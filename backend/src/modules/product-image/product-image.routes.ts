import { Router } from "express";



import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
  createProductImageSchema,
  updateProductImageSchema,
  productImageIdSchema,
} from "./product-image.validation";
import { uploadProductImage } from "../../middleware/upload.middleware";
import { normalizeImageBody, normalizeImageBodyOptional } from "../../middleware/normalizeImageBody.middleware";
import productImageController from "./product-image.controller";

const router = Router();

/**

* Create Product Image
  */
router.post(
  "/",
  authMiddleware,
  requirePermission("product-images.view"),
  uploadProductImage.single("image"),
  normalizeImageBody,
  validateMiddleware(createProductImageSchema),
  productImageController.create
);

/**

* Get All Product Images
  */
router.get(
  "/",
  authMiddleware,
  requirePermission("product-images.view"),
  productImageController.findAll
);

/**

* Get Product Image By Id
  */
router.get(
  "/:id",
  authMiddleware,
  requirePermission("product-images.view"),
  validateMiddleware(productImageIdSchema),
  productImageController.findById
);

/**

* Update Product Image
  */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("product-images.edit"),
  uploadProductImage.single("image"),
  normalizeImageBodyOptional,
  validateMiddleware(updateProductImageSchema),
  productImageController.update
);

/**

* Delete Product Image
  */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("product-images.delete"),
  validateMiddleware(productImageIdSchema),
  productImageController.delete
);

export default router;
