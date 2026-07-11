import { z } from "zod";

export const createExpenseSchema = z.object({
  body: z.object({
    expenseNumber: z.string().min(1, "Expense number is required").max(30),
    expenseCategory: z.string().min(1, "Expense category is required").max(60),
    date: z.preprocess((val) => new Date(val as string), z.date()),
    expense: z.string().min(1, "Expense name is required").max(120),
    amount: z.union([z.number(), z.string()]).transform((val) => Number(val)),
    description: z.string().optional().nullable(),
    paymentMethod: z.string().min(1, "Payment method is required").max(50),
    status: z.string().optional().default("Draft"),
    notes: z.string().optional().nullable(),
    receiptInvoice: z.string().optional().nullable(),
    supplierId: z.union([z.number(), z.string()]).optional().nullable().transform((val) => val ? Number(val) : null),
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
  }),
});

export const expenseIdRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid expense ID format"),
  }),
});
