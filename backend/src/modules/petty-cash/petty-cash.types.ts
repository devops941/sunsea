import { z } from "zod";

export const createPettyCashSchema = z.object({
  entryDate: z.string().optional(),
  // Category is now optional — the picked ledger's own name is what an
  // operator sees in the ledger; keeping the column so existing rows /
  // reports don't break, but the frontend no longer collects it.
  category: z.string().max(80).optional().nullable(),
  description: z.string().min(1, "Description is required").max(255),
  amount: z.number().positive("Amount must be greater than zero"),
  type: z.enum(["IN", "OUT"]),
  paidTo: z.string().max(120).optional().nullable(),
  receiptNo: z.string().max(40).optional().nullable(),
  companyId: z.string().uuid("Valid company ID is required"),
  /** Ledger the operator picks as the counter-side of the double-entry:
   *  OUT → expense ledger (debited);  IN → cash/bank source (credited). */
  accountLedgerId: z.number().int().positive().optional().nullable(),
});

export const getPettyCashQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(["IN", "OUT"]).optional(),
  category: z.string().optional(),
  companyId: z.string().optional(),
});

export type CreatePettyCashInput = z.infer<typeof createPettyCashSchema>;
export type GetPettyCashQueryInput = z.infer<typeof getPettyCashQuerySchema>;
