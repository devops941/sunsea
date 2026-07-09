import { Router } from "express";

import billOfMaterialController from "./billOfMaterial.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
    createBillOfMaterialSchema,
    updateBillOfMaterialSchema,
    billOfMaterialIdSchema,
} from "./billOfMaterial.validation";

const router = Router();

/**
 * Get Next Bill Of Material ID
 */
router.get(
    "/next-id",
    authMiddleware,
    billOfMaterialController.getNextId
);

/**
 * Create Bill Of Material
 */
router.post(
    "/",
    authMiddleware,
    requirePermission("bill_of_materials.create"),
    validateMiddleware(createBillOfMaterialSchema),
    billOfMaterialController.create
);

/**
 * Get All Bill Of Materials
 */
router.get(
    "/",
    authMiddleware,
    requirePermission("bill_of_materials.view"),
    billOfMaterialController.findAll
);

/**
 * Get Bill Of Material By ID
 */
router.get(
    "/:id",
    authMiddleware,
    requirePermission("bill_of_materials.view"),
    validateMiddleware(billOfMaterialIdSchema),
    billOfMaterialController.findById
);

/**
 * Update Bill Of Material
 */
router.put(
    "/:id",
    authMiddleware,
    requirePermission("bill_of_materials.edit"),
    validateMiddleware(updateBillOfMaterialSchema),
    billOfMaterialController.update
);

/**
 * Delete Bill Of Material
 */
router.delete(
    "/:id",
    authMiddleware,
    requirePermission("bill_of_materials.delete"),
    validateMiddleware(billOfMaterialIdSchema),
    billOfMaterialController.delete
);

export default router;