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
    vendorType: z.enum(["Manufacturer", "Trader", "Service", "Logistics"]),
    category: z.string().max(255),
    rawMaterialCategories: z.string().max(255).optional().nullable(),
    contactPerson: z.string().max(80).optional().nullable(),
    designation: z.string().max(60).optional().nullable(),
    mobile: z.any().optional().nullable(),
    phones: z.any().optional().nullable(),
    altPhone: z.string().max(15).optional().nullable(),
    whatsapp: z.string().max(15).optional(),
    email: z.string().email("Invalid email address").max(120).optional().nullable().or(z.literal("")),
    website: z.string().max(200).optional().nullable(),
    // BUG-SUP-007 fix: GSTIN format validation (15-char pattern)
    gstin: z
      .string()
      .regex(
        /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/,
        "Invalid GSTIN format (e.g. 33ABCDE1234F1Z5)"
      )
      .optional()
      .nullable()
      .or(z.literal("")),
    // BUG-SUP-008 fix: PAN format validation (10-char pattern)
    pan: z
      .string()
      .regex(
        /^[A-Z]{5}\d{4}[A-Z]$/,
        "Invalid PAN format (e.g. ABCDE1234F)"
      )
      .optional()
      .nullable()
      .or(z.literal("")),
    gstRegType: z.string().max(20).optional().nullable(),
    msmeStatus: z.enum(["Micro", "Small", "Medium", "None"]).optional().nullable(),
    udyamNo: z.string().max(20).optional().nullable(),
    tdsSection: z.string().max(10).optional().nullable(),
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
    paymentTerms: z.enum(["Advance", "Net15", "Net30", "Net45", "Net60"]),
    leadTimeDays: z.number().int().min(0, "Lead time cannot be negative"),
    minOrderQty: z.number().optional().nullable(),
    currency: z.string().length(3).default("INR"),
    bankIfsc: z.string().max(11).optional().nullable(),
    bankAccount: z
      .array(
        z.object({
          bankHolderName: z.string().min(1, "Account Holder Name is required"),
          bankName: z.string().min(1, "Bank Name is required"),
          accountNumber: z.string().min(9).max(18),
          ifscCode: z.string().min(11).max(11),
          branchName: z.string().min(1, "Branch Name is required"),
          upiMobileNumber: z.string().optional(),
          qrImage: z.string().optional().nullable(),
        })
      )
      .optional()
      .nullable(),
    bankHolder: z.string().max(80).optional().nullable(),
    upiId: z.string().max(50).optional().nullable(),
    status: z.enum(["Active", "Backup", "Inactive", "Blacklisted"]).default("Active"),
    // Opening balance — set once at creation, never editable
    openingBalance: z.number().min(0, "Opening balance cannot be negative").optional().default(0),
    openingBalanceType: z.enum(["CREDIT", "DEBIT"]).optional().default("CREDIT"),
    addresses: z.array(supplierAddressInputSchema).optional(),
    materialPrices: z
      .array(
        z.object({
          rawMaterialId: z.string(),
          price: z.number(),
          validFrom: z.string(),
          validTo: z.string().optional().nullable(),
        })
      )
      .optional(),
  }),
});

/**
 * Update Supplier Validation
 */
export const updateSupplierSchema = z.object({
  // openingBalance is intentionally excluded from updates — it is immutable after creation
  body: createSupplierSchema.shape.body.omit({ openingBalance: true }).partial(),
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