import { Router } from "express";
import reportsController from "./reports.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";

const router = Router();

/**
 * Machine Status & Efficiency Report
 */
router.get(
  "/machines",
  authMiddleware,
  requirePermission("reports.view"),
  reportsController.getMachineReport
);

/**
 * Weekly Program Progress Report
 */
router.get(
  "/weekly-programs",
  authMiddleware,
  requirePermission("reports.view"),
  reportsController.getWeeklyProgramReport
);

/**
 * Production Order Detail & Hourly Logs Report
 */
router.get(
  "/production-orders/:productionOrderId",
  authMiddleware,
  requirePermission("reports.view"),
  reportsController.getProductionOrderReport
);

/**
 * Sales Order Report
 */
router.get(
  "/sales-orders",
  authMiddleware,
  requirePermission("reports.view"),
  reportsController.getSalesOrderReport
);

/**
 * Purchase Order Report
 */
router.get(
  "/purchase-orders",
  authMiddleware,
  requirePermission("reports.view"),
  reportsController.getPurchaseOrderReport
);

export default router;
