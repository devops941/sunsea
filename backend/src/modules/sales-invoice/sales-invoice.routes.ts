import { Router } from "express";
import salesInvoiceController from "./sales-invoice.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createSalesInvoiceRequestSchema,
  salesInvoiceIdRequestSchema,
} from "./sales-invoice.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  validateMiddleware(createSalesInvoiceRequestSchema),
  salesInvoiceController.create
);

router.get(
  "/",
  authMiddleware,
  salesInvoiceController.findAll
);

router.get(
  "/:id",
  authMiddleware,
  validateMiddleware(salesInvoiceIdRequestSchema),
  salesInvoiceController.findOne
);

router.delete(
  "/:id",
  authMiddleware,
  validateMiddleware(salesInvoiceIdRequestSchema),
  salesInvoiceController.delete
);

export default router;
