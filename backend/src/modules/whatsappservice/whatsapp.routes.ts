import { Router } from "express";
import { whatsappController } from "./whatsapp.controller";

const router = Router();

// GET /config (Fetch WhatsApp configuration)
router.get("/config", whatsappController.getConfig);

// POST /config (Save/update WhatsApp configuration)
router.post("/config", whatsappController.saveConfig);

export default router;
