import { Router } from "express";
import { productCapacityHistoryController } from "./product-capacity-history.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import { productIdSchema } from "./product-capacity-history.validation";

const router = Router();

router.get(
  "/product/:productId",
  authMiddleware,
  validateMiddleware(productIdSchema),
  productCapacityHistoryController.findByProduct
);

router.post(
  "/manual",
  authMiddleware,
  productCapacityHistoryController.manualChange
);

export default router;
