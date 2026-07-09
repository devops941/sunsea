import { z } from "zod";

/**
 * Create Finished Goods Stock Validation
 */
export const createFinishedGoodsStockSchema = z.object({
  body: z.object({
    storeId: z
      .string()
      .min(1, "Store ID is required")
      .max(20),

    productItemId: z
      .union([z.string(), z.number()])
      .refine(
        (val) => !isNaN(Number(val)),
        "Product Item ID must be a valid number or numeric string"
      ),

    onHandQty: z
      .number()
      .nonnegative("On Hand Qty cannot be negative")
      .default(0),
  }),
});

/**
 * Update Finished Goods Stock Validation
 */
export const updateFinishedGoodsStockSchema = z.object({
  body: z.object({
    onHandQty: z
      .number()
      .nonnegative("On Hand Qty cannot be negative"),
  }),

  params: z.object({
    storeId: z
      .string()
      .min(1, "Store ID is required")
      .max(20),

    productItemId: z
      .string()
      .regex(/^\d+$/, "Product Item ID must be a numeric string"),
  }),
});

/**
 * Finished Goods Stock Composite Key ID Validation
 */
export const finishedGoodsStockIdSchema = z.object({
  params: z.object({
    storeId: z
      .string()
      .min(1, "Store ID is required")
      .max(20),

    productItemId: z
      .string()
      .regex(/^\d+$/, "Product Item ID must be a numeric string"),
  }),
});

export type CreateFinishedGoodsStockInput = z.infer<typeof createFinishedGoodsStockSchema>["body"];
export type UpdateFinishedGoodsStockInput = z.infer<typeof updateFinishedGoodsStockSchema>["body"];
