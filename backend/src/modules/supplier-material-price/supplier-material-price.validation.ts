import { z } from "zod";

export const getCurrentPricesSchema = z.object({
  query: z.object({
    supplierId: z.string().regex(/^\d+$/, "Supplier ID must be a valid integer"),
  }),
});

export const getPriceHistorySchema = z.object({
  query: z.object({
    supplierId: z.string().regex(/^\d+$/, "Supplier ID must be a valid integer"),
    rawMaterialId: z.string().min(1, "Raw Material ID is required"),
  }),
});

export const createPriceSchema = z.object({
  body: z.object({
    supplierId: z.union([z.number(), z.string().regex(/^\d+$/)]),
    rawMaterialId: z.string().min(1, "Raw Material ID is required"),
    price: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/)]),
    validFrom: z.string().min(1, "Valid from date is required"),
  }),
});

export const revisePriceSchema = z.object({
  body: z.object({
    supplierId: z.union([z.number(), z.string().regex(/^\d+$/)]),
    rawMaterialId: z.string().min(1, "Raw Material ID is required"),
    price: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/)]),
    validFrom: z.string().min(1, "Valid from date is required"),
  }),
});

export const deletePriceSchema = z.object({
  params: z.object({
    priceRowId: z.string().uuid("Price Row ID must be a valid UUID"),
  }),
});

export type GetCurrentPricesQuery = z.infer<typeof getCurrentPricesSchema>["query"];
export type GetPriceHistoryQuery = z.infer<typeof getPriceHistorySchema>["query"];
export type CreatePriceInput = z.infer<typeof createPriceSchema>["body"];
export type RevisePriceInput = z.infer<typeof revisePriceSchema>["body"];
