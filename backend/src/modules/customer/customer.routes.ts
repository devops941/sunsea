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
  //requirePermission("customers.create"),
  validateMiddleware(createCustomerRequestSchema),
  customerController.create
);

router.get(
  "/",
  authMiddleware,
  //requirePermission("customers.view"),
  customerController.findAll
);

router.get(
  "/next-code",
  authMiddleware,
  //requirePermission("customers.view"),
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
  //requirePermission("customers.view"),
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