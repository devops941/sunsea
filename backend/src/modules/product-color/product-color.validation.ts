import { z } from "zod";

/**
 * Create Product Color Validation
 */
export const createProductColorSchema = z.object({
  body: z.object({
    productId: z.union([
      z.number(),
      z.string().regex(/^\d+$/).transform((val) => Number(val)),
    ]),
    colorId: z.union([
      z.number(),
      z.string().regex(/^\d+$/).transform((val) => Number(val)),
    ]),
    isDefault: z.boolean().optional(),
  }),
});

/**
 * Update Product Color Validation
 */
export const updateProductColorSchema = z.object({
  body: createProductColorSchema.shape.body.partial(),
  params: z.object({
    id: z.string().regex(/^\d+$/, "Invalid product color id"),
  }),
});

/**
 * Product Color Id Validation
 */
export const productColorIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Invalid product color id"),
  }),
});

export type CreateProductColorInput = z.infer<
  typeof createProductColorSchema
>["body"];

export type UpdateProductColorInput = z.infer<
  typeof updateProductColorSchema
>["body"];