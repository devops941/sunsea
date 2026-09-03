import { z } from "zod";

export const createCustomerSchema = z.object({
  // companyId and createdBy are NOT accepted from the client —
  // both are injected server-side from the authenticated user (req.user)

  customerCode: z.string().min(1, "Customer Code is required"),

  firmName: z.string().min(1, "Firm Name is required"),

  displayName: z.string().optional(),

  customerTypeId: z.number().nullable().optional(),
  customerGradeId: z.number().nullable().optional(),

  mobile: z.any().optional().nullable(),


  phones: z.any().optional().nullable(),

  // accepts "", undefined, or a valid email — only rejects a malformed non-empty string
  email: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email("Invalid email").optional()
  ),

  gstin: z.string().optional(),
  //pan: z.string().optional(),




  creditLimit: z.number().optional(),
  creditDays: z.number().nullable().optional(),

  transports: z.array(z.object({
    name: z.string().min(1),
    address: z.string().optional().default(""),
    phone: z.string().optional().default(""),
  })).nullable().optional(),

  // Opening balance — set once at creation, never editable
  openingBalance: z.number().min(0, "Opening balance cannot be negative").optional().default(0),
  openingBalanceType: z.enum(["DEBIT", "CREDIT"]).optional().default("DEBIT"),



  addresses: z
    .array(
      z.object({
        addressLine1: z.string().min(1, "Address Line 1 is required"),
        addressLine2: z.string().optional(),
        city: z.string().min(1, "City is required"),
        state: z.string().min(1, "State is required"),
        pincode: z.string().min(6, "Pincode is required"),
        _label: z.string().optional(),
      })
    )
    .optional(),

  status: z
    .enum(["Active", "OnHold", "Blocked", "Lead", "Inactive"])
    .optional(),


});

// openingBalance is intentionally excluded from updates — it is immutable after creation
export const updateCustomerSchema = createCustomerSchema.omit({ openingBalance: true }).partial();

export const createCustomerRequestSchema = z.object({
  body: createCustomerSchema,
});

export const updateCustomerRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid("Customer ID must be a valid UUID"),
  }),
  body: updateCustomerSchema,
});

export const customerIdRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid("Customer ID must be a valid UUID"),
  }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;