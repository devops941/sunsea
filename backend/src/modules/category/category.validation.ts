import { z } from 'zod';

export const createCategorySchema = z.object({
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

export const updateCategorySchema =
  createCategorySchema.partial();

export type CreateCategoryInput =
  z.infer<typeof createCategorySchema>;

export type UpdateCategoryInput =
  z.infer<typeof updateCategorySchema>;