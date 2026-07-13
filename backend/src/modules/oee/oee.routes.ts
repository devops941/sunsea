import { Router } from "express";
import oeeController from "./oee.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

// Machine OEE summary (with optional ?date=YYYY-MM-DD query param)
router.get("/machine/:machineId/summary", oeeController.getMachineOeeSummary);

// Production Order OEE and production summary
router.get("/production-order/:productionOrderId", oeeController.getProductionOrderOee);

// All machines status with today OEE
router.get("/machines/status", oeeController.getAllMachinesStatus);

export default router;
