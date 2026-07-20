import { z } from "zod";

export const createCustomerSchema = z.object({
  // companyId and createdBy are NOT accepted from the client —
  // both are injected server-side from the authenticated user (req.user)

  customerCode: z.string().min(1, "Customer Code is required"),

  firmName: z.string().min(1, "Firm Name is required"),

  displayName: z.string().optional(),

  customerType: z
    .array(z.enum(["B2B", "B2C", "Export"]))
    .min(1, "At least one customer type is required"),

  contactPerson: z.string().optional(),
  designation: z.string().optional(),

  mobile: z.string().min(10, "Mobile number is required"),

  altPhone: z.string().optional(),
  whatsapp: z.string().optional(),

  // accepts "", undefined, or a valid email — only rejects a malformed non-empty string
  email: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().email("Invalid email").optional()
  ),

  gstin: z.string().optional(),
  //pan: z.string().optional(),

  gstRegType: z.string().optional(),

  tdsSection: z.string().optional(),
  tcsRate: z.number().optional(),

  billingAddressLine1: z.string().min(1, "Billing Address is required"),
  billingCity: z.string().min(1, "City is required"),
  billingState: z.string().min(1, "State is required"),
  billingPincode: z.string().min(6, "Pincode is required"),
  billingCountry: z.string().optional().nullable(),

  shippingAddressLine1: z.string().optional().nullable(),
  shippingCity: z.string().optional().nullable(),
  shippingState: z.string().optional().nullable(),
  shippingPincode: z.string().optional().nullable(),
  shippingCountry: z.string().optional().nullable(),

  // BUG-CUST-005 fix: added user-friendly error message to stateCode length validation
  stateCode: z.string().length(2, "State code must be exactly 2 digits (e.g. 33 for Tamil Nadu)"),

  creditLimit: z.number().optional(),
  creditDays: z.number().optional(),
  priceList: z.string().optional(),

  collectionAgentId: z.coerce.bigint().nullable().optional(),

  routeId: z.string().uuid().nullable().optional(),

  bankAccount: z
    .array(
      z.object({
        bankHolderName: z.string().min(1, "Account Holder Name is required"),
        bankName: z.string().min(1, "Bank Name is required"),
        accountNumber: z.string().min(9).max(18),
        ifscCode: z.string().min(11).max(11),
        branchName: z.string().min(1, "Branch Name is required"),
        upiMobileNumber: z.string().optional(),
      })
    )
    .optional(),

  addresses: z
    .array(
      z.object({
        addressLine1: z.string().min(1, "Address Line 1 is required"),
        addressLine2: z.string().optional(),
        city: z.string().min(1, "City is required"),
        state: z.string().min(1, "State is required"),
        pincode: z.string().min(6, "Pincode is required"),
      })
    )
    .optional(),


  status: z
    .enum(["Active", "OnHold", "Blocked", "Lead", "Inactive"])
    .optional(),

  aiRiskScore: z.number().optional(),
  aiRiskBand: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

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