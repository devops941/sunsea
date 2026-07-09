import { z } from "zod";

/**
 * Create Product Pricing
 */
export const createProductPricingSchema =
  z.object({
    body: z.object({
      productId: z
        .string()
        .regex(
          /^\d+$/,
          "Invalid Product Id"
        ),

      hsnCode: z
        .string()
        .optional(),

      gstRate: z
        .number()
        .nonnegative()
        .optional(),

      cess: z
        .number()
        .nonnegative()
        .optional(),

      unitPrice: z
        .number()
        .nonnegative()
        .optional(),

      mrp: z
        .number()
        .nonnegative()
        .optional(),

      minSalePrice: z
        .number()
        .nonnegative()
        .optional(),

      distributorPrice: z
        .number()
        .nonnegative()
        .optional(),

      wholesalePrice: z
        .number()
        .nonnegative()
        .optional(),

      directPrice: z
        .number()
        .nonnegative()
        .optional(),
    }),
  });

/**
 * Update Product Pricing
 */
export const updateProductPricingSchema =
  z.object({
    body: z.object({
      hsnCode: z
        .string()
        .optional(),

      gstRate: z
        .number()
        .nonnegative()
        .optional(),

      cess: z
        .number()
        .nonnegative()
        .optional(),

      unitPrice: z
        .number()
        .nonnegative()
        .optional(),

      mrp: z
        .number()
        .nonnegative()
        .optional(),

      minSalePrice: z
        .number()
        .nonnegative()
        .optional(),

      distributorPrice: z
        .number()
        .nonnegative()
        .optional(),

      wholesalePrice: z
        .number()
        .nonnegative()
        .optional(),

      directPrice: z
        .number()
        .nonnegative()
        .optional(),
    }),

    params: z.object({
      id: z
        .string()
        .regex(
          /^\d+$/,
          "Invalid Product Pricing Id"
        ),
    }),
  });

/**
 * Product Pricing Id Validation
 */
export const productPricingIdSchema =
  z.object({
    params: z.object({
      id: z
        .string()
        .regex(
          /^\d+$/,
          "Invalid Product Pricing Id"
        ),
    }),
  });

/**
 * Types
 */
export type CreateProductPricingInput =
  z.infer<
    typeof createProductPricingSchema
  >["body"];

export type UpdateProductPricingInput =
  z.infer<
    typeof updateProductPricingSchema
  >["body"];