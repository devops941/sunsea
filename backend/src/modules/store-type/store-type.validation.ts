import { z } from "zod";

export const createStoreTypeSchema = z.object({
  body: z.object({
    code: z.string().min(1, "Code is required").max(20),
    name: z.string().min(1, "Name is required").max(50),
    description: z.string().max(255).optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const updateStoreTypeSchema = z.object({
  body: createStoreTypeSchema.shape.body.partial(),
  params: z.object({
    id: z.coerce.number(),
  }),
});

export const storeTypeIdSchema = z.object({
  params: z.object({
    id: z.coerce.number(),
  }),
});

export type CreateStoreTypeInput = z.infer<typeof createStoreTypeSchema>["body"];
export type UpdateStoreTypeInput = z.infer<typeof updateStoreTypeSchema>["body"];
