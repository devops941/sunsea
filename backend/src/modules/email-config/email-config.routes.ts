import express from "express";
import multer from "multer";
import { authMiddleware } from "../../middleware/auth.middleware";
import { getEmailConfig, saveEmailConfig, sendEmailDirect, sendEmailWithAttachment } from "./email-config.controller";

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.use(authMiddleware);

router.get("/", getEmailConfig);
router.post("/", saveEmailConfig);
router.post("/send", sendEmailDirect);
router.post("/send-with-attachment", upload.single("file"), sendEmailWithAttachment);

export default router;
