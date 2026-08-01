import { z } from "zod";

export const salesReturnItemSchema = z.object({
  productId: z.number().int(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  reason: z.string().optional(),
});

export const createSalesReturnSchema = z.object({
  customerId: z.string().uuid(),
  salesInvoiceId: z.string().uuid().optional().nullable(),
  reason: z.string().max(255).optional(),
  narration: z.string().max(500).optional(),
  companyId: z.string().uuid(),
  items: z.array(salesReturnItemSchema).min(1, "At least one item is required"),
});

export const purchaseReturnItemSchema = z.object({
  rawMaterialId: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  reason: z.string().optional(),
});

export const createPurchaseReturnSchema = z.object({
  supplierId: z.number().int(),
  grnInvoiceId: z.string().uuid().optional().nullable(),
  reason: z.string().max(255).optional(),
  narration: z.string().max(500).optional(),
  companyId: z.string().uuid(),
  items: z.array(purchaseReturnItemSchema).min(1, "At least one item is required"),
});

export type CreateSalesReturnInput = z.infer<typeof createSalesReturnSchema>;
export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;
