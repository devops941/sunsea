import { z } from "zod";

export const CategoryTypeEnum = z.enum(["PRODUCT", "RAW_MATERIAL", "WASTAGE"]);

export const createCategorySchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(1, "Category code is required")
      .max(20, "Code cannot exceed 20 characters"),

    name: z
      .string()
      .min(1, "Category name is required")
      .max(100, "Name cannot exceed 100 characters"),

    description: z.string().max(255).optional().nullable(),

    type: CategoryTypeEnum,

    isActive: z.boolean().optional(),
  }),
});

export const updateCategorySchema = z.object({
  body: createCategorySchema.shape.body
    .omit({ code: true })
    .partial(),

  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number"),
  }),
});

export const categoryIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number"),
  }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>["body"];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>["body"];
