import { z } from "zod";

export const weeklyProgramIdSchema = z.object({
  params: z.object({
    weeklyProgramId: z.string().min(1, "Weekly Program ID is required"),
  }),
});

export const createWeeklyProgramSchema = z.object({
  body: z.object({
    weeklyProgramId: z
      .string()
      .min(1, "Weekly Program ID is required")
      .max(50),

    productionOrderId: z
      .string()
      .min(1, "Production Order is required")
      .max(50),

    weekStartDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Invalid week start date"),

    weekEndDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Invalid week end date"),

    machineId: z
      .string()
      .max(50)
      .optional()
      .nullable(),

    shiftId: z
      .string()
      .max(50)
      .optional()
      .nullable(),

    dayOfWeek: z
      .number()
      .int()
      .min(1, "Day must be between 1 and 7")
      .max(7, "Day must be between 1 and 7"),

    plannedQty: z
      .number()
      .positive("Planned Quantity must be greater than 0"),

    plannedHours: z
      .number()
      .nonnegative("Planned Hours cannot be negative")
      .optional()
      .nullable(),

    setupHours: z
      .number()
      .min(0, "Setup Hours cannot be negative")
      .optional()
      .nullable(),

    sequenceNo: z
      .number()
      .int()
      .nonnegative()
      .default(1)
      .optional(),

    priority: z
      .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
      .optional(),

    status: z
      .enum([
        "DRAFT",
        "PLANNED",
        "APPROVED",
        "RELEASED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ])
      .optional(),

    remarks: z
      .string()
      .max(255)
      .optional()
      .nullable(),
  }),
});

export const updateWeeklyProgramSchema = z.object({
  params: z.object({
    weeklyProgramId: z.string().min(1, "Weekly Program ID is required"),
  }),

  body: z.object({
    productionOrderId: z
      .string()
      .max(50)
      .optional(),

    weekStartDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Invalid week start date")
      .optional(),

    weekEndDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Invalid week end date")
      .optional(),

    machineId: z
      .string()
      .max(50)
      .optional()
      .nullable(),

    shiftId: z
      .string()
      .max(50)
      .optional()
      .nullable(),

    dayOfWeek: z
      .number()
      .int()
      .min(1)
      .max(7)
      .optional(),

    plannedQty: z
      .number()
      .positive()
      .optional(),

    plannedHours: z
      .number()
      .nonnegative()
      .optional()
      .nullable(),

    setupHours: z
      .number()
      .min(0)
      .optional()
      .nullable(),

    sequenceNo: z
      .number()
      .int()
      .nonnegative()
      .optional(),

    priority: z
      .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
      .optional(),

    status: z
      .enum([
        "DRAFT",
        "PLANNED",
        "APPROVED",
        "RELEASED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ])
      .optional(),

    remarks: z
      .string()
      .max(255)
      .optional()
      .nullable(),
  }),
});

export type CreateWeeklyProgramInput =
  z.infer<typeof createWeeklyProgramSchema>["body"];

export type UpdateWeeklyProgramInput =
  z.infer<typeof updateWeeklyProgramSchema>["body"];