import { Router } from "express";

import customerController from "./customer.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createCustomerRequestSchema,
  updateCustomerRequestSchema,
  customerIdRequestSchema,
} from "./customer.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("customers.create"), // BUG-CUST-001 fix: permission guard restored
  validateMiddleware(createCustomerRequestSchema),
  customerController.create
);

router.get(
  "/",
  authMiddleware,
  requirePermission("customers.view"), // BUG-CUST-001 fix: permission guard restored
  customerController.findAll
);

router.get(
  "/next-code",
  authMiddleware,
  requirePermission("customers.view"), // BUG-CUST-001 fix: permission guard restored
  customerController.getNextCode
);

router.get(
  "/:id/credit-status",
  authMiddleware,
  customerController.getCreditStatus
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("customers.view"), // BUG-CUST-001 fix: permission guard restored
  validateMiddleware(customerIdRequestSchema),
  customerController.findOne
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission("customers.edit"),
  validateMiddleware(updateCustomerRequestSchema),
  customerController.update
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("customers.delete"),
  validateMiddleware(customerIdRequestSchema),
  customerController.delete
);

export default router;