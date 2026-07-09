import { z } from "zod";

/**
 * Create Size Validation
 */
export const createSizeSchema =
  z.object({
    body: z.object({
      sizeCode: z
        .string()
        .min(
          1,
          "Size code is required"
        )
        .max(
          20,
          "Size code must be less than 20 characters"
        ),

      sizeName: z
        .string()
        .min(
          1,
          "Size name is required"
        )
        .max(
          100,
          "Size name must be less than 100 characters"
        ),

      description: z
        .string()
        .optional(),

      isActive: z
        .boolean()
        .optional(),
    }),
  });

/**
 * Update Size Validation
 */
export const updateSizeSchema =
  z.object({
    body: z.object({
      sizeCode: z
        .string()
        .max(20)
        .optional(),

      sizeName: z
        .string()
        .max(100)
        .optional(),

      description: z
        .string()
        .optional(),

      isActive: z
        .boolean()
        .optional(),
    }),

    params: z.object({
      id: z
        .string()
        .regex(
          /^\d+$/,
          "Invalid size id"
        ),
    }),
  });

/**
 * Size Id Validation
 */
export const sizeIdSchema =
  z.object({
    params: z.object({
      id: z
        .string()
        .regex(
          /^\d+$/,
          "Invalid size id"
        ),
    }),
  });

/**
 * Types
 */
export type CreateSizeInput =
  z.infer<
    typeof createSizeSchema
  >["body"];

export type UpdateSizeInput =
  z.infer<
    typeof updateSizeSchema
  >["body"];