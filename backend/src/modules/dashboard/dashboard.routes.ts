import { Router } from "express";
import dashboardController from "./dashboard.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.get("/summary", authMiddleware, dashboardController.getSummary);
router.get("/accounts-summary", authMiddleware, dashboardController.getAccountsSummary);
router.get("/tv-summary", authMiddleware, dashboardController.getTvSummary);

export default router;
