import { Router } from "express";

import supplierController from "./supplier.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";

import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierIdSchema,
  getSuppliersQuerySchema,
} from "./supplier.validation";

const router = Router();

/**
 * Create Supplier
 */
router.post(
  "/",
  authMiddleware,
  requirePermission("supplier.create"),
  validateMiddleware(
    createSupplierSchema
  ),
  supplierController.create
);

/**
 * Get All Suppliers
 */
router.get(
  "/",
  authMiddleware,
  requirePermission("supplier.view"),
  validateMiddleware(
    getSuppliersQuerySchema
  ),
  supplierController.findAll
);

/**
 * Get Next Supplier Code
 */
router.get(
  "/next-code",
  authMiddleware,
  requirePermission("supplier.view"),
  supplierController.getNextCode
);

/**
 * Get Supplier By Id
 */
router.get(
  "/:id",
  authMiddleware,
  requirePermission("supplier.view"),
  validateMiddleware(
    supplierIdSchema
  ),
  supplierController.findById
);

/**
 * Update Supplier
 */
router.put(
  "/:id",
  authMiddleware,
  requirePermission("supplier.edit"),
  validateMiddleware(
    updateSupplierSchema
  ),
  supplierController.update
);

/**
 * Delete Supplier
 */
router.delete(
  "/:id",
  authMiddleware,
  requirePermission("supplier.delete"),
  validateMiddleware(
    supplierIdSchema
  ),
  supplierController.delete
);

export default router;