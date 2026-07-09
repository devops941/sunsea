import { z } from "zod";

/**
 * Create Sub Category Validation
 */
export const createSubCategorySchema =
  z.object({
    body: z.object({
      subCategoryCode: z
        .string()
        .min(
          2,
          "Sub Category Code is required"
        )
        .max(
          20,
          "Sub Category Code must be less than 20 characters"
        ),

      subCategoryName: z
        .string()
        .min(
          2,
          "Sub Category Name is required"
        )
        .max(
          100,
          "Sub Category Name must be less than 100 characters"
        ),

      description: z
        .string()
        .optional(),

      categoryId: z
        .string()
        .regex(
          /^\d+$/,
          "Invalid Category Id"
        ),

      isActive: z
        .boolean()
        .optional(),
    }),
  });

/**
 * Update Sub Category Validation
 */
export const updateSubCategorySchema =
  z.object({
    body: z.object({
      subCategoryCode: z
        .string()
        .max(20)
        .optional(),

      subCategoryName: z
        .string()
        .max(100)
        .optional(),

      description: z
        .string()
        .optional(),

      categoryId: z
        .string()
        .regex(
          /^\d+$/,
          "Invalid Category Id"
        )
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
          "Invalid Sub Category Id"
        ),
    }),
  });

/**
 * Sub Category Id Validation
 */
export const subCategoryIdSchema =
  z.object({
    params: z.object({
      id: z
        .string()
        .regex(
          /^\d+$/,
          "Invalid Sub Category Id"
        ),
    }),
  });

/**
 * Types
 */
export type CreateSubCategoryInput =
  z.infer<
    typeof createSubCategorySchema
  >["body"];

export type UpdateSubCategoryInput =
  z.infer<
    typeof updateSubCategorySchema
  >["body"];