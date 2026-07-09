import { Router } from "express";

import productPricingController from "./product-pricing.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
createProductPricingSchema,
updateProductPricingSchema,
productPricingIdSchema,
} from "./product-pricing.validation";

const router = Router();

/**

* Create Product Pricing
  */
  router.post(
  "/",
  authMiddleware,
  requirePermission("product-pricing.create"),
  validateMiddleware(createProductPricingSchema),
  productPricingController.create
  );

/**

* Get All Product Pricings
  */
  router.get(
  "/",
  authMiddleware,
  requirePermission("product-pricing.view"),
  productPricingController.findAll
  );

/**

* Get Product Pricing By Id
  */
  router.get(
  "/:id",
  authMiddleware,
  requirePermission("product-pricing.view"),
  validateMiddleware(productPricingIdSchema),
  productPricingController.findById
  );

/**

* Update Product Pricing
  */
  router.put(
  "/:id",
  authMiddleware,
  requirePermission("product-pricing.edit"),
  validateMiddleware(updateProductPricingSchema),
  productPricingController.update
  );

/**

* Delete Product Pricing
  */
  router.delete(
  "/:id",
  authMiddleware,
  requirePermission("product-pricing.delete"),
  validateMiddleware(productPricingIdSchema),
  productPricingController.delete
  );

export default router;
