import { Router } from "express";
import storeTypeController from "./store-type.controller";
import { validateMiddleware } from "../../middleware/validate.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import {
  createStoreTypeSchema,
  updateStoreTypeSchema,
  storeTypeIdSchema,
} from "./store-type.validation";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  requirePermission("store-types.create"),
  validateMiddleware(createStoreTypeSchema),
  storeTypeController.create
);

router.get(
  "/",
  requirePermission("store-types.view"),
  storeTypeController.findAll
);

router.get(
  "/next-id",
  requirePermission("store-types.view"),
  storeTypeController.getNextId
);

router.get(
  "/:id",
  requirePermission("store-types.view"),
  validateMiddleware(storeTypeIdSchema),
  storeTypeController.findById
);

router.patch(
  "/:id",
  requirePermission("store-types.edit"),
  validateMiddleware(updateStoreTypeSchema),
  storeTypeController.update
);

router.delete(
  "/:id",
  requirePermission("store-types.delete"),
  validateMiddleware(storeTypeIdSchema),
  storeTypeController.delete
);

export default router;
