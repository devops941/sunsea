import { Router } from "express";
import grnInvoiceController from "./grn-invoice.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
    createGrnInvoiceRequestSchema,
    updateGrnInvoiceRequestSchema,
    grnInvoiceIdRequestSchema,
} from "./grn-invoice.validation";
import { uploadInvoiceImage } from "../../middleware/upload.middleware";

const router = Router();

router.post(
    "/",
    authMiddleware,
    uploadInvoiceImage.single("invoiceImage"),
    validateMiddleware(createGrnInvoiceRequestSchema),
    grnInvoiceController.create
);

router.put(
    "/:id",
    authMiddleware,
    uploadInvoiceImage.single("invoiceImage"),
    validateMiddleware(updateGrnInvoiceRequestSchema),
    grnInvoiceController.update
);

router.get(
    "/",
    authMiddleware,
    grnInvoiceController.findAll
);

router.get(
    "/next-code",
    authMiddleware,
    grnInvoiceController.getNextCode
);

router.get(
    "/:id",
    authMiddleware,
    validateMiddleware(grnInvoiceIdRequestSchema),
    grnInvoiceController.findOne
);

router.put(
    "/:id",
    authMiddleware,
    validateMiddleware(updateGrnInvoiceRequestSchema),
    grnInvoiceController.update
);

router.delete(
    "/:id",
    authMiddleware,
    validateMiddleware(grnInvoiceIdRequestSchema),
    grnInvoiceController.delete
);

export default router;
