import { Router } from "express";
import { invoiceSettingsController } from "./invoice-settings.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";

const router = Router();

router.use(authMiddleware);

// GET /config (Fetch Invoice Settings configuration)
router.get("/config", requirePermission("invoice-settings.view"), invoiceSettingsController.getConfig);

// POST /config (Save/update Invoice Settings configuration)
router.post("/config", requirePermission("invoice-settings.edit"), invoiceSettingsController.saveConfig);

export default router;
