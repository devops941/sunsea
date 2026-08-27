import { z } from "zod";
import { LedgerType, VoucherType } from "@prisma/client";

export const createLedgerSchema = z.object({
  code: z.string().min(1, "Ledger code is required").max(20),
  name: z.string().min(1, "Ledger name is required").max(160),
  type: z.nativeEnum(LedgerType),
  group: z.string().min(1, "Ledger group is required").max(80),
  isActive: z.boolean().optional().default(true),
  customerId: z.string().uuid().optional().nullable(),
  supplierId: z.number().int().optional().nullable(),
  openingBalance: z.number().optional().default(0),
  openingBalanceType: z.enum(["DEBIT", "CREDIT"]).optional().default("DEBIT"),
});

export const updateLedgerSchema = createLedgerSchema.partial();

export const getLedgersQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().regex(/^\d+$/).optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  type: z.nativeEnum(LedgerType).optional(),
  group: z.string().optional(),
  grouped: z.string().optional().transform((val) => val === "true"),
});

export const ledgerStatementQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

export type CreateLedgerInput = z.infer<typeof createLedgerSchema>;
export type UpdateLedgerInput = z.infer<typeof updateLedgerSchema>;
export type GetLedgersQueryInput = z.infer<typeof getLedgersQuerySchema>;
