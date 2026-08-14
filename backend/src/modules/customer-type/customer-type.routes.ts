import { Router } from 'express';
import { CustomerTypeController } from './customer-type.controller';
;
import { createCustomerTypeSchema, updateCustomerTypeSchema, customerTypeIdSchema } from './customer-type.validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateMiddleware } from '../../middleware/validate.middleware';

const router = Router();

router.get('/', asyncHandler(CustomerTypeController.getAll));
router.get('/:id', validateMiddleware(customerTypeIdSchema), asyncHandler(CustomerTypeController.getById));
router.post('/', validateMiddleware(createCustomerTypeSchema), asyncHandler(CustomerTypeController.create));
router.put('/:id', validateMiddleware(updateCustomerTypeSchema), asyncHandler(CustomerTypeController.update));
router.delete('/:id', validateMiddleware(customerTypeIdSchema), asyncHandler(CustomerTypeController.delete));

export default router;
