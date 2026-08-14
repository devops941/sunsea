import { z } from 'zod';

const customerGradeBodySchema = z.object({
  name: z
    .string()
    .min(2, 'Name is required')
    .max(100),
});

export const createCustomerGradeSchema = z.object({
  body: customerGradeBodySchema,
});

export const updateCustomerGradeSchema = z.object({
  body: customerGradeBodySchema,
  params: z.object({ id: z.string().regex(/^\d+$/, 'Invalid id') }),
});

export const customerGradeIdSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/, 'Invalid id') }),
});

export type CreateCustomerGradeInput = z.infer<typeof createCustomerGradeSchema>['body'];
export type UpdateCustomerGradeInput = z.infer<typeof updateCustomerGradeSchema>['body'];
