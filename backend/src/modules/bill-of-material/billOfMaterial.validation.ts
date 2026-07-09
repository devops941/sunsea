import { z } from "zod";

const billOfMaterialItemSchema = z.object({
    rawMaterialId: z
        .string()
        .trim()
        .min(1, "Raw Material is required")
        .max(50, "Raw Material Id cannot exceed 50 characters"),

    requiredQuantity: z.coerce
        .number()
        .positive("Required Quantity must be greater than 0")
        .finite("Required Quantity must be a valid number"),
        
    uom: z.string().trim().min(1, "UOM is required").max(20),
});

export const createBillOfMaterialSchema = z.object({
    body: z.object({
        productId: z.coerce
            .number()
            .int("Invalid Product")
            .positive("Product is required"),

        remarks: z
            .string()
            .trim()
            .max(500, "Remarks cannot exceed 500 characters")
            .optional(),

        items: z
            .array(billOfMaterialItemSchema)
            .min(1, "At least one Raw Material is required")
            .superRefine((items, ctx) => {
                const ids = new Set<string>();

                items.forEach((item, index) => {
                    if (ids.has(item.rawMaterialId)) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: [index, "rawMaterialId"],
                            message: "Duplicate Raw Material is not allowed",
                        });
                    }

                    ids.add(item.rawMaterialId);
                });
            }),
    }),
});

export const updateBillOfMaterialSchema = z.object({
    params: z.object({
        id: z.coerce
            .number()
            .int("Invalid Bill Of Material Id")
            .positive("Invalid Bill Of Material Id"),
    }),

    body: createBillOfMaterialSchema.shape.body.partial(),
});

export const billOfMaterialIdSchema = z.object({
    params: z.object({
        id: z.coerce
            .number()
            .int("Invalid Bill Of Material Id")
            .positive("Invalid Bill Of Material Id"),
    }),
});