import { z } from "zod";

/**
 * Create Raw Material Validation
 */
export const createRawMaterialSchema = z.object({
  body: z.object({
    rawMaterialId: z
      .string()
      .min(1, "Raw Material ID is required")
      .max(20, "Raw Material ID cannot exceed 20 characters"),

    materialName: z
      .string()
      .min(1, "Material Name is required")
      .max(100, "Material Name cannot exceed 100 characters"),

    categoryId: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .nullable(),

    hsnCode: z
      .string()
      .max(20, "HSN Code cannot exceed 20 characters")
      .optional()
      .nullable(),

    minimumStock: z
      .number()
      .nonnegative()
      .optional()
      .nullable(),

    leadTimeDays: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .nullable(),

    baseUom: z
      .string()
      .min(1, "Base UOM is required")
      .max(10, "Base UOM cannot exceed 10 characters"),

    reorderLevel: z
      .number()
      .nonnegative()
      .optional()
      .nullable(),

    unitPrice: z
      .number()
      .nonnegative()
      .optional()
      .nullable(),

    isActive: z
      .boolean()
      .optional(),

    storeId: z
      .string()
      .min(1, "Store ID is required")
      .max(20, "Store ID cannot exceed 20 characters"),
    locationId: z
      .string()
      .max(36, "Location ID cannot exceed 36 characters")
      .optional()
      .nullable(),

    batchNo: z
      .string()
      .max(40, "Batch No cannot exceed 40 characters")
      .optional()
      .nullable(),

    onHandQty: z
      .number()
      .nonnegative("On Hand Quantity cannot be negative")
      .default(0)
      .optional(),

    reservedQty: z
      .number()
      .nonnegative("Reserved Quantity cannot be negative")
      .default(0)
      .optional(),

    avgCost: z
      .number()
      .nonnegative("Average Cost cannot be negative")
      .default(0)
      .optional(),

    remarks: z
      .string()
      .max(255, "Remarks cannot exceed 255 characters")
      .optional()
      .nullable(),

    lastMovementAt: z
      .string()
      .datetime()
      .optional()
      .nullable(),

    status: z
      .string()
      .max(20, "Status cannot exceed 20 characters")
      .optional(),
  }),
});

/**
 * Update Raw Material Validation
 */
export const updateRawMaterialSchema = z.object({
  body: createRawMaterialSchema
    .shape
    .body
    .omit({ rawMaterialId: true })
    .partial(),

  params: z.object({
    rawMaterialId: z
      .string()
      .min(1, "Raw Material ID is required")
      .max(20),
  }),
});

/**
 * Raw Material ID Validation
 */
export const rawMaterialIdSchema = z.object({
  params: z.object({
    rawMaterialId: z
      .string()
      .min(1, "Raw Material ID is required")
      .max(20),
  }),
});

export type CreateRawMaterialInput = z.infer<typeof createRawMaterialSchema>["body"];
export type UpdateRawMaterialInput = z.infer<typeof updateRawMaterialSchema>["body"];
