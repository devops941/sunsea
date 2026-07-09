import { z } from "zod";

/**
 * Create Raw Material Transaction Validation
 */
export const createRawMaterialTransactionSchema = z.object({
  body: z.object({
    storeId: z
      .string()
      .min(1, "Store ID is required")
      .max(20),

    rawMaterialId: z
      .string()
      .min(1, "Raw Material ID is required")
      .max(20),

    txnType: z
      .string()
      .min(1, "Transaction Type is required")
      .max(30),

    qty: z
      .number()
      .refine(
        (val) => val !== 0,
        "Quantity cannot be zero"
      ),

    txnDateTime: z
      .string()
      .datetime({ message: "Invalid ISO datetime string" })
      .optional()
      .or(z.date()),

    remarks: z
      .string()
      .max(255)
      .optional()
      .nullable(),
  }),
});

/**
 * Update Raw Material Transaction Validation
 */
export const updateRawMaterialTransactionSchema = z.object({
  body: createRawMaterialTransactionSchema
    .shape
    .body
    .partial(),

  params: z.object({
    rmTxnId: z
      .string()
      .regex(/^\d+$/, "Transaction ID must be a numeric string"),
  }),
});

/**
 * Raw Material Transaction ID Validation
 */
export const rawMaterialTransactionIdSchema = z.object({
  params: z.object({
    rmTxnId: z
      .string()
      .regex(/^\d+$/, "Transaction ID must be a numeric string"),
  }),
});

export type CreateRawMaterialTransactionInput = z.infer<typeof createRawMaterialTransactionSchema>["body"];
export type UpdateRawMaterialTransactionInput = z.infer<typeof updateRawMaterialTransactionSchema>["body"];
