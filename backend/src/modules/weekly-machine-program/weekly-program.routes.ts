import { Router } from "express";
import weeklyProgramController from "./weekly-program.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createWeeklyProgramSchema,
  updateWeeklyProgramSchema,
  weeklyProgramIdSchema,
} from "./weekly-program.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("weekly_programs.create"),
  validateMiddleware(createWeeklyProgramSchema),
  weeklyProgramController.create
);

router.get(
  "/",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  weeklyProgramController.findAll
);

router.get(
  "/next-id",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  weeklyProgramController.getNextId
);

router.get(
  "/daily-planning/data",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  weeklyProgramController.getDailyPlanning
);

router.get(
  "/pending",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  weeklyProgramController.findPending
);

router.get(
  "/:weeklyProgramId",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  validateMiddleware(weeklyProgramIdSchema),
  weeklyProgramController.findById
);

router.put(
  "/:weeklyProgramId",
  authMiddleware,
  requirePermission("weekly_programs.edit"),
  validateMiddleware(updateWeeklyProgramSchema),
  weeklyProgramController.update
);

router.delete(
  "/:weeklyProgramId",
  authMiddleware,
  requirePermission("weekly_programs.delete"),
  validateMiddleware(weeklyProgramIdSchema),
  weeklyProgramController.delete
);

export default router;
