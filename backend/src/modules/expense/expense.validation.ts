import { z } from "zod";

export const createExpenseSchema = z.object({
  body: z.object({
    // Optional — service auto-generates the next sequential EXP-N when the
    // client omits it. Removes the race condition where two rows saved in
    // the same batch fetched the same "next" number and collided on insert.
    expenseNumber: z.string().max(30).optional().nullable(),
    // Category optional too — Expense Add spreadsheet infers it from the
    // picked debit ledger's group (Direct/Indirect Expenses).
    expenseCategory: z.string().max(60).optional().nullable(),
    date: z.preprocess((val) => new Date(val as string), z.date()),
    expense: z.string().min(1, "Expense name is required").max(120),
    amount: z.union([z.number(), z.string()]).transform((val) => Number(val)),
    description: z.string().optional().nullable(),
    paymentMethod: z.string().max(50).optional().nullable(),
    status: z.string().optional().default("Draft"),
    notes: z.string().optional().nullable(),
    receiptInvoice: z.string().optional().nullable(),
    supplierId: z.union([z.number(), z.string()]).optional().nullable().transform((val) => val ? Number(val) : null),
    // Golden-Rule ledger picks — nullable so legacy clients / imports keep
    // working, but the posting engine prefers these when present.
    debitLedgerId: z.union([z.number(), z.string()]).optional().nullable().transform((val) => val ? Number(val) : null),
    creditLedgerId: z.union([z.number(), z.string()]).optional().nullable().transform((val) => val ? Number(val) : null),
  }),
});

export const updateExpenseSchema = z.object({
  body: z.object({
    expenseNumber: z.string().max(30).optional(),
    expenseCategory: z.string().max(60).optional(),
    date: z.preprocess((val) => val ? new Date(val as string) : undefined, z.date().optional()),
    expense: z.string().max(120).optional(),
    amount: z.union([z.number(), z.string()]).transform((val) => val ? Number(val) : undefined).optional(),
    description: z.string().optional().nullable(),
    paymentMethod: z.string().max(50).optional(),
    status: z.string().optional(),
    notes: z.string().optional().nullable(),
    receiptInvoice: z.string().optional().nullable(),
    supplierId: z.union([z.number(), z.string()]).optional().nullable().transform((val) => val ? Number(val) : null),
    debitLedgerId: z.union([z.number(), z.string()]).optional().nullable().transform((val) => val ? Number(val) : null),
    creditLedgerId: z.union([z.number(), z.string()]).optional().nullable().transform((val) => val ? Number(val) : null),
  }),
});

export const expenseIdRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid expense ID format"),
  }),
});
