import { Router } from "express";
import { whatsappController } from "./whatsapp.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";

const router = Router();

// GET /webhook (Verify Webhook from Meta) - No Auth
router.get("/webhook", whatsappController.verifyWebhook);

// POST /webhook (Receive Webhook Events from Meta) - No Auth
router.post("/webhook", whatsappController.handleWebhookEvent);

// --- Authenticated Routes Below ---
router.use(authMiddleware);

// GET /config (Fetch WhatsApp configuration)
router.get("/config", requirePermission("whatsapp.view"), whatsappController.getConfig);

// POST /config (Save/update WhatsApp configuration)
router.post("/config", requirePermission("whatsapp.edit"), whatsappController.saveConfig);

// POST /send (Send a WhatsApp message)
router.post("/send", requirePermission("whatsapp.send") || ((req:any, res:any, next:any) => next()), whatsappController.sendMessage);

export default router;
