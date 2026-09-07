import { z } from "zod";
import { VoucherType } from "@prisma/client";

export const createVoucherItemSchema = z.object({
  debitLedgerId: z.number().int().optional().nullable(),
  creditLedgerId: z.number().int().optional().nullable(),
  debitAmount: z.number().min(0).default(0),
  creditAmount: z.number().min(0).default(0),
  narration: z.string().max(255).optional(),
});

export const createVoucherSchema = z.object({
  voucherNo: z.string().max(30).optional(),
  type: z.nativeEnum(VoucherType),
  date: z.string().optional(),
  narration: z.string().max(500).optional(),
  refDocType: z.string().max(30).optional(),
  refDocId: z.string().max(36).optional(),
  items: z.array(createVoucherItemSchema).min(1, "At least one journal line item is required"),
});

export const getVouchersQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().regex(/^\d+$/).optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  type: z.nativeEnum(VoucherType).optional(),
  supplierId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

// Update payload — same shape as create but everything (except items) is
// optional. Items, when supplied, fully REPLACE the existing journal items
// (delete-then-recreate inside a transaction) because journal items don't
// have a natural business identity we can diff on.
export const updateVoucherSchema = z.object({
  date: z.string().optional(),
  narration: z.string().max(500).optional().nullable(),
  items: z.array(createVoucherItemSchema).min(1).optional(),
});

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>;
export type UpdateVoucherInput = z.infer<typeof updateVoucherSchema>;
export type GetVouchersQueryInput = z.infer<typeof getVouchersQuerySchema>;
