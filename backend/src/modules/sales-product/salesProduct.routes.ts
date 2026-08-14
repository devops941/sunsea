import { Router } from "express";

import salesProductController from "./salesProduct.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
    createSalesProductSchema,
    updateSalesProductSchema,
    salesProductIdSchema,
} from "./salesProduct.validation";

const router = Router();

/**
 * Get Next Sales Product ID
 */
router.get(
    "/next-id",
    authMiddleware,
    salesProductController.getNextId
);

/**
 * Create Sales Product
 */
router.post(
    "/",
    authMiddleware,
    requirePermission("sales_products.create"),
    validateMiddleware(createSalesProductSchema),
    salesProductController.create
);

/**
 * Get All Sales Products
 */
router.get(
    "/",
    authMiddleware,
    requirePermission("sales_products.view"),
    salesProductController.findAll
);

/**
 * Get Sales Product By ID
 */
router.get(
    "/:id",
    authMiddleware,
    requirePermission("sales_products.view"),
    validateMiddleware(salesProductIdSchema),
    salesProductController.findById
);

/**
 * Update Sales Product
 */
router.put(
    "/:id",
    authMiddleware,
    requirePermission("sales_products.edit"),
    validateMiddleware(updateSalesProductSchema),
    salesProductController.update
);

/**
 * Delete Sales Product
 */
router.delete(
    "/:id",
    authMiddleware,
    requirePermission("sales_products.delete"),
    validateMiddleware(salesProductIdSchema),
    salesProductController.delete
);

export default router;
