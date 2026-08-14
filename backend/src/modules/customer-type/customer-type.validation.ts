import { z } from 'zod';

const customerTypeBodySchema = z.object({
  name: z
    .string()
    .min(2, 'Name is required')
    .max(100),
});

export const createCustomerTypeSchema = z.object({
  body: customerTypeBodySchema,
});

export const updateCustomerTypeSchema = z.object({
  body: customerTypeBodySchema,
  params: z.object({ id: z.string().regex(/^\d+$/, 'Invalid id') }),
});

export const customerTypeIdSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/, 'Invalid id') }),
});

export type CreateCustomerTypeInput = z.infer<typeof createCustomerTypeSchema>['body'];
export type UpdateCustomerTypeInput = z.infer<typeof updateCustomerTypeSchema>['body'];
