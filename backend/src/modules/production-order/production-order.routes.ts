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
  issueMaterialsSchema,
  machineProgramQuerySchema
} from "./production-order.validation";

const router = Router();

router.get(
  "/next-id",
  authMiddleware,
  requirePermission("production_orders.view"),
  productionOrderController.getNextId
);

// Machine program list for a given machine + week (Mon–Sun)
router.get(
  "/machine-program",
  authMiddleware,
  requirePermission("production_orders.view"),
  validateMiddleware(machineProgramQuerySchema),
  productionOrderController.getMachinePrograms
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

// STEP 2: Material availability check → READY_FOR_PLANNING or WAITING_FOR_MATERIAL
router.post(
  "/:productionOrderId/check-materials",
  authMiddleware,
  requirePermission("production_orders.edit"),
  productionOrderController.checkMaterialAvailability
);

// STEP 5: Start production → auto-issue raw materials, set IN_PRODUCTION
router.post(
  "/:productionOrderId/start-production",
  authMiddleware,
  requirePermission("production_orders.edit"),
  productionOrderController.startProduction
);

// STEP 7 → STEP 8: Complete post-production → READY_FOR_DISPATCH
router.post(
  "/:productionOrderId/complete-post-production",
  authMiddleware,
  requirePermission("production_orders.edit"),
  productionOrderController.completePostProduction
);

// Status timeline / audit trail
router.get(
  "/:productionOrderId/history",
  authMiddleware,
  requirePermission("production_orders.view"),
  validateMiddleware(productionOrderIdSchema),
  productionOrderController.getHistory
);

export default router;

