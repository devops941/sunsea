import { Router } from "express";
import productionWastageController from "./production-wastage.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createProductionWastageSchema,
  updateProductionWastageSchema,
  getProductionWastageIdSchema,
} from "./production-wastage.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("machines.view"),
  validateMiddleware(createProductionWastageSchema),
  productionWastageController.create
);

router.get(
  "/",
  authMiddleware,
  requirePermission("machines.view"),
  productionWastageController.findAll
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("machines.view"),
  validateMiddleware(getProductionWastageIdSchema),
  productionWastageController.findById
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission("machines.view"),
  validateMiddleware(updateProductionWastageSchema),
  productionWastageController.update
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("machines.view"),
  validateMiddleware(getProductionWastageIdSchema),
  productionWastageController.delete
);

router.post(
  "/:id/approve",
  authMiddleware,
  requirePermission("machines.view"),
  validateMiddleware(getProductionWastageIdSchema),
  productionWastageController.approve
);

router.post(
  "/:id/reject",
  authMiddleware,
  requirePermission("machines.view"),
  validateMiddleware(getProductionWastageIdSchema),
  productionWastageController.reject
);

export default router;
