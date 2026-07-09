import { z } from "zod";

/**
 * Create Product Image
 */
export const createProductImageSchema =
  z.object({
    body: z.object({
      productId: z
        .string()
        .regex(
          /^\d+$/,
          "Invalid Product Id"
        ),

      imageUrl: z
        .string()
        .min(
          1,
          "Image URL is required"
        ),

      isPrimary: z
        .boolean()
        .optional(),
    }),
  });

/**
 * Update Product Image
 */
export const updateProductImageSchema =
  z.object({
    body: z.object({
      imageUrl: z
        .string()
        .optional(),

      isPrimary: z
        .boolean()
        .optional(),
    }),

    params: z.object({
      id: z
        .string()
        .regex(
          /^\d+$/,
          "Invalid Product Image Id"
        ),
    }),
  });

/**
 * Product Image Id
 */
export const productImageIdSchema =
  z.object({
    params: z.object({
      id: z
        .string()
        .regex(
          /^\d+$/,
          "Invalid Product Image Id"
        ),
    }),
  });

/**
 * Types
 */
export type CreateProductImageInput =
  z.infer<
    typeof createProductImageSchema
  >["body"];

export type UpdateProductImageInput =
  z.infer<
    typeof updateProductImageSchema
  >["body"];