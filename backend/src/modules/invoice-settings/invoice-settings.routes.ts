import { Router } from "express";
import { invoiceSettingsController } from "./invoice-settings.controller";

const router = Router();

// GET /config (Fetch Invoice Settings configuration)
router.get("/config", invoiceSettingsController.getConfig);

// POST /config (Save/update Invoice Settings configuration)
router.post("/config", invoiceSettingsController.saveConfig);

export default router;
