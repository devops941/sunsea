import { z } from "zod";

/**
 * Create Raw Material Category Validation
 */
export const createRawMaterialCategorySchema = z.object({
  body: z.object({
    categoryCode: z
      .string()
      .min(1, "Category Code is required")
      .max(20, "Category Code cannot exceed 20 characters"),

    categoryName: z
      .string()
      .min(1, "Category Name is required")
      .max(100, "Category Name cannot exceed 100 characters"),

    description: z
      .string()
      .max(255, "Description cannot exceed 255 characters")
      .optional()
      .nullable(),

    isActive: z
      .boolean()
      .optional(),
  }),
});

/**
 * Update Raw Material Category Validation
 */
export const updateRawMaterialCategorySchema = z.object({
  body: createRawMaterialCategorySchema
    .shape
    .body
    .partial(),

  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
  }),
});

/**
 * Raw Material Category ID Validation
 */
export const rawMaterialCategoryIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number").transform(Number),
  }),
});

export type CreateRawMaterialCategoryInput = z.infer<typeof createRawMaterialCategorySchema>["body"];
export type UpdateRawMaterialCategoryInput = z.infer<typeof updateRawMaterialCategorySchema>["body"];
