import { z } from "zod";

export const dailyPlanIdSchema = z.object({
  params: z.object({
    dailyPlanId: z.string().min(1, "Daily Plan ID is required"),
  }),
});

export const createDailyPlanSchema = z.object({
  body: z.object({
    weeklyProgramId: z
      .string()
      .min(1, "Weekly Program ID is required")
      .max(20),

    productionOrderId: z
      .string()
      .min(1, "Production Order ID is required")
      .max(20),

    productionDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Invalid production date format (use YYYY-MM-DD)"),

    machineId: z
      .string()
      .min(1, "Machine ID is required")
      .max(20),

    shiftId: z
      .string()
      .min(1, "Shift ID is required")
      .max(20),

    plannedQty: z
      .number()
      .positive("Planned Quantity must be greater than 0"),

    plannedHours: z.preprocess(
      (val) => (val === "" || val === null || val === undefined) ? null : Number(val),
      z.number().nonnegative("Planned Hours cannot be negative").optional().nullable()
    ),

    priority: z
      .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
      .optional(),

    status: z
      .enum(["DRAFT", "PLANNED", "APPROVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "STOPPED", "POST_PRODUCTION", "READY_FOR_DISPATCH", "PARTIAL_COMPLETED"])
      .optional(),

    remarks: z
      .string()
      .max(255)
      .optional()
      .nullable(),

    carryForwardFromPlanId: z
      .string()
      .max(50)
      .optional()
      .nullable(),
  }),
});

export const updateDailyPlanSchema = z.object({
  params: z.object({
    dailyPlanId: z.string().min(1, "Daily Plan ID is required"),
  }),

  body: z.object({
    weeklyProgramId: z
      .string()
      .max(20)
      .optional(),

    productionOrderId: z
      .string()
      .max(20)
      .optional(),

    productionDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), "Invalid production date format")
      .optional(),

    machineId: z
      .string()
      .max(20)
      .optional(),

    shiftId: z
      .string()
      .max(20)
      .optional(),

    plannedQty: z
      .number()
      .positive("Planned Quantity must be greater than 0")
      .optional(),

    plannedHours: z.preprocess(
      (val) => (val === "" || val === null || val === undefined) ? null : Number(val),
      z.number().nonnegative("Planned Hours cannot be negative").optional().nullable()
    ),

    priority: z
      .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
      .optional(),

    status: z
      .enum(["DRAFT", "PLANNED", "APPROVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "STOPPED", "NEXT_STEP", "POST_PRODUCTION", "READY_FOR_DISPATCH", "PARTIAL_COMPLETED"])
      .optional(),

    remarks: z
      .string()
      .max(255)
      .optional()
      .nullable(),

    carryForwardFromPlanId: z
      .string()
      .max(50)
      .optional()
      .nullable(),
  }),
});

export type CreateDailyPlanInput = z.infer<typeof createDailyPlanSchema>["body"];
export type UpdateDailyPlanInput = z.infer<typeof updateDailyPlanSchema>["body"];
