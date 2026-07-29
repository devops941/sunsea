import { z } from "zod";

export const createCapacityHistorySchema = z.object({
  body: z.object({
    productId: z.coerce.number().min(1),
    previousCapacity: z.coerce.number().min(0),
    newCapacity: z.coerce.number().min(0),
    productionDate: z.string().min(1),
    machineId: z.string().min(1),
    shiftId: z.string().min(1),
    productionOrderId: z.string().min(1),
    targetQty: z.coerce.number().min(0),
    actualQty: z.coerce.number().min(0),
    operators: z.string().nullable().optional(),
    updatedBy: z.string().nullable().optional(),
  }),
});

export const productIdSchema = z.object({
  params: z.object({
    productId: z.coerce.number().min(1),
  }),
});

export const machineIdSchema = z.object({
  params: z.object({
    machineId: z.string().min(1),
  }),
});
