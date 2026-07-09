import { z } from "zod";

/**
 * Create Raw Material Stock Validation
 */
export const createRawMaterialStockSchema = z.object({
  body: z.object({
    storeId: z
      .string()
      .min(1, "Store ID is required")
      .max(20),

    rawMaterialId: z
      .string()
      .min(1, "Raw Material ID is required")
      .max(20),

    locationId: z.string().optional().nullable(),
    batchNo: z.string().max(40, "Batch No cannot exceed 40 characters").optional().nullable(),

    onHandQty: z
      .number()
      .nonnegative("On Hand Qty cannot be negative")
      .default(0),

    reservedQty: z
      .number()
      .nonnegative("Reserved Qty cannot be negative")
      .default(0),

    avgCost: z
      .number()
      .nonnegative("Avg Cost cannot be negative")
      .default(0),

    status: z.string().max(20).optional().default("Active"),
    remarks: z.string().max(255).optional().nullable(),
  }),
});

/**
 * Update Raw Material Stock Validation
 */
export const updateRawMaterialStockSchema = z.object({
  body: z.object({
    onHandQty: z
      .number()
      .nonnegative("On Hand Qty cannot be negative")
      .optional(),

    reservedQty: z
      .number()
      .nonnegative("Reserved Qty cannot be negative")
      .optional(),

    avgCost: z
      .number()
      .nonnegative("Avg Cost cannot be negative")
      .optional(),

    locationId: z.string().optional().nullable(),
    batchNo: z.string().max(40, "Batch No cannot exceed 40 characters").optional().nullable(),
    status: z.string().max(20).optional(),
    remarks: z.string().max(255).optional().nullable(),
  }),

  params: z.object({
    id: z.string().min(1, "Invalid Raw Material Stock ID"),
  }),
});

/**
 * Raw Material Stock Composite Key ID Validation
 */
export const rawMaterialStockIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Invalid Raw Material Stock ID"),
  }),
});

export type CreateRawMaterialStockInput = z.infer<typeof createRawMaterialStockSchema>["body"];
export type UpdateRawMaterialStockInput = z.infer<typeof updateRawMaterialStockSchema>["body"];
