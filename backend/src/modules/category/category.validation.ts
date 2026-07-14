import { z } from 'zod';

// CAT-004 fix: wrapped in body: z.object({}) so validateMiddleware can parse it correctly
const categoryBodySchema = z.object({
  categoryCode: z
    .string()
    .min(2, 'Category code is required')
    .max(20),

  categoryName: z
    .string()
    .min(2, 'Category name is required')
    .max(100),

  description: z.string().optional(),

  isActive: z.boolean().optional(),
});

export const createCategorySchema = z.object({
  body: categoryBodySchema,
});

export const updateCategorySchema = z.object({
  body: categoryBodySchema.partial(),
  params: z.object({ id: z.string().regex(/^\d+$/, 'Invalid category id') }),
});

export const categoryIdSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/, 'Invalid category id') }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];