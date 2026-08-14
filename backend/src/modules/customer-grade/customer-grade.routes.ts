import { Router } from 'express';
import { CustomerGradeController } from './customer-grade.controller';
import { createCustomerGradeSchema, updateCustomerGradeSchema, customerGradeIdSchema } from './customer-grade.validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateMiddleware } from '../../middleware/validate.middleware';

const router = Router();

router.get('/', asyncHandler(CustomerGradeController.getAll));
router.get('/:id', validateMiddleware(customerGradeIdSchema), asyncHandler(CustomerGradeController.getById));
router.post('/', validateMiddleware(createCustomerGradeSchema), asyncHandler(CustomerGradeController.create));
router.put('/:id', validateMiddleware(updateCustomerGradeSchema), asyncHandler(CustomerGradeController.update));
router.delete('/:id', validateMiddleware(customerGradeIdSchema), asyncHandler(CustomerGradeController.delete));

export default router;
