import { z } from "zod";

/**
 * Validation schema for EOD Stock query parameters
 */
export const getEodStockSchema = z.object({
  query: z.object({
    date: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Invalid date format")
      .optional(),
    category: z
      .enum(["RAW_MATERIAL", "FINISHED_PRODUCT", "WASTAGE"])
      .optional(),
    storeId: z.string().optional(),
    search: z.string().optional(),
    page: z
      .string()
      .regex(/^\d+$/, "Page must be a valid number")
      .optional()
      .or(z.number().optional()),
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a valid number")
      .optional()
      .or(z.number().optional()),
  }),
});
