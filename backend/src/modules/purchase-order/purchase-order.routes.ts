import { Router } from "express";

import purchaseOrderController from "./purchase-order.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
    createPurchaseOrderRequestSchema,
    updatePurchaseOrderRequestSchema,
    purchaseOrderIdRequestSchema,
} from "./purchase-order.validation";

const router = Router();

router.post(
    "/",
    authMiddleware,
    requirePermission("purchaseOrders.create"),
    validateMiddleware(createPurchaseOrderRequestSchema),
    purchaseOrderController.create
);

router.get(
    "/",
    authMiddleware,
    requirePermission("purchaseOrders.view"),
    purchaseOrderController.findAll
);

router.get(
    "/next-code",
    authMiddleware,
    requirePermission("purchaseOrders.view"),
    purchaseOrderController.getNextCode
);

router.get(
    "/:id",
    authMiddleware,
    requirePermission("purchaseOrders.view"),
    validateMiddleware(purchaseOrderIdRequestSchema),
    purchaseOrderController.findOne
);

router.put(
    "/:id",
    authMiddleware,
    requirePermission("purchaseOrders.edit"),
    validateMiddleware(updatePurchaseOrderRequestSchema),
    purchaseOrderController.update
);

router.delete(
    "/:id",
    authMiddleware,
    requirePermission("purchaseOrders.delete"),
    validateMiddleware(purchaseOrderIdRequestSchema),
    purchaseOrderController.delete
);

router.post(
    "/:id/email-po-invoice",
    authMiddleware,
    requirePermission("purchaseOrders.whatsapp-email"),
    validateMiddleware(purchaseOrderIdRequestSchema),
    purchaseOrderController.emailPoInvoice
);

router.post(
    "/:id/whatsapp-po",
    authMiddleware,
    requirePermission("purchaseOrders.whatsapp-email"),
    validateMiddleware(purchaseOrderIdRequestSchema),
    purchaseOrderController.whatsappPO
);

export default router;