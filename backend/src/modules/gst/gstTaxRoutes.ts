import { Router } from "express";
import gstTaxController from "./gstTaxController";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
    createGstTaxSchema,
    updateGstTaxSchema,
    gstTaxIdSchema,
} from "./gstTaxValidation";

const router = Router();

/**
 * Create GST Tax
 */
router.post(
    "/",
    authMiddleware,
    validateMiddleware(createGstTaxSchema),
    gstTaxController.create
);

/**
 * Get All GST Taxes
 */
router.get(
    "/",
    authMiddleware,
    gstTaxController.findAll
);

/**
 * Get GST Tax By ID
 */
router.get(
    "/:gstTaxId",
    authMiddleware,
    validateMiddleware(gstTaxIdSchema),
    gstTaxController.findById
);

/**
 * Update GST Tax
 */
router.put(
    "/:gstTaxId",
    authMiddleware,
    validateMiddleware(updateGstTaxSchema),
    gstTaxController.update
);

/**
 * Delete GST Tax
 */
// router.delete(
//     "/:gstTaxId",
//     authMiddleware,
//     requirePermission("gst_tax.delete"),
//     validateMiddleware(gstTaxIdSchema),
//     gstTaxController.delete
// );

export default router;