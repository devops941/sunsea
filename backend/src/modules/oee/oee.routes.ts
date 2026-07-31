import { Router } from "express";
import oeeController from "./oee.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";

const router = Router();

router.use(authMiddleware);

// Machine OEE summary (with optional ?date=YYYY-MM-DD query param)
router.get("/machine/:machineId/summary", requirePermission("oee-dashboard.view"), oeeController.getMachineOeeSummary);

// Production Order OEE and production summary
router.get("/production-order/:productionOrderId", requirePermission("oee-dashboard.view"), oeeController.getProductionOrderOee);

// All machines status with today OEE
router.get("/machines/status", requirePermission("oee-dashboard.view"), oeeController.getAllMachinesStatus);

export default router;
