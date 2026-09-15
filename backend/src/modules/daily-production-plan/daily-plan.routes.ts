import { Router } from "express";
import dailyPlanController from "./daily-plan.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createDailyPlanSchema,
  updateDailyPlanSchema,
  dailyPlanIdSchema,
  bulkCreateDailyPlanSchema,
  bulkDeleteDailyPlanSchema,
  issueRawMaterialsSchema,
} from "./daily-plan.validation";

const router = Router();

router.post(
  "/bulk-create",
  authMiddleware,
  requirePermission("weekly_programs.create"),
  validateMiddleware(bulkCreateDailyPlanSchema),
  dailyPlanController.bulkCreate
);

router.post(
  "/bulk-delete",
  authMiddleware,
  requirePermission("weekly_programs.delete"),
  validateMiddleware(bulkDeleteDailyPlanSchema),
  dailyPlanController.bulkDelete
);


router.get(
  "/check-week",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  dailyPlanController.checkWeek
);

router.get(
  "/week-products",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  dailyPlanController.getWeekProducts
);

router.get(
  "/rm-issued-dates",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  dailyPlanController.getRmIssuedDates
);

router.get(
  "/rm-requirements",
  authMiddleware,
  requirePermission("weekly_programs.view"),
  dailyPlanController.getRmRequirements
);

router.post(
  "/issue-raw-materials",
  authMiddleware,
  requirePermission("weekly_programs.create"),
  validateMiddleware(issueRawMaterialsSchema),
  dailyPlanController.issueRawMaterials
);

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
