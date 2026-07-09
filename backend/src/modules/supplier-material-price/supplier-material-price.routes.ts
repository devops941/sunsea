import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import supplierMaterialPriceController from "./supplier-material-price.controller";
import {
  getCurrentPricesSchema,
  getPriceHistorySchema,
  createPriceSchema,
  revisePriceSchema,
  deletePriceSchema,
} from "./supplier-material-price.validation";

const router = Router();

router.get(
  "/current",
  authMiddleware,
  requirePermission("supplierpricelist.view"),
  validateMiddleware(getCurrentPricesSchema),
  supplierMaterialPriceController.getCurrentPrices
);

router.get(
  "/history",
  authMiddleware,
  requirePermission("supplierpricelist.view"),
  validateMiddleware(getPriceHistorySchema),
  supplierMaterialPriceController.getPriceHistory
);

router.post(
  "/",
  authMiddleware,
  requirePermission("supplierpricelist.create"),
  validateMiddleware(createPriceSchema),
  supplierMaterialPriceController.createPrice
);

router.post(
  "/revise",
  authMiddleware,
  requirePermission("supplierpricelist.edit"),
  validateMiddleware(revisePriceSchema),
  supplierMaterialPriceController.revisePrice
);

router.delete(
  "/:priceRowId",
  authMiddleware,
  requirePermission("supplierpricelist.delete"),
  validateMiddleware(deletePriceSchema),
  supplierMaterialPriceController.deletePrice
);

export default router;
