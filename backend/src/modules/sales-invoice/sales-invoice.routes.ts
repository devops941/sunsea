import { Router } from "express";
import salesInvoiceController from "./sales-invoice.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import {
  createSalesInvoiceRequestSchema,
  updateSalesInvoiceRequestSchema,
  salesInvoiceIdRequestSchema,
} from "./sales-invoice.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("sales-invoices.create"),
  validateMiddleware(createSalesInvoiceRequestSchema),
  salesInvoiceController.create
);

router.get(
  "/",
  authMiddleware,
  requirePermission("sales-invoices.view"),
  salesInvoiceController.findAll
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("sales-invoices.view"),
  validateMiddleware(salesInvoiceIdRequestSchema),
  salesInvoiceController.findOne
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission("sales-invoices.edit"),
  validateMiddleware(updateSalesInvoiceRequestSchema),
  salesInvoiceController.update
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("sales-invoices.delete"),
  validateMiddleware(salesInvoiceIdRequestSchema),
  salesInvoiceController.delete
);

router.post(
  "/:id/email-invoice",
  authMiddleware,
  requirePermission("sales-invoices.view"),
  validateMiddleware(salesInvoiceIdRequestSchema),
  salesInvoiceController.emailInvoice
);

export default router;
