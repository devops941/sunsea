import { Router } from "express";
import { expenseController } from "./expense.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validateMiddleware } from "../../middleware/validate.middleware";
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseIdRequestSchema,
} from "./expense.validation";

const router = Router();

router.post(
  "/",
  authMiddleware,
  validateMiddleware(createExpenseSchema),
  expenseController.create
);

router.get(
  "/",
  authMiddleware,
  expenseController.findAll
);

router.get(
  "/next-code",
  authMiddleware,
  expenseController.getNextCode
);

router.get(
  "/:id",
  authMiddleware,
  validateMiddleware(expenseIdRequestSchema),
  expenseController.findOne
);

router.put(
  "/:id",
  authMiddleware,
  validateMiddleware(expenseIdRequestSchema),
  validateMiddleware(updateExpenseSchema),
  expenseController.update
);

router.delete(
  "/:id",
  authMiddleware,
  validateMiddleware(expenseIdRequestSchema),
  expenseController.delete
);

export default router;
