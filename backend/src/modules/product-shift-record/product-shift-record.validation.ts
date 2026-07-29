import { z } from "zod";

export const createRecordSchema = z.object({
  body: z.object({
    productId: z.coerce.number().min(1, "Product is required"),
    productionOrderId: z.string().min(1, "Production Order is required"),
    machineId: z.string().min(1, "Machine is required"),
    shiftId: z.string().min(1, "Shift is required"),
    achievedQty: z.coerce.number().min(0, "Achieved Qty must be 0 or more"),
    targetQty: z.coerce.number().min(0, "Target Qty must be 0 or more"),
    operatorIds: z.string().optional().nullable(),
  }),
});

export const productIdSchema = z.object({
  params: z.object({
    productId: z.string().min(1),
  }),
});

export type CreateRecordInput = z.infer<typeof createRecordSchema>["body"];
