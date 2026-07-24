import { z } from "zod";

export const businessPlaceSchema = z.object({
  id: z.string().or(z.number()).optional().nullable(),
  code: z.string().min(1, "Code is required").max(20),
  name: z.string().min(1, "Name is required").max(120),
  type: z.enum(["HEAD_OFFICE", "BRANCH_OFFICE", "FACTORY", "WAREHOUSE", "RETAIL_STORE"]),
  gstPlaceCode: z.string().max(2).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email("Invalid email format").max(120).or(z.literal("")).optional().nullable(),
  isHeadOffice: z.boolean().default(false),
  isActive: z.boolean().default(true),
  address: z.any().optional().nullable(),
});
export const updateCompanySchema = z.object({
  companyCode: z.string().max(20).optional().nullable(),
  legalName: z.string().max(160).optional().nullable(),
  companyName: z.string().max(160).optional().nullable(), // keep for backwards compatibility if needed
  shortName: z.string().max(60).optional().nullable(),
  gstin: z.string().max(15).optional().nullable(),
  currencyCode: z.string().max(3).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  mobile: z.any().optional().nullable(),
  email: z.string().email("Invalid email format").max(120).or(z.literal("")).optional().nullable(),
  website: z.string().url("Invalid URL format").max(200).or(z.literal("")).optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  faviconUrl: z.string().optional().nullable(),
  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zipcode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  isActive: z.boolean().optional().nullable(),

  businessPlaces: z.array(businessPlaceSchema).optional(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
