import express from "express";
import SalesOrderController from "./slaes-order.controller";
import { validateMiddleware } from "../../middleware/validate.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";

import {
    createSalesOrderSchema,
    updateSalesOrderSchema,
    salesOrderIdSchema,
    salesOrderQuerySchema,
    submitForMdApprovalSchema,
    reopenSalesOrderSchema,
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
    "/source-orders",
    authMiddleware,
    requireAnyPermission("sales-orders.view", "sales-orders.view-estimate"),
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
    "/:id/submit-approval",
    authMiddleware,
    requirePermission("sales-orders.edit"),
    validateMiddleware(submitForMdApprovalSchema),
    SalesOrderController.submitForApproval
);

router.patch(
    "/:id/approve",
    authMiddleware,
    requirePermission("pending-quotations.edit"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.approveOrder
);

// Same action, accessible with sales-orders.edit (for MD/admin direct approval from quotation list)
router.patch(
    "/:id/md-approve",
    authMiddleware,
    requirePermission("sales-orders.edit"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.approveOrder
);

router.patch(
    "/:id/reject",
    authMiddleware,
    requirePermission("pending-quotations.edit"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.rejectOrder
);

router.patch(
    "/:id/reopen",
    authMiddleware,
    requirePermission("sales-orders.edit"),
    validateMiddleware(reopenSalesOrderSchema),
    SalesOrderController.reopen
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
    requireAnyPermission("sales-orders.create", "sales-orders.view-estimate"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.markInQuotation
);

export default router;