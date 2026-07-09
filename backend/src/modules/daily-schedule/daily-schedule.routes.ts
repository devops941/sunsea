import { Router } from "express";
import dailyScheduleController from "./daily-schedule.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import { getDailyScheduleQuerySchema } from "./daily-schedule.validation";

const router = Router();

router.get(
  "/",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  validateMiddleware(getDailyScheduleQuerySchema),
  dailyScheduleController.getDailySchedule
);

export default router;
