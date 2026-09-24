import { Router } from "express";
import productShiftRecordController from "./product-shift-record.controller";
import { createRecordSchema, productIdSchema } from "./product-shift-record.validation";
import { validateMiddleware } from "../../middleware/validate.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.post("/", authMiddleware, validateMiddleware(createRecordSchema), productShiftRecordController.create);
router.get("/leaderboard", authMiddleware, productShiftRecordController.getLeaderboard);
router.post("/leaderboard/reset", authMiddleware, productShiftRecordController.resetLeaderboard);
router.get("/product/:productId", authMiddleware, validateMiddleware(productIdSchema), productShiftRecordController.findByProduct);

export default router;
