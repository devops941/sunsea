import { Router } from "express";

import productColorController from "./product-color.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
createProductColorSchema,
updateProductColorSchema,
productColorIdSchema,
} from "./product-color.validation";

const router = Router();

/**

* Create Product Color
  */
  router.post(
  "/",
  authMiddleware,
  requirePermission("colors.create"),
  validateMiddleware(createProductColorSchema),
  productColorController.create
  );

/**

* Get All Product Colors
  */
  router.get(
  "/",
  authMiddleware,
  requirePermission("colors.view"),
  productColorController.findAll
  );

/**

* Get Product Color By Id
  */
  router.get(
  "/:id",
  authMiddleware,
  requirePermission("colors.view"),
  validateMiddleware(productColorIdSchema),
  productColorController.findById
  );

/**

* Update Product Color
  */
  router.put(
  "/:id",
  authMiddleware,
  requirePermission("colors.edit"),
  validateMiddleware(updateProductColorSchema),
  productColorController.update
  );

/**

* Delete Product Color
  */
  router.delete(
  "/:id",
  authMiddleware,
  requirePermission("colors.delete"),
  validateMiddleware(productColorIdSchema),
  productColorController.delete
  );

export default router;
