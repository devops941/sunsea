import { Router } from "express";
import goodsDispatchController from "./goods-dispatch.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createGoodsDispatchSchema,
  gateApproveSchema,
  storeReceiveSchema,
  goodsDispatchQuerySchema,
  eligibleOrdersQuerySchema,
} from "./goods-dispatch.validation";

const router = Router();

// ── Special routes (must come before /:id) ──────────────────────────────────

router.get(
  "/next-number",
  authMiddleware,
  requirePermission("production_orders.view"),
  goodsDispatchController.getNextNumber
);

router.get(
  "/eligible-orders",
  authMiddleware,
  requirePermission("production_orders.view"),
  validateMiddleware(eligibleOrdersQuerySchema),
  goodsDispatchController.getEligibleOrders
);

// ── CRUD ─────────────────────────────────────────────────────────────────────

router.post(
  "/",
  authMiddleware,
  requirePermission("production_orders.create"),
  validateMiddleware(createGoodsDispatchSchema),
  goodsDispatchController.create
);

router.get(
  "/",
  authMiddleware,
  requirePermission("production_orders.view"),
  validateMiddleware(goodsDispatchQuerySchema),
  goodsDispatchController.findAll
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("production_orders.view"),
  goodsDispatchController.findById
);

// ── Approval Endpoints ───────────────────────────────────────────────────────

router.post(
  "/:id/gate-approve",
  authMiddleware,
  requirePermission("production_orders.edit"),
  validateMiddleware(gateApproveSchema),
  goodsDispatchController.gateApprove
);

router.post(
  "/:id/store-receive",
  authMiddleware,
  requirePermission("production_orders.edit"),
  validateMiddleware(storeReceiveSchema),
  goodsDispatchController.storeReceive
);

export default router;
