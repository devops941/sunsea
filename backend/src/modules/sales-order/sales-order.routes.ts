import express from "express";
import SalesOrderController from "./slaes-order.controller";
import { validateMiddleware } from "../../middleware/validate.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";

import {
    createSalesOrderSchema,
    updateSalesOrderSchema,
    salesOrderIdSchema,
    salesOrderQuerySchema,
} from "./sales-order.validation";
import { requirePermission, requireAnyPermission } from "../../middleware/permission.middleware";

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    requirePermission("sales-orders.create"),
    validateMiddleware(createSalesOrderSchema),
    SalesOrderController.create
);


router.get(
    "/credit-block-check",
    authMiddleware,
    requirePermission("sales-orders.view"),
    SalesOrderController.checkCreditBlock
);

router.get(
    "/",
    authMiddleware,
    requirePermission("sales-orders.view"),
    validateMiddleware(salesOrderQuerySchema),
    SalesOrderController.findAll
);

router.get(
    "/next-code",
    authMiddleware,
    requirePermission("sales-orders.view"),
    SalesOrderController.getNextCode
);

router.get(
    "/next-quotation-code",
    authMiddleware,
    requirePermission("sales-orders.view"),
    SalesOrderController.getNextQuotationCode
);

router.get(
    "/source-orders",
    authMiddleware,
    requirePermission("sales-orders.view"),
    SalesOrderController.getSourceOrders
);

router.get(
    "/:id/status",
    authMiddleware,
    requirePermission("sales-orders.view"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.getStatus
);

router.get(
    "/:id",
    authMiddleware,
    requirePermission("sales-orders.view"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.findById
);

router.get(
    "/:id/download-quotation",
    authMiddleware,
    requirePermission("sales-orders.view"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.downloadQuotation
);

router.post(
    "/:id/email-quotation",
    authMiddleware,
    requirePermission("sales-orders.view"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.emailQuotation
);

router.post(
    "/:id/whatsapp-quotation",
    authMiddleware,
    requirePermission("sales-orders.view"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.whatsappQuotation
);


router.put(
    "/:id",
    authMiddleware,
    requirePermission("sales-orders.edit"),
    validateMiddleware(updateSalesOrderSchema),
    SalesOrderController.update
);


router.delete(
    "/:id",
    authMiddleware,
    requirePermission("sales-orders.delete"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.delete
);


// ─── Workflow actions ────────────────────────────────────────────────

router.patch(
    "/:id/confirm",
    authMiddleware,
    requirePermission("sales-orders.edit"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.confirmOrder
);

router.patch(
    "/:id/convert-to-order",
    authMiddleware,
    requirePermission("sales-orders.edit"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.convertToSalesOrder
);

router.patch(
    "/:id/mark-in-quotation",
    authMiddleware,
    requirePermission("sales-orders.create"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.markInQuotation
);

export default router;