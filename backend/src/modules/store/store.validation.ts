import { z } from "zod";

/**
 * Create Store Validation
 */
export const createStoreSchema = z.object({
  body: z.object({
    storeId: z
      .string()
      .min(1, "Store ID is required")
      .max(20, "Store ID cannot exceed 20 characters"),

    storeName: z
      .string()
      .min(1, "Store Name is required")
      .max(50, "Store Name cannot exceed 50 characters"),

    storeTypeId: z.coerce.number().optional().nullable(),

    locationId: z
      .string()
      .max(20, "Location ID cannot exceed 20 characters")
      .optional()
      .nullable(),

    storeCode: z.string().max(20).optional().nullable(),
    locationDesc: z.string().max(120).optional().nullable(),
    inchargeId: z.union([z.string(), z.number(), z.bigint()]).optional().nullable(),
    allowNegative: z.boolean().optional(),
    costMethod: z.string().max(10).optional(),
    gstPlace: z.string().max(50).optional().nullable(),
    status: z.string().max(20).optional(),

    isActive: z
      .boolean()
      .optional(),
  }),
});

/**
 * Update Store Validation
 */
export const updateStoreSchema = z.object({
  body: createStoreSchema
    .shape
    .body
    .omit({ storeId: true })
    .partial(),

  params: z.object({
    storeId: z
      .string()
      .min(1, "Store ID is required")
      .max(20),
  }),
});

/**
 * Store ID Validation
 */
export const storeIdSchema = z.object({
  params: z.object({
    storeId: z
      .string()
      .min(1, "Store ID is required")
      .max(20),
  }),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>["body"];
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>["body"];
