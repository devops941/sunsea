import express from "express";
import multer from "multer";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { getEmailConfig, saveEmailConfig, sendEmailDirect, sendEmailWithAttachment } from "./email-config.controller";

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.use(authMiddleware);

router.get("/", requirePermission("email-config.view"), getEmailConfig);
router.post("/", requirePermission("email-config.edit"), saveEmailConfig);
router.post("/send", requirePermission("email-config.edit"), sendEmailDirect);
router.post("/send-with-attachment", requirePermission("email-config.edit"), upload.single("file"), sendEmailWithAttachment);

export default router;
