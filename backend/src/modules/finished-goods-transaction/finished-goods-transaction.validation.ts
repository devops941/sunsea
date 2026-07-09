import { z } from "zod";

/**
 * Create Finished Goods Transaction Validation
 */
export const createFinishedGoodsTransactionSchema = z.object({
  body: z.object({
    txnDateTime: z
      .string()
      .datetime({ message: "Invalid ISO datetime string" })
      .or(z.date()),

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

    productionOrderId: z
      .string()
      .max(20)
      .optional()
      .nullable(),

    deliveryChallanId: z
      .string()
      .max(20)
      .optional()
      .nullable(),

    invoiceId: z
      .string()
      .max(20)
      .optional()
      .nullable(),

    relatedDocNo: z
      .string()
      .max(30)
      .optional()
      .nullable(),

    remarks: z
      .string()
      .max(255)
      .optional()
      .nullable(),
  }),
});

/**
 * Update Finished Goods Transaction Validation
 */
export const updateFinishedGoodsTransactionSchema = z.object({
  body: createFinishedGoodsTransactionSchema
    .shape
    .body
    .partial(),

  params: z.object({
    fgTxnId: z
      .string()
      .regex(/^\d+$/, "Transaction ID must be a numeric string"),
  }),
});

/**
 * Finished Goods Transaction ID Validation
 */
export const finishedGoodsTransactionIdSchema = z.object({
  params: z.object({
    fgTxnId: z
      .string()
      .regex(/^\d+$/, "Transaction ID must be a numeric string"),
  }),
});

export type CreateFinishedGoodsTransactionInput = z.infer<typeof createFinishedGoodsTransactionSchema>["body"];
export type UpdateFinishedGoodsTransactionInput = z.infer<typeof updateFinishedGoodsTransactionSchema>["body"];
