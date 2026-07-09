import { Router } from "express";

import sizeController from "./size.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
createSizeSchema,
updateSizeSchema,
sizeIdSchema,
} from "./size.validation";

const router = Router();

/**
 * Get Next Size ID
 */
router.get(
  "/next-id",
  authMiddleware,
  sizeController.getNextId
);

/**

* Create Size
  */
  router.post(
  "/",
  authMiddleware,
  requirePermission("sizes.create"),
  validateMiddleware(createSizeSchema),
  sizeController.create
  );

/**

* Get All Sizes
  */
  router.get(
  "/",
  authMiddleware,
  requirePermission("sizes.view"),
  sizeController.findAll
  );

/**

* Get Size By Id
  */
  router.get(
  "/:id",
  authMiddleware,
  requirePermission("sizes.view"),
  validateMiddleware(sizeIdSchema),
  sizeController.findById
  );

/**

* Update Size
  */
  router.put(
  "/:id",
  authMiddleware,
  requirePermission("sizes.edit"),
  validateMiddleware(updateSizeSchema),
  sizeController.update
  );

/**

* Delete Size
  */
  router.delete(
  "/:id",
  authMiddleware,
  requirePermission("sizes.delete"),
  validateMiddleware(sizeIdSchema),
  sizeController.delete
  );

export default router;
