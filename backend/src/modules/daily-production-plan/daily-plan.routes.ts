import { Router } from "express";
import dailyPlanController from "./daily-plan.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createDailyPlanSchema,
  updateDailyPlanSchema,
  dailyPlanIdSchema,
} from "./daily-plan.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("weekly_programs.create"),
  validateMiddleware(createDailyPlanSchema),
  dailyPlanController.create
);

router.get(
  "/",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  dailyPlanController.findAll
);

router.get(
  "/:dailyPlanId",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  validateMiddleware(dailyPlanIdSchema),
  dailyPlanController.findById
);

router.put(
  "/:dailyPlanId",
  authMiddleware,
  requirePermission("weekly_programs.edit"),
  validateMiddleware(updateDailyPlanSchema),
  dailyPlanController.update
);

router.delete(
  "/:dailyPlanId",
  authMiddleware,
  requirePermission("weekly_programs.delete"),
  validateMiddleware(dailyPlanIdSchema),
  dailyPlanController.delete
);

export default router;
