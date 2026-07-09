import { z } from "zod";

/**
 * Create GST Tax Validation
 */
export const createGstTaxSchema = z.object({
    body: z.object({
        taxName: z
            .string()
            .min(1, "Tax name is required")
            .max(50),

        taxType: z.enum(["INTRA_STATE", "INTER_STATE"]),

        taxRate: z
            .union([z.string(), z.number()])
            .refine(
                (val) => !isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100,
                "Tax rate must be a number between 0 and 100"
            ),

        status: z
            .enum(["ACTIVE", "INACTIVE"])
            .optional()
            .default("ACTIVE"),
    }),
});

/**
 * Update GST Tax Validation
 */
export const updateGstTaxSchema = z.object({
    body: createGstTaxSchema.shape.body.partial(),

    params: z.object({
        gstTaxId: z
            .string()
            .uuid("GST Tax ID must be a valid UUID"),
    }),
});

/**
 * GST Tax ID Validation
 */
export const gstTaxIdSchema = z.object({
    params: z.object({
        gstTaxId: z
            .string()
            .uuid("GST Tax ID must be a valid UUID"),
    }),
});

/**
 * Query validation for list/search endpoint
 */
export const gstTaxQuerySchema = z.object({
    query: z.object({
        search: z.string().optional(),
        page: z.string().regex(/^\d+$/).optional(),
        pageSize: z.string().regex(/^\d+$/).optional(),
    }),
});

export type CreateGstTaxInput = z.infer<typeof createGstTaxSchema>["body"];
export type UpdateGstTaxInput = z.infer<typeof updateGstTaxSchema>["body"];
export type GstTaxQueryInput = z.infer<typeof gstTaxQuerySchema>["query"];