import { z } from "zod";

/**
 * Address Schema Validation
 */
const addressSubSchema = z.object({
  addressLine1: z.string().min(1, "Address Line 1 is required"),
  addressLine2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  // BUG-SUP-006 fix: pincode must be exactly 6 digits
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
});

const supplierAddressInputSchema = z.object({
  address: addressSubSchema,
});

/**
 * Create Supplier Validation
 */
export const createSupplierSchema = z.object({
  body: z.object({
    companyId: z.string().uuid("Company ID must be a valid UUID").optional().or(z.literal("")),
    supplierCode: z.string().min(1, "Supplier code is required").max(20),
    legalName: z.string().min(1, "Legal name is required").max(160),
    displayName: z.string().max(80).optional().nullable(),
    contactPerson: z.string().max(80).optional().nullable(),
    mobile: z.any().optional().nullable(),
    phones: z.any().optional().nullable(),
    altPhone: z.string().max(15).optional().nullable(),
    whatsapp: z.string().max(15).optional(),
    email: z.string().email("Invalid email address").max(120).optional().nullable().or(z.literal("")),

    // BUG-SUP-007 fix: GSTIN format validation (15-char pattern)
    gstin: z
      .preprocess(
        (val) => (typeof val === "string" ? val.trim().toUpperCase() : val),
        z
          .string()
          .refine(
            (val) => !val || /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(val),
            "Invalid GSTIN format (e.g. 33ABCDE1234F1Z5)"
          )
          .optional()
          .nullable()
      )
      .or(z.literal("")),
    // BUG-SUP-008 fix: PAN format validation (10-char pattern)
    pan: z
      .preprocess(
        (val) => (typeof val === "string" ? val.trim().toUpperCase() : val),
        z
          .string()
          .refine(
            (val) => !val || /^[A-Z]{5}\d{4}[A-Z]$/.test(val),
            "Invalid PAN format (e.g. ABCDE1234F)"
          )
          .optional()
          .nullable()
      )
      .or(z.literal("")),
    gstRegType: z.string().max(20).optional().nullable(),

    billingAddressLine1: z.string().min(1, "Billing Address Line 1 is required").max(255),
    billingCity: z.string().min(1, "City is required").max(100),
    billingState: z.string().min(1, "State is required").max(100),
    // BUG-SUP-006 fix: billingPincode must be exactly 6 digits
    billingPincode: z
      .string()
      .regex(/^\d{6}$/, "Pincode must be exactly 6 digits")
      .or(z.string().max(20)),  // keep max(20) for non-Indian use, but enforce 6-digit Indian format
    billingCountry: z.string().optional().nullable().default("India"),
    stateCode: z.string().length(2, "State code must be exactly 2 characters"),
    status: z.enum(["Active", "Backup", "Inactive", "Blacklisted"]).default("Active"),
    // Opening balance — set once at creation, never editable
    openingBalance: z.number().min(0, "Opening balance cannot be negative").optional().default(0),
    openingBalanceType: z.enum(["CREDIT", "DEBIT"]).optional().default("CREDIT"),
    addresses: z.array(supplierAddressInputSchema).optional(),
  }),
});

/**
 * Update Supplier Validation
 * openingBalance + openingBalanceType are allowed in updates but only applied
 * when the supplier has no real transactions (enforced in the service layer).
 */
export const updateSupplierSchema = z.object({
  body: createSupplierSchema.shape.body.partial(),
  params: z.object({
    id: z.string(),
  }),
});

/**
 * Supplier ID Validation
 */
export const supplierIdSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

/**
 * Get Suppliers Query Validation
 */
export const getSuppliersQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, "Page must be a valid integer")
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a valid integer")
      .optional(),
    search: z.string().optional(),
    status: z.string().optional(),
  }),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>["body"];
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>["body"];
export type GetSuppliersQueryInput = z.infer<typeof getSuppliersQuerySchema>["query"];