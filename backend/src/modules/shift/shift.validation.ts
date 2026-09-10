import { z } from "zod";

const numericStringOrNumber = z.union([
  z.number().int().nonnegative(),
  z.string().regex(/^\d*$/),
]);

export const createShiftSchema = z.object({
  body: z.object({
    shiftCode: z
      .string()
      .min(1, "Shift Code is required")
      .max(20),

    shiftName: z
      .string()
      .min(1, "Shift Name is required")
      .max(100),

    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format"),

    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format"),

    breakDuration: numericStringOrNumber.optional().nullable(),

    isActive: z.boolean().optional(),
  }),
});

export const updateShiftSchema = z.object({
  body: z.object({
    shiftCode: z.string().max(20).optional(),

    shiftName: z.string().max(100).optional(),

    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional(),

    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .optional(),

    breakDuration: numericStringOrNumber.optional().nullable(),

    isActive: z.boolean().optional(),
  }),

  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
});

export const shiftIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>["body"];

export type UpdateShiftInput = z.infer<typeof updateShiftSchema>["body"];