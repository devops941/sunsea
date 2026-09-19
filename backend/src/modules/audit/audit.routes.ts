import { Router } from "express";
import auditController from "./audit.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requirePermission("audit-reports.view"),
  auditController.getAllLogs
);

router.get(
  "/:entityName/:entityId",
  requirePermission("audit-reports.view"),
  auditController.getLogsByEntity
);

export default router;
