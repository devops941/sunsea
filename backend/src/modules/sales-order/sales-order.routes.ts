import express from "express";
import SalesOrderController from "./slaes-order.controller";
import { validateMiddleware } from "../../middleware/validate.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";

import {
    createSalesOrderSchema,
    updateSalesOrderSchema,
    salesOrderIdSchema,
    salesOrderQuerySchema,
    updateSalesOrderDiscountsSchema,
    submitForMdApprovalSchema,
    reopenSalesOrderSchema,
    mdApprovalDecisionSchema,
    customerApprovalDecisionSchema,
} from "./sales-order.validation";
import { requirePermission } from "../../middleware/permission.middleware";

const router = express.Router();

router.post(
    "/",
    authMiddleware,
    requirePermission("sales_order.create"),
    validateMiddleware(createSalesOrderSchema),
    SalesOrderController.create
);


router.get(
    "/credit-block-check",
    authMiddleware,
    requirePermission("sales_order.view"),
    SalesOrderController.checkCreditBlock
);

router.get(
    "/",
    authMiddleware,
    requirePermission("sales_order.view"),
    validateMiddleware(salesOrderQuerySchema),
    SalesOrderController.findAll
);

router.get(
    "/next-code",
    authMiddleware,
    requirePermission("sales_order.view"),
    SalesOrderController.getNextCode
);

router.get(
    "/:id/status",
    authMiddleware,
    requirePermission("sales_order.view"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.getStatus
);

router.get(
    "/:id",
    authMiddleware,
    requirePermission("sales_order.view"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.findById
);

router.post(
    "/:id/email-quotation",
    authMiddleware,
    requirePermission("sales_order.view"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.emailQuotation
);


router.put(
    "/:id",
    authMiddleware,
    requirePermission("sales_order.edit"),
    validateMiddleware(updateSalesOrderSchema),
    SalesOrderController.update
);


router.delete(
    "/:id",
    authMiddleware,
    requirePermission("sales_order.delete"),
    validateMiddleware(salesOrderIdSchema),
    SalesOrderController.delete
);


// ─── Quotation workflow actions (same SalesOrder resource) ────────────

router.patch(
    "/:id/discounts",
    authMiddleware,
    requirePermission("sales_order.edit"),
    validateMiddleware(updateSalesOrderDiscountsSchema),
    SalesOrderController.updateDiscounts
);

router.patch(
    "/:id/submit-md-approval",
    authMiddleware,
    requirePermission("sales_order.edit"),
    validateMiddleware(submitForMdApprovalSchema),
    SalesOrderController.submitForMdApproval
);

router.patch(
    "/:id/reopen",
    authMiddleware,
    requirePermission("sales_order.edit"),
    validateMiddleware(reopenSalesOrderSchema),
    SalesOrderController.reopen
);

router.patch(
    "/:id/md-approve",
    validateMiddleware(mdApprovalDecisionSchema),
    SalesOrderController.mdApprove
);

router.patch(
    "/:id/customer-approve",
    authMiddleware,
    validateMiddleware(customerApprovalDecisionSchema),
    SalesOrderController.customerApprove
);

export default router;