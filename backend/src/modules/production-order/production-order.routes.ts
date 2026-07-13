import { Router } from "express";
import productionOrderController from "./production-order.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createProductionOrderSchema,
  updateProductionOrderSchema,
  productionOrderIdSchema,
  productionOrderQuerySchema,
  issueMaterialsSchema
} from "./production-order.validation";

const router = Router();

router.get(
  "/next-id",
  authMiddleware,
  requirePermission("production_orders.view"),
  productionOrderController.getNextId
);

router.post(
  "/",
  authMiddleware,
  requirePermission("production_orders.create"),
  validateMiddleware(createProductionOrderSchema),
  productionOrderController.create
);

router.get(
  "/",
  authMiddleware,
  requirePermission("production_orders.view"),
  validateMiddleware(productionOrderQuerySchema),
  productionOrderController.findAll
);

router.get(
  "/:productionOrderId",
  authMiddleware,
  requirePermission("production_orders.view"),
  validateMiddleware(productionOrderIdSchema),
  productionOrderController.findById
);

router.put(
  "/:productionOrderId",
  authMiddleware,
  requirePermission("production_orders.edit"),
  validateMiddleware(updateProductionOrderSchema),
  productionOrderController.update
);

router.delete(
  "/:productionOrderId",
  authMiddleware,
  requirePermission("production_orders.delete"),
  validateMiddleware(productionOrderIdSchema),
  productionOrderController.delete
);

router.post(
  "/:productionOrderId/issue-materials",
  authMiddleware,
  requirePermission("production_orders.edit"),
  validateMiddleware(issueMaterialsSchema),
  productionOrderController.issueMaterials
);

export default router;
