import { Router } from "express";
import salesInvoiceController from "./sales-invoice.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createSalesInvoiceRequestSchema,
  updateSalesInvoiceRequestSchema,
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

router.put(
  "/:id",
  authMiddleware,
  validateMiddleware(updateSalesInvoiceRequestSchema),
  salesInvoiceController.update
);

router.delete(
  "/:id",
  authMiddleware,
  validateMiddleware(salesInvoiceIdRequestSchema),
  salesInvoiceController.delete
);

router.post(
  "/:id/email-invoice",
  authMiddleware,
  validateMiddleware(salesInvoiceIdRequestSchema),
  salesInvoiceController.emailInvoice
);

export default router;
