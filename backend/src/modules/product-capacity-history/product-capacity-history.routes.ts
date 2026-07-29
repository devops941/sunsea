import { Router } from "express";
import { productCapacityHistoryController } from "./product-capacity-history.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import { productIdSchema, machineIdSchema } from "./product-capacity-history.validation";

const router = Router();

router.get(
  "/product/:productId",
  authMiddleware,
  validateMiddleware(productIdSchema),
  productCapacityHistoryController.findByProduct
);

router.get(
  "/product/:productId/machine/:machineId",
  authMiddleware,
  validateMiddleware(productIdSchema),
  validateMiddleware(machineIdSchema),
  productCapacityHistoryController.getLatestByProductAndMachine
);

router.post(
  "/manual",
  authMiddleware,
  productCapacityHistoryController.manualChange
);

export default router;
