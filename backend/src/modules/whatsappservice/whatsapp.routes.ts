import { Router } from "express";
import { whatsappController } from "./whatsapp.controller";

const router = Router();

// GET /config (Fetch WhatsApp configuration)
router.get("/config", whatsappController.getConfig);

// POST /config (Save/update WhatsApp configuration)
router.post("/config", whatsappController.saveConfig);

// POST /send (Send a WhatsApp message)
router.post("/send", whatsappController.sendMessage);

// GET /webhook (Verify Webhook from Meta)
router.get("/webhook", whatsappController.verifyWebhook);

// POST /webhook (Receive Webhook Events from Meta)
router.post("/webhook", whatsappController.handleWebhookEvent);

export default router;
