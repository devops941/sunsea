import { z } from "zod";

const ItemSchema = z.object({
  productId: z.union([z.string(), z.number()]).refine(val => !isNaN(Number(val)), "Product ID must be a valid number"),
  qty: z.coerce.number().min(0.001, "Qty must be > 0"),
  rate: z.coerce.number().min(0, "Rate must be ≥ 0"),
  discountAmount: z.coerce.number().min(0).optional().default(0),
  taxPercent: z.coerce.number().min(0).max(100).optional().default(0),
  amount: z.coerce.number().min(0).optional(),
  taxAmount: z.coerce.number().min(0).optional(),
  total: z.coerce.number().min(0).optional(),
});

const PaymentSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  referenceNumber: z.string().optional().nullable(),
  paymentDate: z.string().refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime()) && d <= new Date(new Date().setHours(23, 59, 59, 999));
  }, "Payment date must be a valid date and not in the future"),
});

export const CreateSalesInvoiceSchema = z.object({
  invoiceNo: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  dueDate: z.preprocess(
    (val) => (val === "" || val === "null" || val === "undefined" ? null : val),
    z.string().optional().nullable()
  ),
  customerId: z.string().uuid("Invalid Customer ID"),
  notes: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
  salesOrderId: z.preprocess(
    (val) => (val === "" || val === "null" || val === "undefined" ? null : val),
    z.coerce.number().optional().nullable()
  ),
  payments: z.array(PaymentSchema).optional().default([]),
  items: z.array(ItemSchema).min(1, "At least one item is required"),
  status: z.string().optional(),
  narration: z.string().optional().nullable(),
  subTotal: z.coerce.number().optional(),
  discountType: z.string().optional().nullable(),
  discountValue: z.coerce.number().optional().default(0),
  totalDiscount: z.coerce.number().optional().default(0),
  taxTotal: z.coerce.number().optional(),
  grandTotal: z.coerce.number().optional(),
});

export const UpdateSalesInvoiceSchema = CreateSalesInvoiceSchema.partial();

export const SalesInvoiceIdSchema = z.object({
  id: z.string().uuid("Invalid Sales Invoice ID"),
});

// Request-level schemas
export const createSalesInvoiceRequestSchema = z.object({
  body: CreateSalesInvoiceSchema,
});

export const updateSalesInvoiceRequestSchema = z.object({
  params: SalesInvoiceIdSchema,
  body: UpdateSalesInvoiceSchema,
});

export const salesInvoiceIdRequestSchema = z.object({
  params: SalesInvoiceIdSchema,
});

export type CreateSalesInvoiceInput = z.infer<typeof CreateSalesInvoiceSchema>;
export type UpdateSalesInvoiceInput = z.infer<typeof UpdateSalesInvoiceSchema>;
