import { z } from "zod";

export const createPettyCashSchema = z.object({
  entryDate: z.string().optional(),
  category: z.string().min(1, "Category is required").max(80),
  description: z.string().min(1, "Description is required").max(255),
  amount: z.number().positive("Amount must be greater than zero"),
  type: z.enum(["IN", "OUT"]),
  paidTo: z.string().max(120).optional().nullable(),
  receiptNo: z.string().max(40).optional().nullable(),
  companyId: z.string().uuid("Valid company ID is required"),
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
