import { z } from "zod";

const salesProductComponentSchema = z.object({
  componentProductId: z.coerce
    .number()
    .int("Invalid Component Product")
    .positive("Component Product is required"),

  quantity: z.coerce
    .number()
    .positive("Quantity must be greater than 0")
    .finite("Quantity must be a valid number"),

  remarks: z.string().trim().max(255).optional(),
});

export const createSalesProductSchema = z.object({
  body: z.object({
    salesProductName: z.string().trim().min(1, "Sales Product Name is required").max(160),
    description: z.string().trim().max(255).optional(),
    hsnCode: z.string().trim().min(1, "HSN Code is required").max(20),
    rate: z.coerce.number().min(0, "Rate must be greater than or equal to 0").optional(),
    isActive: z.coerce.boolean().optional(),

    openingStockQty: z.coerce.number().optional(),
    openingStockStoreId: z.string().max(20).optional(),

    components: z
      .array(salesProductComponentSchema)
      .min(1, "At least one component product is required")
      .superRefine((items, ctx) => {
        const ids = new Set<number>();
        items.forEach((item, index) => {
          if (ids.has(item.componentProductId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, "componentProductId"],
              message: "Duplicate component product is not allowed",
            });
          }
          ids.add(item.componentProductId);
        });
      }),
  }),
});

export const updateSalesProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Invalid Sales Product id"),
  }),
  body: createSalesProductSchema.shape.body.partial(),
});

export const salesProductIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Invalid Sales Product id"),
  }),
});
